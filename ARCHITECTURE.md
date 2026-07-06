# ARCHITECTURE.md — Troya Biletleme Platformu

> Mimari kararlar ve gerekçeleri. Özet `TROYA_ETICKET_ROADMAP.md §3`'te; burası detay. Çalışma kuralları `CLAUDE.md`'de.

## 1. Bounded context

Bu sistem bir PSS'in **Elektronik Biletleme** bounded context'i. Domain dili (`docs/GLOSSARY.md`) bu sınır içinde tutarlı. Sınır dışındaki her sistem **port + adapter** ile, asenkron event veya açık API üzerinden konuşulur — domain onları "bilmez".

### Context map (seams)
```
                    ┌──────────────────────────────────────┐
   Shopping/Offer ──►│                                      │
   Pricing/Fare    ──►│   ELEKTRONİK BİLETLEME (bu sistem)   │──► Revenue Accounting
   Inventory       ──►│   Ticket · Coupon · EMD · Order      │──► BSP / Settlement
   PNR/Reservation ──►│   (event-sourced + CQRS)             │
   Payment Gateway ──►│                                      │◄─► Interline (diğer carrier'lar)
   DCS (check-in)  ◄─►│                                      │    EDIFACT TKT / NDC / ONE Order
                    └──────────────────────────────────────┘
```
Hepsi mock adapter ile başlar; gerçek entegrasyon sonraki fazlarda. **Pricing bu sistemin işi değil** — fiyatı tüketiriz, hesaplamayız.

## 2. Neden Event Sourcing

Handbook'un kendi tanımı: *"ET file = gerçekleşen tüm aksiyonların tarihsel kaydı."* Audit trail bir özellik değil, **domainin tanımı**. ES bunu doğal verir:
- State, append-only/immutable event'lerden türetilir (replay).
- Tam tarihçe + temporal sorgu + "neyin neden olduğu" bedava gelir.
- Settlement, dispute, IATA denetimi için birebir.

Event store: PostgreSQL `events` tablosu (`stream_id`, `version`, `type`, `payload jsonb`, `occurred_at`) + optimistic concurrency (version çakışması). Aggregate büyürse snapshot.

## 3. Neden CQRS

İki yük profili tamamen farklı:
- **Yazma:** komut → aggregate (invariant kontrolü) → event. Az ama tutarlı.
- **Okuma:** ET search & display — handbook'ta ~7 alternatif arama kriteri. Çok ve çeşitli.

Ayırıyoruz: komutlar event üretir; **read model'ler** event'lerden projekte edilir (Kafka consumer → read tabloları / search index). Komut tarafında sorgu için read model kullanılmaz; aggregate event'lerden rehydrate edilir.

## 4. Coupon Status state machine

Sistemin kalbi. `CouponStatus` üzerinde explicit FSM:
- Resmî 17 kod, **interim** (O/A/C/L/I/S/U/N/Y) ve **final** (F/E/G/R/V/P/X/Z — terminal). (`T` resmî 1.1.4 listelerinde yok; kâğıda dönüşümü P/X karşılar — 2026-07-04'te kaldırıldı.)
- İzin verilen geçişler kod + exhaustive test ile sabit. İzin verilmeyen geçiş **exception** fırlatır, asla sessiz değil.
- İnvariant'lar: (1) final statü değişmez; (2) işlem için statü `O` (void için *tüm* kuponlar `O`); (3) kuponlar **sırayla** honor edilir.

## 5. Concept of Control → ControlAuthority

Handbook'un en değerli dağıtık-sistem fikri:
- Kuponun control'ünü aynı anda **tek carrier** tutar; **sadece Validating Carrier** grant/revoke eder; önce geri alınmadan başkasına verilemez.
- Modern model: **single-writer ownership + TTL'li lease** (Redis). Kontrolü alan, kalkıştan sonra **72 saat** içinde iade etmekle yükümlü — lease süresi bunu enforce eder.

## 6. Idempotency & Outbox

- **Idempotency:** para/statü değiştiren her komut bir idempotency key taşır (frontend de üretir). Tekrarlanan komut aynı sonucu döner, ek yan etki yok. **Çift-issue / çift-refund kabul edilemez.**
- **Outbox:** DB transaction + mesaj yayını atomik. Doğrudan publish yok; outbox tablosuna yazılır, ayrı consumer yayınlar (kayıp/çift mesaj olmaz). Interline mesajlaşmanın da temeli.

## 7. Hexagonal katmanlama

Backend modülleri:
- **domain** — saf; framework/DB/Kafka bilmez. Aggregate, event, value object, FSM, invariant.
- **application** — komut/sorgu handler'ları; use-case orchestration; saga.
- **infrastructure** — event store, read model projeksiyonu, Kafka/Redis, dış sistem adapter'ları.
- **api** — REST (OpenAPI) + SSE/WebSocket.

Bağımlılık yönü daima dışarıdan içeri (infra → domain).

## 8. Full-stack komut akışı ("tek komut, iki yüzey")

Terminal komutu da React tıklaması da **aynı backend komutuna** map olur:
```
[React UI / ⌘K]  ──REST(+idempotency key)──►  [api]
        │                                         │
        │                                    [application] komut handler
        │                                         │
        │                                    [domain] aggregate: invariant + event
        │                                         │
        │                                  [infrastructure] event store (append)
        │                                         │
        │                                    outbox → Kafka
        │                                    ├─► read model projeksiyonu (search/display)
        │                                    └─► interline mesaj (gerekirse)
        ▼                                         │
   SSE/WebSocket  ◄───── event yayını ────────────┘   (UI canlı tazelenir: statü, control, timeline)
```
Frontend = sunum adaptörü; iş kuralı içermez. Client validation (Zod) sadece hızlı geri bildirim; **sunucu otorite**. Para işlemlerinde optimistic UI yok.

## 9. Order-native gelecek (Faz 7)

Bugün `Ticket`/`Coupon`/`Emd` doğru kurulur; ama sınırlar `Order` aggregate'ini **system of record** yapacak şekilde çizilir. ONE Order'a geçiş refactor değil, planlı adım: Ticket/EMD, Order'ın fulfillment projeksiyonuna döner; geçiş döneminde ikisi paralel yaşar.

## 10. Teknoloji (özet)
Kotlin + Spring Boot 3 · PostgreSQL (event store + read model) · Kafka/Redpanda · Redis (cache + control lease) · OpenAPI + SSE/WebSocket · Keycloak (OIDC) · Testcontainers · OpenTelemetry. Frontend: Vite + React + TS · shadcn/ui · TanStack Query/Router/Table · cmdk. (Detay: ROADMAP §4, DESIGN_SYSTEM.)
