import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refundTicket, newIdempotencyKey, DomainError, type RefundInput } from "@/domain/api";
import type { Ticket } from "@/domain/types";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { Money } from "@/components/domain/Money";
import { ConfirmDestructive } from "@/components/domain/ConfirmDestructive";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { toast } from "@/components/ui/toast";

// FE-3 Refund — DESIGN_ROADMAP §3.7. İade kupon(lar), tutar + residual, onay → R.
// İade uygunluğu O/A/Y (Handbook 1.3.5); yalnız-TFC (Y akışı) ve voucher (EMD-S) destekli.
export function RefundDrawer({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const openCoupons = ticket.coupons.filter((c) => c.status === "O" || c.status === "A" || c.status === "Y");
  const [selected, setSelected] = useState<number[]>(() => openCoupons.map((c) => c.seq));
  const currency = ticket.fare.total.currency;
  const [scope, setScope] = useState<"full" | "taxOnly">("full");
  const [method, setMethod] = useState<"fop" | "voucher">("fop");
  // Öneri, kullanılmamış kupon değeri üzerinden — yalnız-TFC seçiliyse vergi payı üzerinden.
  const base = scope === "taxOnly" ? ticket.fare.totalTfc.amount : ticket.fare.total.amount;
  const perCoupon = base / Math.max(1, openCoupons.length);
  const suggested = Math.round(perCoupon * selected.length);
  const [refundAmount, setRefundAmount] = useState<number>(suggested);
  const [residual, setResidual] = useState<number>(0);
  const [waiver, setWaiver] = useState<"" | "death" | "illness">("");
  const [confirm, setConfirm] = useState(false);
  const [idem] = useState(newIdempotencyKey);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: RefundInput) => refundTicket(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", ticket.ticketNumber] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Refund tamamlandı", `${selected.length} kupon → R` + (scope === "taxOnly" ? " (yalnız TFC, O→Y→R)" : "") + (method === "voucher" ? " · voucher EMD-S kesildi" : ""));
      onClose();
    },
    onError: (e) => toast.danger("Refund başarısız", e instanceof DomainError ? e.message : "Beklenmeyen hata"),
  });

  const toggle = (seq: number) =>
    setSelected((prev) => (prev.includes(seq) ? prev.filter((s) => s !== seq) : [...prev, seq]));

  const canSubmit = selected.length > 0;

  if (!openCoupons.length) {
    return (
      <Drawer open={open} onClose={onClose} title="Refund" description={ticket.ticketNumber}>
        <p className="text-sm text-secondary">İadeye uygun (O/A/Y — Handbook 1.3.5) kupon yok.</p>
      </Drawer>
    );
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Refund"
      description={`Bilet ${ticket.ticketNumber}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={confirm ? () => setConfirm(false) : onClose} disabled={mutation.isPending}>
            {confirm ? "Geri" : "İptal"}
          </Button>
          {confirm ? (
            <Button variant="danger" onClick={() => mutation.mutate({ ticketNumber: ticket.ticketNumber, couponSeqs: selected, refundAmount: { amount: refundAmount, currency }, residual: residual > 0 ? { amount: residual, currency } : undefined, waiver: waiver || undefined, taxOnly: scope === "taxOnly" || undefined, method, idempotencyKey: idem })} disabled={mutation.isPending}>
              {mutation.isPending ? "İşleniyor…" : "İadeyi Onayla"}
            </Button>
          ) : (
            <Button onClick={() => setConfirm(true)} disabled={!canSubmit}>Devam</Button>
          )}
        </div>
      }
    >
      {!confirm ? (
        <div className="flex flex-col gap-4">
          <div className="text-[13px] text-secondary">İade edilecek kupon(ları) seç. Seçilenler <span className="font-mono">R</span> (Refunded) olur.</div>
          <div className="flex flex-col gap-2">
            {openCoupons.map((c) => (
              <label key={c.seq} className="flex cursor-pointer items-center gap-3 rounded border border-[var(--border-subtle)] bg-surface-alt px-3 py-2.5">
                <input type="checkbox" checked={selected.includes(c.seq)} onChange={() => toggle(c.seq)} className="accent-[var(--accent)]" />
                <span className="font-mono text-[13px] text-primary">#{c.seq} {c.segment.origin}→{c.segment.destination}</span>
                <StatusBadge status={c.status} className="ml-auto" />
              </label>
            ))}
          </div>
          <Field label="İade kapsamı" hint="İade edilemez fare'lerde vergiler (TFC) yine iade edilir — kupon O→Y→R (1.1.4.1/1.3.5)">
            <Select value={scope} onChange={(e) => { const v = e.target.value as "full" | "taxOnly"; setScope(v); const b = v === "taxOnly" ? ticket.fare.totalTfc.amount : ticket.fare.total.amount; setRefundAmount(Math.round((b / Math.max(1, openCoupons.length)) * selected.length)); }}>
              <option value="full">Tam iade (fare + TFC)</option>
              <option value="taxOnly">Yalnız vergi iadesi (TFC) — Y akışı</option>
            </Select>
          </Field>
          <Field label="İade yöntemi" hint="Voucher: tutar EMD-S travel credit olarak kesilir; sonraki bilette FOP olarak kullanılır">
            <Select value={method} onChange={(e) => setMethod(e.target.value as "fop" | "voucher")}>
              <option value="fop">Orijinal ödeme yöntemine (FOP)</option>
              <option value="voucher">Voucher / travel credit (EMD-S)</option>
            </Select>
          </Field>
          <Field label={`İade tutarı (${currency})`} hint={`Öneri: ${suggested.toLocaleString("en-US")} (${scope === "taxOnly" ? "TFC payı" : "kupon başına oransal"})`}>
            <DecimalInput value={refundAmount} onChange={(n) => setRefundAmount(n ?? 0)} className="font-mono" fxCurrency={currency} />
          </Field>
          <Field label={`Residual (${currency})`} hint="Kullanılmayan değer EMD-S/MCO olarak iade edilebilir (Ch 15)">
            <DecimalInput value={residual} onChange={(n) => setResidual(n ?? 0)} className="font-mono" fxCurrency={currency} />
          </Field>
          <Field label="Muafiyet (waiver)" hint="Vefat/ağır hastalık: iptal cezası muaf, validity uzatılabilir (Ch 13.9/13.10, 15.4)">
            <Select value={waiver} onChange={(e) => setWaiver(e.target.value as "" | "death" | "illness")}>
              <option value="">Yok (standart iade)</option>
              <option value="death">Vefat — ceza muaf</option>
              <option value="illness">Ağır hastalık — ceza muaf</option>
            </Select>
          </Field>
          {waiver && (
            <div className="rounded border border-[var(--info-bg)] bg-[var(--info-bg)] px-3 py-2 text-[12px] text-[var(--info-text)]">
              Muafiyet uygulandı: iptal cezası alınmaz. Belge (vefat/sağlık raporu) dosyaya eklenmelidir.
            </div>
          )}
        </div>
      ) : (
        <ConfirmDestructive
          summary={
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between"><span className="text-secondary">Kuponlar</span><span className="font-mono text-[13px] text-primary">{selected.map((s) => `#${s}`).join(", ")} → {scope === "taxOnly" ? "Y → R" : "R"}</span></div>
              <div className="flex items-center justify-between"><span className="text-secondary">Yöntem</span><span className="text-[13px] text-primary">{method === "voucher" ? "Voucher / EMD-S" : "Orijinal FOP"}</span></div>
              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2"><span className="text-secondary">İade tutarı</span><Money value={{ amount: refundAmount, currency }} size="md" tone="delta-out" /></div>
              {residual > 0 && <div className="flex items-center justify-between"><span className="text-secondary">Residual (EMD-S)</span><Money value={{ amount: residual, currency }} size="sm" /></div>}
            </div>
          }
        />
      )}
    </Drawer>
  );
}
