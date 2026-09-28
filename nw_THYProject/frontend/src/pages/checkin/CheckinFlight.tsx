import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { AlarmClock, FileCheck2, IdCard, Luggage, LockKeyhole, PlaneLanding, Printer, Undo2, UserCheck, Users } from "lucide-react";
import { advanceCouponStatus, takeAirportControl } from "@/domain/api";
import {
  apisMissing, boardAll, boardPassenger, checkinWindow, closeOutFlight, getFlight, isInternational,
  listPassengers, paxDocCheck, recordApis, undoCheckIn, GATE_CLOSE_MIN, LATE_REASONS, type CheckinPassenger,
} from "@/domain/checkin";
import { flightBoarded, flightLiveStatus } from "@/domain/ops";
import { paxSeatNotes } from "@/domain/seatRules";
import { Tip } from "@/components/tips/Tip";
import { SplitView, DetailHead, DetailBody, Chip } from "@/components/layout/views";
import { CloseOutModal, DocsModal, LateAcceptModal, VERDICT_PILL, VERDICT_TONE } from "@/components/checkin/DeskModals";
import { Banner } from "@/components/ui/banner";
import { usePerm } from "@/lib/usePerm";
import { FlightListPane } from "@/components/panes/FlightListPane";
import { BoardingPass } from "@/components/domain/BoardingPass";
import { Button, Field, Input, SearchInput } from "@/components/ui/core";
import { Panel, PanelHead, PanelBody, Stat, Empty } from "@/components/ui/surface";
import { Modal } from "@/components/ui/overlay";
import { Pill, type Tone } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useT, translate, type Key } from "@/i18n";
import { useErrorText } from "@/lib/useErrorText";
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

type Filter = "all" | "waiting" | "accepted" | "boarded" | "apis" | "docs" | "special";
const FILTER_LABEL: Record<Filter, Key> = {
  all: "desk.chip.all", waiting: "desk.chip.waiting", accepted: "desk.chip.accepted", boarded: "desk.chip.boarded",
  apis: "desk.chip.apis", docs: "desk.chip.docs", special: "desk.chip.special",
};

export function CheckinFlight() {
  const { flightId } = useParams({ from: "/checkin/$flightId" });
  const t = useT();
  const errText = useErrorText();
  // Koltuk kısıt notları domainden iki dilli gelir; okunacak dili arayüz seçer.
  const lang = useUI((s) => s.lang);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = useSearch({ from: "/checkin/$flightId" });
  const { can } = usePerm();
  const [tab, setTab] = useState<"checkin" | "boarding">("checkin");
  // Kalkış kontrolü panosundan yolcu adıyla gelindiyse liste o yolcuya süzülü açılır.
  const [q, setQ] = useState(search.pax ?? "");
  useEffect(() => { setQ(search.pax ?? ""); }, [flightId, search.pax]);
  const [filter, setFilter] = useState<Filter>("all");
  /** Seyahat belgesi kontrolü açık yolcu. */
  const [docsFor, setDocsFor] = useState<CheckinPassenger | null>(null);
  /** Geç kabul gerekçesi istenen yolcu. */
  const [lateFor, setLateFor] = useState<CheckinPassenger | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  // Kontuar penceresi saatle değişir: yarım dakikada bir yeniden hesapla.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(id); }, []);
  /** Biniş kartı önizlemesi — ETKT işaretli belge (1.2). */
  const [pass, setPass] = useState<CheckinPassenger | null>(null);
  /** APIS bilgisi girilecek yolcu (uluslararası uçuşta zorunlu). */
  const [apisFor, setApisFor] = useState<CheckinPassenger | null>(null);

  const { data: flight, isLoading } = useQuery({ queryKey: ["flight", flightId], queryFn: async () => (await getFlight(flightId)) ?? null });
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
          couponWarning = errText(e);
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
    onError: (e: Error) => toast.danger(t("checkin.toast.boardFailed"), errText(e)),
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
    onError: (e: Error) => toast.danger(t("checkin.toast.undoFailed"), errText(e)),
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
    onError: (e: Error) => toast.danger(t("checkin.toast.boardFailed"), errText(e)),
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
      setConfirmClose(false);
      toast.success(t("checkin.toast.closed.title"), t("checkin.toast.closed.body", { flown: r.flown, noshow: r.noShow.length }));
      refreshAll();
    },
    onError: (e: Error) => toast.danger(t("checkin.toast.closeFailed"), errText(e)),
  });

  /** Kabul öncesi havalimanı kontrolü al (O→A). */
  const takeControl = useMutation({
    mutationFn: async () => {
      const list = pax ?? [];
      let n = 0;
      let foreign = 0;
      for (const p of list) {
        if (!p.ticketNumber || p.couponSeq == null) continue;
        const r = await takeAirportControl(p.ticketNumber, p.couponSeq);
        if (r === "taken") n++;
        else if (r === "foreign") foreign++;
      }
      return { n, foreign };
    },
    onSuccess: ({ n, foreign }) => {
      const body = t("checkin.toast.control.body", { n }) + (foreign ? " " + t("checkin.toast.control.foreign", { n: foreign }) : "");
      toast.success(t("checkin.toast.control.title"), body);
      refreshAll();
    },
    onError: (e: Error) => toast.danger(t("checkin.toast.controlFailed"), errText(e)),
  });

  const intlFlight = flight ? isInternational(flight) : false;
  /** Süzgeç yüklemi — sayımlar ve liste aynı tanımı kullanır. */
  const matches = (p: CheckinPassenger, f: Filter): boolean => {
    switch (f) {
      case "waiting": return p.status === "not_checked";
      case "accepted": return p.status === "checked_in";
      case "boarded": return p.status === "boarded";
      case "apis": return intlFlight && p.status === "not_checked" && apisMissing(p).length > 0;
      case "docs": return intlFlight && !!flight && p.status === "not_checked" && paxDocCheck(p, flight).verdict !== "ok";
      case "special": return !!(p.ssr?.length || p.infant || p.child);
      default: return true;
    }
  };
  const tabRows = (pax ?? []).filter((p) => (tab === "checkin" ? p.status !== "boarded" : p.status !== "not_checked"));
  const rows = useMemo(() => {
    const s = q.trim().toUpperCase();
    return tabRows
      .filter((p) => matches(p, filter))
      .filter((p) => !s || `${p.surname} ${p.givenName} ${p.surname}/${p.givenName} ${p.pnr} ${p.ticketNumber ?? ""} ${p.passport ?? ""} ${p.nationalId ?? ""}`.toUpperCase().includes(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pax, tab, q, filter, flight]);

  const withList = (detail: React.ReactNode) => <SplitView list={<FlightListPane selected={flightId} />} detail={detail} />;
  if (isLoading) return withList(<DetailBody><Skeleton className="h-64 w-full" /></DetailBody>);
  if (!flight) return withList(<DetailBody><p className="text-sm text-ink-2">{t("checkin.flight.notFound")}</p></DetailBody>);

  const intl = isInternational(flight);
  const win = checkinWindow(flight, now);
  const canLate = can("checkin.override");
  const noShowIfClosed = (pax ?? []).filter((p) => p.status === "checked_in").length;
  const firstApisGap = intl ? rows.findIndex((p) => p.status === "not_checked" && apisMissing(p).length > 0) : -1;
  // Sayaçlar uçuşun TOPLAMINDAN gelir — HUB panosu ve uçuş listesiyle aynı
  // kaynak. Aşağıdaki liste tam manifest değil, bu ekranda işlem yapılabilen
  // yolcu örneğidir; önceden sayaçlar yalnız bu örnekten sayıldığı için liste
  // "96/190" derken detay aynı uçuşa "7/190" diyordu.
  const accepted = flight.checkedIn;
  const boarded = flightBoarded(flight, flightLiveStatus(flight));
  const waiting = (pax ?? []).filter((p) => p.status === "not_checked").length;

  return withList(
    <>
      <DetailHead
        back="/checkin"
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
                  <Button variant="secondary" size="sm" disabled={!can("checkin.board") || boardEveryone.isPending}
                    onClick={() => boardEveryone.mutate()}>
                    <Users size={15} strokeWidth={1.75} /> {t("checkin.flight.boardAll")}
                  </Button>
                )}
                <Tip id="checkin.closeout" />
                <Button variant="danger" size="sm" disabled={closeOut.isPending}
                  title={t("checkin.flight.closeOut.title")}
                  onClick={() => setConfirmClose(true)}>
                  <PlaneLanding size={15} strokeWidth={1.75} /> {t("checkin.flight.closeOut")}
                </Button>
              </>
            )}
          <div className="flex items-center gap-0.5 rounded-md bg-sunken p-0.5">
            {(["checkin", "boarding"] as const).map((k) => (
              <button
                key={k}
                onClick={() => { setTab(k); setFilter("all"); }}
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
        <div data-tour="checkin.stats" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

        {/* Kontuar penceresi — kabulün kuralı ekranın en görünür yerinde. */}
        {flight.status !== "departed" && flight.status !== "closed" && (
          win.state === "open" ? (
            <div className="flex items-center gap-2 text-[12.5px] text-ink-2">
              <AlarmClock size={14} strokeWidth={1.75} className="text-ink-3" />
              {t("desk.window.open", { time: new Date(win.closesAt).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }), n: win.closeMin })}
            </div>
          ) : win.state === "late" ? (
            <Banner kind="warning" title={t("desk.window.late.title")}>
              {t("desk.window.late.body", { m: win.minsToDeparture, g: GATE_CLOSE_MIN })}
            </Banner>
          ) : (
            <Banner kind="danger" title={t("desk.window.closed.title")}>{t("desk.window.closed.body")}</Banner>
          )
        )}

        <Panel data-tour="checkin.pax">
          <PanelHead
            title={tab === "checkin" ? t("checkin.panel.acceptance") : t("checkin.tab.boarding")}
            hint={`${flight.aircraft.type} · ${flight.aircraft.config} · ${t("checkin.panel.listed", { n: (pax ?? []).length })}`}
            action={<SearchInput className="w-64" value={q} onChange={setQ} placeholder={t("checkin.search.pax")} />}
          />
          <div className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5">
            {(tab === "checkin"
              ? (["all", "waiting", "accepted", ...(intl ? ["apis", "docs"] : []), "special"] as Filter[])
              : (["all", "accepted", "boarded", "special"] as Filter[])
            ).map((f) => (
              <Chip key={f} active={filter === f} count={tabRows.filter((p) => matches(p, f)).length} onClick={() => setFilter(f)}>
                {t(FILTER_LABEL[f])}
              </Chip>
            ))}
          </div>
          <PanelBody className="pt-1">
            {rows.length === 0 ? (
              <Empty icon={<Users size={22} strokeWidth={1.5} />} title={t("checkin.empty.pax.title")} hint={t("checkin.empty.pax.hint")} />
            ) : (
              rows.map((p, idx) => {
                const notes = paxSeatNotes(p, lang);
                // APIS kapısı: uluslararası uçuşta eksik bilgi kabul ettirmez.
                const gaps = intl && p.status === "not_checked" ? apisMissing(p, lang) : [];
                // Seyahat belgesi — dış hatta, henüz kabul edilmemiş yolcuda kabul kapısıdır.
                const docs = intl ? paxDocCheck(p, flight) : null;
                const docsBlocked = !!docs && p.status === "not_checked" && docs.verdict === "not_ok";
                const firstTime = p.status === "not_checked";
                const late = firstTime && win.state === "late";
                const shut = firstTime && win.state === "closed";
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-hair py-3 last:border-0">
                    {/* Dar ekranda aksiyonlar adın altına iner; rozetler adın üstüne binmez. */}
                    <div className="min-w-[min(100%,18rem)] flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[13.5px] font-medium text-ink">{p.surname}/{p.givenName}</span>
                        <Pill tone={PAX_TONE[p.status]}>{t(PAX_LABEL[p.status])}</Pill>
                        {p.cabin === "Business" && <Pill tone="violet">Business</Pill>}
                        {gaps.length > 0 && <Pill tone="amber">{t("checkin.pill.apisMissing")}</Pill>}
                        {docs && p.status === "not_checked" && docs.verdict !== "ok" && <Pill tone={VERDICT_TONE[docs.verdict]}>{t(VERDICT_PILL[docs.verdict])}</Pill>}
                        {p.lateAcceptance && (
                          <Pill tone="amber">
                            <span title={`${(() => { const r = LATE_REASONS.find((x) => x.code === p.lateAcceptance!.reason); return r ? (lang === "en" ? r.en : r.tr) : p.lateAcceptance!.reason; })()} · ${p.lateAcceptance.approvedBy}${p.lateAcceptance.note ? ` · ${p.lateAcceptance.note}` : ""}`}>{t("desk.pill.late")}</span>
                          </Pill>
                        )}
                        {/* ipucu listede yalnız ilk APIS eksiği satırında — her satırda nokta gürültüdür */}
                        {gaps.length > 0 && idx === firstApisGap && <Tip id="checkin.apis" />}
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
                    <div className="flex flex-wrap items-center gap-1.5">
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
                      {docs && firstTime && gaps.length === 0 && (
                        <Button variant={docs.verdict === "ok" ? "ghost" : "secondary"} size="sm" title={t("desk.action.docs.title")} onClick={() => setDocsFor(p)}>
                          <FileCheck2 size={15} strokeWidth={1.75} /> {t("desk.action.docs")}
                        </Button>
                      )}
                      {tab === "checkin" ? (
                        <Button
                          size="sm"
                          disabled={!can("checkin.accept") || gaps.length > 0 || docsBlocked || shut || (late && !canLate)}
                          title={
                            gaps.length ? t("checkin.action.apisMissingTitle", { list: gaps.join(", ") })
                              : docsBlocked ? t("desk.action.docsBlocked")
                                : shut ? t("desk.action.closedTitle")
                                  : late ? (canLate ? t("desk.action.late.title") : t("desk.action.lateLocked"))
                                    : undefined
                          }
                          variant={!firstTime ? "secondary" : late ? "secondary" : "primary"}
                          onClick={() => late
                            ? setLateFor(p)
                            : navigate({ to: "/checkin/$flightId/seat/$passengerId", params: { flightId, passengerId: p.id } })}
                        >
                          {late ? <AlarmClock size={15} strokeWidth={1.75} /> : <UserCheck size={15} strokeWidth={1.75} />}
                          {!firstTime ? t("checkin.action.changeSeat") : late ? t("desk.action.late") : t("checkin.action.accept")}
                        </Button>
                      ) : (
                        <Button variant="success" size="sm" disabled={!can("checkin.board") || p.status === "boarded" || board.isPending} onClick={() => board.mutate(p)}>
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

      {docsFor && (
        <DocsModal
          flight={flight}
          pax={(pax ?? []).find((x) => x.id === docsFor.id) ?? docsFor}
          onClose={() => setDocsFor(null)}
          onSaved={() => refreshAll()}
        />
      )}
      {lateFor && (
        <LateAcceptModal
          pax={lateFor}
          onClose={() => setLateFor(null)}
          onContinue={(l) => {
            const id = lateFor.id;
            setLateFor(null);
            navigate({ to: "/checkin/$flightId/seat/$passengerId", params: { flightId, passengerId: id }, search: { late: l.reason, note: l.note } });
          }}
        />
      )}
      {confirmClose && (
        <CloseOutModal noShow={noShowIfClosed} pending={closeOut.isPending} onClose={() => setConfirmClose(false)} onConfirm={() => closeOut.mutate()} />
      )}

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
  const errText = useErrorText();
  const [passport, setPassport] = useState(pax.passport ?? "");
  const [nationality, setNationality] = useState(pax.nationality ?? "");

  const save = useMutation({
    mutationFn: () => recordApis(flightId, pax.id, { passport, nationality }),
    onSuccess: (p) => { toast.success(t("checkin.toast.apis.title"), `${p.surname}/${p.givenName} · ${p.nationality} ${p.passport}`); onSaved(); },
    onError: (e: Error) => toast.danger(t("checkin.toast.apisFailed"), errText(e)),
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
