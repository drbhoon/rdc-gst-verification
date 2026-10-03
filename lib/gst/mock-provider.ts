import { reconcileInvoiceData } from "./reconciliation";
import type {
  ComplianceRating,
  EinvoiceResult,
  EinvoiceStatus,
  EinvoiceVerificationInput,
  FilingStatus,
  FilingStatusInput,
  GstinStatus,
  GstProviderResult,
  GstVerificationProvider,
  InvoiceLookupInput,
  ReturnFilingRecord,
  TaxpayerType,
} from "./types";

export class ProviderUnavailableError extends Error {
  constructor(message = "The GST data provider is temporarily unavailable") {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

const STATE_NAMES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "19": "West Bengal",
  "24": "Gujarat",
  "27": "Maharashtra",
  "29": "Karnataka",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "36": "Telangana",
  "37": "Andhra Pradesh",
};

function generateMockArn(stateCode: string, periodMonth: number, year: number): string {
  const yy = String(year).slice(-2);
  const mm = String(periodMonth).padStart(2, "0");
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `AA${stateCode}${mm}${yy}${randomDigits}Z`;
}

export function generateMockFilingHistory(
  stateCode: string,
  gstinStatus: GstinStatus,
  complianceRating: ComplianceRating,
): ReturnFilingRecord[] {
  const periods = [
    { name: "Feb 2026", month: 2, year: 2026 },
    { name: "Jan 2026", month: 1, year: 2026 },
    { name: "Dec 2025", month: 12, year: 2025 },
    { name: "Nov 2025", month: 11, year: 2025 },
    { name: "Oct 2025", month: 10, year: 2025 },
    { name: "Sep 2025", month: 9, year: 2025 },
  ];

  const filingHistory: ReturnFilingRecord[] = [];

  periods.forEach((p, index) => {
    const isCurrentMonth = index === 0;
    const isPastMonth = index === 1;

    // GSTR-1
    let gstr1Status: ReturnFilingRecord["status"] = "Filed";
    let gstr1Date: string | undefined = `2026-0${p.month}-10`;
    let gstr1Arn: string | undefined = generateMockArn(stateCode, p.month, p.year);

    if (gstinStatus === "CANCELLED" && index < 3) {
      gstr1Status = "Not Filed";
      gstr1Date = undefined;
      gstr1Arn = undefined;
    } else if (complianceRating === "Defaulter" && (isCurrentMonth || isPastMonth)) {
      gstr1Status = "Not Filed";
      gstr1Date = undefined;
      gstr1Arn = undefined;
    } else if (complianceRating === "Delayed") {
      gstr1Status = "Late Filed";
      gstr1Date = `2026-0${p.month}-26`;
    }

    filingHistory.push({
      returnType: "GSTR-1",
      financialYear: p.year === 2026 ? "2025-26" : "2025-26",
      taxPeriod: p.name,
      status: gstr1Status,
      filingDate: gstr1Date,
      arn: gstr1Arn,
      mode: "ONLINE",
    });

    // GSTR-3B
    let gstr3bStatus: ReturnFilingRecord["status"] = "Filed";
    let gstr3bDate: string | undefined = `2026-0${p.month}-19`;
    let gstr3bArn: string | undefined = generateMockArn(stateCode, p.month, p.year);

    if (gstinStatus === "CANCELLED" && index < 3) {
      gstr3bStatus = "Not Filed";
      gstr3bDate = undefined;
      gstr3bArn = undefined;
    } else if (complianceRating === "Defaulter" && (isCurrentMonth || isPastMonth)) {
      gstr3bStatus = "Not Filed";
      gstr3bDate = undefined;
      gstr3bArn = undefined;
    } else if (complianceRating === "Delayed") {
      gstr3bStatus = "Late Filed";
      gstr3bDate = `2026-0${p.month}-28`;
    }

    filingHistory.push({
      returnType: "GSTR-3B",
      financialYear: p.year === 2026 ? "2025-26" : "2025-26",
      taxPeriod: p.name,
      status: gstr3bStatus,
      filingDate: gstr3bDate,
      arn: gstr3bArn,
      mode: "ONLINE",
    });
  });

  return filingHistory;
}

export class MockGstProvider implements GstVerificationProvider {
  async verifyInvoice(input: InvoiceLookupInput): Promise<GstProviderResult> {
    if (input.invoiceNumber.toUpperCase().includes("ERROR")) throw new ProviderUnavailableError();

    await new Promise((resolve) => setTimeout(resolve, 350));
    return reconcileInvoiceData(input, {
      providerName: "mock-gst",
      docExtraction: input.docExtraction,
    });
  }

  async getSupplierFilingStatus(input: FilingStatusInput): Promise<FilingStatus> {
    const upper = input.supplierGstin.toUpperCase();
    if (upper.includes("ERROR")) throw new ProviderUnavailableError();

    await new Promise((resolve) => setTimeout(resolve, 500));

    const stateCode = upper.slice(0, 2);
    const stateName = STATE_NAMES[stateCode] || "State Jurisdiction";
    const checkedAt = new Date().toISOString();
    const reference = `RET-MOCK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    let gstinStatus: GstinStatus = "ACTIVE";
    let complianceRating: ComplianceRating = "Compliant";
    let summary = "Supplier has filed all statutory GSTR-1 and GSTR-3B returns on time.";
    const riskFactors: string[] = [];

    if (upper.includes("CANCEL")) {
      gstinStatus = "CANCELLED";
      complianceRating = "Defaulter";
      summary = "Supplier GST registration has been cancelled by the tax authority. ITC claims are prohibited.";
      riskFactors.push("Registration status is CANCELLED (effective since 15-Nov-2025)");
      riskFactors.push("Recipients cannot claim input tax credit for invoices dated post-cancellation");
      riskFactors.push("High risk of notice under Section 16(2)(c)");
    } else if (upper.includes("SUSP")) {
      gstinStatus = "SUSPENDED";
      complianceRating = "Delayed";
      summary = "Supplier registration is currently suspended pending verification by the jurisdictional tax officer.";
      riskFactors.push("Registration under temporary suspension");
      riskFactors.push("Verify resumption before releasing vendor payment");
    } else if (upper.includes("DEF") || upper.includes("RNF")) {
      gstinStatus = "ACTIVE";
      complianceRating = "Defaulter";
      summary = "Supplier has defaulted on monthly GSTR-3B filings. Invoices are ineligible for ITC under Section 16(2)(aa).";
      riskFactors.push("GSTR-3B pending for the last 2 consecutive return periods");
      riskFactors.push("Unpaid tax liability to government; credit at risk of clawback");
      riskFactors.push("Automated system flag: High Non-Compliance Risk");
    } else if (upper.includes("DELAY") || upper.includes("LATE")) {
      gstinStatus = "ACTIVE";
      complianceRating = "Delayed";
      summary = "Supplier consistently files GSTR-1 and GSTR-3B after the statutory 11th and 20th due dates.";
      riskFactors.push("Average filing delay of 14-22 days across previous 6 months");
      riskFactors.push("Invoices reflect late in your monthly GSTR-2B cycles");
    }

    const taxpayerType: TaxpayerType = upper.includes("COMP") ? "Composition" : "Regular";
    const filingFrequency = "Monthly" as const;

    const filingHistory = generateMockFilingHistory(stateCode, gstinStatus, complianceRating);

    const pan = upper.slice(2, 12);
    const legalName = `ENTERPRISE SOLUTIONS (${pan}) PRIVATE LIMITED`;
    const tradeName = `TECHFLOW SERVICES ${stateName.toUpperCase()}`;

    return {
      gstin: upper,
      legalName,
      tradeName,
      gstinStatus,
      registrationDate: "2018-07-01",
      stateJurisdiction: `Ward 3, ${stateName} State Tax`,
      centerJurisdiction: `Division II, Commissionerate ${stateCode}`,
      taxpayerType,
      filingFrequency,
      complianceRating,
      gstr1FilingStatus: complianceRating === "Defaulter" ? "Pending" : complianceRating === "Delayed" ? "Delayed" : "Up to date",
      gstr3bFilingStatus: complianceRating === "Defaulter" ? "Pending" : complianceRating === "Delayed" ? "Delayed" : "Up to date",
      lastFiledPeriod: complianceRating === "Defaulter" ? "Nov 2025" : "Jan 2026",
      summary,
      riskFactors,
      filingHistory,
      provider: "mock-gst-returns",
      providerReference: reference,
      checkedAt,
    };
  }

  async verifyEinvoice(input: EinvoiceVerificationInput): Promise<EinvoiceResult> {
    const rawVal = (input.irn || input.docNumber || "").toUpperCase();
    if (rawVal.includes("ERROR")) throw new ProviderUnavailableError();

    await new Promise((resolve) => setTimeout(resolve, 400));

    const checkedAt = new Date().toISOString();
    const reference = `IRN-MOCK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    let status: EinvoiceStatus = "VALID";
    let title = "E-Invoice verified and active on IRP";
    let summary = "The Invoice Reference Number (IRN) is authentic, active, and digitally signed by the Invoice Registration Portal.";
    let cancelDate: string | undefined;
    let cancelReason: string | undefined;

    if (rawVal.includes("404") || rawVal.includes("NOTFOUND") || rawVal.includes("FAKE")) {
      status = "NOT_FOUND";
      title = "IRN not registered on IRP";
      summary = "No matching IRN record exists on any authorized Invoice Registration Portal (NIC/ClearTax/Cygnet).";
    } else if (rawVal.includes("CANCEL")) {
      status = "CANCELLED";
      title = "E-Invoice cancelled on IRP";
      summary = "This IRN was cancelled by the supplier within 24 hours of generation. It is invalid for claiming input tax credit.";
      cancelDate = "2026-02-14T11:24:00Z";
      cancelReason = "Invoice cancelled due to incorrect buyer GSTIN or pricing error";
    } else if (rawVal.includes("MISMATCH") || rawVal.includes("MM")) {
      status = "MISMATCH";
      title = "E-Invoice payload mismatch";
      summary = "IRN exists on IRP, but the reported taxable value or buyer GSTIN does not match the invoice provided.";
    }

    const defaultIrn = input.irn && input.irn.length === 64
      ? input.irn.toLowerCase()
      : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    const supplierGstin = input.supplierGstin?.toUpperCase() || "27ABCDE1234F1Z0";
    const buyerGstin = "27AAACR5055K1Z7";
    const docNumber = input.docNumber?.toUpperCase() || "INV-2026-1089";
    const docType = input.docType || "INV";
    const docDate = input.docDate || "2026-02-15";
    const totalInvoiceValue = input.totalValue ?? 118000;
    const taxableValue = Math.round((totalInvoiceValue / 1.18) * 100) / 100;
    const isInterstate = supplierGstin.slice(0, 2) !== buyerGstin.slice(0, 2);
    const gstTotal = Math.round((totalInvoiceValue - taxableValue) * 100) / 100;

    return {
      status,
      title,
      summary,
      irn: defaultIrn,
      ackNo: `112610${Math.floor(100000000 + Math.random() * 900000000)}`,
      ackDate: "2026-02-15T10:14:22Z",
      supplierGstin,
      supplierName: "TECHFLOW ENTERPRISES PRIVATE LIMITED",
      buyerGstin,
      buyerName: "RDC GLOBAL SERVICES INDIA PRIVATE LIMITED",
      docNumber,
      docType,
      docDate,
      totalInvoiceValue,
      taxableValue,
      cgstValue: isInterstate ? 0 : Math.round((gstTotal / 2) * 100) / 100,
      sgstValue: isInterstate ? 0 : Math.round((gstTotal / 2) * 100) / 100,
      igstValue: isInterstate ? gstTotal : 0,
      signedQrVerified: status === "VALID",
      signedInvoiceVerified: status === "VALID",
      irpSource: "NIC Invoice Registration Portal (IRP 1)",
      cancelDate,
      cancelReason,
      provider: "mock-einvoice-irp",
      providerReference: reference,
      checkedAt,
    };
  }
}
