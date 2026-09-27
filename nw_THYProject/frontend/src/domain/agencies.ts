/**
 * Satış kanalı — acente (IATA akredite seyahat acentesi) kaydı.
 *
 * ADM/ACM yalnız ACENTENİN kestiği belgeye düzenlenir; havayolunun kendi
 * kanalından (web, şube, çağrı merkezi) satılan bilete acente dekontu
 * kesilmez. Bu yüzden biletin satış kanalı kayıtta durmalı.
 *
 * IATA acente kodu 8 hanedir (7 hane + kontrol hanesi). Buradaki acenteler
 * ve kodlar TEMSİLÎDİR.
 */
import type { Ticket } from "./types";

export interface Agency {
  iata: string;
  name: string;
  city: string;
}

export const AGENCIES: Agency[] = [
  { iata: "35212345", name: "ANADOLU TURIZM SEYAHAT", city: "İstanbul" },
  { iata: "35298761", name: "BOGAZICI TRAVEL", city: "İstanbul" },
  { iata: "35231190", name: "EGE VIP TOUR", city: "İzmir" },
  { iata: "35244518", name: "BASKENT SEYAHAT ACENTESI", city: "Ankara" },
  { iata: "23456781", name: "RHEIN REISEBUERO", city: "Frankfurt" },
];

export function agencyByIata(iata: string): Agency | undefined {
  return AGENCIES.find((a) => a.iata === iata);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

/**
 * Örnek verinin satış kanalı — biletlerin yaklaşık %40'ı acente satışı.
 * Bilet numarasından deterministik; bilet üretecinin rastgele akışına
 * dokunmaz (dokunsaydı tüm örnek veri kayardı).
 */
export function assignAgencies(tickets: Ticket[]): void {
  for (const t of tickets) {
    if (t.agent) continue;
    const h = hash(t.ticketNumber);
    if (h % 10 < 4) t.agent = { ...AGENCIES[h % AGENCIES.length] };
  }
}
