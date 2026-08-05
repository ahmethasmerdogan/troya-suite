import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { acknowledgePta, createPta, issueAgainstPta, listPtas, newIdempotencyKey, refundPta } from "@/domain/api";
import type { Pta } from "@/domain/types";
import { Money } from "@/components/domain/Money";
import { Banner } from "@/components/ui/banner";
import { Button, Field, Input, Select } from "@/components/ui/core";
import { PageTitle } from "@/components/ui/surface";
import { DataTable } from "@/components/ui/table";
import { Modal } from "@/components/ui/overlay";
import { Pill, type Tone } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { csvNumber } from "@/lib/csv";
import { formatDate } from "@/lib/utils";

/**
 * PTA — Prepaid Ticket Advice (Handbook Ch 9).
 * Bilet bedeli bir istasyonda ödenir, yolcu bileti başka istasyonda alır.
 */
const TONE: Record<Pta["status"], Tone> = { open: "blue", used: "green", refunded: "pink", expired: "gray" };
const col = createColumnHelper<Pta>();

export function PtaPage() {
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

  const create = useMutation({
    mutationFn: () => createPta({
      sponsorName: form.sponsorName, sponsorLocation: form.sponsorLocation,
      beneficiaryName: form.beneficiaryName, pickupLocation: form.pickupLocation,
      route: form.route, amount: { amount: Number(form.amount), currency: form.currency },
      formOfPayment: { type: form.fop },
      idempotencyKey: newIdempotencyKey(),
    }),
    onSuccess: (p) => {
      toast.success("PTA oluşturuldu", p.ptaReference);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["ptas"] });
    },
    onError: (e: Error) => toast.danger("PTA oluşturulamadı", e.message),
  });

  const issue = useMutation({
    mutationFn: (p: Pta) => issueAgainstPta({ ptaReference: p.ptaReference, idempotencyKey: newIdempotencyKey() }),
    onSuccess: ({ ticket }) => {
      toast.success("PTA'ya karşı bilet kesildi", ticket.ticketNumber);
      qc.invalidateQueries({ queryKey: ["ptas"] });
      navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: ticket.ticketNumber } });
    },
    onError: (e: Error) => toast.danger("Kesilemedi", e.message),
  });

  const ack = useMutation({
    mutationFn: (p: Pta) => acknowledgePta({ ptaReference: p.ptaReference, idempotencyKey: newIdempotencyKey() }),
    onSuccess: (p) => { toast.success("PTA teslim alındı", p.ptaReference); qc.invalidateQueries({ queryKey: ["ptas"] }); },
    onError: (e: Error) => toast.danger("İşaretlenemedi", e.message),
  });

  const refund = useMutation({
    mutationFn: () => refundPta({
      ptaReference: refundFor!.ptaReference,
      usedValue: Number(usedValue) || 0,
      documentType: docType,
      idempotencyKey: newIdempotencyKey(),
    }),
    onSuccess: (p) => {
      toast.success("İade belgesi düzenlendi", `${p.refund?.documentType} ${p.refund?.documentNumber}`);
      setRefundFor(null);
      qc.invalidateQueries({ queryKey: ["ptas"] });
    },
    onError: (e: Error) => toast.danger("İade edilemedi", e.message),
  });

  const columns = [
    col.accessor("ptaReference", { header: "PTA Ref", cell: (c) => <span className="num font-medium text-ink">{c.getValue()}</span> }),
    col.accessor("sponsorName", { header: "Ödeyen", cell: (c) => <span className="text-ink">{c.getValue()}</span> }),
    col.accessor("beneficiaryName", { header: "Yolcu", cell: (c) => <span className="text-ink">{c.getValue()}</span> }),
    col.accessor("route", { header: "Güzergah", cell: (c) => <span className="num text-ink-2">{c.getValue()}</span> }),
    col.accessor("pickupLocation", { header: "Teslim", cell: (c) => <span className="num text-ink-2">{c.getValue()}</span> }),
    col.accessor("createdAt", {
      header: "Tarih",
      meta: { exportValue: (p: Pta) => formatDate(p.createdAt) },
      cell: (c) => <span className="num text-ink-2">{formatDate(c.getValue())}</span>,
    }),
    col.accessor((p) => p.amount.amount, {
      id: "amount", header: "Tutar",
      meta: { align: "right", exportValue: (p: Pta) => csvNumber(p.amount.amount) },
      cell: (c) => <Money value={c.row.original.amount} size="sm" />,
    }),
    col.accessor((p) => p.amount.currency, {
      id: "currency", header: "Para Birimi", meta: { exportOnly: true },
    }),
    col.accessor("status", { header: "Durum", enableSorting: false, cell: (c) => <Pill tone={TONE[c.getValue()]}>{c.getValue()}</Pill> }),
    col.display({
      id: "ack", header: "Teslim", enableSorting: false, meta: { label: "Teslim", exportSkip: true },
      cell: (c) => c.row.original.acknowledgedAt
        ? <Pill tone="green">Teslim alındı</Pill>
        : <Button size="sm" variant="ghost" disabled={ack.isPending}
            onClick={(e) => { e.stopPropagation(); ack.mutate(c.row.original); }}>Teslim al</Button>,
    }),
    col.display({
      id: "act", header: "", meta: { align: "right", label: "İşlem", exportSkip: true },
      cell: (c) => {
        const p = c.row.original;
        return (
          <span className="flex items-center justify-end gap-1.5">
            {p.status === "open" && (
              <Button size="sm" variant="secondary" disabled={issue.isPending} onClick={(e) => { e.stopPropagation(); issue.mutate(p); }}>Bilete çevir</Button>
            )}
            {p.refund ? (
              <span className="num text-[12px] text-ink-3">{p.refund.documentType} {p.refund.documentNumber}</span>
            ) : (
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setRefundFor(p); setUsedValue(p.issuedTicketNumber ? String(p.amount.amount) : "0"); }}>İade</Button>
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
        hint="Bilet bedeli bir istasyonda ödenir, yolcu bileti başka istasyonda teslim alır (Handbook Ch 9)."
        action={<Button onClick={() => setOpen(true)}><Plus size={15} strokeWidth={2} /> Yeni PTA</Button>}
      />
      <DataTable data={data ?? []} columns={columns} loading={isLoading} pageSize={12} exportName="pta" empty={{ title: "PTA kaydı yok" }} />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Yeni PTA"
        hint="Ödeyen taraf ve teslim istasyonu bilgileriyle ön ödemeli bilet talimatı."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button disabled={!form.sponsorName || !form.beneficiaryName || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Oluşturuluyor…" : "Oluştur"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ödeyen (sponsor)" required><Input value={form.sponsorName} onChange={(e) => setForm({ ...form, sponsorName: e.target.value })} placeholder="ACME LTD" className="uppercase" /></Field>
          <Field label="Ödeme istasyonu"><Input value={form.sponsorLocation} onChange={(e) => setForm({ ...form, sponsorLocation: e.target.value })} maxLength={3} className="uppercase" /></Field>
          <Field label="Yolcu" required><Input value={form.beneficiaryName} onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })} placeholder="ERDOGAN/AHMET" className="uppercase" /></Field>
          <Field label="Teslim istasyonu"><Input value={form.pickupLocation} onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })} maxLength={3} className="uppercase" /></Field>
          <Field label="Güzergah"><Input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} className="uppercase" /></Field>
          <Field label="Tutar"><Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d]/g, "") })} className="num" inputMode="numeric" /></Field>
          <Field label="Para birimi">
            <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {["TRY", "USD", "EUR"].map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Ödeme şekli">
            <Select value={form.fop} onChange={(e) => setForm({ ...form, fop: e.target.value as "cash" | "credit" })}>
              <option value="cash">Nakit</option>
              <option value="credit">Kredi Kartı</option>
            </Select>
          </Field>
        </div>
      </Modal>

      {/* 9.3 — fazla tahsilat / kısmi kullanım iadesi */}
      <Modal
        open={!!refundFor}
        onClose={() => setRefundFor(null)}
        title="PTA iadesi"
        hint="Fazla tahsilat ya da kısmi kullanımda fark, orijinal ödeme para biriminde iade edilir (Handbook 9.3)."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefundFor(null)}>Vazgeç</Button>
            <Button variant="success" disabled={refund.isPending} onClick={() => refund.mutate()}>
              {refund.isPending ? "Düzenleniyor…" : "İade belgesini düzenle"}
            </Button>
          </>
        }
      >
        {refundFor && (
          <div className="flex flex-col gap-3">
            <Banner kind="info" title="Belge ve yetki">
              Havayolu <b>MCO</b> (ya da MCO olarak düzenlenmiş MPD) keser; bileti acente kesmişse
              <b> Agents Refund Voucher</b> düzenlenir — acente hiçbir koşulda MCO kesemez. Fark için
              satan ofise ({refundFor.sponsorLocation}) refund authority iletilir.
            </Banner>
            <Field label="PTA tutarı">
              <Input value={`${refundFor.amount.amount} ${refundFor.amount.currency}`} readOnly className="num" />
            </Field>
            <Field label="Kullanılan değer" hint="Hiç kullanılmadıysa 0 bırakın.">
              <Input value={usedValue} onChange={(e) => setUsedValue(e.target.value.replace(/[^\d]/g, ""))} className="num" inputMode="numeric" />
            </Field>
            <Field label="İade edilecek fark">
              <Input value={String(Math.max(0, refundFor.amount.amount - (Number(usedValue) || 0)))} readOnly className="num" />
            </Field>
            <Field label="Belge tipi">
              <Select value={docType} onChange={(e) => setDocType(e.target.value as "MCO" | "AgentsRefundVoucher")}>
                <option value="MCO">MCO (havayolu)</option>
                <option value="AgentsRefundVoucher">Agents Refund Voucher (acente)</option>
              </Select>
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
