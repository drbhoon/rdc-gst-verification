"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileSearch,
  FileText,
  FileUp,
  History,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  QrCode,
  Radio,
  ReceiptIndianRupee,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { CompanyGstinDialog } from "@/components/company-gstin-dialog";
import { GstSettingsDialog } from "@/components/gst-settings-dialog";
import { COMPANY_MASTER, INDIAN_STATES } from "@/lib/company-registry";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import type { EinvoiceResult, FilingStatus } from "@/lib/gst/types";

export type View = "overview" | "verify" | "supplier" | "einvoice" | "history";
export type Mode = "manual" | "upload";
export type InvoiceStatus = "VALID" | "NOT_FOUND" | "RETURN_NOT_FILED" | "MISMATCH" | "CANCELLED" | "AMENDED";

type Fields = {
  ourGstin: string;
  supplierGstin: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: string;
  taxableValue: string;
};

type Mismatch = { field: string; label: string; submitted: string; reported: string };

export type Verification = {
  id: string;
  status: InvoiceStatus;
  title: string;
  summary: string;
  provider: string;
  providerReference: string;
  checkedAt?: string;
  createdAt?: string;
  ourGstin: string;
  supplierGstin: string;
  invoiceNumber: string;
  invoiceDate?: string;
  invoiceValue?: number;
  taxableValue?: number;
  source?: string;
  reported: Record<string, string | number | boolean | undefined>;
  mismatches: Mismatch[];
};

type SupplierCheckRecord = {
  id: string;
  supplierGstin: string;
  legalName: string;
  tradeName: string;
  gstinStatus: string;
  complianceRating: string;
  taxpayerType: string;
  filingFrequency: string;
  lastFiledPeriod: string;
  summary: string;
  provider: string;
  providerReference: string;
  createdAt: string;
  filingStatus?: FilingStatus;
};

type EinvoiceRecord = {
  id: string;
  irn: string;
  ackNo?: string;
  ackDate?: string;
  supplierGstin: string;
  buyerGstin: string;
  docNumber: string;
  docType: string;
  docDate?: string;
  totalInvoiceValuePaise?: number;
  taxableValuePaise?: number;
  status: string;
  title: string;
  summary: string;
  signedQrVerified: number;
  provider: string;
  providerReference: string;
  createdAt: string;
  einvoice?: EinvoiceResult;
};

type OcrResponse = {
  documentId: string;
  fileName: string;
  provider: string;
  warning?: string;
  extraction: Record<keyof Fields, { value: string | number; confidence: number }> & {
    companyResolution?: {
      companyName: string;
      companyId: string;
      stateCode: string;
      stateName: string;
      detectionType: string;
      matchedLocation: string;
      explanation: string;
      alternativeOptions?: Array<{
        label: string;
        gstin: string;
        stateName: string;
        stateCode: string;
      }>;
    };
  };
};

const blankFields: Fields = {
  ourGstin: "06AAACU0108Q1ZC",
  supplierGstin: "",
  invoiceNumber: "",
  invoiceDate: "",
  invoiceValue: "",
  taxableValue: "",
};

const invoiceStatuses: Record<InvoiceStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  VALID: { label: "Valid", className: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2 },
  NOT_FOUND: { label: "Not found", className: "border-red-200 bg-red-50 text-red-800", icon: CircleHelp },
  RETURN_NOT_FILED: { label: "Return not filed", className: "border-orange-200 bg-orange-50 text-orange-800", icon: Clock3 },
  MISMATCH: { label: "Mismatch", className: "border-amber-200 bg-amber-50 text-amber-800", icon: AlertTriangle },
  CANCELLED: { label: "Cancelled", className: "border-rose-200 bg-rose-50 text-rose-800", icon: Ban },
  AMENDED: { label: "Amended", className: "border-blue-200 bg-blue-50 text-blue-800", icon: RefreshCw },
};

function formatMoney(value?: number) {
  return value === undefined
    ? "Not supplied"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value.endsWith("Z") || value.includes("+") ? value : `${value}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function getCompanyGstinInfo(gstin: string) {
  if (!gstin || gstin.length < 15) return null;
  const clean = gstin.trim().toUpperCase();
  for (const company of COMPANY_MASTER) {
    if (clean.includes(company.pan)) {
      const stateCode = clean.slice(0, 2);
      const stateRecord = company.stateGstins[stateCode];
      return {
        companyName: company.name,
        shortName: company.shortName,
        stateName: stateRecord?.stateName || (INDIAN_STATES[stateCode] ?? "State " + stateCode),
        tradeName: stateRecord?.tradeName,
      };
    }
  }
  return null;
}

export function VerificationWorkspace({
  user,
  signOutPath,
}: {
  user: {
    displayName: string;
    email: string;
    role: "Admin" | "Checker";
    availableAdmins?: string[];
  };
  signOutPath: string;
}) {
  const [activeAdminEmail, setActiveAdminEmail] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("rdc_active_admin_email");
      if (stored && (user.availableAdmins?.includes(stored) || stored === user.email)) {
        return stored;
      }
    }
    return user.email;
  });

  const activeDisplayName = useMemo(() => {
    if (activeAdminEmail === user.email) return user.displayName;
    const namePart = activeAdminEmail.split("@")[0];
    return (
      namePart
        .split(/[._-]/)
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ") || activeAdminEmail
    );
  }, [activeAdminEmail, user.email, user.displayName]);

  const handleSwitchAdmin = (newEmail: string) => {
    setActiveAdminEmail(newEmail);
    if (typeof window !== "undefined") {
      localStorage.setItem("rdc_active_admin_email", newEmail);
    }
    toast.success(`Active user switched to ${newEmail}`);
  };

  const [view, setView] = useState<View>("overview");

  // Invoice Verification State
  const [mode, setMode] = useState<Mode>("manual");
  const [fields, setFields] = useState<Fields>(blankFields);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Verification | null>(null);
  const [documentId, setDocumentId] = useState<string>();
  const [upload, setUpload] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extraction, setExtraction] = useState<OcrResponse | null>(null);

  // Supplier Filing Status State
  const [supplierGstin, setSupplierGstin] = useState("27ABCDE1234F1Z0");
  const [supplierYear, setSupplierYear] = useState("2025-26");
  const [supplierChecking, setSupplierChecking] = useState(false);
  const [supplierResult, setSupplierResult] = useState<FilingStatus | null>(null);
  const [supplierErrors, setSupplierErrors] = useState<Record<string, string>>({});

  // E-Invoice State
  const [einvoiceMode, setEinvoiceMode] = useState<"irn" | "details">("irn");
  const [einvoiceIrn, setEinvoiceIrn] = useState("");
  const [einvoiceSupplierGstin, setEinvoiceSupplierGstin] = useState("27ABCDE1234F1Z0");
  const [einvoiceDocNumber, setEinvoiceDocNumber] = useState("INV-2026-1089");
  const [einvoiceDocDate, setEinvoiceDocDate] = useState("2026-02-15");
  const [einvoiceTotalValue, setEinvoiceTotalValue] = useState("118000");
  const [einvoiceChecking, setEinvoiceChecking] = useState(false);
  const [einvoiceResult, setEinvoiceResult] = useState<EinvoiceResult | null>(null);
  const [einvoiceErrors, setEinvoiceErrors] = useState<Record<string, string>>({});

  // History State
  const [historyTab, setHistoryTab] = useState<"invoices" | "suppliers" | "einvoices">("invoices");
  const [history, setHistory] = useState<Verification[]>([]);
  const [supplierHistory, setSupplierHistory] = useState<SupplierCheckRecord[]>([]);
  const [einvoiceHistory, setEinvoiceHistory] = useState<EinvoiceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterSearch, setFilterSearch] = useState("");

  // Inspect Drawer
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierCheckRecord | null>(null);
  const [selectedEinvoice, setSelectedEinvoice] = useState<EinvoiceRecord | null>(null);

  // GST API Settings State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiConfigStatus, setApiConfigStatus] = useState<{ isConfigured: boolean; providerMode: "sandbox" | "mock" }>({
    isConfigured: false,
    providerMode: "sandbox",
  });

  const refreshApiStatus = useCallback(() => {
    fetch("/api/gst-settings")
      .then(async (res) => (await res.json()) as { isConfigured?: boolean; providerMode?: "sandbox" | "mock" })
      .then((data) => {
        setApiConfigStatus({
          isConfigured: Boolean(data.isConfigured),
          providerMode: data.providerMode || "sandbox",
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshApiStatus();
  }, [refreshApiStatus]);

  // Load Invoice History
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      if (filterSearch.trim()) params.set("search", filterSearch.trim());
      const response = await fetch(`/api/verifications?${params.toString()}`);
      const body = (await response.json()) as { verifications?: Verification[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load invoice history");
      setHistory(body.verifications ?? []);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Could not load invoice history");
    } finally {
      setHistoryLoading(false);
    }
  }, [filterSearch, filterStatus]);

  // Load Supplier History
  const loadSupplierHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterSearch.trim()) params.set("search", filterSearch.trim());
      const response = await fetch(`/api/supplier-filing?${params.toString()}`);
      const body = (await response.json()) as { checks?: SupplierCheckRecord[]; error?: string };
      if (response.ok && body.checks) {
        setSupplierHistory(body.checks);
      }
    } catch {
      // ignore
    }
  }, [filterSearch]);

  // Load E-Invoice History
  const loadEinvoiceHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterSearch.trim()) params.set("search", filterSearch.trim());
      const response = await fetch(`/api/einvoice?${params.toString()}`);
      const body = (await response.json()) as { einvoices?: EinvoiceRecord[]; error?: string };
      if (response.ok && body.einvoices) {
        setEinvoiceHistory(body.einvoices);
      }
    } catch {
      // ignore
    }
  }, [filterSearch]);

  const reloadAllHistory = useCallback(async () => {
    await Promise.all([loadHistory(), loadSupplierHistory(), loadEinvoiceHistory()]);
  }, [loadHistory, loadSupplierHistory, loadEinvoiceHistory]);

  useEffect(() => {
    let active = true;
    const fetchHistory = async () => {
      try {
        const [invRes, supRes, einvRes] = await Promise.allSettled([
          fetch("/api/verifications"),
          fetch("/api/supplier-filing"),
          fetch("/api/einvoice"),
        ]);
        if (!active) return;
        if (invRes.status === "fulfilled" && invRes.value.ok) {
          const body = (await invRes.value.json()) as { verifications?: Verification[] };
          if (body.verifications) setHistory(body.verifications);
        }
        if (supRes.status === "fulfilled" && supRes.value.ok) {
          const body = (await supRes.value.json()) as { checks?: SupplierCheckRecord[] };
          if (body.checks) setSupplierHistory(body.checks);
        }
        if (einvRes.status === "fulfilled" && einvRes.value.ok) {
          const body = (await einvRes.value.json()) as { einvoices?: EinvoiceRecord[] };
          if (body.einvoices) setEinvoiceHistory(body.einvoices);
        }
      } catch {
        // ignore on unmount
      }
    };
    void fetchHistory();
    return () => {
      active = false;
    };
  }, []);

  // Run Invoice Verification
  const runVerification = useCallback(
    async (input: Fields, source: Mode = "manual", linkedDocumentId?: string) => {
      setChecking(true);
      setFieldErrors({});
      setResult(null);
      try {
        const response = await fetch("/api/verifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...input,
            invoiceValue: input.invoiceValue,
            taxableValue: input.taxableValue,
            source,
            documentId: linkedDocumentId,
          }),
        });
        const body = (await response.json()) as {
          verification?: Verification;
          error?: string;
          fieldErrors?: Record<string, string>;
        };
        if (!response.ok) {
          if (body.fieldErrors) setFieldErrors(body.fieldErrors);
          throw new Error(body.error || "Verification could not be completed");
        }
        if (!body.verification) throw new Error("The provider returned an incomplete response");
        setResult(body.verification);
        toast.success("Verification completed", {
          description: invoiceStatuses[body.verification.status].label,
        });
        await loadHistory();
        return body.verification;
      } catch (error) {
        toast.error("Verification not completed", {
          description: error instanceof Error ? error.message : "Please try again",
        });
        return null;
      } finally {
        setChecking(false);
      }
    },
    [loadHistory],
  );

  // Run Supplier Filing Check
  const runSupplierCheck = useCallback(
    async (gstin: string, year = "2025-26") => {
      setSupplierChecking(true);
      setSupplierErrors({});
      setSupplierResult(null);
      try {
        const response = await fetch("/api/supplier-filing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplierGstin: gstin.trim().toUpperCase(), financialYear: year }),
        });
        const body = (await response.json()) as {
          check?: FilingStatus;
          error?: string;
          fieldErrors?: Record<string, string>;
        };
        if (!response.ok) {
          if (body.fieldErrors) setSupplierErrors(body.fieldErrors);
          throw new Error(body.error || "Could not check supplier filing status");
        }
        if (!body.check) throw new Error("Invalid provider response");
        setSupplierResult(body.check);
        toast.success("Supplier filing status retrieved", {
          description: `${body.check.legalName} (${body.check.complianceRating})`,
        });
        await loadSupplierHistory();
        return body.check;
      } catch (error) {
        toast.error("Filing check failed", {
          description: error instanceof Error ? error.message : "Please try again",
        });
        return null;
      } finally {
        setSupplierChecking(false);
      }
    },
    [loadSupplierHistory],
  );

  // Run E-Invoice Verification
  const runEinvoiceVerification = useCallback(
    async (payload: {
      irn?: string;
      supplierGstin?: string;
      docNumber?: string;
      docDate?: string;
      totalValue?: number;
    }) => {
      setEinvoiceChecking(true);
      setEinvoiceErrors({});
      setEinvoiceResult(null);
      try {
        const response = await fetch("/api/einvoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await response.json()) as {
          einvoice?: EinvoiceResult;
          error?: string;
          fieldErrors?: Record<string, string>;
        };
        if (!response.ok) {
          if (body.fieldErrors) setEinvoiceErrors(body.fieldErrors);
          throw new Error(body.error || "Could not verify e-invoice");
        }
        if (!body.einvoice) throw new Error("Invalid response from e-invoice provider");
        setEinvoiceResult(body.einvoice);
        toast.success("E-Invoice verification complete", {
          description: `${body.einvoice.status}: ${body.einvoice.title}`,
        });
        await loadEinvoiceHistory();
        return body.einvoice;
      } catch (error) {
        toast.error("E-Invoice check failed", {
          description: error instanceof Error ? error.message : "Please try again",
        });
        return null;
      } finally {
        setEinvoiceChecking(false);
      }
    },
    [loadEinvoiceHistory],
  );

  useWebMcp(runVerification, runSupplierCheck, runEinvoiceVerification, setView);

  async function submitVerification(event: React.FormEvent<HTMLFormElement>, source: Mode) {
    event.preventDefault();
    await runVerification(fields, source, source === "upload" ? documentId : undefined);
  }

  async function submitSupplierCheck(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSupplierCheck(supplierGstin, supplierYear);
  }

  async function submitEinvoiceCheck(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (einvoiceMode === "irn") {
      await runEinvoiceVerification({ irn: einvoiceIrn.trim() });
    } else {
      await runEinvoiceVerification({
        supplierGstin: einvoiceSupplierGstin.trim().toUpperCase(),
        docNumber: einvoiceDocNumber.trim().toUpperCase(),
        docDate: einvoiceDocDate,
        totalValue: einvoiceTotalValue ? Number(einvoiceTotalValue) : undefined,
      });
    }
  }

  async function extractInvoice() {
    if (!upload) {
      toast.error("Choose an invoice first");
      return;
    }
    setUploading(true);
    setExtraction(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const data = new FormData();
      data.set("invoice", upload);
      const response = await fetch("/api/ocr", {
        method: "POST",
        body: data,
        headers: {
          "x-user-email": activeAdminEmail,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        let errMessage = `Upload failed (Status ${response.status})`;
        try {
          const errJson = (await response.json()) as { error?: string };
          if (errJson.error) errMessage = errJson.error;
        } catch {
          const rawText = await response.text();
          if (rawText) errMessage = rawText;
        }
        throw new Error(errMessage);
      }
      const body = (await response.json()) as OcrResponse & { error?: string };
      const rawExt = body.extraction as Record<string, { value?: string | number }>;
      const extractedFields = Object.fromEntries(
        (Object.keys(blankFields) as Array<keyof Fields>).map((key) => [
          key,
          rawExt[key]?.value === undefined || rawExt[key]?.value === null ? "" : String(rawExt[key].value),
        ]),
      ) as Fields;
      setFields(extractedFields);
      setDocumentId(body.documentId);
      setExtraction(body);
      if (body.warning) {
        toast.warning("Manual review recommended", { description: body.warning });
      } else {
        toast.success("Invoice fields extracted", { description: "Review each field before verification." });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error?.name === "AbortError") {
        toast.error("Extraction timed out", {
          description: "Reading took longer than expected. Please enter the invoice details manually.",
        });
      } else {
        toast.error("Could not read invoice", {
          description: error instanceof Error ? error.message : "Please try again",
        });
      }
    } finally {
      clearTimeout(timeoutId);
      setUploading(false);
    }
  }

  const resetInvoiceUpload = useCallback(() => {
    setUpload(null);
    setExtraction(null);
    setResult(null);
    setFields(blankFields);
    setFieldErrors({});
    setDocumentId(undefined);
    setMode("upload");
    toast.info("Screen cleared", { description: "Ready to upload another invoice." });
  }, []);

  function changeField(key: keyof Fields, value: string) {
    setFields((current) => ({
      ...current,
      [key]: ["ourGstin", "supplierGstin", "invoiceNumber"].includes(key) ? value.toUpperCase() : value,
    }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  }

  function exportHistory() {
    if (historyTab === "invoices") {
      const rows = [
        ["Checked at", "Status", "Our GSTIN", "Supplier GSTIN", "Invoice number", "Invoice date", "Invoice value", "Taxable value", "Provider reference"],
        ...history.map((item) => [
          item.createdAt ?? item.checkedAt ?? "",
          invoiceStatuses[item.status]?.label ?? item.status,
          item.ourGstin,
          item.supplierGstin,
          item.invoiceNumber,
          item.invoiceDate ?? "",
          item.invoiceValue ?? "",
          item.taxableValue ?? "",
          item.providerReference,
        ]),
      ];
      downloadCsv(rows, `gst-invoices-${new Date().toISOString().slice(0, 10)}.csv`);
    } else if (historyTab === "suppliers") {
      const rows = [
        ["Checked at", "Supplier GSTIN", "Legal Name", "Status", "Compliance Rating", "Filing Frequency", "Last Period", "Reference"],
        ...supplierHistory.map((item) => [
          item.createdAt,
          item.supplierGstin,
          item.legalName,
          item.gstinStatus,
          item.complianceRating,
          item.filingFrequency,
          item.lastFiledPeriod,
          item.providerReference,
        ]),
      ];
      downloadCsv(rows, `gst-suppliers-${new Date().toISOString().slice(0, 10)}.csv`);
    } else {
      const rows = [
        ["Checked at", "Status", "IRN", "Supplier GSTIN", "Doc Number", "Doc Date", "Total Value", "Ack No", "Reference"],
        ...einvoiceHistory.map((item) => [
          item.createdAt,
          item.status,
          item.irn,
          item.supplierGstin,
          item.docNumber,
          item.docDate ?? "",
          item.totalInvoiceValuePaise ? item.totalInvoiceValuePaise / 100 : "",
          item.ackNo ?? "",
          item.providerReference,
        ]),
      ];
      downloadCsv(rows, `gst-einvoices-${new Date().toISOString().slice(0, 10)}.csv`);
    }
  }

  function downloadCsv(rows: (string | number)[][], filename: string) {
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const initials = useMemo(
    () =>
      activeDisplayName
        .split(/\s+|@/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase(),
    [activeDisplayName],
  );

  const metrics = useMemo(
    () => ({
      totalInvoices: history.length,
      validInvoices: history.filter((item) => item.status === "VALID").length,
      attentionInvoices: history.filter((item) => item.status !== "VALID").length,
      totalSuppliers: supplierHistory.length,
      compliantSuppliers: supplierHistory.filter((item) => item.complianceRating === "Compliant").length,
      defaulterSuppliers: supplierHistory.filter((item) => item.complianceRating === "Defaulter").length,
      totalEinvoices: einvoiceHistory.length,
      validEinvoices: einvoiceHistory.filter((item) => item.status === "VALID").length,
    }),
    [history, supplierHistory, einvoiceHistory],
  );

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <Toaster richColors position="top-right" />
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-[#163b70] text-white">
            <ReceiptIndianRupee className="size-4" />
          </span>{" "}
          GST Verify
        </div>
        <div className="flex gap-1">
          <MobileNavButton label="Overview" active={view === "overview"} onClick={() => setView("overview")} icon={<LayoutDashboard />} />
          <MobileNavButton label="Invoice" active={view === "verify"} onClick={() => setView("verify")} icon={<FileSearch />} />
          <MobileNavButton label="Supplier" active={view === "supplier"} onClick={() => setView("supplier")} icon={<Building2 />} />
          <MobileNavButton label="E-Invoice" active={view === "einvoice"} onClick={() => setView("einvoice")} icon={<QrCode />} />
          <MobileNavButton label="History" active={view === "history"} onClick={() => setView("history")} icon={<History />} />
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col bg-[#102a4f] text-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <span className="grid size-10 place-items-center rounded-xl bg-[#2f7df4] shadow-[0_8px_24px_rgba(47,125,244,.35)]">
            <ReceiptIndianRupee className="size-5" />
          </span>
          <div>
            <p className="text-base font-semibold leading-tight">GST Verify</p>
            <p className="mt-0.5 text-xs text-blue-200">Tax Compliance Hub</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-6" aria-label="Primary navigation">
          <NavItem icon={<LayoutDashboard />} label="Overview" active={view === "overview"} onClick={() => setView("overview")} />
          <NavItem icon={<FileSearch />} label="Verify invoice" active={view === "verify"} onClick={() => setView("verify")} />
          <NavItem
            icon={<Upload />}
            label="Upload & scan"
            active={view === "verify" && mode === "upload"}
            onClick={() => {
              setView("verify");
              setMode("upload");
              if (result || extraction) {
                resetInvoiceUpload();
              }
            }}
          />
          <NavItem icon={<Building2 />} label="Supplier filing status" active={view === "supplier"} onClick={() => setView("supplier")} />
          <NavItem icon={<QrCode />} label="E-Invoice (IRN)" active={view === "einvoice"} onClick={() => setView("einvoice")} />
          <NavItem icon={<History />} label="Audit history" active={view === "history"} count={String(history.length + supplierHistory.length + einvoiceHistory.length)} onClick={() => setView("history")} />

          <div className="pt-6">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-200/70">Configuration</p>
          </div>
          <NavItem icon={<Sliders className="size-4" />} label="GST API Settings" onClick={() => setSettingsOpen(true)} />
          <NavItem icon={<ShieldCheck />} label="ITC 16(2)(aa) Rules" disabled />
          <NavItem icon={<Users />} label="Team" disabled={user.role !== "Admin"} />
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex flex-col gap-2 rounded-xl bg-white/7 p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f4b942] text-sm font-bold text-[#102a4f]">
                {initials || "U"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{activeDisplayName}</p>
                <p className="truncate text-xs text-blue-200">{user.role}</p>
              </div>
              <a href={signOutPath} target="_top" aria-label="Sign out">
                <LogOut className="size-4 text-blue-200 hover:text-white" />
              </a>
            </div>
            {user.availableAdmins && user.availableAdmins.length > 1 && (
              <div className="pt-1.5 border-t border-white/10">
                <p className="text-[10px] font-medium uppercase tracking-wider text-blue-200/70 mb-1">Testing Admin Profile</p>
                <select
                  aria-label="Active Admin Account"
                  className="w-full rounded-md border border-white/20 bg-blue-950/90 px-2 py-1 text-xs text-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={activeAdminEmail}
                  onChange={(e) => handleSwitchAdmin(e.target.value)}
                >
                  {user.availableAdmins.map((email) => (
                    <option key={email} value={email} className="bg-slate-900 text-white">
                      {email} (Admin)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="lg:ml-[252px]">
        {/* Top Header Bar with Live Gateway Pill and API Settings */}
        <div className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/85 px-4 backdrop-blur-md sm:px-6 lg:px-10">
          <div className="flex items-center gap-2.5">
            <span className="hidden text-xs font-semibold uppercase tracking-wider text-slate-500 sm:inline-block">
              Provider Gateway:
            </span>
            {apiConfigStatus.providerMode === "sandbox" ? (
              apiConfigStatus.isConfigured ? (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100"
                >
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  Sandbox.co.in Live Connected
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
                >
                  <span className="size-2 rounded-full bg-amber-500" />
                  Sandbox API (Key Required)
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
              >
                <Radio className="size-3 text-purple-600" />
                Offline Mock Simulator
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Sliders className="size-3.5 text-blue-600" />
              GST API Settings
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-[1420px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          {view === "overview" && (
            <OverviewView
              metrics={metrics}
              history={history.slice(0, 4)}
              suppliers={supplierHistory.slice(0, 4)}
              einvoices={einvoiceHistory.slice(0, 4)}
              onVerify={() => setView("verify")}
              onSupplier={() => setView("supplier")}
              onEinvoice={() => setView("einvoice")}
              onHistory={() => setView("history")}
            />
          )}

          {view === "verify" && (
            <VerifyView
              mode={mode}
              setMode={setMode}
              fields={fields}
              changeField={changeField}
              fieldErrors={fieldErrors}
              checking={checking}
              result={result}
              submitVerification={submitVerification}
              upload={upload}
              setUpload={setUpload}
              uploading={uploading}
              extractInvoice={extractInvoice}
              extraction={extraction}
              resetInvoiceUpload={resetInvoiceUpload}
            />
          )}

          {view === "supplier" && (
            <SupplierView
              supplierGstin={supplierGstin}
              setSupplierGstin={setSupplierGstin}
              supplierYear={supplierYear}
              setSupplierYear={setSupplierYear}
              checking={supplierChecking}
              result={supplierResult}
              errors={supplierErrors}
              submitSupplierCheck={submitSupplierCheck}
            />
          )}

          {view === "einvoice" && (
            <EinvoiceView
              mode={einvoiceMode}
              setMode={setEinvoiceMode}
              irn={einvoiceIrn}
              setIrn={setEinvoiceIrn}
              supplierGstin={einvoiceSupplierGstin}
              setSupplierGstin={setEinvoiceSupplierGstin}
              docNumber={einvoiceDocNumber}
              setDocNumber={setEinvoiceDocNumber}
              docDate={einvoiceDocDate}
              setDocDate={setEinvoiceDocDate}
              totalValue={einvoiceTotalValue}
              setTotalValue={setEinvoiceTotalValue}
              checking={einvoiceChecking}
              result={einvoiceResult}
              errors={einvoiceErrors}
              submitEinvoiceCheck={submitEinvoiceCheck}
            />
          )}

          {view === "history" && (
            <HistoryView
              tab={historyTab}
              setTab={setHistoryTab}
              history={history}
              supplierHistory={supplierHistory}
              einvoiceHistory={einvoiceHistory}
              loading={historyLoading}
              error={historyError}
              status={filterStatus}
              setStatus={setFilterStatus}
              search={filterSearch}
              setSearch={setFilterSearch}
              reload={reloadAllHistory}
              exportHistory={exportHistory}
              selectVerification={setSelectedVerification}
              selectSupplier={setSelectedSupplier}
              selectEinvoice={setSelectedEinvoice}
            />
          )}

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <p>Verification results support statutory Indian GST compliance and Section 16(2)(aa) audit readiness.</p>
            <p className="flex items-center gap-1.5">
              <Clock3 className="size-3.5" /> GST Provider:{" "}
              <span className="font-medium text-slate-700">
                {apiConfigStatus.providerMode === "sandbox"
                  ? apiConfigStatus.isConfigured
                    ? "Sandbox.co.in Live Connected"
                    : "Sandbox API (API Key Pending)"
                  : "Offline Mock Simulator"}
              </span>
            </p>
          </footer>
        </div>
      </main>

      <VerificationSheet verification={selectedVerification} onOpenChange={(open) => !open && setSelectedVerification(null)} />
      <SupplierSheet supplier={selectedSupplier} onOpenChange={(open) => !open && setSelectedSupplier(null)} />
      <EinvoiceSheet einvoice={selectedEinvoice} onOpenChange={(open) => !open && setSelectedEinvoice(null)} />
      <GstSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={refreshApiStatus} />
    </div>
  );
}

// -------------------------------------------------------------
// OVERVIEW VIEW
// -------------------------------------------------------------
function OverviewView({
  metrics,
  history,
  suppliers,
  einvoices,
  onVerify,
  onSupplier,
  onEinvoice,
  onHistory,
}: {
  metrics: {
    totalInvoices: number;
    validInvoices: number;
    attentionInvoices: number;
    totalSuppliers: number;
    compliantSuppliers: number;
    defaulterSuppliers: number;
    totalEinvoices: number;
    validEinvoices: number;
  };
  history: Verification[];
  suppliers: SupplierCheckRecord[];
  einvoices: EinvoiceRecord[];
  onVerify: () => void;
  onSupplier: () => void;
  onEinvoice: () => void;
  onHistory: () => void;
}) {
  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#2f6bb3]">
            <LayoutDashboard className="size-4" /> GST Compliance Operations
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#102a4f] sm:text-[2rem]">Compliance Overview</h1>
          <p className="mt-2 text-sm text-slate-600">Real-time status across invoice matching, supplier filing compliance, and e-invoice authenticity.</p>
        </div>
        <SandboxBadge />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Invoices checked" value={metrics.totalInvoices} subtext={`${metrics.validInvoices} valid matches`} tone="blue" />
        <Metric label="Mismatches / Attention" value={metrics.attentionInvoices} subtext="Requires audit review" tone="amber" />
        <Metric label="Suppliers tracked" value={metrics.totalSuppliers} subtext={`${metrics.defaulterSuppliers} high risk defaulters`} tone={metrics.defaulterSuppliers > 0 ? "rose" : "green"} />
        <Metric label="E-Invoices verified" value={metrics.totalEinvoices} subtext={`${metrics.validEinvoices} digitally verified`} tone="green" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[#102a4f]">Recent Invoices</h2>
            <Button variant="ghost" size="sm" onClick={onVerify}>New Check <ChevronRight className="size-4" /></Button>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {history.length ? (
              history.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-slate-100"><FileText className="size-4 text-slate-600" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#102a4f]">{item.invoiceNumber}</p>
                    <p className="truncate text-[11px] font-mono text-slate-500">{item.supplierGstin}</p>
                  </div>
                  <StatusPill status={item.status} />
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-slate-400">No invoice verifications yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[#102a4f]">Supplier Filings</h2>
            <Button variant="ghost" size="sm" onClick={onSupplier}>Check GSTIN <ChevronRight className="size-4" /></Button>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {suppliers.length ? (
              suppliers.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><Building2 className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#102a4f]">{item.legalName}</p>
                    <p className="truncate text-[11px] font-mono text-slate-500">{item.supplierGstin}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    item.complianceRating === "Compliant" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                    item.complianceRating === "Delayed" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                    "bg-red-50 text-red-700 border border-red-200"
                  }`}>{item.complianceRating}</span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-slate-400">No supplier status checks yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[#102a4f]">E-Invoices (IRN)</h2>
            <Button variant="ghost" size="sm" onClick={onEinvoice}>Check IRN <ChevronRight className="size-4" /></Button>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {einvoices.length ? (
              einvoices.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><QrCode className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#102a4f]">{item.docNumber}</p>
                    <p className="truncate text-[11px] font-mono text-slate-500">{item.supplierGstin}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    item.status === "VALID" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                    "bg-red-50 text-red-700 border border-red-200"
                  }`}>{item.status}</span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-slate-400">No e-invoices verified yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-[#102a4f] p-6 text-white shadow-[0_12px_40px_rgba(15,42,79,.15)] flex flex-col justify-between">
          <div>
            <ShieldCheck className="size-8 text-blue-300" />
            <h2 className="mt-4 text-xl font-semibold">Verify Compliance</h2>
            <p className="mt-2 text-xs leading-5 text-blue-100/80">
              Under Section 16(2)(aa) of the CGST Act, Input Tax Credit requires supplier filing in GSTR-1 and reflection in GSTR-2B.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-2">
            <Button className="w-full bg-[#2f7df4] hover:bg-[#2563eb] text-white text-xs h-9" onClick={onVerify}>
              <FileSearch className="size-3.5 mr-1.5" /> Verify Invoice
            </Button>
            <Button variant="outline" className="w-full border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs h-9" onClick={onHistory}>
              <History className="size-3.5 mr-1.5" /> Full Audit History
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// -------------------------------------------------------------
// VERIFY INVOICE VIEW
// -------------------------------------------------------------
function VerifyView(props: {
  mode: Mode;
  setMode: (mode: Mode) => void;
  fields: Fields;
  changeField: (key: keyof Fields, value: string) => void;
  fieldErrors: Record<string, string>;
  checking: boolean;
  result: Verification | null;
  submitVerification: (event: React.FormEvent<HTMLFormElement>, source: Mode) => void;
  upload: File | null;
  setUpload: (file: File | null) => void;
  uploading: boolean;
  extractInvoice: () => void;
  extraction: OcrResponse | null;
  resetInvoiceUpload: () => void;
}) {
  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#2f6bb3]">
            <ShieldCheck className="size-4" /> Tax compliance workspace
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#102a4f] sm:text-[2rem]">Verify GST Invoice</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Validate whether a supplier invoice was reported in GSTR-1 and accurately reflected in your GSTR-2B record.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(props.upload || props.extraction || props.result) && (
            <Button
              type="button"
              variant="outline"
              onClick={props.resetInvoiceUpload}
              className="gap-2 border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <FileUp className="size-4 text-[#1f66c2]" /> Upload another invoice
            </Button>
          )}
          <SandboxBadge />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,42,79,.06)]">
          <Tabs value={props.mode} onValueChange={(value) => props.setMode(value as Mode)}>
            <div className="border-b border-slate-100 px-5 pt-5 sm:px-7 sm:pt-7">
              <TabsList variant="line" className="h-auto gap-7">
                <TabsTrigger value="manual" className="px-0 pb-4">
                  <FileSearch /> Manual entry
                </TabsTrigger>
                <TabsTrigger value="upload" className="px-0 pb-4">
                  <Upload /> Upload invoice
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="manual" className="mt-0">
              <VerificationForm source="manual" {...props} />
            </TabsContent>
            <TabsContent value="upload" className="mt-0">
              <div className="p-5 sm:p-7">
                {!props.extraction ? (
                  <UploadPanel {...props} />
                ) : (
                  <>
                    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-blue-100 bg-[#f3f8ff] p-4">
                      <div className="flex gap-3">
                        <BadgeCheck className="mt-0.5 size-5 text-[#1f66c2]" />
                        <div>
                          <p className="text-sm font-semibold text-[#173b67]">Fields extracted—please review</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {props.extraction.provider === "native-pdf"
                              ? `Digital vector PDF engine extracted clean text from ${props.extraction.fileName} (100% accuracy).`
                              : props.extraction.provider === "ocr-space"
                              ? `OCR.Space Cloud OCR scanned ${props.extraction.fileName}. Correct any field before verification.`
                              : props.extraction.provider === "tesseract-ocr"
                              ? `Tesseract OCR engine read ${props.extraction.fileName}. Correct any field before verification.`
                              : `Extracted ${props.extraction.fileName}. Correct any field before verification.`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          {props.extraction.provider === "native-pdf"
                            ? "DIGITAL PDF (100% ACCURACY)"
                            : props.extraction.provider === "ocr-space"
                            ? "OCR.SPACE CLOUD OCR"
                            : props.extraction.provider === "tesseract-ocr"
                            ? "TESSERACT OCR"
                            : "OCR EXTRACTED"}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={props.resetInvoiceUpload}
                          className="h-8 gap-1.5 border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <FileUp className="size-3.5 text-[#1f66c2]" /> Upload another invoice
                        </Button>
                      </div>
                    </div>
                    <VerificationForm source="upload" embedded {...props} />
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>
        <aside className="space-y-6">
          <GuidanceCard />
          {props.result ? <ResultSummary result={props.result} onReset={props.resetInvoiceUpload} /> : <RecentHint />}
        </aside>
      </div>
    </>
  );
}

function VerificationForm({
  source,
  embedded,
  fields,
  changeField,
  fieldErrors,
  checking,
  submitVerification,
  result,
  extraction,
  resetInvoiceUpload,
}: Parameters<typeof VerifyView>[0] & { source: Mode; embedded?: boolean }) {
  const [companyDirectoryOpen, setCompanyDirectoryOpen] = useState(false);
  return (
    <form onSubmit={(event) => submitVerification(event, source)} className={embedded ? "" : "p-5 sm:p-7"}>
      {!embedded && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-[#f3f8ff] p-4">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-blue-100 text-[#2467b4]">
            <BadgeCheck className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#173b67]">Three details are required</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">Optional date and value fields help identify mismatches precisely.</p>
          </div>
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between pb-1">
            <span className="flex items-center gap-1 text-sm font-semibold text-slate-800">
              Our company GSTIN <span className="text-red-600">*</span>
              {source === "upload" && extraction?.extraction.ourGstin.confidence !== undefined && (
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${
                    extraction.extraction.ourGstin.confidence >= 0.9
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {Math.round(extraction.extraction.ourGstin.confidence * 100)}% confidence
                </span>
              )}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCompanyDirectoryOpen(true)}
              className="h-7 px-2 text-xs font-medium text-sky-700 hover:bg-sky-50 border-sky-200"
            >
              <Building2 className="mr-1 size-3.5 text-sky-600" /> Entity & State Directory
            </Button>
          </div>

          {source === "upload" && extraction?.extraction.companyResolution && (
            <div className="mb-2 rounded-lg border border-sky-200 bg-sky-50/90 p-2.5 text-xs text-sky-950 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Building2 className="size-3.5 text-sky-600 shrink-0" />
                  <span>
                    Auto-resolved: <strong>{extraction.extraction.companyResolution.companyName}</strong> (
                    {extraction.extraction.companyResolution.matchedLocation})
                  </span>
                </span>
                <span className="rounded bg-sky-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-900">
                  {extraction.extraction.companyResolution.stateName}
                </span>
              </div>
              {extraction.extraction.companyResolution.alternativeOptions &&
                extraction.extraction.companyResolution.alternativeOptions.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-sky-200/60 pt-1.5">
                    <span className="text-[11px] font-medium text-slate-600">Switch:</span>
                    {extraction.extraction.companyResolution.alternativeOptions.map((alt) => (
                      <button
                        key={alt.gstin}
                        type="button"
                        onClick={() => {
                          changeField("ourGstin", alt.gstin);
                          toast.info(`Switched to ${alt.label}`, { description: alt.gstin });
                        }}
                        className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:text-sky-700 transition-colors"
                      >
                        {alt.label} ({alt.gstin})
                      </button>
                    ))}
                  </div>
                )}
            </div>
          )}

          <Input
            value={fields.ourGstin}
            onChange={(event) => changeField("ourGstin", event.target.value)}
            maxLength={15}
            className="h-11 font-mono uppercase"
            aria-invalid={Boolean(fieldErrors.ourGstin)}
          />

          {fieldErrors.ourGstin ? (
            <span className="mt-1 block text-xs font-medium text-red-600">{fieldErrors.ourGstin}</span>
          ) : (() => {
            const info = getCompanyGstinInfo(fields.ourGstin);
            if (info) {
              return (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-600">
                  <CheckCircle2 className="size-3 text-emerald-600" />
                  <span>
                    {info.shortName} — {info.stateName}
                    {info.tradeName ? ` (${info.tradeName})` : ""}
                  </span>
                </p>
              );
            }
            return <p className="mt-1 text-[11px] text-slate-500">The GSTIN receiving the invoice</p>;
          })()}
        </div>
        <Field
          label="Supplier GSTIN"
          required
          hint="Printed on the supplier invoice"
          error={fieldErrors.supplierGstin}
          confidence={source === "upload" ? extraction?.extraction.supplierGstin.confidence : undefined}
        >
          <Input
            value={fields.supplierGstin}
            onChange={(event) => changeField("supplierGstin", event.target.value)}
            placeholder="e.g. 27ABCDE1234F1Z0"
            maxLength={15}
            className="h-11 font-mono uppercase"
            aria-invalid={Boolean(fieldErrors.supplierGstin)}
          />
        </Field>
        <Field
          label="Supplier invoice number"
          required
          error={fieldErrors.invoiceNumber}
          confidence={source === "upload" ? extraction?.extraction.invoiceNumber.confidence : undefined}
        >
          <Input
            value={fields.invoiceNumber}
            onChange={(event) => changeField("invoiceNumber", event.target.value)}
            placeholder="e.g. INV/2026/0841"
            maxLength={16}
            className="h-11 uppercase"
            aria-invalid={Boolean(fieldErrors.invoiceNumber)}
          />
        </Field>
        <Field
          label="Invoice date"
          optional
          error={fieldErrors.invoiceDate}
          confidence={source === "upload" ? extraction?.extraction.invoiceDate.confidence : undefined}
        >
          <Input
            value={fields.invoiceDate}
            onChange={(event) => changeField("invoiceDate", event.target.value)}
            type="date"
            className="h-11"
            aria-invalid={Boolean(fieldErrors.invoiceDate)}
          />
        </Field>
        <Field
          label="Invoice value"
          optional
          error={fieldErrors.invoiceValue}
          confidence={source === "upload" ? extraction?.extraction.invoiceValue.confidence : undefined}
        >
          <MoneyInput value={fields.invoiceValue} onChange={(value) => changeField("invoiceValue", value)} />
        </Field>
        <Field
          label="Taxable value"
          optional
          error={fieldErrors.taxableValue}
          confidence={source === "upload" ? extraction?.extraction.taxableValue.confidence : undefined}
        >
          <MoneyInput value={fields.taxableValue} onChange={(value) => changeField("taxableValue", value)} />
        </Field>
      </div>
      <div className="mt-7 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center">
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="size-4" /> This check will be saved to your audit history.
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          {(source === "upload" || extraction || result) && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={resetInvoiceUpload}
              className="h-11 border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <FileUp className="mr-2 size-4 text-[#1f66c2]" /> Upload another invoice
            </Button>
          )}
          <Button type="submit" size="lg" disabled={checking} className="h-11 bg-[#1f66c2] px-6 hover:bg-[#174f96]">
            {checking ? (
              <>
                <LoaderCircle className="animate-spin" /> Checking GST records…
              </>
            ) : (
              <>
                <Search /> {source === "upload" ? "Verify reviewed invoice" : "Verify invoice"}
              </>
            )}
          </Button>
        </div>
      </div>
      {result && (
        <div className="mt-6 xl:hidden">
          <ResultSummary result={result} onReset={resetInvoiceUpload} />
        </div>
      )}
      <CompanyGstinDialog
        open={companyDirectoryOpen}
        onOpenChange={setCompanyDirectoryOpen}
        onSelectGstin={(gstin) => changeField("ourGstin", gstin)}
        currentGstin={fields.ourGstin}
      />
    </form>
  );
}

function UploadPanel({ upload, setUpload, uploading, extractInvoice }: Parameters<typeof VerifyView>[0]) {
  return (
    <div className="space-y-5">
      <label className="group grid min-h-[260px] cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-8 text-center transition hover:border-[#4f87ca] hover:bg-blue-50/50">
        <input
          key={upload ? upload.name : "empty"}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="sr-only"
          onClick={(event) => {
            (event.target as HTMLInputElement).value = "";
          }}
          onChange={(event) => setUpload(event.target.files?.[0] ?? null)}
        />
        <div>
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-100 text-[#1f66c2]">
            <FileUp className="size-7" />
          </span>
          <p className="mt-4 font-semibold text-[#173b67]">Drop an invoice here, or choose a file</p>
          <p className="mt-2 text-sm text-slate-500">PDF, JPG or PNG · up to 50 MB</p>
          {upload && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-800 shadow-sm">
              <span>{upload.name}</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  setUpload(null);
                }}
                className="ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="Remove file"
              >
                <XCircle className="size-4" />
              </button>
            </div>
          )}
        </div>
      </label>
      {uploading && (
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Uploading and reading invoice</span>
            <span className="text-slate-500">Processing</span>
          </div>
          <Progress value={68} />
        </div>
      )}
      <div className="flex justify-end">
        <Button
          type="button"
          size="lg"
          onClick={extractInvoice}
          disabled={!upload || uploading}
          className="h-11 bg-[#1f66c2] px-6 hover:bg-[#174f96]"
        >
          {uploading ? (
            <>
              <LoaderCircle className="animate-spin" /> Extracting fields…
            </>
          ) : (
            <>
              <FileSearch /> Extract invoice fields
            </>
          )}
        </Button>
      </div>
      <p className="text-xs leading-5 text-slate-500">
        Extracts invoice header, supplier GSTIN, buyer GSTIN, invoice number, date and monetary values using local OCR & PDF extraction.
      </p>
    </div>
  );
}

// -------------------------------------------------------------
// SUPPLIER FILING STATUS VIEW
// -------------------------------------------------------------
function SupplierView({
  supplierGstin,
  setSupplierGstin,
  supplierYear,
  setSupplierYear,
  checking,
  result,
  errors,
  submitSupplierCheck,
}: {
  supplierGstin: string;
  setSupplierGstin: (value: string) => void;
  supplierYear: string;
  setSupplierYear: (value: string) => void;
  checking: boolean;
  result: FilingStatus | null;
  errors: Record<string, string>;
  submitSupplierCheck: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#2f6bb3]">
            <Building2 className="size-4" /> Vendor Compliance
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#102a4f] sm:text-[2rem]">Supplier Filing Status</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Check supplier GST registration status, GSTR-1 & GSTR-3B return filing history, and Section 16(2)(aa) compliance rating.
          </p>
        </div>
        <SandboxBadge />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,42,79,.06)] sm:p-7">
          <form onSubmit={submitSupplierCheck} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block">
                  <span className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-800">
                    Supplier GSTIN <span className="text-red-600">*</span>
                  </span>
                  <Input
                    value={supplierGstin}
                    onChange={(e) => setSupplierGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 27ABCDE1234F1Z0"
                    maxLength={15}
                    className="h-11 font-mono uppercase"
                    aria-invalid={Boolean(errors.supplierGstin)}
                  />
                  {errors.supplierGstin && (
                    <span className="mt-1.5 block text-xs font-medium text-red-600">{errors.supplierGstin}</span>
                  )}
                </label>
              </div>

              <div>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-800">Financial Year</span>
                  <Select value={supplierYear} onValueChange={setSupplierYear}>
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025-26">FY 2025-26</SelectItem>
                      <SelectItem value="2024-25">FY 2024-25</SelectItem>
                      <SelectItem value="2023-24">FY 2023-24</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span>Sandbox quick test:</span>
                <button
                  type="button"
                  onClick={() => setSupplierGstin("27ABCDE1234F1Z0")}
                  className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  Compliant
                </button>
                <button
                  type="button"
                  onClick={() => setSupplierGstin("27DELAY1234F1Z0")}
                  className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                >
                  Delayed
                </button>
                <button
                  type="button"
                  onClick={() => setSupplierGstin("27DEF1234F1Z0")}
                  className="rounded bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800 hover:bg-rose-100"
                >
                  Defaulter
                </button>
                <button
                  type="button"
                  onClick={() => setSupplierGstin("27CANCEL1234F1Z0")}
                  className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 hover:bg-red-100"
                >
                  Cancelled
                </button>
              </div>

              <Button type="submit" disabled={checking} className="h-11 bg-[#1f66c2] px-6 hover:bg-[#174f96]">
                {checking ? (
                  <>
                    <LoaderCircle className="animate-spin" /> Fetching filings…
                  </>
                ) : (
                  <>
                    <Search className="size-4 mr-2" /> Check filing status
                  </>
                )}
              </Button>
            </div>
          </form>

          {result && <SupplierDetailCard result={result} />}
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl bg-[#102a4f] p-6 text-white shadow-[0_12px_40px_rgba(15,42,79,.14)]">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-200">ITC Compliance Rules</p>
            <div className="mt-4 space-y-4 text-xs leading-5 text-blue-100/80">
              <p>
                <strong>Section 16(2)(aa):</strong> Input Tax Credit is strictly conditional upon the supplier filing GSTR-1/IFF and the invoice appearing in GSTR-2B.
              </p>
              <p>
                <strong>Section 16(2)(c):</strong> The tax charged in respect of such supply must actually have been paid to the Government via GSTR-3B.
              </p>
              <p>
                If a supplier is marked as <em>Defaulter</em> with unpaid GSTR-3B, your claimed credit is liable for reversal with interest under Rule 37A.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function SupplierDetailCard({ result }: { result: FilingStatus }) {
  const isCompliant = result.complianceRating === "Compliant";
  const isDefaulter = result.complianceRating === "Defaulter";

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="font-mono text-xs font-semibold text-slate-500">{result.gstin}</span>
          <h2 className="mt-0.5 text-xl font-bold text-[#102a4f]">{result.legalName}</h2>
          <p className="text-xs text-slate-500">{result.tradeName}</p>
        </div>
        <div className="flex gap-2">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              result.gstinStatus === "ACTIVE"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {result.gstinStatus}
          </span>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              isCompliant
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : isDefaulter
                ? "bg-red-50 text-red-800 border border-red-200"
                : "bg-amber-50 text-amber-800 border border-amber-200"
            }`}
          >
            {result.complianceRating} Rating
          </span>
        </div>
      </div>

      {result.riskFactors.length > 0 && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-900">Compliance & ITC Risks Identified</p>
              <ul className="mt-1.5 list-disc pl-4 space-y-1 text-xs text-red-800">
                {result.riskFactors.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-3">
        <div>
          <span className="text-slate-500">Taxpayer Type</span>
          <p className="mt-1 font-semibold text-slate-800">{result.taxpayerType}</p>
        </div>
        <div>
          <span className="text-slate-500">Filing Frequency</span>
          <p className="mt-1 font-semibold text-slate-800">{result.filingFrequency}</p>
        </div>
        <div>
          <span className="text-slate-500">Registration Date</span>
          <p className="mt-1 font-semibold text-slate-800">{result.registrationDate}</p>
        </div>
        <div className="sm:col-span-2">
          <span className="text-slate-500">State Jurisdiction</span>
          <p className="mt-1 font-semibold text-slate-800">{result.stateJurisdiction}</p>
        </div>
        <div>
          <span className="text-slate-500">Last Filed Period</span>
          <p className="mt-1 font-semibold text-slate-800">{result.lastFiledPeriod}</p>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-[#102a4f]">Return Filing History & ARNs</h3>
        <p className="mt-0.5 text-xs text-slate-500">Recent 6 months GSTR-1 and GSTR-3B filings</p>

        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="pl-4">Return</TableHead>
                <TableHead>Tax Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Filing Date</TableHead>
                <TableHead>ARN</TableHead>
                <TableHead className="pr-4 text-right">Mode</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.filingHistory.map((rec, index) => (
                <TableRow key={index}>
                  <TableCell className="pl-4 font-semibold text-[#102a4f]">{rec.returnType}</TableCell>
                  <TableCell className="text-xs">{rec.taxPeriod}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${
                        rec.status === "Filed"
                          ? "bg-emerald-50 text-emerald-700"
                          : rec.status === "Late Filed"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {rec.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{rec.filingDate || "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">{rec.arn || "—"}</TableCell>
                  <TableCell className="pr-4 text-right text-xs">{rec.mode || "ONLINE"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// E-INVOICE (IRN) VIEW
// -------------------------------------------------------------
function EinvoiceView({
  mode,
  setMode,
  irn,
  setIrn,
  supplierGstin,
  setSupplierGstin,
  docNumber,
  setDocNumber,
  docDate,
  setDocDate,
  totalValue,
  setTotalValue,
  checking,
  result,
  errors,
  submitEinvoiceCheck,
}: {
  mode: "irn" | "details";
  setMode: (mode: "irn" | "details") => void;
  irn: string;
  setIrn: (val: string) => void;
  supplierGstin: string;
  setSupplierGstin: (val: string) => void;
  docNumber: string;
  setDocNumber: (val: string) => void;
  docDate: string;
  setDocDate: (val: string) => void;
  totalValue: string;
  setTotalValue: (val: string) => void;
  checking: boolean;
  result: EinvoiceResult | null;
  errors: Record<string, string>;
  submitEinvoiceCheck: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#2f6bb3]">
            <QrCode className="size-4" /> IRP Verification
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#102a4f] sm:text-[2rem]">Verify E-Invoice (IRN)</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Validate the 64-character Invoice Reference Number (IRN), digital signature, Ack details, and QR payload with the Invoice Registration Portal.
          </p>
        </div>
        <SandboxBadge />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,42,79,.06)]">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "irn" | "details")}>
            <div className="border-b border-slate-100 px-5 pt-5 sm:px-7 sm:pt-7">
              <TabsList variant="line" className="h-auto gap-7">
                <TabsTrigger value="irn" className="px-0 pb-4">
                  <QrCode /> 64-character IRN
                </TabsTrigger>
                <TabsTrigger value="details" className="px-0 pb-4">
                  <FileText /> Document Details
                </TabsTrigger>
              </TabsList>
            </div>

            <form onSubmit={submitEinvoiceCheck} className="p-5 sm:p-7">
              <TabsContent value="irn" className="mt-0 space-y-4">
                <label className="block">
                  <span className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-800">
                    Invoice Reference Number (IRN) <span className="text-red-600">*</span>
                  </span>
                  <Input
                    value={irn}
                    onChange={(e) => setIrn(e.target.value.toLowerCase())}
                    placeholder="e.g. e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                    maxLength={64}
                    className="h-11 font-mono text-xs"
                    aria-invalid={Boolean(errors.irn)}
                  />
                  {errors.irn && <span className="mt-1.5 block text-xs font-medium text-red-600">{errors.irn}</span>}
                </label>
              </TabsContent>

              <TabsContent value="details" className="mt-0 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-800">Supplier GSTIN</span>
                    <Input
                      value={supplierGstin}
                      onChange={(e) => setSupplierGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 27ABCDE1234F1Z0"
                      maxLength={15}
                      className="h-11 font-mono uppercase"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-800">Document Number</span>
                    <Input
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. INV-2026-1089"
                      maxLength={16}
                      className="h-11 uppercase"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-800">Document Date</span>
                    <Input value={docDate} onChange={(e) => setDocDate(e.target.value)} type="date" className="h-11" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-800">Total Invoice Value (₹)</span>
                    <MoneyInput value={totalValue} onChange={setTotalValue} />
                  </label>
                </div>
              </TabsContent>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span>Test IRN flags:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("irn");
                      setIrn("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
                    }}
                    className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                  >
                    Valid IRN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("irn");
                      setIrn("cancel-98fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b8550000");
                    }}
                    className="rounded bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800 hover:bg-rose-100"
                  >
                    Cancelled
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("irn");
                      setIrn("404-c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b8550000");
                    }}
                    className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 hover:bg-red-100"
                  >
                    Not Found
                  </button>
                </div>

                <Button type="submit" disabled={checking} className="h-11 bg-[#1f66c2] px-6 hover:bg-[#174f96]">
                  {checking ? (
                    <>
                      <LoaderCircle className="animate-spin" /> Verifying IRN…
                    </>
                  ) : (
                    <>
                      <QrCode className="size-4 mr-2" /> Verify E-Invoice
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Tabs>

          {result && <EinvoiceDetailCard result={result} />}
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl bg-[#102a4f] p-6 text-white shadow-[0_12px_40px_rgba(15,42,79,.14)]">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-200">E-Invoice Mandate</p>
            <div className="mt-4 space-y-4 text-xs leading-5 text-blue-100/80">
              <p>
                <strong>Turnover Threshold:</strong> Businesses with aggregate turnover exceeding ₹5 Crore in any preceding financial year must generate E-Invoices for B2B supplies.
              </p>
              <p>
                <strong>Digital Signature:</strong> An e-invoice is legally valid only if signed with the IRP’s private key. The QR code on the invoice contains the signed payload.
              </p>
              <p>
                <strong>Cancellation:</strong> An IRN can only be cancelled within 24 hours of generation on the portal. Beyond 24 hours, credit notes must be issued.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function EinvoiceDetailCard({ result }: { result: EinvoiceResult }) {
  const isValid = result.status === "VALID";
  const isCancelled = result.status === "CANCELLED";

  return (
    <div className="border-t border-slate-200 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              isValid
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : isCancelled
                ? "bg-rose-50 text-rose-800 border border-rose-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {result.status}
          </span>
          <h2 className="mt-2 text-xl font-bold text-[#102a4f]">{result.title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">{result.summary}</p>
        </div>

        {result.signedInvoiceVerified && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            <BadgeCheck className="size-4 text-emerald-600" /> IRP Digital Signature Valid
          </div>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <dt className="text-xs font-medium text-slate-500">Invoice Reference Number (IRN)</dt>
        <dd className="mt-1 break-all font-mono text-xs font-bold text-slate-800">{result.irn}</dd>
      </div>

      <div className="mt-4 grid gap-4 rounded-xl border border-slate-100 p-4 text-xs sm:grid-cols-2">
        <div>
          <span className="text-slate-500">Acknowledgment No</span>
          <p className="mt-1 font-mono font-semibold text-slate-800">{result.ackNo}</p>
        </div>
        <div>
          <span className="text-slate-500">Acknowledgment Date</span>
          <p className="mt-1 font-semibold text-slate-800">{formatDateTime(result.ackDate)}</p>
        </div>
        <div>
          <span className="text-slate-500">Supplier GSTIN</span>
          <p className="mt-1 font-mono font-semibold text-slate-800">{result.supplierGstin}</p>
          <p className="text-[11px] text-slate-500">{result.supplierName}</p>
        </div>
        <div>
          <span className="text-slate-500">Buyer GSTIN</span>
          <p className="mt-1 font-mono font-semibold text-slate-800">{result.buyerGstin}</p>
          <p className="text-[11px] text-slate-500">{result.buyerName}</p>
        </div>
        <div>
          <span className="text-slate-500">Document No & Date</span>
          <p className="mt-1 font-semibold text-slate-800">
            {result.docNumber} ({result.docType}) · {result.docDate}
          </p>
        </div>
        <div>
          <span className="text-slate-500">Total Invoice Value</span>
          <p className="mt-1 text-sm font-bold text-slate-900">{formatMoney(result.totalInvoiceValue)}</p>
          <p className="text-[11px] text-slate-500">Taxable: {formatMoney(result.taxableValue)}</p>
        </div>
      </div>

      {result.cancelDate && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <p className="font-semibold text-rose-900">Cancellation Record</p>
          <p className="mt-1">Cancelled on: {formatDateTime(result.cancelDate)}</p>
          {result.cancelReason && <p className="mt-0.5">Reason: {result.cancelReason}</p>}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// HISTORY & AUDIT VIEW
// -------------------------------------------------------------
function HistoryView({
  tab,
  setTab,
  history,
  supplierHistory,
  einvoiceHistory,
  loading,
  error,
  status,
  setStatus,
  search,
  setSearch,
  reload,
  exportHistory,
  selectVerification,
  selectSupplier,
  selectEinvoice,
}: {
  tab: "invoices" | "suppliers" | "einvoices";
  setTab: (t: "invoices" | "suppliers" | "einvoices") => void;
  history: Verification[];
  supplierHistory: SupplierCheckRecord[];
  einvoiceHistory: EinvoiceRecord[];
  loading: boolean;
  error: string;
  status: string;
  setStatus: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  reload: () => Promise<void>;
  exportHistory: () => void;
  selectVerification: (item: Verification) => void;
  selectSupplier: (item: SupplierCheckRecord) => void;
  selectEinvoice: (item: EinvoiceRecord) => void;
}) {
  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#2f6bb3]">
            <History className="size-4" /> Audit trail
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#102a4f] sm:text-[2rem]">Compliance Audit Trail</h1>
          <p className="mt-2 text-sm text-slate-600">Complete historical record of all GST checks, supplier lookups, and e-invoice validations.</p>
        </div>
        <Button variant="outline" onClick={exportHistory} className="border-slate-300">
          <Download className="size-4 mr-2" /> Export to CSV
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,42,79,.05)]">
        <div className="border-b border-slate-100 px-5 pt-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "invoices" | "suppliers" | "einvoices")}>
            <TabsList variant="line" className="h-auto gap-7">
              <TabsTrigger value="invoices" className="px-0 pb-3">
                Invoices ({history.length})
              </TabsTrigger>
              <TabsTrigger value="suppliers" className="px-0 pb-3">
                Suppliers ({supplierHistory.length})
              </TabsTrigger>
              <TabsTrigger value="einvoices" className="px-0 pb-3">
                E-Invoices ({einvoiceHistory.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoice number, GSTIN, or IRN..."
              className="h-10 pl-9"
            />
          </div>
          {tab === "invoices" && (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10 w-full sm:w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {Object.entries(invoiceStatuses).map(([value, item]) => (
                  <SelectItem value={value} key={value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" className="h-10" onClick={() => void reload()}>
            <RefreshCw className="size-4 mr-2" /> Refresh
          </Button>
        </div>

        {loading ? (
          <HistorySkeleton />
        ) : error ? (
          <EmptyState
            icon={<XCircle />}
            title="History unavailable"
            text={error}
            action={
              <Button variant="outline" onClick={() => void reload()}>
                Try again
              </Button>
            }
          />
        ) : tab === "invoices" ? (
          !history.length ? (
            <EmptyState icon={<History />} title="No invoice verifications found" text="Run an invoice verification or adjust search filters." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="pl-5">Invoice</TableHead>
                  <TableHead>Supplier GSTIN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoice Value</TableHead>
                  <TableHead>Checked</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="pr-5 text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-5 font-semibold text-[#173b67]">{item.invoiceNumber}</TableCell>
                    <TableCell className="font-mono text-xs">{item.supplierGstin}</TableCell>
                    <TableCell>
                      <StatusPill status={item.status} />
                    </TableCell>
                    <TableCell>{formatMoney(item.invoiceValue)}</TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDateTime(item.createdAt ?? item.checkedAt)}</TableCell>
                    <TableCell className="capitalize text-xs">{item.source ?? "manual"}</TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button size="sm" variant="ghost" onClick={() => selectVerification(item)}>
                        View <ChevronRight className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : tab === "suppliers" ? (
          !supplierHistory.length ? (
            <EmptyState icon={<Building2 />} title="No supplier checks found" text="Run a supplier filing check to view history." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="pl-5">Supplier GSTIN</TableHead>
                  <TableHead>Legal Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Compliance Rating</TableHead>
                  <TableHead>Last Period</TableHead>
                  <TableHead>Checked</TableHead>
                  <TableHead className="pr-5 text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-5 font-mono text-xs font-semibold text-[#173b67]">{item.supplierGstin}</TableCell>
                    <TableCell className="text-xs font-medium">{item.legalName}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.gstinStatus === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                        {item.gstinStatus}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.complianceRating === "Compliant" ? "bg-emerald-50 text-emerald-800" :
                        item.complianceRating === "Delayed" ? "bg-amber-50 text-amber-800" :
                        "bg-red-50 text-red-800"
                      }`}>{item.complianceRating}</span>
                    </TableCell>
                    <TableCell className="text-xs">{item.lastFiledPeriod}</TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button size="sm" variant="ghost" onClick={() => selectSupplier(item)}>
                        View <ChevronRight className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : !einvoiceHistory.length ? (
          <EmptyState icon={<QrCode />} title="No e-invoice checks found" text="Run an IRN verification to view history." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="pl-5">Document</TableHead>
                <TableHead>Supplier GSTIN</TableHead>
                <TableHead>IRN Status</TableHead>
                <TableHead>Ack No</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Checked</TableHead>
                <TableHead className="pr-5 text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {einvoiceHistory.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="pl-5 font-semibold text-[#173b67]">{item.docNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{item.supplierGstin}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      item.status === "VALID" ? "bg-emerald-50 text-emerald-800" :
                      item.status === "CANCELLED" ? "bg-rose-50 text-rose-800" :
                      "bg-red-50 text-red-800"
                    }`}>{item.status}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">{item.ackNo || "—"}</TableCell>
                  <TableCell>{item.totalInvoiceValuePaise ? formatMoney(item.totalInvoiceValuePaise / 100) : "—"}</TableCell>
                  <TableCell className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button size="sm" variant="ghost" onClick={() => selectEinvoice(item)}>
                      View <ChevronRight className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  );
}

// -------------------------------------------------------------
// SLIDE-OVER DETAIL DRAWERS
// -------------------------------------------------------------
function VerificationSheet({
  verification,
  onOpenChange,
}: {
  verification: Verification | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(verification)} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        {verification && (
          <>
            <SheetHeader className="border-b p-6">
              <SheetTitle className="text-xl text-[#102a4f]">{verification.invoiceNumber}</SheetTitle>
              <SheetDescription>Checked {formatDateTime(verification.createdAt ?? verification.checkedAt)}</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 p-6">
              <StatusPill status={verification.status} />
              <div>
                <h3 className="font-semibold">{verification.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{verification.summary}</p>
              </div>
              <dl className="grid gap-4 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <Detail label="Our GSTIN" value={verification.ourGstin} mono />
                <Detail label="Supplier GSTIN" value={verification.supplierGstin} mono />
                <Detail label="Invoice date" value={verification.invoiceDate || "Not supplied"} />
                <Detail label="Invoice value" value={formatMoney(verification.invoiceValue)} />
                <Detail label="Taxable value" value={formatMoney(verification.taxableValue)} />
                <Detail label="Source" value={verification.source || "manual"} />
              </dl>
              {Boolean(verification.mismatches && verification.mismatches.length > 0) && (
                <div>
                  <h3 className="font-semibold">Differences found</h3>
                  <div className="mt-3 space-y-3">
                    {verification.mismatches.map((item) => (
                      <div key={item.field} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                        <p className="font-semibold text-amber-900">{item.label}</p>
                        <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-amber-800">
                          <p>
                            Submitted
                            <br />
                            <strong>{item.submitted}</strong>
                          </p>
                          <p>
                            Reported
                            <br />
                            <strong>{item.reported}</strong>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Detail label="Provider reference" value={verification.providerReference} mono />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SupplierSheet({
  supplier,
  onOpenChange,
}: {
  supplier: SupplierCheckRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(supplier)} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        {supplier && (
          <>
            <SheetHeader className="border-b p-6">
              <SheetTitle className="text-xl text-[#102a4f]">{supplier.legalName}</SheetTitle>
              <SheetDescription>GSTIN: {supplier.supplierGstin} · Checked {formatDateTime(supplier.createdAt)}</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 p-6">
              <div className="flex gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{supplier.gstinStatus}</span>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">{supplier.complianceRating}</span>
              </div>
              <p className="text-sm text-slate-600">{supplier.summary}</p>
              <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-2">
                <Detail label="Trade Name" value={supplier.tradeName} />
                <Detail label="Taxpayer Type" value={supplier.taxpayerType} />
                <Detail label="Filing Frequency" value={supplier.filingFrequency} />
                <Detail label="Last Period" value={supplier.lastFiledPeriod} />
              </dl>
              {supplier.filingStatus?.filingHistory && (
                <div>
                  <h4 className="font-semibold text-xs text-slate-700">Recent Returns</h4>
                  <div className="mt-2 divide-y divide-slate-100 text-xs">
                    {supplier.filingStatus.filingHistory.slice(0, 6).map((rec, i) => (
                      <div key={i} className="flex justify-between py-2">
                        <span className="font-medium">{rec.returnType} ({rec.taxPeriod})</span>
                        <span className={rec.status === "Filed" ? "text-emerald-700" : "text-red-700"}>{rec.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Detail label="Reference" value={supplier.providerReference} mono />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EinvoiceSheet({
  einvoice,
  onOpenChange,
}: {
  einvoice: EinvoiceRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(einvoice)} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        {einvoice && (
          <>
            <SheetHeader className="border-b p-6">
              <SheetTitle className="text-xl text-[#102a4f]">{einvoice.docNumber}</SheetTitle>
              <SheetDescription>IRN Checked {formatDateTime(einvoice.createdAt)}</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 p-6">
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
                {einvoice.status}
              </span>
              <div>
                <h3 className="font-semibold text-sm">{einvoice.title}</h3>
                <p className="mt-1 text-xs text-slate-600">{einvoice.summary}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500 font-medium">IRN Hash</p>
                <p className="mt-1 font-mono text-xs break-all font-bold text-slate-800">{einvoice.irn}</p>
              </div>
              <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-2">
                <Detail label="Ack No" value={einvoice.ackNo || "—"} mono />
                <Detail label="Ack Date" value={formatDateTime(einvoice.ackDate)} />
                <Detail label="Supplier GSTIN" value={einvoice.supplierGstin} mono />
                <Detail label="Buyer GSTIN" value={einvoice.buyerGstin} mono />
                <Detail label="Total Value" value={einvoice.totalInvoiceValuePaise ? formatMoney(einvoice.totalInvoiceValuePaise / 100) : "—"} />
              </dl>
              <Detail label="Reference" value={einvoice.providerReference} mono />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// -------------------------------------------------------------
// HELPER COMPONENTS
// -------------------------------------------------------------
function ResultSummary({ result, onReset }: { result: Verification; onReset?: () => void }) {
  const config = invoiceStatuses[result.status];
  const Icon = config.icon;
  return (
    <section className={`rounded-2xl border p-5 ${config.className}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="text-xs font-bold uppercase tracking-[0.1em]">{config.label}</span>
          <h2 className="mt-1 font-semibold">{result.title}</h2>
          <p className="mt-2 text-sm leading-5 opacity-90">{result.summary}</p>
        </div>
      </div>
      {Boolean(result.mismatches && result.mismatches.length > 0) && (
        <div className="mt-4 space-y-2 border-t border-current/15 pt-4">
          {result.mismatches.map((item) => (
            <div key={item.field} className="rounded-lg bg-white/65 p-3 text-xs">
              <p className="font-semibold">{item.label}</p>
              <p className="mt-1">Submitted: {item.submitted}</p>
              <p>Reported: {item.reported}</p>
            </div>
          ))}
        </div>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-current/15 pt-4 text-xs">
        <div>
          <dt className="opacity-70">Reference</dt>
          <dd className="mt-1 font-mono font-semibold">{result.providerReference}</dd>
        </div>
        <div>
          <dt className="opacity-70">Provider</dt>
          <dd className="mt-1 font-semibold uppercase">{result.provider}</dd>
        </div>
      </dl>
      {onReset && (
        <div className="mt-5 border-t border-current/15 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            className="w-full border-slate-300 bg-white/90 text-sm font-semibold text-slate-800 shadow-sm hover:bg-white hover:text-slate-950"
          >
            <FileUp className="mr-2 size-4 text-[#1f66c2]" /> Upload Another Invoice
          </Button>
        </div>
      )}
    </section>
  );
}

function NavItem({
  icon,
  label,
  active,
  count,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  count?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
        active ? "bg-white/12 font-semibold text-white" : "text-blue-100 hover:bg-white/7 hover:text-white"
      } disabled:cursor-not-allowed disabled:opacity-35`}
    >
      <span className="[&_svg]:size-[18px]">{icon}</span>
      <span className="flex-1">{label}</span>
      {count && <span className="rounded-full bg-[#2f7df4] px-2 py-0.5 text-[11px] font-semibold">{count}</span>}
    </button>
  );
}

function MobileNavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button variant={active ? "secondary" : "ghost"} size="sm" onClick={onClick} aria-label={label}>
      {icon}
    </Button>
  );
}

function Field({
  label,
  required,
  optional,
  hint,
  error,
  confidence,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string;
  confidence?: number;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="text-red-600">*</span>}
        {optional && <span className="ml-1 text-xs font-normal text-slate-400">Optional</span>}
        {confidence !== undefined && (
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${
              confidence >= 0.9 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {Math.round(confidence * 100)}% confidence
          </span>
        )}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>
      )}
    </label>
  );
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <span className="absolute inset-y-0 left-3 flex items-center text-sm font-medium text-slate-500">₹</span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        placeholder="0.00"
        className="h-11 pl-8"
      />
    </div>
  );
}

function GuidanceCard() {
  return (
    <section className="rounded-2xl bg-[#102a4f] p-6 text-white shadow-[0_12px_40px_rgba(15,42,79,.14)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-200">Before you verify</p>
      <div className="mt-5 space-y-5">
        <GuideStep number="1" title="Exact invoice numbering" text="Preserve hyphens, forward slashes, and leading zeroes as printed on document." />
        <GuideStep number="2" title="GSTR-2B cycle alignment" text="Late filings by suppliers reflect in subsequent monthly GSTR-2B statements." />
        <GuideStep number="3" title="Follow-up, don't reject" text="Unreflected invoices require supplier notification before credit reversals." />
      </div>
    </section>
  );
}

function GuideStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-blue-300/40 bg-blue-300/10 text-xs font-bold text-blue-100">
        {number}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-blue-100/75">{text}</p>
      </div>
    </div>
  );
}

function RecentHint() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-[#102a4f]">Sandbox test flags</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Include one of these in the invoice number to test each condition.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <code className="rounded bg-slate-100 p-2">MM (Mismatch)</code>
        <code className="rounded bg-slate-100 p-2">PENDING (RNF)</code>
        <code className="rounded bg-slate-100 p-2">NOTFOUND (404)</code>
        <code className="rounded bg-slate-100 p-2">CANCEL (Void)</code>
        <code className="rounded bg-slate-100 p-2">AMEND (Replaced)</code>
        <code className="rounded bg-slate-100 p-2">ERROR (Outage)</code>
      </div>
    </section>
  );
}

function SandboxBadge() {
  return (
    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
      <span className="size-2 rounded-full bg-amber-500 animate-pulse" /> Sandbox GST Provider
    </div>
  );
}

function StatusPill({ status }: { status: InvoiceStatus }) {
  const item = invoiceStatuses[status] || invoiceStatuses.VALID;
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${item.className}`}>{item.label}</span>;
}

function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[300px] place-items-center p-8 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:size-5">
          {icon}
        </span>
        <h2 className="mt-4 font-semibold text-[#102a4f]">{title}</h2>
        <p className="mt-2 text-sm text-slate-500">{text}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  subtext,
  tone,
}: {
  label: string;
  value: number;
  subtext?: string;
  tone: "blue" | "green" | "amber" | "rose";
}) {
  const style =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "rose"
      ? "bg-rose-50 text-rose-700"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : "bg-blue-50 text-blue-700";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`grid size-9 place-items-center rounded-xl ${style}`}>
        <BadgeCheck className="size-4" />
      </div>
      <p className="mt-4 text-3xl font-bold text-[#102a4f]">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
      {subtext && <p className="mt-0.5 text-xs text-slate-400">{subtext}</p>}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

// -------------------------------------------------------------
// WEBMCP AGENT TOOLS INTEGRATION
// -------------------------------------------------------------
function useWebMcp(
  runVerification: (fields: Fields, source?: Mode) => Promise<Verification | null>,
  runSupplierCheck: (gstin: string, year?: string) => Promise<FilingStatus | null>,
  runEinvoiceVerification: (payload: { irn?: string; supplierGstin?: string; docNumber?: string }) => Promise<EinvoiceResult | null>,
  setView: (view: View) => void,
) {
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: { registerTool: (tool: object, options?: { signal?: AbortSignal }) => void | Promise<void> };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    const invoiceTool = {
      name: "verify_gst_invoice",
      title: "Verify GST invoice against GSTR-2B",
      description: "Verify one Indian GST invoice using the mock provider and saved-history workflow.",
      inputSchema: {
        type: "object",
        properties: {
          ourGstin: { type: "string" },
          supplierGstin: { type: "string" },
          invoiceNumber: { type: "string" },
          invoiceDate: { type: "string" },
          invoiceValue: { type: "number" },
          taxableValue: { type: "number" },
        },
        required: ["ourGstin", "supplierGstin", "invoiceNumber"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input: Record<string, string | number>) {
        setView("verify");
        const res = await runVerification({
          ourGstin: String(input.ourGstin),
          supplierGstin: String(input.supplierGstin),
          invoiceNumber: String(input.invoiceNumber),
          invoiceDate: input.invoiceDate ? String(input.invoiceDate) : "",
          invoiceValue: input.invoiceValue === undefined ? "" : String(input.invoiceValue),
          taxableValue: input.taxableValue === undefined ? "" : String(input.taxableValue),
        });
        if (!res) throw new Error("Verification did not complete");
        return { id: res.id, status: res.status, title: res.title, providerReference: res.providerReference };
      },
    };

    const supplierTool = {
      name: "check_supplier_filing_status",
      title: "Check supplier GST returns filing compliance",
      description: "Lookup a supplier GSTIN to check active status, GSTR-1, GSTR-3B filings, ARNs, and compliance rating.",
      inputSchema: {
        type: "object",
        properties: {
          supplierGstin: { type: "string" },
          financialYear: { type: "string" },
        },
        required: ["supplierGstin"],
        additionalProperties: false,
      },
      async execute(input: Record<string, string>) {
        setView("supplier");
        const res = await runSupplierCheck(input.supplierGstin, input.financialYear || "2025-26");
        if (!res) throw new Error("Supplier check did not complete");
        return {
          gstin: res.gstin,
          legalName: res.legalName,
          complianceRating: res.complianceRating,
          gstinStatus: res.gstinStatus,
          riskFactors: res.riskFactors,
        };
      },
    };

    const einvoiceTool = {
      name: "verify_gst_einvoice",
      title: "Verify E-Invoice IRN or document details",
      description: "Verify a 64-character IRN or document number with the Invoice Registration Portal.",
      inputSchema: {
        type: "object",
        properties: {
          irn: { type: "string" },
          supplierGstin: { type: "string" },
          docNumber: { type: "string" },
        },
        additionalProperties: false,
      },
      async execute(input: Record<string, string>) {
        setView("einvoice");
        const res = await runEinvoiceVerification({
          irn: input.irn,
          supplierGstin: input.supplierGstin,
          docNumber: input.docNumber,
        });
        if (!res) throw new Error("E-Invoice verification did not complete");
        return {
          status: res.status,
          irn: res.irn,
          ackNo: res.ackNo,
          signedQrVerified: res.signedQrVerified,
        };
      },
    };

    try {
      void Promise.resolve(context.registerTool(invoiceTool, { signal: lifecycle.signal })).catch(() => {});
      void Promise.resolve(context.registerTool(supplierTool, { signal: lifecycle.signal })).catch(() => {});
      void Promise.resolve(context.registerTool(einvoiceTool, { signal: lifecycle.signal })).catch(() => {});
    } catch {
      // WebMCP optional in unsupported browsers
    }
    return () => lifecycle.abort();
  }, [runVerification, runSupplierCheck, runEinvoiceVerification, setView]);
}
