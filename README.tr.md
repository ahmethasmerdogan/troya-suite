<div align="center">

# 🎫 Troya Suite

**IATA Ticketing Handbook'tan türetilen, modern ve event-sourced bir elektronik biletleme platformu.**

[![Kotlin](https://img.shields.io/badge/Kotlin-7F52FF?style=flat-square&logo=kotlin&logoColor=white)](https://kotlinlang.org/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-6DB33F?style=flat-square&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)

[English](README.md) · **Türkçe**

</div>

---

## Genel bakış

Troya Suite, full-stack bir **PSS (Passenger Service System) elektronik biletleme** platformudur. Bir PSS'in elektronik biletleme bounded context'ini uygular: elektronik bilet (ET) ve EMD kesimi, **kupon yaşam döngüsü** yönetimi, ET kaydının tam audit'i, arama & görüntüleme, exchange / reissue / refund / void ve interline mesajlaşma. Eski biletleme sistemlerinin kriptik komut-satırı terminalinin yerine **tıklama-tabanlı bir React arayüzü** koyar — motoru ise komut-tabanlı tutar.

Proje tek bir ilke etrafında kurgulanır — **"tek komut, iki yüzey"**: bir aksiyon ister terminal komutundan ister React tıklamasından gelsin, *aynı* backend komutuna map olur. İş kuralları motorda yaşar; arayüz bir sunum adaptörüdür. Para işlemleri sunucu sonucunu bekler (optimistic UI yok).

İki track:

- **Engine (backend)** — biletleme motoru ve iş kuralları.
- **Experience (frontend)** — operasyon arayüzü.

> **Kapsam.** Troya Suite bir PSS'in *elektronik biletleme* modülünü uygular. Komşu sistemler — inventory, availability, shopping, pricing engine, PNR, DCS, loyalty, revenue accounting — bilinçli olarak kapsam dışıdır ve port arkasında mock olarak durur. Fiyat *tüketilir*, hesaplanmaz.

## Öne çıkanlar

**Domain & mimari**

- **Event Sourcing** — state, append-only ve değişmez bir event akışından türetilir; tam audit trail domainin tanımıdır, sonradan eklenen bir özellik değil.
- **CQRS** — yazma (komut → aggregate → event) ve okuma (projekte edilmiş read model) ayrıdır.
- **Coupon Status sonlu durum makinesi (FSM)** — IATA kupon statü göstergeleri (interim ve final/terminal) explicit bir FSM ile modellenir; izin verilmeyen geçiş exception fırlatır, asla sessizce başarısız olmaz.
- **Control authority / lease** — IATA "Concept of Control", TTL'li kiralamaya sahip tek-yazar (single-writer) sahipliği olarak modellenir.
- **Idempotency & outbox** — para/statü değiştiren her komut bir idempotency key taşır (çift-issue / çift-refund yok); DB commit ve mesaj yayını outbox ile atomiktir.
- **Hexagonal katmanlama** — saf bir domain modülü + tüm dış sistemler için port & adapter (bağımlılıklar daima içeri bakar).

**Ürün yüzeyi (frontend)**

Üstte modül seçici bulunan, bir havayolu PSS operasyon modelini yansıtan tek bir birleşik çalışma alanı:

- **QuickRes** — rezervasyon (PNR): arama, detay, PNR oluşturma sihirbazı, sefer programından uygunluk, PNR komutları (güzergâh / segment iptali, TTL uzatma, notlar, geçmiş), PNR'dan doğrudan yolcu başına bilet.
- **Troya** — biletleme: sistem ücret tarifesiyle (elle ücret yazılmaz) 5 adımlı kesim sihirbazı ve grup/aile kesimi, bilet detayı (statü pill'leri, control göstergesi, yaşam döngüsü timeline'ı, fare / TFC / KDV dökümü), akıllı arama, itinerary/receipt (TR/EN, yazdırılabilir), ceza ve vergi iade edilebilirliği kurallarıyla exchange / refund / void, EMD, PTA, ADM/ACM, interline mesajları ve anlaşmaları, order'lar, iş kuyrukları, tarife değişikliği, yolcu hakları tazminatı ve rapor merkezi (satış, mali, dönem kapanışı).
- **QuickCheck-in** — kalkış kontrolü (DCS): uçuşlar arası yolcu aramalı kontuar ekranı, süpervizör onaylı geç kabullü kabul penceresi, seyahat belgesi ve APIS kontrolleri, koltuk uygunluk kurallı uçak tipine özgü koltuk haritaları, biniş, uçuş kapanışı (kuponlar Flown'a) ve HUB kontrol panosu.
- **Panel**, **Yönetim** & **Mesajlaşma** — istasyon duyurulu dashboard; kullanıcılar, roller & yetkiler, denetim kaydı; bilet iliştirilebilen gerçek zamanlı personel sohbeti.
- **İki dilli (TR/EN)**, rol-tabanlı erişim (kümülatif roller), komut paleti (⌘K), klavye kısayolları, ekran turları ve bağlamsal ipuçları.

## Teknoloji yığını

**Engine (backend)** — Kotlin · Spring Boot 3 (Java 21) · Gradle (Kotlin DSL) çok-modüllü (`domain` · `application` · `infrastructure` · `api`) · PostgreSQL 16 (event store + read model'ler, Flyway) · Redis (control lease) · Kafka / Redpanda (outbox) · Keycloak (OIDC) · Kotest + JUnit 5 · ktlint + detekt · OpenTelemetry.

**Experience (frontend)** — Vite · React 18 · TypeScript · Tailwind CSS + shadcn-tarzı token'lar · TanStack Router / Query / Table · Zustand · React Hook Form + Zod · cmdk · Lucide · HashUI bileşen kiti · Vitest + Playwright.

**Contracts** — bir OpenAPI 3.1 spec hedef REST API'yi tanımlar. Frontend prototipi hâlâ bellek-içi mock domain üzerinde, spec'e göre elle yazılmış tiplerle çalışır; arayüz canlı motora bağlandığında tipler spec'ten üretilecek (`openapi-typescript`). Motorun bugün neyi uyguladığı [`contracts/README.md`](contracts/README.md) içinde.

**Yerel altyapı & CI** — Docker Compose (PostgreSQL · Redpanda · Redis · Keycloak); GitHub Actions (backend: build + ktlint + detekt · frontend v1 ve v2: typecheck + test + build). Vercel `main`'i canlıya, diğer dalları önizleme adresine yayınlar.

## Depo yapısı

```
troya-suite/
├── backend/        Kotlin çok-modüllü motor: domain · application · infrastructure · api
├── nw_THYProject/  Güncel frontend (v2): nw_THYProject/frontend — Vite + React + TypeScript birleşik panel, Vercel'de yayında
├── frontend/       Önceki frontend (v1), referans olarak duruyor
├── contracts/      OpenAPI 3.1 spec (hedef REST API)
├── vercel.json     Vercel derleme ayarı (nw_THYProject/frontend'i derler)
├── docker-compose.yml       Yerel geliştirme altyapısı (Postgres · Redpanda · Redis · Keycloak)
├── ARCHITECTURE.md          Mimari kararlar & gerekçe
├── GLOSSARY.md              Ortak dil (IATA + mühendislik terimleri)
├── DESIGN_ROADMAP.md        Arayüz / IA tasarımı
├── DESIGN_SYSTEM.md         Görsel tasarım dili
├── SYSTEM_GUIDE.md          Kullanıcı kılavuzu
├── TROYA_ETICKET_ROADMAP.md Tam teslim yol haritası
└── CLAUDE.md                Mühendislik çalışma kuralları
```

## Başlangıç

**Frontend** — mock veriyle çalışan tıklanabilir prototip:

```bash
cd nw_THYProject/frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc + vite build
npm run test       # Vitest (birim + bileşen)
npm run e2e        # Playwright (uçtan uca)
```

**Backend** — Kotlin motoru:

```bash
# Yerel altyapı (Postgres · Redpanda · Redis · Keycloak):
docker compose up -d

cd backend
./gradlew build            # derleme + test + ktlint + detekt
./gradlew :api:bootRun     # API'yi başlat
```

Klasik Gradle akışı için host'ta Java 21 gerekir; tamamen Docker-tabanlı bir build/test/çalıştırma akışı (host'ta Java gerekmez) [`backend/README.md`](backend/README.md) içinde belgelenmiştir.

**Yayın** — Vercel projesi bu depoya bağlıdır. `main`'e her push canlıya çıkar, diğer dallar önizleme adresi alır. Kökteki [`vercel.json`](vercel.json) `nw_THYProject/frontend`'i derler; Root Directory ayarı gerekmez.

## Durum

Aktif geliştirilen, **özel / kurum içi** bir proje. Dürüst bir anlık görüntü:

- **Experience (frontend)** — birleşik panel (v2, `nw_THYProject/frontend`: QuickRes + Troya + QuickCheck-in + Panel + Yönetim + Mesajlaşma), TR/EN olarak **mock veriyle uçtan uca çalışan, Vercel'de yayında tıklanabilir bir prototip**; typecheck, birim testleri, uçtan uca testler ve build yeşil. API çağrı imzaları gerçek REST kontratına uyacak şekilde tasarlandı; böylece arayüzü yeniden şekillendirmeden canlı endpoint'lerle değiştirilebilir.
- **Engine (backend)** — Docker'da uçtan uca doğrulandı: **F0 temel**, **F1 bilet + kupon** (issue / get / idempotency / event store) ve **F2 arama + receipt** (CQRS read model + projeksiyon) tamamlandı; **F3 void/exchange/refund**, **F4 fare/TFC**, **F5 EMD** ve **F6 interline** çekirdek komutları uygulanıp doğrulandı, ileri parçalar (IRROP/FIM saga, ROE/banker's yuvarlama, vMPD/legacy eşleme, EDIFACT/NDC gateway) hâlâ açık. **F7 order-native** planlanıyor.

Canlı kimlik doğrulama (Keycloak/OIDC) ve SSE/WebSocket canlı güncellemeler, backend **Order-native (ONE Order)** geleceğine ilerledikçe eklenir.

## Dokümantasyon

| Doküman | Ne için |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Mimari kararlar & gerekçe — bounded context, ES/CQRS, FSM, control authority, idempotency/outbox. |
| [`GLOSSARY.md`](GLOSSARY.md) | Ortak dil — IATA + mühendislik terimleri. |
| [`DESIGN_ROADMAP.md`](DESIGN_ROADMAP.md) | Arayüz tasarımı — IA, navigasyon, ekran-ekran. |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Görsel tasarım dili — tek doğruluk kaynağı. |
| [`SYSTEM_GUIDE.md`](SYSTEM_GUIDE.md) | Kullanıcı kılavuzu — modüller, roller, iş akışları. |
| [`TROYA_ETICKET_ROADMAP.md`](TROYA_ETICKET_ROADMAP.md) | Tam teslim yol haritası (Engine F0–F7, Experience FE-0…FE-7). |
| [`contracts/openapi.yaml`](contracts/openapi.yaml) | REST API kontratı (OpenAPI 3.1). |

---

<div align="center">

[Claude Code](https://claude.com/claude-code) ile geliştirildi.

</div>
