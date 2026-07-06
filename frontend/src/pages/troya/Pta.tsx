import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Banknote, Plus, ArrowRight, Ticket as TicketIcon } from "lucide-react";
import {
  listPtas, createPta, issueAgainstPta, newIdempotencyKey, DomainError,
  type CreatePtaInput, type IssueAgainstPtaInput,
} from "@/domain/api";
import type { Pta, PtaStatus } from "@/domain/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { Drawer } from "@/components/ui/drawer";
import { Money } from "@/components/domain/Money";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const STATUS_PILL: Record<PtaStatus, { cls: string; label: string }> = {
  open: { cls: "pill--info", label: "Açık" },
  used: { cls: "pill--success", label: "Kullanıldı" },
  refunded: { cls: "pill--neutral", label: "İade" },
  expired: { cls: "pill--warning", label: "Süresi doldu" },
};

// Ch 9 — PTA (Prepaid Ticket Advice): bilet bedeli bir istasyonda ödenir, yolcu
// başka istasyonda bileti alır. Burada PTA oluşturulur ve PTA'ya karşı bilet kesilir.
export function PtaPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: ptas, isLoading } = useQuery({ queryKey: ["ptas"], queryFn: listPtas });

  return (
    <div>
      <PageHeader
        title="PTA — Prepaid Ticket Advice"
        description="Bilet bedeli bir istasyonda/kişi tarafından önceden ödenir; yolcu başka istasyonda bileti alır (Handbook Ch 9)."
        action={<Button onClick={() => setCreateOpen(true)}><Plus size={16} strokeWidth={2} /> Yeni PTA</Button>}
      />

      {isLoading ? (
        <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !ptas?.length ? (
        <Card><CardContent className="py-12 text-center text-sm text-secondary">Henüz PTA yok. "Yeni PTA" ile oluştur.</CardContent></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {ptas.map((p) => <PtaRow key={p.ptaReference} pta={p} />)}
        </div>
      )}

      <CreatePtaDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function PtaRow({ pta }: { pta: Pta }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [idem] = useState(newIdempotencyKey);
  const pill = STATUS_PILL[pta.status];

  const mutation = useMutation({
    mutationFn: (input: IssueAgainstPtaInput) => issueAgainstPta(input),
    onSuccess: ({ ticket }) => {
      qc.invalidateQueries({ queryKey: ["ptas"] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Bilet kesildi", `${ticket.ticketNumber} · ${pta.ptaReference}`);
      navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: ticket.ticketNumber } });
    },
    onError: (e) => toast.danger("Kesim başarısız", e instanceof DomainError ? e.message : "Beklenmeyen hata"),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
            <Banknote size={18} strokeWidth={1.75} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[14px] font-semibold text-primary">{pta.ptaReference}</span>
              <span className={cn("pill", pill.cls)}>{pill.label}</span>
            </div>
            <div className="text-[12px] text-tertiary">
              Sponsor: <span className="text-secondary">{pta.sponsorName}</span> ({pta.sponsorLocation})
            </div>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-3 sm:px-4">
          <Meta label="Yolcu" value={pta.beneficiaryName} />
          <Meta label="Teslim" value={pta.pickupLocation} />
          <Meta label="Güzergah" value={pta.route} />
        </div>

        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <Money value={pta.amount} size="md" />
          {pta.status === "open" ? (
            <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate({ ptaReference: pta.ptaReference, idempotencyKey: idem })}>
              {mutation.isPending ? "Kesiliyor…" : <>Bilete Dönüştür <ArrowRight size={15} strokeWidth={2} /></>}
            </Button>
          ) : pta.issuedTicketNumber ? (
            <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: pta.issuedTicketNumber! } })}>
              <TicketIcon size={15} strokeWidth={1.75} /> Bileti aç
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-disabled">{label}</span>
      <span className="font-mono text-secondary">{value}</span>
    </div>
  );
}

function CreatePtaDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [idem] = useState(newIdempotencyKey);
  const [form, setForm] = useState({
    sponsorName: "",
    sponsorLocation: "IST-CTR",
    beneficiaryName: "",
    pickupLocation: "",
    route: "",
    amount: 0,
    currency: "USD",
    fopType: "credit" as "cash" | "credit",
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const mutation = useMutation({
    mutationFn: (input: CreatePtaInput) => createPta(input),
    onSuccess: (pta) => {
      qc.invalidateQueries({ queryKey: ["ptas"] });
      toast.success("PTA oluşturuldu", pta.ptaReference);
      onClose();
    },
    onError: (e) => toast.danger("PTA oluşturulamadı", e instanceof DomainError ? e.message : "Beklenmeyen hata"),
  });

  const valid = form.sponsorName.trim() && form.beneficiaryName.trim() && form.route.trim() && form.amount > 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Yeni PTA"
      description="Prepaid Ticket Advice oluştur"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>İptal</Button>
          <Button
            disabled={!valid || mutation.isPending}
            onClick={() => mutation.mutate({
              sponsorName: form.sponsorName.trim(),
              sponsorLocation: form.sponsorLocation.trim(),
              beneficiaryName: form.beneficiaryName.trim(),
              pickupLocation: form.pickupLocation.trim(),
              route: form.route.trim(),
              amount: { amount: form.amount, currency: form.currency },
              formOfPayment: { type: form.fopType },
              idempotencyKey: idem,
            })}
          >
            {mutation.isPending ? "Oluşturuluyor…" : "PTA Oluştur"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sponsor (ödeyen)"><Input value={form.sponsorName} onChange={(e) => set({ sponsorName: e.target.value })} placeholder="TROYA HOLDING A.Ş." /></Field>
          <Field label="Ödeme istasyonu"><Input value={form.sponsorLocation} onChange={(e) => set({ sponsorLocation: e.target.value.toUpperCase() })} className="uppercase font-mono" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Yolcu (SOYAD/AD)"><Input value={form.beneficiaryName} onChange={(e) => set({ beneficiaryName: e.target.value.toUpperCase() })} placeholder="DEMIR/CAN" className="uppercase font-mono" /></Field>
          <Field label="Teslim istasyonu"><Input value={form.pickupLocation} onChange={(e) => set({ pickupLocation: e.target.value.toUpperCase() })} placeholder="JFK" className="uppercase font-mono" /></Field>
        </div>
        <Field label="Güzergah" hint='Örn. "JFK → IST"'><Input value={form.route} onChange={(e) => set({ route: e.target.value.toUpperCase() })} placeholder="JFK → IST" className="uppercase font-mono" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tutar"><Input type="number" step="0.01" value={form.amount} onChange={(e) => set({ amount: Number(e.target.value) })} className="font-mono" /></Field>
          <Field label="Para birimi">
            <Select value={form.currency} onChange={(e) => set({ currency: e.target.value })}>
              {["USD", "EUR", "TRY", "GBP", "JPY"].map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Ödeme şekli">
          <Select value={form.fopType} onChange={(e) => set({ fopType: e.target.value as "cash" | "credit" })}>
            <option value="credit">Kredi Kartı</option>
            <option value="cash">Nakit</option>
          </Select>
        </Field>
      </div>
    </Drawer>
  );
}
