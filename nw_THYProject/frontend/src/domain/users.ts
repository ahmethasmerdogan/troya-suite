// Personel kayıtları. Gerçekte Keycloak (OIDC) dizininden gelir; rol → permission
// eşlemesi auth.ts'te. Burası TİP + TOHUM: canlı liste `store/users.ts`'te yaşar
// ve orada değiştirilir (ekleme, rol atama, devre dışı bırakma).
import type { Role } from "./auth";

/** Personelin bağlı olduğu birim — kişi kartında ve kullanıcı yönetiminde. */
export type Unit = "Biletleme" | "İstasyon Operasyon" | "Check-in" | "Gelir Koruma" | "Yönetim";

export const UNITS: Unit[] = ["Biletleme", "İstasyon Operasyon", "Check-in", "Gelir Koruma", "Yönetim"];

const UNIT_EN: Record<Unit, string> = {
  "Biletleme": "Ticketing",
  "İstasyon Operasyon": "Station Operations",
  "Check-in": "Check-in",
  "Gelir Koruma": "Revenue Protection",
  "Yönetim": "Management",
};

/**
 * Birimin seçilen dildeki adı. Kayıtta (ve denetim kaydında) Türkçe ad
 * saklanır; İngilizce arayüz yalnız gösterirken çevirir.
 */
export function unitLabel(unit: string, lang: "tr" | "en" = "tr"): string {
  return lang === "en" ? UNIT_EN[unit as Unit] ?? unit : unit;
}

export interface DemoUser {
  id: string; // kullanıcı adı
  name: string;
  initials: string;
  email: string;
  location: string; // istasyon/ofis (örn. IST-CTR)
  role: Role;
  /** Unvan — kişi kartında rolün yanında görünür ("Bilet Satış Uzmanı"). */
  title: string;
  unit: Unit;
  /** Kime bağlı — başka bir kullanıcının id'si. Teams'teki "Reports to". */
  managerId?: string;
  /** Dahili numara. */
  phone?: string;
  /** Devre dışı personel giriş yapamaz. */
  status: "active" | "suspended";
  startedAt: string; // ISO — işe başlama
}

/**
 * Tohum kadro — gerçek bir hiyerarşi kurar:
 * Elif → Mert → Zeynep → Burak → Ahmet
 */
export const DEMO_USERS: DemoUser[] = [
  {
    id: "e.demir", name: "Elif Demir", initials: "ED", email: "e.demir@thy.com",
    location: "IST-CTR", role: "staff", title: "Bilet Satış Uzmanı", unit: "Biletleme",
    managerId: "m.kaya", phone: "4102", status: "active", startedAt: "2024-03-11T00:00:00Z",
  },
  {
    id: "m.kaya", name: "Mert Kaya", initials: "MK", email: "m.kaya@thy.com",
    location: "SAW-OPS", role: "supervisor", title: "Biletleme Süpervizörü", unit: "Biletleme",
    managerId: "z.sahin", phone: "4118", status: "active", startedAt: "2021-09-06T00:00:00Z",
  },
  {
    id: "z.sahin", name: "Zeynep Şahin", initials: "ZŞ", email: "z.sahin@thy.com",
    location: "IST-CTR", role: "chief", title: "İstasyon Şefi", unit: "İstasyon Operasyon",
    managerId: "b.yildiz", phone: "4001", status: "active", startedAt: "2019-01-14T00:00:00Z",
  },
  {
    id: "b.yildiz", name: "Burak Yıldız", initials: "BY", email: "b.yildiz@thy.com",
    location: "ESB-STN", role: "manager", title: "İstasyon Müdürü", unit: "Yönetim",
    managerId: "a.erdogan", phone: "4000", status: "active", startedAt: "2016-05-02T00:00:00Z",
  },
  {
    id: "a.erdogan", name: "Ahmet Erdoğan", initials: "AE", email: "a.erdogan@thy.com",
    location: "IST-CTR", role: "admin", title: "Sistem Yöneticisi", unit: "Yönetim",
    phone: "4444", status: "active", startedAt: "2015-02-16T00:00:00Z",
  },
];

/** Addan baş harf üret — yeni kullanıcı eklerken elle yazılmasın. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : parts[0][1] ?? "";
  return (first + last).toLocaleUpperCase("tr-TR");
}

/** Ad + soyaddan kullanıcı adı — "Elif Demir" → "e.demir". */
export function userIdFrom(name: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  const slug = (s: string) =>
    s.toLocaleLowerCase("tr-TR").replace(/[çğıöşü]/g, (m) => map[m] ?? m).replace(/[^a-z]/g, "");
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const first = slug(parts[0]).slice(0, 1);
  const last = slug(parts[parts.length - 1]);
  return parts.length > 1 ? `${first}.${last}` : slug(parts[0]);
}

// ---- hiyerarşi yardımcıları (liste dışarıdan verilir — canlı store'dan) ----

export function managerOf(users: DemoUser[], id: string): DemoUser | undefined {
  const u = users.find((x) => x.id === id);
  return u?.managerId ? users.find((x) => x.id === u.managerId) : undefined;
}

export function reportsOf(users: DemoUser[], id: string): DemoUser[] {
  return users.filter((u) => u.managerId === id);
}

/** Yönetim zinciri — kendisi hariç, döngüye karşı korumalı. */
export function chainOf(users: DemoUser[], id: string): DemoUser[] {
  const out: DemoUser[] = [];
  const seen = new Set([id]);
  let cur = managerOf(users, id);
  while (cur && !seen.has(cur.id)) {
    out.push(cur);
    seen.add(cur.id);
    cur = managerOf(users, cur.id);
  }
  return out;
}

/** Tohum listeden arama — store yokken (test/ilk açılış) yeter. */
export function userById(id: string): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.id === id);
}
