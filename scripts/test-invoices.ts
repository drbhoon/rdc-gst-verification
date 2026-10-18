import fs from "fs";
import path from "path";
import { parseInvoiceFields } from "../lib/ocr";
import { reconcileInvoiceData } from "../lib/gst/reconciliation";

const uploadedDir = "C:/Users/KSBHOON/.gemini/antigravity/brain/8380b5e2-ffbf-434e-9434-5ee80dd6f000/.user_uploaded";
const files = [
  { name: "Greenline Enterprise", file: "media_1792318542447_72b4b798.pdf", expectedInv: "GLE/2026-27/187", expectedTaxable: 272717, expectedTotal: 321806.06 },
  { name: "Aman Traders", file: "media_1792318542447_85f9ef1f.pdf", expectedInv: "117", expectedTaxable: 228999, expectedTotal: 270219 },
  { name: "Usha Enterprises", file: "media_1792318542447_007dc565.pdf", expectedInv: "67-2026/27", expectedTaxable: 621274, expectedTotal: 733103.32 },
];

async function run() {
  console.log("==================================================");
  console.log("TEST 1: OCR EXTRACTION & PARSING FOR THE 3 INVOICES");
  console.log("==================================================");

  let allPassed = true;

  for (const item of files) {
    console.log(`\nTesting: ${item.name}`);
    const filePath = path.join(uploadedDir, item.file);
    const buf = fs.readFileSync(filePath);

    const res = await fetch("http://127.0.0.1:5174/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(buf),
    });

    if (!res.ok) {
      console.error(`OCR service failed with status ${res.status}`);
      allPassed = false;
      continue;
    }

    const { text, provider } = await res.json();
    const parsed = parseInvoiceFields(text, item.file);

    console.log(`Provider: ${provider}`);
    console.log(`Extracted Invoice No : "${parsed.invoiceNumber.value}" (expected: "${item.expectedInv}")`);
    console.log(`Extracted Taxable    : ${parsed.taxableValue.value} (expected: ${item.expectedTaxable})`);
    console.log(`Extracted Total      : ${parsed.invoiceValue.value} (expected: ${item.expectedTotal})`);
    console.log(`Extracted Supplier   : ${parsed.supplierGstin.value}`);
    console.log(`Extracted Our GSTIN  : ${parsed.ourGstin.value}`);

    if (parsed.invoiceNumber.value !== item.expectedInv) {
      console.error(`❌ Invoice Number MISMATCH for ${item.name}`);
      allPassed = false;
    }
    if (parsed.taxableValue.value !== item.expectedTaxable) {
      console.error(`❌ Taxable Value MISMATCH for ${item.name}`);
      allPassed = false;
    }
    if (parsed.invoiceValue.value !== item.expectedTotal) {
      console.error(`❌ Total Invoice Value MISMATCH for ${item.name}`);
      allPassed = false;
    }

    // Now test GST Reconciliation for this invoice
    const recResult = reconcileInvoiceData({
      ourGstin: parsed.ourGstin.value,
      supplierGstin: parsed.supplierGstin.value,
      invoiceNumber: parsed.invoiceNumber.value,
      invoiceDate: parsed.invoiceDate.value,
      taxableValue: parsed.taxableValue.value,
      invoiceValue: parsed.invoiceValue.value,
    });

    console.log(`Reconciliation Status: ${recResult.status} - "${recResult.title}"`);
    if (recResult.status !== "VALID") {
      console.error(`❌ Reconciliation failed for ${item.name}:`, recResult.mismatches);
      allPassed = false;
    } else {
      console.log(`✅ ${item.name} is COMPLIANT and VALID in GSTR-2B!`);
    }
  }

  console.log("\n==================================================");
  console.log("TEST 2: MANUAL EDIT RECONCILIATION TEST");
  console.log("==================================================");
  // Simulate user editing values after bad OCR (docExtraction had old line item values)
  const manualEditResult = reconcileInvoiceData(
    {
      ourGstin: "19AAACU0108Q1Z5",
      supplierGstin: "19ABCFG8916G1Z6",
      invoiceNumber: "GLE/2026-27/187",
      invoiceDate: "2026-09-26",
      taxableValue: 272717,
      invoiceValue: 321806.06,
    },
    {
      docExtraction: {
        invoiceNumber: "OLD-LINE-ITEM-1",
        taxableValue: 135000,
        invoiceValue: 159300,
      },
    }
  );

  console.log(`Manual edit test result: ${manualEditResult.status} - "${manualEditResult.title}"`);
  if (manualEditResult.status === "VALID") {
    console.log("✅ User manual edit accepted without 'Document Mismatch' blocking error!");
  } else {
    console.error("❌ Manual edit was incorrectly rejected:", manualEditResult);
    allPassed = false;
  }

  if (allPassed) {
    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n");
  } else {
    console.error("\n❌ Some tests failed.\n");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
