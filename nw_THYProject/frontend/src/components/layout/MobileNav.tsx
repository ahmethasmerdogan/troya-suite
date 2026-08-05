import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Globe, Moon, Sun, X } from "lucide-react";
import { useUI } from "@/store/ui";
import { useT } from "@/i18n";
import { usePerm } from "@/lib/usePerm";
import { MODULES, PANEL_ICON, moduleDef, moduleForPath } from "@/modules";
import { BrandMark } from "@/components/BrandMark";
import { Button, IconButton } from "@/components/ui/core";
import { cn } from "@/lib/utils";

/** Dar ekran gezinme — ray ve topbar menüsünün yerini alan tam liste. */
export function MobileNav() {
  const { mobileNav, setMobileNav, theme, setTheme, lang, setLang } = useUI();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();
  const { can } = usePerm();
  const moduleId = moduleForPath(pathname);
  const def = moduleDef(moduleId);

  useEffect(() => setMobileNav(false), [pathname, setMobileNav]);
  useEffect(() => {
    if (!mobileNav) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileNav(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNav, setMobileNav]);

  if (!mobileNav) return null;

  return (
    <div data-print-hide className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label={t("shell.menu")}>
      <div className="anim-fade absolute inset-0 bg-[rgba(26,26,23,0.45)] backdrop-blur-[3px]" onClick={() => setMobileNav(false)} />
      <div className="anim-slide-l absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-panel">
        <div className="flex h-14 items-center justify-between border-b border-line px-4">
          <span className="flex items-center gap-2.5">
            <BrandMark size={26} />
            <span className="text-[14px] font-semibold text-ink">{t("brand.suite")}</span>
          </span>
          <IconButton label={t("common.close")} size="sm" onClick={() => setMobileNav(false)}><X size={17} strokeWidth={1.75} /></IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="microlabel mb-1.5 px-2">{t("shell.modules")}</div>
          <nav className="mb-4 flex flex-col gap-0.5">
            <Row to="/" icon={PANEL_ICON} label={t("module.panel")} on={moduleId === "panel"} />
            {MODULES.map((m) => (
              <Row key={m.id} to={m.home} icon={m.icon} label={t(m.labelKey)} on={moduleId === m.id} />
            ))}
          </nav>

          {def?.sections.map((section) => {
            const items = section.items.filter((i) => !i.perm || can(i.perm));
            if (!items.length) return null;
            return (
              <div key={section.titleKey} className="mb-4">
                <div className="microlabel mb-1.5 px-2">{t(section.titleKey)}</div>
                <nav className="flex flex-col gap-0.5">
                  {items.map((item) => (
                    <Row
                      key={`${section.titleKey}-${item.labelKey}`}
                      to={item.to}
                      search={item.action ? { action: item.action } : undefined}
                      icon={item.icon}
                      label={t(item.labelKey)}
                      on={false}
                    />
                  ))}
                </nav>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 border-t border-line p-3">
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
            {t(theme === "dark" ? "settings.theme.light" : "settings.theme.dark")}
          </Button>
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => setLang(lang === "tr" ? "en" : "tr")}>
            <Globe size={15} strokeWidth={1.75} /> {lang === "tr" ? "EN" : "TR"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({
  to, search, icon: Icon, label, on,
}: { to: string; search?: Record<string, string>; icon: typeof Globe; label: string; on: boolean }) {
  return (
    <Link
      to={to}
      search={search}
      className={cn(
        "flex h-9 items-center gap-3 rounded-md px-3 text-[13px] transition-colors",
        on ? "bg-brand-wash font-semibold text-brand" : "text-ink-2 hover:bg-sunken hover:text-ink",
      )}
    >
      <Icon size={17} strokeWidth={1.75} className={on ? "text-brand" : "text-ink-3"} />
      {label}
    </Link>
  );
}
