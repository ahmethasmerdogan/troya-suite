import { useState } from "react";
import { LogIn, ShieldCheck, GitBranch, Radar, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useUI } from "@/store/ui";
import { DEMO_USERS, userById, type DemoUser } from "@/domain/users";
import { ROLE_LABEL, ROLE_DESC } from "@/domain/auth";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Giriş ekranı v2 — AppShell auth gate'i tarafından (user yokken) render edilir.
// Sol: yapısal lacivert kabuk paneli (rota çizgisi + özellikler + metrik şeridi).
// Sağ: kart içinde form + hızlı test kullanıcıları. e2e metinleri sabit.
export function Login() {
  const login = useUI((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const submit = (user: DemoUser) => {
    setError(null);
    setPending(user.id);
    // Mock auth gecikmesi — gerçekte OIDC token akışı.
    setTimeout(() => login(user), 450);
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = userById(username.trim().toLowerCase());
    if (!u) {
      setError("Kullanıcı bulunamadı. Aşağıdaki test kullanıcılarından biriyle hızlı giriş yapabilirsiniz.");
      return;
    }
    submit(u);
  };

  return (
    <div className="flex min-h-screen bg-page">
      {/* Sol yapısal panel — lg+ */}
      <aside className="shell-panel relative hidden w-[46%] max-w-2xl flex-col justify-between overflow-hidden p-10 text-[var(--shell-text)] lg:flex xl:p-14">
        {/* dekor: rota yayı IST→dünya */}
        <svg className="pointer-events-none absolute inset-x-0 bottom-24 h-64 w-full opacity-30" viewBox="0 0 600 240" fill="none" aria-hidden>
          <path d="M20 220 C 150 40, 420 30, 580 120" stroke="var(--shell-dim)" strokeWidth="1.25" strokeDasharray="3 7" />
          <circle cx="20" cy="220" r="4" fill="var(--accent)" />
          <circle cx="580" cy="120" r="4" fill="var(--shell-dim)" />
          <g transform="translate(300 66) rotate(12)">
            <path d="M0 8 L26 0 L8 12 L12 22 L6 16 L-4 20 Z" fill="var(--shell-text)" opacity="0.85" />
          </g>
        </svg>

        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.22)]">
            <BrandMark size={26} variant="plain" />
          </span>
          <div>
            <div className="text-[17px] font-semibold tracking-tight">Troya Suite</div>
            <div className="text-[12px] text-[var(--shell-dim)]">Modern Biletleme Platformu</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--shell-dim)]">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            PSS · Elektronik Biletleme
          </div>
          <h1 className="text-[34px] font-semibold leading-[1.12] tracking-tight xl:text-[40px]">
            Biletleme operasyonunun
            <br />
            tek konsolu.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--shell-dim)]">
            Bilet kesiminden EMD'ye, exchange/refund'dan interline mesajlaşmaya —
            IATA standartlarına sadık, tıklama-tabanlı arayüz.
          </p>
          <ul className="mt-8 flex flex-col gap-3 text-[14px]">
            <Feature icon={ShieldCheck} text="Rol bazlı yetki · idempotent para işlemleri" />
            <Feature icon={GitBranch} text="Event-sourced kupon yaşam döngüsü & canlı timeline" />
            <Feature icon={Radar} text="Rezervasyon, biletleme, check-in ve HUB operasyonu tek akışta" />
          </ul>
        </div>

        {/* metrik şeridi */}
        <div className="relative">
          <div className="grid grid-cols-3 divide-x divide-[var(--shell-border)] rounded-lg border border-[var(--shell-border)] bg-[var(--shell-surface)]">
            <Metric value="17" label="Kupon statüsü (FSM)" />
            <Metric value="Ch 1–15" label="IATA Handbook kapsamı" />
            <Metric value="TR / EN" label="Çift dilli arayüz" />
          </div>
          <div className="mt-6 text-[12px] text-[var(--shell-dim)]">© 2026 Troya · IATA Ticketing Handbook'a dayalı prototip</div>
        </div>
      </aside>

      {/* Sağ: giriş formu */}
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* Mobil marka */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-accent">
              <BrandMark size={24} variant="onRed" />
            </span>
            <div>
              <div className="text-[16px] font-semibold tracking-tight text-primary">Troya Suite</div>
              <div className="text-[12px] text-tertiary">Modern Biletleme Platformu</div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border-subtle)] bg-surface p-6 shadow-sm sm:p-8">
            <h2 className="text-[22px] font-semibold tracking-tight text-primary">Giriş yap</h2>
            <p className="mt-1 text-[14px] text-secondary">Kurumsal hesabınızla devam edin.</p>

            <form onSubmit={onFormSubmit} className="mt-6 flex flex-col gap-4">
              <Field label="Kullanıcı adı" htmlFor="username">
                <Input
                  id="username"
                  placeholder="örn. a.erdogan"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(null); }}
                />
              </Field>
              <Field label="Parola" htmlFor="password">
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-tertiary hover:bg-sunken hover:text-secondary"
                    aria-label={showPw ? "Parolayı gizle" : "Parolayı göster"}
                  >
                    {showPw ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                  </button>
                </div>
              </Field>

              {error && (
                <div className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[13px] text-[var(--danger-text)]">
                  {error}
                </div>
              )}

              <Button type="submit" size="lg" className="mt-1 w-full" disabled={!!pending}>
                <LogIn size={16} strokeWidth={2} /> {pending ? "Giriş yapılıyor…" : "Giriş Yap"}
              </Button>
            </form>
          </div>

          {/* Ayraç */}
          <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.08em] text-tertiary">
            <span className="h-px flex-1 bg-[var(--border-default)]" />
            Hızlı giriş · test kullanıcıları
            <span className="h-px flex-1 bg-[var(--border-default)]" />
          </div>

          {/* Test kullanıcıları — her rol için bir kart */}
          <div className="flex flex-col gap-2">
            {DEMO_USERS.map((u, i) => (
              <button
                key={u.id}
                onClick={() => submit(u)}
                disabled={!!pending}
                style={{ animationDelay: `${i * 45}ms` }}
                className={cn(
                  "list-in group flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2.5 text-left shadow-xs transition-all hover:border-[var(--border-strong)] hover:shadow-sm disabled:opacity-60",
                  pending === u.id && "border-accent ring-[3px] ring-[var(--accent-ring)]",
                )}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--shell-bg)] text-[12px] font-semibold text-white">
                  {u.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-primary">{u.name}</span>
                    <span className="shrink-0 rounded-pill bg-sunken px-1.5 py-0.5 text-[10px] font-medium text-secondary">{ROLE_LABEL[u.role]}</span>
                  </div>
                  <div className="truncate text-[12px] text-tertiary">{ROLE_DESC[u.role]}</div>
                </div>
                <ArrowRight size={15} strokeWidth={2} className="shrink-0 text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </button>
            ))}
          </div>

          <p className="mt-5 text-center text-[12px] text-tertiary">
            Demo ortamı — parola gerekmez, herhangi bir test kullanıcısıyla giriş yapın.
          </p>
        </div>
      </main>
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-[var(--shell-border)] bg-[var(--shell-surface)]">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      {text}
    </li>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-4 py-3">
      <div className="font-mono text-[16px] font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-[10.5px] leading-tight text-[var(--shell-dim)]">{label}</div>
    </div>
  );
}
