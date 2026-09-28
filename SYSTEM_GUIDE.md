# Troya Suite — Kullanım Kılavuzu

IATA Ticketing Handbook çekirdeğinden türetilen modern biletleme platformu. Tek çalışma alanında **üç operasyon modülü + Panel + Yönetim + Mesajlaşma**. Tüm para/statü işlemleri ortak **Engine**'e gider; arayüz bir **sunum adaptörü**dür (iş kuralı backend'de). Kupon yaşam döngüsü **event-sourced** — her aksiyon değişmez bir audit kaydıdır.

> Aynı içerik uygulama içinde **Kullanım Kılavuzu** sayfasında da var: sağ üst avatar → "Kullanım Kılavuzu" (`/guide`). Her ekranın kendi yardımı üst çubuktaki **?** düğmesinde; ekran turlarını **Profil**'den açabilirsiniz.

## Mimari ilkeler
- **Event Sourcing** — state event'lerden türetilir; tam audit.
- **CQRS** — yazma (komut→aggregate→event) ve okuma (read model) ayrı.
- **Coupon Status = FSM** — geçerli geçişler sabit; final statüler terminal.
- **Idempotency** — para/statü değiştiren her komut idempotency key taşır (çift-issue/refund yok).
- **Control / lease** — kupon control'ünü tek carrier tutar; Validating Carrier devreder (süreli).
- **Order-native (gelecek)** — ONE Order'a evrilebilir sınırlar.

## Modüller & Menüler

Menü üst çubukta: solda modül seçici (QuickRes · Troya · QuickCheck-in · Yönetim), altında seçili modülün bölümleri.

### Panel (Anasayfa)
KPI şeridi · haftalık bilet kesimi · kupon durum dağılımı · bugünün işleri (kuyruklar) · istasyon duyuruları · modül kartları.

### QuickRes — Rezervasyon (PNR)
- **PNR Oluştur** — yolcu + segment sihirbazı.
- **PNR Ara** — PNR / yolcu / güzergâh.
- **Uygunluk** — sefer programından sınıf bazında koltuk; sınıfa tıklayınca rezervasyon o seferle açılır.
- **PNR işlemleri** — güzergâh iptali (XI), segment iptali (XE), bilet süresi (TTL) uzatma, RM/OSI notları, geçmiş (RH).
- **Bilet Kes** — PNR'daki biletsiz yolcular için yolcu başına bir bilet; kesilen numara PNR'a yazılır.

### Troya — Biletleme
- **Bilet Kes** — 5 adım: Yolcu → Sefer (listeden uçuş seçilir) → Ücret (sistem tarifesinden seçilir) → Ödeme → Onay. Refakatçi ekleyerek grup/aile kesimi (en çok 9 yolcu, hepsi birden kesilir ya da hiçbiri). Onayda kuponlar **O** açılır; çift-submit idempotency ile engellenir; optimistic UI yok.
- **Bilet Ara** — TKT no / PNR / yolcu / uçuş no / FOID / kart son 4 hane + gelişmiş filtre + durum sekmeleri.
- **Satış Sonrası** — exchange, refund, void (bilet kaydından; yetki ister), IRROP, ciro, no-show, revalidation, ad düzeltme, geçerlilik uzatma, askıya alma, tarife değişikliği, kuyruklar.
- **Dokümanlar** — EMD (EMD-A kupona bağlı / EMD-S), PTA, order'lar (ONE Order görünümü).
- **Interline** — mesajlar (EDIFACT/NDC) ve bilateral anlaşmalar.
- **ADM / ACM** — acente borç/alacak dekontları (Resolution 850m; 15 gün itiraz süresi, BSP faturası).
- **Raporlar** — rapor merkezi, satış/işlem, mali rapor (ceza, vergi, KDV), dönem kapanışı ve kapanış belgesi.

### QuickCheck-in — DCS (Departure Control)
- **Kontuar** — uçuşlar arası yolcu araması (ad / PNR / bilet / pasaport / TC), dikkat isteyen uçuşlar.
- **Uçuş** — yolcu listesi ve süzgeçler; kabul penceresi (dış hat kalkışa 60 dk, iç hat 45 dk kala kapanır; kapı 15 dk kala kapanır), arada süpervizör onaylı gerekçeli **geç kabul**.
- **Yolcu Kabul** — seyahat belgesi ve APIS kontrolü → koltuk (uçak tipine göre harita, koltuk uygunluk kuralları) + bagaj; kupon **O→C**.
- **Biniş** — biniş kartı + board (**C→L**), toplu bindirme; uçuş kapanışında binenler **F** olur.
- **HUB Kontrol** — canlı kalkış panosu, uyarılar, rötar ve tazminat bilgisi. *(Şef+)*

### Yönetim (Admin)
- **Roller & Yetkiler** — rol-yetki matrisi.
- **Kullanıcılar** — personel ekle / düzenle / rol ata / devre dışı bırak.
- **Denetim Kaydı** — olay geçmişinden türeyen işlem kayıtları.
- **Gelir Koruma** — anomali bayrakları (sıra dışı kullanım / mükerrer kesim / gecikmiş kontrol / askıdaki kupon).
- **Ayarlar** — dil, tema, istasyon.

### Mesajlaşma
Üst çubuktaki mesaj simgesi → `/chat`: kişiler ve kanallar, çevrimiçi durumu, bilet iliştirme.

## Roller & Yetkiler

5 rol, kıdeme göre **kümülatif** yetki. Rolünüze göre menü ve aksiyonlar açılır/kilitlenir. Demo: sağ üst avatar → rol değiştir.

| Rol | Eklenen yetkiler (kümülatif) |
|---|---|
| **Personel** | Bilet kes, EMD / fazla bagaj, kağıda bas, PTA, check-in kabul, biniş, order ve interline mesajlarını görüntüle |
| **Süpervizör** | + Void, Refund, Exchange, Ciro, Revalidation, geç kabul / belge istisnası, mesajlaşma kanalı aç |
| **Şef** | + IRROP/FIM, kupon askıya alma, Gelir Koruma ve raporlar, HUB Kontrol, ADM/ACM |
| **Müdür** | + Kullanıcı yönetimi, sistem ayarları |
| **Admin** | + Rol & yetki yönetimi (tam erişim) |

Yetki yoksa ilgili buton kilitli (ipucunda gereken rol yazar) ve menü öğesi gizlidir. Tam matris: **Yönetim → Roller & Yetkiler**.

## İş Akışları
- **Bilet kesimi** — 5 adımlı sihirbaz; sunucu sonucu beklenir.
- **Exchange/Reissue** — eski açık kuponlar **E**, yeni bilet; ADC = ücret farkı + yalnız artan vergi, ceza ayrı kalem, bakiye ayrı belge. *(Süpervizör+)*
- **Refund** — seçili kuponlar **R**; tutarı sistem hesaplar (ceza, iade edilen / yanan vergi, KDV); vefat/hastalık muafiyeti; yalnız-vergi iadesi (**Y**); voucher. *(Süpervizör+)*
- **Void** — yalnızca satış günü ve tüm kuponlar **O** ise hepsi **V**. *(Süpervizör+)*
- **IRROP / FIM** — aksayan kupon **O→I→G**; partner carrier'a ciro; FIM üretimi. *(Şef+)*
- **EMD / Fazla Bagaj** — EMD-A/EMD-S; RFISC.
- **PTA** — sponsor öder → "Bilete Dönüştür".
- **Check-in & Biniş** — kabul (O→C) → biniş (C→L) → uçuş kapanışı (L→F).

## Kupon Statü Kodları (Handbook 1.1.4)
**Interim (ara):** `O` Open · `A` Airport Control · `C` Checked-In · `L` Lifted · `I` IRROP · `S` Suspended · `U` Unavailable · `N` Notification · `Y` Refund TFC
**Final (terminal):** `F` Flown · `E` Exchanged · `G` Exchanged/FIM · `R` Refunded · `V` Void · `P` Printed · `X` Print Exchange · `Z` Closed

## Kısayollar
- **⌘K / Ctrl+K** — komut paleti (bilet / EMD / PNR / order aç, ara, modül geç)
- **e / r / v** — bilet kaydında Exchange / Refund / Void
- **o / n / d** — kuyrukta aç / bitti / ertele
- **?** (üst çubuk) — bu ekranın yardımı
- **Sağ üst avatar** — profil · rol değiştir (demo) · dokümantasyon · kılavuz · çıkış
