# Troya v2 — Görsel Yeniden Tasarım Brief'i

> Bu dosyayı `ThyTicketProject/` köküne kopyala ve Claude Code'a şunu yaz:
> **"`V2_REDESIGN_PROMPT.md` dosyasını oku ve Faz 0'dan başlayarak uygula."**

---

## Rolün

Troya (THY biletleme platformu) frontend'inin **görsel dilini** sıfırdan yeniden
kuruyorsun. Kaynak tasarım sistemi: **HashUI** (`~/Desktop/Projects/hash-ui`).

Bu bir **yeniden tasarım**, yeniden yazım değil. İş mantığı, algoritmalar, veri
akışı, rotalar ve metinler **birebir korunur**. Değişen tek şey: görünüm.

---

## 1. DOKUNULMAZ — bu dosyalara asla dokunma

| Yol | Neden |
| --- | --- |
| `frontend/src/domain/**` | Tüm iş mantığı: pricing, couponStatusMachine, seatRules, ticketNumber, flights, fx, checkin, api… 11 test dosyası var |
| `frontend/src/store/**` | Zustand state |
| `frontend/src/lib/**` | utils, usePerm, useDialog |
| `frontend/src/i18n/**` | **Tüm kullanıcı metinleri** — tek kelime değiştirme |
| `frontend/src/router.tsx` | 26 rota, path'ler, loader'lar, guard'lar |
| `frontend/e2e/**` | Test sözleşmesi — testi koda uydurma, kodu teste uydur |
| `**/*.test.ts(x)` | Aynı |
| `backend/**`, `contracts/**` | Kapsam dışı |

Bir sayfada mantık ile görünüm iç içeyse (`IssueWizard.tsx` 1034 satır):
`useState`/`useQuery`/`useMemo`/event handler'lar/hesaplamalar **aynen kalır**,
sadece `return (...)` içindeki JSX ve `className`'ler değişir.

---

## 2. KRİTİK RİSK — metin ve rol sözleşmesi

e2e testleri **görünen metne ve ARIA rolüne** bağlı. Projede **tek bir
`data-testid` yok**:

- `getByRole(...)` → 43 kullanım
- `getByText(...)` → 26 kullanım
- `getByPlaceholder(...)` → 12 kullanım

Örnek: `page.getByPlaceholder("TKT no · ERDOGAN · PNR · IST · TK198 · kart son4")`

**Kural:** Görünen metin, `placeholder`, `aria-label`, buton etiketi ve
semantik rol (`<button>` `<table>` `<nav>` `<dialog>`) **harfi harfine korunur.**
Bunları değiştirmek zorunda kalırsan **önce dur ve sor.**

`data-testid` **ekleme** — mevcut strateji bilinçli, e2e'yi kırma riski taşır.

---

## 3. Yeni tasarım dili — HashUI

### 3.1 Kurulum (Faz 0)

```bash
cd ~/Desktop/Projects/hash-ui
npm run export:ui -- ~/Desktop/Projects/ThyTicketProject/frontend/src/ui
```

`frontend/src/index.css` — mevcut Troya token'ları **kalır** (preset onlara
bağlanıyor), altına iki satır:

```css
@import "./ui/hashui.css";
@import "./ui/presets/thy.css";
```

Yeni npm paketi **gerekmiyor**: Tailwind v4.3, Geist, Geist Mono, three zaten
kurulu. HashUI React 18 ile derlenmiş olarak doğrulandı.

### 3.2 Marka kararı

`presets/thy.css` HashUI token'larını Troya'nınkilere bağlar →
**THY kırmızısı (`--accent`) ana renk olarak kalır.** HashUI'nın zümrüt yeşili
kullanılmaz. Kabuk (rail/topbar) THY kırmızı+beyaz kimliğini korur.

### 3.3 Değişmeyen kurallar (HashUI v0.4)

1. **Drop shadow yok.** Tüm `--sh-*` token'ları `none`. Derinlik
   `canvas › surface › elev › inset` katmanları + 1px hairline ile anlatılır.
   Mevcut `shadow-xs…xl` kullanımlarını kaldır.
2. **Tek buton anatomisi.** Dikey gradyan + aynı tonun 1px ring'i + üstte
   hairline highlight. `variant` yalnızca rengi değiştirir.
3. **Varsayılan tam yuvarlak** (`shape="pill"`). Kurumsal 10px isteyen yerde
   `shape="rect"`.
4. **Sans = Geist, mono = Geist Mono.** İstisnasız. Her sayı, saat, bilet no,
   para birimi ve kod **mono + tabular-nums**.
5. **Status'ler her zaman pill.**

### 3.4 Eski `DESIGN_SYSTEM.md` geçersiz

Mevcut `DESIGN_SYSTEM.md` v2 ("Enterprise Ops Console") **bu tasarımla
değiştiriliyor**. Oradaki "Don'ts" (gradient yasak, shadcn-first, spinner yasak)
artık bağlayıcı **değil** — HashUI'nın kuralları geçerli. `CLAUDE.md` satır 45'in
işaret ettiği görsel kaynak da bu yeni doküman olacak.

Bunu Faz 5'te yeniden yazacaksın; **o ana kadar eski dosyaya bakıp kafan
karışmasın.**

---

## 4. İsim çakışmaları

HashUI ve mevcut `components/ui/` şu 6 adı paylaşıyor:

`Alert · Button · Card · EmptyState · Modal · Skeleton`

Geçiş sırasında aynı dosyada ikisi birden gerekirse:

```tsx
import { Button as HButton, Card as HCard } from "@/ui";
```

Bir bileşenin geçişi bittiğinde eski dosyayı sil ve import'ları `@/ui`'ye çevir.
**Yarım bırakma** — her faz sonunda o katmanda tek bir kaynak kalsın.

---

## 5. Faz planı

Her fazın sonunda **kapıdan geç** (§6). Faz atlamak yok.

### Faz 0 — Temel
- `src/ui/` bundle'ını kopyala, iki `@import` satırını ekle
- Uygulama ayağa kalksın, tsc temiz olsun
- `main.tsx`'e `@fontsource-variable/geist-mono` import'unu ekle (geist zaten var)
- **Henüz hiçbir bileşeni değiştirme** — sadece altyapının çakışmadığını kanıtla

### Faz 1 — Primitifler (`components/ui/**`)
`button · input · label · select · card · alert · modal · drawer · toast ·
skeleton · empty-state · breadcrumb · search-bar · data-table · date-picker ·
decimal-input · info-tip · meta · charts · airport-combobox · detail-skeleton`

Her birini HashUI karşılığıyla değiştir veya HashUI diliyle yeniden yaz.
`data-table` özellikle önemli: HashUI'nın **hücre çerçeveli grid** desenini
kullan (`ui-design-4` referansı) — TanStack Table mantığı aynen kalır.

### Faz 2 — Kabuk (`components/layout/**`)
`AppShell · Rail · Sidebar · Topbar · MobileNav`

- Rail: THY kırmızı, beyaz aktif göstergesi (kimlik korunur)
- Sidebar aktif öğe: HashUI'nın **ink pill + öncü nokta** deseni
- Topbar: breadcrumb + ⌘K + kullanıcı çipi
- `CommandPalette.tsx` → HashUI'nın ⌘K palet dili (cmdk kalır)

### Faz 3 — Domain bileşenleri (`components/domain/**`, `components/flows/**`)
`StatusBadge → StatusPill` · `CouponTimeline → DeliveryTimeline/StageFlow` ·
`ControlIndicator` · `FareBreakdown` · `Money` (mono + two-tone) · `RouteCell` ·
`TicketCard` · `TtlBadge` · `ConfirmDestructive` · 8 drawer + `VoidModal`

`CouponTimeline` için HashUI'nın **`CommitGraph`**'ini değerlendir — kupon
yaşam döngüsü (event sourcing) için birebir uygun.

### Faz 4 — Sayfalar (`pages/**`)
Bu sırayla, her sayfadan sonra kapıdan geç:

1. `Login` → 2. `Panel` → 3. `TicketSearch` → 4. `TicketDetail` →
5. `IssueWizard` (en büyük, 1034 satır — dikkatli) → 6. `Orders`/`OrderDetail` →
7. `EmdSearch`/`EmdDetail` → 8. `checkin/**` → 9. `Itinerary`/`Agreements`/
`Messages`/`Chat`/`SalesReport`/`Admin`/`Guide`/`Docs` → 10. `quickres/**`,
`troya/**`

`ServiceMap.tsx` **kapsam dışı** — bilinçli olarak kendi scoped dark temasına
sahip, dokunma.

### Faz 5 — Doküman
- `DESIGN_SYSTEM.md`'yi yeni dile göre **yeniden yaz** (token tablosu, buton
  anatomisi, pill sözlüğü, tipografi, kapak kuralları)
- `CLAUDE.md`'ye proje geleneğine uygun **tarihli not** ekle
  (ne değişti / ne değişmedi / test sonuçları)

---

## 6. Kapı — her fazın sonunda

```bash
cd frontend
npx tsc -b --noEmit     # tip hatası: 0
npm test                # vitest: mevcut sayı, hepsi yeşil
npm run e2e             # playwright: mevcut sayı, hepsi yeşil
npm run build           # temiz
```

Ek olarak **görsel doğrulama**: değiştirdiğin ekranın **açık + koyu tema**
ekran görüntüsünü al ve kontrol et. (Proje geleneği bu; `npm run dev` → port
neyse Playwright ile screenshot.)

**Test sayısı düşerse veya bir e2e kırılırsa: devam etme, düzelt.**
Testi silmek/skiplemek/gevşetmek yasak.

---

## 7. Yasaklar

1. Yeni npm bağımlılığı ekleme (gereken her şey kurulu)
2. İş mantığı, hesaplama, validasyon, state akışı değiştirme
3. Kullanıcıya görünen metin / placeholder / aria-label değiştirme
4. Rota path'i, parametre adı veya navigasyon hedefi değiştirme
5. Test silme, `.skip`, `.only`, timeout artırma
6. `data-testid` ekleme
7. Drop shadow, neon, glow (HashUI kuralı)
8. İkinci bir accent rengi — THY kırmızısı tek fonksiyonel renk
9. Bir fazı bitirmeden diğerine geçme

---

## 8. Bittiğinde

- [ ] 26 rotanın hepsi açık + koyu temada doğru görünüyor
- [ ] tsc / vitest / e2e / build → hepsi yeşil, test sayısı düşmedi
- [ ] `components/ui/` içinde eski ve yeni dil karışık değil
- [ ] `domain/`, `store/`, `lib/`, `i18n/`, `router.tsx` git diff'i **boş**
- [ ] `DESIGN_SYSTEM.md` yeniden yazıldı
- [ ] `CLAUDE.md`'ye tarihli not eklendi

---

## 9. Takıldığında

- Bir ekranın yeni tasarımda nasıl görünmesi gerektiğinden emin değilsen:
  `~/Desktop/Projects/hash-ui` → `npm run dev` → canlı vitrin. 22 bölüm,
  her bileşenin Preview/Code sekmesi var.
- HashUI ↔ Troya eşlemesi: `hash-ui/INTEGRATION.md` (sonundaki Troya bölümü)
- Bir kural çatışırsa (örn. e2e metni ile yeni tasarım): **dur ve sor**,
  kendi kafana göre metni değiştirme.
