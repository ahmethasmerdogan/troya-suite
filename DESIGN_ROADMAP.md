# Troya — Arayüz Tasarım Yol Haritası (DESIGN_ROADMAP)

> Arayüzün *mühendisliği* ana `TROYA_ETICKET_ROADMAP.md`'de; görsel *tasarım dili* `DESIGN_SYSTEM.md`'de (tek kaynak gerçeği). Bu dosya: bilgi mimarisi, ekran tasarımları, etkileşim desenleri.
>
> **Durum:** Açık kararlar verildi (kullanıcı delegasyonuyla). `✓ KARAR` = sabitlendi. Değiştirmek istediğin olursa söyle, revize ederiz.

---

## 1. Tasarım prensipleri / kuzey yıldızı

`✓ KARAR` — 5 prensip:
1. **Profesyonel ama sıkıcı değil.** Havacılığın ciddiyeti + 2026 minimalizmi. Agent "vay be" desin.
2. **Uzman hızı önce, acemi keşfedilebilirliği hemen arkasında.** Her ekran hem klavyeyle uçulabilir (gişe) hem tıklayarak öğrenilebilir (çağrı merkezi) olmalı.
3. **Bilgi-yoğun ama sakin.** Dense layout + bol beyaz boşluk + tek accent. Patlama yok.
4. **State her zaman görünür.** Kupon statüsü, control, yaşam döngüsü — kullanıcı "ne durumda" diye düşünmesin, görsün.
5. **Hata maliyeti yüksek; güven inşa et.** Geri-alınamaz işlemlerde net özet + onay; backend validation'ı alan altında göster.

---

## 2. Bilgi mimarisi & navigasyon (IA)

`✓ KARAR` — **Topbar (h-14):** THY logo (sol) · global akıllı arama + `⌘K` ipucu (orta) · agent/istasyon göstergesi + bildirim + avatar (sağ).

`✓ KARAR` — **Sidebar (256px), UPPERCASE section'lar:**
```
BİLETLEME    → Bilet Kes (Issue) · Bilet Ara (Search)
İŞLEMLER     → Exchange/Reissue · Refund · Void
DOKÜMANLAR   → EMD / Ancillary
INTERLINE    → Mesajlar · Bilateral Anlaşmalar
YÖNETİM      → Kullanıcılar · Loglar · Ayarlar
```
Aktif item: accent sol indicator + `bg-surface` + ince border. (Faz 7'de **Order** üst-seviye nav öğesi olur.)

`✓ KARAR` — **Command palette (⌘K) kapsamı:** "Yeni bilet", "Bilet ara: TKT…", "PNR aç", "Exchange başlat", "Refund başlat", "Void", "EMD ekle", sayfaya git (Bilet Ara / İşlemler…), son açılan biletler. Fuzzy search + son işlemler grubu.

---

## 3. Ekran envanteri (tasarım notları)

| # | Ekran | Tip | `✓` Tasarım |
|---|---|---|---|
| 3.1 | **Issue wizard** | Full-screen multi-step | 4 adım: Yolcu → Segment(ler) → Fare/Ödeme → Onay. Üstte progress; her adımda inline validation; sağda canlı "bilet özeti" paneli. Uzman için `⌘K → Yeni bilet` ile aynı akışa hızlı giriş. |
| 3.2 | **Ticket detail** | Detay | Header: TKT no (mono) + yolcu + **control indicator**. Kupon **grid'i**: her satır segment + **status pill** (§DESIGN_SYSTEM 9.1) + NVB/NVA. Sağda aksiyon (Exchange/Refund/Void → drawer). Altta **lifecycle timeline** (3.4) ve fare breakdown (3.9). |
| 3.3 | **Search / sonuç** | Liste | Tek **akıllı arama çubuğu** (girdi TKT no mu yoksa diğer kriter mi otomatik algılar) + "Gelişmiş" paneli (Date+O/D+Name, FF ref, kart, conf. no, telefon, FOID). Sonuç **TanStack Table** grid'i; satır → detay. |
| 3.4 | **Lifecycle timeline** | Görselleştirme | Dikey; status-renkli dot + connector çizgi; event adı + aktör/carrier + zaman (mono). Exchange'de eski→yeni bilet **linkage kartı** (accent-soft). Hover'da dark popover. Geçmiş soluk, güncel opak. Event source'tan beslenir; SSE ile canlı. |
| 3.5 | **Itinerary/Receipt** | Belge | Yolcuya verilecek çıktının önizlemesi; Conditions of Contract + Mandatory Notices (App B); TR/EN; Yazdır/PDF. |
| 3.6 | **Exchange/Reissue** | Sağ drawer | Eski bilet özeti → yeni segment/fare; **fare farkı/ADC** big-number two-tone; "ne olacak" özeti (eski kuponlar `E`, yeni TKT, linkage); geri-alınamaz onay adımı. |
| 3.7 | **Refund** | Sağ drawer | İade edilecek kupon(lar); refund tutarı + residual; "ne olacak" (`R`); onay. |
| 3.8 | **Void** | Modal | Ön koşul kontrolü (tüm kuponlar `O` değilse engelle + sebebini göster); özet + geri-alınamaz onay. |
| 3.9 | **Fare/TFC breakdown** | Panel | Fare calc string, NUC/ROE; TFC dökümü (tax code mono + tutar two-tone); TOT. |
| 3.10 | **EMD/Ancillary** | Panel/drawer | EMD-A (bilete bağlı) / EMD-S; RFISC seçimi; kendi status pill'i. |
| 3.11 | **Interline / mesaj log** | İzleme | Gönderilen/alınan mesajlar (EDIFACT/NDC) zaman çizgisi; control transfer durumu; bilateral anlaşma listesi. |
| 3.12 | **Order view (Faz 7)** | Detay | Order ana nesne; Ticket/EMD altında fulfillment olarak; aynı tasarım dili. |

---

## 4. Component envanteri / kütüphane

`✓ KARAR` — **shadcn/ui + Tailwind** (Radix tabanlı, erişilebilir, headless). Detaylı token/override → `DESIGN_SYSTEM.md`.

`✓ KARAR` — özel domain component'leri: `StatusBadge` (pill, §9.1), `CouponTimeline`, `FareBreakdown` (two-tone), `MoneyDelta` (ADC/refund farkı), `ControlIndicator`, `PassengerCard`, `SegmentRow`, `SmartSearchBar`, `CommandPalette` (cmdk), `ConfirmDestructive` (geri-alınamaz onay). Yoğun bileşenler: TanStack Table (grid), shadcn date picker, mono para input.

---

## 5. Tasarım token'ları / görsel dil

`✓ KARAR` — **`DESIGN_SYSTEM.md` tek kaynak.** Özet: tek accent **`#2563EB` (mavi)** — THY kırmızısı danger semantiği olduğu için primary yapılmadı; THY kimliği logo + (opsiyonel) yapısal navy ile. Geist Sans/Mono; big-number two-tone; soft pill'ler; gölgesiz card + `#E0E2E6` border; skeleton; alttan dark toast; 1.75 ikon stroke. **Statü renk semantiği §9.1'de final.**

---

## 6. Etkileşim desenleri

`✓ KARAR`:
- **Akış tipleri:** Issue = **full-screen wizard** (+ ⌘K hızlı kesim). Değişiklikler (exchange/refund) = **sağ drawer** (bilet görünürken). Void = **modal**. Onaylar = özet + **"geri alınamaz" uyarısı**.
- **Klavye kısayolları:** `⌘/Ctrl+K` palette · `/` arama odağı · `n` yeni bilet · `g t` Bilet Ara · biletteyken `e` exchange / `r` refund / `v` void · `Esc` drawer/modal kapat.
- **Command palette:** fuzzy, son işlemler, aksiyon grupları; klavyeyle tam gezinilebilir.

---

## 7. Kupon yaşam döngüsü timeline + statü renk semantiği

`✓ KARAR` — **Statü renk mapping'i `DESIGN_SYSTEM.md §9.1` ile FINAL:** `O/A/C/L`→info(mavi), `I/S/U/Y`→warning(amber), `N`→neutral, `F`→success(✓), `E/G/P/X`→neutral(final), `R/V/Z`→danger, `T`→neutral. Aynı bucket'takiler pill etiketiyle ayrışır; final statülere kilit ikonu.

`✓ KARAR` — **Timeline:** dikey, dot+connector, event+aktör+zaman(mono), exchange linkage kartı, hover dark popover, geçmiş soluk/güncel opak (§3.4).

---

## 8. Durumlar (states)

`✓ KARAR`: Loading = **skeleton** (spinner yok). Error = backend validation **alan altında** (genel hata değil). Success = özet + "ne oldu". Para işleminde **optimistic UI yok** (sunucu sonucu beklenir).

---

## 9. Erişilebilirlik & responsive

`✓ KARAR`: **WCAG 2.1 AA**; tam klavye navigasyonu; ARIA; kontrast.
`✓ KARAR` — cihaz: **Masaüstü öncelik** (gişe agent'ı). Tablet kabul (gate). Mobil = okuma/arama (self-service ileride).

---

## 10. Prototip & teslim sırası

`✓ KARAR`:
1. **FE-1 önce:** Issue wizard + Ticket detail (status pill'ler + control indicator) — çekirdek deneyim.
2. Sonra **FE-2:** Smart search + lifecycle timeline.
3. Teslim: Claude ile **tıklanabilir React prototip** (mock veriyle), DESIGN_SYSTEM'e sadık; backend hazır oldukça gerçek API'ye bağlanır.

> Hazırsan ilk tıklanabilir prototipi (FE-1) bu kararlarla çıkarabilirim.
