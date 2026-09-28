import { greatCircleKm } from "./geo";
import type { CabinName } from "./fareTypes";

/* ====================================================================
   Yolcu başı CO₂ tahmini — IATA RP 1726 yöntemi (CO2 Connect) ve ICAO
   ICEC mesafe düzeltmesiyle.

   · Yakıt → CO₂: 3,16 kg CO₂ / kg yakıt (RP 1726).
   · Mesafe: büyük daire + ICAO düzeltmesi (<550 km +50, ≤5500 km +100,
     üstü +125 km) — kalkış/iniş dolanımı ve bekleme.
   · Yakıt = iniş-kalkış çevrimi (LTO) + km başı yanma × düzeltilmiş mesafe.
   · Yolcu payı: yakıtın kargo/yolcu kütle ayrımı (dar gövde %97, geniş %85).
   · Kabin katsayısı: dar gövdede Y 1 / J 1,5; geniş gövdede Y 1 / W 1,5 /
     J 4 (koltuk alanı ağırlıklı dağıtım). Doluluk %80.

   Uçak parametreleri TEMSİLÎDİR (seyir yakıt akışı ÷ hız, THY yaklaşık
   koltuk düzeni). Sonuç bir TAHMİNDİR — sertifikalı bir değer değildir.
   Doğrulama: IST–LHR ekonomi ≈ 160 kg, IST–JFK ekonomi ≈ 470 kg.
   ==================================================================== */

interface AircraftParams { burnKm: number; lto: number; seatsJ: number; seatsY: number; paxShare: number; wide: boolean }

const PARAMS: Record<string, AircraftParams> = {
  "B737-8": { burnKm: 2.6, lto: 700, seatsJ: 16, seatsY: 135, paxShare: 0.97, wide: false },
  "A321neo": { burnKm: 2.8, lto: 700, seatsJ: 20, seatsY: 162, paxShare: 0.97, wide: false },
  "A350-900": { burnKm: 6.5, lto: 2000, seatsJ: 32, seatsY: 297, paxShare: 0.85, wide: true },
  "A330-300": { burnKm: 6.8, lto: 2000, seatsJ: 28, seatsY: 261, paxShare: 0.85, wide: true },
  "B777-300ER": { burnKm: 8.3, lto: 2000, seatsJ: 49, seatsY: 300, paxShare: 0.85, wide: true },
};

const CO2_PER_KG_FUEL = 3.16;
const LOAD_FACTOR = 0.8;

/** Mesafeye göre tipik uçak (uçuş listesiyle aynı eşikler). */
export function aircraftForDistance(km: number): string {
  if (km < 1500) return "A321neo";
  if (km < 4500) return "A330-300";
  return "B777-300ER";
}

/**
 * "Boeing 777-300ER", "Airbus A321neo" gibi uzun adları parametre anahtarına
 * indir: üretici öneki (A/B) atılıp model gövdesi aranır ("777-300ER").
 */
function paramsFor(aircraft: string | undefined, km: number): AircraftParams {
  const name = (aircraft ?? "").toUpperCase();
  const key = Object.keys(PARAMS).find((k) => name.includes(k.slice(1).toUpperCase()));
  return PARAMS[key ?? aircraftForDistance(km)];
}

function cabinFactor(cabin: CabinName, wide: boolean): number {
  if (cabin === "Business") return wide ? 4 : 1.5;
  if (cabin === "Premium") return wide ? 1.5 : 1;
  return 1;
}

/** ICAO mesafe düzeltmesi. */
export function correctedKm(gc: number): number {
  return gc + (gc < 550 ? 50 : gc <= 5500 ? 100 : 125);
}

/** Yolcu başı CO₂ (kg, tam sayı). Koordinatı bilinmeyen rotada undefined. */
export function co2PerPax(origin: string, destination: string, cabin: CabinName = "Economy", aircraft?: string): number | undefined {
  const gc = greatCircleKm(origin, destination);
  if (gc === undefined) return undefined;
  const p = paramsFor(aircraft, gc);
  const fuel = p.lto + p.burnKm * correctedKm(gc);
  const f = (c: CabinName) => cabinFactor(c, p.wide);
  const seatUnits = p.seatsY * f("Economy") + p.seatsJ * f("Business");
  const perEconomy = (fuel * p.paxShare * CO2_PER_KG_FUEL) / (LOAD_FACTOR * seatUnits);
  return Math.round(perEconomy * f(cabin));
}

/** RBD → kabin (THY alışkanlığı: J C D Z Business, W Premium, gerisi Economy). */
export function cabinOfRbd(rbd: string): CabinName {
  const r = rbd.toUpperCase();
  // Satış tarafıyla aynı eşleme (fareTypes: C/J/D Business, W/P Premium).
  if ("JCDIZ".includes(r)) return "Business";
  if ("WPS".includes(r)) return "Premium";
  return "Economy";
}
