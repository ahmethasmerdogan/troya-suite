import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Search, Command, Bell, Check, LogOut, Globe, Menu, BookOpen, BookText,
  MessageSquareText, ChevronDown, ChevronRight,
} from "lucide-react";
import { useUI, type Lang } from "@/store/ui";
import { useChatUnreadTotal } from "@/store/chat";
import { useT } from "@/i18n";
import { ROLE_LABEL, ROLE_DESC, ROLE_ORDER, type Role } from "@/domain/auth";
import { PANEL_ICON, moduleForPath, moduleDef } from "@/modules";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/utils";

// Topbar v2 — açık yüzey (h-14, alt çizgi). Solda modül bağlamı (rail'in
// metin karşılığı), ortada-sağda ⌘K arama, sağda bildirim/dil/hesap.
// Marka kırmızısı artık yalnızca accent olarak kullanılır (rail + CTA).
const ICON_BTN = "grid h-9 w-9 place-items-center rounded-md text-secondary transition-colors hover:bg-sunken hover:text-primary";

export function Topbar() {
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const setMobileNav = useUI((s) => s.setMobileNav);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();
  const moduleId = moduleForPath(pathname);
  const def = moduleDef(moduleId);
  const ModIcon = def?.icon ?? PANEL_ICON;
  const modLabel = def ? t(def.labelKey) : t("module.panel");
  const modSub = def ? t(def.subKey) : t("brand.suite");

  return (
    <header className="z-20 flex h-14 flex-shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] bg-surface px-3 sm:px-4">
      {/* Hamburger — mobil */}
      <button onClick={() => setMobileNav(true)} className={cn(ICON_BTN, "lg:hidden")} aria-label="Menü">
        <Menu size={20} strokeWidth={1.75} />
      </button>

      {/* Mobil marka (rail görünmüyorken) */}
      <Link to="/" className="flex select-none items-center gap-2 lg:hidden">
        <BrandMark size={26} variant="solid" />
        <span className="text-[14px] font-semibold tracking-tight text-primary sm:block">{t("brand.suite")}</span>
      </Link>

      {/* Modül bağlamı — lg+ (rail ikonunun metin karşılığı) */}
      <Link
        to={def?.home ?? "/"}
        className="group hidden min-w-0 items-center gap-2.5 rounded-md px-2 py-1 transition-colors hover:bg-sunken lg:flex"
      >
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md bg-sunken text-secondary transition-colors group-hover:bg-surface group-hover:shadow-xs">
          <ModIcon size={16} strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[14px] font-semibold tracking-tight text-primary">{modLabel}</span>
          <ChevronRight size={12} strokeWidth={2} className="hidden flex-shrink-0 text-disabled xl:block" />
          <span className="hidden truncate text-[12px] text-tertiary xl:block">{modSub}</span>
        </span>
      </Link>

      {/* Global arama — ⌘K (mobilde ikon) */}
      <div className="ml-auto flex items-center">
        <button
          onClick={() => setCommandOpen(true)}
          className="hidden h-9 w-full items-center gap-2 rounded-md border border-border-default bg-page px-3 text-sm text-tertiary shadow-xs transition-colors hover:border-border-strong hover:text-secondary md:flex md:w-64 lg:w-80 xl:w-96"
        >
          <Search size={15} strokeWidth={1.75} />
          <span className="truncate">{t("topbar.searchPlaceholder")}</span>
          <kbd className="ml-auto flex items-center gap-0.5 rounded border border-[var(--border-subtle)] bg-surface px-1.5 py-0.5 font-mono text-[10px] text-tertiary">
            <Command size={10} strokeWidth={2} />K
          </kbd>
        </button>
        <button onClick={() => setCommandOpen(true)} className={cn(ICON_BTN, "md:hidden")} aria-label="Ara">
          <Search size={18} strokeWidth={1.75} />
        </button>
      </div>

      {/* Sağ kontroller */}
      <div className="flex items-center gap-0.5">
        {/* Chat — dar ekranda (rail yokken) */}
        <ChatButton className="lg:hidden" />
        <LanguageMenu />
        <NotificationMenu />
        <div className="mx-1.5 hidden h-6 w-px bg-[var(--border-subtle)] sm:block" />
        <AccountMenu onSettings={() => navigate({ to: "/admin/$section", params: { section: "settings" } })} />
      </div>
    </header>
  );
}

const MOCK_NOTIFS = [
  { id: 1, dot: "var(--info-dot)", title: "Control devri", desc: "TK2359988776655 kuponu LH'a devredildi (72s lease).", time: "5 dk" },
  { id: 2, dot: "var(--success-dot)", title: "Check-in", desc: "TK198 doluluk %62 — 112/180 yolcu kabul edildi.", time: "18 dk" },
  { id: 3, dot: "var(--warning-dot)", title: "Lease uyarısı", desc: "AF interline kuponu lease süresi 6 saat içinde doluyor.", time: "1 sa" },
];

function NotificationMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={cn(ICON_BTN, "relative")} title={t("topbar.notifications")}>
        <Bell size={18} strokeWidth={1.75} />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent ring-2 ring-[var(--bg-surface)]" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-80 rounded-md border border-[var(--border-subtle)] bg-surface p-1 text-primary shadow-lg">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-[13px] font-semibold text-primary">{t("topbar.notifications")}</span>
            <span className="rounded-pill bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">{MOCK_NOTIFS.length} yeni</span>
          </div>
          <div className="my-1 h-px bg-[var(--border-subtle)]" />
          {MOCK_NOTIFS.map((n) => (
            <div key={n.id} className="flex gap-2.5 rounded-md px-3 py-2 hover:bg-sunken">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: n.dot }} />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-primary">{n.title}</span>
                  <span className="shrink-0 text-[11px] text-tertiary">{n.time}</span>
                </div>
                <div className="text-[12px] leading-snug text-secondary">{n.desc}</div>
              </div>
            </div>
          ))}
          <div className="my-1 h-px bg-[var(--border-subtle)]" />
          <button className="w-full rounded-md px-3 py-2 text-center text-[12px] font-medium text-accent hover:bg-sunken">Tümünü gör</button>
        </div>
      )}
    </div>
  );
}

function ChatButton({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname.startsWith("/chat");
  const unread = useChatUnreadTotal();
  const t = useT();
  return (
    <Link to="/chat" className={cn(ICON_BTN, "relative", active && "bg-sunken text-primary", className)} title={t("topbar.messages")} aria-label={t("topbar.messages")}>
      <MessageSquareText size={18} strokeWidth={1.75} />
      {/* GERÇEK okunmamış rozeti — chat store'dan (dekoratif nokta değil) */}
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold tabular-nums text-white ring-2 ring-[var(--bg-surface)]">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
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
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-secondary transition-colors hover:bg-sunken hover:text-primary"
        title={t("topbar.language")}
      >
        <Globe size={15} strokeWidth={1.75} />
        <span className="uppercase">{lang}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-40 rounded-md border border-[var(--border-subtle)] bg-surface p-1 shadow-lg">
          {langs.map((l) => (
            <button key={l.id} onClick={() => { setLang(l.id); setOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-primary hover:bg-sunken">
              <span className="w-5 font-mono text-[11px] uppercase text-tertiary">{l.id}</span>
              {l.label}
              {lang === l.id && <Check size={14} strokeWidth={2} className="ml-auto text-accent" />}
            </button>
          ))}
        </div>
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
  const initials = user?.initials ?? "??";
  const name = user?.name ?? "—";
  return (
    <div ref={ref} className="relative">
      {/* Kullanıcı çipi — ad + rol görünür (profesyonel konsol kalıbı) */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-md px-1.5 transition-colors hover:bg-sunken sm:pr-2.5"
        title={`${name} · ${ROLE_LABEL[role]}`}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--shell-bg)] text-[11px] font-semibold text-white ring-1 ring-[var(--border-default)]">
          {initials}
        </span>
        <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
          <span className="max-w-[120px] truncate text-[12.5px] font-medium text-primary">{name}</span>
          <span className="text-[10.5px] text-tertiary">{ROLE_LABEL[role]}</span>
        </span>
        <ChevronDown size={13} strokeWidth={2} className="hidden text-tertiary sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-64 rounded-md border border-[var(--border-subtle)] bg-surface p-1 text-primary shadow-lg">
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--shell-bg)] text-[12px] font-semibold text-white">{initials}</span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-primary">{name}</div>
              <div className="truncate text-[12px] text-tertiary">{user?.location ?? "—"} · TK · <span className="font-medium text-accent">{ROLE_LABEL[role]}</span></div>
            </div>
          </div>
          <div className="my-1 h-px bg-[var(--border-subtle)]" />
          {/* Demo rol değiştirici — gerçekte Keycloak rolünden gelir */}
          <div className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-tertiary">Rol (demo)</div>
          {ROLE_ORDER.map((r) => (
            <button key={r} onClick={() => setRole(r)} title={ROLE_DESC[r]}
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[13px] text-primary hover:bg-sunken">
              <span className={cn("h-1.5 w-1.5 rounded-full", r === role ? "bg-accent" : "bg-[var(--border-strong)]")} />
              {ROLE_LABEL[r as Role]}
              {r === role && <Check size={14} strokeWidth={2} className="ml-auto text-accent" />}
            </button>
          ))}
          <div className="my-1 h-px bg-[var(--border-subtle)]" />
          <Link to="/docs" onClick={() => setOpen(false)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-primary hover:bg-sunken">
            <BookText size={15} strokeWidth={1.75} /> {t("nav.docs")}
          </Link>
          <Link to="/guide" onClick={() => setOpen(false)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-primary hover:bg-sunken">
            <BookOpen size={15} strokeWidth={1.75} /> {t("nav.guide")}
          </Link>
          <button onClick={() => { onSettings(); setOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-primary hover:bg-sunken">
            {t("nav.settings")}
          </button>
          <button onClick={() => { setOpen(false); logout(); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[var(--danger-text)] hover:bg-[var(--danger-bg)]">
            <LogOut size={15} strokeWidth={1.75} /> {t("topbar.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

function useOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [ref, onOutside]);
}
