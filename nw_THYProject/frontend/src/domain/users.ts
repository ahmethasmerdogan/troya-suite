// Demo/test kullanıcıları — hızlı giriş için. Gerçekte Keycloak (OIDC) kullanıcısından gelir;
// rol → permission eşlemesi auth.ts'te. Her rol için bir temsili personel.
import type { Role } from "./auth";

export interface DemoUser {
  id: string; // kullanıcı adı
  name: string;
  initials: string;
  email: string;
  location: string; // istasyon/ofis (örn. IST-CTR)
  role: Role;
}

export const DEMO_USERS: DemoUser[] = [
  { id: "e.demir", name: "Elif Demir", initials: "ED", email: "e.demir@thy.com", location: "IST-CTR", role: "staff" },
  { id: "m.kaya", name: "Mert Kaya", initials: "MK", email: "m.kaya@thy.com", location: "SAW-OPS", role: "supervisor" },
  { id: "z.sahin", name: "Zeynep Şahin", initials: "ZŞ", email: "z.sahin@thy.com", location: "IST-CTR", role: "chief" },
  { id: "b.yildiz", name: "Burak Yıldız", initials: "BY", email: "b.yildiz@thy.com", location: "ESB-STN", role: "manager" },
  { id: "a.erdogan", name: "Ahmet Erdoğan", initials: "AE", email: "a.erdogan@thy.com", location: "IST-CTR", role: "admin" },
];

export function userById(id: string): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.id === id);
}
