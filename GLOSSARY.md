# GLOSSARY.md — Ubiquitous Language

> Troya biletleme domaininin ortak dili. Kod, dokümantasyon ve arayüz bu terimleri kullanır. IATA terimleri İngilizce korunur; açıklama Türkçe. Kaynak: IATA Ticketing Handbook (Ch referansları).

## Biletleme — temel kavramlar

| Terim | Açıklama |
|---|---|
| **ET** (Electronic Ticket) | Kağıt değer dokümanı olmadan satışı belgeleyen ve kullanımı izleyen elektronik bilet. Tüm veri Validating Carrier veritabanında. (Ch 1) |
| **Coupon** (Electronic Coupon) | Carrier veritabanındaki uçuş kuponu. Her segment için bir flight coupon; her birinin bir **status**'u var. |
| **Coupon Status Indicator** | Kuponun durumu (O/A/C/L/I/S/U/N/Y/F/E/G/R/V/P/X/Z/T). Interim (ara) ve Final (terminal) statüler. (Ch 1.1.4) — reservation status ile karıştırma. |
| **Validating Carrier** | Bileti kesen, sayısal airline kodu transaction'da olan taşıyıcı. ET kaydının **tek otoritesi**; control'ü o devreder. |
| **Marketing Carrier** | Flight coupon'da taşıyıcı olarak görünen havayolu (Airline Designator). |
| **Operating Carrier** | Codeshare'de uçuşu fiilen yapan taşıyıcı (Marketing'den farklıysa). |
| **Billing Carrier** | Operating'den farklıysa, Validating Carrier'ı faturalama yetkisi olan taşıyıcı. |
| **Ticket Handler** | Operating Carrier adına, onun ticketing noktası olmayan yerlerde biletleme yapan havayolu. |
| **Airport Control / Control** | Bir kuponun "sahipliği"; check-in/boarding/reissue/refund için gerekir. Aynı anda tek carrier tutar; sadece Validating Carrier devreder; kalkıştan sonra 72 saat içinde iade. (Ch 1.1.5) |
| **PNR** (Passenger Name Record) | Rezervasyon kaydı referansı. |
| **RBD** (Reservation Booking Designator) | Booking class kodu (flight number'ı izler). |
| **Fare Basis** | Ücret kuralını tanımlayan kod. (Ch 2.6) |
| **NVB / NVA** (Not Valid Before/After) | Segment geçerlilik tarihleri. (Ch 2.8) |
| **TFC** (Tax/Fee/Charge) | Vergi/harç/ücret; tax code + tutar + ISO. `XT` (combined) ET'de kullanılmaz (01JAN08+). (Ch 2.12) |
| **Fare Calculation** | Ücret inşa string'i; NUC + ROE ile. (Ch 2.22) |
| **NUC** (Neutral Unit of Construction) | Ücret hesaplamada nötr birim. |
| **ROE** (Rate of Exchange) | NUC↔yerel para çevrim oranı. |
| **Form of Payment** (FOP) | Ödeme şekli (cash/credit/other). (Ch 2.14) |
| **FOID** (Form of Identification) | Yolcu check-in kimlik tipi. (Ch 1.1.7) |
| **EMD** (Electronic Miscellaneous Document) | Bilet-dışı değer dokümanı. **EMD-A** (Associated, bir ET kuponuna bağlı) / **EMD-S** (Standalone). (Ch 5) |
| **RFISC** (Reason For Issuance Sub-Code) | EMD'nin niçin kesildiğini belirten alt kod. |
| **MCO / MPD / PTA** | Legacy değer dokümanları (Miscellaneous Charges Order / Multiple Purpose Document / Prepaid Ticket Advice). Modern karşılık: EMD. (Ch 3-9) |
| **vMPD** | Sanal MPD — BSP'de kağıt dokümanların yerine EMD. (App F) |
| **ADC** (Additional Collection) | Exchange'de ek tahsilat (fare farkı). |
| **Exchange / Reissue** | Eski kupon(lar) `E`, yeni bilet kesilir; "Issued in Exchange For" + "Original Issue" linkage. (Ch 12) |
| **Refund** | Kullanılmamış değerin iadesi; kupon `R`; residual için EMD-S/MCO. (Ch 15) |
| **Void** | Satış kaydının iptali; tüm kuponlar `O` olmalı → `V`. |
| **FIM** (Flight Interruption Manifest) | Involuntary rerouting'de düzenlenir; kupon `G`. (Ch 13) |
| **IRROP** (Irregular Operations) | Olağandışı operasyon; kupon `I`. |
| **Conjunction Ticket** | Tek bilete sığmayan kuponlar için bağlı bilet(ler). (Ch 2.17) |
| **Itinerary/Receipt** | Yolcuya verilen, ET'nin bilgi+uyarılarını içeren doküman. |
| **Conditions of Contract** | Bilet üstündeki sözleşme koşulları + zorunlu uyarılar (App B). |
| **Endorsement / Restriction** | Bilet üstü kısıtlama/ciro notu. (Ch 2.19) |
| **Interline** | Birden çok taşıyıcılı itinerary; sistemler arası mesajlaşma + bilateral agreement gerektirir. |
| **Codeshare** | Marketing ≠ Operating carrier durumu. |
| **BSP** (Billing & Settlement Plan) | IATA acente satış mutabakat sistemi. |
| **GDS** (Global Distribution System) | Amadeus/Sabre/Travelport — dağıtım. |

## Modern dağıtım (gelecek yön)

| Terim | Açıklama |
|---|---|
| **NDC** (New Distribution Capability) | XML tabanlı dağıtım standardı (EDIFACT yerine). Şema: 21.3 / 24.1+. |
| **ONE Order** | Booking/ticketing/delivery/accounting'i tek **Order** kaydında birleştiren standart. |
| **Offer / Order** | Modern retailing modeli: shopping = Offer, satış = Order. |
| **EASD** (Enhanced & Simplified Distribution) | IATA'nın Offers & Orders çatı programı. |
| **ARM** (Airline Retailing Maturity) | Offers & Orders olgunluk index'i. |

## Mühendislik terimleri

| Terim | Açıklama |
|---|---|
| **Aggregate** | Tutarlılık sınırı olan domain nesnesi (`Ticket`, `Emd`, ileride `Order`). |
| **Event Sourcing (ES)** | State'i append-only, immutable event'lerden türetme. Tam audit trail. |
| **CQRS** | Yazma (komut→event) ve okuma (read model) yollarını ayırma. |
| **Read Model** | Event'lerden projekte edilen, sorguya optimize görünüm (search/display). |
| **Outbox Pattern** | DB commit + mesaj yayınını atomik yapan tablo + consumer. |
| **Idempotency** | Aynı komutun tekrarının ek yan etki yaratmaması (çift-issue/refund koruması). |
| **State Machine (FSM)** | Coupon status geçişlerinin explicit, test edilmiş kuralları. Final statüler terminal. |
| **Saga / Process Manager** | Çok-adımlı işlemi (exchange = void+issue+mutabakat) koordine eden süreç. |
| **Bounded Context** | Domain dilinin tutarlı olduğu sınır (burada: biletleme). |
| **Control Authority / Lease** | "Concept of Control"ün modern modeli: tek-sahip + TTL'li kiralama (Redis). |
| **Ports & Adapters (Hexagonal)** | Saf domain + dış sistemler için port/adapter. |
