import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { FilePlus2, Gavel, ReceiptText, Ticket as TicketIcon } from "lucide-react";
import {
  billingBlock, billMemo, disputeMemo, listMemos, memoReasonText, memoTotals, raiseMemo, resolveDispute, withdrawMemo,
  MEMO_REASONS, REVIEW_DAYS, type Memo, type MemoAmounts, type MemoReason, type MemoType,
} from "@/domain/memos";
import { getTicket } from "@/domain/api";
import { useOpKey } from "@/lib/useOpKey";
import { invalidateRecords } from "@/lib/invalidate";
import { Money } from "@/components/domain/Money";
import { Chip } from "@/components/layout/views";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/core";
import { PageTitle, Panel, PanelHead, PanelBody, Stat, Meta, MetaGrid, Line } from "@/components/ui/surface";
import { DataTable } from "@/components/ui/table";
import { Drawer, Modal } from "@/components/ui/overlay";
import { Pill, type Tone } from "@/components/ui/pill";
import { Banner } from "@/components/ui/banner";
import { toast } from "@/components/ui/toast";
import { usePerm } from "@/lib/usePerm";
import { useT, type Key } from "@/i18n";
import { useUI } from "@/store/ui";
import { csvNumber } from "@/lib/csv";
import { cn, formatDate, formatDateTime, parseAmount } from "@/lib/utils";

type Filter = "all" | "review" | "disputed" | "billable" | "billed" | "withdrawn";
const FILTER_KEY: Record<Filter, Key> = {
  all: "memos.chip.all", review: "memos.chip.review", disputed: "memos.chip.disputed",
  billable: "memos.chip.billable", billed: "memos.chip.billed", withdrawn: "memos.chip.withdrawn",
};
const STATUS_TONE: Record<Memo["status"], Tone> = { issued: "blue", disputed: "amber", billed: "green", withdrawn: "gray" };
const STATUS_KEY: Record<Memo["status"], Key> = {
  issued: "memos.status.issued", disputed: "memos.status.disputed", billed: "memos.status.billed", withdrawn: "memos.status.withdrawn",
};

function matches(m: Memo, f: Filter, now: number): boolean {
  switch (f) {
    case "review": return m.type === "ADM" && m.status === "issued" && !!billingBlock(m, now);
    case "disputed": return m.status === "disputed";
    case "billable": return !billingBlock(m, now);
    case "billed": return m.status === "billed";
    case "withdrawn": return m.status === "withdrawn";
    default: return true;
  }
}

const col = createColumnHelper<Memo>();

/**
 * ADM / ACM — gelir muhasebesinin acente dekontları masası.
 * Liste · özet · dekont kesme · itiraz ve faturalama akışı.
 */
export function Memos() {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const { can } = usePerm();
  const search = useSearch({ from: "/memos" });
  const { data, isLoading } = useQuery({ queryKey: ["memos"], queryFn: listMemos });
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(!!search.ticket);
  const now = Date.now();
  const list = data ?? [];
  const totals = memoTotals(list);
  const open = list.find((m) => m.id === openId) ?? null;

  const columns = useMemo(() => [
    col.accessor("number", { header: t("memos.col.number"), cell: (c) => <span className="num whitespace-nowrap font-medium text-ink">{c.getValue()}</span> }),
    col.accessor("type", {
      header: t("memos.col.type"),
      cell: (c) => <Pill tone={c.getValue() === "ADM" ? "red" : "green"}>{c.getValue()}</Pill>,
    }),
    col.accessor("ticketNumber", { header: t("memos.col.ticket"), cell: (c) => <span className="num text-ink-2">{c.getValue()}</span> }),
    col.accessor((m) => m.agent.name, {
      id: "agent", header: t("memos.col.agent"),
      cell: (c) => <span className="text-ink">{c.getValue()} <span className="num text-[11.5px] text-ink-3">{c.row.original.agent.iata}</span></span>,
    }),
    col.accessor((m) => memoReasonText(m.type, m.reason, lang), { id: "reason", header: t("memos.col.reason"), cell: (c) => <span className="text-ink-2">{c.getValue()}</span> }),
    col.accessor((m) => m.total.amount, {
      id: "total", header: t("memos.col.total"),
      meta: { align: "right", exportValue: (m: Memo) => csvNumber(m.total.amount) },
      cell: (c) => <Money value={c.row.original.total} size="sm" tone={c.row.original.type === "ACM" ? "out" : undefined} />,
    }),
    col.accessor((m) => m.total.currency, { id: "currency", header: "Currency", meta: { exportOnly: true } }),
    col.accessor("reviewUntil", {
      header: t("memos.col.deadline"),
      meta: { exportValue: (m: Memo) => (m.reviewUntil ? formatDate(m.reviewUntil) : "") },
      cell: (c) => <span className="num text-ink-3">{c.getValue() ? formatDate(c.getValue()!) : "—"}</span>,
    }),
    col.accessor("status", {
      header: t("memos.col.status"), enableSorting: false,
      meta: { exportValue: (m: Memo) => t(STATUS_KEY[m.status]) },
      cell: (c) => {
        const m = c.row.original;
        const billable = m.status === "issued" && !billingBlock(m, now);
        return <Pill tone={billable ? "violet" : STATUS_TONE[m.status]}>{billable ? t("memos.status.billable") : t(STATUS_KEY[m.status])}</Pill>;
      },
    }),
  ] as ColumnDef<Memo, unknown>[], [t, lang, now]);

  // Tutarlar para birimi bazında; sıfır olan para birimi yazılmaz.
  const fmt = (pick: (r: (typeof totals)[number]) => number) =>
    totals.filter((r) => pick(r) !== 0).map((r) => `${pick(r).toLocaleString()} ${r.currency}`).join(" · ") || "—";
  const billable = list.filter((m) => m.status === "issued" && !billingBlock(m, now)).length;

  return (
    <>
      <PageTitle
        title={t("memos.title")}
        hint={t("memos.hint")}
        action={can("adm.manage") ? <Button onClick={() => setCreating(true)}><FilePlus2 size={15} strokeWidth={1.75} /> {t("memos.new")}</Button> : undefined}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label={t("memos.kpi.open")} value={list.filter((m) => m.type === "ADM" && (m.status === "issued" || m.status === "disputed")).length}
          hint={fmt((r) => r.admOpen)} />
        <Stat label={t("memos.kpi.disputed")} value={list.filter((m) => m.status === "disputed").length} tone="var(--t-amber-d)" />
        <Stat label={t("memos.chip.billable")} value={billable} tone={billable ? "var(--t-violet-d)" : undefined} />
        <Stat label={t("memos.kpi.billed")} value={list.filter((m) => m.status === "billed").length} tone="var(--t-green-d)" hint={fmt((r) => r.net)} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(FILTER_KEY) as Filter[]).map((f) => (
          <Chip key={f} active={filter === f} count={list.filter((m) => matches(m, f, now)).length} onClick={() => setFilter(f)}>
            {t(FILTER_KEY[f])}
          </Chip>
        ))}
      </div>

      <DataTable
        data={list.filter((m) => matches(m, filter, now))}
        columns={columns}
        loading={isLoading}
        onRowClick={(m) => setOpenId(m.id)}
        rowKey={(m) => `${m.number} · ${m.agent.name}`}
        rowTone={(m) => (m.type === "ADM" ? "var(--t-red-d)" : "var(--t-green-d)")}
        pageSize={12}
        exportName="adm-acm"
        empty={{ title: t("memos.empty"), icon: <ReceiptText size={22} strokeWidth={1.5} /> }}
      />

      {open && <MemoDrawer memo={open} onClose={() => setOpenId(null)} />}
      {creating && <RaiseMemoModal initialTicket={search.ticket} onClose={() => setCreating(false)} onDone={(m) => { setCreating(false); setOpenId(m.id); }} />}
    </>
  );
}

/* --- ayrıntı + akış -------------------------------------------------- */
function MemoDrawer({ memo: m, onClose }: { memo: Memo; onClose: () => void }) {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const user = useUI((s) => s.user);
  const { can } = usePerm();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [disputeText, setDisputeText] = useState("");
  const [withdrawText, setWithdrawText] = useState("");
  const by = user?.name ?? "—";
  const done = () => { toast.success(t("memos.toast.done"), m.number); qc.invalidateQueries({ queryKey: ["memos"] }); qc.invalidateQueries({ queryKey: ["memosFor", m.ticketNumber] }); };
  const fail = (e: Error) => toast.danger(t("memos.toast.failed"), e.message);
  const dispute = useMutation({ mutationFn: () => disputeMemo(m.id, disputeText), onSuccess: done, onError: fail });
  const resolve = useMutation({ mutationFn: (accept: boolean) => resolveDispute(m.id, accept, by), onSuccess: done, onError: fail });
  const bill = useMutation({ mutationFn: () => billMemo(m.id, by), onSuccess: done, onError: fail });
  const withdraw = useMutation({ mutationFn: () => withdrawMemo(m.id, by, withdrawText), onSuccess: done, onError: fail });
  const block = billingBlock(m);
  const manage = can("adm.manage");
  const cur = m.total.currency;

  return (
    <Drawer open onClose={onClose} width="lg" title={`${m.type} ${m.number}`} hint={memoReasonText(m.type, m.reason, lang)}
      footer={<Button variant="secondary" onClick={() => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: m.ticketNumber } })}><TicketIcon size={15} strokeWidth={1.75} /> {t("memos.action.openTicket")}</Button>}
    >
      <div className="flex flex-col gap-4">
        <MetaGrid>
          <Meta label={t("memos.col.status")} value={<Pill tone={STATUS_TONE[m.status]}>{t(STATUS_KEY[m.status])}</Pill>} />
          <Meta label={t("memos.col.agent")} value={`${m.agent.name} · ${m.agent.iata}`} />
          <Meta label={t("memos.col.ticket")} value={`${m.ticketNumber} · ${m.passengerName}`} mono />
          {m.reviewUntil && <Meta label={t("memos.detail.reviewUntil")} value={formatDate(m.reviewUntil)} mono />}
          {m.billingPeriod && <Meta label={t("memos.detail.period")} value={m.billingPeriod} mono />}
        </MetaGrid>

        <Panel>
          <PanelHead title={t("memos.detail.amounts")} />
          <PanelBody className="flex flex-col gap-1">
            {m.amounts.fare > 0 && <Line label={t("memos.form.fare")} value={<Money value={{ amount: m.amounts.fare, currency: cur }} size="sm" />} />}
            {m.amounts.tax > 0 && <Line label={t("memos.form.tax")} value={<Money value={{ amount: m.amounts.tax, currency: cur }} size="sm" />} />}
            {m.amounts.commission > 0 && <Line label={t("memos.form.commission")} value={<Money value={{ amount: m.amounts.commission, currency: cur }} size="sm" />} />}
            {m.amounts.adminFee > 0 && <Line label={t("memos.form.adminFee")} value={<Money value={{ amount: m.amounts.adminFee, currency: cur }} size="sm" />} />}
            <Line label={t("memos.form.total")} strong value={<Money value={m.total} size="md" />} />
            {m.note && <p className="mt-2 rounded-md bg-sunken px-3 py-2 text-[12.5px] text-ink-2">{m.note}</p>}
          </PanelBody>
        </Panel>

        {m.dispute && (
          <Banner kind={m.dispute.resolution === "accepted" ? "success" : m.dispute.resolution === "rejected" ? "danger" : "warning"} title={t("memos.detail.dispute")}>
            {m.dispute.reason}
            {m.dispute.note && <div className="mt-1 opacity-80">{m.dispute.note}</div>}
          </Banner>
        )}

        {manage && m.status !== "billed" && m.status !== "withdrawn" && (
          <Panel>
            <PanelBody className="flex flex-col gap-3">
              {m.status === "disputed" ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={resolve.isPending} onClick={() => resolve.mutate(true)}>{t("memos.action.accept")}</Button>
                  <Button variant="danger" disabled={resolve.isPending} onClick={() => resolve.mutate(false)}>{t("memos.action.reject")}</Button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button disabled={!!block || bill.isPending} onClick={() => bill.mutate()} title={block ?? undefined}>
                      <Gavel size={15} strokeWidth={1.75} /> {t("memos.action.bill")}
                    </Button>
                    {block && <span className="text-[12px] text-ink-3">{block}</span>}
                  </div>
                  {m.type === "ADM" && !m.dispute && (
                    <div className="flex flex-wrap items-end gap-2 border-t border-hair pt-3">
                      <Field label={t("memos.action.disputeReason")} className="min-w-[16rem] flex-1">
                        <Input value={disputeText} onChange={(e) => setDisputeText(e.target.value)} />
                      </Field>
                      <Button variant="secondary" disabled={disputeText.trim().length < 5 || dispute.isPending} onClick={() => dispute.mutate()}>
                        {t("memos.action.dispute")}
                      </Button>
                    </div>
                  )}
                </>
              )}
              <div className="flex flex-wrap items-end gap-2 border-t border-hair pt-3">
                <Field label={t("memos.action.withdrawReason")} className="min-w-[16rem] flex-1">
                  <Input value={withdrawText} onChange={(e) => setWithdrawText(e.target.value)} />
                </Field>
                <Button variant="ghost" disabled={withdrawText.trim().length < 3 || withdraw.isPending} onClick={() => withdraw.mutate()}>
                  {t("memos.action.withdraw")}
                </Button>
              </div>
            </PanelBody>
          </Panel>
        )}

        <Panel>
          <PanelHead title={t("memos.detail.history")} />
          <PanelBody>
            <ol className="relative flex flex-col gap-3 border-l border-line pl-4">
              {[...m.history].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span aria-hidden className={cn("absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-panel",
                    h.action === "billed" ? "bg-[var(--t-green-d)]" : h.action === "withdrawn" || h.action === "dispute_accepted" ? "bg-ink-3"
                      : h.action === "disputed" ? "bg-[var(--t-amber-d)]" : "bg-[var(--t-red-d)]")} />
                  <div className="text-[13px] text-ink">{lang === "en" ? h.textEn : h.text}</div>
                  <div className="num text-[11.5px] text-ink-3">{formatDateTime(h.at)} · {h.by}</div>
                </li>
              ))}
            </ol>
          </PanelBody>
        </Panel>
      </div>
    </Drawer>
  );
}

/* --- dekont kes ------------------------------------------------------ */
function RaiseMemoModal({ initialTicket, onClose, onDone }: { initialTicket?: string; onClose: () => void; onDone: (m: Memo) => void }) {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const user = useUI((s) => s.user);
  const qc = useQueryClient();
  const [type, setType] = useState<MemoType>("ADM");
  const [tn, setTn] = useState(initialTicket ?? "");
  const [reason, setReason] = useState<MemoReason>("FARE");
  const [amounts, setAmounts] = useState<Record<keyof MemoAmounts, string>>({ fare: "", tax: "", commission: "", adminFee: "150" });
  const [note, setNote] = useState("");
  const { data: ticket, isFetching } = useQuery({
    queryKey: ["ticket", tn], queryFn: async () => (await getTicket(tn)) ?? null, enabled: /^\d{13}$/.test(tn),
  });
  const num = (v: string) => parseAmount(v);
  const parsed: MemoAmounts = { fare: num(amounts.fare), tax: num(amounts.tax), commission: num(amounts.commission), adminFee: type === "ADM" ? num(amounts.adminFee) : 0 };
  const total = parsed.fare + parsed.tax + parsed.commission + parsed.adminFee;
  const setType2 = (x: MemoType) => { setType(x); setReason(MEMO_REASONS[x][0].code); };

  const op = useOpKey();
  const m = useMutation({
    mutationFn: () => raiseMemo({ type, ticketNumber: tn, reason, amounts: parsed, note, by: user?.name ?? "—", idempotencyKey: op.key() }),
    onSuccess: (memo) => { op.rotate(); toast.success(t("memos.toast.raised"), memo.number); invalidateRecords(qc); onDone(memo); },
    onError: (e: Error) => toast.danger(t("memos.toast.failed"), e.message),
  });

  const amountField = (k: keyof MemoAmounts, label: Key) => (
    <Field label={t(label)}>
      <Input inputMode="decimal" value={amounts[k]} onChange={(e) => setAmounts({ ...amounts, [k]: e.target.value })} className="num" placeholder="0" />
    </Field>
  );

  return (
    <Modal open onClose={onClose} width="lg" title={t("memos.form.title")} hint={t("memos.form.hint")}
      footer={
        <>
          <span className="mr-auto flex items-baseline gap-2">
            <span className="microlabel">{t("memos.form.total")}</span>
            {ticket ? <Money value={{ amount: total, currency: ticket.fare.total.currency }} size="md" /> : <span className="num text-ink-3">—</span>}
          </span>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!ticket?.agent || total <= 0 || m.isPending} onClick={() => m.mutate()}>{t("memos.form.submit")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("memos.form.type")}>
            <Select value={type} onChange={(e) => setType2(e.target.value as MemoType)}>
              <option value="ADM">{t("memos.form.adm")}</option>
              <option value="ACM">{t("memos.form.acm")}</option>
            </Select>
          </Field>
          <Field label={t("memos.form.ticket")} hint={t("memos.form.ticketHint")}>
            <Input value={tn} onChange={(e) => setTn(e.target.value.replace(/\D/g, "").slice(0, 13))} className="num" placeholder="2357000000036" />
          </Field>
        </div>
        {/^\d{13}$/.test(tn) && !isFetching && (
          !ticket ? <Banner kind="danger">{t("memos.form.notFound")}</Banner>
            : !ticket.agent ? <Banner kind="warning">{t("memos.form.direct")}</Banner>
              : <Banner kind="info">{t("memos.form.agentOf", { name: ticket.agent.name, iata: ticket.agent.iata, city: ticket.agent.city })} · {ticket.passenger.surname}/{ticket.passenger.givenName}</Banner>
        )}
        <Field label={t("memos.form.reason")}>
          <Select value={reason} onChange={(e) => setReason(e.target.value as MemoReason)}>
            {MEMO_REASONS[type].map((r) => <option key={r.code} value={r.code}>{lang === "en" ? r.en : r.tr}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {amountField("fare", "memos.form.fare")}
          {amountField("tax", "memos.form.tax")}
          {amountField("commission", "memos.form.commission")}
          {type === "ADM" && amountField("adminFee", "memos.form.adminFee")}
        </div>
        <Field label={t("memos.form.note")}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Field>
        {type === "ADM" && <p className="text-[12px] text-ink-3">{t("memos.form.review", { n: REVIEW_DAYS })}</p>}
      </div>
    </Modal>
  );
}
