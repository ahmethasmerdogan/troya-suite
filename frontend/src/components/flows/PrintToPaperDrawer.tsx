import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Printer, CheckCircle2 } from "lucide-react";
import { printToPaper, newIdempotencyKey, DomainError, type PrintToPaperInput } from "@/domain/api";
import type { Ticket } from "@/domain/types";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// Ch 1.3.3 — Carrier Print to Paper: elektronik kupon kağıda bastırılır → statü P (Printed, FINAL).
// Interline anlaşması yokken / IRROP'ta başka carrier'a teslimde. Geri alınamaz (terminal).
export function PrintToPaperDrawer({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const eligible = ticket.coupons.filter((c) => c.status === "O"); // yalnız O (Handbook 1.3.3)
  const [selected, setSelected] = useState<number[]>(() => eligible.map((c) => c.seq));
  const [reason, setReason] = useState("");
  const [idem] = useState(newIdempotencyKey);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: PrintToPaperInput) => printToPaper(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", ticket.ticketNumber] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Kağıda basıldı", `${selected.length} kupon → P (Printed)`);
      onClose();
    },
    onError: (e) => toast.danger("Baskı başarısız", e instanceof DomainError ? e.message : "Beklenmeyen hata"),
  });

  const toggle = (seq: number) =>
    setSelected((p) => (p.includes(seq) ? p.filter((s) => s !== seq) : [...p, seq]));

  if (!eligible.length) {
    return (
      <Drawer open={open} onClose={onClose} title="Kağıda Bas / Print to Paper" description={ticket.ticketNumber}>
        <p className="text-sm text-secondary">Kağıda basıma uygun kupon (O — Handbook 1.3.3) yok.</p>
      </Drawer>
    );
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Kağıda Bas / Print to Paper"
      description={ticket.ticketNumber}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>İptal</Button>
          <Button
            disabled={!selected.length || mutation.isPending}
            onClick={() => mutation.mutate({ ticketNumber: ticket.ticketNumber, couponSeqs: selected, reason: reason.trim() || undefined, idempotencyKey: idem })}
          >
            <Printer size={16} strokeWidth={1.75} /> {mutation.isPending ? "Basılıyor…" : "Kağıda Bas"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[12px] text-[var(--warning-text)]">
          Kupon kağıda basılınca statü <strong>P (Printed)</strong> olur — <strong>final</strong> statü, geri alınamaz. (Ch 1.3.3: interline yok / IRROP teslim.)
        </div>
        <div>
          <div className="mb-2 text-[13px] text-secondary">Basılacak kupon(lar):</div>
          <div className="flex flex-col gap-2">
            {eligible.map((c) => {
              const on = selected.includes(c.seq);
              return (
                <button
                  key={c.seq}
                  onClick={() => toggle(c.seq)}
                  className={cn(
                    "flex items-center gap-3 rounded border px-3 py-2.5 text-left transition-colors",
                    on ? "border-accent bg-accent-soft" : "border-[var(--border-subtle)] bg-surface-alt hover:bg-sunken",
                  )}
                >
                  <span className={cn("flex h-4 w-4 items-center justify-center rounded-sm border", on ? "border-accent bg-accent text-white" : "border-[var(--border-strong)]")}>
                    {on && <CheckCircle2 size={12} strokeWidth={2.5} />}
                  </span>
                  <span className="font-mono text-[13px] text-primary">#{c.seq} {c.segment.origin}→{c.segment.destination} · {c.segment.flightNumber}</span>
                  <StatusBadge status={c.status} className="ml-auto" />
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Sebep / not (ops.)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="örn. interline anlaşması yok" />
        </Field>
      </div>
    </Drawer>
  );
}
