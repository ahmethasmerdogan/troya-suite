import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { IdCard, Luggage, LockKeyhole, PlaneLanding, Printer, Undo2, UserCheck, Users } from "lucide-react";
import { advanceCouponStatus, takeAirportControl } from "@/domain/api";
import {
  apisMissing, boardAll, boardPassenger, closeOutFlight, getFlight, isInternational,
  listPassengers, recordApis, undoCheckIn, type CheckinPassenger,
} from "@/domain/checkin";
import { paxSeatNotes } from "@/domain/seatRules";
import { SplitView, DetailHead, DetailBody } from "@/components/layout/views";
import { FlightListPane } from "@/components/panes/FlightListPane";
import { BoardingPass } from "@/components/domain/BoardingPass";
import { Button, Field, Input, SearchInput } from "@/components/ui/core";
import { Panel, PanelHead, PanelBody, Stat, Empty } from "@/components/ui/surface";
import { Modal } from "@/components/ui/overlay";
import { Pill, type Tone } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useT, translate, type Key } from "@/i18n";
import { useUI } from "@/store/ui";
import { formatDateTime, flightCode, locale } from "@/lib/utils";

// Uçuş detayı — yolcu kabul (check-in) ve biniş (boarding).
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** Kalkışa kalan — gişede en çok bakılan sayı. */
function countdown(iso: string): string {
  const m = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (m < 0) return translate("checkin.countdown.past", { time: formatDateTime(iso) });
  if (m < 60) return translate("checkin.countdown.min", { n: m });
  return translate("checkin.countdown.hour", { h: Math.floor(m / 60), m: m % 60 });
}

const PAX_TONE: Record<string, Tone> = { not_checked: "gray", checked_in: "blue", boarded: "green" };
const PAX_LABEL: Record<string, Key> = {
  not_checked: "checkin.pax.notChecked", checked_in: "checkin.pax.checkedIn", boarded: "checkin.pax.boarded",
};

export function CheckinFlight() {
  const { flightId } = useParams({ from: "/checkin/$flightId" });
  const t = useT();
  // Koltuk kısıt notları domainden iki dilli gelir; okunacak dili arayüz seçer.
  const lang = useUI((s) => s.lang);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"checkin" | "boarding">("checkin");
  const [q, setQ] = useState("");
  /** Biniş kartı önizlemesi — ETKT işaretli belge (1.2). */
  const [pass, setPass] = useState<CheckinPassenger | null>(null);
  /** APIS bilgisi girilecek yolcu (uluslararası uçuşta zorunlu). */
  const [apisFor, setApisFor] = useState<CheckinPassenger | null>(null);

  const { data: flight, isLoading } = useQuery({ queryKey: ["flight", flightId], queryFn: () => getFlight(flightId) });
  const { data: pax } = useQuery({ queryKey: ["pax", flightId], queryFn: () => listPassengers(flightId) });

  const refreshAll = (tn?: string) => {
    qc.invalidateQueries({ queryKey: ["pax", flightId] });
    qc.invalidateQueries({ queryKey: ["flight", flightId] });
    qc.invalidateQueries({ queryKey: ["flights"] });
    qc.invalidateQueries({ queryKey: ["opsBoard"] });
    qc.invalidateQueries({ queryKey: ["seatmap", flightId] });
    qc.invalidateQueries({ queryKey: ["tickets"] });
    if (tn) qc.invalidateQueries({ queryKey: ["ticket", tn] });
  };

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
      toast.success(
        t("checkin.toast.boarded.title"),
        t("checkin.toast.seatLine", { name: `${p.surname}/${p.givenName}`, seat: p.seat ?? "—" }),
      );
      if (couponWarning) toast.warning(t("checkin.toast.couponFailed"), couponWarning);
      qc.invalidateQueries({ queryKey: ["pax", flightId] });
      qc.invalidateQueries({ queryKey: ["opsBoard"] });
      qc.invalidateQueries({ queryKey: ["flights"] });
      qc.invalidateQueries({ queryKey: ["ticket", p.ticketNumber] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) => toast.danger(t("checkin.toast.boardFailed"), e.message),
  });

  /** Kabulü geri al: koltuk boşalır, kupon havalimanı kontrolüne (A) çekilir. */
  const undo = useMutation({
    mutationFn: async (p: CheckinPassenger) => {
      const done = await undoCheckIn(flightId, p.id);
      if (done.ticketNumber && done.couponSeq != null) {
        try { await advanceCouponStatus(done.ticketNumber, done.couponSeq, "A"); } catch { /* FSM reddi uyarı olarak yüzmez */ }
      }
      return done;
    },
    onSuccess: (p) => {
      toast.success(t("checkin.toast.undone.title"), t("checkin.toast.undone.body", { name: `${p.surname}/${p.givenName}` }));
      refreshAll(p.ticketNumber);
    },
    onError: (e: Error) => toast.danger(t("checkin.toast.undoFailed"), e.message),
  });

  /** Kabul edilmiş herkesi tek işlemde bindir. */
  const boardEveryone = useMutation({
    mutationFn: async () => {
      const done = await boardAll(flightId);
      for (const p of done) {
        if (p.ticketNumber && p.couponSeq != null) {
          try { await advanceCouponStatus(p.ticketNumber, p.couponSeq, "L"); } catch { /* yoksay */ }
        }
      }
      return done;
    },
    onSuccess: (list) => { toast.success(t("checkin.toast.boardAll.title"), t("checkin.toast.boardAll.body", { n: list.length })); refreshAll(); },
    onError: (e: Error) => toast.danger(t("checkin.toast.boardFailed"), e.message),
  });

  /**
   * Uçuş kapanışı — kupon zincirinin son halkası.
   * Binen yolcuların kuponları Flown'a geçer; kabul edilip binmeyenler no-show.
   */
  const closeOut = useMutation({
    mutationFn: async () => {
      const res = await closeOutFlight(flightId);
      let flown = 0;
      for (const p of res.boarded) {
        if (p.ticketNumber && p.couponSeq != null) {
          try { await advanceCouponStatus(p.ticketNumber, p.couponSeq, "F"); flown++; } catch { /* yoksay */ }
        }
      }
      return { ...res, flown };
    },
    onSuccess: (r) => {
      toast.success(t("checkin.toast.closed.title"), t("checkin.toast.closed.body", { flown: r.flown, noshow: r.noShow.length }));
      refreshAll();
    },
    onError: (e: Error) => toast.danger(t("checkin.toast.closeFailed"), e.message),
  });

  /** Kabul öncesi havalimanı kontrolü al (O→A). */
  const takeControl = useMutation({
    mutationFn: async () => {
      const list = pax ?? [];
      let n = 0;
      for (const p of list) {
        if (p.ticketNumber && p.couponSeq != null) { await takeAirportControl(p.ticketNumber, p.couponSeq); n++; }
      }
      return n;
    },
    onSuccess: (n) => { toast.success(t("checkin.toast.control.title"), t("checkin.toast.control.body", { n })); refreshAll(); },
    onError: (e: Error) => toast.danger(t("checkin.toast.controlFailed"), e.message),
  });

  const rows = useMemo(() => {
    const s = q.trim().toUpperCase();
    return (pax ?? [])
      .filter((p) => (tab === "checkin" ? p.status !== "boarded" : p.status !== "not_checked"))
      .filter((p) => !s || `${p.surname} ${p.givenName} ${p.pnr} ${p.ticketNumber ?? ""} ${p.passport ?? ""} ${p.nationalId ?? ""}`.toUpperCase().includes(s));
  }, [pax, tab, q]);

  const withList = (detail: React.ReactNode) => <SplitView list={<FlightListPane selected={flightId} />} detail={detail} />;
  if (isLoading) return withList(<DetailBody><Skeleton className="h-64 w-full" /></DetailBody>);
  if (!flight) return withList(<DetailBody><p className="text-sm text-ink-2">{t("checkin.flight.notFound")}</p></DetailBody>);

  const intl = isInternational(flight);
  const accepted = (pax ?? []).filter((p) => p.status !== "not_checked").length;
  const waiting = (pax ?? []).filter((p) => p.status === "not_checked").length;
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
          <>
            {/* Kupon zincirinin uçları: kontrol al → ... → uçuşu kapat (Flown) */}
            {flight.status !== "departed" && flight.status !== "closed" && (
              <>
                <Button variant="ghost" size="sm" disabled={takeControl.isPending}
                  title={t("checkin.flight.takeControl.title")}
                  onClick={() => takeControl.mutate()}>
                  <LockKeyhole size={15} strokeWidth={1.75} /> {t("checkin.flight.takeControl")}
                </Button>
                {tab === "boarding" && (
                  <Button variant="secondary" size="sm" disabled={boardEveryone.isPending}
                    onClick={() => boardEveryone.mutate()}>
                    <Users size={15} strokeWidth={1.75} /> {t("checkin.flight.boardAll")}
                  </Button>
                )}
                <Button variant="danger" size="sm" disabled={closeOut.isPending}
                  title={t("checkin.flight.closeOut.title")}
                  onClick={() => closeOut.mutate()}>
                  <PlaneLanding size={15} strokeWidth={1.75} /> {t("checkin.flight.closeOut")}
                </Button>
              </>
            )}
          <div className="flex items-center gap-0.5 rounded-md bg-sunken p-0.5">
            {(["checkin", "boarding"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`h-7 rounded-sm px-3 text-[12.5px] font-medium transition-colors ${tab === k ? "bg-panel text-ink" : "text-ink-2 hover:text-ink"}`}
              >
                {k === "checkin" ? t("checkin.tab.checkin") : t("checkin.tab.boarding")}
              </button>
            ))}
          </div>
          </>
        }
      />
      <DetailBody>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label={t("checkin.stat.departure")}
            value={new Date(flight.departure).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}
            hint={countdown(flight.departure)}
          />
          <Stat label={t("checkin.stat.capacity")} value={flight.capacity}
            hint={`${flight.aircraft.config} · ${intl ? t("checkin.flight.intl") : t("checkin.flight.domestic")}`} />
          <Stat label={t("checkin.stat.accepted")} value={accepted} unit={`/ ${flight.capacity}`}
            hint={t("checkin.flight.loadHint", { n: pct(accepted, flight.capacity) })} />
          <Stat label={t("checkin.pax.boarded")} value={boarded} unit={accepted ? `/ ${accepted}` : undefined} tone="var(--t-green-d)"
            hint={accepted ? t("checkin.flight.boardHint", { n: pct(boarded, accepted) }) : undefined} />
        </div>

        {/* Kabul → biniş ilerlemesi tek çubukta: gişe bir bakışta nerede olduğunu görür. */}
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
            <div className="h-full bg-[var(--t-green-d)] transition-[width]" style={{ width: `${pct(boarded, flight.capacity)}%` }} />
          </div>
          <span className="num text-[11.5px] text-ink-3">
            {t("checkin.flight.progress", { waiting, gate: accepted - boarded, boarded })}
          </span>
        </div>

        <Panel>
          <PanelHead
            title={tab === "checkin" ? t("checkin.panel.acceptance") : t("checkin.tab.boarding")}
            hint={flight.aircraft.type + " · " + flight.aircraft.config}
            action={<SearchInput className="w-64" value={q} onChange={setQ} placeholder={t("checkin.search.pax")} />}
          />
          <PanelBody className="pt-1">
            {rows.length === 0 ? (
              <Empty icon={<Users size={22} strokeWidth={1.5} />} title={t("checkin.empty.pax.title")} hint={t("checkin.empty.pax.hint")} />
            ) : (
              rows.map((p) => {
                const notes = paxSeatNotes(p, lang);
                // APIS kapısı: uluslararası uçuşta eksik bilgi kabul ettirmez.
                const gaps = intl && p.status === "not_checked" ? apisMissing(p) : [];
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-hair py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-medium text-ink">{p.surname}/{p.givenName}</span>
                        <Pill tone={PAX_TONE[p.status]}>{t(PAX_LABEL[p.status])}</Pill>
                        {p.cabin === "Business" && <Pill tone="violet">Business</Pill>}
                        {gaps.length > 0 && <Pill tone="amber">{t("checkin.pill.apisMissing")}</Pill>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11.5px] text-ink-3">
                        <span className="num">PNR {p.pnr}</span>
                        {p.ticketNumber && <span className="num">TKT {p.ticketNumber}</span>}
                        {p.seat && <span className="num">{t("checkin.row.seat", { seat: p.seat })}</span>}
                        <span className="inline-flex items-center gap-1"><Luggage size={12} strokeWidth={1.75} />{p.bags}</span>
                        {notes.map((n) => <span key={n} className="text-[var(--t-amber-i)]">{n}</span>)}
                        {gaps.length > 0 && (
                          <span className="text-[var(--t-amber-i)]">{t("checkin.row.apisGaps", { list: gaps.join(", ") })}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {p.status !== "not_checked" && (
                        <Button variant="ghost" size="sm" onClick={() => setPass(p)} title={t("checkin.action.boardingPass.title")}>
                          <Printer size={15} strokeWidth={1.75} /> {t("checkin.action.boardingPass")}
                        </Button>
                      )}
                      {p.status === "checked_in" && (
                        <Button variant="ghost" size="sm" disabled={undo.isPending}
                          title={t("checkin.action.undo.title")}
                          onClick={() => undo.mutate(p)}>
                          <Undo2 size={15} strokeWidth={1.75} /> {t("checkin.action.undo")}
                        </Button>
                      )}
                      {gaps.length > 0 && (
                        <Button variant="secondary" size="sm" title={t("checkin.action.apis.title")} onClick={() => setApisFor(p)}>
                          <IdCard size={15} strokeWidth={1.75} /> {t("checkin.action.apis")}
                        </Button>
                      )}
                      {tab === "checkin" ? (
                        <Button
                          size="sm"
                          disabled={gaps.length > 0}
                          title={gaps.length ? t("checkin.action.apisMissingTitle", { list: gaps.join(", ") }) : undefined}
                          variant={p.status === "not_checked" ? "primary" : "secondary"}
                          onClick={() => navigate({ to: "/checkin/$flightId/seat/$passengerId", params: { flightId, passengerId: p.id } })}
                        >
                          <UserCheck size={15} strokeWidth={1.75} />
                          {p.status === "not_checked" ? t("checkin.action.accept") : t("checkin.action.changeSeat")}
                        </Button>
                      ) : (
                        <Button variant="success" size="sm" disabled={p.status === "boarded" || board.isPending} onClick={() => board.mutate(p)}>
                          {p.status === "boarded" ? t("checkin.pax.boarded") : t("checkin.action.board")}
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
        title={t("checkin.action.boardingPass")}
        hint={t("checkin.pass.hint")}
        width="lg"
        footer={<Button variant="secondary" onClick={() => window.print()}><Printer size={15} strokeWidth={1.75} /> {t("checkin.print")}</Button>}
      >
        {pass && <BoardingPass flight={flight} pax={pass} />}
      </Modal>

      {/* APIS — uluslararası uçuşta yolcu bilgisi kalkıştan önce iletilir. */}
      {apisFor && (
        <ApisModal
          pax={apisFor}
          onClose={() => setApisFor(null)}
          onSaved={() => { setApisFor(null); refreshAll(); }}
          flightId={flightId}
        />
      )}
    </>,
  );
}

/**
 * APIS girişi — pasaport + uyruk.
 *
 * Gişede pasaport okutulduğunda dolan iki alan; tamamlanmadan uluslararası
 * uçuşta kabul açılmaz (`checkInPassenger` sunucu tarafında da reddeder).
 */
function ApisModal({
  pax, flightId, onClose, onSaved,
}: { pax: CheckinPassenger; flightId: string; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const [passport, setPassport] = useState(pax.passport ?? "");
  const [nationality, setNationality] = useState(pax.nationality ?? "");

  const save = useMutation({
    mutationFn: () => recordApis(flightId, pax.id, { passport, nationality }),
    onSuccess: (p) => { toast.success(t("checkin.toast.apis.title"), `${p.surname}/${p.givenName} · ${p.nationality} ${p.passport}`); onSaved(); },
    onError: (e: Error) => toast.danger(t("checkin.toast.apisFailed"), e.message),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={t("checkin.apis.title")}
      hint={t("checkin.apis.hint")}
      width="sm"
      footer={
        <Button variant="success" disabled={save.isPending || !passport.trim() || nationality.trim().length !== 2}
          onClick={() => save.mutate()}>
          {save.isPending ? t("checkin.apis.saving") : t("checkin.apis.save")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="text-[13px] text-ink-2">
          <b>{pax.surname}/{pax.givenName}</b> · PNR <span className="num">{pax.pnr}</span>
        </div>
        <Field label={t("checkin.apis.passport")} required>
          <Input value={passport} onChange={(e) => setPassport(e.target.value.toUpperCase())} placeholder="U07654321" className="uppercase num" />
        </Field>
        <Field label={t("checkin.apis.nationality")} required hint={t("checkin.apis.nationality.hint")}>
          <Input value={nationality} onChange={(e) => setNationality(e.target.value.toUpperCase())} maxLength={2} placeholder="TR" className="uppercase num" />
        </Field>
      </div>
    </Modal>
  );
}
