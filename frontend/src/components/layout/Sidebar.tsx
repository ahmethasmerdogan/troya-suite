import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Search, Command, HelpCircle, Plus, Settings } from "lucide-react";
import { useT } from "@/i18n";
import { useUI } from "@/store/ui";
import { usePerm } from "@/lib/usePerm";
import { moduleForPath, moduleDef, type NavItem, type NavSection, type ModuleId } from "@/modules";
import { cn } from "@/lib/utils";

// Kontekst sidebar v2 — modül kimliği artık rail+topbar'da; burası aksiyon
// alanı: üstte modülün birincil CTA'sı + ⌘K arama, altında collapsible
// gruplar (count pill), en altta utility. Panel modülünde render edilmez.

// Mock count pill'leri (route → adet). Backend gelince navCounts'tan beslenir.
const COUNTS: Record<string, { n: number; tone: "primary" | "warning" | "danger" }> = {
  "/search": { n: 3, tone: "primary" },
  "/messages": { n: 2, tone: "warning" },
  "/orders": { n: 3, tone: "primary" },
  "/checkin": { n: 5, tone: "primary" },
};

// Modül başına birincil "oluştur" aksiyonu (hedef + etiket anahtarı).
const CREATE: Record<ModuleId, { to: string; labelKey: string }> = {
  panel: { to: "/issue", labelKey: "nav.issue" },
  quickres: { to: "/res/new", labelKey: "nav.res.new" },
  troya: { to: "/issue", labelKey: "nav.issue" },
  checkin: { to: "/checkin", labelKey: "nav.ci.flights" },
};

function isActive(item: NavItem, pathname: string): boolean {
  if (item.contextual) return false;
  const base = item.to;
  if (base === "/search") return /^\/(search|tickets|itinerary)(\/|$)/.test(pathname);
  return pathname === base || pathname.startsWith(base + "/");
}

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const { can } = usePerm();
  const moduleId = moduleForPath(pathname);
  if (moduleId === "panel") return null; // Panel = tam genişlik dashboard
  const def = moduleDef(moduleId);
  if (!def) return null;
  const create = CREATE[moduleId];

  return (
    <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-[var(--border-subtle)] bg-surface lg:flex">
      {/* Birincil CTA + arama */}
      <div className="flex flex-col gap-2 p-3">
        <Link
          to={create.to}
          className="flex h-9 items-center justify-center gap-2 rounded-md bg-accent text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(16,24,40,0.2)] transition-colors hover:bg-accent-hover"
        >
          <Plus size={15} strokeWidth={2} />
          {t(create.labelKey)}
        </Link>
        <button
          onClick={() => setCommandOpen(true)}
          className="group flex w-full items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-page px-2.5 py-1.5 text-[12.5px] text-tertiary shadow-xs transition-colors hover:border-border-default hover:text-secondary"
        >
          <Search size={14} strokeWidth={1.75} />
          <span className="flex-1 text-left">{t("common.search")}…</span>
          <kbd className="flex items-center gap-0.5 rounded border border-[var(--border-subtle)] bg-surface px-1 py-0.5 font-mono text-[10px] text-tertiary">
            <Command size={9} strokeWidth={2} />K
          </kbd>
        </button>
      </div>

      <div className="mx-3 mb-1 border-t border-[var(--border-subtle)]" />

      {/* Collapsible gruplar */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {def.sections.map((section) => {
          const items = section.items.filter((i) => !i.perm || can(i.perm));
          if (!items.length) return null;
          return <Group key={section.titleKey} section={{ ...section, items }} pathname={pathname} t={t} />;
        })}
      </nav>

      {/* Alt utility row */}
      <div className="flex items-center gap-1 border-t border-[var(--border-subtle)] p-2.5">
        <button
          onClick={() => setCommandOpen(true)}
          className="grid h-7 w-7 place-items-center rounded-md text-tertiary transition-colors hover:bg-sunken hover:text-primary"
          title={`${t("common.search")} · ⌘K`}
        >
          <HelpCircle size={16} strokeWidth={1.75} />
        </button>
        <Link
          to="/admin/$section"
          params={{ section: "settings" }}
          className="ml-auto grid h-7 w-7 place-items-center rounded-md text-tertiary transition-colors hover:bg-sunken hover:text-primary"
          title={t("nav.settings")}
        >
          <Settings size={16} strokeWidth={1.75} />
        </Link>
      </div>
    </aside>
  );
}

function Group({ section, pathname, t }: { section: NavSection; pathname: string; t: (k: string) => string }) {
  const activeIn = section.items.some((i) => isActive(i, pathname));
  const storeKey = "troya.nav." + section.titleKey;
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(storeKey) === "1"; } catch { return false; }
  });
  const toggle = () =>
    setCollapsed((c) => {
      const n = !c;
      try { localStorage.setItem(storeKey, n ? "1" : "0"); } catch { /* yoksay */ }
      return n;
    });

  return (
    <div className="mb-4">
      <button
        onClick={toggle}
        className={cn(
          "group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] transition-colors",
          activeIn ? "text-secondary" : "text-tertiary hover:text-secondary",
        )}
      >
        <span>{t(section.titleKey)}</span>
        {activeIn && <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />}
        <ChevronDown
          size={12}
          strokeWidth={2.25}
          className={cn("ml-auto text-disabled transition-transform group-hover:text-tertiary", collapsed && "-rotate-90")}
        />
      </button>

      {!collapsed && (
        <ul className="mt-1 flex flex-col gap-0.5">
          {section.items.map((item) => (
            <SidebarLink key={`${section.titleKey}-${item.labelKey}`} item={item} active={isActive(item, pathname)} t={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SidebarLink({ item, active, t }: { item: NavItem; active: boolean; t: (k: string) => string }) {
  const Icon = item.icon;
  const count = COUNTS[item.to];
  return (
    <li>
      <Link
        to={item.to}
        search={item.action ? { action: item.action } : undefined}
        aria-current={active ? "page" : undefined}
        title={item.contextual ? t("common.selectTicketHint") : undefined}
        className={cn(
          "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
          active
            ? "bg-accent-soft text-accent"
            : "text-secondary hover:bg-sunken hover:text-primary",
        )}
      >
        <Icon size={16} strokeWidth={1.75} className={cn("flex-shrink-0", active ? "text-accent" : "text-tertiary group-hover:text-secondary")} />
        <span className="truncate">{t(item.labelKey)}</span>
        {count && !item.contextual && (
          <span
            className={cn(
              "ml-auto rounded-full px-1.5 py-0 text-[10px] font-medium tabular-nums",
              count.tone === "warning" && "bg-[var(--warning-bg)] text-[var(--warning-text)]",
              count.tone === "danger" && "bg-[var(--danger-bg)] text-[var(--danger-text)]",
              count.tone === "primary" && (active ? "bg-surface text-accent shadow-xs" : "bg-sunken text-tertiary"),
            )}
          >
            {count.n}
          </span>
        )}
      </Link>
    </li>
  );
}
