import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Radar } from "lucide-react";
import { OPS_STATUS_META, deriveOpsStatus, getOpsBoard, milestoneLabel, opsAlertText, opsStatusLabel, resolveAlert, type OpsFlight } from "@/domain/ops";
import { KIND_TONE } from "@/components/domain/statusTone";
import { Button } from "@/components/ui/core";
import { PageTitle, Panel, PanelHead, PanelBody, Stat, Empty } from "@/components/ui/surface";
import { Pill, type Tone } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

/**
 * HUB Kontrol — bilet → check-in → biniş → kalkış akışının tek ekranı.
 *
 * Board canlıdır (saniyede bir tik): geri sayım, statü ve risk rozetleri
 * kalkış saatine göre kendiliğinden ilerler. Sağdaki uyarılar önem sırasına
 * göre dizilir ve tek tıkla kapatılır.
 */
const SEV: Record<string, Tone> = { critical: "red", warning: "amber", info: "blue" };

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function HubControl() {
  const t = useT();
  const lang = useUI((s) => s.lang); // durum/uyarı/milestone metinleri domainden gelir, dili burada seçilir
  const qc = useQueryClient();
  const now = useNow();
  const [filter, setFilter] = useState<"all" | "boarding" | "risk" | "soon">("all");
  const [openFlight, setOpenFlight] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["opsBoard"], queryFn: getOpsBoard, refetchInterval: 15000 });

  const flights = data?.flights ?? [];
  const minsTo = (iso: string) => Math.round((new Date(iso).getTime() - now) / 60000);
  const riskOf = (f: OpsFlight) =>
    f.bagsOffloadPending + f.connectingRisk + f.specialPaxPending + (f.delayed ? 1 : 0) + (f.crewReady ? 0 : 1);

  const shown = useMemo(() => flights.filter((f) => {
    const st = deriveOpsStatus(minsTo(f.departure), f.baseStatus);
    if (filter === "boarding") return st === "boarding" || st === "final_call";
    if (filter === "risk") return riskOf(f) > 0;
    if (filter === "soon") return minsTo(f.departure) <= 60 && minsTo(f.departure) > -10;
    return true;
  }), [flights, filter, now]);

  const counts = {
    all: flights.length,
    boarding: flights.filter((f) => ["boarding", "final_call"].includes(deriveOpsStatus(minsTo(f.departure), f.baseStatus))).length,
    risk: flights.filter((f) => riskOf(f) > 0).length,
    soon: flights.filter((f) => minsTo(f.departure) <= 60 && minsTo(f.departure) > -10).length,
  };

  const selected = flights.find((f) => f.flightId === openFlight);
  const k = data?.kpis;

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  return (
    <>
      <PageTitle
        title={t("checkin.hub.title")}
        hint={t("checkin.hub.hint")}
        action={<Pill tone="green">{t("checkin.hub.live")}</Pill>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="OTP / D0" value={`%${k?.otpD0 ?? 0}`} tone="var(--t-green-i)" hint={t("checkin.hub.kpi.otp.hint")} />
        <Stat label={t("checkin.hub.kpi.boarding")} value={k?.byStage.boarding ?? 0} />
        <Stat label={t("checkin.hub.kpi.alerts")} value={(k?.openCritical ?? 0) + (k?.openWarning ?? 0)} tone="var(--t-red-i)" hint={t("checkin.hub.kpi.alerts.hint", { n: k?.openCritical ?? 0 })} />
        <Stat label={t("checkin.hub.kpi.boardedAccepted")} value={`${k?.boarded ?? 0}/${k?.accepted ?? 0}`} hint={t("checkin.hub.kpi.noShow", { n: k?.noShow ?? 0 })} />
        <Stat label={t("checkin.hub.kpi.mct")} value={k?.mctRisk ?? 0} tone="var(--t-amber-i)" hint={t("checkin.hub.kpi.mct.hint")} />
        <Stat label={t("checkin.hub.kpi.bags")} value={k?.bagOffload ?? 0} tone="var(--t-red-i)" hint={t("checkin.hub.kpi.bags.hint")} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <Panel>
          <PanelHead
            title={t("checkin.hub.board")}
            hint={t("checkin.hub.board.hint", { shown: shown.length, total: flights.length })}
            action={
              <div className="flex flex-wrap items-center gap-1">
                {([
                  ["all", "checkin.hub.filter.all"],
                  ["boarding", "checkin.hub.filter.boarding"],
                  ["risk", "checkin.hub.filter.risk"],
                  ["soon", "checkin.hub.filter.soon"],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setFilter(id)}
                    className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                      filter === id ? "border-brand bg-brand-wash text-brand" : "border-line text-ink-2 hover:bg-sunken hover:text-ink")}
                  >
                    {t(label)}<span className="num text-[11px] opacity-70">{counts[id]}</span>
                  </button>
                ))}
              </div>
            }
          />
          <PanelBody className="flex flex-col gap-2 pt-2">
            {shown.length === 0 ? (
              <Empty icon={<Radar size={22} strokeWidth={1.5} />} title={t("checkin.hub.empty.title")} hint={t("checkin.hub.empty.hint")} />
            ) : shown.map((f) => {
              const mins = minsTo(f.departure);
              const st = deriveOpsStatus(mins, f.baseStatus);
              const meta = OPS_STATUS_META[st];
              const pct = f.accepted ? Math.round((f.boarded / f.accepted) * 100) : 0;
              const risk = riskOf(f);
              return (
                <button
                  key={f.flightId}
                  onClick={() => setOpenFlight(f.flightId === openFlight ? null : f.flightId)}
                  aria-label={`${f.flightNumber} ${f.destination}`}
                  className={cn("flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                    f.flightId === openFlight ? "border-brand bg-brand-wash" : "border-line bg-raised hover:bg-sunken")}
                >
                  <span className="w-20 flex-shrink-0">
                    <span className="num block text-[13.5px] font-semibold text-ink">{f.flightNumber}</span>
                    <span className="num block text-[11px] text-ink-3">{f.destination}</span>
                  </span>
                  <Pill tone={KIND_TONE[meta.tone] ?? "gray"}>{opsStatusLabel(st, lang)}</Pill>
                  <span className={cn("num w-20 text-[14px] font-semibold",
                    st === "departed" ? "text-ink-3" : mins <= 15 ? "text-[var(--t-red-i)]" : mins <= 30 ? "text-[var(--t-amber-i)]" : "text-ink")}>
                    {st === "departed" ? t("checkin.hub.departed") : t("checkin.hub.mins", { n: Math.max(0, mins) })}
                  </span>
                  <span className="min-w-32 flex-1">
                    <span className="num text-[11.5px] text-ink-3">{t("checkin.hub.boardingLine", { boarded: f.boarded, accepted: f.accepted, pct })}</span>
                    <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-sunken">
                      <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 90 ? "var(--t-green-d)" : "var(--brand)" }} />
                    </span>
                  </span>
                  {f.gate && <span className="num text-[12px] text-ink-2">{f.gate}</span>}
                  {risk > 0 && <Pill tone="amber">{t("checkin.hub.risk", { n: risk })}</Pill>}
                </button>
              );
            })}
          </PanelBody>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHead title={t("checkin.hub.alerts")} hint={t("checkin.hub.alerts.hint", { n: data.alerts.length })} />
            <PanelBody className="flex flex-col gap-2 pt-2">
              {data.alerts.length === 0 ? (
                <Empty title={t("checkin.hub.alerts.empty.title")} hint={t("checkin.hub.alerts.empty.hint")} />
              ) : data.alerts.map((a) => {
                const txt = opsAlertText(a, lang);
                return (
                  <div key={a.id} className="rounded-md border border-line bg-raised p-3">
                    <div className="flex items-start gap-2">
                      <Pill tone={SEV[a.severity] ?? "gray"}>{a.flightNumber}</Pill>
                      <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink">{txt.title}</span>
                      <Button size="sm" variant="secondary" onClick={() => {
                        resolveAlert(a.id);
                        qc.invalidateQueries({ queryKey: ["opsBoard"] });
                        toast.success(t("checkin.hub.applied"), txt.action);
                      }}>
                        <Check size={14} strokeWidth={2.5} /> {t("checkin.hub.apply")}
                      </Button>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{txt.detail}</p>
                    <p className="mt-1 text-[12px] font-medium text-brand">→ {txt.action}</p>
                  </div>
                );
              })}
            </PanelBody>
          </Panel>

          {selected && (
            <Panel>
              <PanelHead title={`${selected.flightNumber} · ${selected.destCity}`} hint={`${selected.aircraftType} · ${selected.registration}`} />
              <PanelBody className="flex flex-col gap-4">
                <div>
                  <div className="microlabel mb-2">{t("checkin.hub.funnel")}</div>
                  <div className="flex flex-col gap-1.5">
                    {([
                      ["checkin.hub.funnel.booked", selected.booked],
                      ["checkin.stat.accepted", selected.accepted],
                      ["checkin.hub.funnel.gate", selected.atGate],
                      ["checkin.pax.boarded", selected.boarded],
                    ] as const).map(([l, v]) => (
                      <div key={l} className="flex items-center gap-2 text-[12.5px]">
                        <span className="w-16 text-ink-2">{t(l)}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                          <span className="block h-full rounded-full bg-brand" style={{ width: `${selected.booked ? (v / selected.booked) * 100 : 0}%` }} />
                        </span>
                        <span className="num w-10 text-right text-ink">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="microlabel mb-2">{t("checkin.hub.notBoarded")}</div>
                  {selected.paxList.filter((p) => !p.boarded).slice(0, 6).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 border-b border-hair py-1.5 text-[12.5px] last:border-0">
                      <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
                      {p.special && <Pill tone="violet">{p.special}</Pill>}
                      {p.mctMin != null && <Pill tone="amber">{t("checkin.hub.mct", { n: p.mctMin })}</Pill>}
                      <span className="num text-ink-3">{p.seat ?? "—"}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="microlabel mb-2">{t("checkin.hub.milestones")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.milestones.map((m) => (
                      <Pill key={m.code} tone={m.actual ? "green" : "gray"} title={milestoneLabel(m, lang)}>{m.code}</Pill>
                    ))}
                  </div>
                </div>
              </PanelBody>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
