import { create } from "zustand";
import type { Role } from "@/domain/auth";
import { userById, type DemoUser } from "@/domain/users";

export type Lang = "tr" | "en";
export type Theme = "light" | "dark" | "system";

const LANG_KEY = "troya.lang";
const THEME_KEY = "troya.theme";
const ROLE_KEY = "troya.role";
const USER_KEY = "troya.user"; // giriş yapan kullanıcının id'si

function initialUser(): DemoUser | null {
  if (typeof localStorage === "undefined") return null;
  const id = localStorage.getItem(USER_KEY);
  return id ? userById(id) ?? null : null;
}

function initialRole(): Role {
  if (typeof localStorage !== "undefined") {
    const v = localStorage.getItem(ROLE_KEY);
    if (v === "staff" || v === "supervisor" || v === "chief" || v === "manager" || v === "admin") return v;
  }
  return "admin";
}

function initialLang(): Lang {
  if (typeof localStorage !== "undefined") {
    const v = localStorage.getItem(LANG_KEY);
    if (v === "tr" || v === "en") return v;
  }
  return "tr";
}

function initialTheme(): Theme {
  if (typeof localStorage !== "undefined") {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  }
  return "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const dark = theme === "dark" || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", !!dark);
}

interface UIState {
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
  recentTickets: string[]; // son açılan bilet numaraları
  pushRecent: (ticketNumber: string) => void;
  recentSearches: string[];
  pushSearch: (term: string) => void;
  lang: Lang;
  setLang: (lang: Lang) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  mobileNav: boolean;
  setMobileNav: (open: boolean) => void;
  role: Role;
  setRole: (role: Role) => void;
  user: DemoUser | null; // giriş yapan kullanıcı (null → login ekranı)
  login: (user: DemoUser) => void;
  logout: () => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;
}

export const useUI = create<UIState>((set) => ({
  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),
  recentTickets: [],
  pushRecent: (ticketNumber) =>
    set((s) => ({
      recentTickets: [ticketNumber, ...s.recentTickets.filter((t) => t !== ticketNumber)].slice(0, 6),
    })),
  recentSearches: [],
  pushSearch: (term) =>
    set((s) => ({
      recentSearches: term.trim() ? [term.trim(), ...s.recentSearches.filter((x) => x !== term.trim())].slice(0, 5) : s.recentSearches,
    })),
  lang: initialLang(),
  setLang: (lang) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(LANG_KEY, lang);
    set({ lang });
  },
  theme: initialTheme(),
  setTheme: (theme) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },
  mobileNav: false,
  setMobileNav: (mobileNav) => set({ mobileNav }),
  role: initialUser()?.role ?? initialRole(),
  setRole: (role) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(ROLE_KEY, role);
    set({ role });
  },
  user: initialUser(),
  login: (user) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(USER_KEY, user.id);
      localStorage.setItem(ROLE_KEY, user.role);
    }
    set({ user, role: user.role });
  },
  logout: () => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(USER_KEY);
    set({ user: null });
  },
  chatOpen: false,
  setChatOpen: (chatOpen) => set({ chatOpen }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
}));

// İlk yüklemede temayı uygula.
applyTheme(initialTheme());
