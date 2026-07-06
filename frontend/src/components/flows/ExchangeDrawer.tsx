import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { exchangeTicket, newIdempotencyKey, DomainError, type ExchangeInput } from "@/domain/api";
import type { Ticket, Segment } from "@/domain/types";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Field } from "@/components/ui/label";
import { Money } from "@/components/domain/Money";
import { ConfirmDestructive } from "@/components/domain/ConfirmDestructive";
import { toast } from "@/components/ui/toast";

// FE-3 Exchange/Reissue — DESIGN_ROADMAP §3.6. Eski açık kuponlar → E, yeni TKT, linkage.
export function ExchangeDrawer({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const openCoupons = ticket.coupons.filter((c) => c.status === "O");
  const [segments, setSegments] = useState<Segment[]>(() => openCoupons.map((c) => ({ ...c.segment })));
  const [adc, setAdc] = useState<number>(0);
  const [confirm, setConfirm] = useState(false);
  const [idem] = useState(newIdempotencyKey);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: ExchangeInput) => exchangeTicket(input),
    onSuccess: ({ newTicket }) => {
      qc.invalidateQueries({ queryKey: ["ticket", ticket.ticketNumber] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Exchange tamamlandı", `Yeni bilet ${newTicket.ticketNumber}`);
      onClose();
      navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: newTicket.ticketNumber } });
    },
    onError: (e) => toast.danger("Exchange başarısız", e instanceof DomainError ? e.message : "Beklenmeyen hata"),
  });

  const updateSeg = (i: number, patch: Partial<Segment>) =>
    setSegments((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const currency = ticket.fare.total.currency;
  const newTotal = ticket.fare.total.amount + adc;

  if (!openCoupons.length) {
    return (
      <Drawer open={open} onClose={onClose} title="Exchange / Reissue" description={ticket.ticketNumber}>
        <p className="text-sm text-secondary">Değişim için 'O' (Open For Use) statüde kupon yok.</p>
      </Drawer>
    );
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Exchange / Reissue"
      description={`Eski bilet ${ticket.ticketNumber}`}
      width="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={confirm ? () => setConfirm(false) : onClose} disabled={mutation.isPending}>
            {confirm ? "Geri" : "İptal"}
          </Button>
          {confirm ? (
            <Button onClick={() => mutation.mutate({ oldTicketNumber: ticket.ticketNumber, newSegments: segments, adc: { amount: adc, currency }, idempotencyKey: idem })} disabled={mutation.isPending}>
              {mutation.isPending ? "İşleniyor…" : "Onayla ve Kes"}
            </Button>
          ) : (
            <Button onClick={() => setConfirm(true)}>Devam</Button>
          )}
        </div>
      }
    >
      {!confirm ? (
        <div className="flex flex-col gap-4">
          <div className="text-[13px] text-secondary">Eski açık kuponlar <span className="font-mono">E</span> (Exchanged) olur; yeni bilet aşağıdaki segmentlerle kesilir.</div>
          {segments.map((s, i) => (
            <div key={i} className="rounded border border-[var(--border-subtle)] bg-surface-alt p-3">
              <div className="mb-2 flex items-center gap-2 font-mono text-[13px] text-primary">
                {s.origin} <ArrowRight size={13} className="text-tertiary" /> {s.destination} · {s.marketingCarrier}{s.flightNumber.replace(/^\D+/, "")}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Yeni kalkış">
                  <Input type="datetime-local" defaultValue={toLocalInput(s.departure)} onChange={(e) => {
                    // Boş/yarım datetime-local değeri new Date(...).toISOString()'i patlatır (Invalid time value).
                    // Geçersizse eski kalkışı koru — drawer takılmaz, mutation güvenli çalışır.
                    const v = e.target.value;
                    if (!v) return;
                    const d = new Date(v);
                    if (Number.isNaN(d.getTime())) return;
                    updateSeg(i, { departure: d.toISOString() });
                  }} />
                </Field>
                <Field label="Fare Basis">
                  <Input defaultValue={s.fareBasis} onChange={(e) => updateSeg(i, { fareBasis: e.target.value.toUpperCase() })} className="uppercase" />
                </Field>
              </div>
            </div>
          ))}
          <Field label={`Fare farkı / ADC (${currency})`} hint="Pozitif = ek tahsilat, negatif = residual (EMD-S'e)">
            <DecimalInput value={adc} onChange={(n) => setAdc(n ?? 0)} allowNegative className="font-mono" fxCurrency={currency} />
          </Field>
          <div className="flex items-center justify-between rounded bg-sunken p-3">
            <span className="text-sm text-secondary">Fare farkı</span>
            <Money value={{ amount: adc, currency }} size="md" signed tone={adc < 0 ? "delta-out" : adc > 0 ? "delta-in" : "default"} />
          </div>
        </div>
      ) : (
        <ConfirmDestructive
          summary={
            <div className="flex flex-col gap-2">
              <Line label="Eski bilet" value={`${ticket.ticketNumber} · kupon(lar) → E`} />
              <Line label="Yeni güzergah" value={[segments[0].origin, ...segments.map((s) => s.destination)].join(" → ")} />
              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2">
                <span className="text-secondary">Yeni toplam</span>
                <Money value={{ amount: newTotal, currency }} size="md" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-secondary">Bu işlemde tahsil/iade</span>
                <Money value={{ amount: adc, currency }} size="md" signed tone={adc < 0 ? "delta-out" : "delta-in"} />
              </div>
            </div>
          }
        />
      )}
    </Drawer>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-secondary">{label}</span>
      <span className="font-mono text-[13px] text-primary">{value}</span>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
