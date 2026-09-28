import type { QueryClient } from "@tanstack/react-query";

/**
 * Kayıttan TÜREYEN bütün sorgular. Para/statü işlemi bir bileti, EMD'yi,
 * PNR'ı ya da uçuşu değiştirdiğinde bunların hepsi bayatlayabilir: bilet
 * ekranı, EMD kartı, order detayı, raporlar, kuyruklar, PNR, check-in ve
 * HUB panosu. Önce her ekran kendi (eksik) listesini tazeliyordu — EMD kesilince
 * bilet ekranındaki EMD kartı, iade sonrası order detayı, kesim sonrası PNR
 * ve raporlar eski hâlini gösteriyordu. Yalnız ekranda olan sorgular yeniden
 * çekilir; gerisi bir sonraki açılışta tazelenir.
 */
const RECORD_KEYS = [
  "ticket", "tickets", "ticketsAll", "group", "stats",
  "emd", "emds", "emdsFor", "order", "orders",
  "tx", "txAll", "txFin", "closedPeriods", "auditLog", "revenueAlerts",
  "queues", "upcomingFlights", "memos", "memosFor", "ptas",
  "pnr", "pnrs", "pnrsAll",
  "flight", "flights", "pax", "paxSearch", "seatmap", "desk", "opsBoard",
];

export function invalidateRecords(qc: QueryClient): void {
  for (const k of RECORD_KEYS) qc.invalidateQueries({ queryKey: [k] });
}
