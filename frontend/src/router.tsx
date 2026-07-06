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

// QuickRes (rezervasyon)
const resSearchRoute = createRoute({ getParentRoute: () => rootRoute, path: "/res", component: lazyRouteComponent(() => import("@/pages/quickres/PnrSearch"), "PnrSearch") });
const resNewRoute = createRoute({ getParentRoute: () => rootRoute, path: "/res/new", component: lazyRouteComponent(() => import("@/pages/quickres/CreatePnr"), "CreatePnr") });
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
const issueRoute = createRoute({ getParentRoute: () => rootRoute, path: "/issue", component: lazyRouteComponent(() => import("@/pages/IssueWizard"), "IssueWizard") });
const ticketDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tickets/$ticketNumber",
  component: lazyRouteComponent(() => import("@/pages/TicketDetail"), "TicketDetail"),
  validateSearch: (s: Record<string, unknown>): { flow?: string } => ({ flow: typeof s.flow === "string" ? s.flow : undefined }),
});
const itineraryRoute = createRoute({ getParentRoute: () => rootRoute, path: "/itinerary/$ticketNumber", component: lazyRouteComponent(() => import("@/pages/Itinerary"), "Itinerary") });
const messagesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/messages", component: lazyRouteComponent(() => import("@/pages/Messages"), "Messages") });
const agreementsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/agreements", component: lazyRouteComponent(() => import("@/pages/Agreements"), "Agreements") });
const ptaRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pta", component: lazyRouteComponent(() => import("@/pages/troya/Pta"), "PtaPage") });
const ordersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/orders", component: lazyRouteComponent(() => import("@/pages/Orders"), "Orders") });
const orderDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: "/orders/$orderId", component: lazyRouteComponent(() => import("@/pages/OrderDetail"), "OrderDetail") });

// QuickCheck-in (DCS)
const checkinFlightsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/checkin", component: lazyRouteComponent(() => import("@/pages/checkin/CheckinFlights"), "CheckinFlights") });
const checkinFlightRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/checkin/$flightId",
  component: lazyRouteComponent(() => import("@/pages/checkin/CheckinFlight"), "CheckinFlight"),
  validateSearch: (s: Record<string, unknown>): { pax?: string } => ({ pax: typeof s.pax === "string" ? s.pax : undefined }),
});
const seatSelectionRoute = createRoute({ getParentRoute: () => rootRoute, path: "/checkin/$flightId/seat/$passengerId", component: lazyRouteComponent(() => import("@/pages/checkin/SeatSelection"), "SeatSelection") });
const opsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/ops", component: lazyRouteComponent(() => import("@/pages/checkin/HubControl"), "HubControl") });
const serviceMapRoute = createRoute({ getParentRoute: () => rootRoute, path: "/service-map", component: lazyRouteComponent(() => import("@/pages/ServiceMap"), "ServiceMap") });

// Yönetim
const adminRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin/$section", component: lazyRouteComponent(() => import("@/pages/Admin"), "Admin") });

// Kullanım kılavuzu
const guideRoute = createRoute({ getParentRoute: () => rootRoute, path: "/guide", component: lazyRouteComponent(() => import("@/pages/Guide"), "Guide") });

// Sistem dokümantasyonu (ürün/teknik genel bakış)
const docsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/docs", component: lazyRouteComponent(() => import("@/pages/Docs"), "Docs") });

// Personel mesajlaşma (tam sayfa)
const chatRoute = createRoute({ getParentRoute: () => rootRoute, path: "/chat", component: lazyRouteComponent(() => import("@/pages/Chat"), "Chat") });

const routeTree = rootRoute.addChildren([
  indexRoute,
  resSearchRoute, resNewRoute, resAvailRoute, resDetailRoute,
  searchRoute, issueRoute, ticketDetailRoute, itineraryRoute, messagesRoute, agreementsRoute, ptaRoute, ordersRoute, orderDetailRoute,
  checkinFlightsRoute, checkinFlightRoute, seatSelectionRoute, opsRoute, serviceMapRoute,
  adminRoute, guideRoute, docsRoute, chatRoute,
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
