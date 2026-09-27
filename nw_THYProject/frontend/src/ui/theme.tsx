import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "system" | "light" | "dark";

/* Typeface presets — Geist is the system default. */
export type FontId = "geist" | "inter" | "system";

export const FONTS: Record<
  FontId,
  { label: string; note: string; stack: string }
> = {
  geist: {
    label: "Geist",
    note: "Vercel · system default",
    stack:
      '"Geist Variable", "Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  inter: {
    label: "Inter",
    note: "Rasmus Andersson",
    stack:
      '"Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  system: {
    label: "System",
    note: "SF Pro / Segoe UI",
    stack:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
  },
};

type ThemeCtx = {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (m: ThemeMode) => void;
  font: FontId;
  setFont: (f: FontId) => void;
};

const Ctx = createContext<ThemeCtx>({
  mode: "system",
  resolved: "light",
  setMode: () => {},
  font: "geist",
  setFont: () => {},
});

const STORAGE_KEY = "hashui-theme";
const FONT_KEY = "hashui-font";

function systemDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const s = localStorage.getItem(STORAGE_KEY);
    return s === "light" || s === "dark" || s === "system" ? s : "system";
  });
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );
  const [font, setFontState] = useState<FontId>(() => {
    const f = localStorage.getItem(FONT_KEY);
    return f === "inter" || f === "system" || f === "geist" ? f : "geist";
  });

  const apply = useCallback((m: ThemeMode) => {
    const dark = m === "dark" || (m === "system" && systemDark());
    document.documentElement.classList.toggle("dark", dark);
    setResolved(dark ? "dark" : "light");
  }, []);

  const setMode = useCallback(
    (m: ThemeMode) => {
      setModeState(m);
      localStorage.setItem(STORAGE_KEY, m);
      apply(m);
    },
    [apply],
  );

  const setFont = useCallback((f: FontId) => {
    setFontState(f);
    localStorage.setItem(FONT_KEY, f);
    document.documentElement.style.setProperty(
      "--font-sans-pick",
      FONTS[f].stack,
    );
  }, []);

  useEffect(() => {
    apply(mode);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(STORAGE_KEY) ?? "system") === "system")
        apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [apply, mode]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--font-sans-pick",
      FONTS[font].stack,
    );
  }, [font]);

  return (
    <Ctx.Provider value={{ mode, resolved, setMode, font, setFont }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  return useContext(Ctx);
}
