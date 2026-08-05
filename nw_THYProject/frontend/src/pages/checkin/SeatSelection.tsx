import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { checkInPassenger, getFlight, getSeatMap, listPassengers, type Seat } from "@/domain/checkin";
import { advanceCouponStatus, newIdempotencyKey, recordBaggage } from "@/domain/api";
import { denialReason, paxSeatNotes, seatDenial } from "@/domain/seatRules";
import { layoutFor } from "@/domain/aircraftLayout";
import { CabinMap, CabinLegend, blockedSummary } from "@/components/checkin/CabinMap";
import { Button, Field, Input } from "@/components/ui/core";
import { PageTitle, Panel, PanelHead, PanelBody, Meta, MetaGrid } from "@/components/ui/surface";
import { Banner } from "@/components/ui/banner";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useT, translate } from "@/i18n";
import { useUI } from "@/store/ui";

/**
 * Koltuk seçimi — her koltuk her yolcuya verilmez.
 *
 * Uygunluk kuralları (`domain/seatRules`) burada GÖRSELLEŞİR: kapalı koltuk
 * işaretlenir ve nedeni söylenir. Kural motoru ayrıca mock sunucuda da
 * çalışır; arayüz atlatılsa bile kabul reddedilir.
 */
export function SeatSelection() {
  const { flightId, passengerId } = useParams({ from: "/checkin/$flightId/seat/$passengerId" });
  const t = useT();
  // Kural gerekçeleri (koltuk reddi, kısıt notları) domainden iki dilli gelir.
  const lang = useUI((s) => s.lang);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [seat, setSeat] = useState<string | null>(null);
  const [bags, setBags] = useState(1);

  const { data: flight } = useQuery({ queryKey: ["flight", flightId], queryFn: () => getFlight(flightId) });
  const { data: pax } = useQuery({ queryKey: ["pax", flightId], queryFn: () => listPassengers(flightId) });
  const { data: seats, isLoading } = useQuery({ queryKey: ["seatmap", flightId], queryFn: () => getSeatMap(flightId) });

  const person = pax?.find((p) => p.id === passengerId);

  /**
   * Kabul iki şey yapar: DCS kaydını günceller VE Troya kuponunu ilerletir.
   * "Tek komut, iki yüzey" — check-in bir DCS işlemi değil, biletin yaşam
   * döngüsündeki bir adımdır (Handbook 1.1.4.1). Kupon O→C'ye geçmezse
   * bilet tarafında uçuş hiç olmamış görünür.
   */
  const accept = useMutation({
    mutationFn: async () => {
      const p = await checkInPassenger({ flightId, passengerId, seat: seat!, bags, idempotencyKey: newIdempotencyKey() });
      let couponWarning: string | null = null;
      if (p.ticketNumber && p.couponSeq != null) {
        try {
          await advanceCouponStatus(p.ticketNumber, p.couponSeq, "C");
          // Teslim alınan bagaj kupona yazılır (14.4) — bilet tarafında görünür.
          if (bags > 0) {
            await recordBaggage({
              ticketNumber: p.ticketNumber, couponSeq: p.couponSeq,
              checkedPieces: bags, idempotencyKey: newIdempotencyKey(),
            });
          }
        } catch (e) {
          // Sıralı kullanım ihlali gibi kural hataları kabulü geri almaz;
          // operatöre bildirilir (kupon elle düzeltilir).
          couponWarning = (e as Error).message;
        }
      }
      return { pax: p, couponWarning };
    },
    onSuccess: ({ pax: p, couponWarning }) => {
      toast.success(
        t("checkin.toast.accepted.title"),
        t("checkin.toast.seatLine", { name: `${p.surname}/${p.givenName}`, seat: p.seat ?? "—" }),
      );
      if (couponWarning) toast.warning(t("checkin.toast.couponFailed"), couponWarning);
      qc.invalidateQueries({ queryKey: ["pax", flightId] });
      qc.invalidateQueries({ queryKey: ["seatmap", flightId] });
      qc.invalidateQueries({ queryKey: ["flight", flightId] });
      qc.invalidateQueries({ queryKey: ["flights"] });
      qc.invalidateQueries({ queryKey: ["opsBoard"] });
      qc.invalidateQueries({ queryKey: ["ticket", p.ticketNumber] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      navigate({ to: "/checkin/$flightId", params: { flightId } });
    },
    onError: (e: Error) => toast.danger(t("checkin.toast.acceptFailed"), e.message),
  });

  if (isLoading || !person || !flight) return <Skeleton className="h-96 w-full" />;

  const layout = layoutFor(flight.aircraft.type);
  const notes = paxSeatNotes(person, lang);
  const blocked = blockedSummary(seats ?? [], person, lang);
  const free = (seats ?? []).filter((s) => !s.occupied && !seatDenial(person, s));
  const trySelect = (s: Seat) => {
    const denial = seatDenial(person, s);
    if (denial) { toast.warning(t("checkin.toast.seatDenied"), denialReason(denial, lang)); return; }
    setSeat(s.id);
  };

  return (
    <>
      <PageTitle
        title={t("checkin.seat.title")}
        hint={`${person.surname}/${person.givenName} · ${flight.carrier}${flight.flightNumber} · ${flight.origin} → ${flight.destination}`}
      />

      <div className="grid grid-cols-1 gap-4 pb-24 lg:grid-cols-[1fr_340px]">
        <Panel>
          <PanelHead
            title={t("checkin.seat.cabin")}
            hint={t("checkin.seat.cabinHint", { type: flight.aircraft.type, config: flight.aircraft.config, n: flight.capacity })}
            action={
              <span className="num text-[12px] text-ink-3">
                {t("checkin.seat.free", { n: free.length })}
              </span>
            }
          />
          <PanelBody>
            <div className="overflow-x-auto">
              <CabinMap
                seats={seats ?? []}
                aircraftType={flight.aircraft.type}
                passenger={person}
                selected={seat}
                ownSeat={person.seat}
                onSelect={trySelect}
              />
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <CabinLegend layout={layout} />
            </div>
          </PanelBody>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHead title={t("checkin.seat.pax")} />
            <PanelBody className="flex flex-col gap-3">
              <MetaGrid className="grid-cols-2 sm:grid-cols-2">
                <Meta label={t("checkin.seat.meta.name")} value={`${person.surname}/${person.givenName}`} />
                <Meta label="PNR" value={person.pnr} mono />
                <Meta label={t("checkin.seat.cabin")} value={person.cabin} />
                <Meta label={t("checkin.seat.meta.ticket")} value={person.ticketNumber ?? "—"} mono />
              </MetaGrid>
              {(person.ssr?.length || person.infant || person.child) && (
                <div className="flex flex-wrap gap-1.5">
                  {person.ssr?.map((c) => <Pill key={c} tone="blue">{c}</Pill>)}
                  {person.infant && <Pill tone="violet">{t("checkin.seat.infant")}</Pill>}
                  {person.child && <Pill tone="violet">{t("checkin.seat.child")}</Pill>}
                </div>
              )}
              {notes.length > 0 && (
                <Banner kind="warning" title={t("checkin.seat.restrictions")}>
                  <ul className="mt-0.5 list-disc pl-4">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
                </Banner>
              )}
            </PanelBody>
          </Panel>

          {/* Kapalı koltukların NEDENİ kalıcı yüzeyde — hover'a bakmak gerekmesin. */}
          {blocked.length > 0 && (
            <Panel>
              <PanelHead title={t("checkin.seat.blocked.title")} hint={t("checkin.seat.blocked.hint")} />
              <PanelBody className="flex flex-col gap-2.5 pt-1">
                {blocked.map((b) => (
                  <div key={b.reason} className="rounded-md border border-line bg-inset px-3 py-2">
                    <div className="text-[12.5px] text-ink">{b.reason}</div>
                    <div className="num mt-1 text-[11px] text-ink-3">
                      {t("checkin.seat.blocked.count", { n: b.seats.length })} · {b.seats.slice(0, 8).join(", ")}{b.seats.length > 8 ? " …" : ""}
                    </div>
                  </div>
                ))}
              </PanelBody>
            </Panel>
          )}

          <Panel>
            <PanelHead title={t("checkin.seat.acceptInfo")} />
            <PanelBody className="flex flex-col gap-3">
              <Field label={t("checkin.seat.bags")} hint={t("checkin.seat.bags.hint")}>
                <Input type="number" min={0} max={5} value={bags} onChange={(e) => setBags(Number(e.target.value))} className="num" />
              </Field>
            </PanelBody>
          </Panel>
        </div>
      </div>

      {/* Uzun kabinde başa dönmek zorunda kalmamak için aksiyon alta yapışır. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-content flex-wrap items-center gap-3 px-5 py-3 sm:px-6 lg:px-8">
          <span className="flex items-baseline gap-2">
            <span className="microlabel">{t("checkin.seat.selected")}</span>
            <span className="num text-[17px] font-semibold text-ink">{seat ?? "—"}</span>
          </span>
          {seat && seatInfo(seats, seat) && (
            <span className="text-[12px] text-ink-3">{seatDescription(seatInfo(seats, seat)!)}</span>
          )}
          <span className="num text-[12px] text-ink-3">{t("checkin.seat.bagsCount", { n: bags })}</span>
          <span className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate({ to: "/checkin/$flightId", params: { flightId } })}>{t("checkin.seat.cancel")}</Button>
            <Button variant="success" disabled={!seat || accept.isPending} onClick={() => accept.mutate()}>
              {accept.isPending ? t("checkin.seat.accepting") : t("checkin.action.accept")}
            </Button>
          </span>
        </div>
      </div>
    </>
  );
}

const seatInfo = (seats: Seat[] | undefined, id: string) => (seats ?? []).find((s) => s.id === id);

/** Seçilen koltuğun insan-okur tarifi — operatör ne verdiğini görsün. */
function seatDescription(s: Seat): string {
  return [
    s.cabin,
    s.position === "window"
      ? translate("checkin.seat.pos.window")
      : s.position === "aisle" ? translate("checkin.seat.pos.aisle") : translate("checkin.seat.pos.middle"),
    s.exit ? translate("checkin.seat.exit") : null,
    s.bulkhead ? translate("checkin.seat.bulkheadLong") : null,
    s.overWing ? translate("checkin.seat.overWing") : null,
    s.nearLavatory ? translate("checkin.seat.lavatory") : null,
  ].filter(Boolean).join(" · ");
}
