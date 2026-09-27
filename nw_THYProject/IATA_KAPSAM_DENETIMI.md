# IATA Kapsam Denetimi — v2

> **GÜNCELLEME (2026-09-27):** Araştırma turuyla (Handbook + EU261/SHY-YOLCU/UK261, Amadeus/Sabre
> kuyrukları, THY/LH tarife değişikliği ve ad düzeltme kuralları, IATA RP 1726) aşağıdakiler kapatıldı.

| Madde | Ne yapıldı |
| --- | --- |
| **2.8 / 12.4.1 / 12.9.1 · Geçerlilik** | `domain/validity.ts`: kullanılmamış bilet kesimden, kısmen kullanılmış bilet ilk uçuştan 1 yıl; ücret NVA'sı kuponu sınırlar; süresi dolan bilette exchange/revalidation reddedilir (yalnız iade); yolculuk başladıysa reissue orijinal sonu aşamaz. Bilet kaydında Geçerlilik kartı. |
| **13.10 · Hastalık uzatması** | `extendValidity`: yolculuk başladıktan sonra, raporla, bir kez; normal ücret elverişlilik gününe (rapordan ≤3 ay), özel ücret elverişlilik +7 gün; uzatmayan talep reddedilir. |
| **2.3 · Ad ve yolcu başı bilet** | Rezervasyondan kesimde ad PNR ile birebir; her yolcu ayrı ET, PNR ancak tüm yolcular biletlenince "ticketed"; mükerrer kesim engeli. |
| **Giriş 10 · Devir yasağı / ad düzeltme** | `nameCorrection.ts` + `correctName`: yazım (≤3 karakter), yer değiştirme, unvan, belgeli resmî değişiklik düzeltilir (eşit reissue, NAME CORRECTION, PNR güncellenir); ötesi devir olarak reddedilir. |
| **15.1.1.1 · Tarife değişikliği (involuntary)** | `scheduleChange.ts` + `/schedule-change`: toplu uygulama, HK→TK, INVOL SKCHG cirosu, sınıf (küçük/zorunlu/önemli — DOT 2024 eşikleri), Q7 kuyruğu, "yolcu bilgilendirildi" TK→HK. |
| **Yolcu hakları** | `passengerRights.ts` + `geo.ts`: EU261 / SHY-YOLCU (2024 değişikliği) / UK261 kapsam, büyük daire bandı, tutar, iptal bildirimi muafiyetleri, %50 indirim, olağanüstü hâl, bakım hakları; bilet kaydında hesap + kayıt, HUB rötar maruziyeti. |
| **Kuyruklar** | `/queues`: kayıttan türeyen iş listesi (Q8 TTL, Q7 IRROP/SKCHG, Q20 geçerlilik, Q21 uçulmamış kupon, Q30 kontrol, Q40 gelir koruma, Q50 interline). |
| **CO₂ (RP 1726)** | `co2.ts`: yakıt × 3,16, ICAO mesafe düzeltmesi, kabin katsayısı; sefer listesi, teklifler, kuponlar. |

**Test:** 442 vitest · 62 e2e. **Açık kalan:** grup/çok yolculu tek işlem kesim, seyahat belgesi kontrolü
(Timatic benzeri), ADM/ACM, check-in kapanışı sonrası geç kabul kuralı.

---

> **GÜNCELLEME (2026-08-03):** Aşağıdaki maddelerin bir bölümü **kapatıldı**. Kapatılanlar bu
> bölümde listelidir; alt bölümlerdeki asıl bulgular tarihsel kayıt olarak duruyor.

## 0. Bu turda KAPATILAN maddeler

Yöntem: handbook PDF'i metne çevrildi (`pdfjs`), ilgili bölümler **birebir okundu**, kural koda
çevrildi, her kural için test yazıldı.

| Madde | Ne yapıldı |
| --- | --- |
| **1.1.5.1 / 1.1.5.3 · Kontrol** | `grantControl` / `returnControl` / `requestControl` komutları. Devir yalnız Validating Carrier'dan, yalnız **aktif + control-transfer yetkili bilateral anlaşma** varsa; kontrol tek taşıyıcıda durur (BB'den geri alınmadan CC'ye verilemez); devirde "O" statüsü bildirilir. TicketDetail'de kontrol paneli. |
| **1.1.4.1 · Kontrol süre limitleri** | `controlDeadline()`: A/C/L → planlanan kalkıştan **72 saat** (geçmiş tarihli kuponda kontrolün alınmasından), I → **orijinal kalkıştan en çok 7 gün**. Süre dolduğunda bilet başlığında kırmızı uyarı. |
| **1.1.4.1 "F"** | "Status is to be set by the carrier holding control only" → `advanceCouponStatus(...,"F")` kontrol sahibi değilse reddeder. |
| **1.1.5.3 · Zilyetlik kapısı** | exchange / refund / void / print komutlarının başında `assertControl` — kontrol başkasındayken işlem açılmaz, personel kontrol istemeye yönlendirilir. |
| **1.3.4 · Print Exchange** | `printExchange` komutu: kontrol + kupon "open for use" + **kağıt belge numarası ET'den farklı** olmalı; FSM'e `O→X` eklendi; kağıt belgeye ETKT basılır. |
| **1.3.6 · SAC** | İki hata düzeltildi: (1) kod **işlem başına tek** üretilip tüm kuponlara yazılır (önce kupon başına ayrı kod üretiliyordu); (2) 3 karakterli muhasebe kodunda **1. pozisyon boşluk** (`" 235…"`, önce `"2350…"`). Refund ve Refund-Cancel de artık SAC üretir. |
| **12.13.2 · Refund-Cancel** | `refundCancel` komutu: **aynı raporlama dönemi** içindeki iade geri alınır, kuponlar "open for use"a döner, yeni SAC üretilir. FSM'de `R` terminal kalır — geçiş yalnız `applyRefundCancel` kapısından. |
| **12.1.1 · Değişiklik türü** | `domain/changeRules.ts`: Exchange / Rebooking / Reissue / Rerouting / Upgrading sınıflandırması; kısmen kullanılmışta fiyatlama **orijinal kesim tarihi**, kullanılmamışta **güncel tarife**. Exchange akışında tür ve gerekçe gösterilir; yalnız rezervasyon değişikliğinde revalidation önerilir. |
| **15.1.1 / 15.1.2 / 15.1.3.1 · İade türü ve hesabı** | `domain/refundRules.ts` + `quoteRefund()`: involuntary sebep listesi (15.1.1.1), involuntary'de **iki hesabın yükseği** (kullanılmayan taşımanın tek yön ücreti — RT/CT'de yarısı — vs ödenen ücret farkı), voluntary'de service charge + iletişim gideri kesintisi. **Personel tutarı elle yazmaz**, sistem hesaplar; sapma uyarıyla işaretlenir. |
| **15.1.6 · Değerleme** | Taşımanın başladığı ülkenin para birimi (COC) türetilir; ödeme farklı para birimindeyse iade aynı para biriminde ve orijinal işlem kuruyla, değilse iade günü banka kuruyla değerlenir — gerekçe satırı ekranda. |
| **15.1.3.2 · İade yetkisi** | Belgeyi başka taşıyıcı düzenlediyse onun onay/referansı zorunlu; ciro "NON-REF" içeriyorsa iade engellenir (yetkili override'ı ile açılır). |
| **12.7.3 / 15.3 · Residual** | RefundFlow'a residual alanı geri geldi; bakiye **"FOR REFUND ONLY"** belgesi olarak kesiliyor (drawn on orijinal düzenleyen taşıyıcı). |
| **5.5 · EMD void / iade** | `voidEmd` (tüm kuponlar O + **kesim raporlama dönemi** içinde) ve `refundEmd` (O/A/Y kuponlar → R) komutları; EmdDetail'e Void / İade / Makbuz aksiyonları ve EMD yaşam döngüsü. |
| **5.8 · EMD Makbuzu** | `/emds/$emdNumber/receipt` — handbook'un saydığı zorunlu alanların tamamı (yolcu/grup adı, RFIC + alt kod, in-connection-with, kupon başına taşıyıcı/O-D, tutarlar, **son 4 hane hariç maskeli kart**, TFC, tour code, kesim tarihi/yeri, belge no, ciro, FOID) + Appendix B bildirim bloğu. |
| **9.2.2 · PTA teslim teyidi** | `acknowledgePta` + PTA tablosunda "Teslim al" aksiyonu ve rozet. |
| **9.3 · PTA iadesi** | `refundPta`: fark **orijinal ödeme para biriminde**, havayolu **MCO**, acente **Agents Refund Voucher** düzenler; satan ofise refund authority iletilir. |
| **1.1.8 · Kucak bebeği** | Kesim sihirbazına bebek bölümü geri geldi (ad/soyad zorunlu, doğum tarihi verilirse **24 ay** kontrolü); onay adımında ve bilet detayında görünür. |
| **1.2 · ETKT işareti** | `BoardingPass` bileşeni: biniş belgesinde **ETKT** işareti + ET doküman numarası; check-in ekranında her kabul edilmiş yolcu için açılır. |
| **2.22.3 / 2.22.4 · NUC / ROE** | Kayıtta duran ama hiçbir ekranda görünmeyen NUC ve ROE bilet detayı ücret kartına eklendi. |

**Test:** 156 vitest (yeni: `refundRules.test.ts` 15 + api'ye kontrol/refund-cancel/print-exchange/EMD/PTA 18) · 28 e2e (yeni `iata.spec.ts` 5) · 27 rota × iki tema 0 hata.

**Bu turda düzeltilen denetim hatası:** rapor 12.13.2'yi "Refund-Cancel" olarak etiketlemişti; handbook'ta 12.13 **"From Paper to Electronic Ticket"**tir. Refund-Cancel tanımı 1.3.6/SAC bölümündedir ("aynı raporlama dönemi içinde iadeyi geri alma") ve uygulama o metne göre yazıldı.

---

> Yöntem: IATA Ticketing Handbook'un altı bölüm kümesi altı ajan tarafından PDF'ten okundu,
> her zorunluluk koda eşlendi, sonra **her eksik iddiası ayrı bir ajan tarafından çürütülmeye**
> çalışıldı. Aşağıdakiler o elemeden geçenlerdir.

**150 yetenek incelendi · 94 bulgu doğrulandı**

| Durum | Adet |
| --- | --- |
| Bağlantısız (kod var, ekran yok) | 8 |
| Eksik | 58 |
| Kısmi | 73 |
| Tam | 11 |


## 0.1 İkinci tur — ceza ve vergi katmanı (2026-08-03)

Kullanıcı sorusu: *"iadelerde/değişikliklerde ücret oynaması, iptal cezası, KDV ne oluyor?"*
Araştırma (ATPCO Cat 16/31/33, IATA TFC kuralları, US DOT/IRS/EU/UK düzenlemeleri, Türk KDV mevzuatı)
+ handbook 12.5/12.11/14.1/14.2 okuması sonucu **sistemin gerçek boşluğu buydu** ve kapatıldı.

**Bulunan üç kök eksik:**

1. **Ceza katmanı hiç yoktu.** `FareType` yalnız `refundable`/`changeable` boolean'ı taşıyordu;
   iptal/değişiklik/no-show ücreti kavramı kodda yoktu. Üstelik `eco-saver` gibi *iade edilemez*
   ürünlerde iade hesabı ücretin tamamını iade ediyordu — kural hiç okunmuyordu.
2. **Vergi iade edilebilirliği modellenmemişti.** `TaxFeeCharge` sadece `{code, amount}` idi;
   iade hesabı toplam TFC'yi kupon sayısına bölüyordu. Devlet harcı ile taşıyıcı ek ücreti (YQ/YR)
   aynı muameleyi görüyordu.
3. **KDV yanlıştı.** Eklendiği ilk hâlde KDV toplamın ÜSTÜNE ekleniyordu; oysa KDV Kanunu md.20/4
   uyarınca bilet bedeli **KDV DAHİL** tespit edilir ve müşteriye ayrıca yansıtılmaz.

**Kurulan katmanlar:**

| Modül | İçerik |
| --- | --- |
| `domain/fareRules.ts` | Cat 16/31/33 karşılığı: iptal/değişiklik/no-show cezaları, kısıt kodu (X/N/B), muafiyetler, H/L göstergesi, minimum eşiği, uygulama tabanı. **Kural yoksa işlem ücretsiz ve serbesttir** ("veri yok = yasak" değil). |
| `domain/taxCodes.ts` | Handbook 14.2 ülke-kod tablosundan katalog + iade edilebilirlik tabanı: olay bazlı (`perDeparture`) vs ödenen tutara bağlı (`percentOfFare`). US XF ve AY istisnaları. |
| `domain/vat.ts` | KDV: iç yüzde ayrıştırma (md.20/4), uluslararası istisna (md.14), yolcu servis ücreti matrah dışı (md.13/b), **tarihli oran tablosu** — iade düzeltmesi kesim tarihindeki oranla (md.35). |
| `domain/reissueRules.ts` | ADC = ücret farkı + ARTAN vergi. PD matrisi (12.5(c) dört hâl), NO ADC / "A" göstergesi, bakiye ADC'ye netlenmez, ceza bakiyeden düşülür, geçerlilik 12.4.1 vs 12.9.1. |
| `domain/refundRules.ts` | Yeniden yazıldı: ceza + no-show ücreti + kalem bazlı vergi + iade edilemez üründe "yalnız vergi" yolu + kesinti tavanı (negatif iade üretilmez). |

**Handbook'un yazmadığı, araştırmanın düzelttiği en kritik nokta:**
Handbook Ch.12'de "penalty" / "change fee" **hiç geçmez**. ADC yalnız ücret farkı + vergi farkıdır;
değişiklik ücreti tarife kuralı (Cat 31) katmanındandır. Bu yüzden `fareDiff`, `tfcAdditional` ve
`penalty` ayrı alanlarda tutuluyor ve ekranda ayrı satırlarda gösteriliyor.

**Demo verisi uyarısı:** ücret ailelerindeki ceza TUTARLARI temsilîdir. THY'nin yayınlanmış
rakamları ikincil kaynaklarda çelişkili çıktı ve resmî sayfadan doğrulanamadı; yapı gerçek,
rakamlar tarife bağlandığında değişir.

---

## 1. Bağlantısız — kod var, hiçbir ekrandan erişilemiyor

En ucuz kazanımlar. Birkaçı v1'de çalışıyordu ve v2 yeniden yazımında taşınmadı.

### 1.1.4.1 — Flown (F) = faturalama/gelir raporlaması uygunluğu
- **Kanıt:** Domain'de VAR: /Users/ahmet/Desktop/Projects/ThyTicketProject/nw_THYProject/frontend/src/domain/api.ts:512-528 `advanceCouponStatus(...,'F')` — FSM geçişi + sıralı kullanım kontrolü (api.ts:517-523) + F'de SAC (api.ts:525). FSM: domain/couponStatusMachine.ts:19 `L: ['F','I']`, :18 `A: [...,'F']`. AMA HİÇBİR EKRANDAN ERİŞİLEMİYOR: `grep -rn advanceCouponStatus src/` → yalnız domain/api.ts ve domain/api.test.ts. v1'de BAĞLIYDI → /Users/ahmet/Desktop/Projects/ThyTicketProject/frontend/src/pages/checkin/SeatSelection.tsx:7,52 (`await advanceCouponStatus(p.ticketNumber, p.couponSeq, 'C')`); v2'de bu import DÜŞMÜŞ — nw_THYProject/.../pages/checkin/SeatSelection.tsx:5 yalnız `newIdempotencyKey` import ediyor, checkInPassenger (domain/checkin.ts) api'ye hiç dokunmuyor. Sonuç: hiçbir kupon O→C→L→F ilerleyemiyor, F hiç oluşmuyor, SalesReport'un 'checkin' kategorisi (api.ts:415) hep boş. Ayrıca: `revenue-eligible` bayrağı YOK; statüyü kimin set ettiği (control holder) doğrulanmıyor — advanceCouponStatus `ticket.control` hiç okumuyor; 72 saat içinde Validating Carrier'a iletim/control iadesi YOK.
- **Yapılacak:** SeatSelection ve CheckinFlight mutasyonlarına advanceCouponStatus çağrısını geri koy (v1 paritesi: check-in→C, boarding→L, kalkış→F). advanceCouponStatus'a control-holder doğrulaması ekle (yalnız `ticket.control.holder` set edebilir). Coupon'a `revenueEligible`/`flownAt` alanları ve F'de ControlReturned event'i ekle.

### 1.1.5.1 — Kontrol devri (grant/revoke) kuralları
- **Kanıt:** Event tipleri VAR: nw_THYProject/frontend/src/domain/types.ts:104-105 (ControlGranted/ControlReturned); timeline etiketleri VAR: pages/TicketDetail.tsx:33-34 ve components/domain/CouponTimeline.tsx:21-22,41. Bilateral anlaşma kaydı VAR ve ekranda: domain/mockData.ts:224-228 + pages/Agreements.tsx:27 (controlTransfer kolonu). KOMUT YOK: domain/api.ts'te grantControl/revokeControl/requestControl hiç yok (dosyadaki 34 export'un hiçbiri kontrolle ilgili değil). Bu event'ler yalnız mockData.ts:58,107'de statik olarak geçiyor. controlTransfer bayrağı hiçbir kararda okunmuyor (grep: yalnız Agreements.tsx tablosunda).
- **Yapılacak:** api.ts'e grantControl/revokeControl komutları ekle: yalnız isValidatingCarrier iken izin ver, MOCK_AGREEMENTS'ta partnerin controlTransfer=true + status='active' olmasını şart koş, ControlGranted/ControlReturned event'i üret ve TicketDetail'e 'Kontrol Devret / Geri Al' akışı bağla.

### 1.1.8 — Bebek (infant) biletlemesi ve yetişkin kuponuna bağlama
- **Kanıt:** Tip VAR: nw_THYProject/frontend/src/domain/types.ts:84 (Passenger.infant). Gösterim VAR: nw_THYProject/frontend/src/pages/TicketDetail.tsx:172 (Bebek chip'i). GİRİŞ YOK: nw_THYProject/frontend/src/pages/IssueWizard.tsx:48 — pax state'inde infant alanı hiç yok, wizard'da bebek adımı/toggle'ı yok. ESKİ SÜRÜMDE VARDI: frontend/src/pages/IssueWizard.tsx:59-63 (zod alanları), :130 (default), :212 (payload), :332-346 ('Kucak Bebeği (Infant)' bölümü, soyad/ad/dob). mockData'da da infant'lı bilet yok → TicketDetail:172 ölü kod, hiçbir yolla tetiklenemez. 'In Connection With' referansı (yetişkin bilet no + kupon seq), SSR TKNE, cascade/decouple hiç yok.
- **Yapılacak:** IssueWizard yolcu adımına eski sürümdeki bebek bölümünü geri koy; Passenger.infant'a inConnectionWith { ticketNumber, couponSeq } ekle ve yetişkin kupon statü geçişlerinde (advanceCouponStatus/refund/void) cascadeEmdA benzeri bir cascadeInfant uygula + ayrıştırma butonu.

### 2.22.3 / 2.22.4 / 2.22.6.5 — NUC, ROE ve yuvarlama disiplini
- **Kanıt:** Alanlar domain'de VAR ama HİÇBİR EKRAN göstermiyor: `nuc?: number; roe?: number` /Users/.../nw_THYProject/frontend/src/domain/types.ts:70-71; tohum değerler domain/mockData.ts:45 ve 97; exchange'te kopyalanıyor domain/api.ts:302-303. Grep `.nuc`/`.roe` → pages/ ve components/ altında SIFIR kullanım (TicketDetail.tsx fare panelinde yalnız base/TFC/total/equiv/fareCalcString var, satır 261-297). Ayrıca hiç HESAPLANMIYOR: pricing.ts baştan sona TRY çalışıyor, NUC/ROE/EMS/country-of-commencement adımı yok (domain/pricing.ts:104-157); para `number` (float), decimal değil (types.ts:32).
- **Yapılacak:** Fiyatlamayı NUC üzerinden kur (bileşen NUC 2 ondalık yuvarlanmamış → toplam NUC × ROE → yerel yuvarlama); nuc/roe'yu bilet detayı fare panelinde ve fare calc bloğunda göster; ROE'yu kalkış ülkesinden türet.

### 1.3.4 — Print Exchange
- **Kanıt:** 'X' statüsü tam donanımlı tanımlı ama ULAŞILAMAZ: nw_THYProject/frontend/src/domain/types.ts:26, couponStatus.ts:31 (STATUS_META), :54 (grafik rengi), :61 (FINAL_STATUSES). Ancak FSM'de X'e giden HİÇBİR geçiş yok — couponStatusMachine.ts:13-33 içinde hiçbir kaynak statünün hedef listesinde 'X' geçmiyor; api.ts'te X üreten komut yok (grep '"X"' → yalnız tip/tablo satırları). Kağıt stok üzerindeki farklı doküman numarası kavramı da yok.
- **Yapılacak:** printExchange(ticketNumber, couponSeqs, paperDocumentNumber) komutu ekle: kupon O + kontrol şartı, FSM'e O→X geçişi, SAC üretimi, ETKT işareti ve yeni kağıt doküman numarasının kayda yazılması; TicketDetail 'İşlemler' menüsüne bağla.

### 12.7.3 / 12.11.2 — İade doğuran reissue → MCO / Agents Refund Voucher
- **Kanıt:** DOMAIN VAR: domain/api.ts:194 `RefundInput.residual`, api.ts:230 residual→"(EMD-S)" geçmiş kaydı, api.ts:237-250 voucher EMD-S (RFISC 99I) kesimi, domain/mockData.ts:161 RFISC "98D Residual Value (refund)". EKRANDA YOK: v2 RefundFlow'da residual girişi HİÇ YOK (components/flows/index.tsx:203-263) — eski sürümde vardı: ../frontend/src/components/flows/RefundDrawer.tsx:106 "Residual … EMD-S/MCO olarak iade edilebilir (Ch 15)". Ayrıca "For Refund Only", COC para birimi, TFC bazında iade edilebilirlik yok (`grep MCO|MPD` → 0).
- **Yapılacak:** RefundFlow'a residual alanını geri koy (v1'den taşınmamış); residual/daha-düşük-ücret farkı için "unspecified MCO / For Refund Only" belge tipi ve COC para birimi alanı ekle.

### 15.1.6 — İade değerlemesi: para birimi, IATA ROE ve banka kuru kuralları
- **Kanıt:** Domain'de kur altyapısı VAR ama v2'de HİÇBİR EKRANDAN kullanılmıyor: /Users/ahmet/Desktop/Projects/ThyTicketProject/nw_THYProject/frontend/src/domain/fx.ts:1-52 (convert/fxLines/fmtMoney) — `grep -rn 'fxLines|convert(|FX_TO_TRY|fmtMoney'` (fx.ts hariç) v2 src'de 0 sonuç. Eski sürümde bu fonksiyonlar DecimalInput üzerinden iade/EMD/exchange tutar alanlarında '≈ TRY / ≈ USD' olarak görünüyordu (/Users/ahmet/Desktop/Projects/ThyTicketProject/frontend/src/components/ui/decimal-input.tsx:68 + flows/RefundDrawer.tsx:104-107) — v2'de DecimalInput bileşeni komple düşmüş; para alanları artık tam sayı: components/flows/index.tsx:241 (`replace(/[^\d]/g,"")`), 190, 519. Ayrıca `FareCalculation.roe` alanı (domain/types.ts:71) hiçbir ekranda gösterilmiyor/kullanılmıyor (yalnız exchange'de kopyalanıyor — api.ts:303); iade tutarı her zaman biletin para biriminde sabitleniyor (flows/index.tsx:221) — taşımanın başladığı ülke para birimi / orijinal ödeme kuru / iade günü banka kuru ayrımı yok.
- **Yapılacak:** DecimalInput + fxLines'ı v2 para alanlarına geri getir (ondalık girişi de kazanılır); RefundInput'a `refundCurrency` + `rateType: 'original'|'bank'` + kullanılan kur alanı ekle, iade özetinde 'ROE x / banka kuru y ile değerlendi' satırı göster.

### 9.3 — PTA fazla tahsilat / kısmi kullanım iadesi
- **Kanıt:** TİP VAR AMA ÖLÜ: types.ts:247 `PtaStatus = "open"|"used"|"refunded"|"expired"` — "refunded" ve "expired" değerlerini hiçbir kod ATAMIYOR (grep '"refunded"|"expired"' → yalnız tip tanımı ve alakasız TTL/bilet filtreleri). Tek atama api.ts:777 `pta.status = "used"`. İade komutu, Agents Refund Voucher, refund authority, kullanılan/kalan değer alanları yok. GAP_ANALYSIS.md:41 bunu backlog'a almış ("PTA refund/expiry komutları (9.3, S)").
- **Yapılacak:** refundPta(ptaReference, usedValue, amount) komutu → MCO/Agents Refund Voucher belgesi üret, orijinal ödeme para biriminde; Pta sayfasına "İade" aksiyonu + refundAuthority alanı; süresi geçen PTA'yı expired'a düşür.

## 2. Eksik — yüksek etki

- **1.1.3.1 · Kupon veri katmanları (sold / current / flown / checked-in)** — Coupon'a sold/current/flown/checkedIn katmanları ekle (en az `soldSegment` snapshot'ı issueTicket'ta dondurulsun); revalidate/irrop yalnız `current`'ı güncellesin, check-in `checkedIn` yazsın, F geçişi `flown`'ı doldursun.
- **1.1.4.1 (A, C, L, I) · Kontrol süre limitleri (72 saat / 7 gün)** — ControlAuthority'ye acquiredAt + deadlineAt ekle; deadline = (gelecek kupon ? segment.departure : acquiredAt) + 72h, IRROP'ta departure+7g tavanıyla uzat. listRevenueAlerts içinde control_overdue'yu gerçekten hesapla ve TicketDetail/HubControl'de uyarı göster.
- **1.1.4.3 / 1.1.4.4 · Validating ↔ Marketing/Operating veritabanı statü senkronu** — advanceCouponStatus/void/refund/exchange sonrası MOCK_MESSAGES'a ETSU zarfı append eden bir emitStatusUpdate() ekle; kontrol devri komutu geldiğinde kontrol edilen kupona O, diğerlerine N (final olanlar gerçek statü) yayınla.
- **1.2 · Biniş dokümanında ETKT işareti** — Biniş kartı bileşenini v2'ye geri getir ve üzerine 'ETKT' işareti + ET doküman numarası (CheckinPassenger.ticketNumber, checkin.ts) bas.
- **12.1.1 · Değişiklik tipi sınıflandırması (Exchange/Rebooking/Reissue/Rerouting/Upgrading)** — Ticket'a `usageState` (unused/partially-used) türet; ExchangeInput'a `changeType` ekle ve rota/ücret/sınıf/geçerlilik farkından otomatik sınıflandır — Rebooking→revalidate akışına, Rerouting/Upgrading→exchange akışına yönlendir.
- **12.13.2 · Refund-Cancel — aynı raporlama dönemi içinde iadeyi geri alma** — Önce `ReportingPeriod` kavramını domaine sok (types.ts + api'de açık dönem). Sonra `refundCancel(ticketNumber, refundTransactionId, idempotencyKey)` komutu: dönem açıksa R→O geçişine izin ver (FSM'e `R: ['O']` yalnız bu komut için kapılı), yeni SAC üret, `RefundCancelled` event'i yaz. UI: RefundFlow'un yanına TicketDetail 'İşlemler' menüsünde 'İadeyi geri al' (yalnız aynı dönem içinde etkin).
- **12.3.1.2 · Reservation Change (interline) — ön doğrulama ve 4 yanıt kodu** — ReservationSegment'e `etEligible` göstergesi; `changeReservation` komutu: ET-eligibility + partner bilateral anlaşma + kupon final-değil kontrolü → 4 yanıt kodundan biri; marketing carrier bildirim kaydı.
- **12.4.1 / 12.9.1 · Yeni biletin geçerlilik süresi (validity)** — Exchange'de yeni kupon NVB/NVA'sını hesapla: kısmen kullanılmışta orijinal satış tarihine göre son kullanma; hiç kullanılmamışta seyahat başlangıcından 1 yıl veya kısıtlı tarife süresi.
- **12.4.1.2 / 12.6.1 · Seyahat başladıktan sonra yeniden fiyatlama kuralı** — pricing portuna `repriceOnExchange(originalTicket, newSegments)` ekle: taşıma başlangıç tarihi ücretleri, orijinal kesim tarihi IROE'si, son fare construction point'ten hesap, uçulmuş component'i dışla; ADC'yi sistem üretsin (elle giriş kaldırılsın — kesimdeki 2026-07-12 dersinin exchange karşılığı).
- **12.4.2 · Acente reissue kısıtları, yetkilendirme ve yer iptali** — exchangeTicket'ta endorsement/restrictions'ı yeni bilete taşı; reissue ön kontrolleri (kambiyo kısıtı listesi, fare-rule izni, FOP kısıtı, uçulmuş sektör+fare tipi değişimi) + yetki kaydı; değişen segment için PNR yerini iptal eden çağrı.
- **13.4 / 13.5 (metin 15.1.1–15.1.2) · Involuntary iade hesabı ve masraf üstlenimi** — RefundInput'a `refundType: voluntary|involuntary` + `reason`; involuntary'de tutarı sistem hesaplasın (hiç kullanılmamış→tam; kısmen→kullanılmayan taşımanın OW/yarım-RT ücreti ile ödenen fark, yüksek olanı); masraf üstlenim kalemleri ve güvenlik/davranış kaynaklı ret bayrağı.
- **14.4 · Bilet/kupon üzerinde bagaj girişleri (PCS / WT)** — Coupon'a `checkedPieces?`, `checkedWeight?`, `weightUnit: 'K'|'L'`, `freeAllowance: {type:'piece'|'weight', value}` ekle; issueTicket seçilen offer.baggageKg'ı kupona yazsın; check-in kabulü `advanceCouponStatus` ile birlikte PCS/WT'yi kupona işlesin; TicketDetail kupon şeridinde ve Itinerary'de göster.
- **15.1.1 · İadenin involuntary/voluntary sınıflandırılması** — RefundInput'a `refundType: 'involuntary'|'voluntary'` + `involuntaryReason` enum ekle; RefundFlow'da ilk soru bu olsun ve seçime göre hesap kuralı (15.1.2 vs 15.1.3.1) ve kesinti alanları değişsin; history detayına yazılsın.
- **15.1.2 · Involuntary iade tutarının hesabı (kullanılmayan taşımanın tek yön ücreti vs fark — yüksek olan)** — `domain/refundRules.ts` ekle: kupon kullanım durumundan (F/L/C vs O) kullanılan taşımayı türet, pricing.ts ile kullanılmayan bölümün tek yön ücretini hesapla, (a) ve (b) yollarını hesaplayıp YÜKSEK olanı öner; RefundFlow'da iki hesabı yan yana göster ve manuel tutarı sapma uyarısıyla sınırla.
- **15.1.6 · İade değerleme kuralı (kur ve tarih)** — `quoteRefund(ticketNumber, couponSeqs, waiver, date)` mock hesaplayıcı ekle: COC para birimi, orijinal ROE, kullanılan/kullanılmayan kupon ayrımı, ceza + service charge kesintisi → önerilen tutar (personel yalnız onaylar, ücret gibi ELLE GİRMEZ — 2026-07-12 pricing dersinin iade karşılığı). RefundFlow'u bu tarifeye bağla.
- **2.22.1.1 · Fare Component Calculation veri elemanları** — `FareComponent` tipi ekle (kupon aralığı + from/to + carrier + baseAmount + fareBasis + tarife/kural + waiver + ROE) ve `FareCalculation.components: FareComponent[]` yap; pricing motorunu bileşen bazlı üretmeye çevir; bilet detayına bileşen tablosu koy.
- **5.5 · EMD Void yalnızca Validating Carrier'ın raporlama dönemi içinde** — api.ts'e `voidEmd({emdNumber, reason, idempotencyKey})` ekle: tüm EMD kuponları O olmalı + issueDate Validating Carrier'ın açık raporlama döneminde olmalı, aksi 422. `refundEmd` de benzer. EmdDetail.tsx'e toolbar (Void / İade) ve flows'a EmdVoidFlow ekle; EMD için de history/lifecycle tut (şu an Emd tipinde history yok — types.ts:177-187).
- **5.8 · EMD Receipt (yolcu makbuzu) teslimi ve zorunlu içeriği** — /emds/$emdNumber/receipt sayfası (Itinerary.tsx deseniyle) + EmdDetail'e "Makbuz / Yazdır" butonu; Emd'ye FOP (son 4 hane maskeli), kesim yeri, endorsement, tour code alanları.

## 3. Eksik — orta/düşük etki

- **10.9.3 · Kredi kartı satış ve iade belgelerinin aynı gün gelir muhasebesine iletilmesi** — FOP'a approvalCode ekledikten sonra `ChargeForm` belge tipi + kesimde otomatik üretim + iadede Transportation Credit; SalesReport'a 'Gelir muhasebesine iletildi' durum kolonu ve gün sonu kapanışta iletilmemişleri listeleyen kontrol.
- **12.13.1 · Kağıt biletten elektronik bilete dönüşüm** — `convertPaperToEt` komutu: ciro kontrolü → PNR çağrı → kalan tüm segmentlerde `etEligible` doğrulaması → yeniden fiyatlama → issuedInExchangeFor ile ET kaydı üret.
- **12.13.1 · Audit/Agent nüshasının settlement ve denetim için saklanması** — Ticket'a `auditCoupon: {createdAt, retainUntil, archiveRef, reportingPeriodId}` ekle (retainUntil = issuedAt + 2 yıl); TicketDetail'e 'Audit/Agent nüshası' bölümü + basılabilir görünüm; v1 PrintFx'i geri taşımayı değerlendir.
- **12.13.2 · Request Control Message (sonraki değişiklik için kontrolü geri isteme)** — `requestControl(ticketNumber, couponSeq, reason)` komutu + REQ/RES mesaj tipi; exchange/reissue akışında kontrol başkasındaysa otomatik tetikle ve yanıt gelene kadar işlemi blokla.
- **12.2.3 · Ciro gerekliliği karar tablosu (Original Issue / Issued By / GSA / PTA)** — Ticket'a originalIssue{carrier,date,place,agent} + issuedBy + ptaIssuingCarrier alanları; honour/reissue/endorse taleplerinde bu alanlardan yetki türeten saf bir karar fonksiyonu (`endorsementRequired()`).
- **12.4.1.1 · Yalnızca yurtiçi kupon kalan bilette uluslararası rerouting yasağı** — `domesticGroup(countryCode)` tablosu (TR, DK-NO-SE, US-CA); exchange'de kalan kuponlar tamamen yurtiçiyse uluslararası yeni güzergâhı reddet.
- **12.5 · Reissue parasal alan matrisi (PD / NO ADC / A)** — TaxFeeCharge'a `paid`+`refundable`; exchange sonucunda Fare/Equiv/TFC/Total/FOP alanlarını matrise göre üret (ödenmiş TFC'lere PD öneki, tahsilat yoksa Total="NO ADC", tahsilat varsa tutar+"A" ve çift FOP).
- **12.6.2 · ABD istisnası — origin'den yeniden hesaplama** — Reprice fonksiyonuna `transactionCountry` + yolculuk O/D ülkeleri; ABD dokunuşu varsa hesabı her zaman orijinal başlangıç noktasından yap ve en düşük ücret için break point alternatiflerini dene.
- **12.9 · Tamamen kullanılmamış bilette exchange fiyatlaması** — Hiç kullanılmamış bilette exchange'i yeni yolculuk fiyatlaması olarak çalıştır (yeni taşıma başlangıç tarihi ücretleri + o tarihteki IROE, ISI'sız) ve farkı ADC/residual olarak sistem üretsin.
- **13.10 · Hastalık nedeniyle bilet geçerliliğinin uzatılması** — `extendValidity(ticket, medicalCert, fitToFlyDate)` komutu: fare tipine göre (normal→uygunluk tarihi/stopover varsa +3 ay; short-limit→+7 gün) kupon NVA'sını güncelle, tek-seferlik bayrağı tut, eşlik eden aile biletlerini de kapsa.
- **13.6 · Involuntary indicator'lı kontrol talebi reddedilemez; redirect yalnız bilateral** — Kontrol talebine `involuntary` bayrağı ve "reddedilemez" kuralı; BilateralAgreement'a `airlineRedirect`/`unsolicitedAirportControl` izinleri ve bu mesajları göndermeden önce anlaşma kontrolü.
- **14.2 · ISO ülke + IATA para birimi + TFC bilet kodu sözlüğü (encode/decode)** — `domain/taxCodes.ts` ekle: {code, name, isoCountry, currency, type, domesticOnly} tablosu (AY/XF/YB/TR/YQ… örnek alt küme) + `decodeTax(code)`; FareBreakdown ve Itinerary'de kod yanında resmî adı ve ülkeyi göster.
- **14.2.3 · Ücret/fazla bagaj para biriminin taşımanın başladığı ülkeye göre belirlenmesi** — airports.ts'e ülke→paraBirimi eşlemesi (+ USD/EUR listesi istisnası) ekle; `computeFareOffers` para birimini ilk bacağın kalkış ülkesinden türetsin; fazla bagaj EMD'sinde aynı kuralı uygula.
- **14.7.1 · Kayıp/çalıntı/sahte belgenin kara listeye bildirimi** — `RevenueAlert`'e aksiyon ekle: `reportToBlacklist(docNumber, docType, reason: lost|stolen|fraudulent|suspicious, carrier)` mock komutu + Admin/Gelir Koruma ekranında 'Kara listeye bildir' butonu ve bildirim kaydı (audit event).
- **15.1.3.2 · İade yetkisi ve iade kısıtlamalarının kontrolü (düzenleyen taşıyıcı / UATP / FOP-endorsement kısıtı)** — refundTicket'a ön kontroller ekle: (1) validatingCarrier ≠ oturumun taşıyıcısı ise 'düzenleyen taşıyıcı onayı/referansı' zorunlu alan; (2) fop.type==='uatp' ise UATP yordamı uyarısı + ayrı akış; (3) endorsement 'NON-REF' vb. içeriyorsa engelle/override gerektir.
- **15.1.4 · Kayıp bilet iadesi + tazminat taahhüdü (indemnity) ve replacement mahsubu** — Ayrı 'Kayıp bilet iadesi' akışı: proofOfLoss referansı + indemnity form referansı zorunlu, kupon kullanım doğrulaması (tümü O olmalı), replacement bilet no + ödenen toplam − fiilen kullanılan − lostTicketCharge hesabı; kayıt history'ye ayrı event olarak yazılsın.
- **15.2 · İade yetkisi — orijinal kesen taşıyıcıya bağlılık ve Agents Refund Voucher** — refundTicket'a 'yalnız Validating Carrier / yetkili ofis' kontrolü ekle (control + issuance.agentNumericCode); ayrı `AgentsRefundVoucher` belgesi tipi + `issueRefundVoucher` komutu + basılabilir görünüm; RefundFlow'daki 'voucher' etiketini 'Travel credit (EMD-S)' olarak netleştir ki iki kavram karışmasın.
- **15.3 · MCO iadeleri ve 'For Refund Only' MCO** — Kısa vade: RefundFlow'a Residual alanını geri koy (api zaten destekliyor). Orta vade: residual bakiye için 'For Refund Only' belge (EMD-S veya MCO muadili) üret — toAt = orijinal düzenleyen taşıyıcı, typeOfService='For Refund Only'; iadeyi yalnız orijinal düzenleyen taşıyıcının yapabildiği kontrolü ekle.
- **2.15 · Origin/Destination alanı** — Ticket'a `journeyOrigin`/`journeyDestination` ekle; issue ve exchange'te ilk kalkış/son varıştan doldur; conjunction/reissue'da zorunlu kıl ve bilet başlığında göster.
- **2.21 · Fare Calculation Pricing/Reporting Indicator (F.I.)** — FareCalculation'a `pricingIndicator: '0'|'1'|'2'` ekle; sistem tarifesinden seçim → '0', elle müdahale → '1', yalnız bagaj/TFC müdahalesi → '2'; bilet detayında ve fare calc bloğunda göster.
- **2.21 · Fare Calculation Pricing/Reporting Indicator (F.I.)** — FareCalculation'a `fci: string` (tek karakter) ekle; issueTicket'ta teklif seçildiyse '0', TFC/bagaj müdahalesi varsa '2' yaz; TicketDetail Fare/TFC kartında ve receipt'te göster.
- **2.22.1.1 · Net / Sell tutarları (agent remittance ayrımı)** — FareCalculation'a `components: FareComponent[]` ekle ({baseAmount, netAmount, sellAmount, fareOwner, tariffNo, ruleNo, waiverCode}) ve Total Base/Net/Sell Construction Amount toplamları; IssueWizard'da negotiated fare seçildiğinde net/sell girişi; SalesReport'ta remittance kolonu.
- **2.6 · Fare Basis kodu bileşimi** — `domain/fareBasis.ts` ekle: `composeFareBasis({prime, seasonal, partOfWeek, partOfDay, paxType, level, designator})` saf fonksiyon + testler; FARE_TYPES'ı bu parçalardan üret.
- **5.10 · EMD control (zilyetlik) kuralları** — Emd'ye control: ControlAuthority; grantControl/returnControl komutları (yalnız VC devreder, tek taşıyıcı, TTL) + endorsement kaydı; EmdDetail'de ControlIndicator.
- **5.3 · EMD belge yapısı sınırları (≤4 kupon / ≤4 conjunction EMD)** — addEmd'i çok kuponlu yap + `coupons.length <= 4` invariant'ı; Emd'ye conjunctionEmds?: string[] (≤4) ekle ve EmdDetail'de chip olarak göster.
- **5.4 · EMD kabulü interline trafik + bilateral anlaşmalara tabi** — canAcceptEmd(vc, marketing/operating) saf fonksiyonu + addEmd/check-in kabul yolunda zorlama; Agreements sayfasına EMD yeteneği kolonu.
- **9.2.1 · PTA kesimi ve iletimi (MCO/MPD olarak)** — Pta'ya documentType (MCO|MPD) + documentNumber (buildTicketNumber ile), issuingOffice/transmittingOffice/ticketingOffice, exchangeCouponRetained ekle; createPta'da sponsor tahsilat tutarı + kur alanı.
- **9.2.2 · PTA karşılığı kesimde ek tahsilat gerektiren değişiklik (iki adımlı issue→reissue)** — issueAgainstPta sonrası opsiyonel "değişiklik + ADC" adımı: önce Specified Amount ile kes, sonra exchangeTicket ile ADC'li reissue; linkage'ı PTA kaydına yaz.
- **9.5.2, 9.5.4 · PTA belge ve teletype mesaj veri seti** — Pta tipini 9.5.2 alan listesine göre genişlet; PTA belge önizleme/yazdırma görünümü (Itinerary.tsx deseni); interline mesaj store'una PTA teletype mesajı üret ve Messages sayfasında göster.
- **14.4.1 · Bagaj havuzlaması (Pooling — 'PL' + grup başkanı bileti)** — Multi-pax/grup ticketing gelene kadar ertele; geldiğinde grup başkanı biletine `pooling: {members: string[], totalPieces, totalWeight}` + endorsement'a otomatik 'PL{n}', üye biletlerine 'PL{son2hane}' yaz.
- **14.5.3 · 'Special Items' (özel eşya) kutusu + beyan edilen fazla değer** — EMD baggage akışına özel eşya seçici (golf/ski/pet/bulky/diğer) + `declaredExcessValue: Money` + `seatsCharged?: number` ekle; seçilen tipe göre oran (%25/%50/%100/2x) önerisi göster.
- **14.6 · Kabin bagajı (CBBG) için ikinci bilet / ekstra koltuk** — Ekstra-koltuk kesimi için wizard'a 'Kabin bagajı (CBBG)' seçeneği: ad+' CBBG', fareBasis+'CB', endorsement=ana bilet no, allowance='NIL' otomatik doldurulsun; aynı turda `Passenger.infant` girişini de wizard'a geri getir (şu an disconnected).
- **14.7.2 / .1 / .2 / .3 · Kara liste sorgu/listeleme numarasının doğru seçilmesi (SCN vs 13 hane)** — 14.7.1 komutu eklenirse: belgeye `stockControlNumber?` + `stockProviderCode` alanları; listeleme numarası seçimi SCN varsa SCN (+sağlayıcı öneki), yoksa 13-hane kuralıyla otomatik türetilsin ve UI'da hangi numaranın kullanıldığı gösterilsin.
- **15.1.5 · Involuntary/kayıp bilet iadesinde geçerli ücret kısıtları (through fare, OW↔RT/CT dönüşümü)** — 15.1.2 kural motoru eklenirken `tripType` (kuponlardan türetilebilir: origin==son destination → RT/CT) ve `travelCommenced` (herhangi bir kupon F/L/C mi) hesapla; talep zamanı varıştan sonraysa through fare / OW→RT dönüşümünü UI'da kilitle.
- **15.2 · Acente iade voucher'ı (agents refund voucher) ve acentenin MCO düzenleyememesi** — Acente rolü modellenene kadar ertele; modellenirse iade yönteminde rol acente ise 'agents refund voucher' seçeneği (voucherNo + üzerine çekilen havayolu = orijinal düzenleyen) ve MCO seçeneğinin rol bazlı engeli.
- **5.6 · EMD değer sınırı (USD 750 / banker's selling rate / FOR REFUND ONLY)** — addEmd'e emdType==="S" && issuer===carrier && !forRefundOnly ise USD 750 muadili tavan kontrolü (fx.convert ile) + Emd'ye forRefundOnly + originalIssuingCarrier alanları.
- **5.7 · Acente kesimli EMD'de görüntüleme kısıtı** — User'a officeCode/iataNumber, Emd'ye issuingOffice ekle; searchEmds/getEmd'de acente kesimli EMD için lokasyon filtresi (backend authz'ye taşınacak şekilde).
- **5.8 · EMD-A Validating Carrier'ı ET'ninkinden farklıysa association talebi** — Emd.validatingCarrier'ı ayrı alan yap; farklıysa interline mesaj kuyruğuna EMD association request üret ve Messages sayfasında göster.
- **9.2.2 · PTA teslim alma teyidi (ACK) ve değişiklik yasağı** — Pta'ya acknowledgedAt/acknowledgedBy + acknowledgePta() komutu; Pta sayfasında "Teslim alındı" aksiyonu ve ACK edilmemiş PTA'ya karşı kesimi engelle.
- **9.4, 9.4.1, 9.4.2 · Elektronik biletlerde PTA'nın yeri ve ülke bazlı kesim kısıtları** — airports.ts'ten origin ülkesini türeten yardımcı + küçük kısıt tablosu (ülke → yerel kesim zorunlu mu); createPta/issueAgainstPta'da uyarı bandı ve gerekirse engelleme.

## 4. Kısmi — yüksek etki

- **1.1.4.4 · No-show — kupon kontrolünün iadesi** — markNoShow'da control'ü Validating Carrier'a döndür + ControlReturned event; uçuş kapanışında (ops/gate_closed) otomatik no-show tetiği; check-in→kupon linkage'ini geri bağla (SeatSelection'da checkInPassenger sonrası advanceCouponStatus(...,"C")).
- **1.1.6 · Yolcu Itinerary/Receipt üretimi ve teslimi** — Eski Itinerary'nin Conditions of Contract + Mandatory Notices bloklarını v2'ye geri taşı; belgeye FOP (maskeli), TFC satırları, rezervasyon durum kodu, Operating Carrier, kesim yeri ve endorsement alanlarını ekle.
- **1.3.2 / 1.1.5.3.3 · Exchange/Reissue ve öncesinde kontrol doğrulaması** — exchangeTicket başına kontrol kapısı ekle (holder === işlem yapan carrier değilse DomainError + 'önce control iste'); Ticket'a issuedInExchangeFor ve originalIssue alanları ekleyip TicketDetail'de göster.
- **12.2.2 · ET'de kontrol = ciro (control grant/revoke, airport control)** — `requestControl/grantControl/returnControl` komutları + ControlGranted/ControlReturned event üretimi; exchange/reissue öncesi "kontrol Validating Carrier'da mı" önkoşulu; check-in'de airport control alımı (O→A).
- **12.4.1 · Reissue — EXCHANGED işaretleme ve belge bağlantısı** — Ticket'a `issuedInExchangeFor{ticketNumber,couponSeqs}` + `originalIssue{...}` alanları ekle; TicketDetail yaşam döngüsünde bağlı bilet linkini ve event detayını göster (CouponTimeline'ı geri bağla ya da CommitGraph'a detail/link ekle).
- **13.6 · Involuntary durumda yeniden bilet kesme zorunluluğu** — IRROP akışını iki adımlı yap: önce NOC segmentiyle involuntary REISSUE (yeni bilet, kuponlar E), FIM yalnız reissue/transfer mümkün değilse; newFlight'a envanter durumu (HK/HL) ekle.
- **13.8 · FIM yalnız son çare + G statüsü ve Change of Status bildirimi** — irropReroute'a FIM ön koşul kapısı (diversion + reissue imkânsız + tüm kuponlarda kontrol OOC'de) ve reddi; FIM sonrası Change of Status interline mesajı üret; FIM numarasını gerçek formata çevir.
- **14.7 · Revenue protection — blacklist ve elektronik bilet askıya alma** — `suspendTicket({ticketNumber, couponSeqs, reason:'lost'|'stolen'|'fraudulent'|'suspicious', idempotencyKey})` komutu + `CouponSuspended` event + TicketDetail 'İşlemler' menüsünde 'Askıya al' (ve S→O geri alma); RevenueAlert satırından tek tıkla suspend; kâğıt belgeler için `StockControlNumber` + blacklist kayıt listesi (/admin/revenue içinde ikinci sekme).
- **15.1.3.1 · Voluntary iade tutarının hesabı (fark − service charge − communication expenses)** — Önce regresyonu düzelt: taxOnly seçiliyken öneriyi `fare.totalTfc` üzerinden hesapla. Sonra RefundInput'a `serviceCharge`/`communicationExpenses` ekle, net iade = brüt − kesintiler olarak hesaplanıp özet satırında gösterilsin.
- **2.1.2 / 2.17 · Conjunction (birleşik) bilet zinciri** — issueTicket'e kupon kapasitesi (4) kontrolü ekle: aşınca ardışık seri no'larla N bilet üret, her birine formCode + ilk biletin tam no'su + diğerlerinin son iki hanesi + booklet sayısı yaz, fare'ı tüm biletlerde aynı tut.
- **2.14 · Form of Payment (ödeme şekli) kaydı** — `FormOfPayment` → `FormOfPayment[]` (her kalem code+amount); kredi kartında cardCode/approvalCode zorunlu alan yap (approval code IATA'da zorunlu); belge/itinerary'de son 4 hane hariç maskeyi koru.
- **2.18 · Issued in Exchange For / Original Issue bağlantısı** — Ticket'a `issuedInExchangeFor: string[]` + `originalIssue{documentNumber, place, date, agentNumericCode}` ekle; exchangeTicket'te ilk kesimde doldur, sonraki reissue'da AYNEN taşı; endorsement/tourCode'u da carry-forward listesine al.
- **2.18 · Belgeler arası izlenebilirlik — Issued in Exchange For / Original Issue** — Ticket'a `issuedInExchangeFor: {documentNumbers[], couponNumbers[]}` ve `originalIssue: {documentNumber, place, date, agentNumericCode}` ekle; exchangeTicket'ta originalIssue'yu eskiden AYNEN taşı (yoksa eski bileti orijinal say). TicketDetail'de bağlı bilet linkini geri getir (CommitGraph'a link desteği ya da ayrı 'Belge zinciri' satırı).
- **2.20 · Validation / kesim kimliği alanları (satış raporu anahtarları)** — Ticket'a `issuance: {placeOfIssue, agencyName, agentNumericCode, agentId, pcc}` bloğu ekle; issueTicket'ta oturum kullanıcısı + istasyondan (Admin 'İstasyon: IST-CTR') doldur; `event()` actor'ünü de aynı kaynaktan üret; TicketDetail + Itinerary + SalesReport'ta göster. Bunlar satış raporunun anahtar alanları — F.I. ve dönem kapanışından önce gelmeli.
- **2.22.2 / 2.22.6 · Fare Calculation dizgesi: zorunluluk ve sözdizimi** — `domain/fareCalc.ts` içinde `buildFareCalcString(components, roe, tfcs)` saf üretici yaz + sözdizimi testleri; issueTicket ve exchangeTicket'te ÜRET (kopyalama).
- **5.2.1 · EMD-S (Stand-alone) — ET kuponuyla kaldırılmayan tahsilatlar** — addEmd'i ticketNumber opsiyonel yap (EMD-S için); /emds sayfasına "Yeni EMD" (bilete bağlı olmayan) aksiyonu ekle; groupName alanı + RFISC kataloğunu 5.2.1 gerekçeleriyle genişlet.
- **9.2.2 · PTA karşılığında bilet kesimi (Issued in Exchange For / Original Issue / EFP / NO ADC)** — Ticket'a issuedInExchangeFor + originalIssue {number, place, date, agentCode}; issueAgainstPta'da bunları ve fare.equivFarePaid'i doldur, total'i "NO ADC" göstergesiyle işaretle; uçuşu flights/pricing üzerinden seçtir.
- **App B (1.1.6) · Zorunlu bilet uyarılarının (mandatory notices) teslimi** — Itinerary'ye Conditions of Contract (Varşova/Montreal) + zorunlu bildirim listesini TR/EN geri koy (eski dosyadan taşınabilir); ayrıca `deliverNotices(ticketNumber, channel)` mock komutu + history'ye 'NoticesDelivered' olayı (kanal, zaman, dil, sürüm) yazan basit teslim kaydı ekle.
- **App B (1.1.6) · Itinerary/Receipt zorunlu içeriği** — Itinerary'yi App B kontrol listesine göre tamamla: operating carrier, rezervasyon statüsü, NVB/NVA, endorsement, ödeme şekli, TFC kalem tablosu, eşdeğer ücret, düzenleme yeri/acente. Eksik veri alanları için Ticket'a `placeOfIssue`, `issuingAgency` ekle; equivFarePaid için wizard'a giriş (veya pricing'den türetim) geri getir.

## 5. Kısmi — orta/düşük etki

- **1.1 · ET kaydı ve değişmez işlem tarihçesi** — event() üreticisine aktörü parametre yap ve oturum kullanıcısı + carrier + ofis kodunu yaz; LifecycleEvent'e fromStatus/toStatus ekleyip timeline ile SalesReport'ta göster.
- **1.1.2 · Taşıyıcı rolleri ve Validating Carrier otoritesi** — Ticket'a billingCarrier + ticketHandler ekle; para/statü değiştiren her komutun başına `assertValidatingCarrier(ticket, actingCarrier)` kapısı koy (özellikle printToPaper 1.3.3); CarrierRole'ü ya kullan ya kaldır.
- **1.1.3.2 · ET zorunlu veri elemanları seti (33 eleman)** — Ticket'a placeOfIssue, pcc, fcmi, issuedInExchangeFor, originalIssue, frequentFlyer; Coupon'a freeBaggageAllowance ve checkedBaggage alanlarını ekle; IssueWizard'da otomatik doldur (PCC/kesim yeri oturumdan), TicketDetail ve Itinerary'de göster.
- **1.1.3.4 · Conjunction (bağlantılı) bilet kuralları** — issueTicket'ta 4 kupondan fazlasında otomatik conjunction bilet serisi üret (ardışık numara + ortak form code), 16 segment tavanını DomainError ile zorla; IssueWizard'da bacak sayısı arttıkça 'bu bilet 2 conjunctive belgeye bölünecek' uyarısı göster.
- **1.1.5.1 (a) · Kuponların yalnızca sırayla kullanılması** — Sıra kontrolünü ortak bir assertInSequence(ticket, couponSeqs) yardımcısına çıkar ve statü değiştiren tüm komutlarda çağır (RevenueAlertKind.out_of_sequence de bundan beslensin).
- **1.1.5.3 · Tek-kontrol invariantı ve 'O' ön şartı** — ControlAuthority'yi Coupon'a taşı (bilet düzeyinde türetilmiş özet kalsın); StatusPill'e kontrol sahibi ekini (A/BB) ekle; grant komutunda önce mevcut holder'dan revoke şartını zorla.
- **1.1.5.3 · Historical Record — tüm ET aktivitesinin denetim kaydı** — CommitGraph'a `detail` satırı ve bağlı bilet linkini ekle (ya da CouponTimeline'ı geri bağla — ölü kod olarak durmasın); LifecycleEvent'e `fromStatus` ve `office/agentId` ekle; Ticket'a `closedAt` + 7 günlük erişim penceresi göstergesi.
- **1.1.5.3.1 · Acente işlemlerinde kupon açıklık kuralları ve VC onayı** — void/refund/exchange komutlarına 'VC talebi gönderildi → kabul/ret' adımı ekleyip InterlineMessage üret; event() actor'ünü store/ui.ts'teki oturum kullanıcısından (ad + rol + ofis) doldur.
- **1.1.6 · Passenger Itinerary/Receipt — satış makbuzu asgari alanları** — Itinerary.tsx'e FOP (maskeli), TFC kalemleri, rezervasyon statü kodu, operating carrier, endorsement/geçerlilik, bagaj hakkı (pricing.ts FareOffer.baggageKg zaten üretiyor) ve equivFarePaid satırlarını ekle; YQ gibi carrier-imposed ücretleri devlet vergilerinden ayrı grupla ve altına 'ek ücretler için ayrı makbuz' bloğu koy.
- **1.1.7 · Check-in kimlik belgesi (FOID)** — foid'i { issuer, number, type } yapısına çevir (AIRIMP tip kodları için küçük katalog, ssr.ts modelindeki gibi); check-in kabulünde yolcunun passport/nationalId'si ile bilet FOID'ini eşleştir ve uyuşmazlıkta uyar.
- **1.3.3 · Carrier Print to Paper** — printToPaper'a VC yetki kapısı ekle; çıktı belgesine ETKT + orijinal ET numarasını bas (PrintFx'i v2'ye taşı); PrintToPaperInput'a stock: 'ATB2'|'TAT' ekle; queryTransactions'ta CouponPrinted satırlarını satış raporlamasından ayır.
- **1.3.6 · Settlement Authorisation Code (SAC) üretimi** — assignSac'ı komut düzeyine taşı: bir işlemde tek kod üretilip etkilenen tüm kuponlara aynısı yazılsın; printExchange ve refundCancel tetikleyicilerini ekle.
- **1.3.6 · Settlement Authorisation Code (SAC) üretimi** — SAC'i `{code, generatedAt, source, forPassenger}` nesnesine çıkar; yolcu başına tek SAC üret ve kuponlara referansla; refundTicket ve Refund-Cancel'e assignSac ekle; ilk 4 karakteri accounting code kuralına uydur (3 karakterli kodda pozisyon 1 boşluk → `' 235'`, şu an `2350`); interline mesaj kuyruğuna SAC bildirimi ekle.
- **12.13.2 · SAC üretimi ve Refund-Cancel** — refundTicket ve irropReroute'ta assignSac çağır; raporlama dönemi içinde `refundCancel` komutu (R→O, aynı SAC referansı) ve FSM istisnası; SAC'ı interline mesaj yüküne ekle.
- **12.3.1.1 · Revalidation — rota değişmeden rezervasyon değişikliği** — revalidateCoupon'a validating/marketing/operating eşitlik ve "ücret değişmiyor" ön koşulu; interline segmentte reddet ve kullanıcıyı Reservation Change/Exchange'e yönlendir; UI kupon filtresini O/A'ya hizala.
- **12.5 · Reissue parasal raporlama girdileri (ADC / NO ADC / PD)** — Ticket'a `reissue: {adcAmount, adcCurrency, noAdc: boolean, paidTaxes: [{code, amount}]}` ekle; ADC 0 ise noAdc=true yaz; eski TFC'leri 'PD' işaretiyle taşı; ExchangeFlow onay adımında 'NO ADC' / 'ADC + A' özetini göster.
- **13.1 · IRROP rol ve olay tanımları (OMC/OOC/NOC, misconnection)** — IrropInput'a event tipi (cancellation/delay/denied-boarding/misconnection) + OMC/OOC/NOC/ticketHandler rolleri + fare tipi; HUB Kontrol'deki MCT riskini kupon/bilet bağlantısıyla IRROP akışına besle.
- **13.9 (metin 15.4'te) · Vefat halinde rerouting, iade ve waiver** — Waiver seçilince belge alanları (tip, düzenleyen makam, tarih, vefat edenin adı, yakınlık) zorunlu olsun; "RETURN ACCOUNT DEATH (isim)" ciro metnini otomatik üret; 45 gün sayacı ve belge-sonradan-ibraz iade akışı.
- **14.1 · TFC tiplerinin ayrı kaydı (departure/sales/transportation + tahsil noktası)** — TaxFeeCharge'a `type: 'departure'|'sales'|'transportation'`, `collectedAt: 'issue'|'local'`, `collector: 'airline'|'government'` alanları ekle; pricing.ts kalemlerini bu tiplerle üret; FareBreakdown/Itinerary'de tipe göre grupla (yerel tahsil edilecekler ayrı başlık).
- **14.5 / 14.5.1 / 14.5.2 · Fazla bagaj belgesi (excess baggage EMD) girişleri** — EmdCoupon'a `excess?: {pieces?, oversizePieces?, weightKg?, ratePerUnit, unit}` ekle; EmdFlow baggage modunda parça/kg + birim ücret girdirip tutarı OTOMATİK hesaplasın (elle girilen tutar yerine); EmdDetail'de bu kalemleri göster.
- **14.7.4 · Elektronik bilette gelir koruma = kuponu askıya alma (S — Suspended)** — api.ts'e `suspendCoupons`/`releaseCoupons` (yalnız Validating Carrier, sebep+zaman, idempotent) ekle; flows/index.tsx'e SuspendFlow + TicketDetail İşlemler menüsüne 'Askıya al / Askıyı kaldır' (perm: revenue.view/chief) ve Gelir Koruma uyarısından tek tıkla askıya alma.
- **15.4 · Vefat halinde iade / güzergâh değişikliği (death waiver)** — Muafiyet 'death' seçilince zorunlu alt-form: belge referansı + düzenleyen makam + yakınlık derecesi (enum) + kesinti tarihi (→ +45 gün son tarih rozeti); onaylandığında ticket.endorsement'a otomatik 'RETURN ACCOUNT DEATH (AD)' yaz ve saklama süresi uyarısını göster.
- **2.1.1 · Kupon bölme kuralı (segment → uçuş kuponu)** — Segment'e `stopover: boolean` + segment-başına RBD ekle; kupon üretimini taşıyıcı/uçuş/RBD/stopover değişiminde bölen saf bir `splitCoupons(segments)` fonksiyonuna al ve test et.
- **2.1.11 · Kuponların sıra zorunluluğu** — Sıra kontrolünü ortak bir `assertInSequence(ticket, seqs)` yardımcısına çıkar; refund/exchange komutlarında da çağır; refund'da kalan kuponların akıbetini (iptal/uyarı) açıkça ele al.
- **2.1.4 · Itinerary/receipt + zorunlu bilet bildirimleri** — App B bildirim metinlerini `domain/notices.ts`'e (tr/en) al, Itinerary'de zorunlu blok olarak bas; kesim başarı ekranına "Belgeyi aç/yazdır" aksiyonu ekle; FOP satırını belgeye koy.
- **2.10 · "Fare" alanı (çıplak ücret)** — Fare kutusunu `{ amount } | { code: 'IT'|'BT' }` ayrık birleşimi yap; para birimini kalkış ülkesinden türet (airports.ts countryCode → currency tablosu).
- **2.11 / 2.13 · Equivalent Fare Paid ve Total tutarlılığı** — Ödeme adımına "ödeme para birimi" seçimi ekle; farklıysa fx ile yuvarlanmış equivFarePaid üret ve `total = (equiv ?? fare) + ΣTFC` hesabını tek bir saf fonksiyona al + test et.
- **2.12 · Tax/Fee/Charge (TFC) kırılımı** — TaxFeeCharge'a `exempt?: boolean` ve `detail?: {airport?: string}` ekle; aynı kodları toplayan `normalizeTfcs()` yaz; XF/ZP için havaalanı kırılımını göster.
- **2.12 · TFC kodlama, birleştirme ve kur dönüşümü** — TaxFeeCharge'a `exempt?: boolean`, `conversion?: {rate, rateType:'BSR', date, rounding}` ekle; pricing çıktısında aynı kodları topla; TFC girdisinde 'XT' reddi.
- **2.14 · Form of Payment kaydı ve reissue'da taşınması** — FormOfPayment'ı diziye çevir ({type, cardCode, maskedAccount, approvalCode, amount, extendedPayment}); kredi kartı seçilince approval code alanı zorunlu; exchange'de yeni FOP + orijinal FOP'u ayrı ayrı sakla ve TicketDetail'de ikisini de göster.
- **2.16 · PNR referansı ve kontrol eden sistem** — Ticket'a `pnrControllingCarrier` ekle (varsayılan validatingCarrier), gösterimi `TK/XQ7T2M` biçiminde birleştir; interline PNR'da ortak taşıyıcı kodunu yaz.
- **2.22.4 · NUC / ROE / banker's rate dönüşüm izi** — pricing.ts'e NUC dönüşümü ekle (base → NUC, sabit IROE tablosu) ve fareCalcString'i otomatik kur; FareCalculation'a `cocCurrency`, `bsr`, `rateDate` alanları; TicketDetail'de ROE/NUC'u ayrı satırda göster.
- **2.23 / 2.24 · Özel ücret ve karma sınıf biletleme** — Seçilen FareOffer'ın kısıtlarını kesimde endorsement + NVB/NVA'ya yaz; EXST/STCR yolcu tipi + EX/SZ fare basis + Q surcharge desteği ekle; mixed-class rozetini v1'deki gibi kuponların RBD/kabinlerinden türetip TicketDetail'e geri koy.
- **2.3 · Yolcu adı alanı ve özel amaç kodları** — Kucak bebeği bloğunu v1'den v2 wizard'a geri taşı; ada iliştirilen `specialPurposeCode` (INF/CHD+yaş, UM+yaş, EXST, STCR, INAD, DEPA/DEPU, CBBG, COUR, DIPL, SP) seçici + gerektiğinde DOB alanı ekle; CHD/INF'i title listesinden çıkar.
- **2.4.2 / 2.4.1(i) · Kupon başına board/off noktası ve X/O göstergesi** — Segment'e `stopIndicator: 'X'|'O'` ve `surface?: boolean` ekle; kupon şeridinde ve fare calc dizgesinde göster; X→O değişiminde yeniden fiyatlama uyarısı çıkar.
- **2.5 · Rezervasyon verileri ve statü kodları** — `reservationStatus` tipini `'OK'|'RQ'|'SA'|'NS'` union'ına daralt, PNR HK→bilet OK eşlemesini tek yerde yap; OPEN segment için uçuş no/saat opsiyonel hale getir; waitlist'i endorsement'a yaz.
- **2.7 · Tour Code alanı** — IssueWizard ücret adımına IT/BT seçimi + tur numarası alanı ekle; `parseTourCode/formatTourCode` ile 14 karakter yapısını doğrula; IT/BT seçilince Fare kutusunu 2.10'a göre "IT"/"BT"ye çevir.
- **2.8 · Not Valid Before / Not Valid After** — FareOffer'a `minStayDays`/`maxValidityMonths`/`changeRestricted` ekle; issueTicket'te kupon başına NVB/NVA hesapla; kısıtlı tarifede NVB=NVA=kupon rezervasyon tarihi yap.
- **5.1 · EMD kaydı Validating Carrier veritabanında + bilateral EMD anlaşma doğrulaması** — addEmd'e kesim öncesi bilateral kontrol ekle (MOCK_AGREEMENTS'ta partner active + capability var mı); Emd'ye marketingCarrier/operatingCarrier alanları koy.
- **5.3 · Taraf rolleri (Validating/Marketing/Operating/Billing) + Billing Carrier Coupon Data** — Emd/EmdCoupon'a marketingCarrier/operatingCarrier/billingCarrier + origin/destination ekle; EmdDetail'de rol satırları ve Billing Carrier Coupon Data bloğu göster.
- **5.3 · EMD interline faturalama verisi (Billing Carrier + Reason for Issuance)** — EmdCoupon'a `billingCarrier`, `rfic` (grup), `origin`, `destination` ekle; addEmd'de RFISC seçilince RFISC_CATALOG.group'tan rfic'i otomatik yaz, EMD-A'da O/D'yi bağlı kupon segmentinden doldur; EmdDetail'de 'Billing Carrier Coupon Data' bloğu.
- **5.3, 5.8 · Reason for Issuance Code (RFIC) + Sub Code (RFISC)** — Emd'ye rfic (belge seviyesi) ekle, RFISC seçilince gruptan türet; RFISC_CATALOG'u handbook gerekçe listesiyle genişlet ve grubu UI'da göster.
- **5.5 · EMD kupon statü göstergeleri (yaşam döngüsü izleme)** — refundEmd/voidEmd komutları + EmdDetail'e aksiyon butonları; emdType'a duyarlı FSM guard'ı (C/L/I yalnız EMD-A); Emd'ye control alanı.
- **5.8 · EMD kupon seti (value/audit/receipt/charge form) + yolcu adı kısıtları** — Emd'ye passengerName|groupName ayrımı + auditCoupon/chargeForm bayrakları; EMD-S formunda grup adı seçeneği; EMD-A'da grup adını reddet.
- **5.8 · EMD-A value kuponu oluşturma + kesim öncesi ET doğrulaması** — EmdCoupon'a carrier + origin/destination ekle; addEmd'i seçilen kupon KÜMESİ için value kuponu üretecek şekilde genişlet; carrier!=="YY" ve board/off sırası ET ile aynı invariant'ları + testleri yaz.
- **5.9 · EMD kaydında bulunması gereken asgari veri elemanları (MCO Ch 3 + fazla bagaj Ch 14.5)** — Emd tipini 5.9 listesine göre genişlet; EmdFlow'a fazla-bagaj alt formu (kg/parça/birim ücret) ekle; EmdDetail'de MetaGrid'e yeni alanları bas.
- **9.1 · PTA amacı ve kapsam sınırı** — Pta'ya items[] (fare/tfc/excessBaggage/cashAdvance) ekle; Pta oluşturma modalında kalem bazlı giriş + en az bir taşıma kalemi zorunluluğu.
- **App B (1.1.6) · Taşıma koşulları referansı, taşıyıcı ücretlerinin ayrıştırılması, kart maskeleme** — (1) Itinerary'ye tam 'conditions of carriage incorporated by reference' metnini ekle. (2) TaxFeeCharge'a `carrierImposed: boolean` ekleyip (YQ/YR) fare dökümünde ve Itinerary'de 'Taşıyıcı ücretleri' başlığı altında AYRI göster. (3) fopDetail girişinde maskeleme zorla: son 4 hane dışında girilen rakamları otomatik 'X'le ve kaydetmeden önce doğrula.
- **Intro §7–8 · Void/kullanılmamış belgelerin satış raporuna iliştirilmesi** — queryTransactions'ı emdStore + ptaStore'u da tarayacak şekilde genişlet; her satıra `reportingPeriodId` ekle ve SalesReport'a 'Dönem' seçici (gün/ay/yıl sonu kapanış) koy; void satırlarına 'VOID' damgası + audit kuponu referansı ekle.
- **1.1.4.1 · Kupon statü göstergesi kod seti** — T kararını dokümante edilmiş sapma olarak bırak (GAP_ANALYSIS'te gerekçeli); StatusPill'e opsiyonel kontrol-sahibi eki (A/BB) ekle.
- **1.1.5.2 · ET arama ve görüntüleme (search & display) kriterleri** — Passenger'a phone ve frequentFlyer ekleyip iki kriter setini tamamla; gelişmiş panelde kriterleri set (grup) hâlinde sun ve grup içindeki alanlar dolmadan sorguyu çalıştırma.
- **15.1.7 · İade sonrası kupon statüsü ve ön koşulu** — refundTicket'ta R geçişinden sonra assignSac(c) çağır; Coupon'a `refundedAt`, `refundReference` ve RefundInput'a `refundedFare`/`refundedTfc` ayrımı ekle.
- **2.13 · Parasal döküm ve Total tutarlılığı** — FareOffer'a ödeme para birimi seçimi + otomatik equivFarePaid hesabı ekle (fx.convert zaten var); FareCalculation'a `itbt?: 'IT'|'BT'` alanı.
- **2.22.6.4 · Elektronik bilette taşıyıcı kodu zorunluluğu** — Segment doğrulamasına `marketingCarrier !== 'YY'` kuralı ekle (Zod/saf kontrol); open segment desteği gelince aynı kuralı orada da uygula; exchange drawer'ına taşıyıcı alanı ekle.

## 6. Tam

- 2.19 · Endorsements/Restrictions alanı
- 1.1.4.2 / 1.1.4.3 · Interim ve final statü ayrımı, final = terminal
- 1.1.5.2 · ET arama/retrieval kriterleri (denetim ve raporlama erişimi)
- 1.1.5.3 · Tarihsel kaydın saklanması ve erişilebilirliği
- 1.1.5.3 · Void ön koşulu — tüm kuponlar 'O' olmalı
- 1.3.1 · Rezervasyon değişikliği (revalidation)
- 1.3.5 · İade uygunluğu (refund eligibility)
- 15.1.7 · İade edilen kuponların geçersizleştirilmesi (ET: O → R)
- 2.1.5 · Bilet başına tek yolcu
- 5.2.2 · EMD-A (Associated) — ET uçuş kuponuyla kaldırılan tahsilatlar
- 5.2.2 · EMD-A ↔ ET kupon statü senkronizasyonu