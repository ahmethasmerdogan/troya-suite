import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AnimatePresence, animate, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue,
} from "motion/react";
import {
  ArrowLeftRight, ArrowRight, ArrowUp, Boxes, CircleCheck, CloudLightning, Command, Cpu, Database, FileStack, Inbox,
  Languages, Layers, Lock, MessagesSquare, MousePointerClick, Pause, Play, Receipt, Scale, Send, ShieldCheck, Ticket,
  KeyRound, Undo2, Users, Workflow, type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { STATUS_TONE } from "@/components/domain/statusTone";
import { FINAL_STATUSES, INTERIM_STATUSES, STATUS_META } from "@/domain/couponStatus";
import type { CouponStatus } from "@/domain/types";
import { useUI, type Lang } from "@/store/ui";
import { COPY, type LandingCopy } from "./copy";

const DotGlobe = lazy(() => import("./DotGlobe"));

const RED = "#c70a0c";
const INK = "#0b0b0c";
const EASE = [0.16, 1, 0.3, 1] as const;
const WRAP = "mx-auto w-full max-w-[1200px] px-5 sm:px-8";

/**
 * Tanıtım sayfası — `/tanitim`, giriş gerektirmez.
 *
 * Uygulamanın temasından bağımsız hep açık zemin; THY kırmızısı yalnız vurgu,
 * geniş kırmızı yüzey iki yerde (rakamlar şeridi ve kapanış kartı). Ürün
 * görselleri gerçek ekran görüntüleridir (`public/landing/*-{tr,en}.webp`).
 * Küre ayrı parçada tembel yüklenir; WebGL yoksa sayfa küresiz ama eksiksiz
 * açılır. "Hareketi azalt" tercihinde döngüsel animasyonlar durur.
 */
export function Landing() {
  const lang = useUI((s) => s.lang);
  const c = COPY[lang];
  const reduce = !!useReducedMotion();

  useEffect(() => {
    const prev = document.title;
    document.title = lang === "tr" ? "Troya Suite — Biletleme, yeniden tasarlandı" : "Troya Suite — Ticketing, reimagined";
    return () => { document.title = prev; };
  }, [lang]);

  return (
    <div className="landing min-h-screen overflow-x-clip bg-white antialiased" style={{ color: INK, colorScheme: "light" }}>
      <Nav c={c} lang={lang} />
      <main>
        <Hero c={c} reduce={reduce} />
        <Product c={c.product} lang={lang} reduce={reduce} />
        <Standards c={c.standards} reduce={reduce} />
        <Modules c={c.modules} lang={lang} reduce={reduce} />
        <Lifecycle c={c.lifecycle} reduce={reduce} />
        <Capabilities c={c.capabilities} />
        <Stats stats={c.stats} reduce={reduce} />
        <Architecture c={c.architecture} reduce={reduce} />
        <Cta c={c.cta} />
      </main>
      <Footer c={c.footer} />
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

/**
 * Kaydırma ilerlemesini bir aralığa eşler. Fonksiyon biçimli `useTransform`
 * bilinçli: dizi biçiminde motion değeri tarayıcının ViewTimeline'ına
 * devrediyor ve bazı düzenlerde ilerlemeyi yanlış hesaplıyordu.
 */
function useRange(mv: MotionValue<number>, [a, b]: [number, number], [from, to]: [number, number]): MotionValue<number> {
  return useTransform(mv, (v) => from + (to - from) * Math.min(1, Math.max(0, (v - a) / (b - a))));
}

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children, light }: { children: ReactNode; light?: boolean }) {
  return (
    <div className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold tracking-[-0.005em]" style={{ color: light ? "rgba(255,255,255,0.8)" : RED }}>
      <span className="size-1.5 rounded-full" style={{ background: light ? "#fff" : RED }} />
      {children}
    </div>
  );
}

const H2 = "text-balance text-[clamp(2rem,4.4vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.038em]";
const SUB = "mt-5 text-pretty text-[clamp(1rem,1.35vw,1.175rem)] leading-[1.6] text-[#6e6e73]";

function Head({ eyebrow, title, sub, center = true }: { eyebrow: string; title: string; sub?: string; center?: boolean }) {
  return (
    <Reveal className={center ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className={H2}>{title}</h2>
      {sub && <p className={`${SUB} ${center ? "mx-auto max-w-2xl" : ""}`}>{sub}</p>}
    </Reveal>
  );
}

function shot(name: string, lang: Lang) {
  return `/landing/${name}-${lang}.webp`;
}

/**
 * Masaüstü ekran görüntüsü. Telefonda bütün ekran küçülüp okunmaz olacağı için
 * görüntü büyütülür ve `--fx` (0 sol, 100 sağ) odağından kırpılır.
 */
const SHOT = "absolute top-0 left-[calc(var(--fx)*-0.75%)] h-auto w-[175%] max-w-none sm:left-0 sm:w-full";

/** Tarayıcı penceresi: sade krom, adres çubuğu, altında yumuşak kırmızı ışıma. */
function BrowserFrame({ url, children, glow = true }: { url: string; children: ReactNode; glow?: boolean }) {
  return (
    <div className="relative">
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-[6%] -bottom-[8%] top-[18%] -z-10 blur-3xl"
          style={{ background: "radial-gradient(55% 55% at 50% 65%, rgba(199,10,12,0.20), transparent 72%)" }}
        />
      )}
      <div className="overflow-hidden rounded-[12px] border border-black/[0.09] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(0,0,0,0.14),0_48px_96px_-32px_rgba(0,0,0,0.28)] sm:rounded-[16px]">
        <div className="flex h-8 items-center gap-3 border-b border-black/[0.06] bg-[#f7f7f8] px-3 sm:h-10 sm:px-4">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-black/[0.12]" />)}
          </div>
          <div className="mx-auto flex h-5 min-w-0 max-w-[62%] items-center gap-1.5 rounded-md bg-white px-2.5 text-[10.5px] text-[#86868b] ring-1 ring-black/[0.06] sm:h-6 sm:px-3 sm:text-[12px]">
            <Lock className="size-3 shrink-0" />
            <span className="truncate">{url}</span>
          </div>
          <div className="w-[42px]" />
        </div>
        {children}
      </div>
    </div>
  );
}

/* --- üst menü -------------------------------------------------------- */

function Nav({ c, lang }: { c: LandingCopy; lang: Lang }) {
  const setLang = useUI((s) => s.setLang);
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 8));
  const links: [string, string][] = [
    ["product", c.nav.product], ["modules", c.nav.modules], ["lifecycle", c.nav.lifecycle], ["architecture", c.nav.architecture],
  ];
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled ? "border-b border-black/[0.06] bg-white/80 backdrop-blur-xl backdrop-saturate-150" : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className={`${WRAP} flex h-16 items-center gap-8`}>
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2.5">
          <BrandMark size={28} />
          <span className="text-[16px] font-semibold tracking-[-0.02em]">Troya Suite</span>
        </button>
        <div className="hidden items-center gap-7 md:flex">
          {links.map(([id, label]) => (
            <button key={id} type="button" onClick={() => scrollTo(id)} className="text-[14px] text-[#48484a] transition-colors hover:text-black">
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLang(lang === "tr" ? "en" : "tr")}
            className="h-9 rounded-full px-3 text-[13px] font-semibold text-[#48484a] transition-colors hover:bg-black/[0.05]"
            aria-label={lang === "tr" ? "Switch to English" : "Türkçeye geç"}
          >
            {lang === "tr" ? "EN" : "TR"}
          </button>
          <Link
            to="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#ad090b]"
            style={{ background: RED }}
          >
            {c.nav.login}
          </Link>
        </div>
      </nav>
    </header>
  );
}

/* --- açılış ---------------------------------------------------------- */

const LIFE: CouponStatus[] = ["O", "C", "L", "F"];

function Hero({ c, reduce }: { c: LandingCopy; reduce: boolean }) {
  const h = c.hero;
  const lines = [h.title1, h.title2];
  return (
    <section className="relative overflow-hidden pt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.045) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse 75% 65% at 30% 35%, #000 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 65% at 30% 35%, #000 20%, transparent 75%)",
        }}
      />
      <div className={`${WRAP} relative grid items-center gap-6 pb-10 pt-10 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-4 lg:pb-16 lg:pt-0`}>
        <div className="relative z-10 max-w-[36rem]">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
            <button
              type="button"
              onClick={() => scrollTo("product")}
              className="group inline-flex items-center gap-2.5 rounded-full border border-black/[0.08] bg-white/90 py-1 pl-1 pr-3.5 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur transition-colors hover:border-black/15"
            >
              <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold text-white" style={{ background: RED }}>{h.badgeCta}</span>
              <span className="text-[#48484a]">{h.badge}</span>
              <ArrowRight className="size-3.5 text-[#86868b] transition-transform group-hover:translate-x-0.5" />
            </button>
          </motion.div>

          <h1 className="mt-7 text-[clamp(3rem,6.6vw,5.75rem)] font-semibold leading-[0.97] tracking-[-0.05em]">
            {lines.map((line, i) => (
              <motion.span
                key={line}
                className="block pb-[0.06em]"
                initial={reduce ? false : { opacity: 0, y: 28, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 1.1, ease: EASE, delay: 0.08 + i * 0.12 }}
                style={i === 1 ? { backgroundImage: `linear-gradient(180deg, #e3191c 0%, ${RED} 45%, #8f0507 100%)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : undefined}
              >
                {line}
                {i === 0 ? " " : null}
              </motion.span>
            ))}
          </h1>

          <motion.p
            className="mt-7 max-w-[33rem] text-pretty text-[clamp(1.05rem,1.35vw,1.2rem)] leading-[1.6] text-[#6e6e73]"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.32 }}
          >
            {h.sub}
          </motion.p>

          <motion.div
            className="mt-9 flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.42 }}
          >
            <Link
              to="/"
              className="group inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-medium text-white shadow-[0_10px_28px_-10px_rgba(199,10,12,0.75),inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors hover:bg-[#ad090b]"
              style={{ background: RED }}
            >
              {h.primary}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <button
              type="button"
              onClick={() => scrollTo("product")}
              className="inline-flex h-12 items-center rounded-full border border-black/[0.1] bg-white px-6 text-[15px] font-medium transition-colors hover:bg-black/[0.03]"
            >
              {h.secondary}
            </button>
          </motion.div>

          <motion.ul
            className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-[#6e6e73]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.6 }}
          >
            {h.trust.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CircleCheck className="size-4" style={{ color: RED }} />
                {t}
              </li>
            ))}
          </motion.ul>
        </div>

        <GlobeStage c={h} reduce={reduce} />
      </div>
    </section>
  );
}

function GlobeStage({ c, reduce }: { c: LandingCopy["hero"]; reduce: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % LIFE.length), 2400);
    return () => window.clearInterval(id);
  }, [reduce]);
  const status = LIFE[step];
  const tone = STATUS_TONE[status].hex;

  return (
    <motion.div
      className="relative mx-auto aspect-square w-full max-w-[640px] lg:mr-[-72px] lg:max-w-none"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.4, ease: EASE, delay: 0.15 }}
    >
      <div
        aria-hidden
        className="absolute inset-[6%] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(199,10,12,0.10) 0%, rgba(199,10,12,0.05) 55%, transparent 100%)" }}
      />
      <SceneBoundary>
        <Suspense fallback={null}>
          <DotGlobe reduce={reduce} label={c.hub} />
        </Suspense>
      </SceneBoundary>

      <Float className="absolute left-0 top-[13%] hidden w-[248px] sm:block lg:-left-[4%]" reduce={reduce} delay={0.9}>
        <div className="flex items-center gap-2 text-[11.5px] font-medium text-[#6e6e73]">
          <span className="grid size-6 place-items-center rounded-md text-white" style={{ background: RED }}>
            <BrandMark variant="bare" size={14} />
          </span>
          {c.ticketCard.label}
          <span className="ml-auto flex items-center gap-1 text-[10.5px] text-[#86868b]">
            <span className="relative flex size-1.5">
              {!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/70" />}
              <span className="relative size-1.5 rounded-full bg-emerald-500" />
            </span>
            {c.live}
          </span>
        </div>
        <div className="mt-2.5 font-mono text-[15px] font-semibold tracking-tight tabular-nums">235 1234567890</div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[12px] text-[#6e6e73]">{c.ticketCard.route}</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={status}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: `${tone}17`, color: tone }}
            >
              <span className="size-1.5 rounded-full" style={{ background: tone }} />
              {status} · {STATUS_META[status].short}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="mt-3 flex gap-1">
          {LIFE.map((s, i) => (
            <span key={s} className="h-1 flex-1 rounded-full transition-colors duration-500" style={{ background: i <= step ? RED : "rgba(0,0,0,0.08)" }} />
          ))}
        </div>
      </Float>

      <Float className="absolute bottom-[12%] right-[2%] hidden w-[228px] sm:block lg:right-[10%]" reduce={reduce} delay={1.1} phase={1.6}>
        <div className="flex items-center gap-2 text-[11.5px] font-medium text-[#6e6e73]">
          <span className="grid size-6 place-items-center rounded-md bg-[#f2f2f4] text-[#1d1d1f]"><Send className="size-3.5" /></span>
          {c.etsuCard.label}
        </div>
        <div className="mt-2.5 text-[13.5px] font-semibold tracking-tight">{c.etsuCard.text}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["LH", "UA", "SQ", "AC"].map((p, i) => (
            <motion.span
              key={p}
              initial={reduce ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.6 + i * 0.18, duration: 0.4, ease: EASE }}
              className="inline-flex items-center gap-1 rounded-md border border-black/[0.07] bg-[#fafafa] px-1.5 py-0.5 font-mono text-[11px] font-semibold"
            >
              {p}
              <CircleCheck className="size-3 text-emerald-600" />
            </motion.span>
          ))}
          <span className="ml-auto self-center text-[10.5px] text-[#86868b]">{c.etsuCard.time}</span>
        </div>
      </Float>

      <div className="pointer-events-none absolute inset-x-0 bottom-[2%] hidden text-center text-[11.5px] text-[#a1a1a6] lg:block">
        {c.drag}
      </div>
    </motion.div>
  );
}

function Float({ children, className, reduce, delay, phase = 0 }: { children: ReactNode; className: string; reduce: boolean; delay: number; phase?: number }) {
  return (
    <motion.div
      className={`${className} z-10`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -7, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: phase }}
        className="rounded-2xl border border-black/[0.07] bg-white/[0.94] p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_18px_44px_-16px_rgba(0,0,0,0.28)] backdrop-blur-md"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/* --- ürün ------------------------------------------------------------ */

function Product({ c, lang, reduce }: { c: LandingCopy["product"]; lang: Lang; reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useRange(scrollYProgress, [0, 1], [16, 0]);
  const scale = useRange(scrollYProgress, [0, 1], [0.93, 1]);
  const y = useRange(scrollYProgress, [0, 1], [40, 0]);

  return (
    <section id="product" className="relative scroll-mt-20 pb-20 pt-10 sm:pb-28 sm:pt-16">
      <div className={WRAP}>
        <Head eyebrow={c.eyebrow} title={c.title} sub={c.sub} />
        <div ref={ref} className="mt-14 sm:mt-16" style={{ perspective: 2200 }}>
          <motion.div style={reduce ? undefined : { rotateX, scale, y, transformOrigin: "50% 0%" }}>
            <BrowserFrame url={c.url}>
              <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[16/10]" style={{ ["--fx" as string]: 8 }}>
                <img src={shot("ticket", lang)} alt={c.alt} width={2880} height={1800} className={SHOT} decoding="async" />
              </div>
            </BrowserFrame>
          </motion.div>
        </div>

        <Reveal className="mx-auto mt-16 max-w-4xl">
          <div className="mb-5 flex items-center justify-center gap-2 text-[13px] font-medium text-[#6e6e73]">
            <MousePointerClick className="size-4" style={{ color: RED }} />
            {c.mapTitle}
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            {c.map.map((m) => (
              <div key={m.cmd} className="min-w-0 rounded-2xl border border-black/[0.07] bg-[#fbfbfc] p-3 sm:p-4">
                <div className="truncate rounded-lg bg-[#0f0f11] px-2.5 py-1.5 font-mono text-[11.5px] text-[#e8e8ea]">
                  <span className="mr-1.5 text-[#ff6b6d]">&gt;</span>{m.cmd}
                </div>
                <div className="my-2 flex justify-center text-[#c7c7cc]"><ArrowRight className="size-3.5 rotate-90" /></div>
                <div className="flex items-center justify-center rounded-lg border border-black/[0.08] bg-white py-1.5 text-[13px] font-medium">{m.ui}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* --- standartlar ----------------------------------------------------- */

function Standards({ c, reduce }: { c: LandingCopy["standards"]; reduce: boolean }) {
  const row = (hidden?: boolean) => (
    <div className="flex shrink-0 items-center gap-12 pr-12" aria-hidden={hidden}>
      {c.items.map((s) => (
        <span key={s} className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em] text-[#1d1d1f]/45">{s}</span>
      ))}
    </div>
  );
  return (
    <section className="border-y border-black/[0.06] bg-[#fafafb] py-9">
      <p className="text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-[#86868b]">{c.label}</p>
      <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        {reduce ? (
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-3 px-6">{row()}</div>
        ) : (
          <motion.div className="flex w-max" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 48, repeat: Infinity, ease: "linear" }}>
            {row()}
            {row(true)}
          </motion.div>
        )}
      </div>
    </section>
  );
}

/* --- modüller -------------------------------------------------------- */

const MODULE_SECONDS = 7;

function Modules({ c, lang, reduce }: { c: LandingCopy["modules"]; lang: Lang; reduce: boolean }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(!reduce);
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { amount: 0.35 });
  const tab = c.tabs[active];
  const next = () => setActive((a) => (a + 1) % c.tabs.length);

  return (
    <section id="modules" className="scroll-mt-20 py-20 sm:py-28">
      <div className={WRAP}>
        <Head eyebrow={c.eyebrow} title={c.title} sub={c.sub} />

        <div ref={box} className="mt-12 sm:mt-14">
          <div className="flex items-center justify-center gap-2">
            <div role="tablist" className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-black/[0.07] bg-[#f4f4f6] p-1 [scrollbar-width:none]">
              {c.tabs.map((t, i) => {
                const on = i === active;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    type="button"
                    aria-selected={on}
                    onClick={() => { setActive(i); setPlaying(false); }}
                    className={`relative shrink-0 overflow-hidden rounded-full px-4 py-2 text-[14px] font-medium transition-colors sm:px-5 ${
                      on ? "bg-white text-black shadow-[0_1px_3px_rgba(0,0,0,0.1)]" : "text-[#6e6e73] hover:text-black"
                    }`}
                  >
                    {t.label}
                    {on && playing && inView && (
                      <motion.span
                        key={`${active}`}
                        aria-hidden
                        className="absolute inset-x-3 bottom-1 h-[2px] origin-left rounded-full"
                        style={{ background: RED }}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: MODULE_SECONDS, ease: "linear" }}
                        onAnimationComplete={next}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? c.pause : c.play}
              title={playing ? c.pause : c.play}
              className="grid size-10 shrink-0 place-items-center rounded-full border border-black/[0.07] bg-[#f4f4f6] text-[#6e6e73] transition-colors hover:text-black"
            >
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            </button>
          </div>

          <div className="mt-10 grid items-center gap-10 lg:mt-14 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.6fr)] lg:gap-14">
            <div className="order-2 min-h-[260px] lg:order-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <div className="text-[13px] font-semibold" style={{ color: RED }}>
                    {String(active + 1).padStart(2, "0")} / {String(c.tabs.length).padStart(2, "0")}
                  </div>
                  <h3 className="mt-3 text-balance text-[clamp(1.5rem,2.4vw,2rem)] font-semibold leading-[1.15] tracking-[-0.03em]">{tab.title}</h3>
                  <p className="mt-4 text-[15.5px] leading-[1.65] text-[#6e6e73]">{tab.text}</p>
                  <ul className="mt-6 space-y-3">
                    {tab.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-3 text-[14.5px]">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full" style={{ background: "#fdeced", color: RED }}>
                          <CircleCheck className="size-3.5" />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="order-1 lg:order-2">
              <BrowserFrame url={`troya-suite / ${tab.label.toLowerCase()}`}>
                <div className="relative aspect-[4/3] overflow-hidden bg-[#f5f5f4] sm:aspect-[16/10]">
                  {c.tabs.map((t, i) => (
                    <img
                      key={t.key}
                      src={shot(t.img, lang)}
                      alt={t.title}
                      width={2880}
                      height={1800}
                      loading="lazy"
                      decoding="async"
                      aria-hidden={i !== active}
                      className={`${SHOT} transition-[opacity,transform] duration-700`}
                      style={{ ["--fx" as string]: t.focus, opacity: i === active ? 1 : 0, transform: i === active ? "scale(1)" : "scale(1.015)" }}
                    />
                  ))}
                </div>
              </BrowserFrame>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- yaşam döngüsü --------------------------------------------------- */

function Lifecycle({ c, reduce }: { c: LandingCopy["lifecycle"]; reduce: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const inView = useInView(track, { once: true, amount: 0.2 });

  return (
    <section id="lifecycle" className="scroll-mt-20 bg-[#fafafb] py-20 sm:py-28">
      <div className={WRAP}>
        <Head eyebrow={c.eyebrow} title={c.title} sub={c.sub} />

        <div ref={track} className="relative mt-16">
          <div aria-hidden className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-[2px] overflow-hidden rounded-full bg-black/[0.07] md:block">
            <motion.div
              className="h-full origin-left"
              style={{ background: `linear-gradient(90deg, ${STATUS_TONE.O.hex}, ${STATUS_TONE.C.hex}, ${STATUS_TONE.L.hex}, ${STATUS_TONE.F.hex})` }}
              initial={{ scaleX: reduce ? 1 : 0 }}
              animate={inView ? { scaleX: 1 } : undefined}
              transition={{ duration: 2, ease: EASE }}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-4 md:gap-6">
            {c.steps.map((s, i) => {
              const hex = STATUS_TONE[s.code as CouponStatus].hex;
              return (
                <motion.div
                  key={s.code}
                  className="relative flex gap-4 rounded-2xl border border-black/[0.06] bg-white p-5 md:flex-col md:items-center md:border-0 md:bg-transparent md:p-0 md:text-center"
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  animate={inView ? { opacity: 1, y: 0 } : undefined}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.25 + i * 0.4 }}
                >
                  <div
                    className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-white font-mono text-[22px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.05),0_8px_20px_-10px_rgba(0,0,0,0.25)] ring-1 ring-black/[0.06]"
                    style={{ color: hex }}
                  >
                    {s.code}
                    <span className="absolute -bottom-1 -right-1 size-3 rounded-full ring-[3px] ring-[#fafafb]" style={{ background: hex }} />
                  </div>
                  <div className="md:mt-5">
                    <div className="text-[17px] font-semibold tracking-[-0.02em]">{s.name}</div>
                    <p className="mt-1.5 text-[14px] leading-[1.55] text-[#6e6e73] md:mx-auto md:max-w-[15rem]">{s.text}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <Reveal className="mt-20 rounded-3xl border border-black/[0.07] bg-white p-6 sm:p-10">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h3 className="text-[clamp(1.35rem,2.2vw,1.75rem)] font-semibold tracking-[-0.03em]">{c.gridTitle}</h3>
              <p className="mt-1.5 text-[14.5px] text-[#6e6e73]">{c.gridSub}</p>
            </div>
            <span className="font-mono text-[12px] text-[#a1a1a6]">IATA Ticketing Handbook · 1.1.4</span>
          </div>
          <StatusGroup title={c.interim} codes={INTERIM_STATUSES} />
          <StatusGroup title={c.final} codes={FINAL_STATUSES} final />
        </Reveal>
      </div>
    </section>
  );
}

/** Açık tonlu statü renklerini (P, Y…) beyaz zeminde okunur kılmak için koyulaştırır. */
function shade(hex: string, k = 0.38): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * (1 - k));
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function StatusGroup({ title, codes, final }: { title: string; codes: CouponStatus[]; final?: boolean }) {
  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#86868b]">
        {final && <Lock className="size-3" />}
        {title}
      </div>
      <div className="flex flex-wrap gap-2.5">
        {codes.map((s) => {
          const hex = STATUS_TONE[s].hex;
          return (
            <div key={s} className="flex items-center gap-2.5 rounded-xl border border-black/[0.06] bg-[#fcfcfd] py-1.5 pl-1.5 pr-3.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg font-mono text-[14px] font-semibold" style={{ background: `${hex}22`, color: shade(hex) }}>
                {s}
              </span>
              <span className="whitespace-nowrap text-[13.5px] font-medium">{STATUS_META[s].label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --- yetenekler ------------------------------------------------------ */

const ICONS: Record<string, LucideIcon> = {
  ticket: Ticket, refund: Undo2, exchange: ArrowLeftRight, control: ShieldCheck, irrop: CloudLightning, rights: Scale,
  queue: Inbox, memo: Receipt, roles: Users, chat: MessagesSquare, palette: Command, lang: Languages,
};

function Capabilities({ c }: { c: LandingCopy["capabilities"] }) {
  return (
    <section className="py-20 sm:py-28">
      <div className={WRAP}>
        <Head eyebrow={c.eyebrow} title={c.title} sub={c.sub} />
        <Reveal className="mt-14">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-black/[0.07] bg-black/[0.07] lg:grid-cols-4">
            {c.items.map((it) => {
              const Icon = ICONS[it.icon] ?? Boxes;
              return (
                <div key={it.title} className="group min-w-0 bg-white p-4 transition-colors hover:bg-[#fcfcfd] sm:p-7">
                  <span className="grid size-10 place-items-center rounded-xl transition-transform duration-300 group-hover:-translate-y-0.5" style={{ background: "#fdeced", color: RED }}>
                    <Icon className="size-[18px]" strokeWidth={1.8} />
                  </span>
                  <div className="mt-4 text-[15px] font-semibold tracking-[-0.02em] sm:mt-5 sm:text-[16px]">{it.title}</div>
                  <p className="mt-1.5 text-[13px] leading-[1.55] text-[#6e6e73] sm:mt-2 sm:text-[14px] sm:leading-[1.6]">{it.text}</p>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* --- rakamlar -------------------------------------------------------- */

function CountUp({ value, reduce }: { value: string; reduce: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const match = /^(\d+)(.*)$/.exec(value);
  const target = match ? Number(match[1]) : 0;
  const suffix = match?.[2] ?? "";
  const [n, setN] = useState(reduce || !match ? target : 0);
  useEffect(() => {
    if (!inView || reduce || !match) return;
    const ctl = animate(0, target, { duration: 1.6, ease: EASE, onUpdate: (v) => setN(Math.round(v)) });
    return () => ctl.stop();
  }, [inView, reduce, target, match]);
  return <span ref={ref} className="tabular-nums">{match ? `${n}${suffix}` : value}</span>;
}

function Stats({ stats, reduce }: { stats: LandingCopy["stats"]; reduce: boolean }) {
  return (
    <section className="relative overflow-hidden text-white" style={{ background: `linear-gradient(135deg, #d40d10 0%, ${RED} 45%, #950607 100%)` }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "linear-gradient(90deg, transparent, #000 30%, #000 70%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 30%, #000 70%, transparent)",
        }}
      />
      <BrandMark variant="bare" size={420} className="pointer-events-none absolute -bottom-24 -right-16 text-white opacity-[0.07]" />
      <div className={`${WRAP} relative grid grid-cols-2 gap-y-12 py-20 lg:grid-cols-4 lg:py-24`}>
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08} className={`px-2 ${i > 0 ? "lg:border-l lg:border-white/20 lg:pl-10" : ""}`}>
            <div className="text-[clamp(2.75rem,5.5vw,4.5rem)] font-semibold leading-none tracking-[-0.045em]">
              <CountUp value={s.value} reduce={reduce} />
            </div>
            <div className="mt-3 text-[14.5px] text-white/75">{s.label}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* --- mimari ---------------------------------------------------------- */

const NODE_ICONS: LucideIcon[] = [MousePointerClick, Workflow, Cpu, Database, Layers];
const PILLAR_ICONS: LucideIcon[] = [FileStack, Layers, Workflow, KeyRound, Send, Boxes];

function Architecture({ c, reduce }: { c: LandingCopy["architecture"]; reduce: boolean }) {
  return (
    <section id="architecture" className="scroll-mt-20 py-20 sm:py-28">
      <div className={WRAP}>
        <Head eyebrow={c.eyebrow} title={c.title} sub={c.sub} />

        <Reveal className="mt-14 rounded-3xl border border-black/[0.07] bg-[#fafafb] p-5 sm:p-8 lg:p-10">
          <div className="grid lg:grid-cols-5">
            {c.nodes.map((n, i) => {
              const Icon = NODE_ICONS[i];
              const store = i === 3;
              return (
                <div key={n.title} className="relative flex flex-col items-stretch lg:px-2.5">
                  <div
                    className={`relative z-10 flex items-center gap-3.5 rounded-2xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:block lg:p-4 ${store ? "border-[#c70a0c]/35 ring-4 ring-[#c70a0c]/[0.06]" : "border-black/[0.07]"}`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={store ? { background: RED, color: "#fff" } : { background: "#f2f2f4", color: "#1d1d1f" }}>
                      <Icon className="size-[18px]" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold tracking-[-0.02em] lg:mt-3">{n.title}</div>
                      <div className="mt-0.5 text-[13px] text-[#6e6e73]">{n.text}</div>
                    </div>
                  </div>
                  {i < c.nodes.length - 1 && <Connector index={i} reduce={reduce} />}
                </div>
              );
            })}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <EventLog events={c.events} reduce={reduce} />
            <div className="flex flex-col justify-between rounded-2xl border border-black/[0.07] bg-white p-5">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <Send className="size-4" style={{ color: RED }} />
                Outbox
              </div>
              <p className="mt-3 text-[14px] leading-[1.6] text-[#6e6e73]">{c.outbox}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {["events", "outbox", "troya.events", "LH · UA · SQ"].map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    {i > 0 && <ArrowRight className="size-3 text-[#c7c7cc]" />}
                    <span className="rounded-md bg-[#f2f2f4] px-2 py-1 font-mono text-[11px]">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.pillars.map((p, i) => {
            const Icon = PILLAR_ICONS[i];
            return (
              <Reveal key={p.title} delay={(i % 3) * 0.06} className="rounded-2xl border border-black/[0.07] bg-white p-6">
                <div className="flex items-center gap-2.5">
                  <Icon className="size-[18px]" style={{ color: RED }} strokeWidth={1.8} />
                  <div className="text-[15.5px] font-semibold tracking-[-0.02em]">{p.title}</div>
                </div>
                <p className="mt-2.5 text-[14px] leading-[1.6] text-[#6e6e73]">{p.text}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Connector({ index, reduce }: { index: number; reduce: boolean }) {
  return (
    <>
      {/* Masaüstü: düğümler arası yatay hat. */}
      <div aria-hidden className="absolute left-[calc(100%-10px)] top-[38px] z-0 hidden h-px w-5 bg-black/15 lg:block">
        {!reduce && (
          <motion.span
            className="absolute -top-[2.5px] size-1.5 rounded-full"
            style={{ background: RED }}
            animate={{ left: ["0%", "100%"], opacity: [0, 1, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: index * 0.28, repeatDelay: 0.6 }}
          />
        )}
      </div>
      {/* Telefon: alt alta dizilen düğümler arası dikey hat. */}
      <div aria-hidden className="mx-auto h-3 w-px bg-black/15 lg:hidden" />
    </>
  );
}

function EventLog({ events, reduce }: { events: string[]; reduce: boolean }) {
  const [count, setCount] = useState(3);
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { amount: 0.4 });
  useEffect(() => {
    if (reduce || !inView) return;
    const id = window.setInterval(() => setCount((n) => n + 1), 1600);
    return () => window.clearInterval(id);
  }, [reduce, inView]);
  const rows = Array.from({ length: 4 }, (_, k) => {
    const n = count - 3 + k;
    const ms = 1_000 * 44_000 + n * 1_837;
    const d = new Date(ms);
    const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}.${String(d.getUTCMilliseconds()).padStart(3, "0")}`;
    return { n, time, type: events[n % events.length], seq: n + 1 };
  });
  return (
    <div ref={box} className="min-w-0 overflow-hidden rounded-2xl bg-[#0f0f11] p-5 text-[#e8e8ea]">
      <div className="flex items-center justify-between text-[12px] text-[#8e8e93]">
        <span className="flex items-center gap-2 font-medium">
          <Database className="size-3.5" />
          events · append-only
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          live
        </span>
      </div>
      <div className="mt-4 space-y-1.5 font-mono text-[12px] sm:text-[12.5px]">
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map((r, i) => (
            <motion.div
              key={r.n}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: i === rows.length - 1 ? 1 : 0.55 + i * 0.12, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="flex gap-3 whitespace-nowrap"
            >
              <span className="text-[#636366]">{r.time}</span>
              <span className="text-[#ff6b6d]">v{r.seq}</span>
              <span className="truncate">{r.type}</span>
              <span className="ml-auto hidden text-[#636366] sm:inline">235{String(1234567890 + (r.n % 7)).padStart(10, "0")}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* --- kapanış --------------------------------------------------------- */

function Cta({ c }: { c: LandingCopy["cta"] }) {
  return (
    <section className={`${WRAP} pb-20 sm:pb-28`}>
      <Reveal className="relative overflow-hidden rounded-[28px] px-6 py-20 text-center text-white sm:rounded-[36px] sm:py-24">
        <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(80% 90% at 50% 0%, #e0171a 0%, ${RED} 45%, #8a0506 100%)` }} />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
            backgroundSize: "18px 18px",
            maskImage: "radial-gradient(ellipse 60% 70% at 50% 100%, #000, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 60% 70% at 50% 100%, #000, transparent)",
          }}
        />
        <div className="relative">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white shadow-[0_12px_30px_-10px_rgba(0,0,0,0.4)]" style={{ color: RED }}>
            <BrandMark variant="bare" size={34} />
          </span>
          <h2 className={`${H2} mx-auto mt-8 max-w-3xl`}>{c.title}</h2>
          <p className="mx-auto mt-5 max-w-xl text-[clamp(1rem,1.35vw,1.15rem)] leading-[1.6] text-white/80">{c.sub}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/" className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-medium transition-transform hover:scale-[1.02]" style={{ color: RED }}>
              {c.primary}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/docs" className="inline-flex h-12 items-center rounded-full border border-white/35 px-6 text-[15px] font-medium text-white transition-colors hover:bg-white/10">
              {c.secondary}
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer({ c }: { c: LandingCopy["footer"] }) {
  return (
    <footer className="border-t border-black/[0.06]">
      <div className={`${WRAP} flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex items-center gap-3">
          <BrandMark size={28} />
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.01em]">Troya Suite</div>
            <div className="text-[12.5px] text-[#86868b]">{c.line}</div>
          </div>
        </div>
        <div className="flex items-center gap-5 text-[12.5px] text-[#86868b]">
          <span>{c.note}</span>
          <span className="hidden sm:inline">© 2026</span>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="grid size-9 place-items-center rounded-full border border-black/[0.08] text-[#48484a] transition-colors hover:bg-black/[0.04]"
            aria-label={c.top}
            title={c.top}
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
    </footer>
  );
}
