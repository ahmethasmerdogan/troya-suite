# Troya Suite — Experience v2 (Frontend)

**Birleşik panel** — THY çalışma modeline göre modüller tek çalışma alanında (üstte modül seçici):
**QuickRes** (Rezervasyon) · **Troya** (Biletleme) · **QuickCheck-in** (Check-in/DCS) · **Panel** · **Yönetim** · **Mesajlaşma**. Hepsi aynı motora oturan tıklama yüzeyleri ("tek komut, iki yüzey"). Tamamı **tıklanabilir prototip**: veriler bellek-içi mock domain'den gelir, sayfa yenilenince sıfırlanır.

Stack: Vite + React 18 + TS · Tailwind v4 · HashUI bileşen kiti (`src/ui/`) · TanStack Router/Query/Table · Zustand · React Hook Form + Zod · cmdk · Lucide. **i18n: TR/EN** (`src/i18n/`; anahtarlar derleme zamanında tip kontrollü, eksik çeviri `tsc` hatasıdır).

Görsel dil tek kaynak: [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). IATA kapsam denetimi: [`../IATA_KAPSAM_DENETIMI.md`](../IATA_KAPSAM_DENETIMI.md).

## Modüller

- **Panel** (`/`) — KPI'lar, haftalık kesim, bugünün işleri, istasyon duyuruları.
- **QuickRes** (`/res`, `/res/new`, `/res/availability`, `/res/:pnr`) — PNR arama, oluşturma sihirbazı, sefer programından uygunluk, PNR komutları (XI güzergâh iptali, XE segment iptali, TTL uzatma, RM/OSI notları, RH geçmişi); PNR'dan yolcu başına bilet kesimi.
- **Troya** — biletleme ve satış sonrası:
  - `/issue` 5 adımlı kesim (Yolcu → Sefer → Ücret → Ödeme → Onay); uçuş ve ücret sistem listesinden **seçilir**, elle yazılmaz; grup/aile kesimi (en çok 9 yolcu, hepsi-ya-da-hiçbiri).
  - `/tickets/:n` bilet kaydı: kuponlar ve statü pill'leri, kontrol göstergesi, yaşam döngüsü, ücret/TFC/KDV dökümü; exchange, refund, void, EMD, ciro, IRROP, no-show, revalidation, kağıda basma, print exchange, ad düzeltme, geçerlilik uzatma, askıya alma, kontrol devri, yolcu hakları hesabı.
  - `/search`, `/itinerary/:n`, `/emds`, `/orders`, `/pta`, `/memos` (ADM/ACM), `/messages`, `/agreements`, `/queues`, `/schedule-change`.
  - Raporlar: `/reports` merkezi, `/report` satış/işlem, `/report/financial` mali, `/report/period` dönem kapanışı ve kapanış belgesi.
- **QuickCheck-in** (`/checkin`) — kontuar ekranı (uçuşlar arası yolcu arama), kabul penceresi ve süpervizör onaylı geç kabul, seyahat belgesi / APIS kontrolü, uçak tipine özgü koltuk haritası ve koltuk uygunluk kuralları, biniş, uçuş kapanışı (binenler `F`), biniş kartı; `/ops` HUB kontrol panosu, `/service-map`.
- **Yönetim** (`/admin/:section`) — kullanıcılar, roller ve yetkiler, denetim kaydı, gelir koruma, ayarlar; `/profile`.
- **Mesajlaşma** (`/chat`) — gerçek zamanlı personel sohbeti (sekmeler arası), kanallar, bilet iliştirme, çevrimiçi durumu.

Her ekranda ⌘K komut paleti, klavye kısayolları (bilet kaydında `e` / `r` / `v`), üst çubukta ekran yardımı ve isteğe bağlı ekran turları var.

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm test           # Vitest (birim + bileşen)
npm run e2e        # Playwright (uçtan uca)
npm run build      # tsc + vite build
```

## Yayın

Vercel projesi GitHub deposuna bağlı: `main`'e her push canlıya, diğer dallar önizleme adresine çıkar. Depo kökündeki `vercel.json` bu klasörü derler; güvenlik başlıkları ve SPA yönlendirmesi bu klasördeki `vercel.json` ile aynı tutulur (`src/test/vercelConfig.test.ts` farkı yakalar). CI'da `Experience v2 (React)` işi tip kontrolü, testler ve derlemeyi çalıştırır.

## Mimari notlar

- `src/domain/` — tipler, kural modülleri (ücret, iade, reissue, vergi, KDV, koltuk, belge, geçerlilik, yolcu hakları…) ve bellek-içi mock sunucu (`api.ts`, `checkin.ts`, `reservation.ts`, `memos.ts`…). Her modülün testi yanında. Arayüz iş kuralı taşımaz; mock sunucu, arayüz atlatılsa bile kuralları kendisi uygular.
- `src/components/` — `ui/` (formlar, seçiciler, yüzeyler), `domain/` (statü, para, belge bileşenleri), `flows/` (bilet işlemleri), `layout/` (kabuk), `checkin/`, `tips/` (tur ve ipuçları).
- Tipler bugün elle yazılı (`src/domain/types.ts`); arayüz canlı motora bağlandığında [`contracts/openapi.yaml`](../../contracts/openapi.yaml)'dan `openapi-typescript` ile üretilecek.
