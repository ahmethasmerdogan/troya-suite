import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Check, UserPlus, X } from "lucide-react";
import { listRevenueAlerts, queryTransactions } from "@/domain/api";
import { UNITS, type DemoUser } from "@/domain/users";
import { useUsers, type NewUserInput } from "@/store/users";
import {
  PERMISSION_LABEL, ROLE_DESC, ROLE_LABEL, ROLE_ORDER, can, permissionsFor, type Permission, type Role,
} from "@/domain/auth";
import { useUI } from "@/store/ui";
import { usePerm } from "@/lib/usePerm";
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
  const { can } = usePerm();
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
          title="Kullanıcılar"
          hint={`${users.length} personel · ${users.filter((u) => u.status === "active").length} aktif`}
          action={
            <span className="flex items-center gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad · birim · istasyon" className="w-52" />
              <Button size="sm" disabled={!canWrite} title={canWrite ? undefined : "Müdür ve üzeri gerekir"}
                onClick={() => setCreating(true)}>
                <UserPlus size={15} strokeWidth={1.75} /> Yeni kullanıcı
              </Button>
            </span>
          }
        />
        <PanelBody className="pt-1">
          {rows.length === 0 ? (
            <Empty title="Kullanıcı bulunamadı" hint="Farklı bir ad, birim ya da istasyon deneyin." />
          ) : rows.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 border-b border-hair py-3 last:border-0">
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-brand text-[12px] font-semibold text-white">
                {u.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-medium text-ink">{u.name}</span>
                  {u.id === me?.id && <Pill tone="blue">siz</Pill>}
                </div>
                <div className="num text-[11.5px] text-ink-3">{u.id} · {u.title} · {u.unit} · {u.location}</div>
              </div>
              <Pill tone="gray">{ROLE_LABEL[u.role]}</Pill>
              <Pill tone={u.status === "active" ? "green" : "red"}>{u.status === "active" ? "aktif" : "devre dışı"}</Pill>
              <span className="flex items-center gap-1">
                <Button variant="ghost" size="sm" disabled={!canWrite} onClick={() => setEditing(u)}>Düzenle</Button>
                <Button variant="ghost" size="sm" disabled={!canRole} title={canRole ? undefined : "Rol atamak için Admin gerekir"}
                  onClick={() => setRoleFor(u)}>Rol</Button>
                <Button variant="ghost" size="sm" disabled={!canWrite || u.id === me?.id}
                  title={u.id === me?.id ? "Kendinizi devre dışı bırakamazsınız" : undefined}
                  onClick={() => setStatusFor(u)}>
                  {u.status === "active" ? "Devre dışı" : "Etkinleştir"}
                </Button>
              </span>
            </div>
          ))}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHead title="Kullanıcı değişiklikleri" hint="Kim, kimde, neyi, hangi gerekçeyle değiştirdi." />
        <PanelBody className="pt-1">
          {audit.length === 0 ? (
            <Empty title="Değişiklik yok" hint="Kadroda henüz bir değişiklik yapılmadı." />
          ) : audit.slice(0, 40).map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 border-b border-hair py-2.5 last:border-0">
              <span className="num w-40 flex-shrink-0 text-[12px] text-ink-3">{formatDateTime(a.at)}</span>
              <span className="num text-[12.5px] text-ink-2">{a.actor}</span>
              <Pill tone={a.action === "delete" ? "red" : a.action === "role" ? "violet" : "gray"}>{ACTION_LABEL[a.action]}</Pill>
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
        onSubmit={(role, reason) => { if (roleFor) assignRole(actor, roleFor.id, role, reason); setRoleFor(null); }}
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

const ACTION_LABEL: Record<string, string> = {
  create: "Eklendi", update: "Güncellendi", role: "Rol atandı", status: "Durum", delete: "Silindi",
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
  const [v, setV] = useState<NewUserInput>(blank());
  useEffect(() => {
    if (!open) return;
    setV(initial
      ? { name: initial.name, email: initial.email, location: initial.location, role: initial.role,
          title: initial.title, unit: initial.unit, managerId: initial.managerId, phone: initial.phone }
      : blank());
  }, [open, initial]);

  const set = <K extends keyof NewUserInput>(k: K, val: NewUserInput[K]) => setV((x) => ({ ...x, [k]: val }));
  const valid = v.name.trim().length > 2 && /.+@.+\..+/.test(v.email) && v.title.trim().length > 1;

  return (
    <Modal
      open={open} onClose={onClose}
      title={initial ? "Kullanıcıyı düzenle" : "Yeni kullanıcı"}
      hint={initial ? undefined : "Kullanıcı adı e-postadan üretilir; parola demo ortamında sorulmaz."}
      width="md"
      footer={<Button variant="success" disabled={!valid} onClick={() => onSubmit(v)}>{initial ? "Kaydet" : "Kullanıcıyı ekle"}</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad Soyad" required>
          <Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Elif Demir" />
        </Field>
        <Field label="E-posta" required hint="Kullanıcı adı buradan türer.">
          <Input value={v.email} onChange={(e) => set("email", e.target.value)} placeholder="e.demir@thy.com" />
        </Field>
        <Field label="Unvan" required>
          <Input value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Bilet Satış Uzmanı" />
        </Field>
        <Field label="Birim">
          <Select value={v.unit} onChange={(e) => set("unit", e.target.value as NewUserInput["unit"])}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </Field>
        <Field label="İstasyon / Ofis">
          <Input value={v.location} onChange={(e) => set("location", e.target.value.toUpperCase())} placeholder="IST-CTR" className="uppercase num" />
        </Field>
        <Field label="Dahili">
          <Input value={v.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="4102" className="num" />
        </Field>
        <Field label="Bağlı olduğu yönetici">
          <Select value={v.managerId ?? ""} onChange={(e) => set("managerId", e.target.value || undefined)}>
            <option value="">— yok —</option>
            {users.filter((u) => u.id !== initial?.id).map((u) => (
              <option key={u.id} value={u.id}>{u.name} · {u.title}</option>
            ))}
          </Select>
        </Field>
        <Field label="Rol" hint={initial ? "Rol ayrı bir işlemdir; buradan değiştirilmez." : undefined}>
          <Select value={v.role} disabled={!!initial} onChange={(e) => set("role", e.target.value as Role)}>
            {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
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
      open onClose={onClose} title={`Rol ata — ${user.name}`}
      hint="Rol değişikliği yetki matrisini anında değiştirir ve denetim kaydına yazılır."
      width="md"
      footer={
        <Button variant="success" disabled={role === user.role || !reason.trim()} onClick={() => onSubmit(role, reason)}>
          Rolü ata
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Rol">
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]} — {ROLE_DESC[r]}</option>)}
          </Select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-line bg-inset p-3">
              <div className="microlabel text-[var(--t-green-i)]">Kazanacağı yetkiler</div>
              <ul className="mt-1.5 flex flex-col gap-1 text-[12px] text-ink-2">
                {gained.length ? gained.map((p) => <li key={p}>+ {PERMISSION_LABEL[p]}</li>) : <li className="text-ink-4">—</li>}
              </ul>
            </div>
            <div className="rounded-md border border-line bg-inset p-3">
              <div className="microlabel text-[var(--t-red-i)]">Kaybedeceği yetkiler</div>
              <ul className="mt-1.5 flex flex-col gap-1 text-[12px] text-ink-2">
                {lost.length ? lost.map((p) => <li key={p}>− {PERMISSION_LABEL[p]}</li>) : <li className="text-ink-4">—</li>}
              </ul>
            </div>
        </div>

        <Field label="Gerekçe" required hint="Denetim kaydına yazılır.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vardiya sorumluluğu devri" />
        </Field>
      </div>
    </Modal>
  );
}

function StatusModal({
  user, onClose, onSubmit,
}: { user: DemoUser | null; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (user) setReason(""); }, [user]);
  if (!user) return null;
  const off = user.status === "active";

  return (
    <Modal
      open onClose={onClose}
      title={off ? `Devre dışı bırak — ${user.name}` : `Etkinleştir — ${user.name}`}
      width="sm"
      footer={
        <Button variant={off ? "danger" : "success"} disabled={!reason.trim()} onClick={() => onSubmit(reason)}>
          {off ? "Devre dışı bırak" : "Etkinleştir"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Banner kind={off ? "warning" : "info"}>
          {off
            ? "Devre dışı personel giriş yapamaz; mevcut kayıtları ve denetim geçmişi silinmez."
            : "Personel yeniden giriş yapabilir ve rolünün yetkileriyle çalışır."}
        </Banner>
        <Field label="Gerekçe" required>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={off ? "İzin / görev değişikliği" : "Göreve dönüş"} />
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
const CATEGORY_LABEL: Record<string, string> = {
  issue: "Kesim", void: "Void", refund: "İade", exchange: "Exchange / Reissue",
  emd: "EMD", checkin: "Check-in / Biniş", other: "Diğer",
};

function Logs() {
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
        title="Denetim kaydı"
        hint={`Kim, ne zaman, ne yaptı — event store'dan türer (${data.length} olay).`}
        action={<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Belge · personel · yolcu" className="w-56" />}
      />
      <PanelBody className="pt-1">
        {isLoading ? null : rows.length === 0 ? (
          <Empty title="Kayıt yok" hint="Bu filtreyle eşleşen denetim kaydı bulunmuyor." />
        ) : rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-hair py-2.5 last:border-0">
            <span className="num w-40 flex-shrink-0 text-[12px] text-ink-3">{formatDateTime(r.occurredAt)}</span>
            <span className="num text-[12.5px] text-ink-2">{r.actor}</span>
            <Pill tone="gray">{CATEGORY_LABEL[r.category] ?? r.category}</Pill>
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
