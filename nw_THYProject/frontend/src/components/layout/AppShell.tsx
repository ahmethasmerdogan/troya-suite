import { useEffect } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Topbar } from "./Topbar";
import { AnnouncementBar } from "./Notices";
import { MobileNav } from "./MobileNav";
import { FullView } from "./views";
import { isSplit } from "./shape";
import { CommandPalette } from "@/components/CommandPalette";
import { ToastHost } from "@/components/ui/toast";
import { Login } from "@/pages/Login";
import { useUI } from "@/store/ui";
import { useChat } from "@/store/chat";

/**
 * Uygulama kabuğu.
 *
 *   ┌────┬──────────────────────────────────────────┐
 *   │ray │ topbar — modül menüsü · ⌘K · hesap        │
 *   │ 56 ├──────────────────────────────────────────┤
 *   │    │ gövde — şekli ROTA belirler (split/full)  │
 *   └────┴──────────────────────────────────────────┘
 *
 * Kabuk dolgu ya da kaydırma dayatmaz. Bölünmüş sayfalar kendi
 * panellerini kurar; geri kalan her şey tek sütun akar.
 */
export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useUI((s) => s.user);
  const split = isSplit(pathname);

  // Chat oturumu — giriş yapan kullanıcı presence yayınlar.
  useEffect(() => {
    useChat.getState().bind(user?.id ?? null, user?.name);
  }, [user]);

  // Giriş yapılmadıysa tüm rotalar yerine giriş ekranı.
  if (!user) return <Login />;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <Topbar />
      <AnnouncementBar />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {split ? <Outlet /> : <FullView key={pathname}><Outlet /></FullView>}
      </main>
      <MobileNav />
      <CommandPalette />
      <ToastHost />
    </div>
  );
}
