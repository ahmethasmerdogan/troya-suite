import {
  BadgeInfo, Boxes, Layers, ShieldCheck, Cpu, GitBranch, BookMarked,
  Ticket, PlaneTakeoff, LayoutDashboard, Radar, Waypoints, CheckCircle2, CircleDot,
  Database, Server, Lock, Network, FileCheck2, Sparkles, type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

// Sistem dokümantasyonu — ürün/teknik genel bakış. Hitit/THY gibi paydaşlara
// sunulabilir: ne barındırdığı, neyi çözdüğü, IATA kapsamı, mimari ve teknoloji yığını.
// İçerik iki dilli; aktif arayüz diline göre seçilir.

type Lang = "tr" | "en";
type Bi = Record<Lang, string>;
const bi = (tr: string, en: string): Bi => ({ tr, en });

const NAV: { id: string; label: Bi; icon: LucideIcon }[] = [
  { id: "overview", label: bi("Genel Bakış", "Overview"), icon: BadgeInfo },
  { id: "problems", label: bi("Çözdüğü Problemler", "What It Solves"), icon: Sparkles },
  { id: "modules", label: bi("Modüller & Yetenekler", "Modules & Capabilities"), icon: Boxes },
  { id: "coverage", label: bi("IATA Handbook Kapsamı", "IATA Handbook Coverage"), icon: FileCheck2 },
  { id: "architecture", label: bi("Mimari İlkeler", "Architecture Principles"), icon: Layers },
  { id: "tech", label: bi("Teknoloji Yığını", "Technology Stack"), icon: Cpu },
  { id: "security", label: bi("Güvenlik & Uyumluluk", "Security & Compliance"), icon: ShieldCheck },
  { id: "status", label: bi("Durum & Yol Haritası", "Status & Roadmap"), icon: GitBranch },
];

const HERO = {
  kicker: bi("Sistem Dokümantasyonu", "System Documentation"),
  title: bi("Troya Suite", "Troya Suite"),
  tagline: bi(
    "IATA Ticketing Handbook çekirdeğinden türetilen modern, tıklama-tabanlı biletleme platformu.",
    "A modern, click-based ticketing platform derived from the IATA Ticketing Handbook core.",
  ),
  body: bi(
    "Troya Suite, bir PSS'in (Passenger Service System) elektronik biletleme modülüdür: elektronik bilet (ET) ve EMD kesimi, kupon yaşam döngüsü yönetimi, exchange/reissue/refund/void, interline mesajlaşma ve DCS check-in/operasyon kontrolü. Eski kriptik terminal komutlarının yerine tıklama-tabanlı bir React arayüzü sunar — ama temel ilke korunur: “tek komut, iki yüzey”. Terminal komutu da React tıklaması da aynı backend komutuna eşlenir.",
    "Troya Suite is the electronic ticketing module of a PSS (Passenger Service System): electronic ticket (ET) and EMD issuance, coupon lifecycle management, exchange/reissue/refund/void, interline messaging, and DCS check-in/operations control. It replaces legacy cryptic terminal commands with a click-based React interface — while keeping the core principle: “one command, two surfaces”. Both the terminal command and the React click map to the same backend command.",
  ),
};

const STATS: { value: string; label: Bi }[] = [
  { value: "3+2", label: bi("Operasyon modülü + Panel & Yönetim", "Operation modules + Panel & Admin") },
  { value: "17", label: bi("Kupon statüsü (FSM)", "Coupon statuses (FSM)") },
  { value: "7", label: bi("Mimari invariant", "Architecture invariants") },
  { value: "TR/EN", label: bi("Çift dilli arayüz", "Bilingual interface") },
];

const PROBLEMS: { title: Bi; desc: Bi }[] = [
  {
    title: bi("Kriptik terminal → görsel akış", "Cryptic terminal → visual flow"),
    desc: bi(
      "Ezber gerektiren cryptic entry'ler yerine adım-adım sihirbazlar, renk kodlu statü rozetleri ve canlı yaşam döngüsü zaman çizelgesi.",
      "Step-by-step wizards, color-coded status badges and a live lifecycle timeline instead of memorized cryptic entries.",
    ),
  },
  {
    title: bi("Tam denetlenebilirlik (audit)", "Full auditability"),
    desc: bi(
      "Event Sourcing ile her değişiklik değişmez bir olaydır; bir biletin tüm geçmişi yeniden oynatılabilir — kim, ne zaman, neyi değiştirdi.",
      "With Event Sourcing every change is an immutable event; a ticket's full history can be replayed — who changed what, when.",
    ),
  },
  {
    title: bi("Çift-kesim / çift-iade riski yok", "No double-issue / double-refund"),
    desc: bi(
      "Para/statü değiştiren her komut idempotency key alır; tekrar eden istek aynı sonucu döndürür, yan etki üretmez.",
      "Every money/status-changing command takes an idempotency key; a repeated request returns the same result with no side effects.",
    ),
  },
  {
    title: bi("Kupon yaşam döngüsü kontrolü", "Coupon lifecycle control"),
    desc: bi(
      "Kupon statüsü açık bir sonlu durum makinesidir (FSM); izin verilmeyen geçiş reddedilir. Final statüler terminaldir.",
      "Coupon status is an explicit finite state machine (FSM); disallowed transitions are rejected. Final statuses are terminal.",
    ),
  },
  {
    title: bi("Rol bazlı yetkilendirme", "Role-based authorization"),
    desc: bi(
      "Personel/süpervizör/şef/müdür/admin kümülatif yetki matrisi; menü ve aksiyonlar role göre açılır/kilitlenir.",
      "Staff/supervisor/chief/manager/admin cumulative permission matrix; menus and actions unlock/lock per role.",
    ),
  },
  {
    title: bi("Uçtan uca tip güvenliği", "End-to-end type safety"),
    desc: bi(
      "OpenAPI sözleşmesi tek doğruluk kaynağıdır; TypeScript tipleri ondan üretilir, kontrat derlemede zorlanır.",
      "The OpenAPI contract is the single source of truth; TypeScript types are generated from it and the contract is enforced at build time.",
    ),
  },
];

const MODULES: { icon: LucideIcon; name: string; sub: Bi; items: Bi[] }[] = [
  {
    icon: LayoutDashboard, name: "Panel", sub: bi("Anasayfa / kontrol merkezi", "Home / control center"),
    items: [
      bi("Günün uçuş, check-in, PNR ve bilet KPI şeridi", "Daily flight, check-in, PNR and ticket KPI strip"),
      bi("Kupon statü dağılımı (donut) + son olay akışı", "Coupon status distribution (donut) + recent event feed"),
      bi("Modül kartlarından hızlı giriş", "Quick entry from module cards"),
    ],
  },
  {
    icon: BookMarked, name: "QuickRes", sub: bi("Rezervasyon (PNR)", "Reservations (PNR)"),
    items: [
      bi("PNR oluştur (yolcu + segment sihirbazı)", "Create PNR (passenger + segment wizard)"),
      bi("PNR / yolcu / güzergah araması", "PNR / passenger / route search"),
      bi("Koltuk müsaitlik (availability) görünümü", "Seat availability view"),
      bi("PNR → bilet bağlantısı (linkage)", "PNR → ticket linkage"),
    ],
  },
  {
    icon: Ticket, name: "Troya", sub: bi("Biletleme motoru", "Ticketing engine"),
    items: [
      bi("ET kesimi: yolcu → segment → fare/ödeme → onay", "ET issuance: passenger → segment → fare/payment → confirm"),
      bi("Bilet ara & görüntüle (TKT/PNR/yolcu/havalimanı)", "Search & display (TKT/PNR/passenger/airport)"),
      bi("Exchange / Reissue · Refund · Void (idempotent)", "Exchange / Reissue · Refund · Void (idempotent)"),
      bi("EMD-A/EMD-S, fazla bagaj (RFISC), PTA", "EMD-A/EMD-S, excess baggage (RFISC), PTA"),
      bi("IRROP/FIM, endorsement, revalidation, no-show", "IRROP/FIM, endorsement, revalidation, no-show"),
      bi("Interline mesajlaşma + bilateral anlaşma kaydı", "Interline messaging + bilateral agreement registry"),
      bi("ONE Order görünümü (order-native gelecek)", "ONE Order view (order-native future)"),
    ],
  },
  {
    icon: PlaneTakeoff, name: "QuickCheck-in", sub: bi("DCS — Departure Control", "DCS — Departure Control"),
    items: [
      bi("Kalkış panosu; pasaport/TC/uçuş/ad arama", "Departure board; passport/ID/flight/name search"),
      bi("Yolcu kabul → koltuk + bagaj, APIS kontrolü", "Acceptance → seat + baggage, APIS check"),
      bi("Biniş kartı + boarding (kupon O→C→L)", "Boarding pass + boarding (coupon O→C→L)"),
      bi("2D/3D kabin koltuk haritası", "2D/3D cabin seat map"),
    ],
  },
  {
    icon: Radar, name: "HUB Kontrol", sub: bi("Operasyon izleme (A-CDM)", "Operations monitoring (A-CDM)"),
    items: [
      bi("Canlı uçuş board'u + geri sayım + boarding %", "Live flight board + countdown + boarding %"),
      bi("Yolcu funnel (biletli→kabul→gate→bindi)", "Passenger funnel (ticketed→accepted→gate→boarded)"),
      bi("Severity-sıralı uyarı akışı (no-show, MCT riski…)", "Severity-sorted alert stream (no-show, MCT risk…)"),
      bi("Hub KPI'ları + A-CDM milestone drill-down", "Hub KPIs + A-CDM milestone drill-down"),
    ],
  },
  {
    icon: ShieldCheck, name: "Yönetim / Admin", sub: bi("Yönetim & gelir koruma", "Admin & revenue protection"),
    items: [
      bi("Gelir koruma anomali bayrakları", "Revenue protection anomaly flags"),
      bi("Rol–yetki matrisi, kullanıcılar, denetim logları", "Role–permission matrix, users, audit logs"),
      bi("Dil, tema, istasyon ayarları", "Language, theme, station settings"),
    ],
  },
  {
    icon: Waypoints, name: "Service Map", sub: bi("Servis bağımlılık haritası", "Service dependency map"),
    items: [
      bi("Experience/Engine/Altyapı/Veri düğümleri", "Experience/Engine/Infra/Data nodes"),
      bi("Gerçek veri akışı kenarları + canlı metrikler", "Real data-flow edges + live metrics"),
      bi("Pan/zoom, sürükle, minimap, durum renkleri", "Pan/zoom, drag, minimap, status colors"),
    ],
  },
];

const COVERAGE: { ch: string; title: Bi }[] = [
  { ch: "Ch 1–2", title: bi("ET kesimi, kupon statü FSM, fare calc, conjunction", "ET issuance, coupon status FSM, fare calc, conjunction") },
  { ch: "Ch 1.3.1", title: bi("Revalidation / reservations change", "Revalidation / reservations change") },
  { ch: "Ch 1.3.3", title: bi("Carrier print-to-paper (P statüsü)", "Carrier print-to-paper (P status)") },
  { ch: "Ch 9", title: bi("PTA — Prepaid Ticket Advice", "PTA — Prepaid Ticket Advice") },
  { ch: "Ch 10", title: bi("UATP ödeme yöntemi", "UATP form of payment") },
  { ch: "Ch 12", title: bi("Exchange / reissue (ADC, residual)", "Exchange / reissue (ADC, residual)") },
  { ch: "Ch 13", title: bi("IRROP/FIM, no-show, vefat/hastalık waiver", "IRROP/FIM, no-show, death/illness waiver") },
  { ch: "Ch 14", title: bi("EMD-A/EMD-S, fazla bagaj, gelir koruma", "EMD-A/EMD-S, excess baggage, revenue protection") },
  { ch: "Ch 15", title: bi("Refund / void, ceza & residual", "Refund / void, penalty & residual") },
  { ch: "2.19", title: bi("Endorsement / kısıtlamalar", "Endorsement / restrictions") },
  { ch: "Interline", title: bi("EDIFACT + NDC mesajlaşma, control transfer", "EDIFACT + NDC messaging, control transfer") },
  { ch: "DCS", title: bi("Check-in, boarding, koltuk (kupon O→C→L)", "Check-in, boarding, seating (coupon O→C→L)") },
];

const ARCH: { icon: LucideIcon; title: Bi; desc: Bi }[] = [
  { icon: Layers, title: bi("Event Sourcing", "Event Sourcing"), desc: bi("State olaylardan türetilir; her değişiklik değişmez, append-only bir domain olayıdır. Audit, domainin tanımıdır.", "State is derived from events; every change is an immutable, append-only domain event. Audit is the definition of the domain.") },
  { icon: GitBranch, title: bi("CQRS", "CQRS"), desc: bi("Yazma (komut→aggregate→event) ve okuma (read model projeksiyonu) ayrıdır.", "Writes (command→aggregate→event) and reads (read-model projection) are separated.") },
  { icon: CircleDot, title: bi("Coupon FSM", "Coupon FSM"), desc: bi("Statü geçişleri açık tanımlıdır; izinsiz geçiş exception fırlatır. Final statüler terminaldir.", "Status transitions are explicit; disallowed transitions throw. Final statuses are terminal.") },
  { icon: Boxes, title: bi("Hexagonal", "Hexagonal"), desc: bi("Domain modülü framework/DB/Kafka bilmez. Dış sistemler port + adapter ile bağlanır.", "The domain module knows nothing of framework/DB/Kafka. External systems connect via ports + adapters.") },
  { icon: FileCheck2, title: bi("Idempotency", "Idempotency"), desc: bi("Para/statü komutları idempotency key alır; tekrar = aynı sonuç, yan etki yok.", "Money/status commands take an idempotency key; retry = same result, no side effects.") },
  { icon: Network, title: bi("Outbox + Control lease", "Outbox + Control lease"), desc: bi("DB transaction + mesaj yayını atomik (outbox). Kupon control'ünü aynı anda tek carrier tutar (TTL'li lease).", "DB transaction + message publish are atomic (outbox). Coupon control is held by one carrier at a time (TTL lease).") },
];

const TECH: { group: Bi; items: string[] }[] = [
  { group: bi("Backend (Engine)", "Backend (Engine)"), items: ["Kotlin", "Spring Boot 3", "Java 21", "PostgreSQL 16 (jsonb event store + read model)", "Kafka / Redpanda", "Redis", "OpenAPI 3.1", "SSE / WebSocket", "JUnit 5 + Testcontainers + Kotest", "OpenTelemetry", "ktlint + detekt"] },
  { group: bi("Frontend (Experience)", "Frontend (Experience)"), items: ["Vite 6", "React 18 + TypeScript", "TanStack Router / Query / Table", "Zustand", "React Hook Form + Zod", "shadcn/ui + Tailwind CSS v4", "cmdk (⌘K palette)", "react-oidc-context", "Vitest + RTL + Playwright"] },
  { group: bi("Ortak / Altyapı", "Shared / Infrastructure"), items: ["Docker Compose", "PostgreSQL", "Redpanda", "Redis", "Keycloak (OIDC)", "Vercel (frontend dağıtım)"] },
];

const SECURITY: { icon: LucideIcon; title: Bi; desc: Bi }[] = [
  { icon: Lock, title: bi("Rol bazlı yetki (RBAC)", "Role-based access (RBAC)"), desc: bi("Kümülatif yetki matrisi; production'da sunucu-side zorlanır (Keycloak/OIDC). Demoda UI gating gösterilir.", "Cumulative permission matrix; enforced server-side in production (Keycloak/OIDC). The demo shows UI gating.") },
  { icon: ShieldCheck, title: bi("PCI-DSS & KVKK/GDPR", "PCI-DSS & KVKK/GDPR"), desc: bi("Kart verisi tokenizasyonu ve PII şifrelemesi backend katmanında uygulanır; arayüz kartı maskeli işler.", "Card tokenization and PII encryption are applied at the backend layer; the UI handles cards masked.") },
  { icon: FileCheck2, title: bi("Değişmez audit trail", "Immutable audit trail"), desc: bi("Her aksiyon event-sourced kayıt; silinmez, yeniden oynatılabilir denetim izi.", "Every action is an event-sourced record; a non-erasable, replayable audit trail.") },
  { icon: ShieldCheck, title: bi("Güvenlik header'ları", "Security headers"), desc: bi("CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer/Permissions-Policy (Vercel edge).", "CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer/Permissions-Policy (Vercel edge).") },
];

type Stat = "done" | "progress" | "planned";
const STATUS_DOT: Record<Stat, string> = { done: "bg-[var(--success-text)]", progress: "bg-[var(--warning-text)]", planned: "bg-[var(--border-strong)]" };
const STATUS: { lane: Bi; rows: { name: string; state: Stat }[] }[] = [
  {
    lane: bi("Engine (Backend)", "Engine (Backend)"),
    rows: [
      { name: "F0 — Temel / iskelet", state: "done" },
      { name: "F1 — Bilet + kupon (issue, idempotency, event store)", state: "done" },
      { name: "F2 — Search + receipt (CQRS read model)", state: "done" },
      { name: "F3 — Void / exchange / refund", state: "planned" },
      { name: "F4–F7 — Fare/TFC · EMD · Interline · Order-native", state: "planned" },
    ],
  },
  {
    lane: bi("Experience (Frontend)", "Experience (Frontend)"),
    rows: [
      { name: "FE0 — Shell (auth, i18n, ⌘K)", state: "done" },
      { name: "FE1–FE3 — Issue · search/timeline · exchange/refund/void", state: "done" },
      { name: "FE4–FE7 — Fare/TFC · EMD · Interline · Order", state: "done" },
      { name: "HUB Kontrol · Service Map · DCS check-in", state: "done" },
      { name: "Canlı (SSE) bağlama — Engine F3+ ile", state: "progress" },
    ],
  },
];

export function Docs() {
  const lang = useUI((s) => s.lang) as Lang;
  const L = (b: Bi) => b[lang];

  return (
    <div>
      <PageHeader
        title={L(bi("Dokümantasyon", "Documentation"))}
        description={L(bi("Troya Suite ne barındırır, neyi çözer, hangi teknolojiler üzerine kuruludur.", "What Troya Suite contains, what it solves, and the technologies it is built on."))}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[210px_1fr]">
        {/* in-page nav */}
        <nav className="hidden lg:block">
          <div className="sticky top-2 flex flex-col gap-0.5">
            {NAV.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 rounded-md px-3 py-2 text-[13px] text-secondary transition-colors hover:bg-sunken hover:text-primary">
                <s.icon size={15} strokeWidth={1.75} className="text-tertiary" /> {L(s.label)}
              </a>
            ))}
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          {/* HERO */}
          <div id="overview" className="scroll-mt-4 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-gradient-to-br from-accent-soft to-surface p-6 sm:p-8">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">{L(HERO.kicker)}</div>
            <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-primary sm:text-[34px]">{L(HERO.title)}</h2>
            <p className="mt-2 max-w-2xl text-[15px] font-medium leading-relaxed text-primary">{L(HERO.tagline)}</p>
            <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-secondary">{L(HERO.body)}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.value} className="rounded-lg border border-[var(--border-subtle)] bg-surface/70 px-3 py-3 backdrop-blur-sm">
                  <div className="text-[22px] font-semibold tabular-nums tracking-tight text-primary">{s.value}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-tertiary">{L(s.label)}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-[12px]">
              {["Event Sourcing", "CQRS", "Coupon FSM", "Idempotency", "Hexagonal", "Outbox", "Control lease", "Order-native"].map((c) => (
                <span key={c} className="rounded-pill bg-surface px-2.5 py-1 text-secondary shadow-xs">{c}</span>
              ))}
            </div>
          </div>

          {/* PROBLEMS */}
          <Section id="problems" title={L(bi("Çözdüğü Problemler", "What It Solves"))} icon={Sparkles}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PROBLEMS.map((p) => (
                <div key={L(p.title)} className="rounded-lg border border-[var(--border-subtle)] bg-surface-alt p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} strokeWidth={2} className="shrink-0 text-accent" />
                    <div className="text-[13.5px] font-semibold text-primary">{L(p.title)}</div>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-secondary">{L(p.desc)}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* MODULES */}
          <Section id="modules" title={L(bi("Modüller & Yetenekler", "Modules & Capabilities"))} icon={Boxes}>
            <div className="flex flex-col gap-4">
              {MODULES.map((m) => (
                <div key={m.name} className="rounded-lg border border-[var(--border-subtle)] bg-surface-alt p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-accent-soft text-accent"><m.icon size={17} strokeWidth={1.75} /></span>
                    <div><div className="text-[14px] font-semibold text-primary">{m.name}</div><div className="text-[11px] text-tertiary">{L(m.sub)}</div></div>
                  </div>
                  <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    {m.items.map((it) => (
                      <li key={L(it)} className="flex items-start gap-2 text-[12.5px] leading-snug text-secondary">
                        <CircleDot size={12} strokeWidth={2} className="mt-1 shrink-0 text-tertiary" /> {L(it)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          {/* COVERAGE */}
          <Section id="coverage" title={L(bi("IATA Handbook Kapsamı", "IATA Handbook Coverage"))} icon={FileCheck2}>
            <p className="mb-3 text-[13px] text-secondary">
              {L(bi(
                "Sistem, IATA Ticketing Handbook'un büyük fonksiyonlarını kapsar. Aşağıda ana bölüm eşlemesi yer alır.",
                "The system covers the major functions of the IATA Ticketing Handbook. The main chapter mapping is below.",
              ))}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {COVERAGE.map((c) => (
                <div key={c.ch} className="flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2">
                  <span className="w-20 flex-shrink-0 rounded bg-sunken px-1.5 py-0.5 text-center font-mono text-[11px] font-medium text-secondary">{c.ch}</span>
                  <span className="text-[12.5px] text-secondary">{L(c.title)}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* ARCHITECTURE */}
          <Section id="architecture" title={L(bi("Mimari İlkeler", "Architecture Principles"))} icon={Layers}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ARCH.map((a) => (
                <div key={L(a.title)} className="rounded-lg border border-[var(--border-subtle)] bg-surface-alt p-4">
                  <div className="flex items-center gap-2">
                    <a.icon size={16} strokeWidth={1.75} className="shrink-0 text-accent" />
                    <div className="text-[13.5px] font-semibold text-primary">{L(a.title)}</div>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-secondary">{L(a.desc)}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* TECH */}
          <Section id="tech" title={L(bi("Teknoloji Yığını", "Technology Stack"))} icon={Cpu}>
            <div className="flex flex-col gap-4">
              {TECH.map((g, i) => (
                <div key={L(g.group)}>
                  <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-tertiary">
                    {i === 0 ? <Server size={14} /> : i === 1 ? <LayoutDashboard size={14} /> : <Database size={14} />}
                    {L(g.group)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((it) => (
                      <span key={it} className="rounded-pill border border-[var(--border-subtle)] bg-surface px-2.5 py-1 text-[12px] text-secondary">{it}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* SECURITY */}
          <Section id="security" title={L(bi("Güvenlik & Uyumluluk", "Security & Compliance"))} icon={ShieldCheck}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SECURITY.map((s) => (
                <div key={L(s.title)} className="rounded-lg border border-[var(--border-subtle)] bg-surface-alt p-4">
                  <div className="flex items-center gap-2">
                    <s.icon size={16} strokeWidth={1.75} className="shrink-0 text-accent" />
                    <div className="text-[13.5px] font-semibold text-primary">{L(s.title)}</div>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-secondary">{L(s.desc)}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* STATUS */}
          <Section id="status" title={L(bi("Durum & Yol Haritası", "Status & Roadmap"))} icon={GitBranch}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {STATUS.map((lane) => (
                <div key={L(lane.lane)} className="rounded-lg border border-[var(--border-subtle)] bg-surface-alt p-4">
                  <div className="mb-2.5 text-[13px] font-semibold text-primary">{L(lane.lane)}</div>
                  <ul className="flex flex-col gap-2">
                    {lane.rows.map((r) => (
                      <li key={r.name} className="flex items-center gap-2.5 text-[12.5px] text-secondary">
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[r.state])} />
                        <span>{r.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-tertiary">
              <span className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", STATUS_DOT.done)} /> {L(bi("Tamamlandı", "Done"))}</span>
              <span className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", STATUS_DOT.progress)} /> {L(bi("Devam ediyor", "In progress"))}</span>
              <span className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", STATUS_DOT.planned)} /> {L(bi("Planlandı", "Planned"))}</span>
            </div>
            <p className="mt-5 rounded-md border border-[var(--border-subtle)] bg-sunken px-3 py-2.5 text-[12px] leading-snug text-tertiary">
              {L(bi(
                "Not: Bu yayın, mock verilerle çalışan tıklanabilir bir prototiptir. Backend motoru (Engine) F0–F2 Docker ortamında doğrulanmıştır; production dağıtımı arayüzü gerçek Engine'e bağlar.",
                "Note: This deployment is a clickable prototype running on mock data. The backend Engine F0–F2 is verified in Docker; a production deployment connects the UI to the real Engine.",
              ))}
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-4">
      <CardHeader className="flex-row items-center gap-2">
        <Icon size={18} strokeWidth={1.75} className="text-accent" />
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
