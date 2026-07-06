# Troya Suite — Kapsamlı Gap Analizi (2026-07-06)

> İki paralel araştırmanın birleşik raporu: **(A)** IATA Ticketing Handbook (39. baskı) ↔ kod kıyası (3. tur; Ch 1, 2, 5, 12, 13, 15, App B okundu) ve **(B)** 2025–2026 sektör araştırması (Amadeus Altéa/Nevio, Sabre/SabreMosaic, Navitaire Stratos, Hitit Crane PAX, IATA ONE Order/NDC — 12+ kaynak).
> Bu turda **kapatılanlar** aşağıda işaretli; kalanlar öncelik sırasıyla backlog'dur.

## 1. Bu turda KAPATILANLAR ✅ (2026-07-06)

| # | Eksik / Yanlış | Kaynak | Yapılan |
|---|---|---|---|
| 1 | **`A→P` geçişi handbook'a AYKIRIYDI** — print yalnız "open for use" kupondan (1.3.3) | A-(c1) | FSM'lerden (FE+BE) `A→P` kaldırıldı; `printToPaper` + drawer yalnız `O` kabul eder |
| 2 | **İade uygunluğu dardı/sapmalıydı** — handbook `O/A/Y` der (1.3.5); kod yalnız `O`, üstelik `S→R` vardı | A-(c2) | FSM'e `A→R` eklendi, `S→R` kaldırıldı; `refundTicket` + drawer `O/A/Y` kabul eder |
| 3 | **`Y` (Refund TFC) ölü statüydü** — giren geçiş yoktu; vergi-iadesi akışı yoktu (1.1.4.1) | A-(b2) Kritik | FSM'e `O→Y` eklendi (FE+BE); RefundDrawer'a **"Yalnız vergi iadesi (TFC)"** kapsamı — kupon `O→Y→R`, öneri tutarı TFC payından |
| 4 | **EMD-A ↔ ET kupon senkronu yoktu** (5.2.2/5.3) + final kupona EMD-A kesilebiliyordu (5.8) | A-(b1) Kritik | `cascadeEmdA`: ET kuponu C/L/F/E/R/V oldukça bağlı EMD-A kuponu izler (check-in/refund/exchange/void'de); `addEmd` final ET kuponuna EMD-A'yı reddeder |
| 5 | **SAC yoktu** — Settlement Authorisation Code (1.3.6) | A-(b3) Orta | Kupon `E/F/P/V` finaline geçince 14 karakterlik SAC üretilir (`2350`+10); TicketDetail kupon şeridinde görünür |
| 6 | **Sıralı kupon kullanımı zorlanmıyordu** (1.1.4.4/2.4.2) | A-(b8) Orta | `advanceCouponStatus`: önceki kupon `O` iken sonraki kupona C/L/F reddedilir (out-of-sequence hatası) |
| 7 | **TTL (Ticketing Time Limit) yoktu** — sektör standardı (SSR ADTK) | B-2 | `Pnr.ttl` + `ttlState()`; PNR listesinde TTL rozeti (ok/uyarı/doldu), PNR detayında uyarı bandı; `createPnr` 72 saat TTL atar |
| 8 | **İade→voucher/travel-credit yoktu** — COVID sonrası sektör standardı | B-4 | RefundDrawer **"Voucher / travel credit (EMD-S)"** yöntemi — iade tutarı RFISC `99I` EMD-S olarak kesilir, bilete iliştirilir |
| 9 | **Chat hazır-cevaplıydı** | Kullanıcı | Gerçek mesajlaşma: BroadcastChannel + localStorage, gerçek presence (kalp atışı), "yazıyor…", okunmamış rozetleri (rail/topbar), kullanıcılar = gerçek demo hesapları |

Test durumu: **106 vitest + 17 e2e + tsc + build** yeşil; backend `gradle build` (FSM hizası dahil) yeşil.

## 2. KALAN eksikler — öncelik sırasıyla backlog

### Kritik / Yüksek
1. **Kuyruk (queue) yönetimi** — ticketing/schedule-change/TTL/QC kuyrukları; tüm PSS'lerde günlük iş dağıtım mekanizması. Event-sourced yapıya read-model olarak iyi oturur. (B-1, **M**)
2. **Toplu involuntary reissue** — uçuş iptalinde etkilenen TÜM biletleri tek aksiyonla yeniden düzenleme (Amadeus FXI/`SKCHG`); HUB alert → "tümünü reissue" akışı. (B-3, **M**)
3. **Airport Control komut katmanı** — control grant/return backend komutu (72 saat lease + I-uzatma ≤7 gün, 1.1.4.1; Unsolicited Airport Control 13.6.3); exchange öncesi "kontrol bende mi" önkoşulu (1.3.2/12.2.2 — şu an atlanıyor, A-(c3)). (**M**, BE)
4. **Multi-pax / grup ticketing + split PNR** — tek işlemde çok yolcu (2.3), grup fare (2.23.4+), PNR bölme. (A+B teyitli, **M/L**)

### Orta
5. **Bebek bileti tam modeli** — bebek kendi ET'si + "In Connection With" kupon bağı + kaskad + disassociate (1.1.8); şu an yetişkin niteliği. (**M**)
6. **`Z` (Closed) komutu** — no-show + değişimsiz fare → kuponu kapat; şu an Z erişilemez. (**S**)
7. **`S/U` set eden komutlar** — Revenue Protection "kuponu askıya al/kaldır" aksiyonu (14.7.4); şu an salt-okunur liste. (**S**)
8. **`X` (Print Exchange) komutu** — farklı belge numaralı kâğıda basım (1.3.4). (**S**)
9. **Original Issue zinciri** — `originalIssue` (ilk belge/tarih/yer/agent) alanı; 2.+ reissue'da taşınır (2.18/12.10); "PD"/"NO ADC" gösterimleri. (**S/M**)
10. **Ancillary katalog → EMD-A akışı** — koltuk/bagaj seçimi → otomatik EMD-A ("koltuğu seç → EMD kes" köprüsü). (B-8, **M**)
11. **Bilateral anlaşma KONTROLÜ** — EMD/print/revalidation komutlarında partner yeteneği doğrulaması; şu an registry salt liste. (**S/M**)
12. **NDC Order API yüzeyi (F7)** — OrderCreate/Change/Cancel kontratları + ET/EMD↔Order eşleme; sektör zamanlaması: ana geçiş 2028-29, aciliyeti orta. (**L**)

### Düşük
13. Hastalıkta geçerlilik uzatma (13.10 — refund'suz NVA uzatımı, S) · kombine FOP (2.14.4, S) · bagaj "Allow" veri elemanı (2.9, S) · PTA refund/expiry komutları (9.3, S) · repricing portu (ATPCO Cat31/33 için hexagonal port + mock, M) · yolcu self-servis disruption (yeni surface, L) · waitlist clearance (inventory'ye bağımlı — bilinçli kapsam dışı).

## 3. Yön değerlendirmesi (sektör araştırması özeti)

**Order-native + event-sourced mimari tercihi sektörle güçlü uyumlu ve zamanlaması doğru.** IATA "100% Offers & Orders 2030" hedefi ayakta; Finnair Mayıs 2025'te ilk native order'ı üretti (~40 pilot), ancak havayollarının yalnızca ~%27'si anlamlı ilerlemede ve ana geçiş dalgası 2028–29'a sarkıyor — ET/kupon-FSM çekirdeğini koruyup order-native *tasarlamak* tam da bu geçiş gerçekliğine denk düşüyor. Event sourcing, ONE Order'ın "service delivery status" + tam audit gereksiniminin doğal altyapısı (Navitaire Stratos ve Amadeus Nevio ile aynı yön). Türkiye bağlamı da premisi doğruluyor: Turkish Technology, in-house PSS'in (Troya) üstüne order management'ı kayıt sistemi yapmayı hedefliyor ("ticaretin birimi artık fare değil, offer"). NDC hacmi hâlâ azınlıkta (ARC işlemlerinin ~%21'i, Aralık 2025) — kuyruk/TTL/toplu-reissue gibi "klasik" boşluklar demoda daha hızlı inandırıcılık kazandırır.

> Kaynaklar: amadeus.com (ATC/FXI/ATL, Self-Service Reaccommodation), sabre.com (Automated Exchanges, SabreMosaic), navitaire.com (NDC/ONE Order ARM), crane.aero + hitit.com (Crane PAX, NDC L4), iata.org (ONE Order), altexsoft.com, travelweekly.com (ARC NDC %21,2), futuretravelexperience.com (THY retailing vizyonu), skift.com.
