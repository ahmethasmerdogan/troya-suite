import { Link, useRouterState } from "@tanstack/react-router";
import { MessageSquareText, Moon, Settings, Sun, type LucideIcon } from "lucide-react";
import { useUI } from "@/store/ui";
import { useChatUnreadTotal } from "@/store/chat";
import { useT } from "@/i18n";
import { MODULES, PANEL_ICON, moduleForPath } from "@/modules";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/utils";

// Modül rayı — tema-sabit lacivert yapısal kabuk (DESIGN_SYSTEM v2 §kabuk).
// Üstte marka, ortada modüller, altta yardımcı aksiyonlar. lg+ görünür;
// dar ekranda MobileNav devralır. Kırmızı yalnızca marka + aktif gösterge.
export function Rail() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();
  const activeModule = moduleForPath(pathname);
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const isDark = theme === "dark";
  const chatActive = pathname.startsWith("/chat");
  const unread = useChatUnreadTotal();

  return (
    <aside className="shell-panel z-30 hidden w-16 flex-shrink-0 flex-col items-center border-r border-shell-border lg:flex" aria-label="Modüller">
      {/* Marka → Panel — kırmızı rayda beyaz roundel + kırmızı kuş (yüksek kontrast) */}
      <Link to="/" className="mt-3 grid h-10 w-10 place-items-center rounded-[12px] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.20)]" title={t("brand.suite")}>
        <BrandMark size={24} variant="plain" />
      </Link>

      <div className="my-3 h-px w-8 bg-shell-border" />

      {/* Modüller */}
      <nav className="flex flex-col items-center gap-1.5">
        <RailItem to="/" icon={PANEL_ICON} label={t("module.panel")} active={activeModule === "panel"} />
        {MODULES.map((m) => (
          <RailItem key={m.id} to={m.home} icon={m.icon} label={t(m.labelKey)} active={activeModule === m.id} />
        ))}
      </nav>

      {/* Alt yardımcılar */}
      <div className="mb-3 mt-auto flex flex-col items-center gap-1.5">
        <Link
          to="/chat"
          title={t("topbar.messages")}
          aria-label={t("topbar.messages")}
          className={cn(
            "relative grid h-10 w-10 place-items-center rounded-[10px] transition-colors",
            chatActive ? "bg-shell-active text-shell-text" : "text-shell-dim hover:bg-shell-hover hover:text-shell-text",
          )}
        >
          <MessageSquareText size={19} strokeWidth={1.75} />
          {/* GERÇEK okunmamış rozeti — chat store'dan */}
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-semibold tabular-nums text-accent">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          title={isDark ? "Açık tema" : "Koyu tema"}
          className="grid h-10 w-10 place-items-center rounded-[10px] text-shell-dim transition-colors hover:bg-shell-hover hover:text-shell-text"
        >
          {isDark ? <Sun size={19} strokeWidth={1.75} /> : <Moon size={19} strokeWidth={1.75} />}
        </button>
        <Link
          to="/admin/$section"
          params={{ section: "settings" }}
          title={t("nav.settings")}
          className="grid h-10 w-10 place-items-center rounded-[10px] text-shell-dim transition-colors hover:bg-shell-hover hover:text-shell-text"
        >
          <Settings size={19} strokeWidth={1.75} />
        </Link>
      </div>
    </aside>
  );
}

function RailItem({ to, icon: Icon, label, active }: { to: string; icon: LucideIcon; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative grid h-10 w-10 place-items-center rounded-[10px] transition-colors",
        active ? "bg-shell-active text-shell-text shadow-[inset_0_0_0_1px_var(--shell-border)]" : "text-shell-dim hover:bg-shell-hover hover:text-shell-text",
      )}
    >
      {/* aktif modül göstergesi — kırmızı rayda sol BEYAZ çubuk */}
      {active && <span className="absolute -left-[13px] h-5 w-[3px] rounded-full bg-white" aria-hidden />}
      <Icon size={20} strokeWidth={1.75} />
    </Link>
  );
}
