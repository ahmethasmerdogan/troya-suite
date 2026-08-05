import { create } from "zustand";
import { DEMO_USERS, initialsOf, type DemoUser, type Unit } from "@/domain/users";
import type { Role } from "@/domain/auth";

/* ====================================================================
   Personel kayıtları — CANLI.

   Kadro derleme zamanı sabitiydi: Yönetim > Kullanıcılar beş satırı sadece
   BASIYOR, "aktif" rozeti elle yazılıydı; ekleme, düzenleme, rol atama ve
   devre dışı bırakma hiç yoktu. Rol değiştirmenin tek yolu kendi rolünü
   değiştiren demo anahtarıydı.

   Burada liste tarayıcıda yaşar ve her değişiklik bir OLAY olarak yazılır —
   sistemin geri kalanındaki denetim ilkesiyle aynı: kim, ne zaman, kimde,
   neyi, hangi gerekçeyle değiştirdi.
   ==================================================================== */

const LS_USERS = "troya.users.v1";
const LS_AUDIT = "troya.users.audit.v1";
const MAX_AUDIT = 300;

export type UserAction = "create" | "update" | "role" | "status" | "delete";

export interface UserAuditEntry {
  id: string;
  at: string;
  /** İşlemi yapan kullanıcı adı. */
  actor: string;
  action: UserAction;
  targetId: string;
  targetName: string;
  detail: string;
  reason?: string;
}

export interface NewUserInput {
  name: string;
  email: string;
  location: string;
  role: Role;
  title: string;
  unit: Unit;
  managerId?: string;
  phone?: string;
}

interface UsersState {
  users: DemoUser[];
  audit: UserAuditEntry[];
  createUser: (actor: string, input: NewUserInput) => DemoUser;
  updateUser: (actor: string, id: string, patch: Partial<DemoUser>) => void;
  assignRole: (actor: string, id: string, role: Role, reason?: string) => void;
  setStatus: (actor: string, id: string, status: DemoUser["status"], reason?: string) => void;
  removeUser: (actor: string, id: string) => void;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* depo kapalı */ }
}

/** İlk açılışta tohum kadroyla dolar; sonrasında saklanan liste kazanır. */
function seedUsers(): DemoUser[] {
  const saved = read<DemoUser[]>(LS_USERS, []);
  return saved.length ? saved : DEMO_USERS.map((u) => ({ ...u }));
}

export const useUsers = create<UsersState>((set, get) => {
  const persist = (users: DemoUser[], audit: UserAuditEntry[]) => {
    write(LS_USERS, users);
    write(LS_AUDIT, audit.slice(0, MAX_AUDIT));
    set({ users, audit: audit.slice(0, MAX_AUDIT) });
  };

  const log = (
    actor: string, action: UserAction, target: DemoUser, detail: string, reason?: string,
  ): UserAuditEntry => ({
    id: "ua-" + crypto.randomUUID().slice(0, 8),
    at: new Date().toISOString(),
    actor, action, targetId: target.id, targetName: target.name, detail, reason,
  });

  return {
    users: seedUsers(),
    audit: read<UserAuditEntry[]>(LS_AUDIT, []),

    createUser: (actor, input) => {
      const { users, audit } = get();
      const base = input.email.split("@")[0] || "kullanici";
      let id = base;
      let n = 2;
      while (users.some((u) => u.id === id)) id = `${base}${n++}`;
      const user: DemoUser = {
        id,
        name: input.name.trim(),
        initials: initialsOf(input.name),
        email: input.email.trim(),
        location: input.location.trim().toUpperCase(),
        role: input.role,
        title: input.title.trim(),
        unit: input.unit,
        managerId: input.managerId || undefined,
        phone: input.phone?.trim() || undefined,
        status: "active",
        startedAt: new Date().toISOString(),
      };
      persist(
        [...users, user],
        [log(actor, "create", user, `${user.title} · ${user.unit} · rol ${user.role}`), ...audit],
      );
      return user;
    },

    updateUser: (actor, id, patch) => {
      const { users, audit } = get();
      const before = users.find((u) => u.id === id);
      if (!before) return;
      const after = { ...before, ...patch, initials: patch.name ? initialsOf(patch.name) : before.initials };
      const changed = (Object.keys(patch) as (keyof DemoUser)[])
        .filter((k) => before[k] !== after[k])
        .map((k) => `${k}: ${String(before[k] ?? "—")} → ${String(after[k] ?? "—")}`);
      if (!changed.length) return;
      persist(
        users.map((u) => (u.id === id ? after : u)),
        [log(actor, "update", after, changed.join(" · ")), ...audit],
      );
    },

    assignRole: (actor, id, role, reason) => {
      const { users, audit } = get();
      const before = users.find((u) => u.id === id);
      if (!before || before.role === role) return;
      const after = { ...before, role };
      persist(
        users.map((u) => (u.id === id ? after : u)),
        [log(actor, "role", after, `rol ${before.role} → ${role}`, reason), ...audit],
      );
    },

    setStatus: (actor, id, status, reason) => {
      const { users, audit } = get();
      const before = users.find((u) => u.id === id);
      if (!before || before.status === status) return;
      const after = { ...before, status };
      persist(
        users.map((u) => (u.id === id ? after : u)),
        [log(actor, "status", after, status === "suspended" ? "devre dışı bırakıldı" : "yeniden etkinleştirildi", reason), ...audit],
      );
    },

    removeUser: (actor, id) => {
      const { users, audit } = get();
      const target = users.find((u) => u.id === id);
      if (!target) return;
      persist(
        // Silinen kişinin astları yöneticisiz kalmasın: bir üst kademeye bağlanır.
        users.filter((u) => u.id !== id).map((u) => (u.managerId === id ? { ...u, managerId: target.managerId } : u)),
        [log(actor, "delete", target, "kullanıcı silindi"), ...audit],
      );
    },
  };
});

/** Bileşen dışından okuma (store'a abone olmadan). */
export const usersSnapshot = (): DemoUser[] => useUsers.getState().users;
export const findUser = (id: string): DemoUser | undefined =>
  useUsers.getState().users.find((u) => u.id === id);
