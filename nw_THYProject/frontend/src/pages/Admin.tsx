import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { listRevenueAlerts } from "@/domain/api";
import { DEMO_USERS } from "@/domain/users";
import {
  PERMISSION_LABEL, ROLE_DESC, ROLE_LABEL, ROLE_ORDER, can, permissionsFor, type Permission, type Role,
} from "@/domain/auth";
import { useUI } from "@/store/ui";
import { usePerm } from "@/lib/usePerm";
import { PageTitle, Panel, PanelHead, PanelBody, Empty, Meta, MetaGrid } from "@/components/ui/surface";
import { Pill, type Tone } from "@/components/ui/pill";
import { Banner } from "@/components/ui/banner";
import { formatDateTime, cn } from "@/lib/utils";

/**
 * Yönetim — roller, kullanıcılar, denetim kaydı, gelir koruma, ayarlar.
 * Bölümler tek rotadan (`/admin/$section`) beslenir; yetkisi olmayan bölüm
 * kilitli görünür (gizlemek yerine göstermek, yeni personele öğretir).
 */
const SECTIONS: { id: string; label: string; perm?: Permission }[] = [
  { id: "roles", label: "Roller & Yetkiler", perm: "admin.roles" },
  { id: "users", label: "Kullanıcılar", perm: "admin.users" },
  { id: "logs", label: "Denetim Kaydı", perm: "admin.users" },
  { id: "revenue", label: "Gelir Koruma", perm: "revenue.view" },
  { id: "settings", label: "Ayarlar", perm: "admin.settings" },
];

const ALL_PERMS = Array.from(new Set(ROLE_ORDER.flatMap((r) => permissionsFor(r))));

export function Admin() {
  const { section } = useParams({ from: "/admin/$section" });
  const { can: may, lockHint } = usePerm();
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const allowed = !current.perm || may(current.perm);

  return (
    <>
      <PageTitle title="Yönetim" hint="Roller, kullanıcılar, denetim kaydı ve sistem ayarları." />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {SECTIONS.map((s) => {
          const ok = !s.perm || may(s.perm);
          return (
            <Link
              key={s.id}
              to="/admin/$section"
              params={{ section: s.id }}
              title={ok ? undefined : lockHint(s.perm!) ?? undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                s.id === current.id ? "bg-brand-wash text-brand" : ok ? "text-ink-2 hover:bg-sunken hover:text-ink" : "text-ink-4",
              )}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      {!allowed ? (
        <Banner kind="warning" title="Yetkiniz yok">
          Bu bölüm için gereken rol: {lockHint(current.perm!)}
        </Banner>
      ) : current.id === "roles" ? (
        <RoleMatrix />
      ) : current.id === "users" ? (
        <Users />
      ) : current.id === "logs" ? (
        <Logs />
      ) : current.id === "revenue" ? (
        <Revenue />
      ) : (
        <Settings />
      )}
    </>
  );
}

function RoleMatrix() {
  return (
    <Panel>
      <PanelHead title="Rol → yetki matrisi" hint="Yetkiler kümülatiftir: üst rol alt rolün her şeyini yapabilir." />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line bg-raised">
              <th className="microlabel border-r border-hair px-3 py-2 text-left">Yetki</th>
              {ROLE_ORDER.map((r) => (
                <th key={r} className="microlabel border-r border-hair px-3 py-2 text-center last:border-r-0" title={ROLE_DESC[r]}>
                  {ROLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PERMS.map((p) => (
              <tr key={p} className="border-b border-hair last:border-0">
                <td className="border-r border-hair px-3 py-2 text-[13px] text-ink">{PERMISSION_LABEL[p] ?? p}</td>
                {ROLE_ORDER.map((r) => (
                  <td key={r} className="border-r border-hair px-3 py-2 text-center last:border-r-0">
                    {can(r as Role, p)
                      ? <Check size={15} strokeWidth={2.5} className="mx-auto text-[var(--t-green-d)]" />
                      : <X size={15} strokeWidth={2} className="mx-auto text-ink-4" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Users() {
  return (
    <Panel>
      <PanelHead title="Kullanıcılar" hint={`${DEMO_USERS.length} kayıt · demo ortamı`} />
      <PanelBody className="pt-1">
        {DEMO_USERS.map((u) => (
          <div key={u.id} className="flex items-center gap-3 border-b border-hair py-3 last:border-0">
            <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-brand text-[12px] font-semibold text-white">{u.initials}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium text-ink">{u.name}</div>
              <div className="num text-[11.5px] text-ink-3">{u.id} · {u.location}</div>
            </div>
            <Pill tone="gray">{ROLE_LABEL[u.role]}</Pill>
            <Pill tone="green">aktif</Pill>
          </div>
        ))}
      </PanelBody>
    </Panel>
  );
}

function Logs() {
  const rows = DEMO_USERS.flatMap((u, i) => [
    { at: new Date(Date.now() - (i + 1) * 36e5).toISOString(), who: u.name, role: u.role, act: "Bilet kesildi", ok: true, ip: `10.0.${i}.12` },
    { at: new Date(Date.now() - (i + 2) * 52e5).toISOString(), who: u.name, role: u.role, act: "Void denemesi", ok: i % 2 === 0, ip: `10.0.${i}.12` },
  ]);
  return (
    <Panel>
      <PanelHead title="Denetim kaydı" hint="Kim, ne zaman, ne yaptı — event store'dan türer." />
      <PanelBody className="pt-1">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-3 border-b border-hair py-2.5 last:border-0">
            <span className="num w-40 flex-shrink-0 text-[12px] text-ink-3">{formatDateTime(r.at)}</span>
            <span className="text-[13px] text-ink">{r.who}</span>
            <Pill tone="gray">{ROLE_LABEL[r.role]}</Pill>
            <span className="text-[13px] text-ink-2">{r.act}</span>
            <Pill tone={r.ok ? "green" : "red"}>{r.ok ? "başarılı" : "reddedildi"}</Pill>
            <span className="num ml-auto text-[11.5px] text-ink-3">{r.ip}</span>
          </div>
        ))}
      </PanelBody>
    </Panel>
  );
}

const SEV: Record<string, Tone> = { high: "red", medium: "amber", low: "gray" };

function Revenue() {
  const { data, isLoading } = useQuery({ queryKey: ["revenueAlerts"], queryFn: listRevenueAlerts });
  return (
    <Panel>
      <PanelHead title="Gelir koruma" hint="Sıra dışı kupon kullanımı, çift belge, statü uyuşmazlığı (Handbook 14.7)." />
      <PanelBody className="pt-1">
        {isLoading ? null : (data ?? []).length === 0 ? (
          <Empty title="Uyarı yok" hint="Şu an gelir koruma uyarısı bulunmuyor." />
        ) : (
          (data ?? []).map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 border-b border-hair py-3 last:border-0">
              <Pill tone={SEV[a.severity] ?? "gray"}>{a.severity}</Pill>
              <Link to="/tickets/$ticketNumber" params={{ ticketNumber: a.ticketNumber }} className="num text-[13px] font-medium text-brand hover:underline">
                {a.ticketNumber}
              </Link>
              <span className="min-w-0 flex-1 text-[13px] text-ink-2">{a.detail}</span>
              <span className="num text-[11.5px] text-ink-3">{formatDateTime(a.detectedAt)}</span>
            </div>
          ))
        )}
      </PanelBody>
    </Panel>
  );
}

function Settings() {
  const { theme, setTheme, lang, setLang, role } = useUI();
  return (
    <Panel>
      <PanelHead title="Ayarlar" hint="Bu ortamda oturum düzeyinde tutulur; gerçekte kullanıcı profiline yazılır." />
      <PanelBody className="flex flex-col gap-4">
        <MetaGrid>
          <Meta label="Tema" value={theme === "dark" ? "Koyu" : theme === "light" ? "Açık" : "Sistem"} />
          <Meta label="Dil" value={lang.toUpperCase()} mono />
          <Meta label="Rol" value={ROLE_LABEL[role]} />
          <Meta label="İstasyon" value="IST-CTR" mono />
        </MetaGrid>
        <div className="flex flex-wrap gap-2">
          {(["light", "dark", "system"] as const).map((x) => (
            <button key={x} onClick={() => setTheme(x)}
              className={cn("rounded-md border px-3 py-1.5 text-[13px] transition-colors",
                theme === x ? "border-brand bg-brand-wash text-brand" : "border-line text-ink-2 hover:bg-sunken")}>
              {x === "light" ? "Açık" : x === "dark" ? "Koyu" : "Sistem"}
            </button>
          ))}
          <span className="mx-1 w-px bg-line" />
          {(["tr", "en"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)}
              className={cn("rounded-md border px-3 py-1.5 text-[13px] uppercase transition-colors",
                lang === l ? "border-brand bg-brand-wash text-brand" : "border-line text-ink-2 hover:bg-sunken")}>
              {l}
            </button>
          ))}
        </div>
      </PanelBody>
    </Panel>
  );
}
