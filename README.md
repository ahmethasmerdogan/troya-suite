# Troya — Modern Biletleme Platformu

IATA Ticketing Handbook'tan türetilen, **event-sourced** bir elektronik biletleme platformu. Troya'nın kriptik terminal ekranının yerine **tıklama-tabanlı React arayüzü** koyar; ileride IATA'nın **Offers & Orders (NDC / ONE Order)** yönüne evrilir.

İki track: **Engine (backend)** — biletleme motoru + iş kuralları · **Experience (frontend)** — operasyon arayüzü. Temel ilke: **"tek komut, iki yüzey"** — terminal komutu da React tıklaması da aynı backend komutuna map olur.

> **Kapsam:** Bir PSS'in biletleme modülü. Kapsam dışı (port arkasında mock): inventory, availability, shopping, pricing engine, PNR, DCS, loyalty, revenue accounting.

## Dokümantasyon

| Dosya | Ne için | Repo yolu |
|---|---|---|
| **TROYA_ETICKET_ROADMAP.md** | Ana yol haritası — full-stack, iki track, Faz 0-7 + FE-0…FE-7. IATA→domain eşlemesi, coupon status, mimari özet. | kök |
| **CLAUDE.md** | Claude Code çalışma kuralları — mimari kurallar, teknoloji, çalışma yöntemi, durum. | kök |
| **docs/ARCHITECTURE.md** | Mimari kararlar + gerekçe — bounded context, ES/CQRS, FSM, control authority, idempotency/outbox, komut akışı. | docs/ |
| **docs/DESIGN_ROADMAP.md** | Arayüz tasarımı — IA/navigasyon, ekran-ekran tasarım, etkileşim desenleri, prototip sırası. (Kararlar verildi.) | docs/ |
| **docs/DESIGN_SYSTEM.md** | Görsel tasarım dili — tek kaynak gerçeği. CRM+ERP fintech-minimalizminden uyarlandı; coupon-status pill mapping, fare two-tone, lifecycle timeline. shadcn-oriented. | docs/ |
| **docs/GLOSSARY.md** | Ubiquitous language — IATA + mühendislik terimleri (TR). | docs/ |

## Teknoloji

**Backend:** Kotlin + Spring Boot 3 (Java 21) · PostgreSQL 16 (event store + read model) · Kafka/Redpanda · Redis · OpenAPI + SSE/WebSocket · Keycloak · Testcontainers · OpenTelemetry.
**Frontend:** Vite + React 18 + TypeScript · shadcn/ui + Tailwind · TanStack Query/Router/Table · Zustand · React Hook Form + Zod · cmdk · Vitest + Playwright.

```
troya-eticket/
├── backend/    Kotlin: domain · application · infrastructure · api
├── frontend/   Vite + React + TS
├── contracts/  OpenAPI spec (tek doğruluk kaynağı; TS tipi üretir)
├── docs/       ARCHITECTURE · GLOSSARY · DESIGN_ROADMAP · DESIGN_SYSTEM
├── docker-compose.yml
├── CLAUDE.md
├── TROYA_ETICKET_ROADMAP.md
└── README.md
```

## Claude Code ile başlama

1. Tüm dosyaları repoya yukarıdaki yapıya göre koy.
2. Claude Code'a ilk komut (Engine Faz 0):
   > "Engine Faz 0'ı başlat: monorepo (backend/ Kotlin çok-modüllü, frontend/ Vite+React+TS iskeleti, contracts/, docs/), docker-compose (Postgres + Redpanda + Redis + Keycloak), append-only event store tablosu. `CouponStatus` enum'unu ROADMAP'teki 18 kodla interim/final ayrımıyla yaz. ktlint + detekt + GitHub Actions CI. Önce yapı, kod sonra; her adımı açıkla."
3. Faz faz, dikey dilim dilim ilerle; test-first; her faz sonunda `docker compose up` + testler yeşil.

## Birleşik panel (THY mental modeli)

THY'nin gerçek ayrımı: **Troya** = komut-tabanlı motor · **QuickRes** = rezervasyon için tıklama arayüzü · **QuickCheck-in** = check-in/DCS için tıklama arayüzü (hepsi aynı motora oturur). Prototip bu üçünü **tek panelde** birleştirir (üstte modül seçici + birleşik anasayfa). Böylece kapsam, salt biletlemeden **rezervasyon + biletleme + check-in** suite'ine genişledi (hepsi mock; backend motoru ortak).

## Durum (2026-06-13)
**Experience (frontend/):** Birleşik panel + QuickRes + Troya (FE0…FE7) + QuickCheck-in + Yönetim, **TR/EN dil** ile **tıklanabilir prototip, mock veriyle uçtan uca çalışıyor** — `cd frontend && npm install && npm run dev` → http://localhost:5173. `npm run test` (52 test) + `npm run build` yeşil.
**Engine (backend/):** **Faz 0 iskeleti yazıldı** (Kotlin çok-modüllü, CouponStatus FSM, value object'ler, event store DDL, docker-compose, CI) ama **bu makinede çalıştırılmadı** — Java 21 + Docker gerekiyor (kurulu değil). Faz 1+ bekliyor. Bkz. `backend/README.md`.

Detay ve checklist'ler ROADMAP'te; çalışma kuralları + durum `CLAUDE.md`'de.
