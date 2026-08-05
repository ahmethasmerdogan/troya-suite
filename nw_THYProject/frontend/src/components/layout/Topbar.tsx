import { useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell, BookOpen, BookText, Check, ChevronDown, Command as CommandIcon, Globe,
  LogOut, Menu as MenuIcon, MessageSquare, Moon, Search, Sun, UserRound,
} from "lucide-react";
import { useUI, type Lang } from "@/store/ui";
import { useChatUnreadTotal } from "@/store/chat";
import { ScreenHelpButton } from "@/components/layout/ScreenHelp";
import { useT } from "@/i18n";
import { usePerm } from "@/lib/usePerm";
import { ROLE_DESC, ROLE_LABEL, ROLE_ORDER, type Role } from "@/domain/auth";
import { MODULES, PANEL_ICON, moduleDef, moduleForPath } from "@/modules";
import { BrandMark } from "@/components/BrandMark";
import { Menu as Pop, MenuItem, MenuLabel, MenuRule, useOutside } from "@/components/ui/overlay";
import { Dot } from "@/components/ui/pill";
import { Kbd } from "@/components/ui/core";
import { NoticeRow, useNotices } from "./Notices";
import { cn } from "@/lib/utils";

/**
 * Üst menü — iki katlı kurumsal başlık.
 *
 *   1. kat  marka · modül gezinme · ⌘K · dil/bildirim/tema/hesap
 *   2. kat  aktif modülün bölümleri (yetkiye göre süzülü)
 *
 * Sol ray kaldırıldı: veri-yoğun ekranlarda yatay alan içeriğe gitmeli,
 * gezinme yukarıda tek yerde toplanmalı.
 */
const ICON_BTN = "grid h-8 w-8 place-items-center rounded-[9px] text-ink-2 transition-colors hover:bg-inset hover:text-ink";

export function Topbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const setMobileNav = useUI((s) => s.setMobileNav);
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const navigate = useNavigate();
  const t = useT();
  const { can } = usePerm();

  const activeModule = moduleForPath(pathname);
  const def = moduleDef(activeModule);
  const dark = theme === "dark";
  const unread = useChatUnreadTotal();

  const isOn = (to: string) =>
    to === "/search"
      ? /^\/(search|tickets|itinerary)(\/|$)/.test(pathname)
      : pathname === to || pathname.startsWith(to + "/");

  return (
    <header data-print-hide className="z-30 flex-shrink-0 border-b border-line bg-surface">
      {/* --- 1. kat --- */}
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <button onClick={() => setMobileNav(true)} className={cn(ICON_BTN, "lg:hidden")} aria-label="Menü">
          <MenuIcon size={19} strokeWidth={1.75} />
        </button>

        <Link to="/" className="flex select-none items-center gap-2.5">
          <BrandMark size={30} />
          <span className="hidden text-[15px] font-semibold tracking-tight text-ink sm:block">{t("brand.suite")}</span>
        </Link>

        <span className="mx-1 hidden h-6 w-px bg-line lg:block" aria-hidden />

        {/* modül gezinme */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Modüller">
          <ModTab to="/" icon={PANEL_ICON} label={t("module.panel")} on={activeModule === "panel"} />
          {MODULES.map((m) => (
            <ModTab key={m.id} to={m.home} icon={m.icon} label={t(m.labelKey)} on={activeModule === m.id} />
          ))}
        </nav>

        <button
          onClick={() => setCommandOpen(true)}
          className="ml-auto hidden h-9 w-56 items-center gap-2 rounded-[10px] border border-line-strong bg-canvas px-3 text-[13px] text-ink-3 transition-colors hover:border-[var(--brand)] hover:text-ink-2 md:flex xl:w-72"
        >
          <Search size={14} strokeWidth={1.75} />
          <span className="truncate">{t("topbar.searchPlaceholder")}</span>
          <Kbd className="ml-auto"><CommandIcon size={9} strokeWidth={2} />K</Kbd>
        </button>
        <button onClick={() => setCommandOpen(true)} className={cn(ICON_BTN, "ml-auto md:hidden")} aria-label={t("common.search")}>
          <Search size={17} strokeWidth={1.75} />
        </button>

        <div className="flex items-center gap-0.5">
          <Link to="/chat" aria-label={t("topbar.messages")} title={t("topbar.messages")}
            className={cn(ICON_BTN, "relative", pathname.startsWith("/chat") && "bg-inset text-ink")}>
            <MessageSquare size={17} strokeWidth={1.75} />
            {unread > 0 && (
              <span className="num absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-semibold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <button onClick={() => setTheme(dark ? "light" : "dark")} className={ICON_BTN}
            aria-label={dark ? "Açık tema" : "Koyu tema"} title={dark ? "Açık tema" : "Koyu tema"}>
            {dark ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
          </button>
          <LanguageMenu />
          <NotificationMenu />
          <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />
          <ScreenHelpButton />
          <AccountMenu onSettings={() => navigate({ to: "/admin/$section", params: { section: "settings" } })} />
        </div>
      </div>

      {/* --- 2. kat: aktif modülün bölümleri --- */}
      {def && (
        <div className="hidden h-11 items-center gap-1 overflow-x-auto border-t border-line px-3 sm:px-4 lg:flex">
          {def.sections.flatMap((s) => s.items.filter((i) => !i.perm || can(i.perm))).map((item) => {
            const Icon = item.icon;
            const on = !item.contextual && isOn(item.to);
            return (
              <Link
                key={`${item.to}-${item.labelKey}`}
                to={item.to}
                search={item.action ? { action: item.action } : undefined}
                title={item.contextual ? t("common.selectTicketHint") : undefined}
                className={cn(
                  "relative flex h-11 flex-shrink-0 items-center gap-1.5 px-3 text-[13px] transition-colors",
                  on ? "font-semibold text-ink" : "text-ink-3 hover:text-ink",
                )}
              >
                <Icon size={14} strokeWidth={1.75} className={on ? "text-brand" : ""} />
                {t(item.labelKey)}
                {on && <span aria-hidden className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-brand" />}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}

function ModTab({ to, icon: Icon, label, on }: { to: string; icon: typeof Bell; label: string; on: boolean }) {
  return (
    <Link
      to={to}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2 rounded-[10px] px-3 text-[13.5px] font-medium transition-colors",
        on ? "bg-brand-wash text-brand" : "text-ink-2 hover:bg-inset hover:text-ink",
      )}
    >
      <Icon size={16} strokeWidth={1.75} />
      {label}
    </Link>
  );
}

/**
 * Zil — uydurma bildirim listesi değil, kabuğun duyuru akışının kendisi
 * (operasyon uyarı motoru + gelir koruma + operasyon kanalı). Rozetteki
 * sayı kritik+uyarı sayısıdır; sıfırsa nokta da yoktur.
 */
function NotificationMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const notices = useNotices();
  const urgent = notices.filter((n) => n.severity !== "info").length;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={cn(ICON_BTN, "relative")} title={t("topbar.notifications")} aria-label={t("topbar.notifications")}>
        <Bell size={17} strokeWidth={1.75} />
        {urgent > 0 && (
          <span className="num absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-semibold text-white">
            {urgent > 9 ? "9+" : urgent}
          </span>
        )}
      </button>
      {open && (
        <Pop className="w-[22rem]">
          <div className="flex items-center justify-between px-2.5 py-2">
            <span className="text-[13px] font-semibold text-ink">{t("topbar.notifications")}</span>
            <span className="num rounded-full bg-brand-wash px-2 py-0.5 text-[11px] font-medium text-brand">{notices.length}</span>
          </div>
          <MenuRule />
          <div className="max-h-96 overflow-y-auto">
            {notices.length === 0 ? (
              <div className="px-2.5 py-6 text-center text-[12.5px] text-ink-3">Açık duyuru yok.</div>
            ) : (
              notices.slice(0, 12).map((n) => (
                <NoticeRow key={n.id} notice={n} onNavigate={() => setOpen(false)} />
              ))
            )}
          </div>
        </Pop>
      )}
    </div>
  );
}

function LanguageMenu() {
  const { lang, setLang } = useUI();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const langs: { id: Lang; label: string }[] = [{ id: "tr", label: "Türkçe" }, { id: "en", label: "English" }];
  return (
    <div ref={ref} className="relative hidden sm:block">
      <button onClick={() => setOpen((o) => !o)} title={t("topbar.language")}
        className="flex h-8 items-center gap-1.5 rounded-[9px] px-2 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-inset hover:text-ink">
        <Globe size={14} strokeWidth={1.75} />
        <span className="uppercase">{lang}</span>
      </button>
      {open && (
        <Pop className="w-40">
          {langs.map((l) => (
            <MenuItem key={l.id} onSelect={() => { setLang(l.id); setOpen(false); }}
              icon={<span className="num text-[11px] uppercase">{l.id}</span>}>
              {l.label}
              {lang === l.id && <Check size={14} strokeWidth={2} className="ml-auto text-brand" />}
            </MenuItem>
          ))}
        </Pop>
      )}
    </div>
  );
}

function AccountMenu({ onSettings }: { onSettings: () => void }) {
  const t = useT();
  const role = useUI((s) => s.role);
  const setRole = useUI((s) => s.setRole);
  const user = useUI((s) => s.user);
  const logout = useUI((s) => s.logout);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} title={`${user?.name ?? "—"} · ${ROLE_LABEL[role]}`}
        className="flex h-9 items-center gap-2 rounded-[10px] px-1 transition-colors hover:bg-inset sm:pr-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-[10.5px] font-semibold text-white">
          {user?.initials ?? "??"}
        </span>
        <span className="hidden max-w-28 truncate text-[12.5px] font-medium text-ink sm:block">{user?.name ?? "—"}</span>
        <ChevronDown size={12} strokeWidth={2} className="hidden text-ink-3 sm:block" />
      </button>
      {open && (
        <Pop className="w-64">
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-[12px] font-semibold text-white">{user?.initials ?? "??"}</span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-ink">{user?.name ?? "—"}</div>
              <div className="truncate text-[12px] text-ink-3">
                {user?.location ?? "—"} · TK · <span className="font-medium text-brand">{ROLE_LABEL[role]}</span>
              </div>
            </div>
          </div>
          <MenuRule />
          <Link to="/profile" onClick={() => setOpen(false)} className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] text-ink hover:bg-inset">
            <UserRound size={15} strokeWidth={1.75} className="text-ink-3" /> {t("nav.profile")}
          </Link>
          <MenuRule />
          <MenuLabel>Rol (demo)</MenuLabel>
          {ROLE_ORDER.map((r) => (
            <MenuItem key={r} onSelect={() => setRole(r)} icon={<Dot tone={r === role ? "red" : "gray"} />}>
              {ROLE_LABEL[r as Role]}
              <span className="sr-only">{ROLE_DESC[r]}</span>
              {r === role && <Check size={14} strokeWidth={2} className="ml-auto text-brand" />}
            </MenuItem>
          ))}
          <MenuRule />
          <Link to="/docs" onClick={() => setOpen(false)} className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] text-ink hover:bg-inset">
            <BookText size={15} strokeWidth={1.75} className="text-ink-3" /> {t("nav.docs")}
          </Link>
          <Link to="/guide" onClick={() => setOpen(false)} className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] text-ink hover:bg-inset">
            <BookOpen size={15} strokeWidth={1.75} className="text-ink-3" /> {t("nav.guide")}
          </Link>
          <MenuItem onSelect={() => { onSettings(); setOpen(false); }}>{t("nav.settings")}</MenuItem>
          <MenuItem danger onSelect={() => { setOpen(false); logout(); }} icon={<LogOut size={15} strokeWidth={1.75} />}>
            {t("topbar.logout")}
          </MenuItem>
        </Pop>
      )}
    </div>
  );
}
