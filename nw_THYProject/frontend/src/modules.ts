import {
  MessageSquare,
  LayoutDashboard, BookMarked, Ticket, PlaneTakeoff,
  TicketPlus, Search, ArrowLeftRight, Undo2, Ban, FileText,
  MessagesSquare, Handshake, Users, ScrollText, Settings,
  CalendarSearch, Banknote, Inbox, CalendarClock, ShieldAlert, AlertTriangle, Stamp, Radar, Waypoints, ClipboardList, type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/domain/auth";
import type { Key } from "@/i18n/dict";

// THY eşlemesi: QuickRes = rezervasyon click-UI · Troya = biletleme · QuickCheck-in = DCS.
// Hepsi aynı motora (Engine) oturan tıklama yüzeyleri ("tek komut, iki yüzey").
export type ModuleId = "panel" | "quickres" | "troya" | "checkin";

export interface NavItem {
  labelKey: Key;
  to: string;
  icon: LucideIcon;
  /** Sidebar'da görünür ama işlev bilet bağlamından gelir → /search'e götürür. */
  contextual?: boolean;
  /** Contextual aksiyon: /search?action=... → bilet seçtir → detayda flow aç. */
  action?: string;
  /** Bu item için gereken yetki; yoksa sidebar'da gizlenir. */
  perm?: Permission;
}
export interface NavSection {
  titleKey: Key;
  items: NavItem[];
}
export interface ModuleDef {
  id: ModuleId;
  labelKey: Key;
  subKey: Key;
  icon: LucideIcon;
  /** Modüle tıklayınca gidilecek varsayılan rota. */
  home: string;
  sections: NavSection[];
}

export const MODULES: ModuleDef[] = [
  {
    id: "quickres",
    labelKey: "module.quickres",
    subKey: "module.quickres.sub",
    icon: BookMarked,
    home: "/res",
    sections: [
      {
        titleKey: "nav.section.reservation",
        items: [
          { labelKey: "nav.res.new", to: "/res/new", icon: TicketPlus },
          { labelKey: "nav.res.search", to: "/res", icon: Search },
          { labelKey: "nav.res.availability", to: "/res/availability", icon: CalendarSearch },
        ],
      },
    ],
  },
  {
    id: "troya",
    labelKey: "module.troya",
    subKey: "module.troya.sub",
    icon: Ticket,
    home: "/search",
    sections: [
      {
        titleKey: "nav.section.ticketing",
        items: [
          { labelKey: "nav.issue", to: "/issue", icon: TicketPlus, perm: "ticket.issue" },
          { labelKey: "nav.search", to: "/search", icon: Search },
          { labelKey: "nav.queues", to: "/queues", icon: Inbox },
        ],
      },
      {
        titleKey: "nav.section.operations",
        items: [
          { labelKey: "nav.exchange", to: "/search", icon: ArrowLeftRight, contextual: true, action: "exchange", perm: "ticket.exchange" },
          { labelKey: "nav.refund", to: "/search", icon: Undo2, contextual: true, action: "refund", perm: "ticket.refund" },
          { labelKey: "nav.void", to: "/search", icon: Ban, contextual: true, action: "void", perm: "ticket.void" },
          { labelKey: "nav.irrop", to: "/search", icon: AlertTriangle, contextual: true, action: "irrop", perm: "ticket.irrop" },
          { labelKey: "nav.skchg", to: "/schedule-change", icon: CalendarClock, perm: "ticket.irrop" },
          { labelKey: "nav.endorse", to: "/search", icon: Stamp, contextual: true, action: "endorse", perm: "ticket.endorse" },
        ],
      },
      {
        titleKey: "nav.section.documents",
        items: [
          { labelKey: "nav.emd", to: "/search", icon: FileText, contextual: true, perm: "ticket.emd" },
          { labelKey: "nav.emd.search", to: "/emds", icon: Search, perm: "ticket.emd" },
          { labelKey: "nav.pta", to: "/pta", icon: Banknote, perm: "pta.manage" },
        ],
      },
      {
        titleKey: "nav.section.order",
        items: [{ labelKey: "nav.orders", to: "/orders", icon: Ticket, perm: "order.view" }],
      },
      {
        titleKey: "nav.section.interline",
        items: [
          { labelKey: "nav.messages", to: "/messages", icon: MessagesSquare, perm: "messages.view" },
          { labelKey: "nav.agreements", to: "/agreements", icon: Handshake, perm: "messages.view" },
          { labelKey: "nav.chat", to: "/chat", icon: MessageSquare, perm: "messages.view" },
        ],
      },
      {
        // Raporlar kendi bölümünde: dört rapor da menüden doğrudan açılır,
        // `ReportShell` yetki kapısı arkada zaten duruyor.
        titleKey: "nav.section.reports",
        items: [
          { labelKey: "nav.reports", to: "/reports", icon: ClipboardList, perm: "revenue.view" },
          { labelKey: "nav.report", to: "/report", icon: ClipboardList, perm: "revenue.view" },
          { labelKey: "nav.report.financial", to: "/report/financial", icon: ClipboardList, perm: "revenue.view" },
          { labelKey: "nav.report.period", to: "/report/period", icon: ClipboardList, perm: "revenue.view" },
        ],
      },
      {
        titleKey: "nav.section.admin",
        items: [
          { labelKey: "nav.revenue", to: "/admin/revenue", icon: ShieldAlert, perm: "revenue.view" },
          { labelKey: "nav.roles", to: "/admin/roles", icon: ShieldAlert, perm: "admin.roles" },
          { labelKey: "nav.users", to: "/admin/users", icon: Users, perm: "admin.users" },
          { labelKey: "nav.logs", to: "/admin/logs", icon: ScrollText, perm: "admin.users" },
          { labelKey: "nav.settings", to: "/admin/settings", icon: Settings, perm: "admin.settings" },
        ],
      },
    ],
  },
  {
    id: "checkin",
    labelKey: "module.checkin",
    subKey: "module.checkin.sub",
    icon: PlaneTakeoff,
    home: "/checkin",
    sections: [
      {
        titleKey: "nav.section.checkin",
        items: [
          // Biniş ayrı bir sayfa değil, uçuş detayındaki ikinci sekmedir —
          // aynı rotaya giden ikinci nav öğesi kaldırıldı.
          { labelKey: "nav.ci.flights", to: "/checkin", icon: PlaneTakeoff },
        ],
      },
      {
        titleKey: "nav.section.ops",
        items: [
          { labelKey: "nav.ci.hub", to: "/ops", icon: Radar, perm: "ops.view" },
          { labelKey: "nav.ci.servicemap", to: "/service-map", icon: Waypoints, perm: "ops.view" },
        ],
      },
    ],
  },
];

export const PANEL_ICON = LayoutDashboard;

/** Pathname → aktif modül. */
export function moduleForPath(pathname: string): ModuleId {
  if (pathname === "/" || pathname.startsWith("/panel")) return "panel";
  if (pathname.startsWith("/res")) return "quickres";
  if (pathname.startsWith("/checkin") || pathname.startsWith("/ops") || pathname.startsWith("/service-map")) return "checkin";
  return "troya"; // issue, search, tickets, itinerary, orders, messages, agreements, admin
}

export function moduleDef(id: ModuleId): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id);
}
