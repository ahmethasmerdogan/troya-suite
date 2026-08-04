import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Luggage, Printer, UserCheck, Users } from "lucide-react";
import { advanceCouponStatus } from "@/domain/api";
import { boardPassenger, getFlight, listPassengers, type CheckinPassenger } from "@/domain/checkin";
import { paxSeatNotes } from "@/domain/seatRules";
import { SplitView, DetailHead, DetailBody } from "@/components/layout/views";
import { FlightListPane } from "@/components/panes/FlightListPane";
import { BoardingPass } from "@/components/domain/BoardingPass";
import { Button, SearchInput } from "@/components/ui/core";
import { Panel, PanelHead, PanelBody, Stat, Empty } from "@/components/ui/surface";
import { Modal } from "@/components/ui/overlay";
import { Pill, type Tone } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { formatDateTime, flightCode } from "@/lib/utils";

// Uçuş detayı — yolcu kabul (check-in) ve biniş (boarding).
const PAX_TONE: Record<string, Tone> = { not_checked: "gray", checked_in: "blue", boarded: "green" };
const PAX_LABEL: Record<string, string> = { not_checked: "Kabul bekliyor", checked_in: "Check-in", boarded: "Bindi" };

export function CheckinFlight() {
  const { flightId } = useParams({ from: "/checkin/$flightId" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"checkin" | "boarding">("checkin");
  const [q, setQ] = useState("");
  /** Biniş kartı önizlemesi — ETKT işaretli belge (1.2). */
  const [pass, setPass] = useState<CheckinPassenger | null>(null);

  const { data: flight, isLoading } = useQuery({ queryKey: ["flight", flightId], queryFn: () => getFlight(flightId) });
  const { data: pax } = useQuery({ queryKey: ["pax", flightId], queryFn: () => listPassengers(flightId) });

  /** Biniş kuponu C→L'ye taşır (lifted/boarded) — bilet tarafıyla senkron. */
  const board = useMutation({
    mutationFn: async (p: CheckinPassenger) => {
      const done = await boardPassenger(flightId, p.id);
      let couponWarning: string | null = null;
      if (done.ticketNumber && done.couponSeq != null) {
        try {
          await advanceCouponStatus(done.ticketNumber, done.couponSeq, "L");
        } catch (e) {
          couponWarning = (e as Error).message;
        }
      }
      return { pax: done, couponWarning };
    },
    onSuccess: ({ pax: p, couponWarning }) => {
      toast.success("Yolcu bindirildi", `${p.surname}/${p.givenName} · koltuk ${p.seat ?? "—"}`);
      if (couponWarning) toast.warning("Kupon ilerletilemedi", couponWarning);
      qc.invalidateQueries({ queryKey: ["pax", flightId] });
      qc.invalidateQueries({ queryKey: ["opsBoard"] });
      qc.invalidateQueries({ queryKey: ["flights"] });
      qc.invalidateQueries({ queryKey: ["ticket", p.ticketNumber] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) => toast.danger("Bindirilemedi", e.message),
  });

  const rows = useMemo(() => {
    const s = q.trim().toUpperCase();
    return (pax ?? [])
      .filter((p) => (tab === "checkin" ? p.status !== "boarded" : p.status !== "not_checked"))
      .filter((p) => !s || `${p.surname} ${p.givenName} ${p.pnr} ${p.ticketNumber ?? ""} ${p.passport ?? ""} ${p.nationalId ?? ""}`.toUpperCase().includes(s));
  }, [pax, tab, q]);

  const withList = (detail: React.ReactNode) => <SplitView list={<FlightListPane selected={flightId} />} detail={detail} />;
  if (isLoading) return withList(<DetailBody><Skeleton className="h-64 w-full" /></DetailBody>);
  if (!flight) return withList(<DetailBody><p className="text-sm text-ink-2">Uçuş bulunamadı.</p></DetailBody>);

  const accepted = (pax ?? []).filter((p) => p.status !== "not_checked").length;
  const boarded = (pax ?? []).filter((p) => p.status === "boarded").length;

  return withList(
    <>
      <DetailHead
        title={
          <>
            <span className="num text-[19px] font-semibold text-ink">{flightCode(flight.carrier, flight.flightNumber)}</span>
            <span className="num text-[14px] text-ink-2">{flight.origin} → {flight.destination}</span>
            {flight.gate && <Pill tone="gray">Gate {flight.gate}</Pill>}
          </>
        }
        actions={
          <div className="flex items-center gap-0.5 rounded-md bg-sunken p-0.5">
            {(["checkin", "boarding"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`h-7 rounded-sm px-3 text-[12.5px] font-medium transition-colors ${tab === k ? "bg-panel text-ink" : "text-ink-2 hover:text-ink"}`}
              >
                {k === "checkin" ? "Check-in" : "Biniş"}
              </button>
            ))}
          </div>
        }
      />
      <DetailBody>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Kalkış" value={new Date(flight.departure).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} hint={formatDateTime(flight.departure)} />
          <Stat label="Kapasite" value={flight.capacity} />
          <Stat label="Kabul" value={accepted} unit={`/ ${flight.capacity}`} />
          <Stat label="Bindi" value={boarded} tone="var(--t-green-d)" />
        </div>

        <Panel>
          <PanelHead
            title={tab === "checkin" ? "Yolcu kabul" : "Biniş"}
            hint={flight.aircraft.type + " · " + flight.aircraft.config}
            action={<SearchInput className="w-64" value={q} onChange={setQ} placeholder="Yolcu · PNR · pasaport · TC" />}
          />
          <PanelBody className="pt-1">
            {rows.length === 0 ? (
              <Empty icon={<Users size={22} strokeWidth={1.5} />} title="Yolcu yok" hint="Bu sekmede eşleşen yolcu bulunmuyor." />
            ) : (
              rows.map((p) => {
                const notes = paxSeatNotes(p);
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-hair py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-medium text-ink">{p.surname}/{p.givenName}</span>
                        <Pill tone={PAX_TONE[p.status]}>{PAX_LABEL[p.status]}</Pill>
                        {p.cabin === "Business" && <Pill tone="violet">Business</Pill>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11.5px] text-ink-3">
                        <span className="num">PNR {p.pnr}</span>
                        {p.ticketNumber && <span className="num">TKT {p.ticketNumber}</span>}
                        {p.seat && <span className="num">Koltuk {p.seat}</span>}
                        <span className="inline-flex items-center gap-1"><Luggage size={12} strokeWidth={1.75} />{p.bags}</span>
                        {notes.map((n) => <span key={n} className="text-[var(--t-amber-i)]">{n}</span>)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {p.status !== "not_checked" && (
                        <Button variant="ghost" size="sm" onClick={() => setPass(p)} title="Biniş kartı (ETKT)">
                          <Printer size={15} strokeWidth={1.75} /> Biniş kartı
                        </Button>
                      )}
                      {tab === "checkin" ? (
                        <Button
                          size="sm"
                          variant={p.status === "not_checked" ? "primary" : "secondary"}
                          onClick={() => navigate({ to: "/checkin/$flightId/seat/$passengerId", params: { flightId, passengerId: p.id } })}
                        >
                          <UserCheck size={15} strokeWidth={1.75} />
                          {p.status === "not_checked" ? "Kabul et" : "Koltuk değiştir"}
                        </Button>
                      ) : (
                        <Button variant="success" size="sm" disabled={p.status === "boarded" || board.isPending} onClick={() => board.mutate(p)}>
                          {p.status === "boarded" ? "Bindi" : "Bindir"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </PanelBody>
        </Panel>
      </DetailBody>

      {/* Biniş dokümanı — ET karşılığı verilen belge; üzerinde ETKT işareti (1.2). */}
      <Modal
        open={!!pass}
        onClose={() => setPass(null)}
        title="Biniş kartı"
        hint="Elektronik bilet karşılığı düzenlenen biniş belgesi — ETKT işareti ve doküman numarası taşır (Handbook 1.2)."
        width="lg"
        footer={<Button variant="secondary" onClick={() => window.print()}><Printer size={15} strokeWidth={1.75} /> Yazdır</Button>}
      >
        {pass && <BoardingPass flight={flight} pax={pass} />}
      </Modal>
    </>,
  );
}
