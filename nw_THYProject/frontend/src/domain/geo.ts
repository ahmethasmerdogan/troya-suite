/**
 * Havalimanı koordinatları ve büyük daire mesafesi.
 *
 * Tazminat bantları (EU261 md. 7(4), SHY-YOLCU, UK261) mesafeyi "büyük daire
 * yöntemiyle" ölçer. `pricing.routeDistanceKm` fiyatlama için kod-hash'ten
 * türeyen sözde bir mesafedir; hak hesabında KULLANILMAZ.
 *
 * Değerler ARP (havalimanı referans noktası) yaklaşık enlem/boylamıdır —
 * bant sınırlarından (1500 / 3500 km) uzak rotalarda sonuç kesindir.
 */
const COORDS: Record<string, [number, number]> = {
  IST: [41.275, 28.752], SAW: [40.899, 29.309], ESB: [40.128, 32.995], ADB: [38.292, 27.157],
  AYT: [36.899, 30.8], ADA: [36.982, 35.28], TZX: [40.995, 39.79], GZT: [36.947, 37.479],
  DLM: [36.713, 28.793], BJV: [37.251, 27.664], DIY: [37.894, 40.201], VAN: [38.468, 43.332],
  ERZ: [39.957, 41.17], KYA: [37.979, 32.562], NAV: [38.772, 34.535],
  LHR: [51.47, -0.454], CDG: [49.01, 2.548], FRA: [50.033, 8.571], MUC: [48.354, 11.786],
  BER: [52.366, 13.503], AMS: [52.31, 4.768], FCO: [41.8, 12.239], MXP: [45.63, 8.723],
  MAD: [40.472, -3.561], BCN: [41.297, 2.078], VIE: [48.11, 16.57], ZRH: [47.465, 8.549],
  GVA: [46.238, 6.109], BRU: [50.901, 4.484], CPH: [55.618, 12.656], ARN: [59.652, 17.919],
  OSL: [60.194, 11.1], ATH: [37.936, 23.947], LIS: [38.774, -9.134], WAW: [52.166, 20.967],
  PRG: [50.101, 14.26], BUD: [47.439, 19.262], SOF: [42.697, 23.411], OTP: [44.571, 26.085],
  KBP: [50.345, 30.895], DUB: [53.421, -6.27], MAN: [53.354, -2.275],
  DXB: [25.253, 55.366], AUH: [24.433, 54.651], DOH: [25.273, 51.608], JED: [21.68, 39.157],
  RUH: [24.958, 46.699], TLV: [32.011, 34.887], CAI: [30.122, 31.406], BEY: [33.821, 35.488],
  AMM: [31.723, 35.993], JNB: [-26.139, 28.246], NBO: [-1.319, 36.928], ADD: [8.978, 38.799],
  CMN: [33.367, -7.59], NRT: [35.772, 140.393], HND: [35.549, 139.78], ICN: [37.46, 126.441],
  PEK: [40.08, 116.585], PVG: [31.144, 121.808], HKG: [22.308, 113.918], BKK: [13.69, 100.75],
  SIN: [1.364, 103.991], KUL: [2.746, 101.71], DEL: [28.556, 77.1], BOM: [19.089, 72.868],
  TAS: [41.258, 69.281], GYD: [40.467, 50.047], ALA: [43.352, 77.04],
  JFK: [40.641, -73.778], EWR: [40.69, -74.174], ORD: [41.974, -87.907], LAX: [33.942, -118.408],
  IAD: [38.953, -77.456], MIA: [25.796, -80.287], YYZ: [43.678, -79.625], GRU: [-23.435, -46.473],
  EZE: [-34.822, -58.536], MEX: [19.436, -99.072],
};

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** İki havalimanı arası büyük daire mesafesi (km, yuvarlanmış). Bilinmeyen kodda undefined. */
export function greatCircleKm(from: string, to: string): number | undefined {
  const a = COORDS[from.toUpperCase()];
  const b = COORDS[to.toUpperCase()];
  if (!a || !b) return undefined;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R_KM * Math.asin(Math.sqrt(h)));
}

export function hasCoords(code: string): boolean {
  return code.toUpperCase() in COORDS;
}
