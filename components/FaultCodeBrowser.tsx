"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Search, ShieldAlert, X, Zap } from "lucide-react";
import { faultCodes, type FaultCode, type FaultSeverity } from "@/lib/faultCodes";

const severityChip: Record<FaultSeverity, string> = {
  info: "border-black/[0.08] bg-card-soft text-text-secondary",
  warning: "border-brass/40 bg-brass/15 text-[#5b4a00]",
  danger: "border-ember/40 bg-ember/10 text-ember"
};

const severityIcon: Record<FaultSeverity, React.ReactNode> = {
  info: <AlertTriangle size={13} />,
  warning: <Zap size={13} />,
  danger: <ShieldAlert size={13} />
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (fault: FaultCode) => void;
};

export function FaultCodeBrowser({ open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faultCodes;
    return faultCodes.filter((fault) => {
      if (fault.code.toLowerCase().includes(q)) return true;
      if (fault.label.toLowerCase().includes(q)) return true;
      if (fault.indicator.toLowerCase().includes(q)) return true;
      return fault.keywords.some((kw) => kw.includes(q) || q.includes(kw));
    });
  }, [query]);

  if (!open) return null;

  function handleClose() {
    setQuery("");
    onClose();
  }

  function handleSelect(fault: FaultCode) {
    setQuery("");
    onSelect(fault);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Fault Codes & Indicators"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-black/[0.08] bg-card shadow-none">
        <header className="flex items-start justify-between gap-3 border-b border-black/[0.08] bg-card px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ember/15 text-ember">
              <ShieldAlert size={17} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Fault codes & indicators</h2>
              <p className="text-xs text-text-secondary">
                Pick what your welder is doing — get the cause and recovery steps instantly.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1.5 text-text-secondary hover:bg-black/5 hover:text-text-primary"
            aria-label="Close fault code browser"
          >
            <X size={17} />
          </button>
        </header>

        <div className="border-b border-black/[0.08] bg-card-soft/50 px-5 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-3 py-2">
            <Search size={15} className="text-text-secondary" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by code (HOT, LV), symptom (won't power on, hot), or keyword"
              className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary/65"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-xs text-text-secondary hover:text-text-primary"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-text-secondary">
              No matching fault. Try a different word, or describe it in chat.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((fault) => (
                <li key={fault.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(fault)}
                    className="group flex w-full items-start gap-3 rounded-lg border border-transparent px-2.5 py-2.5 text-left hover:border-black/[0.08] hover:bg-card-soft"
                  >
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityChip[fault.severity]}`}
                    >
                      {severityIcon[fault.severity]}
                      {fault.code}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary">{fault.label}</p>
                      <p className="mt-0.5 truncate text-xs text-text-secondary">{fault.indicator}</p>
                    </div>
                    <ChevronRight
                      size={15}
                      className="mt-1 shrink-0 text-text-secondary transition group-hover:translate-x-0.5 group-hover:text-text-primary"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-black/[0.08] bg-card-soft/50 px-5 py-2.5 text-[11px] text-text-secondary">
          Grounded in the OmniPro 220 owner&apos;s manual troubleshooting tables.
        </footer>
      </div>
    </div>
  );
}
