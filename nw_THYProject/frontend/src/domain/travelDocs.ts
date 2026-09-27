/**
 * Seyahat belgesi kontrolü — Timatic benzeri giriş koşulu sorgusu.
 *
 * Gişe, uluslararası uçuşta yolcuyu kabul etmeden önce varış ülkesinin giriş
 * koşulunu kontrol eder: vize / elektronik seyahat izni (ETA, ESTA) gerekiyor
 * mu, pasaport yeterince geçerli mi. Belgesi uygun olmayan yolcuyu taşıyan
 * havayolu yolcuyu geri taşır ve ceza öder — bu yüzden kural kabul kapısıdır,
 * öneri değil (`checkInPassenger` sunucu tarafında da reddeder).
 *
 * UYARI — TEMSİLÎ KURAL TABLOSU. Gerçek sistemde bu sorgu IATA Timatic'e
 * (ya da havayolunun belge veritabanına) gider; buradaki tablo yalnız demo
 * uçuşlarının varış ülkeleri (JP, GB, DE, US, AE) için yapıyı gösterir.
 * Kurallar değişir: canlıda Timatic otoritedir.
 *
 * Sonuç üç değerlidir (Timatic'in "OK / conditional / NOT OK" ayrımı):
 *   ok          — kabul edilebilir
 *   conditional — kabul edilebilir ama gişe bir şeyi teyit etmeli (uyarı)
 *   not_ok      — kabul edilemez; tek istisna varış ülkesi makamından alınmış
 *                 "OK TO BOARD" onayıdır (süpervizör, referans numarasıyla)
 */

export type DocVerdict = "ok" | "conditional" | "not_ok";
/** Varış ülkesinin bu uyruk için istediği izin. */
export type EntryRequirement = "citizen" | "free_movement" | "visa_free" | "eta" | "esta" | "visa";

export interface TravelDocFacts {
  nationality?: string;
  passport?: string;
  /** YYYY-MM-DD */
  passportExpiry?: string;
  /** Yolcunun beyan ettiği izin (DOCO): vize ya da ETA/ESTA. */
  visa?: TravelPermit;
  /** Varış ülkesi makamının "OK TO BOARD" onayı — not_ok'u aşan tek yol. */
  okToBoard?: { ref: string; by: string; at: string };
}

export interface TravelPermit {
  /** SCHENGEN · UK · US · AE · JP · ETA · ESTA */
  type: string;
  number: string;
  /** YYYY-MM-DD */
  validUntil: string;
}

export interface DocCheckLine {
  code: "REQ" | "PASSPORT" | "VALIDITY" | "PERMIT" | "OTB";
  ok: boolean;
  /** Uyarı düzeyi — ok=true iken bile gişenin bilmesi gereken not. */
  warn?: boolean;
  tr: string;
  en: string;
}

export interface DocCheckResult {
  verdict: DocVerdict;
  requirement: EntryRequirement;
  destinationCountry: string;
  /** Kabul için gereken izin türü (vize/ETA/ESTA) — yoksa undefined. */
  permitType?: string;
  lines: DocCheckLine[];
}

const SCHENGEN = new Set(["AT", "BE", "CH", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IS", "IT", "LI", "LT", "LU", "LV", "MT", "NL", "NO", "PL", "PT", "SE", "SI", "SK"]);
/** AB/AEA + İsviçre vatandaşı — Schengen'e kimlik kartıyla girer. */
const FREE_MOVEMENT = new Set([...SCHENGEN, "IE", "BG", "RO", "CY"]);
/** ABD Vize Muafiyet Programı (ESTA) — demo uyrukları. */
const VWP = new Set(["DE", "FR", "IT", "NL", "ES", "GB", "JP", "AT", "BE", "DK", "FI", "IE", "NO", "PT", "SE", "CH"]);

interface Rule {
  requirement: EntryRequirement;
  permitType?: string;
  /** Pasaportun varıştan sonra en az kaç ay geçerli olması gerekir (0 = yolculuk boyunca). */
  validityMonths: number;
  /** Geçerlilik eşiği altında kalmak not_ok mu, yoksa uyarı mı? */
  validityHard: boolean;
}

/** Varış ülkesi × uyruk → kural. Tablo temsilîdir (dosya başındaki uyarı). */
function ruleFor(dest: string, nat: string): Rule {
  if (nat === dest) return { requirement: "citizen", validityMonths: 0, validityHard: false };
  if (SCHENGEN.has(dest)) {
    if (FREE_MOVEMENT.has(nat)) return { requirement: "free_movement", validityMonths: 0, validityHard: false };
    // Schengen: pasaport ayrılış tarihinden sonra en az 3 ay geçerli olmalı.
    if (["US", "GB", "JP", "AE"].includes(nat)) return { requirement: "visa_free", validityMonths: 3, validityHard: true };
    return { requirement: "visa", permitType: "SCHENGEN", validityMonths: 3, validityHard: true };
  }
  switch (dest) {
    case "GB":
      if (FREE_MOVEMENT.has(nat) || ["US", "JP"].includes(nat)) return { requirement: "eta", permitType: "ETA", validityMonths: 0, validityHard: false };
      return { requirement: "visa", permitType: "UK", validityMonths: 0, validityHard: false };
    case "US":
      if (VWP.has(nat)) return { requirement: "esta", permitType: "ESTA", validityMonths: 6, validityHard: false };
      return { requirement: "visa", permitType: "US", validityMonths: 6, validityHard: false };
    case "JP":
      if (nat === "CN") return { requirement: "visa", permitType: "JP", validityMonths: 0, validityHard: false };
      return { requirement: "visa_free", validityMonths: 0, validityHard: false };
    case "AE":
      if (nat === "TR") return { requirement: "visa", permitType: "AE", validityMonths: 6, validityHard: true };
      return { requirement: "visa_free", validityMonths: 6, validityHard: true };
    default:
      return { requirement: "visa_free", validityMonths: 0, validityHard: false };
  }
}

const REQ_TEXT: Record<EntryRequirement, { tr: string; en: string }> = {
  citizen: { tr: "Vatandaş — giriş koşulu yok", en: "Citizen — no entry requirement" },
  free_movement: { tr: "Serbest dolaşım — kimlik kartı ya da pasaport yeterli", en: "Free movement — ID card or passport is sufficient" },
  visa_free: { tr: "Vizesiz giriş (kısa süreli ziyaret)", en: "Visa-free entry (short visit)" },
  eta: { tr: "Elektronik seyahat izni (UK ETA) gerekli", en: "Electronic travel authorisation (UK ETA) required" },
  esta: { tr: "ESTA onayı gerekli (Vize Muafiyet Programı)", en: "ESTA approval required (Visa Waiver Program)" },
  visa: { tr: "Vize gerekli", en: "Visa required" },
};

export function requirementText(r: EntryRequirement, lang: "tr" | "en" = "tr"): string {
  return REQ_TEXT[r][lang];
}

/** a tarihine n ay ekle (YYYY-MM-DD). */
function addMonths(isoDate: string, n: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Giriş koşulu kontrolü.
 *
 * @param destCountry  varış ülkesi (ISO-2)
 * @param originCountry kalkış ülkesi (yurt içi uçuşu ayırt etmek için)
 * @param travelDate   uçuş tarihi (YYYY-MM-DD) — geçerlilik bu tarihe göre ölçülür
 */
export function checkTravelDocs(
  facts: TravelDocFacts, destCountry: string, originCountry: string, travelDate: string,
): DocCheckResult {
  const lines: DocCheckLine[] = [];
  const day = travelDate.slice(0, 10);

  // Yurt içi uçuş: giriş koşulu yok. Vatandaş kimlikle, yabancı pasaportla uçar.
  if (destCountry === originCountry) {
    const citizen = facts.nationality === destCountry;
    const hasDoc = citizen || !!facts.passport;
    lines.push({
      code: "REQ", ok: true,
      tr: citizen ? "Yurt içi uçuş — nüfus cüzdanı / kimlik kartı yeterli" : "Yurt içi uçuş — yabancı yolcu pasaportla uçar",
      en: citizen ? "Domestic flight — national ID card is sufficient" : "Domestic flight — foreign passenger travels on passport",
    });
    if (!hasDoc) lines.push({ code: "PASSPORT", ok: false, tr: "Pasaport bilgisi yok", en: "No passport on file" });
    return { verdict: hasDoc ? "ok" : "not_ok", requirement: citizen ? "citizen" : "visa_free", destinationCountry: destCountry, lines };
  }

  const nat = facts.nationality ?? "";
  if (!nat) {
    lines.push({ code: "REQ", ok: false, tr: "Uyruk bilinmiyor — giriş koşulu sorgulanamaz", en: "Nationality unknown — entry requirement cannot be checked" });
    return withOverride({ verdict: "not_ok", requirement: "visa", destinationCountry: destCountry, lines }, facts);
  }
  const rule = ruleFor(destCountry, nat);
  lines.push({ code: "REQ", ok: true, tr: `${nat} → ${destCountry}: ${REQ_TEXT[rule.requirement].tr}`, en: `${nat} → ${destCountry}: ${REQ_TEXT[rule.requirement].en}` });

  let verdict: DocVerdict = "ok";
  const fail = () => { verdict = "not_ok"; };
  const warn = () => { if (verdict === "ok") verdict = "conditional"; };

  // Belge: serbest dolaşım ve vatandaş kimlikle girebilir; diğerleri pasaportla.
  const idCardOk = rule.requirement === "citizen" || rule.requirement === "free_movement";
  if (!facts.passport && !idCardOk) {
    lines.push({ code: "PASSPORT", ok: false, tr: "Pasaport gerekli — kayıtta pasaport yok", en: "Passport required — none on file" });
    fail();
  }

  // Pasaport geçerliliği.
  if (facts.passport) {
    if (!facts.passportExpiry) {
      lines.push({ code: "VALIDITY", ok: true, warn: true, tr: "Pasaport son geçerlilik tarihi kayıtta yok — belgeden teyit edin", en: "Passport expiry not on file — verify on the document" });
      warn();
    } else if (facts.passportExpiry < day) {
      lines.push({ code: "VALIDITY", ok: false, tr: `Pasaportun süresi dolmuş (${facts.passportExpiry})`, en: `Passport has expired (${facts.passportExpiry})` });
      fail();
    } else if (rule.validityMonths > 0 && facts.passportExpiry < addMonths(day, rule.validityMonths)) {
      const need = addMonths(day, rule.validityMonths);
      const tr = `Pasaport ${facts.passportExpiry} tarihinde bitiyor — en az ${rule.validityMonths} ay geçerlilik aranır (${need})`;
      const en = `Passport expires ${facts.passportExpiry} — at least ${rule.validityMonths} months validity required (${need})`;
      lines.push({ code: "VALIDITY", ok: !rule.validityHard, warn: !rule.validityHard, tr, en });
      if (rule.validityHard) fail(); else warn();
    } else {
      lines.push({ code: "VALIDITY", ok: true, tr: `Pasaport ${facts.passportExpiry} tarihine kadar geçerli`, en: `Passport valid until ${facts.passportExpiry}` });
    }
  }

  // İzin: vize / ETA / ESTA.
  if (rule.permitType) {
    const v = facts.visa;
    if (!v) {
      lines.push({ code: "PERMIT", ok: false, tr: `${permitName(rule.permitType, "tr")} kayıtta yok`, en: `No ${permitName(rule.permitType, "en")} on file` });
      fail();
    } else if (v.type !== rule.permitType) {
      lines.push({ code: "PERMIT", ok: false, tr: `Beyan edilen izin (${v.type}) bu varış için geçmez — ${permitName(rule.permitType, "tr")} gerekir`, en: `Declared permit (${v.type}) is not valid for this destination — ${permitName(rule.permitType, "en")} required` });
      fail();
    } else if (v.validUntil < day) {
      lines.push({ code: "PERMIT", ok: false, tr: `${permitName(v.type, "tr")} ${v.validUntil} tarihinde sona ermiş`, en: `${permitName(v.type, "en")} expired on ${v.validUntil}` });
      fail();
    } else {
      lines.push({ code: "PERMIT", ok: true, tr: `${permitName(v.type, "tr")} ${v.number} · ${v.validUntil} tarihine kadar`, en: `${permitName(v.type, "en")} ${v.number} · valid until ${v.validUntil}` });
    }
  }

  return withOverride({ verdict, requirement: rule.requirement, destinationCountry: destCountry, permitType: rule.permitType, lines }, facts);
}

/** Makam onayı not_ok'u aşar; onay satırı her zaman görünür kalır. */
function withOverride(r: DocCheckResult, facts: TravelDocFacts): DocCheckResult {
  if (!facts.okToBoard) return r;
  const line: DocCheckLine = {
    code: "OTB", ok: true, warn: r.verdict !== "ok",
    tr: `OK TO BOARD — makam onayı ${facts.okToBoard.ref} (${facts.okToBoard.by})`,
    en: `OK TO BOARD — authority approval ${facts.okToBoard.ref} (${facts.okToBoard.by})`,
  };
  return { ...r, verdict: r.verdict === "not_ok" ? "conditional" : r.verdict, lines: [...r.lines, line] };
}

const PERMIT_NAMES: Record<string, { tr: string; en: string }> = {
  SCHENGEN: { tr: "Schengen vizesi", en: "Schengen visa" },
  UK: { tr: "Birleşik Krallık vizesi", en: "UK visa" },
  US: { tr: "ABD vizesi", en: "US visa" },
  AE: { tr: "BAE vizesi", en: "UAE visa" },
  JP: { tr: "Japonya vizesi", en: "Japan visa" },
  ETA: { tr: "UK ETA", en: "UK ETA" },
  ESTA: { tr: "ESTA", en: "ESTA" },
};

export function permitName(type: string, lang: "tr" | "en" = "tr"): string {
  return PERMIT_NAMES[type]?.[lang] ?? type;
}

/** Gişede seçilebilecek izin türleri. */
export const PERMIT_TYPES = Object.keys(PERMIT_NAMES);
