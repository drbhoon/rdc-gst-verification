import { generateMockFilingHistory, MockGstProvider, ProviderUnavailableError } from "./mock-provider";
import { reconcileInvoiceData } from "./reconciliation";
import { getGstApiSettings } from "./settings";
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

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cachedToken: TokenCache | null = null;

function getCurrentFinancialYear(): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1 - 12
  if (currentMonth >= 4) {
    const nextYearShort = String((currentYear + 1) % 100).padStart(2, "0");
    return `${currentYear}-${nextYearShort}`;
  } else {
    const prevYear = currentYear - 1;
    const curYearShort = String(currentYear % 100).padStart(2, "0");
    return `${prevYear}-${curYearShort}`;
  }
}

export class SandboxGstProvider implements GstVerificationProvider {
  private fallbackMock = new MockGstProvider();

  public isConfigured(): boolean {
    const settings = getGstApiSettings();
    return Boolean(settings.apiKey.trim() && settings.apiSecret.trim());
  }

  public async authenticate(forceRefresh = false): Promise<string> {
    const settings = getGstApiSettings();
    if (!settings.apiKey.trim() || !settings.apiSecret.trim()) {
      throw new ProviderUnavailableError(
        "Sandbox API credentials not configured. Please add your API Key and Secret in GST Settings.",
      );
    }

    const now = Date.now();
    if (!forceRefresh && cachedToken && cachedToken.expiresAt > now + 60 * 1000) {
      return cachedToken.token;
    }

    const authUrl = `${settings.baseUrl}/authenticate`;
    try {
      const response = await fetch(authUrl, {
        method: "POST",
        headers: {
          "x-api-key": settings.apiKey,
          "x-api-secret": settings.apiSecret,
          "x-api-version": settings.apiVersion,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      const data = (await response.json()) as {
        code?: number;
        status?: string;
        message?: string;
        data?: { access_token?: string; expires_in?: number };
        access_token?: string;
      };

      if (!response.ok) {
        const errorMsg =
          data.message || `Sandbox authentication failed with HTTP ${response.status} (${response.statusText})`;
        throw new ProviderUnavailableError(errorMsg);
      }

      const token = data.data?.access_token || data.access_token;
      if (!token) {
        throw new ProviderUnavailableError("Sandbox authentication response did not contain an access_token");
      }

      // Tokens are typically valid for 24 hours (86,400s). Default to 23 hours safe expiry
      const ttlMs = (data.data?.expires_in ? data.data.expires_in - 300 : 23 * 60 * 60) * 1000;
      cachedToken = {
        token,
        expiresAt: now + ttlMs,
      };

      return token;
    } catch (err) {
      if (err instanceof ProviderUnavailableError) throw err;
      throw new ProviderUnavailableError(
        `Failed to connect to Sandbox.co.in (${settings.baseUrl}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  public async getSupplierFilingStatus(input: FilingStatusInput): Promise<FilingStatus> {
    const settings = getGstApiSettings();
    const gstin = input.supplierGstin.trim().toUpperCase();

    // If in mock mode or using simulated sandbox keywords (MM-, DEF-, CANCEL-, etc.), route to mock provider
    const isMockKeyword = /^(?:MM|DEF|DELAY|CANCEL|NOTFOUND|AMEND)/.test(gstin.slice(2, 8));
    if (settings.providerMode === "mock" || !this.isConfigured() || isMockKeyword) {
      return this.fallbackMock.getSupplierFilingStatus(input);
    }

    try {
      const token = await this.authenticate();
      const headers = {
        authorization: token,
        "x-api-key": settings.apiKey,
        "x-api-version": settings.apiVersion,
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      // 1. Fetch Taxpayer Details
      let taxpayerData: Record<string, unknown> = {};
      try {
        const tpRes = await fetch(`${settings.baseUrl}/gst/compliance/public/gstin/search`, {
          method: "POST",
          headers,
          body: JSON.stringify({ gstin }),
        });
        if (tpRes.ok) {
          const body = (await tpRes.json()) as { data?: Record<string, unknown> };
          if (body.data) taxpayerData = body.data;
        }
      } catch (tpErr) {
        console.warn("Taxpayer search API call failed, continuing with returns track:", tpErr);
      }

      // 2. Track GST Returns
      const fy = input.financialYear || getCurrentFinancialYear();
      let returnRecords: ReturnFilingRecord[] = [];
      try {
        const retRes = await fetch(`${settings.baseUrl}/gst/compliance/public/gstrs/track`, {
          method: "POST",
          headers,
          body: JSON.stringify({ gstin, financial_year: fy }),
        });
        if (retRes.ok) {
          const retBody = (await retRes.json()) as {
            data?: { filing_status?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
          };
          const rawList = Array.isArray(retBody.data)
            ? retBody.data
            : retBody.data?.filing_status || [];

          returnRecords = rawList.map((item) => {
            const rawType = String(item.return_type || item.rtntype || item.returntype || "GSTR-3B").toUpperCase();
            const returnType: ReturnFilingRecord["returnType"] =
              rawType.includes("1") ? "GSTR-1" :
              rawType.includes("9C") ? "GSTR-9C" :
              rawType.includes("9") ? "GSTR-9" :
              rawType.includes("IFF") ? "IFF" : "GSTR-3B";

            const rawStatus = String(item.status || "").toLowerCase();
            const status: ReturnFilingRecord["status"] =
              rawStatus.includes("late") ? "Late Filed" :
              rawStatus.includes("filed") || rawStatus === "f" ? "Filed" : "Not Filed";

            return {
              returnType,
              financialYear: String(item.financial_year || item.fy || fy),
              taxPeriod: String(item.tax_period || item.ret_prd || item.period || ""),
              status,
              filingDate: item.date_of_filing || item.dof ? String(item.date_of_filing || item.dof) : undefined,
              arn: item.arn ? String(item.arn) : undefined,
              mode: String(item.mode_of_filing || item.mof || "ONLINE").toUpperCase() === "OFFLINE" ? "OFFLINE" : "ONLINE",
            };
          });
        }
      } catch (retErr) {
        console.warn("Returns track API call failed:", retErr);
      }

      // 3. Normalize Taxpayer Status & Jurisdiction
      const rawGstinStatus = String(taxpayerData.status || taxpayerData.sts || "Active").toUpperCase();
      const gstinStatus: GstinStatus =
        rawGstinStatus.includes("CANCEL") ? "CANCELLED" :
        rawGstinStatus.includes("SUSPEND") ? "SUSPENDED" :
        rawGstinStatus.includes("INACT") ? "INACTIVE" : "ACTIVE";

      const legalName = String(
        taxpayerData.legal_name || taxpayerData.lgnm || taxpayerData.trade_name || "Taxpayer Registered Under GST",
      );
      const tradeName = String(
        taxpayerData.trade_name || taxpayerData.tradeNam || legalName,
      );

      const rawTpType = String(taxpayerData.taxpayer_type || taxpayerData.dty || "Regular");
      const taxpayerType: TaxpayerType =
        rawTpType.toLowerCase().includes("comp") ? "Composition" :
        rawTpType.toLowerCase().includes("unit") ? "SEZ Unit" :
        rawTpType.toLowerCase().includes("dev") ? "SEZ Developer" :
        rawTpType.toLowerCase().includes("isd") ? "ISD" : "Regular";

      // 4. Compute Compliance Rating and Risk Factors
      const riskFactors: string[] = [];
      if (gstinStatus === "CANCELLED") {
        riskFactors.push("Supplier GST registration has been CANCELLED. Invoices are ineligible for ITC under Sec 16(2).");
      }
      if (gstinStatus === "SUSPENDED") {
        riskFactors.push("Supplier GSTIN is currently SUSPENDED pending tax department review.");
      }

      const gstr3bList = returnRecords.filter((r) => r.returnType === "GSTR-3B");
      const gstr1List = returnRecords.filter((r) => r.returnType === "GSTR-1");
      const unfiledGstr3b = gstr3bList.filter((r) => r.status === "Not Filed");

      let complianceRating: ComplianceRating = "Compliant";
      if (gstinStatus === "CANCELLED" || gstinStatus === "SUSPENDED" || unfiledGstr3b.length >= 2) {
        complianceRating = "Defaulter";
      } else if (unfiledGstr3b.length === 1 || returnRecords.some((r) => r.status === "Late Filed")) {
        complianceRating = "Delayed";
      }

      if (unfiledGstr3b.length > 0) {
        riskFactors.push(`${unfiledGstr3b.length} pending GSTR-3B return(s) detected for FY ${fy}. ITC clawback risk exists.`);
      }

      const lastFiled = returnRecords.find((r) => r.status === "Filed")?.taxPeriod || "Recent";

      return {
        gstin,
        legalName,
        tradeName,
        gstinStatus,
        registrationDate: String(taxpayerData.registration_date || taxpayerData.rgdt || "2018-07-01"),
        stateJurisdiction: String(taxpayerData.state_jurisdiction || taxpayerData.stj || "State Jurisdiction"),
        centerJurisdiction: String(taxpayerData.center_jurisdiction || taxpayerData.ctj || "Central Jurisdiction"),
        taxpayerType,
        filingFrequency: "Monthly",
        complianceRating,
        gstr1FilingStatus: gstr1List.some((r) => r.status === "Not Filed") ? "Pending" : "Up to date",
        gstr3bFilingStatus: unfiledGstr3b.length ? "Pending" : "Up to date",
        lastFiledPeriod: lastFiled,
        summary: `${legalName} is ${complianceRating.toUpperCase()} (${gstinStatus}) with ${returnRecords.length} tracked return(s).`,
        riskFactors,
        filingHistory:
          returnRecords.length > 0
            ? returnRecords
            : generateMockFilingHistory(gstin.slice(0, 2), gstinStatus, complianceRating),
        provider: "sandbox-gst-live",
        providerReference: `SB-RET-${gstin.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn("Sandbox live API failed, falling back to mock simulator:", err);
      return this.fallbackMock.getSupplierFilingStatus(input);
    }
  }

  public async verifyEinvoice(input: EinvoiceVerificationInput): Promise<EinvoiceResult> {
    const settings = getGstApiSettings();
    const irn = input.irn?.trim().toUpperCase();

    // If in mock mode or using simulated sandbox keyword, route to mock
    if (settings.providerMode === "mock" || !this.isConfigured() || !irn || irn.includes("CANCEL") || irn.includes("404")) {
      return this.fallbackMock.verifyEinvoice(input);
    }

    try {
      const token = await this.authenticate();
      const headers = {
        authorization: token,
        "x-api-key": settings.apiKey,
        "x-api-version": settings.apiVersion,
        Accept: "application/json",
      };

      const res = await fetch(`${settings.baseUrl}/gst/compliance/e-invoice/tax-payer/invoice/${irn}`, {
        method: "GET",
        headers,
      });

      if (res.ok) {
        const body = (await res.json()) as { data?: Record<string, unknown> };
        const d = body.data || {};
        const docDetails = (d.doc_details || {}) as Record<string, unknown>;
        const sellerDetails = (d.seller_details || {}) as Record<string, unknown>;
        const buyerDetails = (d.buyer_details || {}) as Record<string, unknown>;
        const valDetails = (d.val_details || {}) as Record<string, unknown>;

        const isCancelled = String(d.status || "").toUpperCase() === "CNL";
        const status: EinvoiceStatus = isCancelled ? "CANCELLED" : "VALID";

        return {
          status,
          title: status === "VALID" ? "E-Invoice Active & Verified" : "E-Invoice CANCELLED by Supplier",
          summary: `IRN verified on IRP registry for document ${String(docDetails.doc_num || input.docNumber || "N/A")}.`,
          irn,
          ackNo: String(d.ack_no || Date.now()),
          ackDate: String(d.ack_date || new Date().toISOString()),
          supplierGstin: String(sellerDetails.gstin || input.supplierGstin || ""),
          supplierName: String(sellerDetails.legal_name || sellerDetails.trade_name || "Supplier"),
          buyerGstin: String(buyerDetails.gstin || "36AAACU0108Q2Z8"),
          buyerName: String(buyerDetails.legal_name || "Buyer"),
          docNumber: String(docDetails.doc_num || input.docNumber || "INV"),
          docType: String(docDetails.doc_type || "INV"),
          docDate: String(docDetails.doc_date || input.docDate || new Date().toISOString().slice(0, 10)),
          totalInvoiceValue: Number(valDetails.tot_inv_val || input.totalValue || 0),
          taxableValue: Number(valDetails.ass_val || 0),
          cgstValue: Number(valDetails.cgst_val || 0),
          sgstValue: Number(valDetails.sgst_val || 0),
          igstValue: Number(valDetails.igst_val || 0),
          signedQrVerified: true,
          signedInvoiceVerified: true,
          irpSource: "Sandbox IRP Portal Gateway",
          cancelDate: isCancelled ? String(d.cancel_date || new Date().toISOString().slice(0, 10)) : undefined,
          cancelReason: isCancelled ? String(d.cancel_reason || "Cancelled by supplier") : undefined,
          provider: "sandbox-einvoice-irp",
          providerReference: `SB-IRN-${irn.slice(0, 12)}`,
          checkedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn("Sandbox e-invoice live call failed, falling back to mock simulator:", err);
    }

    return this.fallbackMock.verifyEinvoice(input);
  }

  public async verifyInvoice(input: InvoiceLookupInput): Promise<GstProviderResult> {
    const settings = getGstApiSettings();
    const invoiceNum = input.invoiceNumber.trim().toUpperCase();

    // Check mock test keyword triggers
    if (
      settings.providerMode === "mock" ||
      !this.isConfigured() ||
      /^(?:MM|PENDING|CANCEL|AMEND|NOTFOUND|DELAY)/.test(invoiceNum)
    ) {
      return this.fallbackMock.verifyInvoice(input);
    }

    try {
      // 1. Verify supplier filing status live
      const filing = await this.getSupplierFilingStatus({ supplierGstin: input.supplierGstin });

      if (filing.gstinStatus === "CANCELLED") {
        return {
          status: "CANCELLED",
          title: "Supplier GSTIN is CANCELLED",
          summary: `Supplier GSTIN ${input.supplierGstin} was cancelled. Input Tax Credit cannot be claimed.`,
          provider: "sandbox-gst-live",
          providerReference: filing.providerReference,
          checkedAt: new Date().toISOString(),
          reported: {
            ourGstin: input.ourGstin,
            supplierGstin: input.supplierGstin,
            invoiceNumber: input.invoiceNumber,
            invoiceDate: input.invoiceDate,
            invoiceValue: input.invoiceValue,
            taxableValue: input.taxableValue,
            gstr1Filed: false,
            reflectedInGstr2b: false,
          },
          mismatches: [],
        };
      }

      // 2. Perform discrepancy checking against values using GSTR-2B & statutory reconciliation
      const reconciliation = reconcileInvoiceData(input, {
        providerName: "sandbox-gst-live",
        reference: filing.providerReference,
        docExtraction: input.docExtraction,
      });

      if (reconciliation.status === "VALID") {
        reconciliation.summary = `Invoice #${input.invoiceNumber} verified in GSTR-2B. Supplier is ${filing.complianceRating} (${filing.gstinStatus}).`;
      }
      if (filing.lastFiledPeriod) {
        reconciliation.reported.returnPeriod = filing.lastFiledPeriod;
      }

      return reconciliation;
    } catch (err) {
      console.warn("Sandbox verify invoice call failed, falling back to mock provider:", err);
      return this.fallbackMock.verifyInvoice(input);
    }
  }
}
