# Troya Suite — Experience (Frontend)

**Birleşik panel** — THY mental modeline göre üç modül tek çalışma alanında (üstte modül seçici):
**QuickRes** (Rezervasyon) · **Troya** (Biletleme) · **QuickCheck-in** (Check-in/DCS). Hepsi aynı motora oturan tıklama yüzeyleri ("tek komut, iki yüzey"). Tümü **tıklanabilir prototip** (mock veri).

Stack: Vite + React 18 + TS · Tailwind + shadcn-tarzı token'lar · TanStack Router/Query/Table · Zustand · React Hook Form + Zod · cmdk · Lucide. **i18n: TR/EN** (topbar + ⌘K dışı her yerde dil değiştirici; `src/i18n/`).

Görsel dil tek kaynak: `../DESIGN_SYSTEM.md`. IA/ekran kararları: `../DESIGN_ROADMAP.md`.

## Modüller

- **Panel** (`/`) — birleşik dashboard: 3 modül kartı + bugünkü uçuşlar + son PNR'lar + son biletler.
- **QuickRes** (`/res`) — PNR ara, PNR detay (yolcular/segment/bilet linkage), **PNR oluştur** wizard (availability→sınıf→yolcu), availability sorgu. PNR → Troya bilet kesimine bağlanır.
- **Troya** (`/search`, `/issue`, `/tickets/:n`, `/orders`, `/messages`, `/agreements`) — FE-1…FE-7 biletleme (aşağıda).
- **QuickCheck-in** (`/checkin`) — uçuş listesi, yolcu kabul (koltuk haritası + bagaj), biniş kartı, boarding. Check-in ilgili Troya kuponunu **O→C** taşır (cross-modül linkage).
- **Yönetim** (`/admin/:section`) — Ayarlar (dil/istasyon), Kullanıcılar, denetim Logları.

## Çalıştırma

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + vite build
npm run typecheck
```

## Ne var (FE-0 → FE-7)

- **Bilet Kes** (`/issue`, FE-1) — 4 adımlı wizard (Yolcu → Segment → Fare/Ödeme → Onay), RHF+Zod inline validation, canlı bilet özeti, frontend idempotency key, optimistic UI yok.
- **Bilet Detay** (`/tickets/:tn`, FE-1/4/5) — kupon grid'i + **status pill** (§9.1), **ControlIndicator**, **lifecycle timeline** (exchange linkage), **fare/TFC** two-tone breakdown, FOP/FOID, **EMD bölümü**.
- **Bilet Ara** (`/search`, FE-2) — tek akıllı arama çubuğu (TKT no / PNR / yolcu / havalimanı, mod-7 check-digit) + TanStack Table grid.
- **Itinerary/Receipt** (`/itinerary/:tn`, FE-2) — yolcu çıktısı önizleme, **TR/EN**, Conditions of Contract + Mandatory Notices (App B), yazdır/PDF (print CSS).
- **Değişiklik akışları** (FE-3) — **Exchange/Reissue** & **Refund** sağ drawer, **Void** modal. "Ne olacak" özeti + geri-alınamaz onay (ConfirmDestructive), alttan dark toast, FSM guard + idempotency. Kısayollar: `e` / `r` / `v`.
- **EMD ekle** (FE-5) — EMD-A/EMD-S drawer, RFISC kataloğu, kupona bağlama.
- **Interline** (`/messages`, `/agreements`, FE-6) — mesaj log viewer (EDIFACT/NDC/ONE Order, açılır payload, filtre); bilateral anlaşma listesi.
- **Order** (`/orders`, `/orders/:id`, FE-7) — Order ana nesne; Ticket/EMD fulfillment olarak altında (ticket'a link).
- **Command palette** (`⌘K`) — fuzzy aksiyonlar + git + son açılan biletler.

## Mimari notlar

- `src/domain/` — tipler, `CouponStatus` → pill mapping (§9.1), mock data, mock API (TanStack Query). **İş kuralı yok** (CLAUDE.md §8: backend otorite). Tipler backend hazır olunca `openapi-typescript` ile **üretilecek**.
- `src/components/ui/` shadcn-tarzı primitive'ler · `src/components/domain/` domain bileşenleri (StatusBadge, Money, ControlIndicator, CouponTimeline, FareBreakdown).
- Token'lar hard-coded değil: `src/index.css` (CSS değişkenleri) + `tailwind.config.ts`.

## Sıradaki

Tüm Experience track'i (FE-0…FE-7) mock veriyle tamam. Sıradaki büyük adım **backend Engine Faz 0** (Kotlin + Spring Boot, event store, CouponStatus FSM) — Java 21 + Docker gerektirir. Mock API imzaları (`src/domain/api.ts`) gerçek REST ile aynı kalacak şekilde tasarlandı; backend gelince elle tipler `openapi-typescript` ile üretilenlerle, mock fetch'ler gerçek endpoint'lerle değişir. Auth (Keycloak/OIDC) ve SSE/WebSocket canlı güncelleme de backend hazır olunca eklenecek.
