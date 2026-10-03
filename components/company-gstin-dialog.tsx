"use client";

import { useMemo, useState } from "react";
import { Building2, Check, Copy, Factory, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COMPANY_MASTER, type StateGstinRecord } from "@/lib/company-registry";

interface CompanyGstinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectGstin: (gstin: string, meta?: { companyName: string; stateName: string }) => void;
  currentGstin?: string;
}

export function CompanyGstinDialog({
  open,
  onOpenChange,
  onSelectGstin,
  currentGstin = "",
}: CompanyGstinDialogProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("rdc-concrete");
  const [searchQuery, setSearchQuery] = useState("");

  const activeCompany = useMemo(
    () => COMPANY_MASTER.find((c) => c.id === selectedCompanyId) || COMPANY_MASTER[0],
    [selectedCompanyId],
  );

  const filteredStates = useMemo(() => {
    const list = Object.values(activeCompany.stateGstins);
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (s) =>
        s.stateName.toLowerCase().includes(q) ||
        s.stateCode.includes(q) ||
        s.gstin.toLowerCase().includes(q) ||
        (s.tradeName && s.tradeName.toLowerCase().includes(q)),
    );
  }, [activeCompany, searchQuery]);

  function handleSelect(record: StateGstinRecord) {
    onSelectGstin(record.gstin, {
      companyName: activeCompany.name,
      stateName: record.stateName,
    });
    toast.success(`Applied ${record.stateName} GSTIN`, {
      description: `${activeCompany.shortName}: ${record.gstin}`,
    });
    onOpenChange(false);
  }

  function handleCopy(gstin: string, e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(gstin);
    toast.success("GSTIN copied to clipboard", { description: gstin });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="space-y-1.5 pb-2">
          <div className="flex items-center gap-2 text-slate-800">
            <Building2 className="size-5 text-sky-600" />
            <DialogTitle className="text-xl font-bold">Company & Subsidiaries GSTIN Directory</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Select your registered entity and state to auto-fill the buyer GSTIN with 1 click.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedCompanyId} onValueChange={setSelectedCompanyId} className="w-full flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3 mb-3 bg-slate-100 p-1">
            {COMPANY_MASTER.map((company) => (
              <TabsTrigger
                key={company.id}
                value={company.id}
                className="text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-sky-700 data-[state=active]:shadow-sm"
              >
                {company.shortName}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                placeholder="Search by state, city, plant (e.g. Haryana, Kharkhoda, Delhi, 06)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-mono text-slate-600">
              <span>PAN:</span>
              <strong className="text-slate-900 font-semibold">{activeCompany.pan}</strong>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[46vh]">
            {filteredStates.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No matching state GSTIN found for &quot;{searchQuery}&quot;.
              </div>
            ) : (
              filteredStates.map((record) => {
                const isCurrent = currentGstin.toUpperCase() === record.gstin.toUpperCase();
                return (
                  <div
                    key={record.stateCode}
                    onClick={() => handleSelect(record)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                      isCurrent
                        ? "border-sky-500 bg-sky-50/70 shadow-sm"
                        : "border-slate-200 bg-white hover:border-sky-300 hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center size-5 rounded bg-slate-100 text-[11px] font-mono font-bold text-slate-700">
                          {record.stateCode}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">{record.stateName}</span>
                        {record.tradeName && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100/80 px-2 py-0.5 rounded">
                            <Factory className="size-3 text-slate-400" />
                            {record.tradeName}
                          </span>
                        )}
                        {isCurrent && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                            <Check className="size-3" /> Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900 tracking-wider">
                          {record.gstin}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopy(record.gstin, e)}
                          title="Copy GSTIN"
                          className="text-slate-400 hover:text-slate-700 p-0.5"
                        >
                          <Copy className="size-3" />
                        </button>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={isCurrent ? "secondary" : "outline"}
                      className={`text-xs h-8 ${isCurrent ? "bg-sky-600 text-white hover:bg-sky-700" : "hover:border-sky-500 hover:text-sky-700"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(record);
                      }}
                    >
                      {isCurrent ? "Selected" : "Select"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
