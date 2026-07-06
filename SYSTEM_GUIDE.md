# Troya Suite — Kullanım Kılavuzu

IATA Ticketing Handbook çekirdeğinden türetilen modern biletleme platformu. Tek çalışma alanında **üç operasyon modülü + Panel + Yönetim**. Tüm para/statü işlemleri ortak **Engine**'e gider; arayüz bir **sunum adaptörü**dür (iş kuralı backend'de). Kupon yaşam döngüsü **event-sourced** — her aksiyon değişmez bir audit kaydıdır.

> Aynı içerik uygulama içinde **Kullanım Kılavuzu** sayfasında da var: sağ üst avatar → "Kullanım Kılavuzu" (`/guide`).

## Mimari ilkeler
- **Event Sourcing** — state event'lerden türetilir; tam audit.
- **CQRS** — yazma (komut→aggregate→event) ve okuma (read model) ayrı.
- **Coupon Status = FSM** — geçerli geçişler sabit; final statüler terminal.
- **Idempotency** — para/statü değiştiren her komut idempotency key taşır (çift-issue/refund yok).
- **Control / lease** — kupon control'ünü tek carrier tutar; Validating Carrier devreder (TTL'li).
- **Order-native (gelecek)** — ONE Order'a evrilebilir sınırlar.

## Modüller & Menüler

### Panel (Anasayfa)
KPI şeridi (uçuş/check-in/PNR/bilet) · kupon durum dağılımı (donut) · son aktivite (event akışı) · modül kartları.

### QuickRes — Rezervasyon (PNR)
- **PNR Oluştur** — yolcu + segment wizard.
- **PNR Ara** — PNR / yolcu / güzergah.
- **Uygunluk** — koltuk müsaitlik görünümü.

### Troya — Biletleme
- **Bilet Kes** — ET kesimi: Yolcu → Segment (havalimanı autocomplete + tarih/saat) → Fare/Ödeme → Onay. Onayda kuponlar **O** açılır; çift-submit idempotency ile engellenir; optimistic UI yok.
- **Bilet Ara** — TKT no / PNR / yolcu / havalimanı + gelişmiş filtre.
- **Exchange / Refund / Void** — para işlemleri (bilet bağlamında; yetki ister).
- **IRROP / Endorsement** — olağandışı operasyon (FIM) ve ciro/kısıtlama.
- **EMD / Fazla Bagaj** — EMD-A (kupona bağlı) / EMD-S; bagaj RFISC.
- **PTA** — Prepaid Ticket Advice (önceden ödenmiş bilet).
- **Order'lar** — ONE Order görünümü; Ticket/EMD fulfillment.
- **Mesajlar / Anlaşmalar** — interline EDIFACT/NDC + bilateral registry.

### QuickCheck-in — DCS (Departure Control)
- **Uçuşlar** — kalkış panosu; **Check-in / Biniş** sekmeleri; pasaport / TC kimlik / uçuş kodu / yolcu adı araması.
- **Yolcu Kabul** — check-in → koltuk + bagaj; APIS kontrolü (kupon **O→C**).
- **Biniş (Boarding)** — biniş kartı + board (**C→L**).

### Yönetim (Admin)
- **Gelir Koruma** — anomali bayrakları (sıra dışı / mükerrer / control gecikmesi).
- **Roller & Yetkiler** — rol-yetki matrisi.
- **Kullanıcılar** — personel listesi ve rolleri.
- **Loglar** — denetim (audit) kayıtları.
- **Ayarlar** — dil, tema, istasyon.

## Roller & Yetkiler

5 rol, kıdeme göre **kümülatif** yetki. Rolünüze göre menü ve aksiyonlar açılır/kilitlenir. Demo: sağ üst avatar → rol değiştir.

| Rol | Yetkiler (kümülatif) |
|---|---|
| **Personel** | Bilet kes, EMD/bagaj, PTA, check-in, biniş, order/mesaj görüntüle |
| **Süpervizör** | + Void, Refund, Exchange, Endorsement |
| **Şef** | + IRROP/FIM, Gelir Koruma |
| **Müdür** | + Kullanıcı yönetimi, Sistem ayarları |
| **Admin** | + Rol & yetki yönetimi (tam erişim) |

Yetki yoksa ilgili buton kilitli (tooltip: gereken rol) ve menü öğesi gizlidir. Tam matris: **Yönetim → Roller & Yetkiler**.

## İş Akışları
- **Bilet kesimi** — 4 adımlı wizard; sunucu sonucu beklenir.
- **Exchange/Reissue** — eski açık kuponlar **E**, yeni bilet + ADC/residual + linkage. *(Süpervizör+)*
- **Refund** — seçili **O** kuponlar **R**; residual EMD-S; vefat/hastalık waiver ile ceza muaf. *(Süpervizör+)*
- **Void** — yalnızca tüm kuponlar **O** ise hepsi **V**. *(Süpervizör+)*
- **IRROP / FIM** — aksayan kupon **O→I→G**; partner carrier'a ciro; FIM üretimi. *(Şef+)*
- **EMD / Fazla Bagaj** — EMD-A/EMD-S; RFISC.
- **PTA** — sponsor öder → "Bilete Dönüştür".
- **Check-in & Biniş** — check-in (O→C) → board (C→L).

## Kupon Statü Kodları (Handbook 1.1.4)
**Interim (ara):** `O` Open · `A` Airport Control · `C` Checked-In · `L` Lifted · `I` IRROP · `S` Suspended · `U` Unavailable · `N` Notification · `Y` Refund TFC
**Final (terminal):** `F` Flown · `E` Exchanged · `G` Exchanged/FIM · `R` Refunded · `V` Void · `P` Printed · `X` Print Exchange · `Z` Closed · `T` Paper

## Kısayollar
- **⌘K / Ctrl+K** — komut paleti (TKT no aç, ara, modül geç)
- **e / r / v** — bilet detayında Exchange / Refund / Void
- **Sağ-alt baloncuk** — hızlı mesajlaşma (online şef/supervisor)
- **Sağ üst avatar** — rol değiştir (demo) · ayarlar · kılavuz
