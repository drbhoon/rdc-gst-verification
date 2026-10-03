import { env } from "cloudflare:workers";

import { ensureTables, getDb } from "@/db";
import { uploadedDocuments } from "@/db/schema";
import { resolveAppUser } from "@/lib/auth";
import { getGstApiSettings } from "@/lib/gst/settings";
import {
  extractImageFromPdf,
  parseInvoiceFields,
  recognizeText,
  recognizeWithOcrSpace,
} from "@/lib/ocr";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

export async function POST(request: Request) {
  const user = await resolveAppUser(request);

  await ensureTables();

  try {
    const formData = await request.formData();
    const upload = formData.get("invoice");
    if (!(upload instanceof File)) {
      return Response.json({ error: "Choose an invoice PDF, JPG or PNG" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(upload.type)) {
      return Response.json({ error: "Only PDF, JPG and PNG files are supported" }, { status: 400 });
    }
    if (upload.size > MAX_FILE_BYTES) {
      return Response.json({ error: "Invoice files must be 50 MB or smaller" }, { status: 400 });
    }

    const arrayBuffer = await upload.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const id = crypto.randomUUID();
    const safeName = upload.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
    const objectKey = `${user.userId}/${id}-${safeName}`;

    if (env.BUCKET) {
      try {
        await env.BUCKET.put(objectKey, fileBuffer, {
          httpMetadata: { contentType: upload.type },
        });
      } catch (err) {
        console.warn("R2 storage skipped or unavailable:", err);
      }
    }

    const settings = getGstApiSettings();
    let recognizedText = "";
    let provider = "rule-fallback";

    // 1. Send to OCR & Native PDF Extraction Service (Daemon on :5174)
    // Runs in Node.js runtime and supports:
    // - Native vector digital PDF text extraction (100% accuracy)
    // - Cloud OCR (OCR.Space Engine 1)
    // - Local Tesseract.js OCR
    try {
      const ocrResult = await recognizeText(fileBuffer, settings.ocrApiKey, settings.ocrEngine);
      if (ocrResult.text && ocrResult.text.trim().length > 20) {
        recognizedText = ocrResult.text.trim();
        provider = ocrResult.provider;
      }
    } catch (daemonErr) {
      console.warn("OCR daemon request failed:", daemonErr);
    }

    // 2. Fallback: If daemon was unreachable and Cloud OCR is allowed, try OCR.Space directly
    if (!recognizedText && settings.ocrEngine !== "tesseract") {
      try {
        let bufferToOcr: Buffer<ArrayBufferLike> = fileBuffer;
        let mimeToOcr = upload.type;
        if (upload.type === "application/pdf") {
          const img = extractImageFromPdf(fileBuffer);
          if (img) {
            bufferToOcr = img;
            mimeToOcr = "image/jpeg";
          }
        }
        const cloudText = await recognizeWithOcrSpace(
          bufferToOcr,
          upload.name,
          mimeToOcr,
          settings.ocrApiKey,
        );
        if (cloudText && cloudText.trim().length > 20) {
          recognizedText = cloudText.trim();
          provider = "ocr-space";
        }
      } catch (cloudErr) {
        console.warn("Direct Cloud OCR fallback failed:", cloudErr);
      }
    }

    const extraction = parseInvoiceFields(recognizedText, upload.name);

    await getDb().insert(uploadedDocuments).values({
      id,
      userId: user.userId,
      fileName: upload.name,
      contentType: upload.type,
      sizeBytes: upload.size,
      objectKey,
      extractionJson: JSON.stringify(extraction),
      ocrProvider: provider,
    });

    return Response.json(
      {
        documentId: id,
        fileName: upload.name,
        extraction,
        provider,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("ocr_upload_failed", error);
    return Response.json(
      { error: "The invoice could not be uploaded or read. Please try again." },
      { status: 503 },
    );
  }
}
