import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, HelpCircle, Keyboard, Lightbulb, X } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { useT, type Key } from "@/i18n";
import { cn } from "@/lib/utils";

/* ====================================================================
   Ekran yardımı — yeni personel için.

   Sistem IATA terimleriyle konuşuyor (kupon, EMD, ADC, RFISC, ETSU) ve
   gişeye yeni başlayan biri için bu kelimeler ekranı okunmaz kılıyor.
   Alan ipuçları zaten var (`FIELD_HELP`); eksik olan EKRAN düzeyindeydi:
   "burada ne yapıyorum, neye dikkat etmeliyim, hangi kısayol işime yarar".

   Topbar'daki soru işareti bunu açar; içerik rotaya göre değişir.
   ==================================================================== */

interface ScreenGuide {
  title: Key;
  what: Key;
  steps: Key[];
  watch?: Key[];
  shortcuts?: [string, Key][];
}

const GUIDES: { match: (path: string) => boolean; guide: ScreenGuide }[] = [
  {
    match: (p) => p === "/issue",
    guide: {
      title: "admin.help.issue.title",
      what: "admin.help.issue.what",
      steps: [
        "admin.help.issue.s1",
        "admin.help.issue.s2",
        "admin.help.issue.s3",
        "admin.help.issue.s4",
      ],
      watch: [
        "admin.help.issue.w1",
        "admin.help.issue.w2",
        "admin.help.issue.w3",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/tickets/"),
    guide: {
      title: "admin.help.ticket.title",
      what: "admin.help.ticket.what",
      steps: [
        "admin.help.ticket.s1",
        "admin.help.ticket.s2",
        "admin.help.ticket.s3",
        "admin.help.ticket.s4",
      ],
      watch: [
        "admin.help.ticket.w1",
        "admin.help.ticket.w2",
      ],
      shortcuts: [["e", "admin.help.sc.exchange"], ["r", "admin.help.sc.refund"], ["v", "admin.help.sc.void"]],
    },
  },
  {
    match: (p) => p === "/search",
    guide: {
      title: "admin.help.search.title",
      what: "admin.help.search.what",
      steps: [
        "admin.help.search.s1",
        "admin.help.search.s2",
        "admin.help.search.s3",
        "admin.help.search.s4",
      ],
      shortcuts: [["⌘K", "admin.help.sc.palette"]],
    },
  },
  {
    match: (p) => p.startsWith("/checkin/") && p.includes("/seat/"),
    guide: {
      title: "admin.help.seat.title",
      what: "admin.help.seat.what",
      steps: [
        "admin.help.seat.s1",
        "admin.help.seat.s2",
        "admin.help.seat.s3",
      ],
      watch: [
        "admin.help.seat.w1",
        "admin.help.seat.w2",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/checkin"),
    guide: {
      title: "admin.help.checkin.title",
      what: "admin.help.checkin.what",
      steps: [
        "admin.help.checkin.s1",
        "admin.help.checkin.s2",
        "admin.help.checkin.s3",
        "admin.help.checkin.s4",
      ],
      watch: ["admin.help.checkin.w1"],
    },
  },
  {
    match: (p) => p.startsWith("/report"),
    guide: {
      title: "admin.help.report.title",
      what: "admin.help.report.what",
      steps: [
        "admin.help.report.s1",
        "admin.help.report.s2",
        "admin.help.report.s3",
      ],
      watch: ["admin.help.report.w1"],
    },
  },
  {
    match: (p) => p.startsWith("/res"),
    guide: {
      title: "admin.help.res.title",
      what: "admin.help.res.what",
      steps: [
        "admin.help.res.s1",
        "admin.help.res.s2",
        "admin.help.res.s3",
      ],
      watch: ["admin.help.res.w1"],
    },
  },
  {
    match: (p) => p === "/chat",
    guide: {
      title: "admin.help.chat.title",
      what: "admin.help.chat.what",
      steps: [
        "admin.help.chat.s1",
        "admin.help.chat.s2",
        "admin.help.chat.s3",
      ],
    },
  },
];

const DEFAULT_GUIDE: ScreenGuide = {
  title: "admin.help.default.title",
  what: "admin.help.default.what",
  steps: [
    "admin.help.default.s1",
    "admin.help.default.s2",
    "admin.help.default.s3",
  ],
  shortcuts: [["⌘K", "admin.help.sc.palette"]],
};

function guideFor(path: string): ScreenGuide {
  return GUIDES.find((g) => g.match(path))?.guide ?? DEFAULT_GUIDE;
}

/** Topbar'daki soru işareti — bulunduğunuz ekranın kılavuzu. */
export function ScreenHelpButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();
  const g = guideFor(path);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("admin.help.button")}
        title={t("admin.help.button")}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-[10px] text-ink-3 transition-colors hover:bg-inset hover:text-ink",
          className,
        )}
      >
        <HelpCircle size={17} strokeWidth={1.75} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t("admin.help.modalTitle", { title: t(g.title) })} width="md">
        <div className="flex flex-col gap-4">
          <p className="text-[13.5px] leading-relaxed text-ink-2">{t(g.what)}</p>

          <section>
            <div className="microlabel mb-1.5">{t("admin.help.steps")}</div>
            <ol className="flex flex-col gap-1.5">
              {g.steps.map((s, i) => (
                <li key={s} className="flex gap-2.5 text-[13px] text-ink-2">
                  <span className="num mt-px grid h-4.5 w-4.5 flex-shrink-0 place-items-center rounded-full bg-inset text-[10.5px] text-ink-3">
                    {i + 1}
                  </span>
                  {t(s)}
                </li>
              ))}
            </ol>
          </section>

          {g.watch && (
            <section className="rounded-md border border-line bg-inset p-3">
              <div className="microlabel mb-1.5 flex items-center gap-1.5">
                <Lightbulb size={13} strokeWidth={1.75} className="text-[var(--t-amber-i)]" /> {t("admin.help.watch")}
              </div>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-[12.5px] text-ink-2">
                {g.watch.map((w) => <li key={w}>{t(w)}</li>)}
              </ul>
            </section>
          )}

          {g.shortcuts && (
            <section>
              <div className="microlabel mb-1.5 flex items-center gap-1.5">
                <Keyboard size={13} strokeWidth={1.75} /> {t("admin.help.shortcuts")}
              </div>
              <div className="flex flex-wrap gap-2">
                {g.shortcuts.map(([k, label]) => (
                  <span key={k} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[12px] text-ink-2">
                    <kbd className="num rounded-sm bg-inset px-1.5 py-0.5 text-[11px] text-ink">{k}</kbd>
                    {t(label)}
                  </span>
                ))}
              </div>
            </section>
          )}

          <div className="flex items-center gap-2 border-t border-line pt-3">
            <Link
              to="/guide" onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand hover:underline"
            >
              <BookOpen size={14} strokeWidth={1.75} /> {t("admin.help.fullGuide")}
            </Link>
            <button onClick={() => setOpen(false)} className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink">
              <X size={13} strokeWidth={2} /> {t("admin.help.close")}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
