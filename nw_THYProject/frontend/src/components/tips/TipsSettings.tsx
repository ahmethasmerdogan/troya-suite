import { useNavigate } from "@tanstack/react-router";
import { Check, Compass, Lightbulb, RotateCcw, Sparkles } from "lucide-react";
import { Panel, PanelHead, PanelBody } from "@/components/ui/surface";
import { Checkbox } from "@/components/ui/core";
import { toast } from "@/components/ui/toast";
import { usePerm } from "@/lib/usePerm";
import { useT } from "@/i18n";
import { useTips } from "@/store/tips";
import { TOURS } from "./catalog";

/** Profil — ipuçları ve ekran turları tercihi. */
export function TipsSettings() {
  const t = useT();
  const navigate = useNavigate();
  const { can } = usePerm();
  const enabled = useTips((s) => s.enabled);
  const seen = useTips((s) => s.seen.length);
  const done = useTips((s) => s.tours);
  const setEnabled = useTips((s) => s.setEnabled);
  const reset = useTips((s) => s.reset);
  const replay = useTips((s) => s.replayOnboarding);
  const startTour = useTips((s) => s.startTour);

  const tours = TOURS.filter((x) => !x.perm || can(x.perm));

  return (
    <Panel>
      <PanelHead title={t("tips.profile.title")} hint={t("tips.profile.hint")} />
      <PanelBody className="flex flex-col gap-4">
        <label className="flex cursor-pointer items-center gap-2.5">
          <Checkbox checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span className="text-[13.5px] font-medium text-ink">{t("tips.profile.enabled")}</span>
          <span className="num ml-auto text-[12px] text-ink-3">{t("tips.profile.seen", { n: seen, m: done.length })}</span>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { reset(); toast.success(t("tips.profile.resetDone"), t("tips.profile.resetBody")); }}
            className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink transition-colors hover:bg-elev"
          >
            <RotateCcw size={15} strokeWidth={1.75} /> {t("tips.profile.reset")}
          </button>
          <button
            type="button"
            onClick={replay}
            className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink transition-colors hover:bg-elev"
          >
            <Sparkles size={15} strokeWidth={1.75} /> {t("tips.profile.welcome")}
          </button>
        </div>

        <div>
          <div className="microlabel mb-1 flex items-center gap-1.5"><Compass size={13} strokeWidth={1.75} /> {t("tips.profile.tours")}</div>
          <p className="mb-2 text-[12px] text-ink-3">{t("tips.profile.toursHint")}</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {tours.map((tour) => {
              const finished = done.includes(tour.id);
              return (
                <div key={tour.id} className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5">
                  <Lightbulb size={14} strokeWidth={1.75} className={finished ? "text-ink-4" : "text-brand"} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{t(tour.name)}</span>
                  {finished && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-ink-3">
                      <Check size={11} strokeWidth={2.5} /> {t("tips.profile.done")}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => { navigate({ to: tour.home }); startTour(tour.id); }}
                    className="rounded-full px-2.5 py-0.5 text-[12px] font-medium text-brand hover:bg-brand-wash"
                  >
                    {t("tips.profile.go")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}
