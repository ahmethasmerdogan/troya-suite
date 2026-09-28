import { useEffect, useState } from "react";
import { Baby, Plane, ShieldCheck } from "lucide-react";
import type { Ticket } from "@/domain/types";
import { airportByCode } from "@/domain/airports";
import { STATUS_META } from "@/domain/couponStatus";
import { ssrLabel } from "@/domain/ssr";
import { Money } from "@/components/domain/Money";
import { STATUS_TONE } from "@/components/domain/statusTone";
import {
  DocSheet, DocBand, DocBox, DocSection, DocLine, DocNotice, DocFoot, DocBarcode,
  DocPerforation, cabinOf, iataDate, iataTime,
} from "./kit";
import { DICT, type Key } from "@/i18n/dict";
import { cn, flightCode } from "@/lib/utils";

/**
 * Belge sözlüğü — `useT()` ARAYÜZ dilinden okur, bu belge ise kendi `lang`
 * prop'undan. Yolcuya İngilizce belge verilirken personelin arayüzü Türkçe
 * kalabilir; bu yüzden lookup arayüz store'una değil prop'a bağlıdır.
 */
type DocParams = Record<string, string | number>;
function docT(lang: "tr" | "en", key: Key, params?: DocParams): string {
  const s = DICT[lang][key];
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : s;
}

/* ====================================================================
   Elektronik bilet belgesi.

   Önceki önizleme yalnız BİR kuponu gösteriyordu: gidiş-dönüş bir bilette
   dönüş bacağı belgede hiç görünmüyordu. Ücret dökümü, bagaj hakkı, özel
   hizmet, kimlik belgesi, ciro, settlement kodu ve kontrol bilgisi kayıtta
   duruyordu ama belgeye hiç basılmıyordu.

   Bu belge kaydın TAMAMINI taşır ve iki modda çalışır:
     · `compact`  — bilet detayı sayfasının üstündeki özet yüz
     · tam        — yazdırılan / kesim sonrası gösterilen belge
   ==================================================================== */

export function TicketDocument({
  ticket, compact, tear, lang = "tr", className,
}: {
  ticket: Ticket;
  /** Yalnız ilk bacak + koçan — detay sayfasının başlık yüzü. */
  compact?: boolean;
  /** Koparma animasyonu (kesim sonrası). */
  tear?: boolean;
  /**
   * Belge dili. Alan ETİKETLERİ zaten iki dillidir (IATA belge geleneği:
   * "Yolcu · Name of passenger"); bu bayrak yalnız DÜZ METİN bloklarını
   * çevirir — taşıma şartları, bölüm açıklamaları. Belge dili arayüz
   * dilinden bağımsızdır: yolcu İngilizce isteyebilir, personel Türkçe çalışır.
   */
  lang?: "tr" | "en";
  className?: string;
}) {
  const tr = lang === "tr";
  const d = (key: Key, params?: DocParams) => docT(lang, key, params);
  const now = useNow();
  const p = ticket.passenger;
  const active = ticket.coupons.find((c) => c.status === "O") ?? ticket.coupons[0];
  const seg = active?.segment;
  const from = airportByCode(seg?.origin);
  const to = airportByCode(seg?.destination);
  const tone = active ? STATUS_TONE[active.status] : null;
  const mins = seg ? Math.round((new Date(seg.departure).getTime() - now) / 60000) : 0;

  return (
    <DocSheet className={cn(tear && "anim-doc-shake", className)}>
      <div className="flex flex-col sm:flex-row">
        {/* ---------- gövde ---------- */}
        <div className="min-w-0 flex-1">
          {/* Her parça kendi diliyle büyütülür: Türkçe kural "Ticket"ı "TİCKET" yapıyordu. */}
          <DocBand title={<><span lang="tr">Elektronik Bilet</span> · <span lang="en">E-Ticket</span></>} note={ticket.ticketNumber} />

          <div className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="microlabel">Yolcu · Name of passenger</div>
                <div className="mt-0.5 text-[19px] font-semibold tracking-tight text-ink">
                  {p.surname}/{p.givenName}{p.title ? ` ${p.title}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {p.infant && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-inset px-2 py-1 text-[11px] text-ink-2">
                    <Baby size={12} strokeWidth={1.75} /> {p.infant.surname}/{p.infant.givenName}
                  </span>
                )}
                {p.ssr?.map((code) => (
                  <span key={code} className="num rounded-md bg-inset px-2 py-1 text-[11px] text-ink-2" title={ssrLabel(code, lang)}>
                    {code}
                  </span>
                ))}
              </div>
            </div>

            {/* güzergâh — büyük şehir kodları */}
            {seg && (
              <div className="mt-5 flex items-center gap-4">
                <div className="min-w-0">
                  <div className="num text-[30px] font-semibold leading-none tracking-tight text-ink">{seg.origin}</div>
                  <div className="mt-1 truncate text-[11.5px] text-ink-3">{(tr ? from?.city : from?.cityEn) ?? ""}</div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-center">
                  <span className="num text-[11px] text-ink-3">{flightCode(seg.marketingCarrier, seg.flightNumber)}</span>
                  <span className="mt-1 flex w-full items-center gap-1.5" aria-hidden>
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                    <span className="h-px flex-1 bg-line-strong" />
                    <Plane size={14} strokeWidth={2} className="rotate-90 text-[var(--brand)]" />
                    <span className="h-px flex-1 bg-line-strong" />
                    <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                  </span>
                  <span className="num mt-1 text-[11px] text-ink-3">{iataDate(seg.departure)}</span>
                </div>
                <div className="min-w-0 text-right">
                  <div className="num text-[30px] font-semibold leading-none tracking-tight text-ink">{seg.destination}</div>
                  <div className="mt-1 truncate text-[11.5px] text-ink-3">{(tr ? to?.city : to?.cityEn) ?? ""}</div>
                </div>
              </div>
            )}

            {seg && (
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <DocBox label="Sınıf · Class" value={`${cabinOf(seg.rbd)} (${seg.rbd})`} />
                <DocBox label="Kalkış · Departure" value={iataTime(seg.departure)} />
                <DocBox label="Tarih · Date" value={iataDate(seg.departure)} />
                <DocBox label="PNR" value={ticket.pnr ?? "—"} />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[11.5px] text-ink-3">
              <span className="num">
                <span className="mr-1.5 rounded-sm border border-line-firm px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-ink-2">ETKT</span>
                {ticket.ticketNumber}
              </span>
              {active && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone?.dot }} />
                  {STATUS_META[active.status].short}
                </span>
              )}
              {seg && active?.status === "O" && (
                <span className={cn("num font-medium", mins < 0 ? "text-ink-3" : mins <= 180 ? "text-[var(--t-amber-i)]" : "text-ink-2")}>
                  {mins < 0 ? d("ticket.doc.departed") : d("ticket.doc.timeLeft", { v: fmtLeft(mins, lang) })}
                </span>
              )}
              <span lang="en" className="ml-auto uppercase tracking-[0.1em]">A Star Alliance Member ✦</span>
            </div>
          </div>
        </div>

        {/* ---------- koçan ---------- */}
        <div className={cn(
          "relative flex w-full flex-shrink-0 flex-col justify-between border-t border-dashed border-line-strong bg-elev px-5 py-4 sm:w-56 sm:border-l sm:border-t-0",
          tear && "anim-doc-tear",
        )}>
          <DocPerforation />
          <div>
            <div className="microlabel">Toplam · Total</div>
            <Money value={ticket.fare.total} size="md" className="mt-1" />
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <MiniBox label={d("ticket.doc.mini.coupons")} value={String(ticket.coupons.length)} />
              <MiniBox label={d("ticket.doc.mini.open")} value={String(ticket.coupons.filter((c) => c.status === "O").length)} />
              <MiniBox label={d("ticket.doc.mini.flown")} value={String(ticket.coupons.filter((c) => c.status === "F").length)} />
            </div>
          </div>
          <DocBarcode seed={ticket.ticketNumber} className="mt-4" />
        </div>
      </div>

      {!compact && (
        <>
          {/* ---------- tüm kuponlar ---------- */}
          <DocSection title="Kuponlar · Flight coupons" hint={tr ? "Belgedeki her bacak ayrı bir kupondur; statüsü bağımsız yürür." : "Each leg is a separate coupon with its own status."}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-line">
                    {["#", d("ticket.doc.th.flight"), d("ticket.doc.th.route"), d("ticket.doc.th.date"),
                      d("ticket.doc.th.departure"), d("ticket.doc.th.class"), d("ticket.doc.th.fareBasis"),
                      "NVB / NVA", d("ticket.doc.th.baggage"), d("ticket.doc.th.status")].map((h) => (
                      <th key={h} className="microlabel py-1.5 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ticket.coupons.map((c) => (
                    <tr key={c.seq} className="border-b border-hair last:border-0">
                      <td className="num py-2 pr-3 text-[12.5px] text-ink-3">{c.seq}</td>
                      <td className="num py-2 pr-3 text-[12.5px] text-ink">{flightCode(c.segment.marketingCarrier, c.segment.flightNumber)}</td>
                      <td className="num py-2 pr-3 text-[12.5px] text-ink">{c.segment.origin} → {c.segment.destination}</td>
                      <td className="num py-2 pr-3 text-[12.5px] text-ink-2">{iataDate(c.segment.departure)}</td>
                      <td className="num py-2 pr-3 text-[12.5px] text-ink-2">{iataTime(c.segment.departure)}</td>
                      <td className="num py-2 pr-3 text-[12.5px] text-ink-2">{c.segment.rbd}</td>
                      <td className="num py-2 pr-3 text-[12.5px] text-ink-2">{c.segment.fareBasis}</td>
                      <td className="num py-2 pr-3 text-[11.5px] text-ink-3">
                        {c.segment.notValidBefore ? iataDate(c.segment.notValidBefore) : "—"} / {c.segment.notValidAfter ? iataDate(c.segment.notValidAfter) : "—"}
                      </td>
                      <td className="num py-2 pr-3 text-[11.5px] text-ink-3">{baggageOf(c.baggage?.allowance)}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_TONE[c.status].dot }} />
                          {STATUS_META[c.status].short}
                          {c.sac && <span className="num ml-1 text-[10.5px] text-ink-3">SAC{c.sac.trim()}</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DocSection>

          {/* ---------- ücret dökümü ---------- */}
          <DocSection title="Ücret dökümü · Fare details">
            <div className="grid gap-x-10 sm:grid-cols-2">
              <div>
                <DocLine label={d("ticket.doc.baseFare")} value={<Money value={ticket.fare.baseFare} size="sm" />} />
                {ticket.fare.tfcs?.map((t) => (
                  <DocLine key={t.code} label={d("ticket.doc.tfc", { code: t.code })} value={<Money value={t.amount} size="sm" />} />
                ))}
                <DocLine label={d("ticket.doc.totalTax")} value={<Money value={ticket.fare.totalTfc} size="sm" />} />
                <DocLine label="Toplam · Total" strong value={<Money value={ticket.fare.total} size="sm" />} />
              </div>
              <div>
                {ticket.fare.vat && (
                  <DocLine
                    label={d("ticket.doc.vat", { r: Math.round(ticket.fare.vat.rate * 100) })}
                    value={<Money value={{ amount: ticket.fare.vat.amount, currency: ticket.fare.total.currency }} size="sm" />}
                  />
                )}
                {ticket.fare.equivFarePaid && (
                  <DocLine label={d("ticket.doc.equivPaid")} value={<Money value={ticket.fare.equivFarePaid} size="sm" />} />
                )}
                {ticket.fare.fareCalcString && (
                  <DocLine label="Fare calculation" value={<span className="text-[11px]">{ticket.fare.fareCalcString}</span>} />
                )}
                {ticket.fare.nuc != null && <DocLine label={d("ticket.doc.nuc")} value={ticket.fare.nuc.toFixed(2)} />}
                {ticket.fare.roe != null && <DocLine label="ROE" value={ticket.fare.roe.toFixed(6)} />}
                {ticket.tourCode && <DocLine label="Tour code" value={ticket.tourCode} />}
                <DocLine
                  label="Ödeme şekli · Form of payment"
                  value={`${fopLabel(ticket.formOfPayment.type, lang)}${ticket.formOfPayment.detail ? ` · ${ticket.formOfPayment.detail}` : ""}`}
                />
              </div>
            </div>
          </DocSection>

          {/* ---------- belge künyesi ---------- */}
          <DocSection title="Belge bilgileri · Document details">
            <div className="grid gap-x-10 sm:grid-cols-2">
              <div>
                <DocLine label={d("ticket.doc.docNumber")} value={ticket.ticketNumber} />
                <DocLine label={d("ticket.doc.issuedDate")} value={iataDate(ticket.issuedAt)} />
                <DocLine label={d("ticket.doc.validatingCarrier")} value={ticket.validatingCarrier} />
                <DocLine label={d("ticket.doc.foid")} value={p.foid ?? "—"} />
              </div>
              <div>
                <DocLine
                  label={d("ticket.doc.control")}
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck size={12} strokeWidth={1.75} className="text-ink-3" />
                      {ticket.control.holder}{ticket.control.isValidatingCarrier ? " (VC)" : ""}
                    </span>
                  }
                />
                {ticket.conjunctionTickets?.length ? (
                  <DocLine label="Conjunction ticket" value={ticket.conjunctionTickets.join(", ")} />
                ) : null}
                {ticket.paperDocuments?.length ? (
                  <DocLine
                    label={d("ticket.doc.paperDoc")}
                    value={ticket.paperDocuments.map((x) => `#${x.couponSeq} ${x.documentNumber}`).join(", ")}
                  />
                ) : null}
                <DocLine label={d("ticket.doc.endorsement")} value={ticket.endorsement ?? "—"} />
              </div>
            </div>
          </DocSection>

          <DocNotice title={tr ? "Taşıma Şartları · Conditions of Contract (Appendix B)" : "Conditions of Contract · Notices (Appendix B)"}>
            {tr ? (
              <>
                <p>
                  Bu bilet, taşıyıcının geçerli taşıma şartlarına ve ilgili tarife kurallarına tabidir.
                  Yolcu, taşımanın Varşova Sözleşmesi ya da Montreal Sözleşmesi kapsamına girebileceğini ve
                  bu sözleşmelerin taşıyıcının ölüm, yaralanma, bagaj kaybı ve gecikme sorumluluğunu
                  sınırlandırabileceğini kabul eder.
                </p>
                <p>
                  Elektronik bilet kişiye özeldir ve devredilemez. Kupon kullanımı sıralıdır; sıradan önce
                  gelen bir kupon kullanılmadan sonraki kupon honor edilmez. İade ve değişiklik hakları
                  satın alınan ücretin kurallarına bağlıdır.
                </p>
                <p>
                  Uçuş öncesi kimlik ve seyahat belgelerinin geçerliliği yolcunun sorumluluğundadır.
                  Bu belge bir fatura değildir.
                </p>
              </>
            ) : (
              <>
                <p>
                  Carriage hereunder is subject to the carrier's conditions of contract and to the applicable
                  fare rules. The passenger acknowledges that carriage may be governed by the Warsaw Convention
                  or the Montreal Convention, which may limit the carrier's liability for death or injury, and
                  for loss of or damage to baggage, and for delay.
                </p>
                <p>
                  The electronic ticket is personal and non-transferable. Coupons must be used in sequence; a
                  coupon will not be honoured while an earlier coupon remains unused. Refund and change rights
                  are governed by the rules of the fare purchased.
                </p>
                <p>
                  It is the passenger's responsibility to hold valid identification and travel documents.
                  This document is not an invoice.
                </p>
              </>
            )}
          </DocNotice>

          <DocFoot
            left={`${ticket.validatingCarrier} · ${ticket.ticketNumber} · ${iataDate(ticket.issuedAt)}`}
            right="Turkish Airlines — Troya PSS"
          />
        </>
      )}
    </DocSheet>
  );
}

function MiniBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface px-2.5 py-1.5">
      <div className="microlabel">{label}</div>
      <div className="num text-[15px] font-semibold text-ink">{value}</div>
    </div>
  );
}

function baggageOf(a?: { type: "piece" | "weight"; value: number; unit?: "K" | "L" }): string {
  if (!a) return "—";
  return a.type === "piece" ? `${a.value} PC` : `${a.value}${a.unit ?? "K"}`;
}

const FOP_KEY: Record<string, Key> = {
  cash: "ticket.fop.cash", credit: "ticket.fop.credit", uatp: "ticket.fop.uatp",
  voucher: "ticket.fop.voucher", other: "ticket.fop.other",
};

function fopLabel(t: string, lang: "tr" | "en"): string {
  return FOP_KEY[t] ? docT(lang, FOP_KEY[t]) : t;
}

function fmtLeft(mins: number, lang: "tr" | "en"): string {
  if (mins < 60) return docT(lang, "ticket.doc.min", { n: mins });
  const h = Math.floor(mins / 60);
  if (h < 48) return docT(lang, "ticket.doc.hourMin", { h, m: mins % 60 });
  return docT(lang, "ticket.doc.days", { n: Math.floor(h / 24) });
}

/** Saniyede bir tik — geri sayımın canlı kalması için. */
function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
