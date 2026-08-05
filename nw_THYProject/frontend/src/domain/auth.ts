// Personel yetkilendirme — ROADMAP §7 "rol bazlı yetki" + Handbook 5.7 "display kısıtı".
// 5 rol, kıdeme göre kümülatif yetki. Backend gelince Keycloak rolleri ile eşlenir.

export type Role = "staff" | "supervisor" | "chief" | "manager" | "admin";

export const ROLE_ORDER: Role[] = ["staff", "supervisor", "chief", "manager", "admin"];

export const ROLE_LABEL: Record<Role, string> = {
  staff: "Personel",
  supervisor: "Süpervizör",
  chief: "Şef",
  manager: "Müdür",
  admin: "Admin",
};
export const ROLE_DESC: Record<Role, string> = {
  staff: "Bilet kesme, EMD, check-in/biniş ve sorgulama.",
  supervisor: "+ Para işlemleri: void, refund, exchange, endorsement.",
  chief: "+ IRROP/FIM ve gelir koruma görünürlüğü.",
  manager: "+ Kullanıcı yönetimi ve sistem ayarları.",
  admin: "+ Rol & yetki yönetimi. Tam erişim.",
};

export type Permission =
  | "ticket.issue"
  | "ticket.exchange"
  | "ticket.refund"
  | "ticket.void"
  | "ticket.irrop"
  | "ticket.endorse"
  | "ticket.emd"
  | "ticket.revalidate"
  | "ticket.print"
  | "ticket.suspend"
  | "pta.manage"
  | "checkin.accept"
  | "checkin.board"
  | "ops.view"
  | "order.view"
  | "messages.view"
  | "revenue.view"
  | "admin.users"
  | "admin.users.write"
  | "chat.channel.create"
  | "admin.settings"
  | "admin.roles";

export const PERMISSION_LABEL: Record<Permission, string> = {
  "ticket.issue": "Bilet kes",
  "ticket.exchange": "Exchange / Reissue",
  "ticket.refund": "Refund",
  "ticket.void": "Void",
  "ticket.irrop": "IRROP / FIM",
  "ticket.endorse": "Endorsement",
  "ticket.emd": "EMD / Fazla bagaj",
  "ticket.revalidate": "Revalidation (uçuş/saat)",
  "ticket.print": "Kağıda bas (P)",
  "ticket.suspend": "Kuponu askıya al (S)",
  "pta.manage": "PTA (Prepaid)",
  "checkin.accept": "Check-in kabul",
  "checkin.board": "Biniş (boarding)",
  "ops.view": "HUB Kontrol / Operasyon",
  "order.view": "Order görüntüle",
  "messages.view": "Interline mesajları",
  "revenue.view": "Gelir koruma",
  "admin.users": "Kullanıcı listesi & denetim kaydı",
  "admin.users.write": "Kullanıcı ekle / düzenle / devre dışı bırak",
  "chat.channel.create": "Mesajlaşma kanalı aç",
  "admin.settings": "Sistem ayarları",
  "admin.roles": "Rol & yetki yönetimi",
};

// Her rolün KENDİ getirdiği yetkiler; alt roller kümülatif eklenir.
const INCREMENTAL: Record<Role, Permission[]> = {
  staff: ["ticket.issue", "ticket.emd", "ticket.print", "pta.manage", "checkin.accept", "checkin.board", "order.view", "messages.view"],
  supervisor: ["ticket.void", "ticket.refund", "ticket.exchange", "ticket.endorse", "ticket.revalidate", "chat.channel.create"],
  chief: ["ticket.irrop", "ticket.suspend", "revenue.view", "ops.view"],
  manager: ["admin.users", "admin.users.write", "admin.settings"],
  admin: ["admin.roles"],
};

/** Rolün (kümülatif) tüm yetkileri. */
export function permissionsFor(role: Role): Permission[] {
  const idx = ROLE_ORDER.indexOf(role);
  const perms = new Set<Permission>();
  for (let i = 0; i <= idx; i++) INCREMENTAL[ROLE_ORDER[i]].forEach((p) => perms.add(p));
  return [...perms];
}

const CACHE = new Map<Role, Set<Permission>>();
function setFor(role: Role): Set<Permission> {
  let s = CACHE.get(role);
  if (!s) { s = new Set(permissionsFor(role)); CACHE.set(role, s); }
  return s;
}

export function can(role: Role, p: Permission): boolean {
  return setFor(role).has(p);
}

/** Bu yetki için gereken minimum rol (matris/tooltip için). */
export function minRoleFor(p: Permission): Role {
  for (const r of ROLE_ORDER) if (INCREMENTAL[r].includes(p)) return r;
  return "admin";
}
