import { useState, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "@tanstack/react-router";
import { X, Plane, Luggage, Clock, DoorOpen, Users, Loader2, PlaneTakeoff, Hash, Accessibility, Baby, ShieldAlert } from "lucide-react";
import { getFlight, listPassengers, getSeatMap, checkInPassenger, type CheckInInput, type Seat } from "@/domain/checkin";
import { seatDenial, paxSeatNotes } from "@/domain/seatRules";
import { advanceCouponStatus, newIdempotencyKey } from "@/domain/api";
import { CabinMap } from "@/components/checkin/CabinMap";
import { CheckInSuccess } from "@/components/checkin/CheckInSuccess";
import type { CheckinPassenger } from "@/domain/checkin";
import { cn } from "@/lib/utils";

// 3D kabin three.js taşır (~940 kB) — yalnızca kullanıcı 3D'ye geçince yüklensin (default 2D).
const Cabin3D = lazy(() => import("@/components/checkin/Cabin3D").then((m) => ({ default: m.Cabin3D })));
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/utils";

// Tam ekran koltuk seçimi — uçak bilgi paneli + büyük 2.5D kabin.
export function SeatSelection() {
  const { flightId, passengerId } = useParams({ from: "/checkin/$flightId/seat/$passengerId" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [seat, setSeat] = useState<string | null>(null);
  const [bags, setBags] = useState(1);
  const [idem] = useState(newIdempotencyKey);
  const [view, setView] = useState<"3d" | "2d">("2d");
  const [success, setSuccess] = useState<CheckinPassenger | null>(null);

  const flight = useQuery({ queryKey: ["flight", flightId], queryFn: () => getFlight(flightId) });
  const pax = useQuery({ queryKey: ["pax", flightId], queryFn: () => listPassengers(flightId) });
  const seats = useQuery({ queryKey: ["seatmap", flightId], queryFn: () => getSeatMap(flightId) });

  const passenger = pax.data?.find((p) => p.id === passengerId);
  const back = () => navigate({ to: "/checkin/$flightId", params: { flightId } });

  // Koltuk uygunluğu (DCS kuralları — seatRules): neden varsa koltuk bu yolcuya kapalı.
  const denialFor = (s: Seat): string | null => (passenger ? seatDenial(passenger, s)?.reason ?? null : null);
  const seatNotes = passenger ? paxSeatNotes(passenger) : [];
  // 2D görsel engeller; 3D görünüm için de aynı kural burada zorlanır (tek seçim kapısı).
  const trySelect = (id: string) => {
    const s = seats.data?.find((x) => x.id === id);
    const reason = s ? denialFor(s) : null;
    if (reason) { toast.warning(`Koltuk ${id} verilemez`, reason); return; }
    setSeat(id);
  };

  const mutation = useMutation({
    mutationFn: (input: CheckInInput) => checkInPassenger(input),
    onSuccess: async (p) => {
      if (p.ticketNumber && p.couponSeq) await advanceCouponStatus(p.ticketNumber, p.couponSeq, "C");
      qc.invalidateQueries({ queryKey: ["pax", flightId] });
      qc.invalidateQueries({ queryKey: ["seatmap", flightId] });
      if (p.ticketNumber) qc.invalidateQueries({ queryKey: ["ticket", p.ticketNumber] });
      // Bilet kesimi gibi onay animasyonu — check-in temalı (boarding pass yazıcıdan çıkar).
      setSuccess(p);
    },
    onError: (e) => toast.danger("Check-in hata", e instanceof Error ? e.message : ""),
  });

  const f = flight.data;
  const occupied = seats.data?.filter((s) => s.occupied).length ?? 0;
  const total = seats.data?.length ?? 0;

  return (
    <>
    <div className="fixed inset-0 z-50 flex flex-col bg-page">
      {/* başlık */}
      <header className="flex h-14 flex-shrink-0 items-center gap-4 border-b border-[var(--border-subtle)] bg-surface px-5">
        <button onClick={back} className="flex h-9 w-9 items-center justify-center rounded text-secondary hover:bg-sunken hover:text-primary"><X size={18} strokeWidth={1.75} /></button>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-[#c70a0c] text-white"><Plane size={16} strokeWidth={1.75} className="-rotate-45" /></span>
          <span className="text-[15px] font-semibold text-primary">Koltuk Seçimi</span>
        </div>
        {f && <span className="font-mono text-sm text-secondary">{f.flightNumber} · {f.origin}→{f.destination}</span>}
        {passenger && (
          <span className="ml-auto flex items-center gap-2">
            {/* Özel yolcu rozetleri — koltuk kısıtlarının nedeni bir bakışta görünsün */}
            {passenger.ssr?.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-pill bg-[var(--warning-bg)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--warning-text)]" title="Özel yolcu (SSR) — koltuk kısıtları uygulanır">
                <Accessibility size={11} strokeWidth={2} />{c}
              </span>
            ))}
            {passenger.infant && (
              <span className="inline-flex items-center gap-1 rounded-pill bg-[var(--info-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--info-text)]" title="Kucak bebeği — çıkış sırası kapalı">
                <Baby size={11} strokeWidth={2} /> Bebek
              </span>
            )}
            {passenger.child && (
              <span className="rounded-pill bg-[var(--info-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--info-text)]" title="Çocuk yolcu — çıkış sırası kapalı">Çocuk</span>
            )}
            <span className="rounded bg-sunken px-3 py-1.5 text-[13px] text-primary">{passenger.surname}/{passenger.givenName} · <span className="font-mono">{passenger.pnr}</span> · {passenger.cabin}</span>
          </span>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* sol: uçak bilgi paneli (mobilde üstte) */}
        <aside className="flex w-full flex-shrink-0 flex-col gap-4 overflow-y-auto border-b border-[var(--border-subtle)] bg-surface-alt p-4 lg:w-80 lg:border-b-0 lg:border-r lg:p-5">
          {flight.isLoading || !f ? <Skeleton className="h-64 w-full" /> : (
            <>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-secondary">Uçak Bilgileri</div>
                <div className="mt-2 flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-surface p-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded bg-accent-soft text-accent"><PlaneTakeoff size={20} strokeWidth={1.75} /></span>
                  <div>
                    <div className="text-sm font-semibold text-primary">{f.aircraft.type}</div>
                    <div className="font-mono text-[12px] text-tertiary">{f.aircraft.registration} · {f.aircraft.config}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Stat icon={<Hash size={14} strokeWidth={1.75} />} label="Konfigürasyon" value={f.aircraft.config} />
                <Stat icon={<Users size={14} strokeWidth={1.75} />} label="Kapasite" value={String(total || f.capacity)} />
                <Stat icon={<DoorOpen size={14} strokeWidth={1.75} />} label="Gate" value={f.gate ?? "—"} />
                <Stat icon={<Clock size={14} strokeWidth={1.75} />} label="Kalkış" value={formatDateTime(f.departure)} />
              </div>

              {/* doluluk */}
              <div className="rounded-md border border-[var(--border-subtle)] bg-surface p-3">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-secondary">Doluluk</span>
                  <span className="font-mono text-primary">{occupied}/{total}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-accent" style={{ width: `${total ? (occupied / total) * 100 : 0}%` }} /></div>
              </div>

              {/* koltuk kısıtları — DCS uygunluk kuralları (seatRules) */}
              {seatNotes.length > 0 && (
                <div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--warning-text)]">
                    <ShieldAlert size={13} strokeWidth={2} /> Koltuk Kısıtları
                  </div>
                  <ul className="flex flex-col gap-1 text-[12px] leading-snug text-[var(--warning-text)]">
                    {seatNotes.map((n) => <li key={n}>• {n}</li>)}
                  </ul>
                </div>
              )}

              {/* bagaj */}
              <div className="rounded-md border border-[var(--border-subtle)] bg-surface p-3">
                <div className="mb-2 text-[12px] text-secondary">Bagaj sayısı</div>
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="secondary" onClick={() => setBags((b) => Math.max(0, b - 1))}>−</Button>
                  <span className="inline-flex items-center gap-1 font-mono text-sm text-primary"><Luggage size={15} strokeWidth={1.75} />{bags}</span>
                  <Button size="sm" variant="secondary" onClick={() => setBags((b) => b + 1)}>+</Button>
                </div>
              </div>

              <div className="mt-auto flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary">Seçili koltuk</span>
                  <span className="font-mono font-semibold text-primary">{seat ?? "—"}</span>
                </div>
                <Button disabled={!seat || mutation.isPending} onClick={() => seat && passenger && mutation.mutate({ flightId, passengerId, seat, bags, idempotencyKey: idem })}>
                  {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> İşleniyor…</> : "Check-in Onayla"}
                </Button>
                <Button variant="secondary" onClick={back} disabled={mutation.isPending}>Vazgeç</Button>
              </div>
            </>
          )}
        </aside>

        {/* sağ: kabin */}
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto mb-4 flex w-fit items-center gap-1 rounded-lg bg-sunken p-1">
            {(["3d", "2d"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn("rounded px-4 py-1.5 text-[13px] font-medium uppercase transition-colors", view === v ? "bg-surface text-primary shadow-xs" : "text-secondary hover:text-primary")}>
                {v === "3d" ? "3D" : "2D"}
              </button>
            ))}
          </div>
          {seats.isLoading ? <Skeleton className="mx-auto h-[80vh] w-96" />
            : view === "3d"
            ? <Suspense fallback={<div className="flex h-[80vh] items-center justify-center text-secondary"><Loader2 size={20} className="animate-spin" /> <span className="ml-2 text-sm">3D kabin yükleniyor…</span></div>}>
                <Cabin3D seats={seats.data ?? []} selected={seat} onSelect={trySelect} />
              </Suspense>
            : <CabinMap big seats={seats.data ?? []} selected={seat} onSelect={trySelect} restrict={denialFor} />}
        </main>
      </div>
    </div>
    {success && f && <CheckInSuccess pax={success} flight={f} onDone={back} />}
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-surface p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-tertiary">{icon}{label}</div>
      <div className="mt-0.5 truncate font-mono text-[13px] font-medium text-primary">{value}</div>
    </div>
  );
}
