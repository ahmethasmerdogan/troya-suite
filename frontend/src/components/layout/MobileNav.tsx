import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { X, Plane, Sun, Moon, Globe } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { useUI } from "@/store/ui";
import { useT } from "@/i18n";
import { MODULES, PANEL_ICON, moduleForPath, moduleDef, type NavItem } from "@/modules";
import { cn } from "@/lib/utils";

// Mobil/dar ekran navigasyonu — hamburger ile açılır drawer.
// Modül listesi + aktif modülün bölümleri + tema/dil. lg+ ekranda hiç render olmaz.
export function MobileNav() {
  const { mobileNav, setMobileNav, theme, setTheme, lang, setLang } = useUI();
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const moduleId = moduleForPath(pathname);

  // rota değişince kapat
  useEffect(() => { setMobileNav(false); }, [pathname, setMobileNav]);
  useEffect(() => {
    if (!mobileNav) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileNav(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNav, setMobileNav]);

  if (!mobileNav) return null;
  const def = moduleDef(moduleId);

  const itemActive = (item: NavItem) =>
    !item.contextual && (item.to === "/search"
      ? pathname.startsWith("/search") || pathname.startsWith("/tickets") || pathname.startsWith("/itinerary")
      : pathname.startsWith(item.to));

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[rgba(9,16,32,0.5)] backdrop-blur-[2px]" onClick={() => setMobileNav(false)} />
      <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface shadow-xl" style={{ animation: "drawerInLeft 240ms cubic-bezier(0.16,1,0.3,1)" }}>
        <div className="shell-panel flex h-14 items-center justify-between px-4">
          <span className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
              <BrandMark size={20} variant="plain" />
            </span>
            <span className="text-[14px] font-semibold text-[var(--shell-text)]">{t("brand.suite")}</span>
          </span>
          <button onClick={() => setMobileNav(false)} className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--shell-dim)] hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)]"><X size={18} strokeWidth={1.75} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {/* modüller */}
          <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.06em] text-secondary">Modüller</div>
          <nav className="mb-4 flex flex-col gap-0.5">
            <ModRow to="/" icon={PANEL_ICON} label={t("module.panel")} active={moduleId === "panel"} />
            {MODULES.map((m) => <ModRow key={m.id} to={m.home} icon={m.icon} label={t(m.labelKey)} active={moduleId === m.id} />)}
          </nav>

          {/* aktif modül bölümleri */}
          {def && def.sections.map((section) => (
            <div key={section.titleKey} className="mb-4">
              <div className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-[0.06em] text-tertiary">{t(section.titleKey)}</div>
              <nav className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.labelKey} to={item.to} title={item.contextual ? t("common.selectTicketHint") : undefined} className={cn("flex h-9 items-center gap-3 rounded px-3 text-sm", itemActive(item) ? "bg-accent-soft font-medium text-accent" : "text-secondary hover:bg-sunken")}>
                      <Icon size={18} strokeWidth={1.75} />{t(item.labelKey)}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* footer: tema + dil */}
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] p-3">
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="flex h-9 flex-1 items-center justify-center gap-2 rounded border border-border-default text-[13px] text-secondary hover:bg-sunken">
            {theme === "dark" ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
            {theme === "dark" ? "Açık" : "Koyu"}
          </button>
          <button onClick={() => setLang(lang === "tr" ? "en" : "tr")} className="flex h-9 flex-1 items-center justify-center gap-2 rounded border border-border-default text-[13px] text-secondary hover:bg-sunken">
            <Globe size={16} strokeWidth={1.75} /> {lang === "tr" ? "EN" : "TR"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModRow({ to, icon: Icon, label, active }: { to: string; icon: typeof Plane; label: string; active: boolean }) {
  return (
    <Link to={to} className={cn("flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium", active ? "bg-accent text-white" : "text-secondary hover:bg-sunken hover:text-primary")}>
      <Icon size={18} strokeWidth={1.75} />{label}
    </Link>
  );
}
