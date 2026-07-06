# Troya — Modern Biletleme Platformu · Yol Haritası (Full-Stack)

> **Kaynak doküman:** IATA Ticketing Handbook (348 sayfa, 2007) — biletleme iş kuralları ve veri standartları.
> **Amaç:** Handbook'un zamansız çekirdeğini (kupon yaşam döngüsü, "control" konsepti, ET veri modeli, exchange/refund, interline mesajlaşma) modern bir mimariye taşıyan; Troya'nın kriptik terminal ekranının yerine **tıklama ile çalışan bir React arayüzü** koyan; ileride IATA'nın yeni yönü **Offers & Orders (NDC / ONE Order)**'a evrilebilen bir biletleme platformu.
> **İki track:** **Engine (backend)** — biletleme motoru ve iş kuralları. **Experience (frontend)** — React tabanlı, tıklama-tabanlı operasyon arayüzü.
> **Çalışma şekli:** Bu dosya + `CLAUDE.md` repo köküne konup Claude Code ile faz faz işlenir. Arayüzün **detaylı tasarımı** (ekran görünümleri, etkileşim, görsel dil, senin fikirlerin) ayrı **`docs/DESIGN_ROADMAP.md`**'de — onu birlikte dolduruyoruz.

---

## 0. Önce dürüst bir çerçeve

- **Bir PSS = ~10 ayrı sistem.** Elektronik biletleme bunlardan biri. Kapsam **dışı** (ama port arkasında arayüzleri var): Inventory & Availability, Shopping/Offer engine, Pricing/Fare engine (ATPCO), PNR/Reservation, DCS (check-in/boarding/W&B), Loyalty/FFP, Revenue Accounting.
- **Biletleme modülü iyi sınırlanmış bir domain.** Tek başına ciddi bir mühendislik projesi + güçlü bir portföy/prototip olarak gerçekten bitirilebilir. Hedef bu.
- **THY'ye satmak ayrı mesele** (CEO/CTO kararı, 3-5 yıl, 50+ referans). Bu kod o kapıyı açmaz ama domaini gerçekten anladığını kanıtlayan sağlam bir temel olur.
- **Handbook 2007 tarihli**, ticket/coupon paradigmasını anlatıyor. Çekirdek hâlâ operasyonel gerçek (ET/EMD bugün de baskın). Ama IATA'nın yönü **"Order" paradigmasına** geçmek — mimariye baştan gömüyoruz (Engine Faz 7).
- **Arayüz = modernizasyonun yüzü.** Terminalden GUI'ye geçmek transaction'ları yok etmek değil, **keşfedilebilir ve hatasız** kılmak. Amadeus Altéa Desktop ve Sabre Red 360 tam bunu yaptı: aynı transaction motorunun üstüne tıklanabilir arayüz. Bizim API-first backend zaten bunun için doğru şekilde tasarlandı.

**Modern bağlam (2026, doğrulandı):** NDC (XML, EDIFACT'ın yerine — şema kuşağı NDC 21.3 / 24.1+) ve ONE Order, IATA'nın "Modern Airline Retailing / Offers & Orders" hedefinin iki ayağı. Aspirasyonel hedef 2030'da %100; ana akım geçiş 2028-2029.

---

## 1. Handbook çekirdeği (referans)

PDF'i ayrıştırdım. Modüle giren zamansız kısımlar:

| Handbook bölümü | İçerik | Karşılığı |
|---|---|---|
| **Ch 1 — Electronic Ticketing** | ET, kupon, **control/Airport Control**, **coupon status indicators**, search & display, FOID, interline | Çekirdek domain |
| **Ch 2 — Passenger Ticket Entries** | 33 veri elemanı, fare basis, NVB/NVA, **fare calculation (2.22)**, TFC (2.12), form of payment (2.14) | Veri modeli + validation |
| **Ch 3-9 — MCO/MPD/PTA** | Diğer değer dokümanları | Modern EMD'ye map |
| **Ch 5 — EMD** | Electronic Miscellaneous Document, kupon statüleri, RFISC | EMD aggregate |
| **Ch 11 — Currency** | ROE, equivalent fare | Para value object |
| **Ch 12 — Changes to Tickets** | **Exchange/Reissue**, "Issued in Exchange For", "Original Issue", ADC | Exchange transaction |
| **Ch 13 — Involuntary Rerouting** | FIM, irregular ops | `G`/`I` statü, IRROP |
| **Ch 15 — Refunds** | Refund kuralları, residual value | Refund transaction |
| **App B — Mandatory Notices** | Zorunlu uyarılar | Itinerary/Receipt üretimi |
| **App F — vMPD** | Sanal EMD ile kağıt doküman değişimi | EMD modernizasyonu |

### 1.1 Coupon Status Indicators — yaşam döngüsünün kalbi

Handbook 1.1.4'ten **resmi kod listesi** (kesin olarak çıkarıldı). Bu aslında bir **finite state machine** spesifikasyonu.

**Interim (ara) statüler** — kupon hayatta:
| Kod | Anlam |
|---|---|
| `O` | Open For Use — tüm transaction'lar için uygun başlangıç |
| `A` | Airport Control — kalkıştan önce M/O carrier ele aldı |
| `C` | Checked-In |
| `L` | Lifted/Boarded |
| `I` | Irregular Operations (IRROP) |
| `S` | Suspended — Validating Carrier kısıtladı |
| `U` | Unavailable |
| `N` | Notification |
| `Y` | Refund TFC |

**Final (kesin) statüler** — terminal, bir daha işlem görmez:
| Kod | Anlam |
|---|---|
| `F` | Flown/Used | `E` | Exchanged/Reissued | `G` | Exchanged/FIM |
| `R` | Refunded | `V` | Void | `P` | Printed |
| `X` | Print Exchange | `Z` | Closed |

> **Doğruluk notu (2026-07-04):** `T (Paper Ticket)` resmî 1.1.4 listelerinde yoktur; sistemden kaldırıldı — kâğıda dönüşümü `P`/`X` karşılar. Resmî toplam **17 kod**.

> **İnvariant'lar (state machine):** (1) final statüye geçen kupon değişemez; (2) işlem için statü `O` olmalı (void için *tüm* kuponlar `O`); (3) kuponlar **sırayla** honor edilir. Bunu explicit, exhaustively test edilmiş state machine olarak kurmak projenin yarısı. → **Arayüzde** bu statüler renk kodlu badge'lere, yaşam döngüsü bir timeline'a dönüşür (event sourcing besler).

### 1.2 "Concept of Control" — dağıtık tek-yazar invariant'ı

- ET kaydının **tek otoritesi**: **Validating Carrier**.
- Bir kuponun control'ünü aynı anda **tek havayolu** tutar; sadece Validating Carrier devreder (Airport Control); önce geri alınmadan başkasına verilemez.
- Kontrolü alan, statü güncellemelerini kalkıştan sonra **72 saat** içinde iade etmekle yükümlü.
- Modern terimle: **distributed lock + single-writer ownership + TTL'li leasing**. `ControlAuthority` birinci sınıf kavram. → **Arayüzde** "şu an kimde kontrol var" göstergesi.

---

## 2. IATA kavramları → Modern domain modeli

| IATA kavramı | Modern model | Pattern |
|---|---|---|
| Electronic Ticket (ET) | `Ticket` aggregate root | DDD aggregate |
| Electronic Coupon | `Coupon` entity (status'lü) | Entity |
| Coupon Status Indicator | `CouponStatus` enum + **state machine** | FSM |
| "ET file: tüm aksiyonların kaydı" | **Event-sourced aggregate** | **Event Sourcing** |
| Concept of Control | `ControlAuthority` (tek sahip, TTL lease) | Distributed ownership |
| Validating/Marketing/Operating/Billing Carrier | `CarrierRole` value objects | Value Object |
| ET Search & Display (~7 alt kriter) | CQRS **read models** + search index | **CQRS** |
| Fare Calculation, NUC, ROE, fare string | `FareCalculation`, `FareComponent` VO | Value Object |
| TFC (tax/fee/charge) | `TaxFeeCharge` VO | Value Object |
| Form of Payment, FOID | `FormOfPayment`, `Foid` VO | Value Object |
| EMD (EMD-A / EMD-S) | `Emd` aggregate | DDD aggregate |
| MCO / MPD / PTA | Legacy → EMD map; vMPD | Anti-corruption |
| Exchange/Reissue | `ExchangeTransaction` | Saga/Process |
| Refund | `RefundTransaction` | Process |
| Void | `VoidTransaction` | Command |
| IRROP / FIM | `G`/`I` statü handling | Process |
| Interline messaging | Message gateway (EDIFACT TKT + NDC/ONE Order XML) | Outbox + adapter |
| Conditions of Contract / Itinerary-Receipt | Document generation service | Service |
| **(Gelecek) ONE Order** | `Order` aggregate = system of record | Order-native |

---

## 3. Sistem mimarisi

> Detaylı gerekçeler `docs/ARCHITECTURE.md`'ye; özet burada.

**Temel ilke — "Tek komut, iki yüzey":** Terminal komutu da React tıklaması da **aynı backend komutuna** (`IssueTicket`, `ExchangeTicket`, `RefundCoupon`…) map olur. Frontend, iş kuralı içermeyen bir **sunum adaptörü**dür; tüm kurallar backend'de. Bu sayede arayüz, backend'i hiç değiştirmeden üstüne oturur.

**Backend (Engine):**
1. **Event Sourcing** — "ET file = tüm aksiyonların tarihsel kaydı" handbook'un kendi tanımı. Audit trail domainin tanımı, opsiyon değil. State event'lerden türetilir.
2. **CQRS** — yazma (komut→aggregate→event) ve okuma (search & display read modelleri) ayrı.
3. **Coupon Status = explicit FSM** — izin verilen geçişler kod+test ile sabit; final statüler terminal.
4. **Hexagonal (Ports & Adapters)** — domain saf; DB/Kafka/dış servisler adapter.
5. **Event-driven entegrasyon** + **Outbox pattern** (DB commit ↔ mesaj atomik).
6. **Idempotency her yerde** — çift-issue/çift-refund kabul edilemez; her komut idempotency key taşır.
7. **Order-native gelecek** — `Order` aggregate'ini system of record yapacak şekilde sınırları çiz.

**Frontend (Experience):**
8. **Sunum adaptörü** — frontend'de iş kuralı yok; backend otorite. Client-side validation (Zod) sadece hızlı geri bildirim için, sunucu son söz.
9. **Para işlemlerinde optimistic UI YOK** — issue/exchange/refund/void her zaman sunucu sonucunu bekler ve doğrular; frontend idempotency key üretir (çift submit koruması).
10. **Görsel-öncelikli state** — kupon statüsü renk kodlu badge; biletin yaşam döngüsü **event timeline** (history endpoint'i besler). Terminalin asla veremeyeceği şey.
11. **Hibrit etkileşim** — tıklama akışları + **command palette** (Cmd+K) ile uzman hızı. Hem acemi (çağrı merkezi/web) hem uzman (gişe) kullanıcı için.
12. **Gerçek zamanlı** — statü değişiklikleri ve control transferleri asenkron; SSE/WebSocket ile canlı güncelleme.
13. **Uçtan uca type-safety** — backend OpenAPI spec → TypeScript tipleri üretilir (`openapi-typescript`); API contract derleme zamanında zorlanır.

---

## 4. Teknoloji yığını

### Backend (Engine)
| Katman | Teknoloji | Neden |
|---|---|---|
| Dil / runtime | **Kotlin + Spring Boot 3** (Java 21 LTS) | Havayolu-grade; DDD/ES için olgun; null-safety; Claude Code güçlü |
| Event store + read DB | **PostgreSQL 16** (append-only events + `jsonb`) | Tek DB ile event store + read model |
| Mesajlaşma | **Apache Kafka** (dev'de **Redpanda**) | Event streaming, interline backbone, outbox |
| Cache / control lock | **Redis** | Read cache + `ControlAuthority` lease (TTL) |
| API | **REST (OpenAPI/Swagger)** + async event + **SSE/WebSocket** | Standart + canlı güncelleme |
| Auth | **Keycloak (OIDC)** | Kurumsal SSO, rol bazlı yetki |
| Doküman | Thymeleaf/Mustache + PDF lib | Itinerary/Receipt + Conditions of Contract |
| Test | **JUnit 5 + Testcontainers + Kotest** | Gerçek Postgres/Kafka'ya karşı |
| Gözlem | **OpenTelemetry + Prometheus + Grafana** | Trace/metric/log |
| (Ops.) ES/CQRS | **Axon Framework** | İskeleti hazır verir; istemezsen Postgres üstünde kendin kurarsın |

### Frontend (Experience)
| Katman | Teknoloji | Neden |
|---|---|---|
| Build / framework | **Vite + React 18 + TypeScript** | Hızlı, modern, type-safe |
| Routing | **TanStack Router** (veya React Router) | Type-safe route'lar |
| Server state | **TanStack Query** (React Query) | API verisi, cache, mutation, retry — bu domain için ideal |
| Client state | **Zustand** | Hafif, basit global state |
| Form + validation | **React Hook Form + Zod** | Mandatory data element'leri (Ch 2) client'ta aynala |
| Component primitives | **shadcn/ui** (Radix tabanlı) + **Tailwind CSS** | Erişilebilir, headless, THY markasına temalanabilir |
| Command palette | **cmdk** | Linear/Vercel'in kullandığı; uzman hızı |
| Tablolar / grid | **TanStack Table** | Bilet listeleri, kupon grid'leri |
| Gerçek zamanlı | **SSE / WebSocket client** | Canlı statü/control güncellemesi |
| Auth | **react-oidc-context** | Keycloak ile OIDC |
| API tipleri | **openapi-typescript** | Backend OpenAPI'den TS tipi üret — tek doğruluk kaynağı |
| Test | **Vitest + React Testing Library + Playwright** | Unit + component + e2e |

> **Velocity alternatifi (backend):** TypeScript + NestJS + Prisma. Aynı desenler; "havacılık-grade" algısı JVM kadar güçlü değil ama hız yüksek. **Tavsiye:** Kotlin + Spring Boot ile git.

### Monorepo yapısı
```
troya-eticket/
├── backend/        # Kotlin çok-modüllü: domain, application, infrastructure, api
├── frontend/       # Vite + React + TypeScript
├── contracts/      # OpenAPI spec — tek doğruluk kaynağı; TS tipi üretir
├── docs/           # ARCHITECTURE.md, GLOSSARY.md, DESIGN_ROADMAP.md
├── docker-compose.yml
├── CLAUDE.md
└── TROYA_ETICKET_ROADMAP.md
```

---

## 5. Engine Track (Backend) — fazlar

Her faz **çalışan yazılım** üretir. Test-first, tek bounded context, dikey dilim. İlerlemeni `[ ]`/`[~]`/`[x]` ile takip et.

### Faz 0 — Temel & domain iskeleti  — 🟡 kod yazıldı; ÇALIŞTIRILMADI (Java 21 + Docker yok)
**Bitti sayılır:** `docker compose up` ile Postgres+Kafka+Redis kalkıyor; çekirdek tipler derleniyor; CI yeşil. ⚠️ Bu ortamda doğrulanamadı — kod + yapı hazır, derleme/test ortam gerektirir.
- [x] Monorepo + Gradle (Kotlin DSL) çok-modüllü: `domain`, `application`, `infrastructure`, `api`
- [x] `docker-compose.yml`: PostgreSQL, Redpanda, Redis, Keycloak (kök dizinde)
- [x] `GLOSSARY.md` — ubiquitous language (zaten mevcuttu)
- [x] Context map (`ARCHITECTURE.md`) (zaten mevcuttu)
- [x] Value object'ler: `TicketNumber` (mod-7), `CarrierCode`, `AirportCode`, `Money`, `FareBasis`, `CarrierRole`
- [x] `CouponStatus` enum (resmî 17 kod, interim/final; `T` 2026-07-04'te kaldırıldı) + explicit FSM (`transitionTo` geçersizde exception)
- [x] Event store DDL: append-only `events` (`stream_id`, `version`, `type`, `payload jsonb`, `occurred_at`, UNIQUE) + outbox + idempotency_keys
- [x] ES/CQRS plumbing: `AggregateRoot`, `DomainEvent`, `EventStore` portu, `Repository`, `IdempotencyStore`
- [x] Health check (`/health`, `/meta/coupon-statuses`), 12-factor `application.yml` · [ ] OpenTelemetry (Faz sonrası)
- [x] CI (GitHub Actions): backend build+ktlint+detekt · frontend typecheck+test+build
- [x] Domain testleri (test-first): `CouponStatusTest`, `TicketNumberTest` (Kotest + JUnit5) — ⚠️ Gradle ortamında koşulmadı

### Faz 1 — Bilet kesimi & kupon yaşam döngüsü ⭐ (çekirdek MVP)
**Bitti sayılır:** `IssueTicket` → `TicketIssued` → aggregate event'lerden kuruluyor; ticket no ile display; tüm geçerli/geçersiz statü geçişleri test edilmiş.
- [ ] **Coupon Status state machine** — tüm geçişler (`O→A→C→L→F`, `O→V`, `O→E`, `O→R`, `O→S`, IRROP `→I/G`…), final terminal, exhaustive test
- [ ] İnvariant'lar: işlem için `O`; void için *tüm* kuponlar `O`; sıralı honor
- [ ] `Ticket` aggregate: `IssueTicket` → `TicketIssued` + `CouponAdded`
- [ ] **Ticket number**: 3 haneli airline kodu + serial + **mod-7 check digit** (13-hane)
- [ ] Mandatory data element validation (Ch 2): passenger name (min 2 karakter surname), from/to, marketing carrier, flight+RBD, departure date, reservation status
- [ ] Event-sourced persistence + rehydration (replay)
- [ ] `ControlAuthority`: tek sahip; Validating Carrier grant/revoke; Redis lease (TTL)
- [ ] API: `POST /tickets`, `GET /tickets/{n}`, `GET /tickets/{n}/coupons`, `GET /tickets/{n}/history`

### Faz 2 — Display/Search (CQRS okuma) & Itinerary-Receipt
**Bitti sayılır:** ≥3 alternatif kriterle arama; geçerli itinerary/receipt + conditions of contract.
- [ ] Read model'ler: event projeksiyonu (Kafka consumer → read tabloları)
- [ ] Arama kriterleri (1.1.5.2): ticket no; Date+O/D+Name; Marketing carrier+flight+date+O/D+Name; FF ref+date; credit card+date+name; conf. no; phone+name+date; FOID
- [ ] Search index: Postgres FTS → gerekirse OpenSearch
- [ ] **Itinerary/Receipt** (PDF/HTML) + Conditions of Contract + **Mandatory notices** (App B)
- [ ] Çok-dilli (TR/EN), para birimi formatları (Ch 11)

### Faz 3 — Void / Exchange-Reissue / Refund
**Bitti sayılır:** Komutlar çalışıyor; kuponlar doğru final statüye geçiyor; linkage kuruluyor; idempotent.
- [x] **Void**: tüm kuponlar `O`→`V`; idempotency key — ✅ 2026-07-04 (`TicketVoided`; invariant "hepsi O" 422; Docker'da uçtan uca doğrulandı)
- [x] **Exchange/Reissue** (Ch 12): eski `O→E`; yeni ticket; `IssuedInExchangeFor` linkage; **ADC** (yeni toplam = eski + ADC, `@Transactional` iki-aggregate atomik) — ✅ 2026-07-04 (`OriginalIssue` zinciri + residual EMD-S sonraya)
- [x] **Refund** (Ch 15): seçili kuponlar `O→R`; waiver (vefat/hastalık 13.9/15.4) — ✅ 2026-07-04 (refund hesabı + residual EMD-S sonraya)
- [ ] **IRROP / FIM** (Ch 13): `G`/`I` statü; endorsement
- [ ] Saga/process manager (exchange = void + issue + mutabakat); her işlem idempotent + tam tarihçe

### Faz 4 — Fare / TFC / ödeme
**Bitti sayılır:** Fare string parse/serialize; TFC'ler tax code'larıyla; form of payment + FOID.
- [~] **Fare Calculation** (2.22): fare construction string event'te TAŞINIR (parse/serialize edilmez — pricing engine işi) — 2026-07-04
- [x] **TFC** (2.12): tax code + amount + currency listesi; `base + ΣTFC == total` invariant'ı aggregate'te — ✅ 2026-07-04
- [x] `FareBasis` (2.6), Tour Code (2.7), NVB/NVA (2.8), baggage (2.9) — ✅ 2026-07-04 (event + read model + view)
- [x] Form of Payment (2.14), `Foid` (1.1.7) — ✅ 2026-07-04 (`TicketEntries`)
- [x] **Pricing/Fare engine adapter** — `FareQuotePort` + deterministik `MockFareQuoteAdapter` + `GET /fares/quote` — ✅ 2026-07-04
- [~] Currency procedures (Ch 11): equivalent fare paid alanı ✅; banker's rate/ROE portu sonraya

### Faz 5 — EMD & ancillaries
**Bitti sayılır:** EMD-A/EMD-S kesilebiliyor; kendi yaşam döngüsü; legacy doc'lar map ediliyor.
- [x] **`Emd` aggregate** (Ch 5): EMD-A (ET kuponuna bağlı, kupon varlığı doğrulanır) + EMD-S ("in connection with") — ✅ 2026-07-04 (tek kuponlu prototip; event-sourced, issue/refund/void idempotent, `emd_read` + REST; Docker'da doğrulandı)
- [~] EMD kupon statü + **RFISC** zorunlu ✅ (aynı resmî FSM); limitation of value (5.6) / min data (5.9) / control (5.10) sonraya
- [ ] **vMPD** (App F)
- [ ] Legacy mapping (Ch 3-9): MCO/MPD/PTA → EMD (anti-corruption layer)

### Faz 6 — Interline & mesajlaşma
**Bitti sayılır:** Outbox ile güvenilir yayın; ≥1 legacy + ≥1 modern mesaj uçtan uca; bilateral registry.
- [x] **Outbox pattern** — event append ile AYNI transaction'da outbox'a yazım (`JdbcEventStore`), `OutboxRelay` (2sn poll) → Redpanda `troya.events` (key=stream, zarf: type+aggregateId+payload; at-least-once) — ✅ 2026-07-04 Docker'da doğrulandı. Message gateway (EDIFACT/NDC formatlama) sonraya
- [ ] **Bilateral agreement registry** (control transferinin ön şartı)
- [ ] **Legacy EDIFACT TKT** mesajları: ticket exchange req/res, coupon status update, display req/res, control transfer
- [ ] **NDC / ONE Order XML**: `OrderCreate` / `OrderView` / `OrderChange` / `OrderReshop` iskeletleri (21.3 / 24.1+)
- [ ] Control transfer + 72 saat lease/iade enforcement; adapter'lar port arkasında

### Faz 7 — Order-native evrim (ONE Order)
**Bitti sayılır:** `Order` system of record; Ticket/EMD onun fulfillment projeksiyonu; basit Offer→Order akışı.
- [ ] **`Order` aggregate**'ini system of record yap; Ticket/EMD = fulfillment artifact
- [ ] Offer → Order akışı (stub Offer/Shopping)
- [ ] EASD / ONE Order veri modeline map; ARM kavramları
- [ ] Geriye uyum: Order'dan ET/EMD üretimi (geçiş döneminde paralel)

---

## 6. Experience Track (Frontend) — fazlar

> **Kapsam ayrımı:** Burada arayüzün **mühendisliği** var — hangi ekranlar, hangi kabiliyet, backend'e nasıl bağlanır. Ekranların **nasıl görüneceği**, etkileşim deseni, görsel dil, component detayları ve **senin fikirlerin** → `docs/DESIGN_ROADMAP.md` (birlikte dolduruyoruz). Her FE fazı, karşılığındaki Engine fazının API'sine bağımlı.

**Önerilen ritim:** Engine Faz 0 + 1 temeli oturduktan sonra her Engine fazını bitirip onun FE dilimini yap (vertical slice). Böylece her adımda *tıklanabilir, çalışan* bir şey çıkar.

### FE-0 — App shell & temel (Engine Faz 0-1 ile)
**Bitti sayılır:** Uygulama açılıyor, auth çalışıyor, API client + tipler hazır, command palette iskeleti var.
- [x] Vite + React + TS kurulumu; Tailwind + shadcn/ui (token override); tasarım token altyapısı (DESIGN_SYSTEM §1 → `index.css` + `tailwind.config.ts`)
- [x] App shell / layout (Topbar h-14 + Sidebar 256px IA + content) — DESIGN_ROADMAP §2
- [~] **OpenAPI → TS tip üretimi**: prototipte tipler elle yazıldı (`domain/types.ts`, not'lu); TanStack Query client kuruldu. Backend hazır olunca `openapi-typescript` ile değişecek.
- [ ] Auth: react-oidc-context + Keycloak; korumalı route'lar; rol bazlı görünüm (backend Keycloak gelince)
- [x] **Command palette** iskeleti (cmdk) — ⌘K, fuzzy, aksiyon grupları + son işlemler
- [ ] SSE/WebSocket bağlantı altyapısı (backend event yayını gelince)

### FE-1 — Bilet kesimi & görüntüleme (Engine Faz 1)  — ✅ tıklanabilir prototip (mock veri)
**Bitti sayılır:** Wizard ile bilet kesilebiliyor; bilet ekranında kuponlar + renk kodlu statü; control göstergesi.
- [x] **Issue wizard**: yolcu → segment(ler) → fare/ödeme → onay (RHF + Zod, canlı özet paneli, progress)
- [x] **Ticket detail** ekranı: kupon grid'i, **renk kodlu statü pill'leri** (§9.1), fare two-tone, lifecycle timeline
- [x] **Control göstergesi**: ControlIndicator — "şu an kimde kontrol var" + interline lease süresi
- [x] Çift-submit koruması (frontend idempotency key); para işleminde optimistic UI yok (sunucu beklenir)
- [x] Bonus: Smart search + sonuç grid'i (TanStack Table), check-digit doğrulayan TKT no algısı

### FE-2 — Arama & yaşam döngüsü timeline (Engine Faz 2)  — ✅ prototip (mock)
**Bitti sayılır:** Çoklu kriterle arama UI; sonuç grid'i; **event timeline**; itinerary/receipt önizleme/yazdırma.
- [x] **Arama UI**: tek akıllı çubuk (TKT no/PNR/yolcu/havalimanı algısı) + "Gelişmiş" panel + check-digit doğrulama
- [x] Sonuç grid'i (TanStack Table); satırdan detaya
- [x] **Kupon yaşam döngüsü timeline** — event history'den (FE-1'de bitti)
- [x] **Itinerary/Receipt** önizleme + yazdır (TR/EN, Conditions of Contract + Mandatory Notices App B, print CSS)

### FE-3 — Değişiklik akışları (Engine Faz 3)  — ✅ prototip (mock)
**Bitti sayılır:** Exchange/refund/void guided flow'ları; onay adımı; net para gösterimi.
- [x] **Exchange/Reissue** akışı (sağ drawer): eski açık kuponlar→E, yeni TKT + linkage, ADC two-tone MoneyDelta
- [x] **Refund** akışı (sağ drawer): kupon seçimi→R, iade tutarı + residual (EMD-S)
- [x] **Void** akışı (modal): ön koşul (tüm kuponlar `O`) — değilse engel + sebep gösterimi
- [x] Her akışta "ne olacak" özeti + geri-alınamaz uyarısı (ConfirmDestructive) + alttan dark toast
- [x] Mock "sunucu"da FSM guard'ları + idempotency key; kısayollar e/r/v

### FE-4 — Fare/TFC/ödeme gösterimi (Engine Faz 4)  — ✅ prototip (mock)
- [x] **Fare breakdown** paneli: fare calc string, NUC/ROE, TFC dökümü (tax code mono + two-tone)
- [x] Form of payment + FOID gösterimi (ticket detail ödeme kartı); issue wizard'da FOP/FOID girişi

### FE-5 — EMD & ancillaries (Engine Faz 5)  — ✅ prototip (mock)
- [x] **EMD paneli**: bilete bağlı EMD listesi (kendi status pill'i) + **EMD ekle** drawer (EMD-A/EMD-S, RFISC kataloğu, kupona bağlama)

### FE-6 — Interline görünürlüğü (Engine Faz 6)  — ✅ prototip (mock)
- [x] **Mesaj log viewer**: gönderilen/alınan (EDIFACT/NDC/ONE Order), açılır ham payload, standart filtresi
- [x] Control transfer izi (mesaj + ControlIndicator lease); **Bilateral anlaşma** listesi (yetenekler, control transfer)

### FE-7 — Order-merkezli görünüm (Engine Faz 7)  — ✅ prototip (mock)
- [x] **Order** list + detay: Order ana nesne; Ticket/EMD altında fulfillment olarak (ticket'a link); sidebar'da ORDER üst-seviye nav

---

## 7. Kesişen konular (tüm fazlar)

- **Güvenlik & uyum:** Kart verisi → **PCI-DSS** (mümkünse tokenization ile kapsam dışı); yolcu PII → **KVKK/GDPR**; PII at-rest şifreli; rol bazlı yetki (agent/carrier/admin); display kısıtları (5.7).
- **Idempotency:** Para/statü değiştiren her komut idempotency key; frontend de üretir. **Çift-issue/çift-refund = kabul edilemez.**
- **Audit & compliance:** ES tam tarihçe + değişmez audit/erişim logları.
- **Type-safety (uçtan uca):** OpenAPI tek doğruluk kaynağı; backend tipleri → frontend tipleri üretilir; kontrat derlemede zorlanır.
- **Erişilebilirlik (a11y):** Klavye navigasyonu, ARIA, kontrast — havayolu sistemlerinde sık zorunlu. (Detay → DESIGN_ROADMAP)
- **Test:** Domain → saf unit (state machine: tüm geçerli + geçersiz geçişler). Application → Testcontainers. API → contract. Frontend → Vitest/RTL + Playwright e2e. Senaryo testleri (1.1.4.4 kaynak).
- **Gözlem:** Her komut/event trace'li; bilet kesim latency, statü dağılımı, hata oranı.
- **Performans:** Inventory hot-path (1000+ TPS) bu modülde değil; ama bilet kesimi idempotent, dayanıklı, makul hızlı. Aggregate büyürse snapshot.

---

## 8. Bunu Claude Code ile nasıl işlersin

1. **Bu dosya + `CLAUDE.md`'yi repo köküne koy.** Claude Code bağlamı buradan alır. Tasarım için ayrıca `docs/DESIGN_ROADMAP.md`'ye bakar.
2. **Engine ve Experience'ı dikey dilim dilim eşle.** Önce Engine fazının API'sini stabil et, sonra FE dilimini yap (ya da Faz 0/1 temelinden sonra tandem).
3. **Test-first iste** — özellikle state machine, idempotency, exchange/refund/void.
4. **Tek bounded context / tek katman.** Domain+infra+API+UI karıştırma; cerrahi iste.
5. **Event storming çıktısını referans ver** (yukarıdaki tablolar): "bu komutu/event'i ekle, bu invariant'ı koru".
6. **Her faz sonunda** `docker compose up` + tüm testler yeşil olmadan ilerleme.
7. **Belirsizse handbook bölümüne dön** (örn. "Ch 12 exchange"), özetini Claude'a ver.

**İlk komut örneği (Claude Code'a):**
> "Engine Faz 0'ı başlat: monorepo (backend/ Kotlin çok-modüllü, frontend/ boş Vite+React+TS iskeleti, contracts/, docs/), docker-compose (Postgres + Redpanda + Redis + Keycloak), append-only event store tablosu. `CouponStatus` enum'unu ROADMAP'teki 18 kodla interim/final ayrımıyla yaz. ktlint + detekt + GitHub Actions CI ekle. Önce yapı, kod sonra; her adımı açıkla."

---

## 9. Hızlı referans — çekirdek domain event'leri

```
TicketIssued        { ticketNumber, validatingCarrier, passenger, coupons[], fare, tfcs[], fop }
CouponAdded         { ticketNumber, couponSeq, segment, status=O }
ControlGranted      { ticketNumber, couponSeq, toCarrier, leaseExpiresAt }
ControlReturned     { ticketNumber, couponSeq, toValidatingCarrier }
CouponCheckedIn     { ticketNumber, couponSeq }              // C
CouponLifted        { ticketNumber, couponSeq }              // L
CouponFlown         { ticketNumber, couponSeq }              // F (final)
TicketVoided        { ticketNumber, reason }                 // tüm kupon V (final)
CouponExchanged     { ticketNumber, couponSeq, newTicketNumber }   // E (final)
TicketReissued      { newTicketNumber, issuedInExchangeFor, originalIssue, adc }
CouponRefunded      { ticketNumber, couponSeq, refundAmount, residual }   // R (final)
CouponSuspended     { ticketNumber, couponSeq, reason }      // S
IrregularOpsApplied { ticketNumber, couponSeq, fim? }        // I / G
EmdIssued           { emdNumber, type=A|S, rfisc, associatedCoupon? }
```

> Frontend bu event'leri iki yerde kullanır: **timeline** (yaşam döngüsü görselleştirmesi) ve **canlı güncelleme** (SSE ile gelen event → UI tazeleme).

---

## 10. Tasarım yol haritası nereye oturuyor

Arayüzün **mühendisliği** bu dosyada (mimari, stack, hangi ekranlar, entegrasyon). Arayüzün **tasarımı** ise ayrı `docs/DESIGN_ROADMAP.md`'de — **birlikte dolduruyoruz**, senin fikirlerinle. Oraya girecekler:

- Tasarım prensipleri / kuzey yıldızı
- Bilgi mimarisi & navigasyon (IA)
- Ekran envanteri (her FE kabiliyeti için ekran tasarımı)
- Component envanteri / kütüphane (kullanacağımız şeyler)
- Tasarım token'ları / görsel dil (renk, tipografi, spacing, radius, gölge)
- Etkileşim desenleri (wizard/modal/drawer; command palette davranışı; klavye kısayolları)
- Kupon yaşam döngüsü timeline tasarımı + statü renk kodları
- Durumlar (loading/empty/error/success/optimistic)
- Erişilebilirlik hedefleri & responsive/cihaz hedefleri
- Prototip & teslim sırası

> `DESIGN_ROADMAP.md` şu an **boş şablon** olarak hazır — bir sonraki adımda fikirlerini söyle, birlikte dolduralım.

---

*Bu yol haritası IATA Ticketing Handbook çekirdeğinden türetildi ve 2026 itibarıyla IATA'nın Offers & Orders (NDC / ONE Order) yönü ile hizalandı. Handbook bölüm referansları (Ch x.y) koddaki kuralın kaynağıdır.*
