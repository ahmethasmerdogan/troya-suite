import { useState } from "react";
import { Button } from "@/components/ui/core";
import { Modal } from "@/components/ui/overlay";
import { Banner } from "@/components/ui/banner";

/**
 * Geri alınamaz işlem onayı.
 *
 * Para ve statü değiştiren işlemler tek tıkla olmaz: kullanıcı sonucu
 * okur ve açıkça onaylar. Bu bir nezaket değil, denetim gereğidir.
 */
export function ConfirmDestructive({
  open,
  onClose,
  onConfirm,
  title,
  warning,
  confirmLabel,
  pending,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  warning: string;
  confirmLabel: string;
  pending?: boolean;
  children?: React.ReactNode;
}) {
  const [ack, setAck] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>Vazgeç</Button>
          <Button variant="danger" disabled={!ack || pending} onClick={onConfirm}>
            {pending ? "İşleniyor…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Banner kind="danger">{warning}</Banner>
        {children}
        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-2">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-[var(--brand)]"
          />
          Sonucu okudum, işlemi onaylıyorum.
        </label>
      </div>
    </Modal>
  );
}
