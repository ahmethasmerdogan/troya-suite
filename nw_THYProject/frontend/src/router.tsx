import {
  createRootRoute, createRoute, createRouter, lazyRouteComponent,
} from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteError, NotFound } from "@/components/RouteFallback";

// Kod-bölme: her sayfa ayrı chunk (lazy). Çekirdek shell eager.
// NOT: path'ler literal olmalı (helper'a sarmak route tip ağacını bozar).
const rootRoute = createRootRoute({ component: AppShell });

// Panel (birleşik anasayfa)
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: lazyRouteComponent(() => import("@/pages/Panel"), "Panel") });
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: "/profile", component: lazyRouteComponent(() => import("@/pages/Profile"), "Profile") });

// QuickRes (rezervasyon)
const resSearchRoute = createRoute({ getParentRoute: () => rootRoute, path: "/res", component: lazyRouteComponent(() => import("@/pages/quickres/PnrSearch"), "PnrSearch") });
// Uygunluk sorgusundan "Rezervasyona ekle" ile gelinen segment ön-doldurulur.
const resNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/res/new",
  component: lazyRouteComponent(() => import("@/pages/quickres/CreatePnr"), "CreatePnr"),
  validateSearch: (s: Record<string, unknown>): {
    o?: string; d?: string; cx?: string; fn?: string; rbd?: string; dep?: string; arr?: string;
  } => {
    const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
    return { o: str(s.o), d: str(s.d), cx: str(s.cx), fn: str(s.fn), rbd: str(s.rbd), dep: str(s.dep), arr: str(s.arr) };
  },
});
const resAvailRoute = createRoute({ getParentRoute: () => rootRoute, path: "/res/availability", component: lazyRouteComponent(() => import("@/pages/quickres/Availability"), "Availability") });
const resDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: "/res/$pnr", component: lazyRouteComponent(() => import("@/pages/quickres/PnrDetail"), "PnrDetail") });

// Troya (biletleme)
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  component: lazyRouteComponent(() => import("@/pages/TicketSearch"), "TicketSearch"),
  validateSearch: (s: Record<string, unknown>): { q?: string; action?: string } => ({
    q: typeof s.q === "string" ? s.q : undefined,
    action: typeof s.action === "string" ? s.action : undefined,
  }),
});
// `?pnr=` ile gelindiğinde kesim formu rezervasyondan dolar (QuickRes → Troya).
const issueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/issue",
  component: lazyRouteComponent(() => import("@/pages/IssueWizard"), "IssueWizard"),
  validateSearch: (s: Record<string, unknown>): { pnr?: string } => ({
    pnr: typeof s.pnr === "string" ? s.pnr : undefined,
  }),
});
const ticketDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tickets/$ticketNumber",
  component: lazyRouteComponent(() => import("@/pages/TicketDetail"), "TicketDetail"),
  validateSearch: (s: Record<string, unknown>): { flow?: string } => ({ flow: typeof s.flow === "string" ? s.flow : undefined }),
});
const skchgRoute = createRoute({ getParentRoute: () => rootRoute, path: "/schedule-change", component: lazyRouteComponent(() => import("@/pages/ScheduleChange"), "ScheduleChange") });
const queuesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/queues", component: lazyRouteComponent(() => import("@/pages/Queues"), "Queues") });
const itineraryRoute = createRoute({ getParentRoute: () => rootRoute, path: "/itinerary/$ticketNumber", component: lazyRouteComponent(() => import("@/pages/Itinerary"), "Itinerary") });
const messagesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/messages", component: lazyRouteComponent(() => import("@/pages/Messages"), "Messages") });
// ADM / ACM — acente dekontları (`?ticket=` ile bilet ekranından gelinince kesim formu açılır).
const memosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/memos",
  component: lazyRouteComponent(() => import("@/pages/Memos"), "Memos"),
  validateSearch: (s: Record<string, unknown>): { ticket?: string } => ({ ticket: typeof s.ticket === "string" ? s.ticket : undefined }),
});
const agreementsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/agreements", component: lazyRouteComponent(() => import("@/pages/Agreements"), "Agreements") });
const ptaRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pta", component: lazyRouteComponent(() => import("@/pages/troya/Pta"), "PtaPage") });
const ordersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/orders", component: lazyRouteComponent(() => import("@/pages/Orders"), "Orders") });
const orderDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: "/orders/$orderId", component: lazyRouteComponent(() => import("@/pages/OrderDetail"), "OrderDetail") });
const emdsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/emds", component: lazyRouteComponent(() => import("@/pages/EmdSearch"), "EmdSearch") });
const emdDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: "/emds/$emdNumber", component: lazyRouteComponent(() => import("@/pages/EmdDetail"), "EmdDetail") });
const emdReceiptRoute = createRoute({ getParentRoute: () => rootRoute, path: "/emds/$emdNumber/receipt", component: lazyRouteComponent(() => import("@/pages/EmdReceipt"), "EmdReceipt") });
const reportRoute = createRoute({ getParentRoute: () => rootRoute, path: "/report", component: lazyRouteComponent(() => import("@/pages/SalesReport"), "SalesReport") });
const reportFinancialRoute = createRoute({ getParentRoute: () => rootRoute, path: "/report/financial", component: lazyRouteComponent(() => import("@/pages/reports/FinancialReport"), "FinancialReport") });
const reportPeriodRoute = createRoute({ getParentRoute: () => rootRoute, path: "/report/period", component: lazyRouteComponent(() => import("@/pages/reports/PeriodClosing"), "PeriodClosing") });
const reportPeriodDocRoute = createRoute({ getParentRoute: () => rootRoute, path: "/report/period/$periodId", component: lazyRouteComponent(() => import("@/pages/reports/PeriodDocument"), "PeriodDocument") });
const reportsHubRoute = createRoute({ getParentRoute: () => rootRoute, path: "/reports", component: lazyRouteComponent(() => import("@/pages/reports/ReportHub"), "ReportHub") });

// QuickCheck-in (DCS)
const checkinFlightsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/checkin", component: lazyRouteComponent(() => import("@/pages/checkin/CheckinFlights"), "CheckinFlights") });
const checkinFlightRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/checkin/$flightId",
  component: lazyRouteComponent(() => import("@/pages/checkin/CheckinFlight"), "CheckinFlight"),
  validateSearch: (s: Record<string, unknown>): { pax?: string } => ({ pax: typeof s.pax === "string" ? s.pax : undefined }),
});
const seatSelectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/checkin/$flightId/seat/$passengerId",
  component: lazyRouteComponent(() => import("@/pages/checkin/SeatSelection"), "SeatSelection"),
  // Geç kabul: gerekçe kodu ve açıklama uçuş ekranından taşınır; kabul bu bilgiyle yapılır.
  validateSearch: (s: Record<string, unknown>): { late?: string; note?: string } => ({
    late: typeof s.late === "string" ? s.late : undefined,
    note: typeof s.note === "string" ? s.note : undefined,
  }),
});
const opsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/ops", component: lazyRouteComponent(() => import("@/pages/checkin/HubControl"), "HubControl") });
const serviceMapRoute = createRoute({ getParentRoute: () => rootRoute, path: "/service-map", component: lazyRouteComponent(() => import("@/pages/ServiceMap"), "ServiceMap") });

// Yönetim
const adminRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin/$section", component: lazyRouteComponent(() => import("@/pages/Admin"), "Admin") });

// Kullanım kılavuzu
const guideRoute = createRoute({ getParentRoute: () => rootRoute, path: "/guide", component: lazyRouteComponent(() => import("@/pages/Guide"), "Guide") });

// Sistem dokümantasyonu (ürün/teknik genel bakış)
const docsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/docs", component: lazyRouteComponent(() => import("@/pages/Docs"), "Docs") });

// Tanıtım sayfası — giriş gerektirmez; kabuk bu rotada yalnız Outlet çizer.
const landingRoute = createRoute({ getParentRoute: () => rootRoute, path: "/tanitim", component: lazyRouteComponent(() => import("@/pages/landing/Landing"), "Landing") });

// Personel mesajlaşma (tam sayfa)
const chatRoute = createRoute({ getParentRoute: () => rootRoute, path: "/chat", component: lazyRouteComponent(() => import("@/pages/Chat"), "Chat") });

const routeTree = rootRoute.addChildren([
  indexRoute,
  resSearchRoute, resNewRoute, resAvailRoute, resDetailRoute,
  profileRoute, searchRoute, queuesRoute, skchgRoute, issueRoute, ticketDetailRoute, itineraryRoute, messagesRoute, memosRoute, agreementsRoute, ptaRoute, ordersRoute, orderDetailRoute, emdsRoute, emdDetailRoute,
  emdReceiptRoute, reportRoute, reportFinancialRoute, reportPeriodRoute, reportPeriodDocRoute, reportsHubRoute,
  checkinFlightsRoute, checkinFlightRoute, seatSelectionRoute, opsRoute, serviceMapRoute,
  adminRoute, guideRoute, docsRoute, chatRoute, landingRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPendingComponent: () => <Skeleton className="h-64 w-full" />,
  defaultErrorComponent: ({ error, reset }) => <RouteError error={error} reset={reset} />,
  defaultNotFoundComponent: () => <NotFound />,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
