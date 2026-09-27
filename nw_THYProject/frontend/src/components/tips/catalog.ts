import type { Key } from "@/i18n";
import type { Permission } from "@/domain/auth";

/* ====================================================================
   İpucu kataloğu — hangi ekranda ne anlatılır.

   Metin burada DEĞİL, i18n'de (`tips.*`). Katalog yalnız bağları tutar:
   tur adımı → ekrandaki `data-tour` işareti, balon → başlık/gövde anahtarı.
   Bir adımın işareti ekranda yoksa (yetki gizlemiş, liste boş) tur o adımı
   sessizce atlar — tur hiçbir zaman olmayan bir şeyi göstermez.
   ==================================================================== */

export interface TourStep {
  /** `data-tour` değeri. */
  target: string;
  title: Key;
  body: Key;
}

export interface Tour {
  id: string;
  /** Yardım menüsünde ve profil listesinde görünen ad. */
  name: Key;
  match: (path: string) => boolean;
  /** Profil listesinden başlatılınca gidilecek örnek ekran. */
  home: string;
  /** Ekranı görmek için gereken yetki — yoksa tur listelenmez. */
  perm?: Permission;
  steps: TourStep[];
}

export const TOURS: Tour[] = [
  {
    id: "panel",
    home: "/",
    name: "tips.tour.panel",
    match: (p) => p === "/",
    steps: [
      { target: "shell.modules", title: "tips.panel.modules.t", body: "tips.panel.modules.b" },
      { target: "shell.palette", title: "tips.panel.palette.t", body: "tips.panel.palette.b" },
      { target: "panel.actions", title: "tips.panel.actions.t", body: "tips.panel.actions.b" },
      { target: "panel.kpis", title: "tips.panel.kpis.t", body: "tips.panel.kpis.b" },
      { target: "panel.notices", title: "tips.panel.notices.t", body: "tips.panel.notices.b" },
      { target: "shell.notifications", title: "tips.panel.bell.t", body: "tips.panel.bell.b" },
      { target: "shell.help", title: "tips.panel.help.t", body: "tips.panel.help.b" },
    ],
  },
  {
    id: "search",
    home: "/search",
    name: "tips.tour.search",
    match: (p) => p === "/search",
    steps: [
      { target: "search.bar", title: "tips.search.bar.t", body: "tips.search.bar.b" },
      { target: "search.chips", title: "tips.search.chips.t", body: "tips.search.chips.b" },
      { target: "search.advanced", title: "tips.search.advanced.t", body: "tips.search.advanced.b" },
      { target: "table.tools", title: "tips.search.tools.t", body: "tips.search.tools.b" },
      { target: "table.body", title: "tips.search.rows.t", body: "tips.search.rows.b" },
    ],
  },
  {
    id: "ticket",
    home: "/tickets/2351234567890",
    name: "tips.tour.ticket",
    match: (p) => p.startsWith("/tickets/"),
    steps: [
      { target: "ticket.head", title: "tips.ticket.head.t", body: "tips.ticket.head.b" },
      { target: "ticket.actions", title: "tips.ticket.actions.t", body: "tips.ticket.actions.b" },
      { target: "ticket.document", title: "tips.ticket.document.t", body: "tips.ticket.document.b" },
      { target: "ticket.validity", title: "tips.ticket.validity.t", body: "tips.ticket.validity.b" },
      { target: "ticket.coupons", title: "tips.ticket.coupons.t", body: "tips.ticket.coupons.b" },
      { target: "ticket.fare", title: "tips.ticket.fare.t", body: "tips.ticket.fare.b" },
      { target: "ticket.lifecycle", title: "tips.ticket.lifecycle.t", body: "tips.ticket.lifecycle.b" },
    ],
  },
  {
    id: "issue",
    home: "/issue",
    perm: "ticket.issue",
    name: "tips.tour.issue",
    match: (p) => p === "/issue",
    steps: [
      { target: "issue.steps", title: "tips.issue.steps.t", body: "tips.issue.steps.b" },
      { target: "issue.form", title: "tips.issue.form.t", body: "tips.issue.form.b" },
      { target: "issue.preview", title: "tips.issue.preview.t", body: "tips.issue.preview.b" },
      { target: "issue.footer", title: "tips.issue.footer.t", body: "tips.issue.footer.b" },
    ],
  },
  {
    id: "checkin",
    home: "/checkin/TK1591-D",
    name: "tips.tour.checkin",
    match: (p) => /^\/checkin\/[^/]+$/.test(p),
    steps: [
      { target: "split.list", title: "tips.checkin.flights.t", body: "tips.checkin.flights.b" },
      { target: "detail.actions", title: "tips.checkin.head.t", body: "tips.checkin.head.b" },
      { target: "checkin.stats", title: "tips.checkin.stats.t", body: "tips.checkin.stats.b" },
      { target: "checkin.pax", title: "tips.checkin.pax.t", body: "tips.checkin.pax.b" },
    ],
  },
  {
    id: "res",
    home: "/res/XQ7T2M",
    name: "tips.tour.res",
    match: (p) => p === "/res" || /^\/res\/[A-Z0-9]{6}$/.test(p),
    steps: [
      { target: "split.list", title: "tips.res.list.t", body: "tips.res.list.b" },
      { target: "detail.actions", title: "tips.res.detail.t", body: "tips.res.detail.b" },
    ],
  },
  {
    id: "ops",
    home: "/ops",
    perm: "ops.view",
    name: "tips.tour.ops",
    match: (p) => p === "/ops",
    steps: [
      { target: "ops.kpis", title: "tips.ops.kpis.t", body: "tips.ops.kpis.b" },
      { target: "ops.board", title: "tips.ops.board.t", body: "tips.ops.board.b" },
      { target: "ops.alerts", title: "tips.ops.alerts.t", body: "tips.ops.alerts.b" },
    ],
  },
  {
    id: "reports",
    home: "/reports",
    perm: "revenue.view",
    name: "tips.tour.reports",
    match: (p) => p === "/reports",
    steps: [
      { target: "reports.tabs", title: "tips.reports.tabs.t", body: "tips.reports.tabs.b" },
      { target: "reports.kpis", title: "tips.reports.kpis.t", body: "tips.reports.kpis.b" },
      { target: "reports.cards", title: "tips.reports.cards.t", body: "tips.reports.cards.b" },
    ],
  },
];

export function tourFor(path: string): Tour | undefined {
  return TOURS.find((t) => t.match(path));
}

export function tourById(id: string): Tour | undefined {
  return TOURS.find((t) => t.id === id);
}

/* -------------------------------------------------------------------- */

/** Bağlamsal ipucu balonu: bir özelliğin yanında duran, okununca kaybolan not. */
export interface TipDef {
  title: Key;
  body: Key;
}

export const TIPS = {
  "search.smartbar": { title: "tips.b.smartbar.t", body: "tips.b.smartbar.b" },
  "table.export": { title: "tips.b.export.t", body: "tips.b.export.b" },
  "ticket.shortcuts": { title: "tips.b.shortcuts.t", body: "tips.b.shortcuts.b" },
  "ticket.lifecycle": { title: "tips.b.lifecycle.t", body: "tips.b.lifecycle.b" },
  "ticket.validity": { title: "tips.b.validity.t", body: "tips.b.validity.b" },
  "issue.fare": { title: "tips.b.fare.t", body: "tips.b.fare.b" },
  "issue.ssr": { title: "tips.b.ssr.t", body: "tips.b.ssr.b" },
  "checkin.apis": { title: "tips.b.apis.t", body: "tips.b.apis.b" },
  "checkin.closeout": { title: "tips.b.closeout.t", body: "tips.b.closeout.b" },
  "seat.blocked": { title: "tips.b.seat.t", body: "tips.b.seat.b" },
  "ops.resolve": { title: "tips.b.resolve.t", body: "tips.b.resolve.b" },
  "reports.close": { title: "tips.b.close.t", body: "tips.b.close.b" },
  "res.ttl": { title: "tips.b.ttl.t", body: "tips.b.ttl.b" },
  "irrop.compensation": { title: "tips.b.comp.t", body: "tips.b.comp.b" },
} as const satisfies Record<string, TipDef>;

export type TipId = keyof typeof TIPS;

/* -------------------------------------------------------------------- */

/** Panel'deki "Biliyor muydunuz?" kartının döndürdüğü kısa verimlilik notları. */
export const DAILY_TIPS: Key[] = [
  "tips.daily.1", "tips.daily.2", "tips.daily.3", "tips.daily.4", "tips.daily.5",
  "tips.daily.6", "tips.daily.7", "tips.daily.8", "tips.daily.9", "tips.daily.10",
];
