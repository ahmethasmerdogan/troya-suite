# Troya — Engine (Backend)

Kotlin + Spring Boot 3 (Java 21) · event-sourced biletleme motoru. **Durum: Faz 0 — yeşil & doğrulandı (2026-06-19).**

> ✅ **Docker ile build + test + lint + boot doğrulandı** (host'ta Java GEREKMEZ). Tüm modüller derleniyor, testler + ktlint + detekt temiz; uygulama Postgres+Redis ile ayağa kalkıyor, Flyway `events`/`outbox`/`idempotency_keys` tablolarını oluşturuyor, `/health` ve `/meta/coupon-statuses` 200 dönüyor.

## Modüller (Hexagonal — ARCHITECTURE §7)

```
domain/          SAF: value object'ler, CouponStatus FSM, AggregateRoot, DomainEvent. Framework yok.
application/      portlar (EventStore, Repository, IdempotencyStore), use-case'ler (Faz 1+).
infrastructure/   Postgres event store, Flyway DDL, Redis, (Faz 6) Kafka outbox.
api/              Spring Boot main + REST + actuator. Bootable.
```
Bağımlılık yönü daima içeri: `api → application → domain`, `infrastructure → domain`.

## Faz 0'da ne var

- Çok-modüllü Gradle (Kotlin DSL) + Java 21 toolchain + ktlint + detekt.
- **`CouponStatus`** — resmî 17 kod (Handbook 1.1.4), interim/final ayrımı, **explicit FSM** (`transitionTo` geçersizde exception). Frontend aynası `nw_THYProject/frontend/src/domain/couponStatusMachine.ts` ile aynı geçiş tablosu.
- Value object'ler: `Money` (Ch 11), `CarrierCode`, `AirportCode`, `FareBasis`, `CarrierRole`, **`TicketNumber`** (3+9+mod-7 check digit).
- ES/CQRS plumbing: `AggregateRoot` (raise/replay/version), `DomainEvent`, `EventStore` portu (append-only + optimistic concurrency), `Repository`, `IdempotencyStore`.
- Event store DDL (`V1__event_store.sql`): `events` (stream_id, version, jsonb, UNIQUE) + `outbox` + `idempotency_keys`.
- `HealthController` (`/health`, `/meta/coupon-statuses`), 12-factor `application.yml`.
- Testler: `CouponStatusTest` (FSM, exhaustive), `TicketNumberTest` (check digit) — Kotest + JUnit 5.
- `../docker-compose.yml`: Postgres 16 + Redpanda + Redis + Keycloak.
- `../.github/workflows/ci.yml`: backend (gradle build+lint) + frontend (typecheck+test+build).

## Çalıştırma — Docker ile (host'ta Java gerekmez) ✅

Bu makinede Java yok ama Docker var; build/test/lint tamamen container'da yapılır. Gradle bağımlılıkları
`troya-gradle-cache` named volume'da önbelleğe alınır (sonraki çalıştırmalar hızlı).

```bash
cd backend
# Build + test + ktlint + detekt (tek komut):
docker run --rm -v "$PWD":/home/gradle/project -v troya-gradle-cache:/home/gradle/.gradle \
  -w /home/gradle/project gradle:8.11.1-jdk21 gradle build --no-daemon

# Format düzeltme: ... gradle ktlintFormat   ·   Sadece domain testi: ... gradle :domain:test
```

Uygulamayı çalıştırma (Postgres + Redis):

```bash
# Altyapı (port çakışırsa override: DB_PORT=15432 REDIS_PORT=16379 ...):
cd .. && docker compose up -d postgres redis

# bootJar'ı compose ağında çalıştır (network adı: <klasör>_default):
docker run --rm --network thyticketproject_default \
  -e DB_URL=jdbc:postgresql://postgres:5432/troya -e REDIS_HOST=redis \
  -p 8080:8080 -v "$PWD/backend/api/build/libs":/libs \
  eclipse-temurin:21-jre java -jar /libs/api-0.1.0.jar
# → curl http://localhost:8080/health  ·  /meta/coupon-statuses
```

Java host'ta varsa klasik yol: `./gradlew build` · `./gradlew :api:bootRun` (gradle wrapper 8.11.1 eklendi).

## Faz 0 "bitti" tanımı (ROADMAP) — ✅ KARŞILANDI

`docker compose up` ile altyapı kalkar · çekirdek tipler derlenir · testler + ktlint + detekt + boot yeşil.
**Docker ile doğrulandı (2026-06-19).** Sıradaki: **Faz 1** — `Ticket` aggregate, `IssueTicket → TicketIssued`, control authority, REST `POST /tickets`.
