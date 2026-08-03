import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { checkInPassenger, getFlight, getSeatMap, listPassengers, type Seat } from "@/domain/checkin";
import { advanceCouponStatus, newIdempotencyKey, recordBaggage } from "@/domain/api";
import { paxSeatNotes, seatDenial } from "@/domain/seatRules";
import { Button, Field, Input } from "@/components/ui/core";
import { PageTitle, Panel, PanelHead, PanelBody, Meta, MetaGrid } from "@/components/ui/surface";
import { Banner } from "@/components/ui/banner";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Koltuk seçimi — her koltuk her yolcuya verilmez.
 *
 * Uygunluk kuralları (`domain/seatRules`) burada GÖRSELLEŞİR: kapalı koltuk
 * işaretlenir ve nedeni söylenir. Kural motoru ayrıca mock sunucuda da
 * çalışır; arayüz atlatılsa bile kabul reddedilir.
 */
export function SeatSelection() {
  const { flightId, passengerId } = useParams({ from: "/checkin/$flightId/seat/$passengerId" });
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
      toast.success("Yolcu kabul edildi", `${p.surname}/${p.givenName} · koltuk ${p.seat}`);
      if (couponWarning) toast.warning("Kupon ilerletilemedi", couponWarning);
      qc.invalidateQueries({ queryKey: ["pax", flightId] });
      qc.invalidateQueries({ queryKey: ["flights"] });
      qc.invalidateQueries({ queryKey: ["ticket", p.ticketNumber] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      navigate({ to: "/checkin/$flightId", params: { flightId } });
    },
    onError: (e: Error) => toast.danger("Kabul edilemedi", e.message),
  });

  const rows = useMemo(() => {
    const m = new Map<number, Seat[]>();
    for (const s of seats ?? []) {
      if (!m.has(s.row)) m.set(s.row, []);
      m.get(s.row)!.push(s);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [seats]);

  if (isLoading || !person || !flight) return <Skeleton className="h-96 w-full" />;

  const notes = paxSeatNotes(person);
  const trySelect = (s: Seat) => {
    const denial = seatDenial(person, s);
    if (denial) { toast.warning("Bu koltuk verilemez", denial.reason); return; }
    setSeat(s.id);
  };

  return (
    <>
      <PageTitle
        title="Koltuk Seçimi"
        hint={`${person.surname}/${person.givenName} · ${flight.carrier}${flight.flightNumber} · ${flight.origin} → ${flight.destination}`}
        action={
          <>
            <Button variant="ghost" onClick={() => navigate({ to: "/checkin/$flightId", params: { flightId } })}>Vazgeç</Button>
            <Button variant="success" disabled={!seat || accept.isPending} onClick={() => accept.mutate()}>
              {accept.isPending ? "Kabul ediliyor…" : "Kabul et"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Panel>
          <PanelHead title="Kabin" hint={`${flight.aircraft.type} · ${flight.aircraft.config}`} />
          <PanelBody>
            <div className="flex flex-col items-center gap-1.5">
              {rows.map(([row, list]) => (
                <div key={row} className="flex items-center gap-1.5">
                  <span className="num w-6 text-right text-[11px] text-ink-3">{row}</span>
                  {list.sort((a, b) => a.col.localeCompare(b.col)).map((s) => {
                    const denial = seatDenial(person, s);
                    const on = seat === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => trySelect(s)}
                        disabled={s.occupied}
                        title={denial ? denial.reason : `${s.id} · ${s.cabin}${s.exit ? " · çıkış sırası" : ""}`}
                        aria-label={`${s.id} ${s.cabin}${denial ? " — kapalı" : ""}`}
                        className={cn(
                          "num grid h-7 w-7 place-items-center rounded-sm border text-[10px] transition-colors",
                          on ? "border-brand bg-brand text-white"
                            : s.occupied ? "cursor-not-allowed border-line bg-sunken text-ink-4"
                              : denial ? "border-[var(--t-amber-d)] bg-[var(--t-amber-w)] text-[var(--t-amber-i)]"
                                : "border-line bg-panel text-ink-2 hover:border-brand hover:text-brand",
                        )}
                      >
                        {denial && !s.occupied ? "⊘" : s.col}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-4 border-t border-line pt-4 text-[11.5px] text-ink-3">
              <Legend className="border-line bg-panel" label="Boş" />
              <Legend className="border-brand bg-brand" label="Seçili" />
              <Legend className="border-line bg-sunken" label="Dolu" />
              <Legend className="border-[var(--t-amber-d)] bg-[var(--t-amber-w)]" label="Bu yolcuya kapalı" />
            </div>
          </PanelBody>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHead title="Yolcu" />
            <PanelBody className="flex flex-col gap-3">
              <MetaGrid className="grid-cols-2 sm:grid-cols-2">
                <Meta label="Ad" value={`${person.surname}/${person.givenName}`} />
                <Meta label="PNR" value={person.pnr} mono />
                <Meta label="Kabin" value={person.cabin} />
                <Meta label="Bilet" value={person.ticketNumber ?? "—"} mono />
              </MetaGrid>
              {(person.ssr?.length || person.infant || person.child) && (
                <div className="flex flex-wrap gap-1.5">
                  {person.ssr?.map((c) => <Pill key={c} tone="blue">{c}</Pill>)}
                  {person.infant && <Pill tone="violet">Bebek</Pill>}
                  {person.child && <Pill tone="violet">Çocuk</Pill>}
                </div>
              )}
              {notes.length > 0 && (
                <Banner kind="warning" title="Koltuk kısıtları">
                  <ul className="mt-0.5 list-disc pl-4">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
                </Banner>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead title="Kabul bilgileri" />
            <PanelBody className="flex flex-col gap-3">
              <Meta label="Seçili koltuk" value={seat ?? "—"} mono />
              <Field label="Bagaj (adet)">
                <Input type="number" min={0} max={5} value={bags} onChange={(e) => setBags(Number(e.target.value))} className="num" />
              </Field>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-4 w-4 rounded-sm border", className)} />
      {label}
    </span>
  );
}
