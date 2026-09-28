import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { acknowledgePta, createPta, issueAgainstPta, listPtas, refundPta } from "@/domain/api";
import type { Pta } from "@/domain/types";
import { Money } from "@/components/domain/Money";
import { Banner } from "@/components/ui/banner";
import { Button, Field, Input, Select } from "@/components/ui/core";
import { PageTitle } from "@/components/ui/surface";
import { DataTable } from "@/components/ui/table";
import { Modal } from "@/components/ui/overlay";
import { Pill, type Tone } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { useT, type Key } from "@/i18n";
import { useErrorText } from "@/lib/useErrorText";
import { csvNumber } from "@/lib/csv";
import { formatDate, parseAmount } from "@/lib/utils";
import { useOpKey, useOpKeys } from "@/lib/useOpKey";
import { invalidateRecords } from "@/lib/invalidate";

/**
 * PTA — Prepaid Ticket Advice (Handbook Ch 9).
 * Bilet bedeli bir istasyonda ödenir, yolcu bileti başka istasyonda alır.
 */
const TONE: Record<Pta["status"], Tone> = { open: "blue", used: "green", refunded: "pink", expired: "gray" };
const STATUS_KEY: Record<Pta["status"], Key> = {
  open: "misc.pta.status.open", used: "misc.pta.status.used", refunded: "misc.pta.status.refunded", expired: "misc.pta.status.expired",
};
const col = createColumnHelper<Pta>();

export function PtaPage() {
  const t = useT();
  const errText = useErrorText();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  /** 9.3 — fazla tahsilat / kısmi kullanım iadesi. */
  const [refundFor, setRefundFor] = useState<Pta | null>(null);
  const [usedValue, setUsedValue] = useState("0");
  const [docType, setDocType] = useState<"MCO" | "AgentsRefundVoucher">("MCO");
  const [form, setForm] = useState({
    sponsorName: "", sponsorLocation: "IST", beneficiaryName: "", pickupLocation: "JFK",
    route: "IST → JFK", amount: "25000", currency: "TRY", fop: "cash" as "cash" | "credit",
  });

  const { data, isLoading } = useQuery({ queryKey: ["ptas"], queryFn: listPtas });
  // İşlem anahtarları: çift tıklama tek işlem (bir PTA'ya iki bilet kesilmez).
  const createOp = useOpKey();
  const rowOps = useOpKeys();
  const refundOp = useOpKey();

  const create = useMutation({
    mutationFn: () => createPta({
      sponsorName: form.sponsorName, sponsorLocation: form.sponsorLocation,
      beneficiaryName: form.beneficiaryName, pickupLocation: form.pickupLocation,
      route: form.route, amount: { amount: parseAmount(form.amount) || 0, currency: form.currency },
      formOfPayment: { type: form.fop },
      idempotencyKey: createOp.key(),
    }),
    onSuccess: (p) => {
      createOp.rotate();
      toast.success(t("misc.pta.createOk"), p.ptaReference);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["ptas"] });
    },
    onError: (e: Error) => toast.danger(t("misc.pta.createFail"), errText(e)),
  });

  const issue = useMutation({
    mutationFn: (p: Pta) => issueAgainstPta({ ptaReference: p.ptaReference, idempotencyKey: rowOps.key(`issue:${p.ptaReference}`) }),
    onSuccess: ({ ticket, pta }) => {
      rowOps.rotate(`issue:${pta.ptaReference}`);
      toast.success(t("misc.pta.issueOk"), ticket.ticketNumber);
      invalidateRecords(qc);
      navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: ticket.ticketNumber } });
    },
    onError: (e: Error) => toast.danger(t("misc.pta.issueFail"), errText(e)),
  });

  const ack = useMutation({
    mutationFn: (p: Pta) => acknowledgePta({ ptaReference: p.ptaReference, idempotencyKey: rowOps.key(`ack:${p.ptaReference}`) }),
    onSuccess: (p) => { toast.success(t("misc.pta.ackOk"), p.ptaReference); qc.invalidateQueries({ queryKey: ["ptas"] }); },
    onError: (e: Error) => toast.danger(t("misc.pta.ackFail"), errText(e)),
  });

  const refund = useMutation({
    mutationFn: () => refundPta({
      ptaReference: refundFor!.ptaReference,
      usedValue: parseAmount(usedValue) || 0,
      documentType: docType,
      idempotencyKey: refundOp.key(),
    }),
    onSuccess: (p) => {
      refundOp.rotate();
      toast.success(t("misc.pta.refundOk"), `${p.refund?.documentType} ${p.refund?.documentNumber}`);
      setRefundFor(null);
      qc.invalidateQueries({ queryKey: ["ptas"] });
    },
    onError: (e: Error) => toast.danger(t("misc.pta.refundFail"), errText(e)),
  });

  const columns = [
    col.accessor("ptaReference", { header: "PTA Ref", cell: (c) => <span className="num font-medium text-ink">{c.getValue()}</span> }),
    col.accessor("sponsorName", { header: t("misc.pta.col.sponsor"), cell: (c) => <span className="text-ink">{c.getValue()}</span> }),
    col.accessor("beneficiaryName", { header: t("common.passenger"), cell: (c) => <span className="text-ink">{c.getValue()}</span> }),
    col.accessor("route", { header: t("common.route"), cell: (c) => <span className="num text-ink-2">{c.getValue()}</span> }),
    col.accessor("pickupLocation", { header: t("misc.pta.col.pickup"), cell: (c) => <span className="num text-ink-2">{c.getValue()}</span> }),
    col.accessor("createdAt", {
      header: t("misc.pta.col.date"),
      meta: { exportValue: (p: Pta) => formatDate(p.createdAt) },
      cell: (c) => <span className="num text-ink-2">{formatDate(c.getValue())}</span>,
    }),
    col.accessor((p) => p.amount.amount, {
      id: "amount", header: t("misc.pta.col.amount"),
      meta: { align: "right", exportValue: (p: Pta) => csvNumber(p.amount.amount) },
      cell: (c) => <Money value={c.row.original.amount} size="sm" />,
    }),
    col.accessor((p) => p.amount.currency, {
      id: "currency", header: t("misc.pta.col.currency"), meta: { exportOnly: true },
    }),
    col.accessor("status", {
      header: t("common.status"), enableSorting: false,
      meta: { exportValue: (p: Pta) => t(STATUS_KEY[p.status]) },
      cell: (c) => <Pill tone={TONE[c.getValue()]}>{t(STATUS_KEY[c.getValue()])}</Pill>,
    }),
    col.display({
      id: "ack", header: t("misc.pta.col.ack"), enableSorting: false, meta: { label: t("misc.pta.col.ack"), exportSkip: true },
      cell: (c) => c.row.original.acknowledgedAt
        ? <Pill tone="green">{t("misc.pta.acked")}</Pill>
        : <Button size="sm" variant="ghost" disabled={ack.isPending}
            onClick={(e) => { e.stopPropagation(); ack.mutate(c.row.original); }}>{t("misc.pta.ack")}</Button>,
    }),
    col.display({
      id: "act", header: "", meta: { align: "right", label: t("misc.pta.col.action"), exportSkip: true },
      cell: (c) => {
        const p = c.row.original;
        return (
          <span className="flex items-center justify-end gap-1.5">
            {p.status === "open" && (
              <Button size="sm" variant="secondary" disabled={issue.isPending} onClick={(e) => { e.stopPropagation(); issue.mutate(p); }}>{t("misc.pta.toTicket")}</Button>
            )}
            {p.refund ? (
              <span className="num text-[12px] text-ink-3">{p.refund.documentType} {p.refund.documentNumber}</span>
            ) : (
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setRefundFor(p); setUsedValue(p.issuedTicketNumber ? String(p.amount.amount) : "0"); }}>{t("misc.pta.refund")}</Button>
            )}
            {p.issuedTicketNumber && <span className="num text-[12px] text-ink-3">{p.issuedTicketNumber}</span>}
          </span>
        );
      },
    }),
  ] as ColumnDef<Pta, unknown>[];

  return (
    <>
      <PageTitle
        title="PTA (Prepaid Ticket Advice)"
        hint={t("misc.pta.hint")}
        action={<Button onClick={() => setOpen(true)}><Plus size={15} strokeWidth={2} /> {t("misc.pta.new")}</Button>}
      />
      <DataTable data={data ?? []} columns={columns} loading={isLoading} pageSize={12} exportName="pta" empty={{ title: t("misc.pta.empty") }} />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("misc.pta.new")}
        hint={t("misc.pta.newHint")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("misc.discard")}</Button>
            <Button disabled={!form.sponsorName || !form.beneficiaryName || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? t("misc.pta.creating") : t("misc.pta.create")}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("misc.pta.f.sponsor")} required><Input value={form.sponsorName} onChange={(e) => setForm({ ...form, sponsorName: e.target.value })} placeholder="ACME LTD" className="uppercase" /></Field>
          <Field label={t("misc.pta.f.sponsorLocation")}><Input value={form.sponsorLocation} onChange={(e) => setForm({ ...form, sponsorLocation: e.target.value })} maxLength={3} className="uppercase" /></Field>
          <Field label={t("common.passenger")} required><Input value={form.beneficiaryName} onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })} placeholder="ERDOGAN/AHMET" className="uppercase" /></Field>
          <Field label={t("misc.pta.f.pickupLocation")}><Input value={form.pickupLocation} onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })} maxLength={3} className="uppercase" /></Field>
          <Field label={t("common.route")}><Input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} className="uppercase" /></Field>
          <Field label={t("misc.pta.f.amount")}><Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d]/g, "") })} className="num" inputMode="numeric" /></Field>
          <Field label={t("misc.pta.f.currency")}>
            <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {["TRY", "USD", "EUR"].map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label={t("misc.pta.f.fop")}>
            <Select value={form.fop} onChange={(e) => setForm({ ...form, fop: e.target.value as "cash" | "credit" })}>
              <option value="cash">{t("misc.pta.fop.cash")}</option>
              <option value="credit">{t("misc.pta.fop.credit")}</option>
            </Select>
          </Field>
        </div>
      </Modal>

      {/* 9.3 — fazla tahsilat / kısmi kullanım iadesi */}
      <Modal
        open={!!refundFor}
        onClose={() => setRefundFor(null)}
        title={t("misc.pta.refundTitle")}
        hint={t("misc.pta.refundHint")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefundFor(null)}>{t("misc.discard")}</Button>
            <Button variant="success" disabled={refund.isPending} onClick={() => refund.mutate()}>
              {refund.isPending ? t("misc.pta.refundIssuing") : t("misc.pta.refundIssue")}
            </Button>
          </>
        }
      >
        {refundFor && (
          <div className="flex flex-col gap-3">
            <Banner kind="info" title={t("misc.pta.authTitle")}>
              {t("misc.pta.authBody", { office: refundFor.sponsorLocation })}
            </Banner>
            <Field label={t("misc.pta.f.ptaAmount")}>
              <Input value={`${refundFor.amount.amount} ${refundFor.amount.currency}`} readOnly className="num" />
            </Field>
            <Field label={t("misc.pta.f.usedValue")} hint={t("misc.pta.f.usedValueHint")}>
              <Input value={usedValue} onChange={(e) => setUsedValue(e.target.value.replace(/[^\d]/g, ""))} className="num" inputMode="numeric" />
            </Field>
            <Field label={t("misc.pta.f.difference")}>
              <Input value={String(Math.max(0, refundFor.amount.amount - (parseAmount(usedValue) || 0)))} readOnly className="num" />
            </Field>
            <Field label={t("misc.pta.f.docType")}>
              <Select value={docType} onChange={(e) => setDocType(e.target.value as "MCO" | "AgentsRefundVoucher")}>
                <option value="MCO">{t("misc.pta.doc.mco")}</option>
                <option value="AgentsRefundVoucher">{t("misc.pta.doc.voucher")}</option>
              </Select>
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
