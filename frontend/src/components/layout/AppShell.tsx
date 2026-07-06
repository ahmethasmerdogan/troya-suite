import { useEffect } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Topbar } from "./Topbar";
import { Rail } from "./Rail";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "@/components/CommandPalette";
import { ShortcutsHelp } from "@/components/ShortcutsHelp";
import { Onboarding } from "@/components/Onboarding";
import { ToastViewport } from "@/components/ui/toast";
import { Login } from "@/pages/Login";
import { useUI } from "@/store/ui";
import { useChat } from "@/store/chat";

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useUI((s) => s.user);

  // Chat oturumu — giriş yapan kullanıcı presence kalp atışı yayınlar (pencereler arası gerçek chat).
  useEffect(() => {
    useChat.getState().bind(user?.id ?? null, user?.name);
  }, [user]);

  // Auth gate — giriş yapılmadıysa tüm route'lar yerine Login. Backend gelince OIDC redirect olur.
  if (!user) return <Login />;

  return (
    <div className="flex h-screen bg-page">
      {/* Yapısal lacivert modül rayı (lg+) */}
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div key={pathname} className="page-in mx-auto max-w-content px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <MobileNav />
      <CommandPalette />
      <ShortcutsHelp />
      <Onboarding />
      <ToastViewport />
    </div>
  );
}
