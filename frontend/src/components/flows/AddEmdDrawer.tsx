import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addEmd, newIdempotencyKey, DomainError, type AddEmdInput } from "@/domain/api";
import { RFISC_CATALOG } from "@/domain/mockData";
import type { Ticket } from "@/domain/types";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { Money } from "@/components/domain/Money";
import { toast } from "@/components/ui/toast";

// FE-5 EMD ekleme — DESIGN_ROADMAP §3.10. EMD-A (kupona bağlı) / EMD-S; RFISC seçimi.
// initial: fazla bagaj (14.5) gibi ön-ayarlı giriş noktaları için.
export function AddEmdDrawer({
  ticket, open, onClose, initial,
}: {
  ticket: Ticket; open: boolean; onClose: () => void;
  initial?: { type?: "A" | "S"; rfisc?: string; title?: string };
}) {
  const [type, setType] = useState<"A" | "S">(initial?.type ?? "A");
  const [couponSeq, setCouponSeq] = useState<number>(ticket.coupons[0]?.seq ?? 1);
  const [rfisc, setRfisc] = useState(initial?.rfisc ?? RFISC_CATALOG[0].rfisc);
  const [amount, setAmount] = useState<number>(0);
  const currency = ticket.fare.total.currency;
  const [idem] = useState(newIdempotencyKey);
  const qc = useQueryClient();

  const selectedRfisc = RFISC_CATALOG.find((r) => r.rfisc === rfisc)!;

  const mutation = useMutation({
    mutationFn: (input: AddEmdInput) => addEmd(input),
    onSuccess: (emd) => {
      qc.invalidateQueries({ queryKey: ["emds", ticket.ticketNumber] });
      qc.invalidateQueries({ queryKey: ["ticket", ticket.ticketNumber] });
      toast.success("EMD kesildi", `${emd.emdNumber} · EMD-${emd.type}`);
      onClose();
    },
    onError: (e) => toast.danger("EMD kesilemedi", e instanceof DomainError ? e.message : "Beklenmeyen hata"),
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={initial?.title ?? "EMD / Ancillary Ekle"}
      description={`Bilet ${ticket.ticketNumber}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>İptal</Button>
          <Button
            disabled={mutation.isPending || amount <= 0}
            onClick={() => mutation.mutate({ ticketNumber: ticket.ticketNumber, type, couponSeq: type === "A" ? couponSeq : undefined, rfisc, description: selectedRfisc.label, value: { amount, currency }, idempotencyKey: idem })}
          >
            {mutation.isPending ? "Kesiliyor…" : "EMD Kes"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Tip">
          <div className="flex gap-2">
            {(["A", "S"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 rounded border px-3 py-2 text-[13px] transition-colors ${type === t ? "border-accent bg-accent-soft text-accent" : "border-border-default text-secondary hover:bg-sunken"}`}
              >
                EMD-{t} <span className="text-tertiary">{t === "A" ? "· kupona bağlı" : "· standalone"}</span>
              </button>
            ))}
          </div>
        </Field>

        {type === "A" && (
          <Field label="Bağlı kupon">
            <Select value={couponSeq} onChange={(e) => setCouponSeq(Number(e.target.value))}>
              {ticket.coupons.map((c) => (
                <option key={c.seq} value={c.seq}>#{c.seq} — {c.segment.origin}→{c.segment.destination}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="RFISC (Reason For Issuance Sub-Code)">
          <Select value={rfisc} onChange={(e) => setRfisc(e.target.value)}>
            {RFISC_CATALOG.map((r) => (
              <option key={r.rfisc} value={r.rfisc}>{r.rfisc} · {r.label}</option>
            ))}
          </Select>
        </Field>

        <Field label={`Tutar (${currency})`}>
          <DecimalInput value={amount} onChange={(n) => setAmount(n ?? 0)} className="font-mono" fxCurrency={currency} />
        </Field>

        <div className="flex items-center justify-between rounded bg-sunken p-3">
          <span className="text-sm text-secondary">EMD değeri</span>
          <Money value={{ amount, currency }} size="md" />
        </div>
      </div>
    </Drawer>
  );
}
