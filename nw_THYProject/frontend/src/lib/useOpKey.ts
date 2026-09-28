import { useRef } from "react";
import { newIdempotencyKey } from "@/domain/api";

/**
 * Para/statü işlemi için idempotency anahtarı (CLAUDE.md kural 5 ve 9).
 *
 * Anahtar işlem AÇILIRKEN üretilir ve aynı işlemin tekrar denemelerinde
 * (çift tıklama, hata sonrası yeniden deneme) AYNI kalır; sunucu aynı
 * anahtara aynı sonucu döner. Başarıdan sonra `rotate()` ile yenilenir —
 * aynı ekrandan yapılan sonraki işlem yeni bir işlemdir.
 *
 * Önce anahtar `mutationFn` içinde her çağrıda yeniden üretiliyordu: hızlı
 * bir çift tıklama iki ayrı satış (iki bilet, iki EMD) doğuruyordu.
 */
export function useOpKey() {
  const ref = useRef<string>("");
  if (!ref.current) ref.current = newIdempotencyKey();
  return {
    key: () => ref.current,
    rotate: () => { ref.current = newIdempotencyKey(); },
  };
}

/**
 * Satır başına anahtar — aynı listedeki farklı kayıtlar (ör. her PTA satırındaki
 * "Bilete çevir") ayrı işlemdir, aynı kayda çift tıklama ise tek işlemdir.
 */
export function useOpKeys() {
  const ref = useRef(new Map<string, string>());
  return {
    key: (id: string) => {
      let k = ref.current.get(id);
      if (!k) { k = newIdempotencyKey(); ref.current.set(id, k); }
      return k;
    },
    rotate: (id: string) => { ref.current.delete(id); },
  };
}
