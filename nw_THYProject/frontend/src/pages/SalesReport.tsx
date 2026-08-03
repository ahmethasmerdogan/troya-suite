import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { CalendarRange, Printer } from "lucide-react";
import { queryTransactions, type TransactionRow } from "@/domain/api";
import { Money } from "@/components/domain/Money";
import { Button, Field, Input, Select } from "@/components/ui/core";
import { PageTitle } from "@/components/ui/surface";
import { DataTable } from "@/components/ui/table";
import { Card, InsetPanel, OutlineBadge, SearchField, StatusPill, type Tone } from "@/ui";
import { useT } from "@/i18n";
import { formatDateTime, cn } from "@/lib/utils";

/* ====================================================================
   Satış / İşlem Raporu — dönem kapanışı.

   Event store'dan türeyen çapraz-belge denetim kaydı, muhasebenin
   beklediği biçimde toplanır: brüt satış − iade − iptal = NET SATIŞ,
   para birimi bazında. Dönem gün / ay / yıl sonu ya da serbest aralık
   olabilir; BSP/ARC mutabakatı bu kırılımla yapılır.
   ==================================================================== */

const CAT: Record<string, { label: string; tone: Tone; sign: -1 | 0 | 1 }> = {
  issue: { label: "Kesim", tone: "green", sign: 1 },
  void: { label: "İptal (Void)", tone: "red", sign: -1 },
  refund: { label: "İade", tone: "pink", sign: -1 },
  exchange: { label: "Değişim / Reissue", tone: "violet", sign: 0 },
  emd: { label: "EMD", tone: "blue", sign: 1 },
  checkin: { label: "Check-in", tone: "gray", sign: 0 },
  other: { label: "Diğer", tone: "gray", sign: 0 },
};

type PeriodId = "day" | "month" | "year" | "custom";

/** Dönem ön ayarları — kapanış raporunun omurgası. */
function periodRange(id: PeriodId, now = new Date()): { from: string; to: string } | null {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (id === "day") return { from: iso(now), to: iso(now) };
  if (id === "month")
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  if (id === "year")
    return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(new Date(now.getFullYear(), 11, 31)) };
  return null;
}

const PERIODS: { id: PeriodId; label: string; hint: string }[] = [
  { id: "day", label: "Gün sonu", hint: "Bugünün kapanışı" },
  { id: "month", label: "Ay sonu", hint: "İçinde bulunulan ay" },
  { id: "year", label: "Yıl sonu", hint: "İçinde bulunulan yıl" },
  { id: "custom", label: "Özel tarih", hint: "Serbest aralık" },
];

const col = createColumnHelper<TransactionRow>();

export function SalesReport() {
  const t = useT();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodId>("month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [text, setText] = useState("");
  const [category, setCategory] = useState("all");
  const [carrier, setCarrier] = useState("");

  const range = period === "custom" ? custom : (periodRange(period) ?? { from: "", to: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["tx", text, category, carrier, range.from, range.to],
    queryFn: () => queryTransactions({ text, category: category as never, carrier, from: range.from, to: range.to }),
  });
  const rows = data ?? [];

  /** Para birimi bazında brüt / iade / iptal / net — muhasebenin okuduğu tablo. */
  const closing = useMemo(() => {
    const m = new Map<string, { gross: number; refund: number; voided: number; count: number }>();
    for (const r of rows) {
      const cur = r.amount?.currency;
      if (!cur) continue;
      const e = m.get(cur) ?? { gross: 0, refund: 0, voided: 0, count: 0 };
      const amt = r.amount!.amount;
      if (r.category === "issue" || r.category === "emd") { e.gross += amt; e.count += 1; }
      else if (r.category === "refund") { e.refund += amt; e.count += 1; }
      else if (r.category === "void") { e.voided += amt; e.count += 1; }
      m.set(cur, e);
    }
    return [...m.entries()]
      .map(([cur, v]) => ({ cur, ...v, net: v.gross - v.refund - v.voided }))
      .sort((a, b) => b.gross - a.gross);
  }, [rows]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const byActor = useMemo(() => {
    const m = new Map<string, { n: number; gross: number }>();
    for (const r of rows) {
      const e = m.get(r.actor) ?? { n: 0, gross: 0 };
      e.n += 1;
      if (r.category === "issue" && r.amount) e.gross += r.amount.amount;
      m.set(r.actor, e);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6);
  }, [rows]);

  const columns = [
    col.accessor("occurredAt", { header: "Zaman", cell: (c) => <span className="num text-ink-2">{formatDateTime(c.getValue())}</span> }),
    col.accessor("category", {
      header: "İşlem", enableSorting: false,
      cell: (c) => <StatusPill tone={CAT[c.getValue()]?.tone ?? "gray"} dot>{CAT[c.getValue()]?.label ?? c.getValue()}</StatusPill>,
    }),
    col.accessor("ticketNumber", { header: "Belge No", cell: (c) => <span className="num text-ink">{c.getValue()}</span> }),
    col.accessor("passengerName", { header: "Yolcu", cell: (c) => <span className="text-ink">{c.getValue()}</span> }),
    col.accessor("actor", { header: "Personel / Ofis", cell: (c) => <span className="text-ink-2">{c.getValue()}</span> }),
    col.accessor("carrier", { header: "Carrier", cell: (c) => <span className="num text-ink-2">{c.getValue()}</span> }),
    col.accessor("detail", { header: "Açıklama", enableSorting: false, cell: (c) => <span className="text-ink-3">{c.getValue() ?? "—"}</span> }),
    col.accessor((r) => r.amount?.amount ?? 0, {
      id: "amount", header: "Tutar",
      meta: { align: "right", summary: closing[0] ? `${closing[0].net.toLocaleString("tr-TR")} ${closing[0].cur}` : undefined },
      cell: (c) => {
        const r = c.row.original;
        if (!r.amount) return <span className="text-ink-3">—</span>;
        const sign = CAT[r.category]?.sign ?? 0;
        return <Money value={r.amount} size="sm" tone={sign < 0 ? "out" : undefined} />;
      },
    }),
  ] as ColumnDef<TransactionRow, unknown>[];

  return (
    <>
      <PageTitle
        title="Satış / İşlem Raporu"
        hint={t("report.desc")}
        action={<Button variant="secondary" onClick={() => window.print()}><Printer size={15} strokeWidth={1.75} /> Yazdır</Button>}
      />

      {/* --- dönem seçimi --- */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange size={16} strokeWidth={1.75} className="text-ink-3" />
          <span className="microlabel mr-1">Dönem</span>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              title={p.hint}
              className={cn("rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors",
                period === p.id ? "bg-brand text-white" : "bg-inset text-ink-2 hover:text-ink")}
            >
              {p.label}
            </button>
          ))}
          {range.from && <OutlineBadge tone="gray">{range.from} → {range.to}</OutlineBadge>}
        </div>

        {period === "custom" && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Başlangıç" required><Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></Field>
            <Field label="Bitiş" required><Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></Field>
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <SearchField value={text} onValueChange={setText} placeholder="Belge no · yolcu · personel · açıklama" kbd="" />
          </div>
          <Field label="İşlem tipi">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">Tümü</option>
              {Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <Field label="Carrier"><Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="TK" className="uppercase" /></Field>
        </div>
      </Card>

      {/* --- kapanış özeti: para birimi bazında --- */}
      <Card className="mb-4 p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="microlabel">Dönem kapanışı</span>
          <span className="num text-[12px] text-ink-3">{rows.length} işlem</span>
        </div>

        {closing.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-3">Bu dönemde tutarlı işlem yok.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {closing.map((c) => (
              <InsetPanel key={c.cur} className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="num text-[14px] font-semibold text-ink">{c.cur}</span>
                  <span className="num text-[11.5px] text-ink-3">{c.count} işlem</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 lg:grid-cols-4">
                  <Cell label="Brüt satış" amount={c.gross} cur={c.cur} />
                  <Cell label="İade" amount={c.refund} cur={c.cur} tone="out" />
                  <Cell label="İptal (Void)" amount={c.voided} cur={c.cur} tone="out" />
                  <div className="border-t border-line pt-2 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                    <div className="microlabel">Net satış</div>
                    <Money value={{ amount: c.net, currency: c.cur }} size="md" className="mt-0.5" />
                  </div>
                </div>
              </InsetPanel>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-line pt-4 lg:grid-cols-2">
          <div>
            <div className="microlabel mb-2">İşlem tipine göre</div>
            <div className="flex flex-wrap gap-1.5">
              {byCategory.map(([k, n]) => (
                <StatusPill key={k} tone={CAT[k]?.tone ?? "gray"} dot>
                  {CAT[k]?.label ?? k} <span className="num ml-1">{n}</span>
                </StatusPill>
              ))}
            </div>
          </div>
          <div>
            <div className="microlabel mb-2">Personel / ofise göre</div>
            <div className="flex flex-col gap-1">
              {byActor.map(([actor, v]) => (
                <div key={actor} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                  <span className="truncate text-ink-2">{actor}</span>
                  <span className="num flex-shrink-0 text-ink-3">
                    {v.n} işlem{v.gross > 0 ? ` · ${v.gross.toLocaleString("tr-TR")}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <DataTable
        data={rows}
        columns={columns}
        loading={isLoading}
        onRowClick={(r) => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: r.ticketNumber } })}
        rowKey={(r) => `${r.ticketNumber} ${r.category}`}
        rowTone={(r) => `var(--t-${CAT[r.category]?.tone ?? "gray"}-d)`}
        pageSize={15}
        exportName={`rapor-${range.from || "tum"}`}
        summary={closing.length ? `Net ${closing.map((c) => `${c.net.toLocaleString("tr-TR")} ${c.cur}`).join(" · ")}` : undefined}
        empty={{ title: "İşlem bulunamadı", hint: "Dönemi genişletin ya da filtreleri gevşetin." }}
      />
    </>
  );
}

function Cell({ label, amount, cur, tone }: { label: string; amount: number; cur: string; tone?: "out" }) {
  return (
    <div>
      <div className="microlabel">{label}</div>
      <Money value={{ amount, currency: cur }} size="sm" tone={tone} className="mt-0.5" />
    </div>
  );
}
