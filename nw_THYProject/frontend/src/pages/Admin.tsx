import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Check, UserPlus, X } from "lucide-react";
import { listRevenueAlerts, queryTransactions } from "@/domain/api";
import { UNITS, unitLabel, type DemoUser } from "@/domain/users";
import { useUsers, type NewUserInput } from "@/store/users";
import {
  ROLE_ORDER, can, permissionLabel, permissionsFor, roleDesc, roleLabel, type Permission, type Role,
} from "@/domain/auth";
import { useUI } from "@/store/ui";
import { usePerm } from "@/lib/usePerm";
import { useT, type Key } from "@/i18n";
import { PageTitle, Panel, PanelHead, PanelBody, Empty, Meta, MetaGrid } from "@/components/ui/surface";
import { Pill, type Tone } from "@/components/ui/pill";
import { StatusPill } from "@/components/domain/StatusPill";
import { Button, Field, Input, Select } from "@/components/ui/core";
import { Modal } from "@/components/ui/overlay";
import { Banner } from "@/components/ui/banner";
import { formatDateTime, cn } from "@/lib/utils";

/**
 * Yönetim — roller, kullanıcılar, denetim kaydı, gelir koruma, ayarlar.
 * Bölümler tek rotadan (`/admin/$section`) beslenir; yetkisi olmayan bölüm
 * kilitli görünür (gizlemek yerine göstermek, yeni personele öğretir).
 */
const SECTIONS: { id: string; label: Key; perm?: Permission }[] = [
  { id: "roles", label: "admin.section.roles", perm: "admin.roles" },
  { id: "users", label: "admin.section.users", perm: "admin.users" },
  { id: "logs", label: "admin.section.logs", perm: "admin.users" },
  { id: "revenue", label: "admin.section.revenue", perm: "revenue.view" },
  { id: "settings", label: "admin.section.settings", perm: "admin.settings" },
];

const ALL_PERMS = Array.from(new Set(ROLE_ORDER.flatMap((r) => permissionsFor(r))));

export function Admin() {
  const { section } = useParams({ from: "/admin/$section" });
  const { can: may, lockHint } = usePerm();
  const t = useT();
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const allowed = !current.perm || may(current.perm);

  return (
    <>
      <PageTitle title={t("admin.title")} hint={t("admin.hint")} />

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
              {t(s.label)}
            </Link>
          );
        })}
      </div>

      {!allowed ? (
        <Banner kind="warning" title={t("admin.noPerm.title")}>
          {t("admin.noPerm.body", { role: lockHint(current.perm!) ?? "" })}
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
  const t = useT();
  const lang = useUI((s) => s.lang);
  return (
    <Panel>
      <PanelHead title={t("admin.roles.title")} hint={t("admin.roles.hint")} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line bg-raised">
              <th className="microlabel border-r border-hair px-3 py-2 text-left">{t("admin.roles.permission")}</th>
              {ROLE_ORDER.map((r) => (
                <th key={r} className="microlabel border-r border-hair px-3 py-2 text-center last:border-r-0" title={roleDesc(r, lang)}>
                  {roleLabel(r, lang)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PERMS.map((p) => (
              <tr key={p} className="border-b border-hair last:border-0">
                <td className="border-r border-hair px-3 py-2 text-[13px] text-ink">{permissionLabel(p, lang) ?? p}</td>
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

/* ====================================================================
   Kullanıcı yönetimi — GERÇEK.

   Bu bölüm beş satırı basıp "aktif" rozetini elle yazıyordu; ekleme,
   düzenleme, rol atama ve devre dışı bırakma hiç yoktu. Rol değiştirmenin
   tek yolu kendi rolünü değiştiren demo anahtarıydı.

   Artık kadro `store/users` içinde yaşar, her değişiklik gerekçesiyle
   denetim kaydına yazılır ve yetki kapısı ayrıdır: listeyi görmek
   `admin.users`, değiştirmek `admin.users.write`, ROL ATAMAK `admin.roles`.
   ==================================================================== */
function Users() {
  const me = useUI((s) => s.user);
  const lang = useUI((s) => s.lang);
  const { can } = usePerm();
  const t = useT();
  const { users, audit, createUser, updateUser, assignRole, setStatus } = useUsers();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DemoUser | null>(null);
  const [roleFor, setRoleFor] = useState<DemoUser | null>(null);
  const [statusFor, setStatusFor] = useState<DemoUser | null>(null);

  const canWrite = can("admin.users.write");
  const canRole = can("admin.roles");
  const actor = me?.id ?? "sistem";

  const rows = users.filter((u) => {
    const s = q.trim().toLocaleLowerCase("tr-TR");
    return !s || [u.name, u.id, u.title, u.unit, u.location, u.email].some((f) => f.toLocaleLowerCase("tr-TR").includes(s));
  });

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHead
          title={t("admin.users.title")}
          hint={t("admin.users.hint", { n: users.length, active: users.filter((u) => u.status === "active").length })}
          action={
            <span className="flex w-full items-center gap-2 sm:w-auto">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.users.searchPh")} className="min-w-0 flex-1 sm:w-52 sm:flex-none" />
              <Button size="sm" disabled={!canWrite} title={canWrite ? undefined : t("admin.users.needManager")}
                onClick={() => setCreating(true)}>
                <UserPlus size={15} strokeWidth={1.75} /> {t("admin.users.new")}
              </Button>
            </span>
          }
        />
        <PanelBody className="pt-1">
          {rows.length === 0 ? (
            <Empty title={t("admin.users.empty")} hint={t("admin.users.emptyHint")} />
          ) : rows.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 border-b border-hair py-3 last:border-0">
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-brand text-[12px] font-semibold text-white">
                {u.initials}
              </span>
              <div className="min-w-[11rem] flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-medium text-ink">{u.name}</span>
                  {u.id === me?.id && <Pill tone="blue">{t("admin.users.you")}</Pill>}
                </div>
                <div className="num text-[11.5px] text-ink-3">{u.id} · {u.title} · {unitLabel(u.unit, lang)} · {u.location}</div>
              </div>
              <Pill tone="gray">{roleLabel(u.role, lang)}</Pill>
              <Pill tone={u.status === "active" ? "green" : "red"}>{u.status === "active" ? t("admin.users.active") : t("admin.users.inactive")}</Pill>
              <span className="flex items-center gap-1">
                <Button variant="ghost" size="sm" disabled={!canWrite} onClick={() => setEditing(u)}>{t("admin.users.edit")}</Button>
                <Button variant="ghost" size="sm" disabled={!canRole} title={canRole ? undefined : t("admin.users.needAdmin")}
                  onClick={() => setRoleFor(u)}>{t("admin.users.role")}</Button>
                <Button variant="ghost" size="sm" disabled={!canWrite || u.id === me?.id}
                  title={u.id === me?.id ? t("admin.users.selfLock") : undefined}
                  onClick={() => setStatusFor(u)}>
                  {u.status === "active" ? t("admin.users.deactivate") : t("admin.users.activate")}
                </Button>
              </span>
            </div>
          ))}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHead title={t("admin.changes.title")} hint={t("admin.changes.hint")} />
        <PanelBody className="pt-1">
          {audit.length === 0 ? (
            <Empty title={t("admin.changes.empty")} hint={t("admin.changes.emptyHint")} />
          ) : audit.slice(0, 40).map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 border-b border-hair py-2.5 last:border-0">
              <span className="num w-40 flex-shrink-0 text-[12px] text-ink-3">{formatDateTime(a.at)}</span>
              <span className="num text-[12.5px] text-ink-2">{a.actor}</span>
              <Pill tone={a.action === "delete" ? "red" : a.action === "role" ? "violet" : "gray"}>
                {ACTION_KEY[a.action] ? t(ACTION_KEY[a.action]) : a.action}
              </Pill>
              <span className="text-[13px] text-ink">{a.targetName}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-3">
                {a.detail}{a.reason ? ` · ${a.reason}` : ""}
              </span>
            </div>
          ))}
        </PanelBody>
      </Panel>

      <UserFormModal
        open={creating} users={users} onClose={() => setCreating(false)}
        onSubmit={(v) => { createUser(actor, v); setCreating(false); }}
      />
      <UserFormModal
        open={!!editing} users={users} initial={editing ?? undefined} onClose={() => setEditing(null)}
        onSubmit={(v) => { if (editing) updateUser(actor, editing.id, v); setEditing(null); }}
      />
      <RoleModal
        user={roleFor} onClose={() => setRoleFor(null)}
        onSubmit={(role, reason) => {
          if (roleFor) {
            assignRole(actor, roleFor.id, role, reason);
            // Kendi rolünü değiştiren yetkili yeni yetkilerle devam eder —
            // önce çıkış yapana kadar eski rolün ekranları açık kalıyordu.
            if (roleFor.id === me?.id) useUI.getState().setRole(role);
          }
          setRoleFor(null);
        }}
      />
      <StatusModal
        user={statusFor} onClose={() => setStatusFor(null)}
        onSubmit={(reason) => {
          if (statusFor) setStatus(actor, statusFor.id, statusFor.status === "active" ? "suspended" : "active", reason);
          setStatusFor(null);
        }}
      />
    </div>
  );
}

const ACTION_KEY: Record<string, Key> = {
  create: "admin.action.create", update: "admin.action.update", role: "admin.action.role",
  status: "admin.action.status", delete: "admin.action.delete",
};

/** Ekleme ve düzenleme aynı form — alanlar birebir aynı. */
function UserFormModal({
  open, users, initial, onClose, onSubmit,
}: {
  open: boolean;
  users: DemoUser[];
  initial?: DemoUser;
  onClose: () => void;
  onSubmit: (v: NewUserInput) => void;
}) {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const [v, setV] = useState<NewUserInput>(blank());
  useEffect(() => {
    if (!open) return;
    setV(initial
      ? { name: initial.name, email: initial.email, location: initial.location, role: initial.role,
          title: initial.title, unit: initial.unit, managerId: initial.managerId, phone: initial.phone }
      : blank());
  }, [open, initial]);

  const set = <K extends keyof NewUserInput>(k: K, val: NewUserInput[K]) => setV((x) => ({ ...x, [k]: val }));
  // E-posta kimliktir: başka bir personelde kayıtlıysa ikinci hesap açılmaz
  // (önce aynı adrese sessizce "e.demir2" açılıyordu).
  const emailTaken = users.some((u) => u.id !== initial?.id && u.email.trim().toLowerCase() === v.email.trim().toLowerCase());
  const valid = v.name.trim().length > 2 && /.+@.+\..+/.test(v.email) && !emailTaken && v.title.trim().length > 1;

  return (
    <Modal
      open={open} onClose={onClose}
      title={initial ? t("admin.form.editTitle") : t("admin.form.newTitle")}
      hint={initial ? undefined : t("admin.form.newHint")}
      width="md"
      footer={<Button variant="success" disabled={!valid} onClick={() => onSubmit(v)}>{initial ? t("admin.form.save") : t("admin.form.create")}</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("admin.form.name")} required>
          <Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Elif Demir" />
        </Field>
        <Field label={t("admin.form.email")} required hint={t("admin.form.emailHint")} error={emailTaken ? t("admin.form.emailTaken") : undefined}>
          <Input value={v.email} onChange={(e) => set("email", e.target.value)} placeholder="e.demir@thy.com" />
        </Field>
        <Field label={t("admin.form.jobTitle")} required>
          <Input value={v.title} onChange={(e) => set("title", e.target.value)} placeholder={t("admin.form.jobTitlePh")} />
        </Field>
        <Field label={t("admin.form.unit")}>
          <Select value={v.unit} onChange={(e) => set("unit", e.target.value as NewUserInput["unit"])}>
            {UNITS.map((u) => <option key={u} value={u}>{unitLabel(u, lang)}</option>)}
          </Select>
        </Field>
        <Field label={t("admin.form.location")}>
          <Input value={v.location} onChange={(e) => set("location", e.target.value.toUpperCase())} placeholder="IST-CTR" className="uppercase num" />
        </Field>
        <Field label={t("admin.form.phone")}>
          <Input value={v.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="4102" className="num" />
        </Field>
        <Field label={t("admin.form.manager")}>
          <Select value={v.managerId ?? ""} onChange={(e) => set("managerId", e.target.value || undefined)}>
            <option value="">{t("admin.form.noManager")}</option>
            {users.filter((u) => u.id !== initial?.id).map((u) => (
              <option key={u.id} value={u.id}>{u.name} · {u.title}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("admin.form.role")} hint={initial ? t("admin.form.roleHint") : undefined}>
          <Select value={v.role} disabled={!!initial} onChange={(e) => set("role", e.target.value as Role)}>
            {ROLE_ORDER.map((r) => <option key={r} value={r}>{roleLabel(r, lang)}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

const blank = (): NewUserInput => ({
  name: "", email: "", location: "IST-CTR", role: "staff", title: "", unit: "Biletleme",
});

/** Rol atama — yöneticinin NEYİ verdiğini görmesi için yetkiler önden listelenir. */
function RoleModal({
  user, onClose, onSubmit,
}: { user: DemoUser | null; onClose: () => void; onSubmit: (role: Role, reason: string) => void }) {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const [role, setRole] = useState<Role>("staff");
  const [reason, setReason] = useState("");
  useEffect(() => { if (user) { setRole(user.role); setReason(""); } }, [user]);
  if (!user) return null;

  const next = permissionsFor(role);
  const cur = permissionsFor(user.role);
  const gained = next.filter((p) => !cur.includes(p));
  const lost = cur.filter((p) => !next.includes(p));

  return (
    <Modal
      open onClose={onClose} title={t("admin.role.title", { name: user.name })}
      hint={t("admin.role.hint")}
      width="md"
      footer={
        <Button variant="success" disabled={role === user.role || !reason.trim()} onClick={() => onSubmit(role, reason)}>
          {t("admin.role.submit")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("admin.form.role")}>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLE_ORDER.map((r) => <option key={r} value={r}>{roleLabel(r, lang)} — {roleDesc(r, lang)}</option>)}
          </Select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-line bg-inset p-3">
              <div className="microlabel text-[var(--t-green-i)]">{t("admin.role.gained")}</div>
              <ul className="mt-1.5 flex flex-col gap-1 text-[12px] text-ink-2">
                {gained.length ? gained.map((p) => <li key={p}>+ {permissionLabel(p, lang)}</li>) : <li className="text-ink-4">—</li>}
              </ul>
            </div>
            <div className="rounded-md border border-line bg-inset p-3">
              <div className="microlabel text-[var(--t-red-i)]">{t("admin.role.lost")}</div>
              <ul className="mt-1.5 flex flex-col gap-1 text-[12px] text-ink-2">
                {lost.length ? lost.map((p) => <li key={p}>− {permissionLabel(p, lang)}</li>) : <li className="text-ink-4">—</li>}
              </ul>
            </div>
        </div>

        <Field label={t("admin.reason")} required hint={t("admin.role.reasonHint")}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("admin.role.reasonPh")} />
        </Field>
      </div>
    </Modal>
  );
}

function StatusModal({
  user, onClose, onSubmit,
}: { user: DemoUser | null; onClose: () => void; onSubmit: (reason: string) => void }) {
  const t = useT();
  const [reason, setReason] = useState("");
  useEffect(() => { if (user) setReason(""); }, [user]);
  if (!user) return null;
  const off = user.status === "active";

  return (
    <Modal
      open onClose={onClose}
      title={off ? t("admin.status.deactivateTitle", { name: user.name }) : t("admin.status.activateTitle", { name: user.name })}
      width="sm"
      footer={
        <Button variant={off ? "danger" : "success"} disabled={!reason.trim()} onClick={() => onSubmit(reason)}>
          {off ? t("admin.status.deactivate") : t("admin.status.activate")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Banner kind={off ? "warning" : "info"}>
          {off ? t("admin.status.deactivateNote") : t("admin.status.activateNote")}
        </Banner>
        <Field label={t("admin.reason")} required>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={off ? t("admin.status.reasonPhOff") : t("admin.status.reasonPhOn")} />
        </Field>
      </div>
    </Modal>
  );
}

/**
 * Denetim kaydı — GERÇEK.
 *
 * Önceki sürüm demo kullanıcıları için satır uyduruyordu (sahte IP, sahte
 * "Void denemesi"). Oysa audit bu sistemde zaten var: her komut event store'a
 * yazar. Bu ekran o olayları okur — kim (actor), ne zaman, hangi belgede,
 * hangi işlem, hangi statü. Uydurulan hiçbir satır kalmadı.
 */
const CATEGORY_KEY: Record<string, Key> = {
  issue: "admin.cat.issue", void: "admin.cat.void", refund: "admin.cat.refund", exchange: "admin.cat.exchange",
  emd: "admin.cat.emd", checkin: "admin.cat.checkin", other: "admin.cat.other",
};

function Logs() {
  const t = useT();
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useQuery({ queryKey: ["auditLog"], queryFn: () => queryTransactions({}) });
  const rows = data.filter((r) => {
    if (!q.trim()) return true;
    const s = q.trim().toUpperCase();
    return r.ticketNumber.includes(s) || r.actor.toUpperCase().includes(s)
      || r.passengerName.toUpperCase().includes(s) || (r.detail?.toUpperCase().includes(s) ?? false);
  }).slice(0, 200);

  return (
    <Panel>
      <PanelHead
        title={t("admin.logs.title")}
        hint={t("admin.logs.hint", { n: data.length })}
        action={<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.logs.searchPh")} className="w-56" />}
      />
      <PanelBody className="pt-1">
        {isLoading ? null : rows.length === 0 ? (
          <Empty title={t("admin.logs.empty")} hint={t("admin.logs.emptyHint")} />
        ) : rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-hair py-2.5 last:border-0">
            <span className="num w-40 flex-shrink-0 text-[12px] text-ink-3">{formatDateTime(r.occurredAt)}</span>
            <span className="num text-[12.5px] text-ink-2">{r.actor}</span>
            <Pill tone="gray">{CATEGORY_KEY[r.category] ? t(CATEGORY_KEY[r.category]) : r.category}</Pill>
            <Link to="/tickets/$ticketNumber" params={{ ticketNumber: r.ticketNumber }}
              className="num text-[12.5px] font-medium text-brand hover:underline">{r.ticketNumber}</Link>
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2" title={r.detail}>{r.detail ?? r.type}</span>
            {r.status && <StatusPill status={r.status} />}
          </div>
        ))}
      </PanelBody>
    </Panel>
  );
}

const SEV: Record<string, Tone> = { high: "red", medium: "amber", low: "gray" };

function Revenue() {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const { data, isLoading } = useQuery({ queryKey: ["revenueAlerts"], queryFn: listRevenueAlerts });
  return (
    <Panel>
      <PanelHead title={t("admin.revenue.title")} hint={t("admin.revenue.hint")} />
      <PanelBody className="pt-1">
        {isLoading ? null : (data ?? []).length === 0 ? (
          <Empty title={t("admin.revenue.empty")} hint={t("admin.revenue.emptyHint")} />
        ) : (
          (data ?? []).map((a) => (
            // Telefonda açıklama tam genişlikte ikinci satıra iner (basis-full);
            // geniş ekranda tek satırdır.
            <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-hair py-3 last:border-0">
              <Pill tone={SEV[a.severity] ?? "gray"}>{t(`admin.revenue.sev.${a.severity}`)}</Pill>
              <Link to="/tickets/$ticketNumber" params={{ ticketNumber: a.ticketNumber }} className="num text-[13px] font-medium text-brand hover:underline">
                {a.ticketNumber}
              </Link>
              <span className="num ml-auto text-[11.5px] text-ink-3 md:order-last md:ml-0">{formatDateTime(a.detectedAt)}</span>
              <span className="min-w-0 basis-full text-[13px] text-ink-2 md:basis-0 md:flex-1">
                {lang === "en" ? a.detailEn ?? a.detail : a.detail}
              </span>
            </div>
          ))
        )}
      </PanelBody>
    </Panel>
  );
}

function Settings() {
  const { theme, setTheme, lang, setLang, role } = useUI();
  const t = useT();
  return (
    <Panel>
      <PanelHead title={t("admin.settings.title")} hint={t("admin.settings.hint")} />
      <PanelBody className="flex flex-col gap-4">
        <MetaGrid>
          <Meta label={t("admin.settings.theme")} value={theme === "dark" ? t("admin.theme.dark") : theme === "light" ? t("admin.theme.light") : t("admin.theme.system")} />
          <Meta label={t("admin.settings.lang")} value={lang.toUpperCase()} mono />
          <Meta label={t("admin.settings.role")} value={roleLabel(role, lang)} />
          <Meta label={t("admin.settings.station")} value="IST-CTR" mono />
        </MetaGrid>
        <div className="flex flex-wrap gap-2">
          {(["light", "dark", "system"] as const).map((x) => (
            <button key={x} onClick={() => setTheme(x)}
              className={cn("rounded-md border px-3 py-1.5 text-[13px] transition-colors",
                theme === x ? "border-brand bg-brand-wash text-brand" : "border-line text-ink-2 hover:bg-sunken")}>
              {x === "light" ? t("admin.theme.light") : x === "dark" ? t("admin.theme.dark") : t("admin.theme.system")}
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
