export const verificationStatuses = [
  "VALID",
  "NOT_FOUND",
  "RETURN_NOT_FILED",
  "MISMATCH",
  "CANCELLED",
  "AMENDED",
] as const;

export type VerificationStatus = (typeof verificationStatuses)[number];

export type InvoiceLookupInput = {
  ourGstin: string;
  supplierGstin: string;
  invoiceNumber: string;
  invoiceDate?: string;
  invoiceValue?: number;
  taxableValue?: number;
  source?: "manual" | "upload";
  documentId?: string;
  docExtraction?: {
    invoiceNumber?: string;
    invoiceDate?: string;
    taxableValue?: number;
    invoiceValue?: number;
    supplierGstin?: string;
    ourGstin?: string;
  };
};

export type VerificationInput = InvoiceLookupInput;

export type InvoiceMismatch = {
  field: "invoiceNumber" | "invoiceDate" | "invoiceValue" | "taxableValue" | "ourGstin" | "supplierGstin";
  label: string;
  submitted: string;
  reported: string;
};

export type GstProviderResult = {
  status: VerificationStatus;
  title: string;
  summary: string;
  provider: string;
  providerReference: string;
  checkedAt: string;
  reported: {
    ourGstin?: string;
    supplierGstin?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    invoiceValue?: number;
    taxableValue?: number;
    returnPeriod?: string;
    gstr1Filed?: boolean;
    reflectedInGstr2b?: boolean;
    amendedInvoiceNumber?: string;
    irn?: string;
  };
  mismatches: InvoiceMismatch[];
};

export type GstVerificationResult = GstProviderResult;

// Supplier Filing Status Types
export const gstinStatuses = ["ACTIVE", "CANCELLED", "SUSPENDED", "INACTIVE"] as const;
export type GstinStatus = (typeof gstinStatuses)[number];

export const complianceRatings = ["Compliant", "Delayed", "Defaulter"] as const;
export type ComplianceRating = (typeof complianceRatings)[number];

export const taxpayerTypes = ["Regular", "Composition", "SEZ Unit", "SEZ Developer", "ISD"] as const;
export type TaxpayerType = (typeof taxpayerTypes)[number];

export type ReturnFilingRecord = {
  returnType: "GSTR-1" | "GSTR-3B" | "GSTR-9" | "GSTR-9C" | "IFF";
  financialYear: string;
  taxPeriod: string;
  status: "Filed" | "Not Filed" | "Late Filed";
  filingDate?: string;
  arn?: string;
  mode?: "ONLINE" | "OFFLINE";
};

export type FilingStatusInput = {
  supplierGstin: string;
  financialYear?: string;
  returnPeriod?: string;
};

export type FilingStatus = {
  gstin: string;
  legalName: string;
  tradeName: string;
  gstinStatus: GstinStatus;
  registrationDate: string;
  stateJurisdiction: string;
  centerJurisdiction: string;
  taxpayerType: TaxpayerType;
  filingFrequency: "Monthly" | "Quarterly (QRMP)";
  complianceRating: ComplianceRating;
  gstr1FilingStatus: "Up to date" | "Pending" | "Delayed";
  gstr3bFilingStatus: "Up to date" | "Pending" | "Delayed";
  lastFiledPeriod: string;
  summary: string;
  riskFactors: string[];
  filingHistory: ReturnFilingRecord[];
  provider: string;
  providerReference: string;
  checkedAt: string;
};

// E-Invoice Verification Types
export const einvoiceStatuses = ["VALID", "CANCELLED", "NOT_FOUND", "MISMATCH", "INVALID_SIGNATURE"] as const;
export type EinvoiceStatus = (typeof einvoiceStatuses)[number];

export type EinvoiceVerificationInput = {
  irn?: string;
  qrCode?: string;
  supplierGstin?: string;
  docNumber?: string;
  docType?: "INV" | "CRN" | "DBN";
  docDate?: string;
  totalValue?: number;
};

export type EinvoiceResult = {
  status: EinvoiceStatus;
  title: string;
  summary: string;
  irn: string;
  ackNo: string;
  ackDate: string;
  supplierGstin: string;
  supplierName?: string;
  buyerGstin: string;
  buyerName?: string;
  docNumber: string;
  docType: string;
  docDate: string;
  totalInvoiceValue: number;
  taxableValue: number;
  cgstValue?: number;
  sgstValue?: number;
  igstValue?: number;
  signedQrVerified: boolean;
  signedInvoiceVerified: boolean;
  irpSource: string;
  cancelDate?: string;
  cancelReason?: string;
  provider: string;
  providerReference: string;
  checkedAt: string;
};

export interface GstVerificationProvider {
  verifyInvoice(input: InvoiceLookupInput): Promise<GstProviderResult>;
  getSupplierFilingStatus(input: FilingStatusInput): Promise<FilingStatus>;
  verifyEinvoice?(input: EinvoiceVerificationInput): Promise<EinvoiceResult>;
}
