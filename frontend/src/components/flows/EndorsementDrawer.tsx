import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { endorseTicket, newIdempotencyKey, DomainError, type EndorseInput } from "@/domain/api";
import type { Ticket } from "@/domain/types";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

// 2.19 / 12.2 — Endorsements/Restrictions. Ciro notu + opsiyonel carrier devri.
const PRESETS = [
  "NON-ENDORSABLE",
  "NON-REFUNDABLE",
  "CHANGES NOT PERMITTED",
  "VALID ON TK ONLY",
];

export function EndorsementDrawer({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const [endorsement, setEndorsement] = useState(ticket.endorsement ?? "");
  const [carrier, setCarrier] = useState("");
  const [idem] = useState(newIdempotencyKey);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: EndorseInput) => endorseTicket(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", ticket.ticketNumber] });
      toast.success("Endorsement uygulandı", carrier ? `${carrier.toUpperCase()}'a ciro notu eklendi` : "Kısıtlama notu eklendi");
      onClose();
    },
    onError: (e) => toast.danger("Endorsement başarısız", e instanceof DomainError ? e.message : "Beklenmeyen hata"),
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Endorsement / Restrictions"
      description={`Bilet ${ticket.ticketNumber}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>İptal</Button>
          <Button
            disabled={mutation.isPending || !endorsement.trim()}
            onClick={() => mutation.mutate({ ticketNumber: ticket.ticketNumber, endorsement: endorsement.trim().toUpperCase(), endorseToCarrier: carrier.trim() ? carrier.trim().toUpperCase() : undefined, idempotencyKey: idem })}
          >
            {mutation.isPending ? "Uygulanıyor…" : "Uygula"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="text-[13px] text-secondary">"Endorsements/Restrictions" kutusu (Handbook 2.19). Kuponun kullanım/ciro kısıtlamalarını yazar.</div>

        <Field label="Endorsement / kısıtlama metni">
          <Input value={endorsement} onChange={(e) => setEndorsement(e.target.value.toUpperCase())} placeholder="NON-ENDORSABLE" className="uppercase font-mono" />
        </Field>

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setEndorsement(p)} className="rounded-pill border border-[var(--border-subtle)] bg-surface-alt px-2.5 py-1 font-mono text-[11px] text-secondary transition-colors hover:bg-sunken hover:text-primary">
              {p}
            </button>
          ))}
        </div>

        <Field label="Carrier'a ciro (opsiyonel)" hint="Boş bırakılırsa yalnızca kısıtlama notu eklenir">
          <Input value={carrier} onChange={(e) => setCarrier(e.target.value.toUpperCase())} placeholder="LH" maxLength={3} className="uppercase font-mono" />
        </Field>

        {ticket.endorsement && (
          <div className="rounded border border-[var(--border-subtle)] bg-sunken px-3 py-2 text-[12px]">
            <span className="text-tertiary">Mevcut: </span><span className="font-mono text-secondary">{ticket.endorsement}</span>
          </div>
        )}
      </div>
    </Drawer>
  );
}
