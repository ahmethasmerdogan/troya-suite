// THY (Turkish Airlines) destinasyon havalimanları — IATA kodu + şehir + ülke.
// Mock/prototip için temsili bir alt küme (gerçekte 340+ destinasyon).
// Autocomplete: kod, şehir (TR/EN) veya ülke ile aranır.

export interface Airport {
  code: string; // IATA 3-letter
  city: string; // TR şehir adı
  cityEn: string; // EN şehir adı
  country: string; // TR ülke adı
  countryCode: string; // ISO-2
}

export const AIRPORTS: Airport[] = [
  // Türkiye
  { code: "IST", city: "İstanbul", cityEn: "Istanbul", country: "Türkiye", countryCode: "TR" },
  { code: "SAW", city: "İstanbul (Sabiha Gökçen)", cityEn: "Istanbul (Sabiha)", country: "Türkiye", countryCode: "TR" },
  { code: "ESB", city: "Ankara", cityEn: "Ankara", country: "Türkiye", countryCode: "TR" },
  { code: "ADB", city: "İzmir", cityEn: "Izmir", country: "Türkiye", countryCode: "TR" },
  { code: "AYT", city: "Antalya", cityEn: "Antalya", country: "Türkiye", countryCode: "TR" },
  { code: "ADA", city: "Adana", cityEn: "Adana", country: "Türkiye", countryCode: "TR" },
  { code: "TZX", city: "Trabzon", cityEn: "Trabzon", country: "Türkiye", countryCode: "TR" },
  { code: "GZT", city: "Gaziantep", cityEn: "Gaziantep", country: "Türkiye", countryCode: "TR" },
  { code: "DLM", city: "Dalaman", cityEn: "Dalaman", country: "Türkiye", countryCode: "TR" },
  { code: "BJV", city: "Bodrum", cityEn: "Bodrum", country: "Türkiye", countryCode: "TR" },
  { code: "DIY", city: "Diyarbakır", cityEn: "Diyarbakir", country: "Türkiye", countryCode: "TR" },
  { code: "VAN", city: "Van", cityEn: "Van", country: "Türkiye", countryCode: "TR" },
  { code: "ERZ", city: "Erzurum", cityEn: "Erzurum", country: "Türkiye", countryCode: "TR" },
  { code: "KYA", city: "Konya", cityEn: "Konya", country: "Türkiye", countryCode: "TR" },
  { code: "NAV", city: "Nevşehir", cityEn: "Nevsehir", country: "Türkiye", countryCode: "TR" },
  // Avrupa
  { code: "LHR", city: "Londra", cityEn: "London", country: "Birleşik Krallık", countryCode: "GB" },
  { code: "CDG", city: "Paris", cityEn: "Paris", country: "Fransa", countryCode: "FR" },
  { code: "FRA", city: "Frankfurt", cityEn: "Frankfurt", country: "Almanya", countryCode: "DE" },
  { code: "MUC", city: "Münih", cityEn: "Munich", country: "Almanya", countryCode: "DE" },
  { code: "BER", city: "Berlin", cityEn: "Berlin", country: "Almanya", countryCode: "DE" },
  { code: "AMS", city: "Amsterdam", cityEn: "Amsterdam", country: "Hollanda", countryCode: "NL" },
  { code: "FCO", city: "Roma", cityEn: "Rome", country: "İtalya", countryCode: "IT" },
  { code: "MXP", city: "Milano", cityEn: "Milan", country: "İtalya", countryCode: "IT" },
  { code: "MAD", city: "Madrid", cityEn: "Madrid", country: "İspanya", countryCode: "ES" },
  { code: "BCN", city: "Barselona", cityEn: "Barcelona", country: "İspanya", countryCode: "ES" },
  { code: "VIE", city: "Viyana", cityEn: "Vienna", country: "Avusturya", countryCode: "AT" },
  { code: "ZRH", city: "Zürih", cityEn: "Zurich", country: "İsviçre", countryCode: "CH" },
  { code: "GVA", city: "Cenevre", cityEn: "Geneva", country: "İsviçre", countryCode: "CH" },
  { code: "BRU", city: "Brüksel", cityEn: "Brussels", country: "Belçika", countryCode: "BE" },
  { code: "CPH", city: "Kopenhag", cityEn: "Copenhagen", country: "Danimarka", countryCode: "DK" },
  { code: "ARN", city: "Stockholm", cityEn: "Stockholm", country: "İsveç", countryCode: "SE" },
  { code: "OSL", city: "Oslo", cityEn: "Oslo", country: "Norveç", countryCode: "NO" },
  { code: "ATH", city: "Atina", cityEn: "Athens", country: "Yunanistan", countryCode: "GR" },
  { code: "LIS", city: "Lizbon", cityEn: "Lisbon", country: "Portekiz", countryCode: "PT" },
  { code: "WAW", city: "Varşova", cityEn: "Warsaw", country: "Polonya", countryCode: "PL" },
  { code: "PRG", city: "Prag", cityEn: "Prague", country: "Çekya", countryCode: "CZ" },
  { code: "BUD", city: "Budapeşte", cityEn: "Budapest", country: "Macaristan", countryCode: "HU" },
  { code: "SOF", city: "Sofya", cityEn: "Sofia", country: "Bulgaristan", countryCode: "BG" },
  { code: "OTP", city: "Bükreş", cityEn: "Bucharest", country: "Romanya", countryCode: "RO" },
  { code: "KBP", city: "Kiev", cityEn: "Kyiv", country: "Ukrayna", countryCode: "UA" },
  { code: "DUB", city: "Dublin", cityEn: "Dublin", country: "İrlanda", countryCode: "IE" },
  { code: "MAN", city: "Manchester", cityEn: "Manchester", country: "Birleşik Krallık", countryCode: "GB" },
  // Orta Doğu & Afrika
  { code: "DXB", city: "Dubai", cityEn: "Dubai", country: "BAE", countryCode: "AE" },
  { code: "AUH", city: "Abu Dabi", cityEn: "Abu Dhabi", country: "BAE", countryCode: "AE" },
  { code: "DOH", city: "Doha", cityEn: "Doha", country: "Katar", countryCode: "QA" },
  { code: "JED", city: "Cidde", cityEn: "Jeddah", country: "Suudi Arabistan", countryCode: "SA" },
  { code: "RUH", city: "Riyad", cityEn: "Riyadh", country: "Suudi Arabistan", countryCode: "SA" },
  { code: "TLV", city: "Tel Aviv", cityEn: "Tel Aviv", country: "İsrail", countryCode: "IL" },
  { code: "CAI", city: "Kahire", cityEn: "Cairo", country: "Mısır", countryCode: "EG" },
  { code: "BEY", city: "Beyrut", cityEn: "Beirut", country: "Lübnan", countryCode: "LB" },
  { code: "AMM", city: "Amman", cityEn: "Amman", country: "Ürdün", countryCode: "JO" },
  { code: "JNB", city: "Johannesburg", cityEn: "Johannesburg", country: "Güney Afrika", countryCode: "ZA" },
  { code: "NBO", city: "Nairobi", cityEn: "Nairobi", country: "Kenya", countryCode: "KE" },
  { code: "ADD", city: "Addis Ababa", cityEn: "Addis Ababa", country: "Etiyopya", countryCode: "ET" },
  { code: "CMN", city: "Kazablanka", cityEn: "Casablanca", country: "Fas", countryCode: "MA" },
  // Asya
  { code: "NRT", city: "Tokyo (Narita)", cityEn: "Tokyo (Narita)", country: "Japonya", countryCode: "JP" },
  { code: "HND", city: "Tokyo (Haneda)", cityEn: "Tokyo (Haneda)", country: "Japonya", countryCode: "JP" },
  { code: "ICN", city: "Seul", cityEn: "Seoul", country: "Güney Kore", countryCode: "KR" },
  { code: "PEK", city: "Pekin", cityEn: "Beijing", country: "Çin", countryCode: "CN" },
  { code: "PVG", city: "Şanghay", cityEn: "Shanghai", country: "Çin", countryCode: "CN" },
  { code: "HKG", city: "Hong Kong", cityEn: "Hong Kong", country: "Hong Kong", countryCode: "HK" },
  { code: "BKK", city: "Bangkok", cityEn: "Bangkok", country: "Tayland", countryCode: "TH" },
  { code: "SIN", city: "Singapur", cityEn: "Singapore", country: "Singapur", countryCode: "SG" },
  { code: "KUL", city: "Kuala Lumpur", cityEn: "Kuala Lumpur", country: "Malezya", countryCode: "MY" },
  { code: "DEL", city: "Yeni Delhi", cityEn: "New Delhi", country: "Hindistan", countryCode: "IN" },
  { code: "BOM", city: "Mumbai", cityEn: "Mumbai", country: "Hindistan", countryCode: "IN" },
  { code: "TAS", city: "Taşkent", cityEn: "Tashkent", country: "Özbekistan", countryCode: "UZ" },
  { code: "GYD", city: "Bakü", cityEn: "Baku", country: "Azerbaycan", countryCode: "AZ" },
  { code: "ALA", city: "Almatı", cityEn: "Almaty", country: "Kazakistan", countryCode: "KZ" },
  // Amerika
  { code: "JFK", city: "New York (JFK)", cityEn: "New York (JFK)", country: "ABD", countryCode: "US" },
  { code: "EWR", city: "New York (Newark)", cityEn: "New York (Newark)", country: "ABD", countryCode: "US" },
  { code: "ORD", city: "Chicago", cityEn: "Chicago", country: "ABD", countryCode: "US" },
  { code: "LAX", city: "Los Angeles", cityEn: "Los Angeles", country: "ABD", countryCode: "US" },
  { code: "IAD", city: "Washington", cityEn: "Washington", country: "ABD", countryCode: "US" },
  { code: "MIA", city: "Miami", cityEn: "Miami", country: "ABD", countryCode: "US" },
  { code: "YYZ", city: "Toronto", cityEn: "Toronto", country: "Kanada", countryCode: "CA" },
  { code: "GRU", city: "São Paulo", cityEn: "Sao Paulo", country: "Brezilya", countryCode: "BR" },
  { code: "EZE", city: "Buenos Aires", cityEn: "Buenos Aires", country: "Arjantin", countryCode: "AR" },
  { code: "MEX", city: "Meksiko", cityEn: "Mexico City", country: "Meksika", countryCode: "MX" },
];

const norm = (s: string) =>
  s.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");

const BY_CODE = new Map(AIRPORTS.map((a) => [a.code, a]));
export function airportByCode(code?: string): Airport | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined;
}

/** Kod / şehir (TR-EN) / ülke ile fuzzy arama. Kod eşleşmeleri öne. */
export function searchAirports(query: string, limit = 8): Airport[] {
  const q = norm(query.trim());
  if (!q) return AIRPORTS.slice(0, limit);
  const scored = AIRPORTS.map((a) => {
    const code = a.code.toLowerCase();
    const hay = norm(`${a.code} ${a.city} ${a.cityEn} ${a.country}`);
    let score = -1;
    if (code === q) score = 100;
    else if (code.startsWith(q)) score = 90;
    else if (norm(a.city).startsWith(q) || norm(a.cityEn).startsWith(q)) score = 80;
    else if (hay.includes(q)) score = 50;
    return { a, score };
  }).filter((x) => x.score >= 0);
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, limit).map((x) => x.a);
}
