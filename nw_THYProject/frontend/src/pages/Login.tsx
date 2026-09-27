import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LogIn } from "lucide-react";
import { useUI } from "@/store/ui";
import { type DemoUser } from "@/domain/users";
import { useUsers } from "@/store/users";
import { roleDesc, roleLabel } from "@/domain/auth";
import { BrandMark } from "@/components/BrandMark";
import { Field, Input } from "@/components/ui/core";
import { Alert, Button, Card, OutlineBadge } from "@/ui";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * Giriş — uygulamanın tek dolu marka yüzeyi.
 *
 * Kabuk nötrdür; marka burada, ön kapıda konuşur. Sol panel derin THY
 * kırmızısı üzerine ince ızgara; sağ panel sakin bir form.
 */
const PANEL = [
  "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)",
  "linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
  "linear-gradient(155deg, #d21214 0%, #a30709 46%, #5e0305 100%)",
].join(", ");

export function Login() {
  const t = useT();
  const login = useUI((s) => s.login);
  const lang = useUI((s) => s.lang);
  const users = useUsers((s) => s.users);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const submit = (u: DemoUser) => {
    // Devre dışı personel giriş yapamaz — yetkilendirmenin en basit kuralı
    // bile arayüzde zorlanmalı (gerçekte bu kontrol OIDC tarafındadır).
    if (u.status === "suspended") {
      setError(t("shell.login.suspended", { name: u.name }));
      return;
    }
    setError(null);
    setPending(u.id);
    setTimeout(() => login(u), 400); // mock auth gecikmesi — gerçekte OIDC
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = users.find((x) => x.id === username.trim().toLowerCase());
    if (!u) {
      setError(t("shell.login.userNotFound"));
      return;
    }
    submit(u);
  };

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside
        className="relative hidden w-[46%] max-w-2xl flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14"
        style={{ backgroundImage: PANEL, backgroundSize: "34px 34px, 34px 34px, cover" }}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-white">
            <BrandMark size={26} variant="bare" className="text-[#c70a0c]" />
          </span>
          <div>
            <div className="text-[17px] font-semibold tracking-tight">{t("brand.suite")}</div>
            <div className="text-[12px] text-white/70">{t("shell.login.tagline")}</div>
          </div>
        </div>

        <div className="max-w-md">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> {t("shell.login.badge")}
          </span>
          <h1 className="text-[34px] font-semibold leading-[1.12] tracking-tight xl:text-[40px]">
            {t("shell.login.headline1")}<br />{t("shell.login.headline2")}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/75">
            {t("shell.login.lede")}
          </p>
        </div>

        <div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["17", t("shell.login.stat.status")],
              ["Ch 1–15", t("shell.login.stat.handbook")],
              ["TR / EN", t("shell.login.stat.bilingual")],
            ].map(([v, l]) => (
              <div key={l} className="rounded-[14px] border border-white/20 bg-white/10 px-4 py-3">
                <div className="num text-[16px] font-semibold tracking-tight">{v}</div>
                <div className="mt-0.5 text-[10.5px] leading-tight text-white/65">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-[12px] text-white/60">{t("shell.login.copyright")}</div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark size={36} />
            <div>
              <div className="text-[16px] font-semibold tracking-tight text-ink">{t("brand.suite")}</div>
              <div className="text-[12px] text-ink-3">{t("shell.login.tagline")}</div>
            </div>
          </div>

          <Card className="p-6 sm:p-8">
            <h2 className="text-[22px] font-semibold tracking-tight text-ink">{t("shell.login.title")}</h2>
            <p className="mt-1 text-[14px] text-ink-2">{t("shell.login.subtitle")}</p>

            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
              <Field label={t("shell.login.username")} htmlFor="username">
                <Input id="username" placeholder={t("shell.login.usernamePlaceholder")} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
              </Field>
              <Field label={t("shell.login.password")} htmlFor="password">
                <div className="relative">
                  <Input id="password" type={showPw ? "text" : "password"} placeholder="••••••••" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={t("shell.login.showPassword")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink">
                    {showPw ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                  </button>
                </div>
              </Field>
              {error && <Alert tone="danger" title={t("shell.login.failed")}>{error}</Alert>}
              <Button type="submit" variant="green" size="lg" disabled={!!pending} iconLeft={<LogIn size={16} strokeWidth={1.75} />}>{t("shell.login.submit")}</Button>
            </form>
          </Card>

          <div className="mb-3 mt-7 flex items-center gap-3">
            <span className="microlabel flex-shrink-0">{t("shell.login.quick")}</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <div className="anim-stagger flex flex-col gap-2">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => submit(u)}
                disabled={!!pending}
                className={cn(
                  "group flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2.5 text-left transition-colors hover:border-brand disabled:opacity-60",
                  pending === u.id && "border-brand ring-[3px] ring-[var(--brand-ring)]",
                )}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-semibold text-white">{u.initials}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-ink">{u.name}</span>
                    <OutlineBadge tone="gray">{roleLabel(u.role, lang)}</OutlineBadge>
                  </span>
                  <span className="block truncate text-[12px] text-ink-3">{roleDesc(u.role, lang)}</span>
                </span>
                <ArrowRight size={15} strokeWidth={2} className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
              </button>
            ))}
          </div>

          <p className="mt-5 text-center text-[12px] text-ink-3">
            {t("shell.login.demoNote")}
          </p>
        </div>
      </main>
    </div>
  );
}
