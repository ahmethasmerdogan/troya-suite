import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Printer, Scissors } from "lucide-react";
import type { Ticket } from "@/domain/types";
import { useUI } from "@/store/ui";
import { Button } from "@/ui";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { TicketDocument } from "./TicketDocument";

/* ====================================================================
   Bilet kesim onayı — belge teatrali.

   Kesim bu sistemde bir SATIŞ kaydıdır; ekranın onu bir olay gibi göstermesi
   personelin işlemin gerçekten tamamlandığını görmesini sağlar. Sıra:

     0.00s  onay halkası atar, tik çizilir
     0.30s  bilet aşağıdan yükselir
     0.22s  makas perforasyon hattı boyunca yukarıdan aşağı iner
     1.18s  koçan kopar, düşer; gövde hafifçe sarsılır
     ~2.4s  aksiyonlar belirir — personel ne yapacağını seçer

   Otomatik yönlendirme YOK: kesilen belgeyi görmeden ekranın kaymasını
   istemeyiz. (Önceki sürümde 3.5 sn'lik zamanlayıcı her render'da
   sıfırlanıyordu, yani ne zaman gideceği belirsizdi.)
   ==================================================================== */

export function IssueSuccess({
  ticket, group, onOpen, onPrint, onNew,
}: {
  ticket: Ticket;
  /** Grup kesiminde aynı işlemde kesilen tüm biletler. */
  group?: { groupRef: string; tickets: Ticket[] };
  onOpen: () => void;
  onPrint: () => void;
  onNew: () => void;
}) {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const [cut, setCut] = useState(false);
  // Makas ve koparma CSS gecikmeleriyle yürür; buton şeridi bittiğinde gelir.
  useEffect(() => {
    const id = setTimeout(() => setCut(true), 2400);
    return () => clearTimeout(id);
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("ticket.issued.title")}
      className="anim-fade fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-canvas/85 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-4xl py-8">
        {/* --- onay işareti --- */}
        <div className="flex flex-col items-center">
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-[var(--brand)]">
            <span aria-hidden className="anim-doc-ring absolute inset-0 rounded-full border-2 border-[var(--brand)]" />
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4.5 12.5 L9.5 17.5 L19.5 6.5"
                stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                className="anim-doc-check"
              />
            </svg>
          </span>
          <h2 className="anim-doc-rise mt-4 text-[22px] font-semibold tracking-[-0.02em] text-ink" style={{ animationDelay: "0.15s" }}>
            {t("ticket.issued.title")}
          </h2>
          <p className="anim-doc-rise mt-1 text-[13.5px] text-ink-2" style={{ animationDelay: "0.22s" }}>
            {t("ticket.issued.desc")}
          </p>
          <span className="anim-doc-rise num mt-2 rounded-md bg-inset px-2.5 py-1 text-[13px] font-medium text-ink" style={{ animationDelay: "0.28s" }}>
            {group ? t("group.issued.title", { n: group.tickets.length, ref: group.groupRef }) : ticket.ticketNumber}
          </span>
        </div>

        {/* --- belge + makas --- */}
        {/* Koçan koptuktan sonra kalan bilet ortaya kayar (koçan 224px → 112px). */}
        <div
          className={cn("anim-doc-in relative mt-7 transition-transform duration-700 ease-out", cut && "sm:translate-x-28")}
          style={{ animationDelay: "0.3s" }}
        >
          <TicketDocument ticket={ticket} compact tear lang={lang} />
          {/* Makas koçan hattında iner. Koçan sm:w-56 (224px) olduğundan
              kesim çizgisi sağdan 224px içeridedir; iki değer birlikte değişir. */}
          <span
            aria-hidden
            className="anim-doc-scissor pointer-events-none absolute hidden text-[var(--brand)] sm:block"
            style={{ right: "216px", animationDelay: "0.52s" }}
          >
            <Scissors size={22} strokeWidth={2} className="rotate-90" />
          </span>
        </div>

        {/* --- grup: aynı işlemde kesilen diğer biletler --- */}
        {group && (
          <div className={cut ? "anim-doc-rise mt-5 rounded-lg border border-line bg-panel" : "mt-5 rounded-lg border border-line bg-panel opacity-0"}>
            <div className="border-b border-line px-4 py-2 text-[12px] text-ink-3">{t("group.issued.hint")}</div>
            <ul className="divide-y divide-[var(--hair)]">
              {group.tickets.map((tk) => (
                <li key={tk.ticketNumber}>
                  <Link to="/tickets/$ticketNumber" params={{ ticketNumber: tk.ticketNumber }}
                    className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-inset">
                    <span className="num font-medium text-ink">{tk.ticketNumber}</span>
                    <span className="text-ink-2">{tk.passenger.surname}/{tk.passenger.givenName}</span>
                    <span className="num text-[11.5px] text-ink-3">{tk.ptc ?? "ADT"}</span>
                    <span className="num ml-auto text-ink">{tk.fare.total.amount.toLocaleString()} {tk.fare.total.currency}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* --- aksiyonlar --- */}
        <div className={cut ? "anim-doc-rise mt-6 flex flex-wrap items-center justify-center gap-2" : "mt-6 flex flex-wrap items-center justify-center gap-2 opacity-0"}>
          <Button variant="green" onClick={onOpen} iconRight={<ArrowRight size={15} strokeWidth={2} />}>
            {t("ticket.issued.open")}
          </Button>
          <Button variant="white" onClick={onPrint} iconLeft={<Printer size={15} strokeWidth={1.75} />}>
            {t("ticket.issued.print")}
          </Button>
          <Button variant="ghost" onClick={onNew}>{t("ticket.issued.new")}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
