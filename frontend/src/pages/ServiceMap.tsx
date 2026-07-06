import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "@tanstack/react-router";
import { MOCK_TICKETS, MOCK_EMDS, MOCK_ORDERS } from "@/domain/mockData";
import { FLIGHTS } from "@/domain/checkin";

// Service Map — claude.ai/design "Service Map.dc.html" tasarımını BİZİM tasarım sistemimize
// uyarladık: tema-duyarlı (light/dark, CSS değişkenleri), Geist font, shadcn-stili kartlar.
// Düğümler GERÇEK mimarimiz (Experience modülleri + Engine katmanları + adapter'lar + veri depoları),
// metrikler gerçek mock veri sayımlarından. Zoom'da kırp/bulanıklık yok (will-change kaldırıldı;
// dünya tek katman olarak yeniden raster'lanır). Global tasarım sistemine dokunulmadı (scoped).

type Preset = "maple" | "neon" | "blueprint";
type ColorMode = "service" | "status";
type Status = "healthy" | "degraded" | "error";
type NodeT = { id: string; name: string; tag: string; color: string; status: Status; rate: number; err: number; lat: number; count: number; x: number; y: number };
type EdgeT = { id: string; s: string; t: string };
type PartT = { id: string; edge: string };

const NW = 220, NH = 80;

// ---- gerçek veri sayımları (mevcut sistemden) ----
const tkN = MOCK_TICKETS.length;
const emdN = MOCK_EMDS.length;
const ordN = MOCK_ORDERS.length;
const flN = FLIGHTS.length;

const N = (id: string, name: string, tag: string, color: string, status: Status, rate: number, err: number, lat: number, count: number, x: number, y: number): NodeT =>
  ({ id, name, tag, color, status, rate, err, lat, count, x, y });

// Gerçek mimari: Experience (FE modülleri) · Engine (api/app/domain) · Adapter'lar · Veri depoları.
const NODES: NodeT[] = [
  // EXPERIENCE (frontend modülleri)
  N("quickres", "QuickRes (PNR)", "FE", "#2563EB", "healthy", 180, 0.1, 42, 1, 40, 96),
  N("troya", "Troya · Biletleme", "FE", "#DC2626", "healthy", 540, 0.2, 58, tkN, 40, 212),
  N("quickcheckin", "QuickCheck-in", "FE", "#0891B2", "healthy", 320, 0.3, 51, flN, 40, 328),
  N("hub-kontrol", "HUB Kontrol", "FE", "#7C3AED", "healthy", 95, 0.0, 39, 1, 40, 444),
  N("yonetim", "Yönetim", "FE", "#64748B", "healthy", 22, 0.0, 35, 1, 40, 560),
  // ENGINE — API / Application
  N("rest-api", "REST API · /tickets", "API", "#0EA5E9", "healthy", 760, 0.3, 64, 1, 344, 96),
  N("issue-handler", "IssueTicket (use-case)", "APP", "#16A34A", "healthy", 410, 0.2, 88, 1, 344, 212),
  N("ticket-queries", "TicketQueries (read)", "APP", "#0D9488", "healthy", 350, 0.1, 21, tkN, 344, 328),
  // ENGINE — Domain
  N("ticket-aggregate", "Ticket aggregate", "DOMAIN", "#9333EA", "healthy", 410, 0.0, 4, 1, 344, 470),
  N("coupon-fsm", "Coupon FSM", "DOMAIN", "#C026D3", "healthy", 410, 0.0, 1, 18, 344, 586),
  // ADAPTER'lar (infrastructure)
  N("event-store", "Event Store (jsonb)", "ADAPTER", "#CA8A04", "healthy", 410, 0.1, 9, tkN, 632, 120),
  N("projection", "Read-model projeksiyon", "ADAPTER", "#2563EB", "healthy", 410, 0.1, 6, tkN, 632, 236),
  N("read-model", "ticket_read", "ADAPTER", "#0891B2", "healthy", 350, 0.0, 3, tkN, 632, 352),
  N("idempotency", "Idempotency store", "ADAPTER", "#DB2777", "healthy", 410, 0.0, 2, tkN, 632, 468),
  N("ticketno-gen", "TicketNo sequence", "ADAPTER", "#65A30D", "healthy", 410, 0.0, 1, 1, 632, 584),
  // VERİ DEPOLARI
  N("postgres", "PostgreSQL 16", "STORE", "#2F6FEB", "healthy", 2100, 0.0, 7, 1, 912, 150),
  N("redis", "Redis (control lease)", "STORE", "#DC2626", "healthy", 1800, 0.0, 1, 1, 912, 290),
  N("redpanda", "Redpanda (outbox)", "STORE", "#EA580C", "degraded", 0, 0.0, 0, 0, 912, 430),
  N("keycloak", "Keycloak (OIDC)", "STORE", "#475569", "degraded", 0, 0.0, 0, 0, 912, 560),
];
const NODE: Record<string, NodeT> = {};
NODES.forEach((n) => (NODE[n.id] = n));

const GROUPS = [
  { id: "exp", label: "EXPERIENCE", members: ["quickres", "troya", "quickcheckin", "hub-kontrol", "yonetim"] },
  { id: "engine", label: "ENGINE", members: ["rest-api", "issue-handler", "ticket-queries", "ticket-aggregate", "coupon-fsm"] },
  { id: "infra", label: "ALTYAPI", members: ["event-store", "projection", "read-model", "idempotency", "ticketno-gen"] },
];

const PAIRS: [string, string][] = [
  ["quickres", "rest-api"], ["troya", "rest-api"], ["quickcheckin", "rest-api"], ["hub-kontrol", "ticket-queries"], ["yonetim", "keycloak"],
  ["rest-api", "issue-handler"], ["rest-api", "ticket-queries"], ["rest-api", "redis"], ["rest-api", "keycloak"],
  ["issue-handler", "ticket-aggregate"], ["issue-handler", "event-store"], ["issue-handler", "idempotency"], ["issue-handler", "ticketno-gen"],
  ["ticket-aggregate", "coupon-fsm"],
  ["event-store", "postgres"], ["event-store", "projection"], ["event-store", "redpanda"],
  ["projection", "read-model"], ["read-model", "postgres"], ["ticket-queries", "read-model"],
  ["idempotency", "postgres"], ["ticketno-gen", "postgres"],
];
const EDGES: EdgeT[] = PAIRS.map((p, i) => ({ id: "e" + i, s: p[0], t: p[1] }));
const EDGE: Record<string, EdgeT> = {};
EDGES.forEach((e) => (EDGE[e.id] = e));
const NODE_EDGES: Record<string, string[]> = {};
EDGES.forEach((e) => { (NODE_EDGES[e.s] = NODE_EDGES[e.s] || []).push(e.id); (NODE_EDGES[e.t] = NODE_EDGES[e.t] || []).push(e.id); });
const PARTS: PartT[] = [];
EDGES.forEach((e) => { for (let k = 0; k < 2; k++) PARTS.push({ id: e.id + "_" + k, edge: e.id }); });

const TIME_OPTS = ["Son 15 dakika", "Son 1 saat", "Son 24 saat", "Son 7 gün"];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ST: Record<Status, string> = { healthy: "#22C55E", degraded: "#F59E0B", error: "#EF4444" };
const statusColor = (s: Status) => ST[s];
const hexA = (hex: string, a: number) => { const h = hex.replace("#", ""); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; };
const fmtRate = (x: number) => (x >= 1000 ? (x / 1000).toFixed(1) + "k" : x >= 100 ? String(Math.round(x)) : x.toFixed(1));
const fmtErr = (x: number) => x.toFixed(1) + "%";
const fmtLat = (x: number) => (x >= 1000 ? (x / 1000).toFixed(2) + "s" : x < 100 ? x.toFixed(1) + "ms" : Math.round(x) + "ms");
const errColor = (x: number) => (x >= 3 ? "#EF4444" : x >= 1 ? "#F59E0B" : "var(--text-tertiary)");

export function ServiceMap() {
  const router = useRouter();
  const goBack = () => { if (window.history.length > 1) router.history.back(); else router.navigate({ to: "/ops" }); };
  const [preset, setPreset] = useState<Preset>("maple");
  const [colorMode, setColorMode] = useState<ColorMode>("service");
  const [timeRange, setTimeRange] = useState(TIME_OPTS[2]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [, setBump] = useState(0);

  const pos = useRef<Record<string, { x: number; y: number }>>({});
  const view = useRef({ x: 0, y: 0, k: 1 });
  const nodeEls = useRef<Record<string, HTMLDivElement | null>>({});
  const edgeEls = useRef<Record<string, { glow?: SVGPathElement; thin?: SVGPathElement }>>({});
  const partEls = useRef<Record<string, SVGGElement | null>>({});
  const groupEls = useRef<Record<string, HTMLDivElement | null>>({});
  const miniEls = useRef<Record<string, SVGRectElement | null>>({});
  const viewportEl = useRef<HTMLDivElement | null>(null);
  const worldEl = useRef<HTMLDivElement | null>(null);
  const minimapEl = useRef<HTMLDivElement | null>(null);
  const miniRectEl = useRef<SVGRectElement | null>(null);
  const tipEl = useRef<HTMLDivElement | null>(null);
  const reloadIconEl = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: number } | null>(null);
  const pan = useRef<{ x: number; y: number; vx: number; vy: number; moved: number } | null>(null);
  const settings = useRef({ preset, colorMode, selected: null as string | null, hovered: null as string | null });
  const mini = useRef<{ s: number; ox: number; oy: number; b: ReturnType<typeof worldBounds> } | null>(null);
  const fitted = useRef(false);

  if (Object.keys(pos.current).length === 0) NODES.forEach((n) => (pos.current[n.id] = { x: n.x, y: n.y }));

  const rectOf = (id: string) => { const p = pos.current[id]; return { x: p.x, y: p.y, w: NW, h: NH, cx: p.x + NW / 2, cy: p.y + NH / 2 }; };
  type R = ReturnType<typeof rectOf>;
  const anchor = (r: R, side: string) => (side === "r" ? { x: r.x + r.w, y: r.cy } : side === "l" ? { x: r.x, y: r.cy } : side === "t" ? { x: r.cx, y: r.y } : { x: r.cx, y: r.y + r.h });
  const chooseSides = (s: R, t: R): [string, string] => { const dx = t.cx - s.cx, dy = t.cy - s.cy; if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ["r", "l"] : ["l", "r"]; return dy >= 0 ? ["b", "t"] : ["t", "b"]; };
  const ctrl = (p: { x: number; y: number }, side: string, o: number) => (side === "r" ? { x: p.x + o, y: p.y } : side === "l" ? { x: p.x - o, y: p.y } : side === "t" ? { x: p.x, y: p.y - o } : { x: p.x, y: p.y + o });
  function worldBounds() { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const id in pos.current) { const p = pos.current[id]; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + NW); y1 = Math.max(y1, p.y + NH); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; }

  const edgePath = (e: EdgeT) => {
    const s = rectOf(e.s), t = rectOf(e.t);
    const [ss, ts] = chooseSides(s, t);
    const p0 = anchor(s, ss), p1 = anchor(t, ts);
    if (settings.current.preset === "blueprint") {
      if (ss === "l" || ss === "r") { const mx = (p0.x + p1.x) / 2; return `M${p0.x},${p0.y} L${mx},${p0.y} L${mx},${p1.y} L${p1.x},${p1.y}`; }
      const my = (p0.y + p1.y) / 2; return `M${p0.x},${p0.y} L${p0.x},${my} L${p1.x},${my} L${p1.x},${p1.y}`;
    }
    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y), o = clamp(dist * 0.42, 36, 170);
    const c0 = ctrl(p0, ss, o), c1 = ctrl(p1, ts, o);
    return `M${p0.x},${p0.y} C${c0.x},${c0.y} ${c1.x},${c1.y} ${p1.x},${p1.y}`;
  };

  const applyGeometry = () => {
    for (const id in pos.current) { const el = nodeEls.current[id]; if (el) { const p = pos.current[id]; el.style.transform = `translate(${p.x}px,${p.y}px)`; } }
    GROUPS.forEach((g) => { const el = groupEls.current[g.id]; if (!el) return; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; g.members.forEach((m) => { const p = pos.current[m]; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + NW); y1 = Math.max(y1, p.y + NH); }); const pad = 26; el.style.transform = `translate(${x0 - pad}px,${y0 - pad}px)`; el.style.width = x1 - x0 + pad * 2 + "px"; el.style.height = y1 - y0 + pad * 2 + "px"; });
    EDGES.forEach((e) => { const d = edgePath(e); const r = edgeEls.current[e.id]; if (r) { r.glow?.setAttribute("d", d); r.thin?.setAttribute("d", d); } });
    applyMinimap();
  };

  const selectionSets = () => { const sel = settings.current.selected; if (!sel) return null; const nodes = new Set([sel]); const edges = new Set<string>(); EDGES.forEach((e) => { if (e.s === sel || e.t === sel) { edges.add(e.id); nodes.add(e.s); nodes.add(e.t); } }); return { nodes, edges }; };

  const applyStyles = () => {
    const p = settings.current.preset, cm = settings.current.colorMode, sset = selectionSets();
    if (viewportEl.current) {
      if (p === "blueprint") { viewportEl.current.style.backgroundImage = "linear-gradient(var(--sm-grid) 1px,transparent 1px),linear-gradient(90deg,var(--sm-grid) 1px,transparent 1px)"; viewportEl.current.style.backgroundSize = "26px 26px"; }
      else { viewportEl.current.style.backgroundImage = "radial-gradient(circle, var(--sm-dot) 1px, transparent 1px)"; viewportEl.current.style.backgroundSize = "22px 22px"; }
    }
    NODES.forEach((n) => {
      const el = nodeEls.current[n.id]; if (!el) return;
      const accent = cm === "status" ? statusColor(n.status) : n.color, st = statusColor(n.status);
      if (p === "maple") { el.style.background = "var(--bg-surface)"; el.style.border = "1px solid var(--border-subtle)"; el.style.boxShadow = "var(--sm-shadow)"; }
      else if (p === "neon") { el.style.background = "var(--bg-surface)"; el.style.border = "1px solid " + hexA(accent, 0.55); el.style.boxShadow = `0 0 0 1px ${hexA(accent, 0.14)}, 0 8px 24px rgba(0,0,0,.10), 0 0 22px ${hexA(accent, 0.14)}`; }
      else { el.style.background = "transparent"; el.style.border = "1px solid var(--border-default)"; el.style.boxShadow = "none"; }
      const ab = el.querySelector<HTMLElement>("[data-accent]"); if (ab) { ab.style.background = accent; ab.style.opacity = p === "blueprint" ? "0" : "1"; ab.style.boxShadow = p === "neon" ? "0 0 10px " + accent : "none"; }
      const dot = el.querySelector<HTMLElement>("[data-dot]"); if (dot) { dot.style.background = st; dot.style.color = st; }
      const er = el.querySelector<HTMLElement>("[data-err]"); if (er) er.style.color = errColor(n.err);
      el.style.opacity = sset && !sset.nodes.has(n.id) ? "0.25" : "1";
      miniEls.current[n.id]?.setAttribute("fill", accent);
    });
    let gw = 6, go = 0.16, tw = 1.7, to = 0.6;
    if (p === "neon") { gw = 10; go = 0.24; tw = 2.4; to = 0.85; } else if (p === "blueprint") { gw = 0; go = 0; tw = 1.3; to = 0.6; }
    EDGES.forEach((e) => {
      const r = edgeEls.current[e.id]; if (!r) return;
      const src = NODE[e.s], c = cm === "status" ? statusColor(src.status) : src.color, dim = !!(sset && !sset.edges.has(e.id));
      if (r.glow) { r.glow.style.stroke = c; r.glow.style.strokeWidth = String(gw); r.glow.style.strokeOpacity = String(dim ? go * 0.15 : go); r.glow.style.strokeLinecap = "round"; }
      if (r.thin) { r.thin.style.stroke = c; r.thin.style.strokeWidth = String(tw); r.thin.style.strokeOpacity = String(dim ? to * 0.12 : to); r.thin.style.strokeLinecap = "round"; }
    });
    let cr = 1.8, hr = 4.4, ho = 0.26;
    if (p === "neon") { cr = 2.3; hr = 5.6; ho = 0.34; } else if (p === "blueprint") { cr = 1.6; hr = 3.2; ho = 0.16; }
    PARTS.forEach((pt) => {
      const g = partEls.current[pt.id]; if (!g) return;
      const e = EDGE[pt.edge], src = NODE[e.s], c = cm === "status" ? statusColor(src.status) : src.color;
      const halo = g.querySelector<SVGCircleElement>("[data-halo]"), core = g.querySelector<SVGCircleElement>("[data-core]");
      const vis = !(sset && !sset.edges.has(pt.edge)) && NODE[e.s].status !== "degraded";
      if (halo) { halo.setAttribute("r", String(hr)); halo.style.fill = c; halo.setAttribute("opacity", String(vis ? ho : 0)); }
      if (core) { core.setAttribute("r", String(cr)); core.style.fill = c; core.setAttribute("opacity", String(vis ? 0.95 : 0)); }
    });
  };

  const applyView = () => { if (worldEl.current) worldEl.current.style.transform = `translate(${view.current.x}px,${view.current.y}px) scale(${view.current.k})`; applyMinimap(); if (settings.current.hovered) positionTip(); };

  const applyMinimap = () => {
    if (!minimapEl.current || !viewportEl.current) return;
    const MW = 188, MH = 118, m = 10, b = worldBounds();
    const s = Math.min((MW - m * 2) / b.w, (MH - m * 2) / b.h), ox = (MW - b.w * s) / 2, oy = (MH - b.h * s) / 2;
    mini.current = { s, ox, oy, b };
    NODES.forEach((n) => { const r = miniEls.current[n.id]; if (!r) return; const p = pos.current[n.id]; r.setAttribute("x", String(ox + (p.x - b.x0) * s)); r.setAttribute("y", String(oy + (p.y - b.y0) * s)); r.setAttribute("width", String(Math.max(4, NW * s))); r.setAttribute("height", String(Math.max(2.6, NH * s))); });
    if (miniRectEl.current) { const vw = viewportEl.current.clientWidth, vh = viewportEl.current.clientHeight, k = view.current.k; const wx0 = -view.current.x / k, wy0 = -view.current.y / k; miniRectEl.current.setAttribute("x", String(ox + (wx0 - b.x0) * s)); miniRectEl.current.setAttribute("y", String(oy + (wy0 - b.y0) * s)); miniRectEl.current.setAttribute("width", String(Math.max(6, (vw / k) * s))); miniRectEl.current.setAttribute("height", String(Math.max(6, (vh / k) * s))); }
  };

  const fitView = () => { const vp = viewportEl.current; if (!vp) return; const vw = vp.clientWidth, vh = vp.clientHeight, b = worldBounds(), pad = 56; const k = clamp(Math.min((vw - pad * 2) / b.w, (vh - pad * 2) / b.h), 0.4, 1.5); view.current = { k, x: (vw - b.w * k) / 2 - b.x0 * k, y: (vh - b.h * k) / 2 - b.y0 * k }; applyView(); };
  const frameInitial = () => { const vp = viewportEl.current; if (!vp) return; const vw = vp.clientWidth, vh = vp.clientHeight, b = worldBounds(); const fitK = Math.min((vw - 80) / b.w, (vh - 80) / b.h); const k = clamp(fitK, 0.5, 1.0); view.current = { k, x: (vw - b.w * k) / 2 - b.x0 * k, y: (vh - b.h * k) / 2 - b.y0 * k }; applyView(); };
  const zoomBy = (f: number, cx?: number, cy?: number) => { const vp = viewportEl.current; if (!vp) return; if (cx == null) { cx = vp.clientWidth / 2; cy = vp.clientHeight / 2; } const nk = clamp(view.current.k * f, 0.4, 2.0); view.current.x = cx - (cx - view.current.x) * (nk / view.current.k); view.current.y = (cy as number) - ((cy as number) - view.current.y) * (nk / view.current.k); view.current.k = nk; applyView(); };

  const positionTip = () => { const el = tipEl.current, id = settings.current.hovered; if (!el || !id) return; const p = pos.current[id]; let L = view.current.x + (p.x + NW) * view.current.k + 12, T = view.current.y + p.y * view.current.k; const vp = viewportEl.current; if (vp) { L = Math.min(L, vp.clientWidth - 214); T = Math.min(Math.max(8, T), vp.clientHeight - 168); } el.style.left = L + "px"; el.style.top = T + "px"; };

  const nodeDown = (id: string, e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); const p = pos.current[id]; drag.current = { id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: 0 }; document.body.style.cursor = "grabbing"; };
  const onViewportDown = (e: React.MouseEvent) => { pan.current = { x: e.clientX, y: e.clientY, vx: view.current.x, vy: view.current.y, moved: 0 }; if (viewportEl.current) viewportEl.current.style.cursor = "grabbing"; };
  const onMinimapDown = (e: React.MouseEvent) => { e.stopPropagation(); if (!mini.current || !viewportEl.current || !minimapEl.current) return; const r = minimapEl.current.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; const { s, ox, oy, b } = mini.current; const wx = b.x0 + (mx - ox) / s, wy = b.y0 + (my - oy) / s; view.current.x = viewportEl.current.clientWidth / 2 - wx * view.current.k; view.current.y = viewportEl.current.clientHeight / 2 - wy * view.current.k; applyView(); };

  const reload = () => { if (reloadIconEl.current) { reloadIconEl.current.style.animation = "none"; void (reloadIconEl.current as unknown as HTMLElement).offsetWidth; reloadIconEl.current.style.animation = "sm-spin .7s ease"; } NODES.forEach((n) => { if (n.status === "degraded") return; n.rate = Math.max(10, n.rate * (0.9 + Math.random() * 0.2)); n.err = Math.max(0, +(n.err * (0.7 + Math.random() * 0.7)).toFixed(2)); n.lat = Math.max(1, n.lat * (0.88 + Math.random() * 0.24)); }); setBump((b) => b + 1); };
  const cycleTime = () => { const i = TIME_OPTS.indexOf(timeRange); setTimeRange(TIME_OPTS[(i + 1) % TIME_OPTS.length]); };

  useEffect(() => {
    let raf = 0; let mounted = true;
    const onMove = (e: MouseEvent) => {
      if (drag.current) {
        const d = drag.current; const dx = (e.clientX - d.sx) / view.current.k, dy = (e.clientY - d.sy) / view.current.k;
        d.moved = Math.max(d.moved, Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy));
        const p = pos.current[d.id]; p.x = d.ox + dx; p.y = d.oy + dy;
        const el = nodeEls.current[d.id]; if (el) el.style.transform = `translate(${p.x}px,${p.y}px)`;
        (NODE_EDGES[d.id] || []).forEach((eid) => { const dd = edgePath(EDGE[eid]); const r = edgeEls.current[eid]; if (r) { r.glow?.setAttribute("d", dd); r.thin?.setAttribute("d", dd); } });
        GROUPS.forEach((g) => { if (g.members.indexOf(d.id) < 0) return; const el2 = groupEls.current[g.id]; if (!el2) return; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; g.members.forEach((m) => { const q = pos.current[m]; x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x + NW); y1 = Math.max(y1, q.y + NH); }); const pad = 26; el2.style.transform = `translate(${x0 - pad}px,${y0 - pad}px)`; el2.style.width = x1 - x0 + pad * 2 + "px"; el2.style.height = y1 - y0 + pad * 2 + "px"; });
        applyMinimap(); if (settings.current.hovered === d.id) positionTip(); return;
      }
      if (pan.current) { const pp = pan.current; view.current.x = pp.vx + (e.clientX - pp.x); view.current.y = pp.vy + (e.clientY - pp.y); pp.moved = Math.max(pp.moved, Math.abs(e.clientX - pp.x) + Math.abs(e.clientY - pp.y)); applyView(); }
    };
    const onUp = () => {
      if (drag.current) { const { id, moved } = drag.current; drag.current = null; document.body.style.cursor = ""; if (viewportEl.current) viewportEl.current.style.cursor = "grab"; if (moved < 4) { settings.current.selected = settings.current.selected === id ? null : id; applyStyles(); } return; }
      if (pan.current) { const moved = pan.current.moved; pan.current = null; if (viewportEl.current) viewportEl.current.style.cursor = "grab"; if (moved < 4 && settings.current.selected) { settings.current.selected = null; applyStyles(); } }
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = viewportEl.current!.getBoundingClientRect(); zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    const vp = viewportEl.current;
    vp?.addEventListener("wheel", onWheel, { passive: false });

    applyGeometry(); applyStyles();
    if (vp && vp.clientWidth > 0 && !fitted.current) { fitted.current = true; frameInitial(); }

    const loop = (t: number) => {
      if (!mounted) return;
      const sec = t * 0.001;
      EDGES.forEach((e) => { if (NODE[e.s].status === "degraded") return; const r = edgeEls.current[e.id]; const path = r && r.thin; if (!path || !path.getTotalLength) return; let len = 0; try { len = path.getTotalLength(); } catch { /* */ } if (!len) return; for (let k = 0; k < 2; k++) { const g = partEls.current[e.id + "_" + k]; if (!g) continue; const sp = 0.15 + (parseInt(e.id.slice(1)) % 5) * 0.016; const f = (((sec * sp + k * 0.5) % 1) + 1) % 1; let p; try { p = path.getPointAtLength(f * len); } catch { continue; } g.setAttribute("transform", `translate(${p.x} ${p.y})`); } });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => { mounted = false; cancelAnimationFrame(raf); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); vp?.removeEventListener("wheel", onWheel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { settings.current.preset = preset; settings.current.colorMode = colorMode; applyGeometry(); applyStyles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, colorMode]);

  useEffect(() => { settings.current.hovered = hovered; if (hovered) positionTip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered]);

  const counts = { h: 0, d: 0, e: 0 };
  NODES.forEach((n) => { if (n.status === "error") counts.e++; else if (n.status === "degraded") counts.d++; else counts.h++; });
  const chips = NODES.filter((n) => ["FE", "API", "APP"].includes(n.tag)).slice(0, 7);
  const hv = hovered ? NODE[hovered] : null;

  const seg = (active: boolean): React.CSSProperties => ({ border: "none", borderRadius: 6, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", background: active ? "var(--accent)" : "transparent", color: active ? "#fff" : "var(--text-secondary)" });
  const tbtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "7px 11px", color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, cursor: "pointer" };

  return createPortal((
    <div className="servicemap-root" style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", background: "var(--bg-surface)", color: "var(--text-primary)", overflow: "hidden" }}>
      <style>{`
        .servicemap-root{ --sm-dot:rgba(15,23,42,.06); --sm-grid:rgba(37,99,235,.07); --sm-shadow:0 1px 2px rgba(15,23,42,.06),0 4px 14px rgba(15,23,42,.05); }
        .dark .servicemap-root{ --sm-dot:rgba(255,255,255,.06); --sm-grid:rgba(120,170,200,.07); --sm-shadow:0 8px 26px rgba(0,0,0,.5); }
        @keyframes sm-spin{to{transform:rotate(360deg);}}
        .sm-btn:hover{ border-color:var(--border-strong)!important; color:var(--text-primary)!important; }
        .sm-zoom:hover{ background:var(--bg-sunken)!important; color:var(--text-primary)!important; }
        .servicemap-root ::-webkit-scrollbar{width:9px;height:9px;}
        .servicemap-root ::-webkit-scrollbar-thumb{background:var(--border-default);border-radius:8px;}
      `}</style>

      {/* header */}
      <header style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px 12px", flex: "none" }}>
        <button onClick={goBack} className="sm-btn" title="Geri" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, flex: "none", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 9, color: "var(--text-secondary)", cursor: "pointer" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.3px", color: "var(--text-primary)" }}>Service Map</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>Platform servisleri arası bağımlılık ve veri akışı — canlı.</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flex: "none" }}>
          <button onClick={cycleTime} className="sm-btn" style={tbtn}>
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="7.5" cy="7.5" r="5.4" /><path d="M7.5 4.4 V7.5 L9.6 9" strokeLinecap="round" /></svg>
            <span>{timeRange}</span>
            <svg width="11" height="11" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4 6 L7.5 9.5 L11 6" /></svg>
          </button>
          <button onClick={reload} className="sm-btn" style={tbtn}>
            <svg ref={reloadIconEl} width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" style={{ transformOrigin: "center" }}><path d="M12 7.5 A4.5 4.5 0 1 1 10.6 4.2" strokeLinecap="round" /><path d="M10.4 1.8 L11 4.4 L8.4 4.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>Yenile</span>
          </button>
        </div>
      </header>

      {/* sub-toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 22px 12px", flex: "none", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-tertiary)" }}>RENK</span>
        <div style={{ display: "flex", gap: 2, background: "var(--bg-sunken)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 3 }}>
          <button onClick={() => setColorMode("service")} style={seg(colorMode === "service")}>Servis</button>
          <button onClick={() => setColorMode("status")} style={seg(colorMode === "status")}>Durum</button>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-tertiary)" }}>STİL</span>
          <div style={{ display: "flex", gap: 2, background: "var(--bg-sunken)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 3 }}>
            <button onClick={() => setPreset("maple")} style={seg(preset === "maple")}>Sade</button>
            <button onClick={() => setPreset("neon")} style={seg(preset === "neon")}>Neon</button>
            <button onClick={() => setPreset("blueprint")} style={seg(preset === "blueprint")}>Şema</button>
          </div>
        </div>
      </div>

      {/* canvas viewport */}
      <div ref={viewportEl} onMouseDown={onViewportDown} style={{ position: "relative", flex: 1, margin: "0 12px 12px", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden", background: "var(--bg-page)", cursor: "grab" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(640px 440px at 18% 6%, var(--accent-soft), transparent 60%)", opacity: 0.5 }} />

        <div ref={worldEl} style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, transformOrigin: "0 0" }}>
          {GROUPS.map((g) => (
            <div key={g.id} ref={(el) => { groupEls.current[g.id] = el; }} style={{ position: "absolute", left: 0, top: 0, border: "1px solid var(--border-default)", borderRadius: 16, background: "var(--accent-soft)", opacity: 0.55, pointerEvents: "none", boxSizing: "border-box" }}>
              <span style={{ position: "absolute", left: 14, top: -9, background: "var(--bg-surface)", padding: "2px 9px", border: "1px solid var(--border-default)", borderRadius: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--accent)" }}>{g.label}</span>
            </div>
          ))}

          <svg width="1500" height="900" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
            <g>{EDGES.map((e) => (<g key={e.id}><path ref={(el) => { (edgeEls.current[e.id] = edgeEls.current[e.id] || {}).glow = el || undefined; }} fill="none" /><path ref={(el) => { (edgeEls.current[e.id] = edgeEls.current[e.id] || {}).thin = el || undefined; }} fill="none" /></g>))}</g>
            <g>{PARTS.map((p) => (<g key={p.id} ref={(el) => { partEls.current[p.id] = el; }}><circle data-halo cx="0" cy="0" /><circle data-core cx="0" cy="0" /></g>))}</g>
          </svg>

          {NODES.map((node) => (
            <div key={node.id} ref={(el) => { nodeEls.current[node.id] = el; }} onMouseDown={(e) => nodeDown(node.id, e)} onMouseEnter={() => { if (!drag.current && !pan.current) setHovered(node.id); }} onMouseLeave={() => setHovered((h) => (h === node.id ? null : h))}
              style={{ position: "absolute", top: 0, left: 0, width: NW, boxSizing: "border-box", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "9px 12px 11px", cursor: "grab", userSelect: "none", overflow: "hidden" }}>
              <div data-accent style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: node.color }} />
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span data-dot style={{ width: 7, height: 7, borderRadius: "50%", background: ST[node.status], flex: "none", boxShadow: "0 0 8px currentColor" }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.name}</span>
                <span style={{ marginLeft: "auto", fontSize: 8, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.1em", flex: "none" }}>{node.tag}</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: 10 }}>
                <Metric label="İSTEK" value={fmtRate(node.rate)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={statLabel}>HATA</span><span data-err style={{ fontSize: 11.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>{fmtErr(node.err)}</span></div>
                <Metric label="GECİKME" value={fmtLat(node.lat)} />
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, color: "var(--text-tertiary)" }}>
                  <svg width="11" height="11" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2.6" y="2.6" width="9.8" height="9.8" rx="2.2" /><path d="M2.6 7.5 H12.4" /></svg>
                  <span style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>{node.count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* zoom */}
        <div style={{ position: "absolute", left: 14, bottom: 50, display: "flex", flexDirection: "column", gap: 1, background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 8, overflow: "hidden", boxShadow: "var(--sm-shadow)" }}>
          <button onClick={() => zoomBy(1.25)} className="sm-zoom" style={zoomBtn}>+</button>
          <button onClick={() => zoomBy(0.8)} className="sm-zoom" style={{ ...zoomBtn, borderTop: "1px solid var(--border-subtle)" }}>−</button>
          <button onClick={fitView} className="sm-zoom" style={{ ...zoomBtn, borderTop: "1px solid var(--border-subtle)" }}><svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2.5 5.5 V2.5 H5.5 M9.5 2.5 H12.5 V5.5 M12.5 9.5 V12.5 H9.5 M5.5 12.5 H2.5 V9.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        </div>

        {/* legend */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", gap: 16, padding: "10px 14px", background: "linear-gradient(to top, var(--bg-page), transparent)", pointerEvents: "none" }}>
          <span style={{ fontSize: 10.5, color: "var(--text-tertiary)", flex: "none" }}>Düğümleri sürükle · Zoom için kaydır</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden", flex: 1, minWidth: 0 }}>
            {chips.map((c) => (<span key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}><span style={{ width: 7, height: 7, borderRadius: 2, background: c.color }} /><span style={{ fontSize: 10.5, color: "var(--text-secondary)" }}>{c.name}</span></span>))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, flex: "none" }}>
            <Legend color={ST.healthy} label={`Sağlıklı ${counts.h}`} />
            <Legend color={ST.degraded} label={`Bekliyor ${counts.d}`} />
            <Legend color={ST.error} label={`Hata ${counts.e}`} />
          </div>
        </div>

        {/* minimap */}
        <div ref={minimapEl} onMouseDown={onMinimapDown} style={{ position: "absolute", right: 14, bottom: 50, width: 188, height: 118, background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, overflow: "hidden", boxShadow: "var(--sm-shadow)", cursor: "pointer" }}>
          <svg width="188" height="118" style={{ position: "absolute", left: 0, top: 0 }}>
            {NODES.map((n) => (<rect key={n.id} ref={(el) => { miniEls.current[n.id] = el; }} rx="1.4" width="6" height="3.2" />))}
            <rect ref={miniRectEl} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1" rx="2" />
          </svg>
        </div>

        {/* tooltip */}
        {hv && (
          <div ref={tipEl} style={{ position: "absolute", left: 0, top: 0, zIndex: 30, pointerEvents: "none", minWidth: 196, background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 11, padding: "11px 13px", boxShadow: "var(--sm-shadow)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: ST[hv.status], boxShadow: `0 0 8px ${ST[hv.status]}`, flex: "none" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>{hv.name}</span>
              <span style={{ marginLeft: "auto", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-tertiary)" }}>{hv.tag}</span>
            </div>
            <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "9px 12px" }}>
              <TipCell label="İSTEK/S" value={fmtRate(hv.rate)} />
              <TipCell label="HATA" value={fmtErr(hv.err)} color={typeof errColor(hv.err) === "string" ? errColor(hv.err) : "var(--text-primary)"} />
              <TipCell label="ADET" value={String(hv.count)} />
              <TipCell label="P50" value={fmtLat(hv.lat)} color="var(--text-secondary)" />
              <TipCell label="P95" value={fmtLat(hv.lat * 1.7)} color="var(--text-secondary)" />
              <TipCell label="P99" value={fmtLat(hv.lat * 2.6)} color="var(--text-secondary)" />
            </div>
            <div style={{ marginTop: 9, paddingTop: 8, borderTop: "1px solid var(--border-subtle)", fontSize: 10.5, color: "var(--text-tertiary)" }}>
              Durum: <span style={{ color: ST[hv.status], fontWeight: 600 }}>{hv.status === "healthy" ? "Sağlıklı" : hv.status === "degraded" ? "Planlı / bekliyor" : "Hata"}</span>
            </div>
          </div>
        )}
      </div>

      {/* gerçek veri özeti */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: "0 22px 14px", fontSize: 11, color: "var(--text-tertiary)", flex: "none" }}>
        <span><b style={{ color: "var(--text-secondary)" }}>{tkN}</b> bilet</span>
        <span><b style={{ color: "var(--text-secondary)" }}>{emdN}</b> EMD</span>
        <span><b style={{ color: "var(--text-secondary)" }}>{ordN}</b> order</span>
        <span><b style={{ color: "var(--text-secondary)" }}>{flN}</b> uçuş</span>
        <span style={{ marginLeft: "auto" }}>Event-sourced · CQRS read model · {NODES.length} servis</span>
      </div>
    </div>
  ), document.body);
}

const statLabel: React.CSSProperties = { fontSize: 7.5, fontWeight: 500, color: "var(--text-tertiary)", letterSpacing: "0.06em" };
const zoomBtn: React.CSSProperties = { width: 30, height: 30, border: "none", background: "transparent", color: "var(--text-secondary)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={statLabel}>{label}</span><span style={{ fontSize: 11.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>{value}</span></div>;
}
function Legend({ color, label }: { color: string; label: string }) {
  return <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 7px ${color}` }} /><span style={{ fontSize: 10.5, color: "var(--text-secondary)" }}>{label}</span></span>;
}
function TipCell({ label, value, color = "var(--text-primary)" }: { label: string; value: string; color?: string }) {
  return <div><div style={{ fontSize: 7.5, fontWeight: 500, color: "var(--text-tertiary)", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div><div style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums", color }}>{value}</div></div>;
}
