import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Command, Compass, HelpCircle, Keyboard, LayoutDashboard, Lightbulb } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { Button, Checkbox, Kbd } from "@/components/ui/core";
import { MODULES } from "@/modules";
import { useT } from "@/i18n";
import { useTips } from "@/store/tips";
import { tourFor } from "./catalog";

/**
 * Karşılama — girişten sonra bir kez, üç kısa sayfa.
 *
 * 1) modüller  2) klavye  3) ipuçları + tur. Son sayfadaki onay kutusu
 * ekran ipuçlarını açar (varsayılan açık). Kapatmak da "tamamlandı" sayılır;
 * personeli ikinci kez karşılamayla durdurmayız.
 */
export function Onboarding() {
  const t = useT();
  const onboarded = useTips((s) => s.onboarded);
  const finish = useTips((s) => s.finishOnboarding);
  const startTour = useTips((s) => s.startTour);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [page, setPage] = useState(0);
  const [showTips, setShowTips] = useState(true);
  if (onboarded) return null;

  const PAGES = 3;
  const close = () => finish(showTips);
  const tour = tourFor(path);

  return (
    <Modal
      open
      onClose={close}
      title={t("tips.onb.title")}
      hint={t("tips.onb.step", { i: page + 1, n: PAGES })}
      width="md"
      footer={
        <>
          {page > 0 && (
            <Button variant="ghost" onClick={() => setPage(page - 1)}>
              <ArrowLeft size={15} strokeWidth={1.75} /> {t("tips.prev")}
            </Button>
          )}
          <span className="mr-auto" />
          {page < PAGES - 1 ? (
            <Button onClick={() => setPage(page + 1)}>
              {t("tips.next")} <ArrowRight size={15} strokeWidth={1.75} />
            </Button>
          ) : (
            <>
              {tour && showTips && (
                <Button variant="secondary" onClick={() => { close(); startTour(tour.id); }}>
                  <Compass size={15} strokeWidth={1.75} /> {t("tips.onb.tour")}
                </Button>
              )}
              <Button onClick={close}>{t("tips.onb.start")} <ArrowRight size={15} strokeWidth={1.75} /></Button>
            </>
          )}
        </>
      }
    >
      <div className="flex min-h-[250px] flex-col gap-4">
        {/* sayfa göstergesi */}
        <div className="flex items-center gap-1" aria-hidden>
          {Array.from({ length: PAGES }).map((_, k) => (
            <span key={k} className={k === page ? "h-1.5 w-6 rounded-full bg-brand" : "h-1.5 w-1.5 rounded-full bg-line-firm"} />
          ))}
        </div>

        {page === 0 && (
          <div className="anim-rise flex flex-col gap-3">
            <h3 className="text-[15px] font-semibold text-ink">{t("tips.onb.s1.title")}</h3>
            <p className="text-[13.5px] leading-relaxed text-ink-2">{t("tips.onb.s1.body")}</p>
            <div className="anim-stagger flex flex-col gap-2">
              <ModuleRow icon={<LayoutDashboard size={18} strokeWidth={1.75} />} name={t("module.panel")} sub={t("tips.onb.panel")} />
              {MODULES.map((m) => (
                <ModuleRow key={m.id} icon={<m.icon size={18} strokeWidth={1.75} />} name={t(m.labelKey)} sub={t(m.subKey)} />
              ))}
            </div>
          </div>
        )}

        {page === 1 && (
          <div className="anim-rise flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Keyboard size={17} strokeWidth={1.75} className="text-brand" /> {t("tips.onb.s2.title")}
            </h3>
            <p className="text-[13.5px] leading-relaxed text-ink-2">{t("tips.onb.s2.body")}</p>
            <div className="flex flex-col divide-y divide-[var(--hair)] rounded-md border border-line">
              <KeyRow keys={<><Kbd><Command size={10} strokeWidth={2} />K</Kbd><span className="text-ink-3">/</span><Kbd>Ctrl K</Kbd></>} label={t("tips.onb.k.palette")} />
              <KeyRow keys={<Kbd><HelpCircle size={11} strokeWidth={2} /></Kbd>} label={t("tips.onb.k.help")} />
              <KeyRow keys={<><Kbd>e</Kbd><Kbd>r</Kbd><Kbd>v</Kbd></>} label={t("tips.onb.k.erv")} />
            </div>
          </div>
        )}

        {page === 2 && (
          <div className="anim-rise flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Lightbulb size={17} strokeWidth={1.75} className="text-brand" /> {t("tips.onb.s3.title")}
            </h3>
            <div className="flex items-start gap-3 rounded-md border border-line bg-raised p-3">
              <span className="tip-beacon mt-0.5" aria-hidden><span /></span>
              <p className="text-[13.5px] leading-relaxed text-ink-2">{t("tips.onb.s3.body")}</p>
            </div>
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-2">
              <Compass size={15} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-ink-3" /> {t("tips.onb.s3.tour")}
            </p>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line p-3 hover:bg-raised">
              <Checkbox checked={showTips} onChange={(e) => setShowTips(e.target.checked)} className="mt-0.5" />
              <span>
                <span className="block text-[13.5px] font-medium text-ink">{t("tips.onb.showTips")}</span>
                <span className="block text-[12px] text-ink-3">{t("tips.onb.showTipsHint")}</span>
              </span>
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ModuleRow({ icon, name, sub }: { icon: React.ReactNode; name: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-raised px-3 py-2.5">
      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md bg-brand-wash text-brand">{icon}</span>
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold text-ink">{name}</div>
        <div className="truncate text-[12.5px] text-ink-3">{sub}</div>
      </div>
    </div>
  );
}

function KeyRow({ keys, label }: { keys: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="flex w-28 flex-shrink-0 items-center gap-1">{keys}</span>
      <span className="text-[13px] text-ink-2">{label}</span>
    </div>
  );
}
