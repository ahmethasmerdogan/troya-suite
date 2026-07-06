import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { irropReroute, newIdempotencyKey, DomainError, type IrropInput } from "@/domain/api";
import type { Ticket } from "@/domain/types";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { ConfirmDestructive } from "@/components/domain/ConfirmDestructive";
import { toast } from "@/components/ui/toast";

// Ch 13 — IRROP / Involuntary Rerouting + FIM. Aksayan kupon(lar) → I → G; başka
// carrier'a ciro; Flight Interruption Manifest üretilir. Kasıtlı: ihtiyari değil.
const REASONS = [
  { id: "weather", label: "Hava muhalefeti" },
  { id: "technical", label: "Teknik arıza" },
  { id: "atc", label: "ATC / slot" },
  { id: "strike", label: "Grev" },
  { id: "cancellation", label: "Uçuş iptali" },
];

export function IrropDrawer({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const eligible = ticket.coupons.filter((c) => ["O", "A", "I"].includes(c.status));
  const [selected, setSelected] = useState<number[]>(() => eligible.map((c) => c.seq));
  const [reason, setReason] = useState(REASONS[0].label);
  const [endorseTo, setEndorseTo] = useState("LH");
  const [flightNumber, setFlightNumber] = useState("440");
  const [confirm, setConfirm] = useState(false);
  const [idem] = useState(newIdempotencyKey);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: IrropInput) => irropReroute(input),
    onSuccess: ({ fim }) => {
      qc.invalidateQueries({ queryKey: ["ticket", ticket.ticketNumber] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("IRROP uygulandı", `FIM ${fim} · kupon(lar) → G`);
      onClose();
    },
    onError: (e) => toast.danger("IRROP başarısız", e instanceof DomainError ? e.message : "Beklenmeyen hata"),
  });

  const toggle = (seq: number) =>
    setSelected((prev) => (prev.includes(seq) ? prev.filter((s) => s !== seq) : [...prev, seq]));

  if (!eligible.length) {
    return (
      <Drawer open={open} onClose={onClose} title="IRROP / Yeniden Yönlendirme" description={ticket.ticketNumber}>
        <p className="text-sm text-secondary">IRROP için uygun kupon (O/A/I) yok.</p>
      </Drawer>
    );
  }

  const submit = () =>
    mutation.mutate({
      ticketNumber: ticket.ticketNumber,
      couponSeqs: selected,
      reason,
      endorseTo: endorseTo.toUpperCase(),
      newFlight: { carrier: endorseTo.toUpperCase(), flightNumber, date: new Date().toISOString() },
      idempotencyKey: idem,
    });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="IRROP / Involuntary Rerouting"
      description={`Bilet ${ticket.ticketNumber}`}
      width="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={confirm ? () => setConfirm(false) : onClose} disabled={mutation.isPending}>
            {confirm ? "Geri" : "İptal"}
          </Button>
          {confirm ? (
            <Button variant="danger" onClick={submit} disabled={mutation.isPending}>
              {mutation.isPending ? "İşleniyor…" : "FIM Üret ve Yönlendir"}
            </Button>
          ) : (
            <Button onClick={() => setConfirm(true)} disabled={!selected.length}>Devam</Button>
          )}
        </div>
      }
    >
      {!confirm ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded border border-[var(--warning-bg)] bg-[var(--warning-bg)] px-3 py-2.5 text-[12px] text-[var(--warning-text)]">
            <AlertTriangle size={15} strokeWidth={2} className="mt-0.5 flex-shrink-0" />
            <span>Olağandışı operasyon (carrier kaynaklı). Kuponlar <span className="font-mono">I</span> → <span className="font-mono">G</span> (FIM) olur ve başka carrier'a ciro edilir.</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[13px] text-secondary">Aksayan kupon(lar):</div>
            {eligible.map((c) => (
              <label key={c.seq} className="flex cursor-pointer items-center gap-3 rounded border border-[var(--border-subtle)] bg-surface-alt px-3 py-2.5">
                <input type="checkbox" checked={selected.includes(c.seq)} onChange={() => toggle(c.seq)} className="accent-[var(--accent)]" />
                <span className="font-mono text-[13px] text-primary">#{c.seq} {c.segment.origin}→{c.segment.destination} · {c.segment.marketingCarrier}{c.segment.flightNumber.replace(/^\D+/, "")}</span>
                <StatusBadge status={c.status} className="ml-auto" />
              </label>
            ))}
          </div>

          <Field label="Sebep">
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => <option key={r.id} value={r.label}>{r.label}</option>)}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ciro edilen carrier" hint="Reaccommodating carrier">
              <Input value={endorseTo} onChange={(e) => setEndorseTo(e.target.value.toUpperCase())} className="uppercase font-mono" maxLength={3} />
            </Field>
            <Field label="Yeni uçuş no">
              <Input value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} className="font-mono" />
            </Field>
          </div>
        </div>
      ) : (
        <ConfirmDestructive
          summary={
            <div className="flex flex-col gap-2">
              <Row label="Kuponlar" value={`${selected.map((s) => `#${s}`).join(", ")} → I → G`} />
              <Row label="Sebep" value={reason} />
              <Row label="Ciro / yeni uçuş" value={`${endorseTo.toUpperCase()} ${endorseTo.toUpperCase()}${flightNumber}`} />
              <div className="border-t border-[var(--border-subtle)] pt-2 text-[12px] text-tertiary">
                FIM (Flight Interruption Manifest) referansı üretilir; geçiş geri alınamaz (G final).
              </div>
            </div>
          }
        />
      )}
    </Drawer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-secondary">{label}</span>
      <span className="font-mono text-[13px] text-primary">{value}</span>
    </div>
  );
}
