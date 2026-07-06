import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ArrowRight } from "lucide-react";
import { revalidateCoupon, newIdempotencyKey, DomainError, type RevalidateInput } from "@/domain/api";
import type { Ticket } from "@/domain/types";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { toast } from "@/components/ui/toast";

// Ch 1.3.1 / 12.3 — Revalidation (Reservations Change): uçuş/saat güncellenir, rota/fiyat değişmez,
// reissue YOK, statü O kalır. Exchange'e göre hafif işlem.
export function RevalidationDrawer({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const eligible = ticket.coupons.filter((c) => c.status === "O" || c.status === "A");
  const [seq, setSeq] = useState<number>(() => eligible[0]?.seq ?? 1);
  const coupon = ticket.coupons.find((c) => c.seq === seq) ?? eligible[0];
  const [flightNumber, setFlightNumber] = useState(() => coupon?.segment.flightNumber ?? "");
  const [departure, setDeparture] = useState(() => coupon?.segment.departure ?? "");
  const [idem] = useState(newIdempotencyKey);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: RevalidateInput) => revalidateCoupon(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", ticket.ticketNumber] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Revalidation tamam", `Kupon #${seq} yeni uçuşla güncellendi`);
      onClose();
    },
    onError: (e) => toast.danger("Revalidation başarısız", e instanceof DomainError ? e.message : "Beklenmeyen hata"),
  });

  if (!eligible.length) {
    return (
      <Drawer open={open} onClose={onClose} title="Revalidation / Uçuş Değişikliği" description={ticket.ticketNumber}>
        <p className="text-sm text-secondary">Revalidation için uygun kupon (O/A) yok.</p>
      </Drawer>
    );
  }

  const submit = () =>
    mutation.mutate({ ticketNumber: ticket.ticketNumber, couponSeq: seq, newFlightNumber: flightNumber, newDeparture: departure, idempotencyKey: idem });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Revalidation / Uçuş Değişikliği"
      description={ticket.ticketNumber}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>İptal</Button>
          <Button onClick={submit} disabled={mutation.isPending || !flightNumber.trim() || !departure}>
            <CalendarClock size={16} strokeWidth={1.75} /> {mutation.isPending ? "İşleniyor…" : "Revalidate Et"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-[var(--border-subtle)] bg-surface-alt px-3 py-2 text-[12px] text-secondary">
          Rota ve fiyat <strong className="text-primary">değişmez</strong>; yalnızca uçuş no/tarih güncellenir, yeni bilet kesilmez. Statü <span className="font-mono">O</span> kalır. Rota/fiyat değişecekse <strong className="text-primary">Exchange</strong> kullanın.
        </div>

        <Field label="Kupon">
          <Select value={seq} onChange={(e) => {
            const ns = Number(e.target.value);
            setSeq(ns);
            const c = ticket.coupons.find((x) => x.seq === ns);
            if (c) { setFlightNumber(c.segment.flightNumber); setDeparture(c.segment.departure); }
          }}>
            {eligible.map((c) => (
              <option key={c.seq} value={c.seq}>#{c.seq} — {c.segment.origin}→{c.segment.destination} ({c.status})</option>
            ))}
          </Select>
        </Field>

        {coupon && (
          <div className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2 font-mono text-[13px] text-secondary">
            {coupon.segment.origin} <ArrowRight size={13} className="text-tertiary" /> {coupon.segment.destination}
            <StatusBadge status={coupon.status} className="ml-auto" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Yeni uçuş no">
            <Input value={flightNumber} onChange={(e) => setFlightNumber(e.target.value.toUpperCase())} placeholder="TK1982" className="font-mono uppercase" />
          </Field>
          <Field label="Yeni kalkış">
            <Input type="datetime-local" defaultValue={toLocalInput(departure)} onChange={(e) => {
              // Boş/geçersiz datetime new Date().toISOString()'i patlatır — yoksay (exchange bug dersi).
              const v = e.target.value;
              if (!v) return;
              const dt = new Date(v);
              if (Number.isNaN(dt.getTime())) return;
              setDeparture(dt.toISOString());
            }} />
          </Field>
        </div>
      </div>
    </Drawer>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
