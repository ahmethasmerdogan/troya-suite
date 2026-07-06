import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban } from "lucide-react";
import { voidTicket, newIdempotencyKey, DomainError, type VoidInput } from "@/domain/api";
import type { Ticket } from "@/domain/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { ConfirmDestructive } from "@/components/domain/ConfirmDestructive";
import { toast } from "@/components/ui/toast";

// FE-3 Void — DESIGN_ROADMAP §3.8. Ön koşul: TÜM kuponlar O. Değilse engelle + sebep göster.
export function VoidModal({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const blocking = ticket.coupons.filter((c) => c.status !== "O");
  const canVoid = blocking.length === 0;
  const [reason, setReason] = useState("");
  const [idem] = useState(newIdempotencyKey);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: VoidInput) => voidTicket(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", ticket.ticketNumber] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Bilet void edildi", `${ticket.ticketNumber} · tüm kuponlar → V`);
      onClose();
    },
    onError: (e) => toast.danger("Void başarısız", e instanceof DomainError ? e.message : "Beklenmeyen hata"),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Void — Satışı İptal Et"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>İptal</Button>
          <Button
            variant="danger"
            disabled={!canVoid || mutation.isPending}
            onClick={() => mutation.mutate({ ticketNumber: ticket.ticketNumber, reason, idempotencyKey: idem })}
          >
            <Ban size={16} strokeWidth={1.75} /> {mutation.isPending ? "İşleniyor…" : "Void Onayla"}
          </Button>
        </>
      }
    >
      {!canVoid ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-secondary">Void için <strong className="text-primary">tüm kuponlar 'O'</strong> (Open For Use) olmalı. Aşağıdaki kupon(lar) buna engel:</p>
          <div className="flex flex-col gap-2">
            {blocking.map((c) => (
              <div key={c.seq} className="flex items-center gap-3 rounded border border-[var(--border-subtle)] bg-surface-alt px-3 py-2">
                <span className="font-mono text-[13px] text-primary">#{c.seq} {c.segment.origin}→{c.segment.destination}</span>
                <StatusBadge status={c.status} className="ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ConfirmDestructive
            summary={<span>Bilet <span className="font-mono">{ticket.ticketNumber}</span> · {ticket.coupons.length} kupon → <span className="font-mono">V</span> (Void). Satış kaydı iptal edilir.</span>}
          />
          <Field label="Sebep (opsiyonel)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn. yanlış kesim" />
          </Field>
        </div>
      )}
    </Modal>
  );
}
