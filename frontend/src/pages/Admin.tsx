import { useParams, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Users, ScrollText, Settings as SettingsIcon, Check, ShieldAlert, ArrowUpRight, ShieldCheck, Lock, Minus } from "lucide-react";
import { useUI, type Lang } from "@/store/ui";
import { useT } from "@/i18n";
import { usePerm } from "@/lib/usePerm";
import {
  ROLE_ORDER, ROLE_LABEL, ROLE_DESC, PERMISSION_LABEL, permissionsFor, can as canDo,
  type Role, type Permission,
} from "@/domain/auth";
import { listRevenueAlerts } from "@/domain/api";
import type { RevenueAlert, RevenueSeverity } from "@/domain/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatDateTime } from "@/lib/utils";

type Section = "settings" | "users" | "logs" | "revenue" | "roles";

const SECTION_PERM: Record<Section, Permission | null> = {
  settings: null, // kişisel tercih + istasyon — herkese açık
  revenue: "revenue.view",
  roles: "admin.roles",
  users: "admin.users",
  logs: "admin.users",
};

const ROLE_PILL: Record<Role, string> = {
  staff: "bg-sunken text-secondary",
  supervisor: "bg-[var(--info-bg)] text-[var(--info-text)]",
  chief: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  manager: "bg-accent-soft text-accent",
  admin: "bg-[var(--danger-bg)] text-[var(--danger-text)]",
};

interface UserRow { name: string; email: string; role: Role; station: string; status: "active" | "passive"; lastActive: string; }
const MOCK_USERS: UserRow[] = [
  { name: "Ahmet Erdoğan", email: "a.erdogan", role: "admin", station: "IST-CTR", status: "active", lastActive: "2026-06-17T09:40:00Z" },
  { name: "Elif Yılmaz", email: "e.yilmaz", role: "chief", station: "IST-CTR", status: "active", lastActive: "2026-06-17T09:12:00Z" },
  { name: "Mert Demir", email: "m.demir", role: "supervisor", station: "IST-CTR", status: "active", lastActive: "2026-06-17T08:55:00Z" },
  { name: "Zeynep Kaya", email: "z.kaya", role: "manager", station: "ESB", status: "active", lastActive: "2026-06-16T18:20:00Z" },
  { name: "Can Aydın", email: "c.aydin", role: "staff", station: "AYT", status: "active", lastActive: "2026-06-17T07:30:00Z" },
  { name: "Selin Arslan", email: "s.arslan", role: "staff", station: "SAW", status: "passive", lastActive: "2026-06-10T16:05:00Z" },
];

interface LogRow { at: string; actor: string; role: Role; action: string; ref: string; result: "ok" | "denied"; ip: string; }
const MOCK_LOGS: LogRow[] = [
  { at: "2026-06-17T09:40:00Z", actor: "a.erdogan", role: "admin", action: "IssueTicket", ref: "2351002003000", result: "ok", ip: "10.12.4.18" },
  { at: "2026-06-17T09:31:00Z", actor: "m.demir", role: "supervisor", action: "RefundCoupon", ref: "2359988776655", result: "ok", ip: "10.12.4.22" },
  { at: "2026-06-17T09:05:00Z", actor: "c.aydin", role: "staff", action: "VoidTicket (reddedildi)", ref: "2351234567890", result: "denied", ip: "10.40.8.7" },
  { at: "2026-06-17T08:58:00Z", actor: "e.yilmaz", role: "chief", action: "IrropReroute", ref: "2359988776655", result: "ok", ip: "10.12.4.31" },
  { at: "2026-06-17T08:40:00Z", actor: "system", role: "admin", action: "ControlGranted (LH)", ref: "2359988776655", result: "ok", ip: "—" },
  { at: "2026-06-16T18:20:00Z", actor: "z.kaya", role: "manager", action: "UpdateUser (c.aydin)", ref: "USR-005", result: "ok", ip: "10.30.2.9" },
  { at: "2026-06-16T17:02:00Z", actor: "m.demir", role: "supervisor", action: "ExchangeTicket", ref: "2355544332211", result: "ok", ip: "10.12.4.22" },
  { at: "2026-06-16T16:15:00Z", actor: "c.aydin", role: "staff", action: "AddEmd (0CC)", ref: "2351234567890", result: "ok", ip: "10.40.8.7" },
];

export function Admin() {
  const { section } = useParams({ from: "/admin/$section" });
  const navigate = useNavigate();
  const t = useT();
  const { can } = usePerm();
  const active = (section as Section) ?? "settings";

  const allTabs: { id: Section; label: string; icon: typeof Users }[] = [
    { id: "revenue", label: t("nav.revenue"), icon: ShieldAlert },
    { id: "roles", label: t("nav.roles"), icon: ShieldCheck },
    { id: "users", label: t("nav.users"), icon: Users },
    { id: "logs", label: t("nav.logs"), icon: ScrollText },
    { id: "settings", label: t("nav.settings"), icon: SettingsIcon },
  ];
  const tabs = allTabs.filter((tb) => { const p = SECTION_PERM[tb.id]; return !p || can(p); });

  const sectionPerm = SECTION_PERM[active];
  const allowed = !sectionPerm || can(sectionPerm);

  return (
    <div>
      <PageHeader title={t("nav.section.admin")} description="Kullanıcılar, roller & yetkiler, denetim logları ve sistem ayarları." />
      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)]">
        {tabs.map((tb) => (
          <button key={tb.id} role="tab" aria-selected={active === tb.id} onClick={() => navigate({ to: "/admin/$section", params: { section: tb.id } })}
            className={cn("flex flex-shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors", active === tb.id ? "border-accent text-primary" : "border-transparent text-secondary hover:text-primary")}>
            <tb.icon size={15} strokeWidth={1.75} /> {tb.label}
          </button>
        ))}
      </div>

      {!allowed ? (
        <EmptyState icon={Lock} title="Yetkiniz yok" hint="Bu bölüm için gerekli role sahip değilsiniz. Sağ üstten (demo) rolü yükseltebilirsiniz." />
      ) : (
        <>
          {active === "settings" && <SettingsTab />}
          {active === "users" && <UsersTab />}
          {active === "logs" && <LogsTab />}
          {active === "revenue" && <RevenueTab />}
          {active === "roles" && <RolesTab />}
        </>
      )}
    </div>
  );
}

/* ===================== Roller & Yetkiler ===================== */
function RolesTab() {
  const { role: myRole } = usePerm();
  const perms = Object.keys(PERMISSION_LABEL) as Permission[];
  return (
    <div className="flex flex-col gap-5">
      {/* rol kartları */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ROLE_ORDER.map((r) => (
          <div key={r} className={cn("rounded-lg border bg-surface p-3", r === myRole ? "border-accent ring-1 ring-accent/30" : "border-[var(--border-default)]")}>
            <div className="flex items-center justify-between">
              <span className={cn("rounded-pill px-2 py-0.5 text-[12px] font-semibold", ROLE_PILL[r])}>{ROLE_LABEL[r]}</span>
              {r === myRole && <span className="text-[10px] font-medium text-accent">siz</span>}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-tertiary">{ROLE_DESC[r]}</p>
            <div className="mt-2 text-[11px] text-secondary"><span className="font-mono font-semibold text-primary">{permissionsFor(r).length}</span> yetki</div>
          </div>
        ))}
      </div>

      {/* yetki matrisi */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">Yetki</th>
                {ROLE_ORDER.map((r) => (
                  <th key={r} className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">{ROLE_LABEL[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perms.map((p) => (
                <tr key={p} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-surface-alt">
                  <td className="px-4 py-2.5 text-primary">{PERMISSION_LABEL[p]}</td>
                  {ROLE_ORDER.map((r) => (
                    <td key={r} className="px-3 py-2.5 text-center">
                      {canDo(r, p)
                        ? <Check size={16} strokeWidth={2.5} className="mx-auto text-[var(--success-text)]" />
                        : <Minus size={14} strokeWidth={2} className="mx-auto text-disabled" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ===================== Ayarlar ===================== */
function SettingsTab() {
  const { lang, setLang, theme, setTheme } = useUI();
  const t = useT();
  const langs: { id: Lang; label: string }[] = [{ id: "tr", label: "Türkçe" }, { id: "en", label: "English" }];
  const themes = [
    { id: "light" as const, label: t("settings.theme.light") },
    { id: "dark" as const, label: t("settings.theme.dark") },
    { id: "system" as const, label: t("settings.theme.system") },
  ];
  return (
    <Card><CardContent className="flex max-w-lg flex-col gap-5 pt-6">
      <div>
        <div className="mb-2 text-[13px] font-medium text-secondary">{t("settings.language")}</div>
        <div className="flex gap-2">
          {langs.map((l) => (
            <button key={l.id} onClick={() => setLang(l.id)} className={cn("flex items-center gap-2 rounded border px-3 py-2 text-sm", lang === l.id ? "border-accent bg-accent-soft text-accent" : "border-border-default text-secondary hover:bg-sunken")}>
              {l.label} {lang === l.id && <Check size={14} strokeWidth={2} />}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[13px] font-medium text-secondary">{t("settings.station")}</div>
        <div className="inline-flex items-center gap-2 rounded bg-sunken px-3 py-2 font-mono text-sm text-primary">IST-CTR · TK</div>
      </div>
      <div>
        <div className="mb-2 text-[13px] font-medium text-secondary">{t("settings.theme")}</div>
        <div className="flex gap-2">
          {themes.map((th) => (
            <button key={th.id} onClick={() => setTheme(th.id)} className={cn("flex items-center gap-2 rounded border px-3 py-2 text-sm", theme === th.id ? "border-accent bg-accent-soft text-accent" : "border-border-default text-secondary hover:bg-sunken")}>
              {th.label} {theme === th.id && <Check size={14} strokeWidth={2} />}
            </button>
          ))}
        </div>
      </div>
    </CardContent></Card>
  );
}

/* ===================== Kullanıcılar ===================== */
const userCol = createColumnHelper<UserRow>();
const USER_COLUMNS = [
  userCol.accessor("name", { header: "Ad", cell: (c) => <span className="font-medium text-primary">{c.getValue()}</span> }),
  userCol.accessor("email", { header: "Kullanıcı", cell: (c) => <span className="font-mono text-[12px] text-secondary">{c.getValue()}</span> }),
  userCol.accessor("role", { header: "Rol", cell: (c) => <span className={cn("rounded-pill px-2 py-0.5 text-[11px] font-semibold", ROLE_PILL[c.getValue()])}>{ROLE_LABEL[c.getValue()]}</span> }),
  userCol.accessor("station", { header: "İstasyon", cell: (c) => <span className="font-mono text-secondary">{c.getValue()}</span> }),
  userCol.accessor("lastActive", { header: "Son aktif", cell: (c) => <span className="font-mono text-[12px] text-tertiary">{formatDateTime(c.getValue())}</span> }),
  userCol.accessor("status", { header: "Durum", enableSorting: false, cell: (c) => <span className={cn("pill", c.getValue() === "active" ? "pill--success" : "pill--neutral")}>{c.getValue() === "active" ? "Aktif" : "Pasif"}</span> }),
] as ColumnDef<UserRow, unknown>[];
function UsersTab() { return <DataTable data={MOCK_USERS} columns={USER_COLUMNS} searchable searchPlaceholder="Kullanıcı / istasyon ara…" exportName="kullanicilar" />; }

/* ===================== Loglar ===================== */
const logCol = createColumnHelper<LogRow>();
const LOG_COLUMNS = [
  logCol.accessor("at", { header: "Zaman", cell: (c) => <span className="font-mono text-[12px] text-tertiary">{formatDateTime(c.getValue())}</span> }),
  logCol.accessor("actor", { header: "Kullanıcı", cell: (c) => <span className="font-mono text-secondary">{c.getValue()}</span> }),
  logCol.accessor("role", { header: "Rol", cell: (c) => <span className={cn("rounded-pill px-2 py-0.5 text-[10px] font-semibold", ROLE_PILL[c.getValue()])}>{ROLE_LABEL[c.getValue()]}</span> }),
  logCol.accessor("action", { header: "Aksiyon", cell: (c) => <span className="text-primary">{c.getValue()}</span> }),
  logCol.accessor("ref", { header: "Referans", cell: (c) => <span className="font-mono text-[12px] text-secondary">{c.getValue()}</span> }),
  logCol.accessor("result", { header: "Sonuç", enableSorting: false, cell: (c) => <span className={cn("pill", c.getValue() === "ok" ? "pill--success" : "pill--danger")}>{c.getValue() === "ok" ? "OK" : "Reddedildi"}</span> }),
  logCol.accessor("ip", { header: "IP", cell: (c) => <span className="font-mono text-[12px] text-tertiary">{c.getValue()}</span> }),
] as ColumnDef<LogRow, unknown>[];
function LogsTab() { return <DataTable data={MOCK_LOGS} columns={LOG_COLUMNS} searchable searchPlaceholder="Log ara…" exportName="loglar" pageSize={10} />; }

/* ===================== Gelir Koruma ===================== */
const SEVERITY: Record<RevenueSeverity, { cls: string; label: string }> = {
  high: { cls: "pill--danger", label: "Yüksek" },
  medium: { cls: "pill--warning", label: "Orta" },
  low: { cls: "pill--neutral", label: "Düşük" },
};
const ALERT_KIND: Record<RevenueAlert["kind"], string> = {
  out_of_sequence: "Sıra dışı kullanım",
  duplicate: "Mükerrer kesim",
  status_mismatch: "Statü uyuşmazlığı",
  control_overdue: "Control gecikmesi",
};
function RevenueTab() {
  const { data: alerts, isLoading } = useQuery({ queryKey: ["revenueAlerts"], queryFn: listRevenueAlerts });
  if (isLoading) return <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  if (!alerts?.length) return <Card><CardContent className="py-12 text-center text-sm text-secondary">Anomali yok — temiz.</CardContent></Card>;
  const high = alerts.filter((a) => a.severity === "high").length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-surface-alt px-3 py-2.5 text-[13px] text-secondary">
        <ShieldAlert size={16} strokeWidth={1.75} className="text-accent" />
        Toplam <b className="text-primary">{alerts.length}</b> anomali bayrağı, <b className="text-[var(--danger-text)]">{high}</b> yüksek öncelikli. Coupon sequence + control lease + statü senkron kontrolleri.
      </div>
      {alerts.map((a) => {
        const sev = SEVERITY[a.severity];
        return (
          <Card key={a.id}>
            <CardContent className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <span className={cn("pill", sev.cls)}>{sev.label}</span>
                <span className="text-[13px] font-medium text-primary">{ALERT_KIND[a.kind]}</span>
              </div>
              <div className="flex-1 text-[13px] text-secondary sm:px-4">{a.detail}</div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-tertiary">{formatDateTime(a.detectedAt)}</span>
                <Link to="/tickets/$ticketNumber" params={{ ticketNumber: a.ticketNumber }} search={{}} className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] bg-surface px-2 py-1 font-mono text-[11px] text-accent transition-colors hover:bg-sunken">
                  {a.ticketNumber} <ArrowUpRight size={12} strokeWidth={2} />
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
