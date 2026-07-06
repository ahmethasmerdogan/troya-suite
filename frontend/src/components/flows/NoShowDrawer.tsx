import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserX, ArrowLeftRight, Undo2, CheckCircle2 } from "lucide-react";
import { markNoShow, newIdempotencyKey, DomainError, type NoShowInput } from "@/domain/api";
import type { Ticket } from "@/domain/types";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// Ch 13 — No-show (yolcu uçuşa gelmedi). Kupon(lar) işaretlenir; statü O kalır.
// Ardından operasyonel adım: yeniden rezervasyon (exchange) veya iade (refund).
export function NoShowDrawer({
  ticket, open, onClose, onNext,
}: {
  ticket: Ticket; open: boolean; onClose: () => void;
  onNext: (flow: "exchange" | "refund") => void;
}) {
  const eligible = ticket.coupons.filter((c) => (c.status === "O" || c.status === "A") && !c.noShow);
  const [selected, setSelected] = useState<number[]>(() => eligible.map((c) => c.seq));
  const [idem] = useState(newIdempotencyKey);
  const [done, setDone] = useState(false);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: NoShowInput) => markNoShow(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", ticket.ticketNumber] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("No-show işlendi", `${selected.length} kupon işaretlendi`);
      setDone(true);
    },
    onError: (e) => toast.danger("No-show başarısız", e instanceof DomainError ? e.message : "Beklenmeyen hata"),
  });

  const toggle = (seq: number) =>
    setSelected((p) => (p.includes(seq) ? p.filter((s) => s !== seq) : [...p, seq]));

  const goNext = (flow: "exchange" | "refund") => { onClose(); onNext(flow); };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="No-show — Yolcu Uçuşa Gelmedi"
      description={ticket.ticketNumber}
      footer={
        done ? (
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Kapat</Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>İptal</Button>
            <Button
              disabled={!selected.length || mutation.isPending || !eligible.length}
              onClick={() => mutation.mutate({ ticketNumber: ticket.ticketNumber, couponSeqs: selected, idempotencyKey: idem })}
            >
              <UserX size={16} strokeWidth={1.75} /> {mutation.isPending ? "İşleniyor…" : "No-show İşaretle"}
            </Button>
          </div>
        )
      }
    >
      {!eligible.length && !done ? (
        <p className="text-sm text-secondary">No-show için uygun kupon (O/A, henüz işaretlenmemiş) yok.</p>
      ) : done ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-md border border-[var(--success-border)] bg-[var(--success-bg)] p-3">
            <CheckCircle2 size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--success-text)]" />
            <div className="text-[13px] text-[var(--success-text)]">
              Kupon(lar) no-show olarak işaretlendi. Statü <strong>O</strong> kaldı — fare kuralına göre
              yeniden rezervasyon veya iade yapılabilir.
            </div>
          </div>
          <div className="text-[12px] font-medium uppercase tracking-[0.06em] text-secondary">Sonraki adım</div>
          <button onClick={() => goNext("exchange")} className="group flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-surface px-3 py-3 text-left transition-all hover:border-accent hover:bg-surface-alt">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><ArrowLeftRight size={17} strokeWidth={1.75} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-primary">Yeniden rezervasyon</div>
              <div className="text-[12px] text-tertiary">Exchange / reissue ile yeni uçuşa al (fark ücreti hesaplanır).</div>
            </div>
          </button>
          <button onClick={() => goNext("refund")} className="group flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-surface px-3 py-3 text-left transition-all hover:border-accent hover:bg-surface-alt">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Undo2 size={17} strokeWidth={1.75} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-primary">İade (refund)</div>
              <div className="text-[12px] text-tertiary">Fare kuralına göre iade değerlendir (no-show cezası uygulanabilir).</div>
            </div>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-secondary">Yolcunun gelmediği kupon(lar)ı seçin:</p>
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
      )}
    </Drawer>
  );
}
