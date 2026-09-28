import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useInView } from "motion/react";
import { Check, Lock, Paperclip, Search, Ticket } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import type { Lang } from "@/store/ui";
import type { LandingCopy } from "./copy";

/**
 * Tanıtım sayfasının canlı küçük ekranları. Hepsi saf HTML/CSS + motion;
 * görünür olduklarında oynar, ekrandan çıkınca durur. Veriler temsilîdir ve
 * uygulamanın gerçek ekranlarının sadeleştirilmiş hâlidir.
 */

export const RED = "#c70a0c";

/* --- ortak kancalar -------------------------------------------------- */

/** Görünürken `n` adımda döner. */
export function useCycle(n: number, ms: number, active: boolean): number {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % n), ms);
    return () => window.clearInterval(id);
  }, [n, ms, active]);
  return i;
}

export function useSeen<T extends Element>(amount = 0.35) {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { amount });
  return [ref, inView] as const;
}

function CountUp({ to, active, format, duration = 1.4 }: { to: number; active: boolean; format: (n: number) => string; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) return;
    const c = animate(0, to, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setV });
    return () => c.stop();
  }, [to, active, duration]);
  return <>{format(v)}</>;
}

const money = (lang: Lang, n: number, frac = 2) =>
  n.toLocaleString(lang === "tr" ? "tr-TR" : "en-GB", { minimumFractionDigits: frac, maximumFractionDigits: frac });

/* --- 1. ücret seçimi ------------------------------------------------- */

export function FareMock({ c, lang, active }: { c: LandingCopy["bento"]["issue"]; lang: Lang; active: boolean }) {
  const i = useCycle(3, 1700, active);
  const rows = [
    { name: "Eco Saver", rbd: "Y", basis: "YLXOWTR", price: 4250 },
    { name: "Eco Classic", rbd: "M", basis: "MLXOWTR", price: 5980 },
    { name: "Business Flex", rbd: "J", basis: "JFLXOWTR", price: 14900 },
  ];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.12)]">
      <div className="mb-3 flex items-center justify-between text-[12px] text-[#6e6e73]">
        <span className="font-mono font-semibold text-[#1d1d1f]">IST → FRA</span>
        <span className="font-mono">TK1591 · 07:20</span>
      </div>
      <div className="mb-3 flex gap-1.5">
        {c.chips.map((chip, k) => (
          <span
            key={chip}
            className="rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-500"
            style={k === i ? { background: RED, color: "#fff" } : { background: "#f5f5f7", color: "#1d1d1f" }}
          >
            {chip}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((r, k) => (
          <div
            key={r.name}
            className="flex items-center justify-between rounded-xl border px-3 py-2.5 transition-all duration-500"
            style={k === i ? { borderColor: RED, background: "#fdf2f2" } : { borderColor: "#ececef", background: "#fff" }}
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-5 w-5 place-items-center rounded-full border transition-colors duration-500"
                style={k === i ? { background: RED, borderColor: RED } : { borderColor: "#d2d2d7" }}>
                {k === i && <Check size={12} strokeWidth={3} color="#fff" />}
              </span>
              <span className="text-[13px] font-medium text-[#1d1d1f]">{r.name}</span>
            </div>
            <span className="font-mono text-[13px] font-semibold text-[#1d1d1f]">{money(lang, r.price, 0)} TRY</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 font-mono text-[11.5px] text-[#6e6e73]">
        <span>RBD</span>
        <AnimatePresence mode="wait">
          <motion.span key={rows[i].rbd} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="rounded bg-[#f5f5f7] px-1.5 py-0.5 font-semibold text-[#1d1d1f]">{rows[i].rbd}</motion.span>
        </AnimatePresence>
        <span>·</span>
        <AnimatePresence mode="wait">
          <motion.span key={rows[i].basis} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="rounded bg-[#f5f5f7] px-1.5 py-0.5 font-semibold text-[#1d1d1f]">{rows[i].basis}</motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* --- 2. iade hesabı -------------------------------------------------- */

export function MoneyMock({ c, lang, active }: { c: LandingCopy["bento"]["money"]; lang: Lang; active: boolean }) {
  const values = [5980, -750, 1212.4];
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <div className="flex flex-col gap-2">
      {c.lines.slice(0, 3).map((l, k) => (
        <motion.div
          key={l}
          initial={{ opacity: 0, x: -12 }}
          animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }}
          transition={{ delay: 0.15 + k * 0.25, duration: 0.5 }}
          className="flex items-center justify-between border-b border-white/15 pb-2 text-[13px]"
        >
          <span className="text-white/75">{l}</span>
          <span className="font-mono font-medium">{values[k] > 0 && k > 0 ? "+" : ""}{money(lang, values[k])}</span>
        </motion.div>
      ))}
      <motion.div
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="mt-1 flex items-end justify-between"
      >
        <span className="text-[13px] font-medium text-white/90">{c.lines[3]}</span>
        <span className="font-mono text-[26px] font-semibold tracking-tight">
          <CountUp to={total} active={active} format={(n) => money(lang, n)} />
          <span className="ml-1 text-[13px] font-medium text-white/70">TRY</span>
        </span>
      </motion.div>
    </div>
  );
}

/* --- 3. koltuk haritası ---------------------------------------------- */

const TAKEN = new Set(["1A", "1F", "2C", "2D", "3B", "4E", "4F", "6A", "6C", "7D", "8B", "8E", "9A", "9F", "10C", "11D", "11E", "12B"]);
const PICKS = ["3C", "7A", "10E", "5D", "12F"];

export function SeatMock({ active }: { active: boolean }) {
  const i = useCycle(PICKS.length, 1300, active);
  const rows = Array.from({ length: 12 }, (_, r) => r + 1);
  const cols = ["A", "B", "C", "D", "E", "F"];
  return (
    <div className="mx-auto w-full max-w-[250px] rounded-[26px] border border-[#ececef] bg-white px-4 pb-4 pt-6">
      <div className="mb-3 grid grid-cols-[repeat(3,1fr)_14px_repeat(3,1fr)] gap-1.5 text-center font-mono text-[9.5px] text-[#86868b]">
        {cols.slice(0, 3).map((c) => <span key={c}>{c}</span>)}<span />{cols.slice(3).map((c) => <span key={c}>{c}</span>)}
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r} className="relative grid grid-cols-[repeat(3,1fr)_14px_repeat(3,1fr)] gap-1.5">
            {cols.map((c, k) => {
              const id = `${r}${c}`;
              const picked = PICKS[i] === id;
              const exit = r === 5;
              const seat = (
                <motion.span
                  key={id}
                  animate={{ scale: picked ? 1.12 : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  className="aspect-square rounded-[5px] border"
                  style={
                    picked ? { background: RED, borderColor: RED }
                      : TAKEN.has(id) ? { background: "#e8e8ed", borderColor: "#e8e8ed" }
                      : exit ? { background: "#fff", borderColor: RED, borderStyle: "dashed" }
                      : { background: "#fff", borderColor: "#d2d2d7" }
                  }
                />
              );
              return k === 3 ? [<span key={`a${r}`} className="grid place-items-center font-mono text-[8.5px] text-[#86868b]">{r}</span>, seat] : seat;
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11.5px]">
        <AnimatePresence mode="wait">
          <motion.span key={PICKS[i]} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="font-mono font-semibold text-[#1d1d1f]">{PICKS[i]}</motion.span>
        </AnimatePresence>
        <span className="flex items-center gap-1.5 text-[#86868b]"><span className="h-2 w-2 rounded-[2px] border border-dashed" style={{ borderColor: RED }} />EXIT</span>
      </div>
    </div>
  );
}

/* --- 4. kalkış panosu ------------------------------------------------ */

export function HubMock({ c, active }: { c: LandingCopy["bento"]["hub"]; active: boolean }) {
  const [sec, setSec] = useState(24 * 60 + 38);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setSec((s) => (s > 0 ? s - 1 : 24 * 60 + 38)), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  const rows: { f: string; to: string; gate: string; state: number; tone: "red" | "ink" | "gray" }[] = [
    { f: "TK1591", to: "FRA", gate: "B12", state: 0, tone: "red" },
    { f: "TK21", to: "LHR", gate: "A4", state: 1, tone: "red" },
    { f: "TK198", to: "NRT", gate: "D2", state: 2, tone: "gray" },
    { f: "TK6", to: "JFK", gate: "F9", state: 3, tone: "ink" },
  ];
  return (
    <div className="rounded-2xl bg-[#1d1d1f] p-4 text-white">
      <div className="mb-3 flex items-center justify-between">
        <span lang="en" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">IST · Departures</span>
        <span className="font-mono text-[13px] font-semibold" style={{ color: "#ff6b6d" }}>{mm}:{ss}</span>
      </div>
      <div className="grid grid-cols-[1.1fr_0.8fr_0.7fr_1.2fr] gap-y-2 font-mono text-[12.5px]">
        {c.cols.map((h) => <span key={h} className="text-[10px] font-sans font-semibold uppercase tracking-[0.12em] text-white/40">{h}</span>)}
        {rows.map((r, k) => [
          <motion.span key={`${r.f}f`} initial={{ opacity: 0 }} animate={active ? { opacity: 1 } : {}} transition={{ delay: k * 0.12 }}>{r.f}</motion.span>,
          <span key={`${r.f}t`} className="text-white/80">{r.to}</span>,
          <span key={`${r.f}g`} className="text-white/80">{r.gate}</span>,
          <span key={`${r.f}s`}>
            <span className="rounded-full px-2 py-0.5 font-sans text-[11px] font-medium"
              style={r.tone === "red" ? { background: RED } : r.tone === "ink" ? { background: "rgba(255,255,255,0.14)" } : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
              {c.states[r.state]}{r.state === 3 ? " +205" : ""}
            </span>
          </span>,
        ])}
      </div>
    </div>
  );
}

/* --- 5. ⌘K ------------------------------------------------------------ */

export function PaletteMock({ c, active }: { c: LandingCopy["bento"]["palette"]; active: boolean }) {
  const [n, setN] = useState(0);
  const full = c.query;
  useEffect(() => {
    if (!active) return;
    let k = 0;
    const id = window.setInterval(() => {
      k = (k + 1) % (full.length + 14);
      setN(Math.min(k, full.length));
    }, 110);
    return () => window.clearInterval(id);
  }, [active, full]);
  const done = n >= full.length;
  return (
    <div className="rounded-2xl border border-[#ececef] bg-white p-3 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-2 border-b border-[#ececef] pb-2.5">
        <Search size={15} className="text-[#86868b]" />
        <span className="font-mono text-[13px] text-[#1d1d1f]">{full.slice(0, n)}</span>
        <span className="h-4 w-[1.5px] animate-pulse" style={{ background: RED }} />
        <span className="ml-auto rounded border border-[#e5e5ea] px-1 font-mono text-[10px] text-[#86868b]">⌘K</span>
      </div>
      <div className="mt-2 flex min-h-[92px] flex-col gap-1">
        <AnimatePresence>
          {done && c.results.map((r, k) => (
            <motion.div key={r} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: k * 0.08 }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px]"
              style={k === 0 ? { background: "#fdf2f2", color: RED } : { color: "#1d1d1f" }}>
              <Ticket size={13} />{r}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* --- 6. rapor -------------------------------------------------------- */

export function ReportsMock({ lang, active }: { lang: Lang; active: boolean }) {
  const bars = [42, 58, 51, 74, 66, 88, 71];
  const days = lang === "tr" ? ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"] : ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="font-mono text-[24px] font-semibold tracking-tight text-[#1d1d1f]">
          <CountUp to={1284600} active={active} format={(n) => money(lang, n, 0)} />
        </span>
        <span className="text-[12px] text-[#86868b]">TRY · net</span>
      </div>
      <div className="flex h-[92px] items-end gap-2">
        {bars.map((h, k) => (
          <div key={k} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <motion.div
              className="w-full rounded-[6px]"
              style={{ background: k === 5 ? RED : "#e8e8ed", originY: 1 }}
              initial={{ height: 0 }}
              animate={active ? { height: `${h}%` } : { height: 0 }}
              transition={{ delay: k * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
            <span className="text-[10px] text-[#86868b]">{days[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --- 7. roller ------------------------------------------------------- */

export function RolesMock({ names, active }: { names: string[]; active: boolean }) {
  const i = useCycle(names.length, 1100, active);
  return (
    <div className="flex flex-col gap-1.5">
      {names.map((n, k) => {
        const on = k <= i;
        return (
          <div key={n} className="flex items-center justify-between rounded-xl border px-3 py-2 text-[12.5px] transition-colors duration-500"
            style={on ? { borderColor: "#f3c9c9", background: "#fdf2f2" } : { borderColor: "#ececef", background: "#fff" }}>
            <span className="font-medium text-[#1d1d1f]">{n}</span>
            {on ? <Check size={14} color={RED} strokeWidth={2.5} /> : <Lock size={13} className="text-[#aeaeb2]" />}
          </div>
        );
      })}
    </div>
  );
}

/* --- 8. sohbet ------------------------------------------------------- */

export function ChatMock({ c, active }: { c: LandingCopy["bento"]["chat"]; active: boolean }) {
  const i = useCycle(4, 1400, active);
  return (
    <div className="flex min-h-[150px] flex-col gap-2">
      <AnimatePresence>
        {i >= 1 && (
          <motion.div key="m1" initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
            className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-white px-3 py-2 text-[12.5px] text-[#1d1d1f] shadow-sm">
            <div className="mb-0.5 text-[10.5px] font-medium text-[#86868b]">Mert Kaya</div>{c.msg1}
          </motion.div>
        )}
        {i >= 2 && (
          <motion.div key="m2" initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
            className="max-w-[85%] self-end rounded-2xl rounded-br-md px-3 py-2 text-[12.5px] text-white" style={{ background: RED }}>
            {c.msg2}
            <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-white/15 px-2 py-1 font-mono text-[11px]">
              <Paperclip size={11} />2351234567890 · IST→FRA
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* --- 9. yolcu hakları ------------------------------------------------ */

export function RightsMock({ active }: { active: boolean }) {
  return (
    <div>
      <div className="font-mono text-[54px] font-semibold leading-none tracking-[-0.04em] text-white">
        €<CountUp to={400} active={active} format={(n) => String(Math.round(n))} />
      </div>
      <div className="mt-2 font-mono text-[12px] text-white/70">IST → FRA · 1.865 km</div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["EU261", "SHY-YOLCU", "UK261"].map((x) => (
          <span key={x} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white">{x}</span>
        ))}
      </div>
    </div>
  );
}

/* --- 10. PNR --------------------------------------------------------- */

export function ResMock({ active }: { active: boolean }) {
  const [sec, setSec] = useState(71 * 3600 + 59 * 60 + 12);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setSec((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  const h = Math.floor(sec / 3600);
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white p-4">
      <div>
        <div className="font-mono text-[22px] font-semibold tracking-[0.06em] text-[#1d1d1f]">XQ7T2M</div>
        <div className="text-[11.5px] text-[#86868b]">ERDOGAN/AHMET · IST → FRA</div>
      </div>
      <span className="rounded-full px-2.5 py-1 font-mono text-[11.5px] font-semibold" style={{ background: "#fdf2f2", color: RED }}>
        TTL {h}:{m}:{s}
      </span>
    </div>
  );
}

/* --- 11. belgeler ---------------------------------------------------- */

export function DocsMock({ active, lang }: { active: boolean; lang: Lang }) {
  const docs = [
    { k: "EMD-S", v: lang === "tr" ? "0C3 · Fazla bagaj" : "0C3 · Excess baggage", n: "2359000111224" },
    { k: "PTA", v: "Sponsor · ACME LTD", n: "PTA-24A7" },
    { k: "ADM", v: lang === "tr" ? "Res. 850m · 15 gün" : "Res. 850m · 15 days", n: "ADM-2026-0412" },
  ];
  return (
    <div className="relative h-[132px]">
      {docs.map((d, k) => (
        <motion.div
          key={d.k}
          initial={{ rotate: 0, x: 0, y: 0 }}
          animate={active ? { rotate: (k - 1) * 5, x: (k - 1) * 64, y: Math.abs(k - 1) * 8 } : { rotate: 0, x: 0, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.1 * k }}
          className="absolute left-1/2 top-2 w-[170px] -translate-x-1/2 rounded-xl border border-[#ececef] bg-white p-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: k === 1 ? 3 : 1 }}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: RED }}>{d.k}</span>
            <BrandMark size={14} />
          </div>
          <div className="text-[11.5px] text-[#1d1d1f]">{d.v}</div>
          <div className="mt-1 font-mono text-[10px] text-[#86868b]">{d.n}</div>
        </motion.div>
      ))}
    </div>
  );
}

/* --- 12. dil --------------------------------------------------------- */

export function LangMock({ active }: { active: boolean }) {
  const i = useCycle(2, 1600, active);
  const words = [["Bilet kes", "İade", "Uçuldu"], ["Issue ticket", "Refund", "Flown"]];
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex rounded-full bg-white p-1 text-[12px] font-semibold shadow-[inset_0_0_0_1px_#ececef]">
        <motion.span
          className="absolute inset-y-1 w-[42px] rounded-full"
          style={{ background: RED }}
          animate={{ left: i === 0 ? 4 : 46 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
        <span className="relative z-10 w-[42px] py-1 text-center transition-colors duration-300" style={{ color: i === 0 ? "#fff" : "#86868b" }}>TR</span>
        <span className="relative z-10 w-[42px] py-1 text-center transition-colors duration-300" style={{ color: i === 1 ? "#fff" : "#86868b" }}>EN</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {words[i].map((w) => (
          <AnimatePresence mode="wait" key={w}>
            <motion.span key={w} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="rounded-lg border border-[#ececef] bg-white px-2 py-1 text-[12px] text-[#1d1d1f]">{w}</motion.span>
          </AnimatePresence>
        ))}
      </div>
    </div>
  );
}

/* --- vitrin: uygulama penceresi ------------------------------------- */

export function AppWindow({ c, lang }: { c: LandingCopy["showcase"]["window"]; lang: Lang }) {
  const coupons: { seq: number; route: string; flight: string; date: string; st: "O" | "F"; label: string }[] = [
    { seq: 1, route: "IST → FRA", flight: "TK1591", date: "29SEP", st: "F", label: c.flown },
    { seq: 2, route: "FRA → IST", flight: "TK1592", date: "06OCT", st: "O", label: c.open },
  ];
  return (
    <div className="overflow-hidden rounded-[18px] border border-black/10 bg-white shadow-[0_40px_120px_-30px_rgba(60,0,0,0.35)]">
      {/* pencere çubuğu */}
      <div className="flex items-center gap-2 border-b border-[#ececef] bg-[#f6f6f8] px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="mx-auto hidden rounded-md bg-white px-12 py-1 text-[11px] text-[#86868b] sm:block">troya-suite</span>
      </div>
      {/* üst çubuk */}
      <div className="flex items-center gap-3 border-b border-[#ececef] px-4 py-2.5">
        <BrandMark size={22} />
        <span className="text-[13px] font-semibold text-[#1d1d1f]">Troya Suite</span>
        <div className="ml-3 hidden gap-4 text-[12.5px] text-[#6e6e73] md:flex">
          <span>Panel</span><span>QuickRes</span>
          <span className="relative font-semibold" style={{ color: RED }}>Troya<span className="absolute -bottom-[11px] left-0 right-0 h-[2px] rounded-full" style={{ background: RED }} /></span>
          <span>QuickCheck-in</span>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-lg border border-[#ececef] px-2.5 py-1 text-[11.5px] text-[#86868b]">
          <Search size={12} /><span className="hidden sm:inline">{c.search}</span><span className="font-mono text-[10px]">⌘K</span>
        </div>
      </div>
      {/* kayıt */}
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_210px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-mono text-[18px] font-semibold text-[#1d1d1f]">2351234567890</div>
              <div className="text-[11.5px] text-[#86868b]">ERDOGAN/AHMET MR · Control: TK</div>
            </div>
            <div className="flex gap-1.5">
              {c.actions.map((a) => (
                <span key={a} className="rounded-lg border border-[#e5e5ea] px-2.5 py-1 text-[11.5px] font-medium text-[#1d1d1f]">{a}</span>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-[#ececef]">
            <div className="flex items-center justify-between px-3 py-2 text-white" style={{ background: RED }}>
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]"><BrandMark size={14} variant="bare" /><span lang="en">Turkish Airlines</span></span>
              <span lang="en" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">E-Ticket</span>
            </div>
            <div className="flex items-center justify-between px-4 py-4">
              <div><div className="font-mono text-[30px] font-semibold leading-none text-[#1d1d1f]">IST</div><div className="text-[11px] text-[#86868b]">{lang === "tr" ? "İstanbul" : "Istanbul"}</div></div>
              <div className="mx-3 flex flex-1 items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: RED }} />
                <span className="h-px flex-1 bg-[#d2d2d7]" />
                <span className="font-mono text-[10px] text-[#86868b]">TK1591</span>
                <span className="h-px flex-1 bg-[#d2d2d7]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#d2d2d7]" />
              </div>
              <div className="text-right"><div className="font-mono text-[30px] font-semibold leading-none text-[#1d1d1f]">FRA</div><div className="text-[11px] text-[#86868b]">Frankfurt</div></div>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#86868b]">{c.coupons}</div>
            {coupons.map((k) => (
              <div key={k.seq} className="flex items-center gap-3 border-b border-[#f0f0f2] py-2 text-[12px] last:border-0">
                <span className="font-mono text-[#86868b]">{k.seq}</span>
                <span className="font-mono font-medium text-[#1d1d1f]">{k.route}</span>
                <span className="hidden font-mono text-[#6e6e73] sm:inline">{k.flight} · {k.date}</span>
                <span className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={k.st === "O" ? { background: "#fdf2f2", color: RED } : { background: "#f2f2f4", color: "#1d1d1f" }}>
                  {k.st} · {k.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden flex-col gap-2 md:flex">
          <div className="rounded-xl bg-[#f5f5f7] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#86868b]">{c.total}</div>
            <div className="font-mono text-[20px] font-semibold text-[#1d1d1f]">{money(lang, 11960)} <span className="text-[11px] text-[#86868b]">TRY</span></div>
          </div>
          <div className="flex-1 rounded-xl border border-[#ececef] p-3">
            {[0, 1, 2, 3].map((k) => (
              <div key={k} className="flex items-center gap-2 py-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: k === 0 ? RED : "#d2d2d7" }} />
                <span className="h-1.5 flex-1 rounded-full bg-[#f0f0f2]" style={{ maxWidth: `${90 - k * 14}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- vitrin: terminal ------------------------------------------------ */

export function TerminalMock({ commands, active }: { commands: string[]; active: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setShown((n) => (n + 1) % (commands.length + 3)), 700);
    return () => window.clearInterval(id);
  }, [active, commands.length]);
  return (
    <div className="rounded-[18px] bg-[#0b0b0c] p-5 font-mono text-[13px] leading-7 text-[#e6e6e6] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
      <div className="mb-2 text-[11px] text-white/35">TROYA &gt; IST-CTR · TK</div>
      {commands.slice(0, Math.min(shown, commands.length)).map((cmd) => (
        <div key={cmd}><span className="text-white/40">&gt; </span>{cmd}</div>
      ))}
      <div><span className="text-white/40">&gt; </span><span className="inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-white/70" /></div>
    </div>
  );
}

/* --- yaşam döngüsü bileti ------------------------------------------- */

export function LifecycleTicket({ c, step }: { c: LandingCopy["lifecycle"]; step: number }) {
  const s = c.steps[step];
  return (
    <div className="mx-auto w-full max-w-[440px] overflow-hidden rounded-[26px] bg-white shadow-[0_40px_100px_-30px_rgba(60,0,0,0.3)]">
      <div className="flex items-center justify-between px-5 py-3 text-white" style={{ background: RED }}>
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]"><BrandMark size={15} variant="bare" /><span lang="en">Turkish Airlines</span></span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">{c.ticket}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 px-5 pt-5">
        <div><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#86868b]">{c.passenger}</div><div className="text-[14px] font-semibold text-[#1d1d1f]">ERDOGAN/AHMET</div></div>
        <div><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#86868b]">{c.flight}</div><div className="font-mono text-[14px] font-semibold text-[#1d1d1f]">TK1591 · IST → FRA</div></div>
      </div>
      <div className="px-5 pt-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#86868b]">{c.status}</div>
        <div className="mt-2 flex items-center gap-3">
          <AnimatePresence mode="wait">
            <motion.span
              key={s.code}
              initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.6, opacity: 0, rotate: 8 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="grid h-14 w-14 place-items-center rounded-2xl font-mono text-[28px] font-semibold"
              style={step === 3 ? { background: RED, color: "#fff" } : { background: "#fdf2f2", color: RED }}
            >
              {s.code}
            </motion.span>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.span key={s.name} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
              className="text-[22px] font-semibold tracking-tight text-[#1d1d1f]">{s.name}</motion.span>
          </AnimatePresence>
        </div>
      </div>
      <div className="mt-5 border-t border-dashed border-[#e5e5ea] px-5 py-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#86868b]">{c.timeline}</div>
        <div className="relative flex flex-col gap-2 pl-4">
          <span className="absolute bottom-1 left-[3px] top-1 w-px bg-[#e5e5ea]" />
          {c.events.map((e, k) => (
            <motion.div key={e} animate={{ opacity: k <= step ? 1 : 0.25 }} className="relative flex items-center justify-between text-[12.5px]">
              <span className="absolute -left-4 top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full" style={{ background: k <= step ? RED : "#d2d2d7" }} />
              <span className="text-[#1d1d1f]">{e}</span>
              <span className="font-mono text-[11px] text-[#86868b]">{c.steps[k].code}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --- olay akışı ------------------------------------------------------ */

export function EventStream({ events, label, active }: { events: string[]; label: string; active: boolean }) {
  const [items, setItems] = useState<{ id: number; name: string }[]>([]);
  const n = useRef(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const id = n.current++;
      setItems((xs) => [{ id, name: events[id % events.length] }, ...xs].slice(0, 6));
    };
    tick();
    const t = window.setInterval(tick, 1300);
    return () => window.clearInterval(t);
  }, [active, events]);
  return (
    <div className="rounded-[22px] border border-[#ececef] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">{label}</span>
        <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: RED }}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: RED }} />live
        </span>
      </div>
      <div className="flex min-h-[236px] flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {items.map((it, k) => (
            <motion.div
              key={it.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1 - k * 0.12, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="flex items-center justify-between rounded-xl border border-[#f0f0f2] bg-[#fbfbfd] px-3 py-2"
            >
              <span className="font-mono text-[12.5px] text-[#1d1d1f]">{it.name}</span>
              <span className="font-mono text-[10.5px] text-[#86868b]">#{String(1042 + it.id).padStart(5, "0")}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Card({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`relative overflow-hidden rounded-[28px] p-6 sm:p-7 ${className ?? ""}`} style={style}>
      {children}
    </div>
  );
}
