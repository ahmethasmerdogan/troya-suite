import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue,
} from "motion/react";
import {
  ArrowRight, BookOpen, Boxes, ChevronDown, Fingerprint, GitBranch, Layers, Radio, ShieldCheck, Workflow,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { STATUS_META, FINAL_STATUSES, INTERIM_STATUSES } from "@/domain/couponStatus";
import { useUI, type Lang } from "@/store/ui";
import { COPY, type LandingCopy } from "./copy";
import {
  AppWindow, Card, ChatMock, DocsMock, EventStream, FareMock, HubMock, LangMock, LifecycleTicket, MoneyMock,
  PaletteMock, RED, ReportsMock, ResMock, RightsMock, RolesMock, SeatMock, TerminalMock, useSeen,
} from "./mocks";

const Aircraft3D = lazy(() => import("./Aircraft3D"));
const Globe3D = lazy(() => import("./Globe3D"));

const INK = "#1d1d1f";
const GRAY = "#6e6e73";
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Tanıtım sayfası — `/tanitim`, giriş gerektirmez.
 *
 * Uygulamanın temasından bağımsız hep açık zemin: THY kırmızısı ve beyaz.
 * 3D sahneler ayrı parçalarda tembel yüklenir ve yalnız ekrandayken çizer;
 * WebGL yoksa sayfa sahnesiz ama eksiksiz açılır. "Hareketi azalt" tercihinde
 * kaydırma animasyonları durağan değerlere iner.
 */
export function Landing() {
  const lang = useUI((s) => s.lang);
  const c = COPY[lang];
  const reduce = !!useReducedMotion();

  useEffect(() => {
    const prev = document.title;
    document.title = lang === "tr" ? "Troya Suite — Tanıtım" : "Troya Suite — Overview";
    return () => { document.title = prev; };
  }, [lang]);

  return (
    <div className="landing min-h-screen overflow-x-clip bg-white antialiased" style={{ color: INK, colorScheme: "light" }}>
      <Nav c={c} lang={lang} />
      <Hero c={c} reduce={reduce} />
      <Stats stats={c.hero.stats} />
      <Statement text={c.statement} reduce={reduce} />
      <Lifecycle c={c.lifecycle} reduce={reduce} />
      <StatusGrid c={c.lifecycle} />
      <Bento c={c.bento} lang={lang} />
      <Showcase c={c.showcase} lang={lang} reduce={reduce} />
      <Network c={c.network} reduce={reduce} />
      <Engineering c={c.engineering} />
      <Iata c={c.iata} reduce={reduce} />
      <Cta c={c.cta} />
      <footer className="border-t border-[#ececef] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-[12px] text-[#86868b] sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><BrandMark size={16} />{c.footer.line}</span>
          <span>{c.footer.note}</span>
        </div>
      </footer>
    </div>
  );
}

/* --- yardımcılar ----------------------------------------------------- */

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Eyebrow({ children, light }: { children: ReactNode; light?: boolean }) {
  return (
    <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.18em]" style={{ color: light ? "rgba(255,255,255,0.75)" : RED }}>
      {children}
    </div>
  );
}

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Kaydırma ilerlemesini bir aralığa eşler. Fonksiyon biçimli `useTransform`
 * bilinçli: dizi biçiminde motion saydamlığı tarayıcının ViewTimeline'ına
 * devrediyor ve yapışkan bölümlerde ilerlemeyi yanlış hesaplıyordu (terminal
 * hiç kaybolmuyor, pencere hiç görünmüyordu).
 */
function useRange<T extends number | string>(mv: MotionValue<number>, [a, b]: [number, number], [from, to]: [number, number], unit?: "%" | "px"): MotionValue<T> {
  return useTransform(mv, (v) => {
    const k = Math.min(1, Math.max(0, (v - a) / (b - a)));
    const n = from + (to - from) * k;
    return (unit ? `${n}${unit}` : n) as T;
  });
}

const H2 = "text-[clamp(2.2rem,5.4vw,4.4rem)] font-semibold leading-[1.04] tracking-[-0.035em]";
const SUB = "mt-5 max-w-2xl text-[clamp(1.05rem,1.6vw,1.3rem)] leading-[1.5]";

/* --- üst menü -------------------------------------------------------- */

function Nav({ c, lang }: { c: LandingCopy; lang: Lang }) {
  const setLang = useUI((s) => s.setLang);
  const links: [string, string][] = [
    ["lifecycle", c.nav.lifecycle], ["features", c.nav.features], ["network", c.nav.network], ["engineering", c.nav.engineering],
  ];
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-black/[0.06] bg-white/75 backdrop-blur-xl backdrop-saturate-150">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2.5">
          <BrandMark size={24} />
          <span className="text-[15px] font-semibold tracking-tight">Troya Suite</span>
        </button>
        <div className="ml-4 hidden items-center gap-6 md:flex">
          {links.map(([id, label]) => (
            <button key={id} type="button" onClick={() => scrollTo(id)} className="text-[13px] text-[#424245] transition-colors hover:text-black">
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLang(lang === "tr" ? "en" : "tr")}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-[#424245] transition-colors hover:bg-black/5"
            aria-label={lang === "tr" ? "Switch to English" : "Türkçeye geç"}
          >
            {lang === "tr" ? "EN" : "TR"}
          </button>
          <Link to="/" className="rounded-full px-4 py-1.5 text-[13px] font-medium text-white transition-transform hover:scale-[1.03]" style={{ background: RED }}>
            {c.nav.login}
          </Link>
        </div>
      </nav>
    </header>
  );
}

/* --- açılış ---------------------------------------------------------- */

function Hero({ c, reduce }: { c: LandingCopy; reduce: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const opacity = useRange<number>(scrollYProgress, [0, 0.3], [1, 0]);
  const y = useRange<number>(scrollYProgress, [0, 0.3], [0, -70]);
  const [active, setActive] = useState(true);
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(v < 0.98));

  return (
    <section ref={ref} className="relative h-[160vh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 45% at 50% 72%, rgba(199,10,12,0.13), transparent 70%), radial-gradient(40% 30% at 85% 20%, rgba(199,10,12,0.05), transparent 70%), linear-gradient(180deg, #ffffff 0%, #fbfbfd 100%)",
          }}
        />
        <div className="absolute inset-0">
          <SceneBoundary>
            <Suspense fallback={null}>
              <Aircraft3D progress={reduce ? undefined : scrollYProgress} active={active} reduce={reduce} />
            </Suspense>
          </SceneBoundary>
        </div>

        <motion.div style={reduce ? undefined : { opacity, y }} className="relative z-10 mx-auto max-w-5xl px-6 pt-24 text-center sm:pt-28">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }}>
            <Eyebrow>{c.hero.eyebrow}</Eyebrow>
          </motion.div>
          <h1 className="text-[clamp(2.8rem,8.2vw,6.6rem)] font-semibold leading-[0.98] tracking-[-0.045em]">
            <motion.span className="block" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE, delay: 0.08 }}>
              {c.hero.title1}
            </motion.span>
            <motion.span className="block" style={{ color: RED }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE, delay: 0.2 }}>
              {c.hero.title2}
            </motion.span>
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.35 }}
            className="mx-auto mt-6 max-w-2xl text-[clamp(1rem,1.5vw,1.2rem)] leading-[1.5]" style={{ color: GRAY }}
          >
            {c.hero.sub}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.48 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link to="/" className="group flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-medium text-white shadow-[0_10px_30px_-10px_rgba(199,10,12,0.7)] transition-transform hover:scale-[1.03]" style={{ background: RED }}>
              {c.hero.primary}<ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <button type="button" onClick={() => scrollTo("lifecycle")} className="rounded-full px-5 py-3 text-[15px] font-medium transition-colors hover:bg-black/5" style={{ color: RED }}>
              {c.hero.secondary} ›
            </button>
          </motion.div>
        </motion.div>

        <motion.button
          type="button"
          onClick={() => scrollTo("stats")}
          aria-label={c.hero.scroll}
          style={reduce ? undefined : { opacity }}
          className="absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-1 text-[11px] sm:flex"
        >
          <span style={{ color: GRAY }}>{c.hero.scroll}</span>
          <motion.span animate={reduce ? undefined : { y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}>
            <ChevronDown size={16} color={RED} />
          </motion.span>
        </motion.button>
      </div>
    </section>
  );
}

/* --- rakamlar -------------------------------------------------------- */

function Stats({ stats }: { stats: LandingCopy["hero"]["stats"] }) {
  return (
    <section id="stats" className="border-y border-[#ececef] bg-white">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-y-8 px-6 py-12 sm:grid-cols-4">
        {stats.map((s, k) => (
          <Reveal key={s.label} delay={k * 0.08} className="text-center">
            <div className="font-mono text-[clamp(2.2rem,4vw,3.2rem)] font-semibold leading-none tracking-[-0.04em]" style={{ color: k === 0 ? RED : INK }}>{s.value}</div>
            <div className="mt-2 text-[13px]" style={{ color: GRAY }}>{s.label}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* --- kaydırmayla açılan cümle --------------------------------------- */

function Statement({ text, reduce }: { text: string; reduce: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = text.split(" ");
  return (
    <section id="statement" ref={ref} className="mx-auto max-w-5xl px-6 py-[18vh]">
      <p className="text-[clamp(1.8rem,4.2vw,3.5rem)] font-semibold leading-[1.14] tracking-[-0.03em]">
        {words.map((w, i) => (
          <Word key={i} p={scrollYProgress} from={i / words.length} to={(i + 1) / words.length} reduce={reduce} accent={i < 5}>
            {w}
          </Word>
        ))}
      </p>
    </section>
  );
}

function Word({ p, from, to, reduce, accent, children }: { p: MotionValue<number>; from: number; to: number; reduce: boolean; accent: boolean; children: ReactNode }) {
  const opacity = useRange<number>(p, [from, to], [0.14, 1]);
  return (
    <motion.span style={{ opacity: reduce ? 1 : opacity, color: accent ? RED : INK }}>
      {children}{" "}
    </motion.span>
  );
}

/* --- yaşam döngüsü (yapışkan anlatım) -------------------------------- */

function Lifecycle({ c, reduce }: { c: LandingCopy["lifecycle"]; reduce: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [step, setStep] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setStep(Math.max(0, Math.min(3, Math.floor(v * 4.3)))));
  const bar = useRange<string>(scrollYProgress, [0, 0.95], [0, 100], "%");

  return (
    <section id="lifecycle" ref={ref} className="relative h-[380vh] bg-[#fbfbfd]">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden pt-14">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div>
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h2 className={H2}>{c.title}</h2>
            <p className={`${SUB} hidden sm:block`} style={{ color: GRAY }}>{c.sub}</p>
            <div className="mt-8 hidden gap-1 lg:flex lg:flex-col">
              {c.steps.map((s, k) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => {
                    const el = ref.current;
                    if (!el) return;
                    const top = el.offsetTop + ((k + 0.5) / 4.3) * (el.offsetHeight - window.innerHeight);
                    window.scrollTo({ top, behavior: "smooth" });
                  }}
                  className="flex gap-4 rounded-2xl px-4 py-3 text-left transition-colors"
                  style={{ background: k === step ? "#fff" : "transparent", boxShadow: k === step ? "0 10px 30px -18px rgba(0,0,0,0.25)" : "none" }}
                >
                  <span className="mt-0.5 font-mono text-[15px] font-semibold" style={{ color: k === step ? RED : "#aeaeb2" }}>{s.code}</span>
                  <span>
                    <span className="block text-[16px] font-semibold" style={{ color: k === step ? INK : "#aeaeb2" }}>{s.name}</span>
                    <AnimatePresence initial={false}>
                      {k === step && (
                        <motion.span
                          initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="block overflow-hidden text-[14px] leading-[1.5]" style={{ color: GRAY }}
                        >
                          {s.text}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                </button>
              ))}
            </div>
            {/* telefon/tablet: yalnız etkin adım */}
            <div className="mt-6 min-h-[92px] lg:hidden">
              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <div className="text-[17px] font-semibold"><span className="mr-2 font-mono" style={{ color: RED }}>{c.steps[step].code}</span>{c.steps[step].name}</div>
                  <div className="mt-1 text-[14px] leading-[1.5]" style={{ color: GRAY }}>{c.steps[step].text}</div>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-6 h-[3px] w-full max-w-sm overflow-hidden rounded-full bg-[#e8e8ed]">
              <motion.div className="h-full rounded-full" style={{ width: reduce ? `${((step + 1) / 4) * 100}%` : bar, background: RED }} />
            </div>
          </div>
          <div className="scale-[0.86] sm:scale-100">
            <LifecycleTicket c={c} step={step} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- 17 statü -------------------------------------------------------- */

function StatusGrid({ c }: { c: LandingCopy["lifecycle"] }) {
  const all = [...INTERIM_STATUSES, ...FINAL_STATUSES];
  return (
    <section className="bg-[#fbfbfd] pb-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <h3 className="text-[clamp(1.6rem,3vw,2.4rem)] font-semibold tracking-[-0.03em]">{c.gridTitle}</h3>
          <p className="mt-2 text-[15px]" style={{ color: GRAY }}>{c.gridSub}</p>
        </Reveal>
        <div className="mt-8 grid grid-cols-3 gap-2.5 sm:grid-cols-6 lg:grid-cols-9">
          {all.map((code, k) => {
            const final = STATUS_META[code].final;
            return (
              <motion.div
                key={code}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ delay: k * 0.035, duration: 0.6, ease: EASE }}
                whileHover={{ y: -4 }}
                className="flex aspect-[4/5] flex-col justify-between rounded-2xl p-3"
                style={final ? { background: RED, color: "#fff" } : { background: "#fff", color: INK, boxShadow: "inset 0 0 0 1px #ececef" }}
              >
                <span className="font-mono text-[30px] font-semibold leading-none" style={{ color: final ? "#fff" : RED }}>{code}</span>
                <span className="text-[11.5px] font-medium leading-tight" style={{ opacity: final ? 0.9 : 0.75 }}>{STATUS_META[code].label}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* --- özellik kutuları ------------------------------------------------ */

function Bento({ c, lang }: { c: LandingCopy["bento"]; lang: Lang }) {
  return (
    <section id="features" className="bg-white py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mb-14 max-w-3xl">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h2 className={H2}>{c.title}</h2>
          <p className={SUB} style={{ color: GRAY }}>{c.sub}</p>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <Tile className="md:col-span-4" bg="#f5f5f7" title={c.issue.title} text={c.issue.text}>
            {(on) => <FareMock c={c.issue} lang={lang} active={on} />}
          </Tile>
          <Tile className="md:col-span-2" bg={RED} dark title={c.money.title} text={c.money.text}>
            {(on) => <MoneyMock c={c.money} lang={lang} active={on} />}
          </Tile>

          <Tile className="md:col-span-3" bg="#f5f5f7" title={c.seat.title} text={c.seat.text}>
            {(on) => <SeatMock active={on} />}
          </Tile>
          <Tile className="md:col-span-3" bg="#f5f5f7" title={c.hub.title} text={c.hub.text}>
            {(on) => <HubMock c={c.hub} active={on} />}
          </Tile>

          <Tile className="md:col-span-2" bg="#f5f5f7" title={c.palette.title} text={c.palette.text}>
            {(on) => <PaletteMock c={c.palette} active={on} />}
          </Tile>
          <Tile className="md:col-span-2" bg="#f5f5f7" title={c.reports.title} text={c.reports.text}>
            {(on) => <ReportsMock lang={lang} active={on} />}
          </Tile>
          <Tile className="md:col-span-2" bg={RED} dark title={c.rights.title} text={c.rights.text}>
            {(on) => <RightsMock active={on} />}
          </Tile>

          <Tile className="md:col-span-2" bg="#f5f5f7" title={c.res.title} text={c.res.text}>
            {(on) => <ResMock active={on} />}
          </Tile>
          <Tile className="md:col-span-2" bg="#f5f5f7" title={c.chat.title} text={c.chat.text}>
            {(on) => <ChatMock c={c.chat} active={on} />}
          </Tile>
          <Tile className="md:col-span-2" bg="#f5f5f7" title={c.roles.title} text={c.roles.text}>
            {(on) => <RolesMock names={c.roles.names} active={on} />}
          </Tile>

          <Tile className="md:col-span-3" bg="#f5f5f7" title={c.docs.title} text={c.docs.text}>
            {(on) => <DocsMock active={on} lang={lang} />}
          </Tile>
          <Tile className="md:col-span-3" bg="#f5f5f7" title={c.lang.title} text={c.lang.text}>
            {(on) => <LangMock active={on} />}
          </Tile>
        </div>
      </div>
    </section>
  );
}

function Tile({
  className, bg, dark, title, text, children,
}: { className?: string; bg: string; dark?: boolean; title: string; text: string; children: (active: boolean) => ReactNode }) {
  const [ref, inView] = useSeen<HTMLDivElement>(0.3);
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      <Card className="flex h-full flex-col gap-5" style={{ background: bg, color: dark ? "#fff" : INK }}>
        <div>
          <h3 className="text-[21px] font-semibold tracking-[-0.02em]">{title}</h3>
          <p className="mt-1.5 max-w-md text-[14.5px] leading-[1.5]" style={{ color: dark ? "rgba(255,255,255,0.78)" : GRAY }}>{text}</p>
        </div>
        <div className="mt-auto">{children(inView)}</div>
      </Card>
    </motion.div>
  );
}

/* --- terminal → arayüz ----------------------------------------------- */

function Showcase({ c, lang, reduce }: { c: LandingCopy["showcase"]; lang: Lang; reduce: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // Terminal önce çekilir, pencere ardından yükselir — ikisi üst üste binmez.
  const termOpacity = useRange<number>(scrollYProgress, [0.1, 0.26], [1, 0]);
  const termX = useRange<string>(scrollYProgress, [0.1, 0.26], [0, -14], "%");
  const termScale = useRange<number>(scrollYProgress, [0.1, 0.26], [1, 0.92]);
  const winScale = useRange<number>(scrollYProgress, [0.22, 0.62], [0.8, 1]);
  const winRot = useRange<number>(scrollYProgress, [0.22, 0.62], [18, 0]);
  const winY = useRange<number>(scrollYProgress, [0.22, 0.62], [90, 0]);
  const winOpacity = useRange<number>(scrollYProgress, [0.2, 0.34], [0, 1]);
  const [seen, inView] = useSeen<HTMLDivElement>(0.2);

  return (
    <section ref={ref} className="relative h-[260vh] bg-[#fbfbfd]">
      <div ref={seen} className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden pt-14">
        <div className="mx-auto w-full max-w-6xl px-6">
          <Reveal className="mx-auto mb-10 max-w-3xl text-center">
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h2 className={H2}>{c.title}</h2>
            <p className={`${SUB} mx-auto hidden sm:block`} style={{ color: GRAY }}>{c.sub}</p>
          </Reveal>
          <div className="relative mx-auto max-w-5xl" style={{ perspective: 1600 }}>
            <motion.div
              style={reduce ? { opacity: 0 } : { opacity: termOpacity, x: termX, scale: termScale }}
              className="absolute left-1/2 top-10 z-0 w-[min(520px,90%)] -translate-x-1/2"
            >
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#86868b]">{c.terminal}</div>
              <TerminalMock commands={c.commands} active={inView} />
            </motion.div>
            <motion.div
              className="relative z-10"
              style={reduce ? undefined : { scale: winScale, rotateX: winRot, y: winY, opacity: winOpacity, transformOrigin: "50% 100%" }}
            >
              <div className="mb-2 text-right text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: RED }}>{c.ui}</div>
              <AppWindow c={c.window} lang={lang} />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- ağ -------------------------------------------------------------- */

function Network({ c, reduce }: { c: LandingCopy["network"]; reduce: boolean }) {
  const [ref, inView] = useSeen<HTMLElement>(0.15);
  return (
    <section
      id="network"
      ref={ref}
      className="relative overflow-hidden py-28 text-white sm:py-36"
      style={{ background: "radial-gradient(80% 60% at 70% 40%, #d9161a 0%, #c70a0c 45%, #8f0507 100%)" }}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 lg:grid-cols-2">
        <div>
          <Reveal>
            <Eyebrow light>{c.eyebrow}</Eyebrow>
            <h2 className={H2}>{c.title}</h2>
            <p className={SUB} style={{ color: "rgba(255,255,255,0.8)" }}>{c.sub}</p>
          </Reveal>
          <div className="mt-10 grid gap-3">
            {c.points.map((p, k) => (
              <Reveal key={p.title} delay={k * 0.1}>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                  <div className="text-[15px] font-semibold">{p.title}</div>
                  <div className="mt-0.5 text-[14px] text-white/75">{p.text}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-[560px]">
          <SceneBoundary>
            <Suspense fallback={null}>
              <Globe3D active={inView} reduce={reduce} hubLabel={c.hub} />
            </Suspense>
          </SceneBoundary>
        </div>
      </div>
    </section>
  );
}

/* --- mühendislik ----------------------------------------------------- */

const PILLAR_ICONS = [GitBranch, Layers, Workflow, Fingerprint, Radio, Boxes];

function Engineering({ c }: { c: LandingCopy["engineering"] }) {
  const [ref, inView] = useSeen<HTMLDivElement>(0.25);
  return (
    <section id="engineering" className="bg-white py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h2 className={H2}>{c.title}</h2>
            <p className={SUB} style={{ color: GRAY }}>{c.sub}</p>
          </Reveal>
          <div ref={ref}>
            <EventStream events={c.events} label={c.store} active={inView} />
          </div>
        </div>
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.pillars.map((p, k) => {
            const Icon = PILLAR_ICONS[k] ?? ShieldCheck;
            return (
              <Reveal key={p.title} delay={(k % 3) * 0.08}>
                <div className="h-full rounded-[24px] bg-[#f5f5f7] p-6 transition-transform duration-500 hover:-translate-y-1">
                  <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: "#fdf2f2", color: RED }}>
                    <Icon size={19} strokeWidth={1.8} />
                  </span>
                  <div className="mt-4 text-[17px] font-semibold tracking-[-0.01em]">{p.title}</div>
                  <div className="mt-1.5 text-[14.5px] leading-[1.5]" style={{ color: GRAY }}>{p.text}</div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* --- IATA şeridi ----------------------------------------------------- */

function Iata({ c, reduce }: { c: LandingCopy["iata"]; reduce: boolean }) {
  const half = Math.ceil(c.items.length / 2);
  const rows = [c.items.slice(0, half), c.items.slice(half)];
  return (
    <section className="overflow-hidden bg-[#fbfbfd] py-24">
      <Reveal className="mx-auto mb-10 max-w-6xl px-6">
        <h3 className="text-[clamp(1.6rem,3vw,2.4rem)] font-semibold tracking-[-0.03em]">{c.title}</h3>
      </Reveal>
      <div className="flex flex-col gap-3">
        {rows.map((row, r) => (
          <div key={r} className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
            <div
              className="flex shrink-0 gap-3 pr-3"
              style={reduce ? undefined : { animation: `landing-marquee ${38 + r * 8}s linear infinite`, animationDirection: r ? "reverse" : "normal" }}
            >
              {[...row, ...row].map((item, k) => (
                <span key={`${item}-${k}`} className="whitespace-nowrap rounded-full bg-white px-5 py-2.5 text-[14px] font-medium shadow-[inset_0_0_0_1px_#ececef]">
                  <span className="mr-2 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full" style={{ background: RED }} />{item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <style>{"@keyframes landing-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }"}</style>
    </section>
  );
}

/* --- kapanış --------------------------------------------------------- */

function Cta({ c }: { c: LandingCopy["cta"] }) {
  return (
    <section className="relative overflow-hidden py-32 text-white sm:py-40" style={{ background: "linear-gradient(160deg, #d9161a 0%, #c70a0c 40%, #7a0406 100%)" }}>
      <motion.div
        aria-hidden
        className="absolute -right-24 -top-24 text-white/[0.07]"
        initial={{ rotate: -12, scale: 0.9 }}
        whileInView={{ rotate: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, ease: EASE }}
      >
        <BrandMark size={520} variant="bare" />
      </motion.div>
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <Reveal>
          <h2 className="text-[clamp(2.4rem,6vw,5rem)] font-semibold leading-[1.02] tracking-[-0.04em]">{c.title}</h2>
          <p className="mx-auto mt-5 max-w-xl text-[clamp(1.05rem,1.6vw,1.25rem)] text-white/80">{c.sub}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/" className="group flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold transition-transform hover:scale-[1.03]" style={{ color: RED }}>
              {c.primary}<ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/docs" className="flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-medium text-white shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.6)] transition-colors hover:bg-white/10">
              <BookOpen size={16} />{c.secondary}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
