import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { useT } from "@/i18n";
import { useTips } from "@/store/tips";
import { tourById, tourFor, type Tour } from "./catalog";
import { placeCard } from "./place";

/* ====================================================================
   Ekran turu — spot ışıklı adım adım gezinti.

   Her adım ekrandaki bir `data-tour` işaretine bağlıdır. İşaret yoksa
   (yetki gizlemiş, liste boş, dar ekran) adım atlanır; hiç işaret yoksa
   tur hiç başlamaz. Tur sayfayı kilitlemez ama tıklamayı perdeyle keser:
   personel turu bitirmeden yanlışlıkla bir işlem başlatmasın.
   ==================================================================== */

const PAD = 6;
const CARD_W = 340;

function findTarget(name: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  // Görünür olan ilk eşleşme (mobil/masaüstü kopyalarından biri gizli olabilir).
  return all.find((el) => el.getClientRects().length > 0) ?? null;
}

export function TourHost() {
  const active = useTips((s) => s.activeTour);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const endTour = useTips((s) => s.endTour);
  const tour = active ? tourById(active) : undefined;
  const here = !!tour && tour.match(path);
  // Profilden başlatılan tur hedef ekrana varılana kadar bekler; tur
  // sürerken başka ekrana geçildiyse kısa bir süre sonra kapanır.
  useEffect(() => {
    if (!tour || here) return;
    const id = window.setTimeout(endTour, 2500);
    return () => window.clearTimeout(id);
  }, [tour, here, endTour]);
  if (!tour || !here) return null;
  return <TourRunner key={tour.id} tour={tour} />;
}

function TourRunner({ tour }: { tour: Tour }) {
  const t = useT();
  const endTour = useTips((s) => s.endTour);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const dir = useRef<1 | -1>(1);
  const card = useRef<HTMLDivElement>(null);

  // Görünür adımlar — sayaç "3 / 5" gerçekte gösterilecek adımları saysın.
  // Tur bir sayfaya gidilirken başlatılmış olabilir (profil → ekran): kabuk
  // hedefleri hemen, sayfa hedefleri veri yüklenince belirir. Kullanıcı ilk
  // adımdayken kısa bir süre yeniden bakılır ve bulunan hedefler eklenir;
  // hiç hedef çıkmazsa tur sessizce kapanır.
  const resolve = () => tour.steps.filter((s) => findTarget(s.target));
  const [steps, setSteps] = useState(resolve);
  const step = steps[i];

  useEffect(() => {
    if (i !== 0) return;
    let tries = 0;
    const id = window.setInterval(() => {
      const found = resolve();
      setSteps((cur) => (found.length > cur.length ? found : cur));
      if (++tries >= 10) {
        window.clearInterval(id);
        if (found.length === 0) endTour();
      }
    }, 150);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i === 0]);

  useLayoutEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (!el) {
      // Tur sırasında kaybolan hedef: yönde ilerle.
      const next = i + dir.current;
      if (next < 0 || next >= steps.length) endTour();
      else setI(next);
      return;
    }
    const r0 = el.getBoundingClientRect();
    if (r0.top < 64 || r0.bottom > window.innerHeight - 24) el.scrollIntoView({ block: "center" });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step, i, steps.length, endTour]);

  // Kart hedefin altına ya da üstüne; ölçü karttan okunur.
  useLayoutEffect(() => {
    if (!rect || !card.current) return;
    const r = placeCard(
      { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 },
      { width: card.current.offsetWidth, height: card.current.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    setPos({ top: r.top, left: r.left });
  }, [rect, i]);

  useEffect(() => { card.current?.focus(); }, [i]);

  const go = (d: 1 | -1) => {
    dir.current = d;
    const n = i + d;
    if (n >= steps.length) endTour();
    else if (n >= 0) setI(n);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); endTour(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  if (!step) return null;
  const last = i === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[60]" data-print-hide>
      {/* perde: tıklamayı keser, spot ışığı ayrı katmanda çizilir */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      {rect && (
        <div
          className="tour-spot"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
        />
      )}
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        className="anim-pop absolute rounded-lg border border-line bg-panel p-4 outline-none"
        style={{ width: CARD_W, maxWidth: "calc(100vw - 24px)", ...(pos ?? { top: -9999, left: -9999 }) }}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-wash text-brand"><Compass size={14} strokeWidth={1.75} /></span>
          <span className="microlabel">{t(tour.name)}</span>
          <span className="num ml-auto text-[11.5px] text-ink-3">{t("tips.stepOf", { i: i + 1, n: steps.length })}</span>
          <button type="button" onClick={endTour} aria-label={t("tips.skip")} title={t("tips.skip")}
            className="grid h-6 w-6 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink">
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
        <h2 id="tour-title" className="mt-2.5 text-[15px] font-semibold tracking-[-0.01em] text-ink">{t(step.title)}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{t(step.body)}</p>
        {/* ilerleme noktaları */}
        <div className="mt-3 flex items-center gap-1" aria-hidden>
          {steps.map((s, k) => (
            <span key={s.target} className={k === i ? "h-1.5 w-4 rounded-full bg-brand" : "h-1.5 w-1.5 rounded-full bg-line-firm"} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="hidden text-[11px] text-ink-3 sm:block">{t("tips.keysHint")}</span>
          <div className="ml-auto flex items-center gap-1.5">
            {i > 0 && (
              <button type="button" onClick={() => go(-1)}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-[12.5px] font-medium text-ink-2 hover:bg-sunken hover:text-ink">
                <ArrowLeft size={13} strokeWidth={2} /> {t("tips.prev")}
              </button>
            )}
            <button type="button" onClick={() => go(1)}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-brand px-3.5 text-[12.5px] font-semibold text-white hover:bg-[var(--brand-hover)]">
              {last ? t("tips.finish") : t("tips.next")} {!last && <ArrowRight size={13} strokeWidth={2} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Tur önerisi — ipuçları açık kullanıcı turu olan bir ekrana İLK kez
 * geldiğinde üst şeritte bir satır. Yüzmez, hiçbir kontrolün üstüne
 * binmez; "Şimdi değil" bir daha sormaz (tur yardım menüsünde durur).
 */
export function TourPrompt() {
  const t = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const tour = tourFor(path);
  const show = useTips((s) =>
    !!tour && s.enabled && s.onboarded && s.activeTour === null && !s.tours.includes(tour.id));
  const startTour = useTips((s) => s.startTour);
  const skipTour = useTips((s) => s.skipTour);
  if (!show || !tour) return null;

  return (
    <div data-print-hide className="anim-fade flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-brand-wash px-4 py-2 text-[13px] sm:px-6">
      <Compass size={15} strokeWidth={1.75} className="flex-shrink-0 text-brand" />
      <span className="font-semibold text-ink">{t("tips.prompt.title")}</span>
      <span className="hidden text-ink-2 md:inline">{t("tips.prompt.body", { name: t(tour.name) })}</span>
      <span className="ml-auto flex items-center gap-2">
        <button type="button" onClick={() => skipTour(tour.id)} title={t("tips.prompt.laterHint")}
          className="rounded-full px-3 py-1 text-[12.5px] text-ink-2 hover:bg-panel hover:text-ink">
          {t("tips.prompt.later")}
        </button>
        <button type="button" onClick={() => startTour(tour.id)}
          className="inline-flex items-center gap-1 rounded-full bg-brand px-3.5 py-1 text-[12.5px] font-semibold text-white hover:bg-[var(--brand-hover)]">
          {t("tips.prompt.start")} <ArrowRight size={13} strokeWidth={2} />
        </button>
      </span>
    </div>
  );
}
