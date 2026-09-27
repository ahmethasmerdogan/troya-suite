import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AlarmClock, ArrowRight, CalendarX2, Check, Clock, Inbox, KeyRound, MessagesSquare, PlaneLanding, ShieldAlert, TriangleAlert,
} from "lucide-react";
import { listQueueItems } from "@/domain/api";
import { QUEUES, type QueueId, type QueueItem, type QueuePriority } from "@/domain/queues";
import { applyWork, useQueueWork } from "@/store/queueWork";
import { usePerm } from "@/lib/usePerm";
import { Button } from "@/components/ui/core";
import { PageTitle, Panel, PanelHead, PanelBody, Empty } from "@/components/ui/surface";
import { Pill, type Tone } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Tip } from "@/components/tips/Tip";
import { useT, type Key } from "@/i18n";
import { useUI } from "@/store/ui";
import { cn, formatDateTime, locale } from "@/lib/utils";

/**
 * Kuyruklar — gişenin günü burada başlar.
 *
 * Solda kuyruklar ve sayıları (Amadeus QT), sağda SIRADAKİ iş (QS) büyük
 * kartta: kaydı aç, bitir ve sonrakine geç (QN), ertele (QD). Altında
 * kuyruğun geri kalanı. Klavyeyle o / n / d.
 */
const ICON: Record<QueueId, typeof Inbox> = {
  ttl: AlarmClock, irrop: TriangleAlert, validity: CalendarX2, unused: PlaneLanding,
  control: KeyRound, revenue: ShieldAlert, interline: MessagesSquare,
};
const PRIO_TONE: Record<QueuePriority, Tone> = { high: "red", medium: "amber", low: "gray" };
const PRIO_KEY: Record<QueuePriority, Key> = { high: "queues.prio.high", medium: "queues.prio.medium", low: "queues.prio.low" };
const label = (q: QueueId) => `queues.q.${q}` as Key;

export function Queues() {
  const t = useT();
  const navigate = useNavigate();
  const lang = useUI((s) => s.lang);
  const { can } = usePerm();
  const work = useQueueWork();
  const [sel, setSel] = useState<QueueId | "all">("all");
  const [doneCount, setDoneCount] = useState(0);
  const { data, isLoading } = useQuery({
    // Kayıtlardan türer: sayfaya her dönüşte taze (işlem sonrası iş düşmüş olabilir).
    queryKey: ["queues"], queryFn: listQueueItems, staleTime: 0, refetchInterval: 30_000,
  });

  const visibleQueues = QUEUES.filter((q) => !q.perm || can(q.perm));
  const allowed = new Set(visibleQueues.map((q) => q.id));
  const now = Date.now();
  const items = useMemo(
    () => applyWork((data ?? []).filter((i) => allowed.has(i.queue)), work, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, work.done, work.delayed, visibleQueues.length],
  );
  const shown = sel === "all" ? items : items.filter((i) => i.queue === sel);
  const current = shown[0];

  const open = (i: QueueItem) => {
    if (i.refKind === "pnr") navigate({ to: "/res/$pnr", params: { pnr: i.ref } });
    else if (i.refKind === "message") navigate({ to: "/messages" });
    else navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: i.ref } });
  };
  const complete = (i: QueueItem) => {
    work.complete(i.id);
    setDoneCount((n) => n + 1);
    toast.success(t("queues.toast.done"), lang === "en" ? i.titleEn : i.title);
  };
  const delay = (i: QueueItem) => { work.delay(i.id); toast.info(t("queues.toast.delayed"), lang === "en" ? i.titleEn : i.title); };

  // o / n / d — yazı alanında ya da açık katmanda çalışmaz.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector('[role="dialog"]') || useUI.getState().commandOpen) return;
      if (e.key === "o") { e.preventDefault(); open(current); }
      else if (e.key === "n") { e.preventDefault(); complete(current); }
      else if (e.key === "d") { e.preventDefault(); delay(current); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const count = (q: QueueId | "all") => (q === "all" ? items : items.filter((i) => i.queue === q));

  return (
    <>
      <PageTitle
        title={t("queues.title")}
        hint={t("queues.hint")}
        aside={doneCount > 0 ? <Pill tone="green">{t("queues.completedToday", { n: doneCount })}</Pill> : undefined}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* --- kuyruklar (QT) --- */}
        <Panel data-tour="queues.list" className="self-start">
          <PanelBody className="flex flex-col gap-1 p-2">
            {(["all", ...visibleQueues.map((q) => q.id)] as (QueueId | "all")[]).map((q) => {
              const list = count(q);
              const urgent = list.filter((i) => i.priority === "high").length;
              const Icon = q === "all" ? Inbox : ICON[q];
              const def = QUEUES.find((x) => x.id === q);
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setSel(q)}
                  aria-pressed={sel === q}
                  aria-label={`${q === "all" ? t("queues.all") : `Q${def?.no} ${t(label(q))}`} · ${list.length}`}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors",
                    sel === q ? "bg-brand-wash" : "hover:bg-sunken",
                  )}
                >
                  <Icon size={16} strokeWidth={1.75} className={sel === q ? "text-brand" : "text-ink-3"} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[13px]", sel === q ? "font-semibold text-ink" : "text-ink")}>
                      {def && <span className="num mr-1.5 text-ink-3">Q{def.no}</span>}
                      {q === "all" ? t("queues.all") : t(label(q))}
                    </span>
                    {q !== "all" && <span className="block truncate text-[11.5px] text-ink-3">{t(`${label(q)}.hint` as Key)}</span>}
                  </span>
                  {urgent > 0 && <span className="num rounded-full bg-[var(--t-red-w)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--t-red-i)]">{urgent}</span>}
                  <span className="num w-6 text-right text-[12px] text-ink-2">{list.length}</span>
                </button>
              );
            })}
          </PanelBody>
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !current ? (
            <Panel><Empty icon={<Check size={22} strokeWidth={1.5} />} title={t("queues.empty.title")} hint={t("queues.empty.hint")} /></Panel>
          ) : (
            /* --- sıradaki iş (QS) --- */
            <Panel data-tour="queues.items" className="border-brand">
              <PanelHead
                title={<span className="inline-flex items-center gap-1.5">{t("queues.next")} <Tip id="queues.work" /></span>}
                hint={t("queues.keys")}
                action={<Pill tone={PRIO_TONE[current.priority]}>{t(PRIO_KEY[current.priority])}</Pill>}
              />
              <PanelBody className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[12px] text-ink-3">
                  {(() => { const Icon = ICON[current.queue]; return <Icon size={14} strokeWidth={1.75} />; })()}
                  <span>Q{QUEUES.find((q) => q.id === current.queue)?.no} · {t(label(current.queue))}</span>
                  {current.dueAt && (
                    <span className="num ml-auto inline-flex items-center gap-1"><Clock size={12} strokeWidth={1.75} /> {t("queues.due", { d: formatDateTime(current.dueAt) })}</span>
                  )}
                </div>
                <div className="num text-[18px] font-semibold tracking-[-0.01em] text-ink">{lang === "en" ? current.titleEn : current.title}</div>
                <p className="text-[13.5px] leading-relaxed text-ink-2">{lang === "en" ? current.detailEn : current.detail}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Button onClick={() => open(current)}>{t("queues.open")} <ArrowRight size={15} strokeWidth={1.75} /></Button>
                  <Button variant="secondary" onClick={() => complete(current)}><Check size={15} strokeWidth={1.75} /> {t("queues.done")}</Button>
                  <Button variant="ghost" onClick={() => delay(current)}><AlarmClock size={15} strokeWidth={1.75} /> {t("queues.delay")}</Button>
                </div>
              </PanelBody>
            </Panel>
          )}

          {shown.length > 1 && (
            <Panel>
              <PanelHead title={t("queues.rest")} hint={String(shown.length - 1)} />
              <PanelBody className="flex flex-col pt-1">
                {shown.slice(1).map((i) => {
                  const Icon = ICON[i.queue];
                  return (
                    <div key={i.id} className="flex items-center gap-3 border-b border-hair py-2.5 last:border-0">
                      <Icon size={15} strokeWidth={1.75} className="flex-shrink-0 text-ink-3" />
                      <div className="min-w-0 flex-1">
                        <div className="num truncate text-[13px] font-medium text-ink">{lang === "en" ? i.titleEn : i.title}</div>
                        <div className="truncate text-[12px] text-ink-3">
                          {i.delayedUntil
                            ? t("queues.delayed", { t: new Date(i.delayedUntil).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) })
                            : lang === "en" ? i.detailEn : i.detail}
                        </div>
                      </div>
                      <Pill tone={PRIO_TONE[i.priority]}>{t(PRIO_KEY[i.priority])}</Pill>
                      <button type="button" onClick={() => open(i)} aria-label={`${t("queues.open")} ${i.ref}`}
                        className="grid h-8 w-8 place-items-center rounded-md border border-line text-ink-2 hover:bg-sunken hover:text-ink">
                        <ArrowRight size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  );
                })}
              </PanelBody>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
