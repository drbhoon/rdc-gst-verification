import http from "node:http";
import zlib from "node:zlib";
import { createWorker } from "tesseract.js";
import { PDFParse } from "pdf-parse";

const PORT = 5174;
const HOST = "127.0.0.1";

process.on("uncaughtException", (err) => console.error("Uncaught exception in OCR daemon:", err.message));
process.on("unhandledRejection", (reason) => console.error("Unhandled rejection in OCR daemon:", reason));

let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng").catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

function extractImageFromPdf(buf) {
  const str = buf.toString("latin1");
  let searchPos = 0;

  while (searchPos < str.length) {
    const dctIdx = str.indexOf("/DCTDecode", searchPos);
    if (dctIdx === -1) break;

    const streamIdx = str.indexOf("stream", dctIdx);
    const endStreamIdx = str.indexOf("endstream", streamIdx);
    if (streamIdx !== -1 && endStreamIdx !== -1) {
      let start = streamIdx + 6;
      if (buf[start] === 0x0d && buf[start + 1] === 0x0a) start += 2;
      else if (buf[start] === 0x0a || buf[start] === 0x0d) start += 1;

      let end = endStreamIdx;
      while (end > start && (buf[end - 1] === 0x0a || buf[end - 1] === 0x0d || buf[end - 1] === 0x20)) end--;

      let slice = buf.subarray(start, end);

      // Decompress zlib streams (/FlateDecode header 0x78)
      if (slice[0] === 0x78 && (slice[1] === 0x9c || slice[1] === 0x01 || slice[1] === 0xda || slice[1] === 0x5e)) {
        try {
          slice = zlib.inflateSync(slice);
        } catch {
          // keep slice as is
        }
      }

      // Check if it's a valid JPEG (FF D8) or PNG (89 50)
      const isJpeg = slice[0] === 0xff && slice[1] === 0xd8;
      const isPng = slice[0] === 0x89 && slice[1] === 0x50;
      if ((isJpeg || isPng) && slice.length >= 20000) {
        return slice;
      }
    }
    searchPos = (streamIdx !== -1 ? streamIdx : dctIdx) + 10;
  }
  return null;
}

async function tryOcrSpace(buffer, mimeType, apiKey = "helloworld") {
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
  const ext = isJpeg ? "jpg" : (isPng ? "png" : (mimeType === "application/pdf" ? "pdf" : "jpg"));
  const actualMime = isJpeg ? "image/jpeg" : (isPng ? "image/png" : mimeType);

  for (const engine of ["2", "1"]) {
    const form = new FormData();
    form.append("apikey", apiKey);
    const blob = new Blob([new Uint8Array(buffer)], { type: actualMime });
    form.append("file", blob, `invoice.${ext}`);
    form.append("filetype", ext);
    form.append("OCREngine", engine);
    form.append("isTable", "true");
    form.append("detectOrientation", "true");
    form.append("scale", "true");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);

    try {
      const res = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        const pages = json.ParsedResults || [];
        const text = pages.map((p) => p.ParsedText || "").join("\n").trim();
        if (text.length > 20) {
          return text;
        }
      } else {
        console.warn(`OCR.Space Engine ${engine} HTTP ${res.status}`);
      }
    } catch (err) {
      clearTimeout(timer);
      console.warn(`OCR.Space Engine ${engine} unavailable:`, err.message);
    }
  }
  return "";
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-ocr-api-key, x-ocr-engine");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.url === "/health" && req.method === "GET") {
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ status: "ok" }));
  }

  if (req.url === "/ocr" && req.method === "POST") {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const isPdf = buffer.slice(0, 5).toString("latin1") === "%PDF-";
        const ocrApiKey = req.headers["x-ocr-api-key"] || process.env.OCR_SPACE_API_KEY || "helloworld";
        const ocrEngineReq = req.headers["x-ocr-engine"] || "auto";

        // Stage 1: Digital PDF Parsing
        let digitalAttachmentText = "";
        if (isPdf) {
          try {
            const parser = new PDFParse(new Uint8Array(buffer));
            const pdfRes = await parser.getText();
            const page1Text = pdfRes?.pages?.[0]?.text?.trim() || "";
            const digitalText = pdfRes?.text?.trim() || "";

            // If Page 1 contains substantial native vector digital text (> 100 chars), return it directly
            if (page1Text.length > 100) {
              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify({ text: digitalText, provider: "native-pdf" }));
            }
            digitalAttachmentText = digitalText;
          } catch (pdfErr) {
            console.warn("Digital PDF parse error, falling back to OCR:", pdfErr.message);
          }
        }

        // Stage 2: Extract embedded Page 1 image if scanned PDF
        const extractedImg = isPdf ? extractImageFromPdf(buffer) : null;
        const imageToOcr = extractedImg || buffer;
        const isImage = (imageToOcr[0] === 0xff && imageToOcr[1] === 0xd8) || (imageToOcr[0] === 0x89 && imageToOcr[1] === 0x50);

        let ocrText = "";
        let usedProvider = "rule-fallback";

        // Stage 3: Cloud OCR (OCR.Space Engine 1)
        if (ocrEngineReq !== "tesseract") {
          try {
            const cloudText = await tryOcrSpace(
              imageToOcr,
              isImage ? (imageToOcr[0] === 0xff ? "image/jpeg" : "image/png") : (isPdf ? "application/pdf" : "image/jpeg"),
              ocrApiKey,
            );
            if (cloudText && cloudText.trim().length > 20) {
              ocrText = cloudText.trim();
              usedProvider = "ocr-space";
            }
          } catch (cloudErr) {
            console.warn("Cloud OCR failed:", cloudErr.message);
          }
        }

        // Stage 4: Local Tesseract OCR Daemon Fallback (Works offline with zero external dependencies)
        if (!ocrText && (isImage || !isPdf)) {
          try {
            const worker = await getWorker();
            const result = await worker.recognize(imageToOcr);
            const localText = result?.data?.text?.trim() || "";
            if (localText.length > 20) {
              ocrText = localText;
              usedProvider = "tesseract-ocr";
            }
          } catch (tessErr) {
            console.warn("Tesseract worker error:", tessErr.message);
            workerPromise = null;
          }
        }

        // Combine Page 1 OCR text with any digital attachment text (e.g. approval emails)
        const combinedText = [ocrText, digitalAttachmentText].filter(Boolean).join("\n\n");

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ text: combinedText, provider: ocrText ? usedProvider : "native-pdf" }));
      } catch (err) {
        console.error("OCR recognition error:", err);
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    });
    return;
  }

  res.statusCode = 404;
  res.end();
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`[OCR Server] Port ${PORT} already in use; assuming existing OCR daemon is active.`);
    return;
  }
  console.error("OCR server error:", err);
});

server.listen(PORT, HOST, () => {
  console.log(`[OCR Server] Listening on http://${HOST}:${PORT}`);
});
