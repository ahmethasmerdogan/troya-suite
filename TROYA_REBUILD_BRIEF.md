# Troya — Modern Biletleme Platformu · Kapsamlı Proje Brief'i (Yeniden İnşa İçin)

> **Bu dosya ne için?** Aşağıdaki sistem (kod adı **Troya Suite**), Claude Code (Opus) ile faz faz geliştirilmiş; IATA Ticketing Handbook'un çekirdeğini modern bir full-stack mimariye taşıyan bir **PSS elektronik biletleme platformu** prototipidir. Bu brief, sistemin **tümünü** — ne yapıldığı, nelere dikkat edildiği, hangi kaynaklardan beslenildiği, hangi fazda ne üretildiği ve genel yapı — tek dosyada toplar.
>
> **Hedef kullanım:** Bu dosyayı daha kapsamlı bir modele (**Claude Fable 5**) verip şunu istiyoruz: *"Bak, biz bunu yaptık. Sen daha kapsamlı bir modelsin — bunu sıfırdan, modern teknolojilerle, daha eksiksiz yeniden inşa et."* Yani bu bir **spesifikasyon + referans + ders çıkarımı** paketidir, bir kod dökümü değil.
>
> **En sonda ("Bölüm 12") Fable 5'e doğrudan talimat var** — okumaya oradan başlanabilir, gerisi bağlamdır.

---

## 0. TL;DR — 60 saniyelik özet

- **Ne inşa edildi:** Bir Passenger Service System'in (PSS) **elektronik biletleme modülü**: bilet (ET) + EMD kesimi, **kupon yaşam döngüsü (FSM)**, tam audit (event sourcing), search/display (CQRS), exchange/reissue/refund/void, IRROP/FIM, PTA, interline mesajlaşma, ONE Order görünümü. Troya'nın kriptik terminal ekranının yerine **tıklama-tabanlı React arayüzü**.
- **İki track:** **Engine (Kotlin/Spring backend)** + **Experience (React/TS frontend)**. Temel ilke: *"tek komut, iki yüzey"* — terminal komutu da React tıklaması da aynı backend komutuna map olur.
- **Durum:** **Backend** Faz 0–2 gerçek (event store + CQRS read model, Docker'da doğrulandı); Faz 3–7 tasarlandı ama kodlanmadı. **Frontend** tüm fazlar (FE0–FE7) + kapsam-dışı ek modüller **tıklanabilir prototip** olarak var (çoğu **mock veriyle**). Canlı demo Vercel'de.
- **Kapsam genişlemesi:** Handbook sadece *biletlemeyi* kapsar. Kullanıcı isteğiyle sisteme **rezervasyon (QuickRes), check-in/DCS (QuickCheck-in), havalimanı operasyon paneli (HUB Kontrol / A-CDM), servis haritası ve personel mesajlaşması** da eklendi — bunlar handbook dışı, PSS çevre modülleri.
- **Kaynak omurga:** **IATA Ticketing Handbook (39. baskı, 348 sayfa)** + sektör araştırması (aşağıda).

---

## 1. Sistem ne? (Domain özeti)

Bir **PSS ≈ 10 ayrı sistemdir** (Inventory & Availability, Shopping/Offer, Pricing/Fare, PNR/Reservation, **Ticketing** ← bu, DCS, Loyalty, Revenue Accounting…). Bu proje **Ticketing** bounded-context'ini gerçekten inşa eder; diğerleri **port arkasında mock**tur.

**Kapsam İÇİ (çekirdek):** Electronic Ticket (ET) & EMD kesimi, **Coupon Status yaşam döngüsü**, ET kaydının tam audit'i, search & display, exchange/reissue/refund/void, IRROP/FIM, "Concept of Control" (Airport Control), interline mesajlaşma, order-native gelecek.

**Kapsam DIŞI (mock port):** inventory, availability, shopping, **pricing/fare engine** (fiyatı tüketiriz, hesaplamayız), PNR, DCS, loyalty, revenue accounting/settlement.

**Neden değerli:** Biletleme, iyi sınırlanmış ve derin bir domain. Handbook 2007 tarihli olsa da ET/EMD çekirdeği bugün de operasyonel gerçek; IATA'nın yönü ise **Offers & Orders (NDC / ONE Order)** — mimariye baştan gömüldü.

---

## 2. Kaynaklar (bilgi nereden toplandı)

### 2.1 Birincil / otoriter kaynak
- **IATA Ticketing Handbook, 39. baskı** (`IATA - Ticketing Handbook.pdf`, 348 sayfa). Koddaki her iş kuralının kaynağı. Kritik bölümler:
  - **Ch 1 — Electronic Ticketing:** ET, kupon, **Concept of Control / Airport Control**, **Coupon Status Indicators (§1.1.4)**, search & display kriterleri (§1.1.5.2), FOID, interline temelleri, revalidation (1.3.1), print-to-paper (1.3.3).
  - **Ch 2 — Passenger Ticket Entries:** 33 veri elemanı, fare basis (2.6), tour code (2.7), NVB/NVA (2.8), baggage (2.9), fare/equiv-fare (2.10–2.11), TFC (2.12), form of payment (2.14), conjunction (2.17), endorsement (2.19), **fare calculation (2.22)**, mixed class (2.24).
  - **Ch 3–4 — MCO (manual & automated):** legacy → EMD map.
  - **Ch 5 — EMD:** EMD-A/EMD-S, kupon statüleri, **RFISC**, control, min data.
  - **Ch 9 — PTA (Prepaid Ticket Advice).**
  - **Ch 10 — UATP** (kurumsal seyahat kartı, FOP).
  - **Ch 11 — Currency:** ROE, equivalent fare, banker's rate.
  - **Ch 12 — Changes to Tickets:** exchange/reissue, "Issued in Exchange For", "Original Issue", ADC, revalidation.
  - **Ch 13 — Involuntary Rerouting:** FIM, IRROP, vefat/hastalık waiver'lı refund.
  - **Ch 14 — Related Info:** TFC (14.1), fazla bagaj → EMD-S (14.5), **Revenue Protection (14.7)**.
  - **Ch 15 — Refunds:** refund kuralları, residual value.
  - **App B — Mandatory Notices** (Montreal/Warsaw); **App F — vMPD**.

### 2.2 İkincil / bağlam (sektör araştırması — arka plan, uygulanmadı ama hizalandı)
- **PSS/GDS ekosistemi:** Amadeus Altéa, Sabre, Travelport; terminalden GUI'ye modernizasyon (Altéa Desktop, Sabre Red 360).
- **NDC & ONE Order (IATA Modern Airline Retailing):** NDC 21.3 / 24.1+ şema kuşağı; ONE Order = system-of-record vizyonu; ana akım geçiş 2028–2029.
- **Settlement/uzlaşı:** BSP / ARC, ADM/ACM, interline SPA & proration — **bilinçli kapsam dışı**.
- **Fiyatlama standartları:** ATPCO Cat16 (penalty), Cat31/33 (reissue/refund) — bilinçli kapsam dışı (pricing bizim işimiz değil).
- **Uyum/regülasyon:** PCI-DSS 4.0 (kart tokenization), KVKK/GDPR (PII), APIS, EU261/DOT.
- **HUB Kontrol paneli için:** **A-CDM** (Airport Collaborative Decision Making) milestone'ları, **IATA AHM / PSCRM** operasyon kavramları, kupon FSM ile hizalı yolcu funnel.
- **SSR (özel yolcu) için:** **IATA Resolution 1700 / AHM·PSCRM** — standart Special Service Request kodları (WCHR/WCHS/WCHC/BLND/DEAF/DPNA/MAAS/STCR/OXYG…).
- **Service Map sayfası:** kullanıcının claude.ai tasarım projesinden (`DesignSync` MCP) içe aktarıldı, sisteme uyarlandı.

### 2.3 Proje-içi doğruluk kaynakları (repo'da)
`CLAUDE.md` (çalışma kuralları + tarihli ilerleme notları), `TROYA_ETICKET_ROADMAP.md` (faz planı), `ARCHITECTURE.md` (mimari gerekçeler), `GLOSSARY.md` (ubiquitous language), `DESIGN_SYSTEM.md` + `DESIGN_ROADMAP.md` (görsel/etkileşim), `contracts/openapi.yaml` (API sözleşmesi), `SYSTEM_GUIDE.md` + in-app `/docs` + `/guide`.

---

## 3. Domain modeli (çekirdek)

### 3.1 Ubiquitous language (GLOSSARY özet)
Ticket (ET) · Coupon · **CouponStatus** · Validating / Marketing / Operating / Billing Carrier · **Airport Control / ControlAuthority** · EMD (EMD-A / EMD-S) · RFISC · Fare Calculation (NUC, ROE, fare string) · TFC (tax/fee/charge) · Form of Payment · FOID · Endorsement · Conjunction · Exchange/Reissue · Refund · Void · IRROP / FIM · PTA · Order (ONE Order).

### 3.2 Coupon Status Indicators — sistemin kalbi (FSM)

Handbook §1.1.4'ten **resmî 17 kod** (alfabetik): `A C E F G I L N O P R S U V X Y Z`.

**Interim (kupon hayatta):** `O` Open For Use · `A` Airport Control · `C` Checked-In · `L` Lifted/Boarded · `I` Irregular Ops · `S` Suspended · `U` Unavailable · `N` Notification · `Y` Refund TFC.

**Final (terminal, bir daha işlem görmez):** `F` Flown · `E` Exchanged/Reissued · `G` Exchanged/FIM · `P` Printed · `R` Refunded · `V` Void · `X` Print Exchange · `Z` Closed.

> ⚠️ **Doğruluk notu (yeniden inşada düzelt):** Mevcut sistem **18 kod** sayıp `T` (Paper Ticket)'i terminal statü olarak ekledi. Handbook'un üç resmî listesinde (1.1.4.1/.2/.3) `T` **yoktur** — yalnızca `O`'nun açıklamasında geçerken anılır. Kâğıda dönüşümü zaten `P` ve `X` karşılıyor. Fable 5: resmî 17 kodu esas al, `T`'yi ekleme (veya "yalnızca referans" olarak işaretle).

**FSM invariant'ları (değişmez):**
1. Final statüye geçen kupon **değişmez** (terminal). İzinsiz geçiş **exception** fırlatır, asla sessiz değil.
2. İşlem için kupon `O` olmalı; **void için TÜM kuponlar `O`** olmalı.
3. Kuponlar **sırayla** honor edilir (out-of-sequence engellenir).

Temel geçişler: `O→A→C→L→F` (uçuş akışı), `O→V` (void), `O→E` (exchange), `O→R` (refund), `O→S/U/N`, `I→G` (FIM), `A/O→P` (print-to-paper), `S→R/V`, `Y→R`.

### 3.3 Concept of Control → `ControlAuthority`
Handbook'un en değerli dağıtık-sistem fikri: bir kuponun control'ünü aynı anda **tek carrier** tutar; **yalnızca Validating Carrier** grant/revoke eder; kontrolü alan kalkıştan sonra **72 saat** içinde iade etmekle yükümlü. Modern karşılığı: **single-writer ownership + TTL'li lease (Redis).** UI'da "şu an kimde kontrol var" göstergesi.

### 3.4 Çekirdek domain event'leri (event sourcing)
```
TicketIssued · CouponAdded · ControlGranted · ControlReturned
CouponCheckedIn(C) · CouponLifted(L) · CouponFlown(F)
TicketVoided(V) · CouponExchanged(E) · TicketReissued · CouponRefunded(R)
CouponSuspended(S) · IrregularOpsApplied(I/G) · EndorsementApplied
EmdIssued · PtaIssued · NoShowRecorded · CouponRevalidated · CouponPrinted(P)
```
Frontend bu event'leri iki yerde kullanır: **lifecycle timeline** ve **canlı güncelleme** (SSE/WebSocket).

---

## 4. Mimari ilkeler (ihlal edilmeyen 13 kural)

**Backend (Engine):**
1. **Event Sourcing** — "ET file = tüm aksiyonların tarihsel kaydı" handbook'un kendi tanımı; audit domainin tanımı. State event'lerden türetilir (replay + optimistic concurrency).
2. **CQRS** — yazma (komut→aggregate→event) ve okuma (read model projeksiyonu) ayrı. Komut tarafı sorgu için read model kullanmaz; aggregate rehydrate edilir.
3. **Coupon Status = explicit FSM** — geçişler kod + exhaustive test ile sabit; final terminal.
4. **Hexagonal (Ports & Adapters)** — `domain` saf (framework/DB/Kafka bilmez); dış sistemler port + adapter. Bağımlılık daima dışarıdan içeri.
5. **Idempotency** — para/statü değiştiren her komut idempotency key taşır; tekrar = aynı sonuç, yan etki yok. **Çift-issue / çift-refund kesinlikle olmaz.**
6. **Outbox pattern** — DB transaction + mesaj yayını atomik; doğrudan publish yok.
7. **Control invariant** — TTL'li lease; yalnızca Validating Carrier grant/revoke.

**Frontend (Experience):**
8. **Sunum adaptörü** — frontend'de iş kuralı yok; backend otorite. Client validation (Zod) sadece hızlı geri bildirim.
9. **Para işleminde optimistic UI YOK** — issue/exchange/refund/void sunucu sonucunu bekler; frontend idempotency key üretir (çift-submit koruması).
10. **Görsel-öncelikli state** — kupon statüsü renk-kodlu pill; yaşam döngüsü event timeline.
11. **Hibrit etkileşim** — tıklama akışları + command palette (⌘K) uzman hızı için.
12. **Uçtan uca type-safety** — OpenAPI tek doğruluk kaynağı → `openapi-typescript` ile TS tipleri üretilir (elle yazma).
13. **Gerçek zamanlı** — statü/control değişiklikleri SSE/WebSocket ile UI'a yansır.

Ek: **Order-native gelecek** — sınırlar `Order` aggregate'ini system-of-record yapacak şekilde çizildi (ONE Order'a geçiş refactor değil, planlı adım).

---

## 5. Teknoloji yığını

**Backend (Engine):** Kotlin + **Spring Boot 3** (Java 21) · **PostgreSQL 16** (event store + read model, `jsonb`) · **Kafka/Redpanda** (event streaming + outbox) · **Redis** (cache + control lease) · **OpenAPI** + **SSE/WebSocket** · **Keycloak** (OIDC) · Flyway (migration) · JUnit 5 + Testcontainers + Kotest · OpenTelemetry · ktlint + detekt · Gradle (Kotlin DSL, çok-modüllü).

**Frontend (Experience):** **Vite + React 18 + TypeScript** · **TanStack Router + Query + Table** · **Zustand** · **React Hook Form + Zod** · **shadcn/ui + Tailwind CSS v4** (`@tailwindcss/vite`) · **cmdk** · lucide-react · three.js (`@react-three/fiber`, lazy 3D kabin) · react-oidc-context · i18n (TR/EN, flat dotted key sözlüğü) · Vitest + RTL + **Playwright**.

**Ortak/altyapı:** Docker Compose (Postgres + Redpanda + Redis + Keycloak). Bu geliştirme makinesinde **Java yok, Docker var** → backend tamamen container'da derlenip çalıştırıldı (`gradle:8.11.1-jdk21`). Frontend demo **Vercel**'de canlı (statik SPA; backend Vercel'de çalışmaz).

---

## 6. Genel yapı (monorepo)

```
troya-eticket/
├── backend/          # Kotlin çok-modüllü (Gradle Kotlin DSL)
│   ├── domain/       # SAF: aggregate, event, VO, FSM, invariant
│   │   ├── common/   AggregateRoot · DomainEvent · Money · Codes(CarrierCode/AirportCode…)
│   │   ├── coupon/   CouponStatus (FSM) · CouponStatusTransitionException
│   │   └── ticket/   Ticket(aggregate) · TicketEvents · TicketNumber(mod-7)
│   │   └── test/     CouponStatusTest · TicketNumberTest · TicketTest
│   ├── application/  # port'lar + use-case handler'lar
│   │   ├── port/     EventStore · Repository · TicketNumberGenerator · TicketQueries
│   │   └── ticket/   IssueTicket(handler) · TicketViews(DTO)
│   ├── infrastructure/ # adapter'lar
│   │   ├── eventstore/  JdbcEventStore · EventSerde
│   │   ├── readmodel/   TicketProjection · JdbcTicketQueries
│   │   ├── ticket/      EventSourcedTicketRepository · JdbcTicketNumberGenerator
│   │   ├── idempotency/ JdbcIdempotencyStore
│   │   └── db/migration/ V1__event_store.sql · V2__ticket_serial.sql · V3__ticket_read.sql
│   └── api/          # REST + Spring Boot app
│       └── HealthController · TicketController · TroyaApplication · application.yml
├── frontend/         # Vite + React + TS
│   └── src/
│       ├── domain/       # tipler + mock API + iş verisi (backend gelince OpenAPI'den üretilecek)
│       │   types.ts · api.ts · couponStatus.ts · couponStatusMachine.ts · ticketNumber.ts
│       │   mockData.ts · genTickets.ts · reservation.ts · checkin.ts · ops.ts
│       │   auth.ts · users.ts · airports.ts · fareTypes.ts · ssr.ts · fx.ts · fieldHelp.ts
│       ├── pages/        # Panel · IssueWizard · TicketSearch · TicketDetail · Itinerary
│       │   Orders/OrderDetail · Messages · Chat · Agreements · Admin · Docs · Guide · Login
│       │   quickres/ (PnrSearch · CreatePnr · Availability · PnrDetail)
│       │   checkin/ (CheckinFlights · CheckinFlight · SeatSelection · HubControl)
│       │   troya/ (Pta) · ServiceMap
│       ├── components/   # ui/ (shadcn-stili primitives) · domain/ · flows/ (drawer'lar) · layout/ · checkin/
│       ├── store/        # Zustand (ui.ts: tema, dil, auth, recent…)
│       ├── modules.ts    # 4 modül + nav ağacı (QuickRes · Troya · QuickCheck-in · Panel)
│       ├── i18n/         # TR/EN sözlük
│       └── router.tsx
│   └── e2e/          # Playwright specs
├── contracts/        # openapi.yaml (21 endpoint, ~45 şema) — tek doğruluk kaynağı
├── docs/             # (kökte de var) ARCHITECTURE/GLOSSARY/DESIGN_*
├── docker-compose.yml
├── CLAUDE.md · TROYA_ETICKET_ROADMAP.md · SYSTEM_GUIDE.md
└── TROYA_REBUILD_BRIEF.md   ← bu dosya
```

### 6.1 Modül haritası (frontend, birleşik panel)
Üstte modül seçici + Panel anasayfa. 4 modül:
- **QuickRes** (rezervasyon): PNR ara/detay/oluştur wizard + availability; PNR→bilet linkage. *(Handbook dışı — PSS çevresi)*
- **Troya** (biletleme çekirdeği): issue wizard, ticket detail (§9.1 renk pill'leri, control indicator, lifecycle timeline, fare two-tone), itinerary TR/EN, exchange/refund/void, EMD, IRROP/FIM, PTA, endorsement, revalidation, print-to-paper, interline mesaj, order, revenue protection.
- **QuickCheck-in** (DCS): uçuş listesi, koltuk haritası (2D + lazy 3D), check-in→kupon O→C cross-modül linkage, biniş kartı, **HUB Kontrol** (A-CDM operasyon paneli), **Service Map**. *(Handbook dışı — PSS çevresi)*
- **Yönetim** (Admin): roller & yetki matrisi, kullanıcılar, loglar, ayarlar, gelir koruma.
Ayrıca: **Chat** (personel mesajlaşma, tam sayfa), **Docs** (`/docs` sistem dokümantasyonu), i18n TR/EN, ⌘K palette, e/r/v kısayolları.

### 6.2 API yüzeyi (`contracts/openapi.yaml`, 21 endpoint)
`GET/POST /tickets` · `GET /tickets/search` · `GET /tickets/{n}` · `.../exchange` · `.../refund` · `.../void` · `.../endorse` · `.../irrop` · `.../emds` (GET/POST) · `.../coupons/{seq}/status` · `GET /emds` · `GET /dashboard/stats` · `GET /messages` · `GET /agreements` · `GET/POST /orders` · `GET /ptas` · `POST /ptas` · `.../issue` · `GET /revenue/alerts`.

---

## 7. Ne yapıldı — faz faz

### Engine (backend) — GERÇEK kod
- **F0 — Temel & domain iskeleti ✅** (Docker'da doğrulandı 2026-06-19): çok-modüllü Gradle, event store DDL (append-only `events` + `outbox` + `idempotency_keys`), `CouponStatus` FSM, VO'lar (`TicketNumber` mod-7, `Money`, kodlar), `AggregateRoot`/`DomainEvent`/`EventStore` port'ları, health check, ktlint+detekt+CI. Uygulama Postgres+Redis ile ~2.2 sn'de kalktı; Flyway tabloları kurdu; `/health` + `/meta/coupon-statuses` (18 statü) 200 döndü.
- **F1 — Bilet kesimi & kupon yaşam döngüsü ✅⭐** (Docker'da uçtan uca doğrulandı): event-sourced `Ticket` aggregate + `TicketIssued`; `IssueTicketHandler` (idempotency); JDBC adapter'lar (jsonb append/read, rehydrate, ticket no sequence + mod-7); `POST/GET /tickets`. POST→bilet, aynı key→aynı bilet, GET→event'lerden rehydrate doğrulandı.
- **F2 — Search + receipt (CQRS okuma) ✅** (Docker'da doğrulandı 2026-06-22): `ticket_read` read model (V3 migration), `TicketProjection` (senkron projeksiyon), `TicketQueries` port + `JdbcTicketQueries`, `GET /tickets?q=` (search) + `GET /tickets/{n}` artık read model'den + `GET /tickets/{n}/receipt`.
- **F3–F7 — TASARLANDI, KODLANMADI:** void/exchange/refund komutları, fare/TFC, EMD aggregate, interline mesajlaşma (outbox + EDIFACT/NDC), Order-native. Plan `ROADMAP §5`'te ayrıntılı.

### Experience (frontend) — tıklanabilir prototip (çoğu mock)
- **FE0** app shell/auth-gate/⌘K · **FE1** issue+detail · **FE2** search+timeline+itinerary · **FE3** exchange/refund/void · **FE4** fare/TFC · **FE5** EMD · **FE6** interline · **FE7** order — **hepsi ✅ (mock veri)**.
- **Handbook eksikleri sonradan eklendi:** IRROP/FIM, PTA, endorsement, fazla bagaj→EMD-S, UATP FOP, revenue protection, vefat/hastalık waiver'lı refund, no-show akışı, **revalidation (1.3.1)**, **print-to-paper (O/A→P)**, tour code, equiv-fare-paid, conjunction, mixed class, infant "in connection with", **SSR özel yolcu**.
- **Kapsam-dışı ek modüller (kullanıcı isteğiyle):** QuickRes (rezervasyon), QuickCheck-in (DCS + koltuk/biniş kartı + 3D kabin), **HUB Kontrol** (A-CDM), **Service Map**, personel **Chat**, **yetki/rol sistemi** (5 rol, client-side matris), sistem **Docs** sayfası.
- **Prod-hazırlık + canlı yayın:** güvenlik header'ları (CSP/HSTS/X-Frame vb. `vercel.json`), performans (manualChunks vendor split, three.js lazy), i18n TR/EN, hata/404 fallback, SEO/meta, **Vercel'de canlı**.

---

## 8. Nelere dikkat edildi (kararlar + öğrenilen dersler)

**Doğrulanan doğrular (koruyun):** idempotency (issue/EMD), event-sourcing apply-only, optimistic concurrency, **FSM frontend↔backend ayna**, void/refund/exchange invariant'ları, final terminal, ticket-no **mod-7 check digit** FE↔BE tutarlı, para işleminde optimistic-UI-yok.

**Düzeltilen gerçek buglar (aynı tuzağa düşme):**
- **Exchange datetime crash:** boş/yarım `datetime-local` değeri `new Date(v).toISOString()`'i "Invalid time value" ile patlatıyordu → geçersiz değeri yoksay.
- **"Drawer asla kapanmıyor":** `usePerm()` her render yeni `can` referansı döndürüyordu → `?flow=` effect'i sonsuz yeniden açıyordu → `useCallback` ile stabilize + flow param'ı tek sefer tüket (`replace:true`).
- **EMD "kayboluyor":** standalone EMD-S kesilince `associatedTicket` boştu → her EMD kesildiği bilete iliştirilir.
- **Exchange fare tutarsızlığı:** yeni bilet base/tfc eski, total yeniydi → ADC base fare'a yansıtıldı (`base+tfc==total`).
- **Refund önerisi:** tüm kuponlara bölünüyordu → yalnızca açık (`O`) kuponlara.
- **Ondalık + döviz (yeni):** `type=number` Türkçe virgülü reddediyordu → `DecimalInput` (virgül/nokta kabul) + `fx.ts` (≈TRY/≈USD otomatik çeviri).
- **Check-in araması "çalışmıyor":** veri seyrek/bağlantısızdı → her uçuş 10–17 yolcuyla deterministik dolduruldu; PNR/TC/pasaport/ad/uçuş/bilet ile arama garanti sonuç döner.
- **Mesajlaşma:** basit sağ slide-over → tam sayfa `/chat` (iki panel, kanallar, presence).

**Genel dikkat:** dikey dilim dilim (katman katman değil); test-first (özellikle FSM/idempotency/exchange-refund-void); küçük cerrahi değişiklik; domain dilini koru; deterministik mock (Math.random yok, seeded PRNG); her faz sonunda `docker compose up` + tüm testler yeşil. **Test durumu (frontend):** tsc temiz + **73 vitest** + **17 Playwright e2e** + build yeşil.

**Dürüstlük notu — handbook DIŞI özellikler:** QuickRes, QuickCheck-in/DCS, HUB Kontrol/A-CDM, Service Map, Chat, NDC/ONE Order mesaj tipleri, 5-rollü RBAC ve `T` statüsü — handbook'ta yoktur; bilinçli kapsam genişlemesi/gösterim amaçlıdır. Yeniden inşada bunları "PSS çevresi (handbook dışı)" diye net etiketleyin.

---

## 9. Bilinen sınırlar / açık riskler

- **Backend F3+ yok:** void/exchange/refund/fare/EMD/interline/order backend'de kodlanmadı — frontend bunları **mock** `domain/api.ts` ile yapıyor. Mock imzalar gerçek REST ile aynı tutuldu.
- **Yetkilendirme tamamen client-side:** rol `localStorage`'da; `can()` sadece UI gating. **Sunucu-side authz şart** (DevTools'tan rol değiştirilebilir).
- **PCI-DSS + KVKK/GDPR backend'de uygulanmalı:** kart tokenization, PII at-rest şifreleme, display kısıtları (5.7).
- **Pricing/fare engine yok (kasıtlı):** fiyat tüketilir, hesaplanmaz.
- **`T` statüsü / "18 kod" nüansı:** resmî 17 koda çek (Bölüm 3.2).
- **Para = float:** gerçek backend'de decimal olmalı.
- **check-digit nüansı:** IATA "serial mod 7" vs "12-hane mod 7" handbook ile birebir doğrulanmalı.
- **Frontend tipleri elle yazıldı:** backend olgunlaşınca `openapi-typescript` ile üretilmeli.

---

## 10. Kritik iş kuralları hızlı-referans (yeniden inşada aynen koru)

1. **Coupon FSM** — 17 resmî kod, interim/final ayrımı, izinsiz geçiş = exception; final terminal.
2. **Void** — TÜM kuponlar `O` değilse reddedilir.
3. **Exchange** — eski açık kuponlar `O→E`; yeni bilet; `IssuedInExchangeFor`+`OriginalIssue` linkage; ADC/residual; iç fare tutarlılığı (`base+tfc==total`).
4. **Refund** — seçili `O` kuponlar `O→R`; residual EMD-S/MCO; waiver (vefat/hastalık) cezayı muaf tutar.
5. **Idempotency** — her para/statü komutu key taşır; tekrar = aynı sonuç.
6. **Control** — tek sahip, yalnızca Validating Carrier devreder, 72 saat TTL lease.
7. **Ticket number** — 13 hane (3 airline + 9 serial + 1 **mod-7** check digit).
8. **Sequential honor** — kuponlar sırayla işlenir.
9. **Search kriterleri (1.1.5.2)** — ticket no; Date+O/D+Name; Marketing carrier+flight+date+O/D+Name; FF ref; credit card+date+name; conf no; phone+name+date; FOID.
10. **Mandatory data (Ch 2)** — surname ≥2 karakter, from/to, marketing carrier, flight+RBD, departure, reservation status.

---

## 11. Nasıl çalışıldı (metodoloji — Fable 5 için de geçerli)
- **"Tek komut, iki yüzey":** UI ve terminal aynı backend komutuna map olur; API-first.
- **Dikey dilim:** önce Engine fazının API'sini stabil et, sonra FE dilimini yap.
- **Test-first:** state machine (tüm geçerli + geçersiz geçişler), idempotency, exchange/refund/void; FE için Playwright e2e.
- **Küçük, cerrahi değişiklik; domain dilini koru; deterministik mock.**
- Her faz sonunda `docker compose up` + tüm testler yeşil olmadan ilerleme yok.
- Belirsizlikte handbook bölümüne (Ch x.y) referans ver.

---

## 12. ⭐ FABLE 5'E DOĞRUDAN BRIEF (yeniden inşa talimatı)

**Görev:** Yukarıda tarif edilen **Troya biletleme platformunu sıfırdan, daha kapsamlı ve modern teknolojilerle yeniden inşa et.** Bu bir kopyalama değil — bu prototipin *domain doğruluğunu ve mimari ilkelerini* koru, *eksiklerini kapat*, *daha eksiksiz* yap.

**Mutlaka koru (bunlar domain gerçeği):**
- IATA Ticketing Handbook çekirdeği: **Coupon Status FSM (17 resmî kod)**, invariant'lar (void=hepsi O, sıralı honor, final terminal), **Concept of Control (72 saat lease)**, ticket-no mod-7, search kriterleri, mandatory data.
- Mimari ilkeler: **Event Sourcing + CQRS + Hexagonal + Idempotency + Outbox + explicit FSM**; "tek komut, iki yüzey"; frontend = sunum adaptörü; para işleminde optimistic UI yok.
- Uçtan uca type-safety (OpenAPI → üretilen tipler).

**Düzelt / iyileştir (bu prototipin eksikleri):**
- **Backend'i Faz 3–7'ye kadar GERÇEKTEN kodla:** void/exchange/refund/IRROP (Ch 12–15), fare/TFC (Ch 2/11), EMD aggregate (Ch 5), interline mesajlaşma (outbox + EDIFACT + NDC/ONE Order), Order-native system-of-record. Frontend bunları şu an sadece **mock** ediyor.
- **Sunucu-side yetkilendirme** (OIDC/Keycloak + gerçek RBAC), **PCI tokenization**, **KVKK/GDPR PII şifreleme**.
- **Para = decimal** (float değil); çok para birimli, gerçek ROE/kur portu.
- **`T` statüsünü kaldır**, 17 resmî koda çek; check-digit nüansını handbook'la doğrula.
- **Frontend tiplerini OpenAPI'den üret** (elle yazma).
- **Gerçek zamanlı** SSE/WebSocket'i uçtan uca bağla (şu an iskelet).

**Daha kapsamlı yap (fırsatlar):**
- Handbook'un kalan detayları (fare calculation string parse/serialize, currency procedures, mandatory notices App B, vMPD App F).
- NDC 21.3/24.1 + ONE Order'ı gerçek şemalarla; Offer→Order akışı.
- Kapsam-dışı çevre modülleri (QuickRes/QuickCheck-in/HUB) **açıkça "handbook dışı PSS çevresi" etiketiyle** ayır — ya da gerçek PSS entegrasyon portlarına dönüştür.
- Gözlemlenebilirlik (OpenTelemetry uçtan uca), performans, a11y (WCAG), kapsamlı test (Testcontainers + contract + e2e).

**Teknoloji:** Bu prototip Kotlin/Spring + React/Vite kullandı; sen en güncel ve güçlü teknolojileri seç (JVM tarafında Kotlin/Spring makul; alternatif TS/NestJS). Kararı gerekçelendir.

**Teslim beklentisi:** Faz faz, her faz **çalışan yazılım** (docker compose + testler yeşil). Domain katmanı saf ve exhaustively test edilmiş olsun. Önce yapı + sözleşme (OpenAPI), sonra kod.

**Referanslar (bu repoda):** `IATA - Ticketing Handbook.pdf` (birincil), `TROYA_ETICKET_ROADMAP.md` (faz planı), `ARCHITECTURE.md` (mimari gerekçe), `GLOSSARY.md`, `contracts/openapi.yaml`, `CLAUDE.md` (kurallar + tam ilerleme geçmişi).

---

*Bu brief, IATA Ticketing Handbook (39. baskı) çekirdeğinden türetilen ve 2026 itibarıyla NDC / ONE Order yönüyle hizalanan Troya prototipinin tam bir anlık görüntüsüdür. Handbook bölüm referansları (Ch x.y) koddaki kuralın kaynağıdır.*
