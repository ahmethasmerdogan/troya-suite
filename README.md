<div align="center">

# 🎫 Troya Suite

**A modern, event-sourced electronic-ticketing platform for airline passenger services — modeled on the IATA Ticketing Handbook.**

[![Kotlin](https://img.shields.io/badge/Kotlin-7F52FF?style=flat-square&logo=kotlin&logoColor=white)](https://kotlinlang.org/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-6DB33F?style=flat-square&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)

**English** · [Türkçe](README.tr.md)

</div>

---

## Overview

Troya Suite is a full-stack **Passenger Service System (PSS) electronic-ticketing** platform. It implements the electronic-ticketing bounded context of a PSS: issuing electronic tickets (ET) and EMDs, managing the **coupon lifecycle**, keeping a complete audit of the ticket record, search & display, exchange / reissue / refund / void, and interline messaging. In place of the cryptic command-line terminal of legacy ticketing systems, it offers a **click-based React interface** — while keeping the underlying engine command-driven.

The project is organized around one guiding principle — **"one command, two surfaces"**: whether an action originates from a terminal command or a React click, it maps to the *same* backend command. Business rules live in the engine; the UI is a presentation adapter. Money operations wait for the server (no optimistic UI).

Two tracks:

- **Engine (backend)** — the ticketing engine and business rules.
- **Experience (frontend)** — the operations interface.

> **Scope.** Troya Suite implements the *electronic-ticketing* module of a PSS. Adjacent systems — inventory, availability, shopping, pricing engine, PNR, DCS, loyalty, revenue accounting — are intentionally out of scope and sit behind ports as mocks. Pricing is *consumed*, not computed.

## Highlights

**Domain & architecture**

- **Event Sourcing** — state is derived from an append-only, immutable event log; the full audit trail is the definition of the domain, not an add-on.
- **CQRS** — writes (command → aggregate → event) and reads (projected read models) are separated.
- **Coupon Status finite-state machine** — the IATA coupon-status indicators (interim and final/terminal) are modeled as an explicit FSM; illegal transitions raise an error, never fail silently.
- **Control authority / lease** — the IATA "Concept of Control" modeled as single-writer ownership with a TTL-based lease.
- **Idempotency & outbox** — every money/status-changing command carries an idempotency key (no double-issue / double-refund); DB commit and message publication are atomic via an outbox.
- **Hexagonal layering** — a pure domain module with ports & adapters for every outside system (dependencies always point inward).

**Product surface (frontend)**

A single unified workspace with a module switcher, mirroring an airline PSS operational model:

- **QuickRes** — reservation (PNR): search, detail, create-PNR wizard, availability from the flight schedule, PNR commands (cancel itinerary / segment, TTL extension, remarks, history), one ticket per passenger straight from the PNR.
- **Troya** — ticketing: 5-step issue wizard with a system fare quote (no hand-typed fares) and group/family issuance, ticket detail (status pills, control indicator, lifecycle timeline, fare / TFC / VAT breakdown), smart search, itinerary/receipt (TR/EN, printable), exchange / refund / void with penalty and tax-refundability rules, EMD, PTA, ADM/ACM, interline messages and agreements, orders, work queues, schedule change, passenger-rights compensation, and a report centre (sales, financial, period closing).
- **QuickCheck-in** — departure control (DCS): check-in desk with cross-flight passenger search, acceptance window with supervisor-approved late acceptance, travel-document and APIS checks, aircraft-specific seat maps with seat-eligibility rules, boarding, flight close-out (coupons to Flown), and a HUB control board.
- **Panel**, **Admin** & **Chat** — dashboard with station notices; users, roles & permissions, audit log; real-time staff chat with ticket attachments.
- **Bilingual (TR/EN)**, role-based access (cumulative roles), command palette (⌘K), keyboard shortcuts, guided screen tours and contextual tips.

## Tech stack

**Engine (backend)** — Kotlin · Spring Boot 3 (Java 21) · Gradle (Kotlin DSL) multi-module (`domain` · `application` · `infrastructure` · `api`) · PostgreSQL 16 (event store + read models, Flyway) · Redis (control lease) · Kafka / Redpanda (outbox) · Keycloak (OIDC) · Kotest + JUnit 5 · ktlint + detekt · OpenTelemetry.

**Experience (frontend)** — Vite · React 18 · TypeScript · Tailwind CSS + shadcn-style tokens · TanStack Router / Query / Table · Zustand · React Hook Form + Zod · cmdk · Lucide · HashUI component kit · Vitest + Playwright.

**Contracts** — an OpenAPI 3.1 spec describes the target REST API. The frontend prototype still runs on its in-memory mock domain with hand-written types shaped after the spec; they will be generated from it (`openapi-typescript`) when the UI is wired to the live engine. See [`contracts/README.md`](contracts/README.md) for what the engine implements today.

**Local infra & CI** — Docker Compose (PostgreSQL · Redpanda · Redis · Keycloak); GitHub Actions (backend: build + ktlint + detekt · frontend v1 and v2: typecheck + test + build). Vercel deploys `main` to production and every other branch to a preview URL.

## Repository structure

```
troya-suite/
├── backend/        Kotlin multi-module engine: domain · application · infrastructure · api
├── nw_THYProject/  Current frontend (v2): nw_THYProject/frontend — Vite + React + TypeScript unified panel, deployed to Vercel
├── frontend/       Previous frontend (v1), kept as a reference
├── contracts/      OpenAPI 3.1 spec (target REST API)
├── vercel.json     Vercel build config (builds nw_THYProject/frontend)
├── docker-compose.yml       Local dev infra (Postgres · Redpanda · Redis · Keycloak)
├── ARCHITECTURE.md          Architecture decisions & rationale
├── GLOSSARY.md              Ubiquitous language (IATA + engineering terms)
├── DESIGN_ROADMAP.md        Interface / IA design
├── DESIGN_SYSTEM.md         Visual design language
├── SYSTEM_GUIDE.md          End-user guide
├── TROYA_ETICKET_ROADMAP.md Full delivery roadmap
└── CLAUDE.md                Engineering working rules
```

## Getting started

**Frontend** — clickable prototype on mock data:

```bash
cd nw_THYProject/frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc + vite build
npm run test       # Vitest (unit + component)
npm run e2e        # Playwright (end-to-end)
```

**Backend** — Kotlin engine:

```bash
# Local infra (Postgres · Redpanda · Redis · Keycloak):
docker compose up -d

cd backend
./gradlew build            # compile + test + ktlint + detekt
./gradlew :api:bootRun     # start the API
```

Java 21 is required on the host for the classic Gradle flow; a fully Docker-based build/test/run flow (no host Java needed) is documented in [`backend/README.md`](backend/README.md).

**Deploy** — the Vercel project is connected to this repository. Every push to `main` goes to production and every other branch gets a preview URL. The root [`vercel.json`](vercel.json) builds `nw_THYProject/frontend`, so no Root Directory setting is needed.

## Status

Actively developed, **private / internal**. An honest snapshot:

- **Experience (frontend)** — the unified panel (v2, `nw_THYProject/frontend`: QuickRes + Troya + QuickCheck-in + Panel + Admin + Chat) is a **clickable prototype running end-to-end on mock data**, in TR/EN, deployed on Vercel, with typecheck, unit tests, end-to-end tests and build green. API call signatures are shaped to match the real REST contract, so they can be swapped for live endpoints without reshaping the UI.
- **Engine (backend)** — verified end-to-end in Docker: **F0 foundation**, **F1 ticket + coupon** (issue / get / idempotency / event store), and **F2 search + receipt** (CQRS read model + projection) are complete; **F3 void/exchange/refund**, **F4 fare/TFC**, **F5 EMD**, and **F6 interline** have their core commands implemented and verified, with advanced pieces (IRROP/FIM saga, ROE/banker's rounding, vMPD/legacy mapping, EDIFACT/NDC gateway) still open. **F7 order-native** is planned.

Live authentication (Keycloak/OIDC) and SSE/WebSocket live updates land as the backend advances toward an **Order-native (ONE Order)** future.

## Documentation

| Document | What it covers |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Architecture decisions & rationale — bounded context, ES/CQRS, FSM, control authority, idempotency/outbox. |
| [`GLOSSARY.md`](GLOSSARY.md) | Ubiquitous language — IATA + engineering terms. |
| [`DESIGN_ROADMAP.md`](DESIGN_ROADMAP.md) | Interface design — IA, navigation, screen-by-screen. |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Visual design language — the single source of truth. |
| [`SYSTEM_GUIDE.md`](SYSTEM_GUIDE.md) | End-user guide — modules, roles, workflows. |
| [`TROYA_ETICKET_ROADMAP.md`](TROYA_ETICKET_ROADMAP.md) | Full delivery roadmap (Engine F0–F7, Experience FE-0…FE-7). |
| [`contracts/openapi.yaml`](contracts/openapi.yaml) | REST API contract (OpenAPI 3.1). |

---

<div align="center">

Built with [Claude Code](https://claude.com/claude-code).

</div>
