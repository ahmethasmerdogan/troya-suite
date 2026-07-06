# contracts — Troya e-Ticketing API kontratı

`openapi.yaml` (OpenAPI 3.1.0) **tek doğruluk kaynağıdır** (CLAUDE.md kural 12).
Frontend ile backend arasındaki sözleşme buradadır; tip güvenliği uçtan uca
buradan zorlanır. Domain dili `docs/GLOSSARY.md`'ye sadıktır
(Ticket, Coupon, CouponStatus, Validating/Marketing/Operating Carrier, TFC, EMD,
PTA, IRROP/FIM, ONE Order).

## Neden tek kaynak

- **Backend (Kotlin/Spring) tarafı** bu spec'e göre controller'ları ve DTO'ları
  doğrular; ileride spec'ten server stub üretimi ya da contract testleri (Spring
  REST Docs / schema validation) bağlanabilir.
- **Frontend (Vite/React/TS) tarafı** tipleri elle yazmaz; bu dosyadan **üretir**.
- İki yüzey de aynı operasyon kümesine map olur ("tek komut, iki yüzey").

## TS tip üretimi (openapi-typescript)

Frontend kökünden:

```bash
# repo kökünden örnek
npx openapi-typescript contracts/openapi.yaml -o frontend/src/domain/generated.ts
```

Önerilen kullanım: üretilen `generated.ts`'ten `components["schemas"]["Ticket"]`,
`...["IssueTicketInput"]`, `...["CouponStatus"]` gibi tipleri türetip
`domain/types.ts`'in elle yazılmış karşılıklarının yerine koymak. Tip-güvenli bir
fetch istemcisi için `openapi-fetch` eklenebilir:

```bash
npm i openapi-fetch
npm i -D openapi-typescript
```

```ts
import createClient from "openapi-fetch";
import type { paths } from "./generated";

export const api = createClient<paths>({ baseUrl: "/api" });
// örn:  const { data } = await api.GET("/tickets");
```

## Mock api.ts → gerçek REST geçişi

Bugün `frontend/src/domain/api.ts` bellek-içi mock'tur (iş kuralı YOK — sunum
adaptörü, CLAUDE.md kural 8). **Fonksiyon imzaları bilerek bu spec ile aynıdır**,
böylece TanStack Query çağrıları ve bileşenler değişmeden kalır; sadece her
fonksiyonun gövdesi `fetch`/`openapi-fetch` çağrısına döner. Eşleme:

| Mock fonksiyon (`api.ts`)        | Operasyon (operationId)   | HTTP                                                  |
| -------------------------------- | ------------------------- | ---------------------------------------------------- |
| `listTickets`                    | `listTickets`             | `GET /tickets`                                        |
| `searchTickets`                  | `searchTickets`           | `GET /tickets/search?q=`                              |
| `getTicket`                      | `getTicket`               | `GET /tickets/{ticketNumber}`                         |
| `issueTicket`                    | `issueTicket`             | `POST /tickets`                                       |
| `exchangeTicket`                 | `exchangeTicket`          | `POST /tickets/{ticketNumber}/exchange`              |
| `refundTicket`                   | `refundTicket`            | `POST /tickets/{ticketNumber}/refund`                |
| `voidTicket`                     | `voidTicket`              | `POST /tickets/{ticketNumber}/void`                  |
| `endorseTicket`                  | `endorseTicket`           | `POST /tickets/{ticketNumber}/endorse`               |
| `irropReroute`                   | `irropReroute`            | `POST /tickets/{ticketNumber}/irrop`                 |
| `advanceCouponStatus`            | `advanceCouponStatus`     | `POST /tickets/{ticketNumber}/coupons/{seq}/status`  |
| `addEmd`                         | `addEmd`                  | `POST /tickets/{ticketNumber}/emds`                  |
| `listEmdsForTicket`              | `listEmds`                | `GET /emds?associatedTicket=` (veya `/tickets/{n}/emds`) |
| `getDashboardStats`              | `getDashboardStats`       | `GET /dashboard/stats`                               |
| `listMessages`                   | `listMessages`            | `GET /messages`                                      |
| `listAgreements`                 | `listAgreements`          | `GET /agreements`                                    |
| `listOrders`                     | `listOrders`              | `GET /orders`                                        |
| `getOrder`                       | `getOrder`                | `GET /orders/{orderId}`                              |
| `listPtas`                       | `listPtas`                | `GET /ptas`                                          |
| `createPta`                      | `createPta`               | `POST /ptas`                                         |
| `issueAgainstPta`                | `issueAgainstPta`         | `POST /ptas/{ptaReference}/issue`                    |
| `listRevenueAlerts`              | `listRevenueAlerts`       | `GET /revenue/alerts`                                |

### Idempotency

Para/statü değiştiren her komut (kural 5) bir `idempotencyKey` taşır. Mock'a sadık
kalmak için key **request body** alanıdır; spec'te aynı zamanda `Idempotency-Key`
header'ı da kabul edilir (standart uyumu). `newIdempotencyKey()` istemcide
korunur; backend "aynı key → aynı sonuç, yeni yan etki yok" garantisini verir.

### Hata modeli

`DomainError` (FSM ihlali, "void için tüm kuponlar O olmalı", "PTA open değil"
vb.) **RFC 7807 `ProblemDetails`** (`application/problem+json`) olarak döner;
genelde `422`. Makine-okur `code` ve geçiş hatalarında `from`/`to` alanları
gösterilir.

## Doğrulama

```bash
# Redocly (önerilen)
npx --yes @redocly/cli@latest lint contracts/openapi.yaml

# Alternatif
npx --yes @apidevtools/swagger-cli validate contracts/openapi.yaml

# En azından YAML sözdizimi
python3 -c "import yaml; yaml.safe_load(open('contracts/openapi.yaml'))"
```
