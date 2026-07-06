import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ArrowDownLeft, ChevronDown, MessagesSquare, CheckCircle2, Ticket as TicketIcon, Code2 } from "lucide-react";
import { listMessages } from "@/domain/api";
import type { InterlineMessage, MessageStandard } from "@/domain/types";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { SearchBar } from "@/components/ui/search-bar";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, cn } from "@/lib/utils";

const STANDARD_LABEL: Record<MessageStandard, string> = { EDIFACT: "EDIFACT", NDC: "NDC", ONE_ORDER: "ONE Order" };
// Standart rengi: EDIFACT legacy (amber) · NDC info (mavi) · ONE Order modern (yeşil)
const STANDARD_CHIP: Record<MessageStandard, string> = {
  EDIFACT: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  NDC: "bg-[var(--info-bg)] text-[var(--info-text)]",
  ONE_ORDER: "bg-[var(--success-bg)] text-[var(--success-text)]",
};
const STATUS_PILL: Record<InterlineMessage["status"], string> = {
  sent: "pill--info", acked: "pill--success", received: "pill--neutral", failed: "pill--danger",
};

export function Messages() {
  const [filter, setFilter] = useState<"all" | MessageStandard>("all");
  const [query, setQuery] = useState("");
  const t = useT();
  const { data: messages, isLoading } = useQuery({ queryKey: ["messages"], queryFn: listMessages });

  const all = messages ?? [];
  const q = query.trim().toUpperCase();
  const filtered = all.filter((m) =>
    (filter === "all" || m.standard === filter) &&
    (!q || m.messageType.toUpperCase().includes(q) || m.summary.toUpperCase().includes(q) || m.partnerCarrier.includes(q) || (m.ticketNumber ?? "").includes(q)),
  );

  return (
    <div>
      <PageHeader title={t("nav.messages")} description={t("messages.desc")} />

      {all.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={MessagesSquare} label="Toplam mesaj" value={all.length} accent />
          <StatCard icon={ArrowUpRight} label="Giden" value={all.filter((m) => m.direction === "outbound").length} />
          <StatCard icon={ArrowDownLeft} label="Gelen" value={all.filter((m) => m.direction === "inbound").length} />
          <StatCard icon={CheckCircle2} label="Onaylı (acked)" value={all.filter((m) => m.status === "acked").length} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "EDIFACT", "NDC", "ONE_ORDER"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("rounded-pill px-3 py-1.5 text-[13px] transition-colors", filter === f ? "bg-accent text-white" : "border border-border-default bg-surface text-secondary hover:bg-sunken")}>
            {f === "all" ? "Tümü" : STANDARD_LABEL[f]}
          </button>
        ))}
        <SearchBar className="ml-auto min-w-[200px] max-w-xs" value={query} onChange={setQuery} placeholder="Tip, özet, carrier, TKT…" />
      </div>
      <div className="mb-2 text-[12px] text-tertiary">{filtered.length} mesaj</div>

      <Card>
        <CardContent className="flex flex-col gap-2.5 pt-6">
          {isLoading ? (
            <><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></>
          ) : filtered.length ? (
            filtered.map((m) => <MessageRow key={m.id} m={m} />)
          ) : (
            <EmptyState icon={MessagesSquare} title="Mesaj yok" hint="Filtreleri değiştirin ya da aramayı temizleyin." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MessageRow({ m }: { m: InterlineMessage }) {
  const [open, setOpen] = useState(false);
  const outbound = m.direction === "outbound";
  return (
    <div className="overflow-hidden rounded-md border border-[var(--border-subtle)] bg-surface">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-alt">
        <span className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full", outbound ? "bg-accent-soft text-accent" : "bg-sunken text-secondary")} title={outbound ? "Giden" : "Gelen"}>
          {outbound ? <ArrowUpRight size={17} strokeWidth={2} /> : <ArrowDownLeft size={17} strokeWidth={2} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] font-semibold text-primary">{m.messageType}</span>
            <span className={cn("rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]", STANDARD_CHIP[m.standard])}>{STANDARD_LABEL[m.standard]}</span>
            <span className="text-[12px] text-tertiary">{outbound ? "→" : "←"} <span className="font-mono text-secondary">{m.partnerCarrier}</span></span>
          </div>
          <div className="mt-0.5 truncate text-[13px] text-secondary">{m.summary}</div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          {m.ticketNumber && (
            <Link to="/tickets/$ticketNumber" params={{ ticketNumber: m.ticketNumber }} onClick={(e) => e.stopPropagation()} className="hidden items-center gap-0.5 font-mono text-[11px] text-accent hover:underline md:inline-flex">
              <TicketIcon size={11} strokeWidth={1.75} />{m.ticketNumber}
            </Link>
          )}
          <span className="hidden font-mono text-[11px] text-tertiary lg:inline">{formatDateTime(m.occurredAt)}</span>
          <span className={cn("pill", STATUS_PILL[m.status])}>{m.status}</span>
          <ChevronDown size={16} strokeWidth={1.75} className={cn("text-tertiary transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <div className="border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 bg-surface-alt px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-tertiary">
            <Code2 size={13} strokeWidth={1.75} /> Ham mesaj · {STANDARD_LABEL[m.standard]} · {m.messageType}
          </div>
          <pre className="overflow-x-auto bg-inverse px-4 py-3 font-mono text-[12px] leading-relaxed text-on-inverse">{m.payloadPreview}</pre>
        </div>
      )}
    </div>
  );
}
