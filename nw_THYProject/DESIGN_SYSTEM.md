# DESIGN_SYSTEM.md — Troya v4 · HashUI × THY

> ## v4 REVİZYON (2026-08-03)
>
> v3 metni aşağıda **geçerliliğini koruyor**; bu blok onun üzerine gelen
> değişiklikleri tanımlar. Çelişki hâlinde bu blok bağlayıcıdır.
>
> **R1 · Köşe kuralı tersine döndü.** v3'ün "varsayılan tam yuvarlak" kuralı
> kaldırıldı. Kurumsal bir biletleme konsolunda yuvarlak butonlar tüketici
> uygulaması hissi veriyordu. **Tüm butonlar artık `shape="rect"`** (10px).
> `components/ui/core.tsx` içindeki `Button`, HashUI `Button`'ın ince bir
> adaptörüdür ve biçimi sabitler — 25 çağrı yeri tek anatomiyi paylaşır.
> Pill ve rozetler yuvarlak kalır (onlar etiket, aksiyon değil). Tek aksiyon
> istisnası: alan etiketindeki 16px **(i) açıklama noktası** — kare olduğunda
> nokta olmaktan çıkıyor.
>
> **R2 · Yeşil onay yüzü.** `variant="success"` eklendi: kabul/onay/tamamla
> aksiyonları (yolcu kabul, biniş, iadeyi tamamla, exchange onayı) yeşil yüz
> kullanır. Kırmızı yıkıcı, yeşil olumlu-kapanış, beyaz nötr, hayalet ikincil.
> **Not:** buton yüzleri `@layer` DIŞINDA tanımlanır — katmansız kural
> `@layer`'ı yener; içine alınırsa HashUI'nın kendi yüzü kazanır (yaşanmış bug).
>
> **R3 · Sol ray kaldırıldı, menü yukarı çıktı.** Kabuk artık **iki katlı
> topbar**: 1. kat marka + modül sekmeleri + ⌘K + hesap; 2. kat aktif modülün
> bölümleri (marka renginde alt çizgi göstergesi). Veri-yoğun ekranlarda yatay
> alan içeriğe gider.
>
> **R4 · Duyuru katmanı.** Kabuğun üstünde tek satırlık **duyuru şeridi**
> (`components/layout/Notices.tsx`) ve zilde gerçek bildirim akışı. Kaynak
> uydurma değil: operasyon uyarı motoru + gelir koruma + operasyon kanalının
> son mesajı. Aynı akış panoda "İstasyon duyuruları" kartını da besler.
>
> **R5 · Belge yüzeyleri.** Kayıt artık tablo satırı değil **belge** olarak da
> gösterilir: `TicketPreview` (TK bandı, büyük şehir kodları, perforasyonlu
> koçan, canlı kalkış geri sayımı), `BoardingPass` (ETKT işaretli biniş
> belgesi), `/emds/$n/receipt` (EMD makbuzu). Ortak dil: kırmızı marka bandı +
> kutulu alanlar + kesik çizgili koçan + deterministik barkod.
>
> **R6 · Yaşam döngüsü grafiği.** Kupon geçmişi `CommitGraph` ile çizilir:
> ana hat bilet olayları, dal kupon olayları, kırmızı dal olumsuz event,
> içi boş düğüm sürüyor / dolu düğüm sonlandı. Düğüm rengi statü ton
> sözlüğünden gelir (§2 ile aynı kaynak).
>
> **R7 · Para ekranlarında gerekçe zorunlu.** İade ve değişiklik ekranlarında
> her tutarın yanında **hangi kuralın** onu ürettiği yazar (handbook maddesi
> ya da tarife kuralı). Sistem hesabı üstte, personelin elle girdiği değer
> altta ve sapma varsa uyarı tonunda. Tutar kutusu tek başına asla yeterli
> değildir.
>
> **R8 · Tablo.** Hücre-çerçeveli grid korunur; üzerine yapışkan başlık,
> satır başında statü ton çubuğu, satır-üstü aksiyonlar, kolon görünürlüğü,
> `tfoot` özet satırı, yoğunluk anahtarı ve CSV çıkışı eklendi.


> **Bu doküman v2 "Enterprise Ops Console" tasarım sistemini tamamen değiştirir.**
> v2'nin "Don'ts" listesi (gradyan yasak, shadcn-first, tek fonksiyonel renk)
> artık bağlayıcı değildir. Görsel kararların tek doğruluk kaynağı burasıdır.
>
> Kaynak tasarım sistemi: **HashUI v0.4** (`frontend/src/ui/`) — 36 kürate edilmiş
> arayüz referansından damıtılmış taşınabilir paket. THY köprüsü:
> `frontend/src/ui/presets/thy.css`.
>
> **Değişmeyen:** iş mantığı, algoritmalar, rotalar, i18n metinleri, e2e sözleşmesi.
> Bu doküman yalnızca **görünümü** tanımlar.

---

## 0. Dört kural

Bir karar bu dördüyle çelişiyorsa karar yanlıştır.

1. **Gölge yok.** Tüm `--shadow-*` token'ları `none`. Derinlik
   `canvas › surface › elev › inset` yüzey rampası + **1px kıl çizgi** ile
   anlatılır. İstisna: buton yüzündeki *inset* üst highlight (gölge değil, ışık).
2. **Tek buton anatomisi.** Dikey gradyan + aynı tonun 1px ring'i + üstte
   hairline highlight (`.btn-face`). `variant` yalnızca **rengi** değiştirir.
3. **Varsayılan tam yuvarlak.** Buton, nav öğesi, pill, arama çubuğu → `rounded-full`.
   Kurumsal köşe gereken yerde `shape="rect"` (10px).
4. **Sans = Geist, mono = Geist Mono.** İstisnasız. **Her sayı, saat, bilet no,
   para birimi, havalimanı kodu ve statü kodu mono + `tabular-nums`.**

---

## 1. Renk mimarisi

Üç ayrı iş yapan üç renk katmanı vardır. Karıştırılmazlar.

| Katman | Ne anlatır | Renk |
| --- | --- | --- |
| **Yüzey** | Derinlik / hiyerarşi | sıcak nötr gri rampa |
| **Marka** | Aksiyon, aktif konum, kimlik | **THY kırmızısı** — tek marka rengi |
| **Statü** | Kupon / uçuş / işlem durumu | 8 ton ailesi |

> **Kritik ayrım:** *statü rengi ≠ marka rengi.* v2'de tek accent kuralı yüzünden
> 17 kupon statüsü kırmızı rampaya sıkışıyordu ve yoğun tabloda ayırt edilemiyordu.
> v3'te kırmızı **yalnız aksiyona ve aktif konuma** ayrılmıştır.

### 1.1 Yüzey rampası

| Token | Light | Dark | Kullanım |
| --- | --- | --- | --- |
| `--bg-page` | `#f4f4f2` | `#0e0e11` | canvas — sayfa zemini |
| `--bg-surface` | `#ffffff` | `#17171a` | kart, panel, kabuk |
| `--bg-surface-alt` | `#f7f7f5` | `#1e1e22` | elev — tablo başlığı, kart içi bölüm |
| `--bg-sunken` | `#f1f1ef` | `#131316` | inset — gömülü panel, chip zemini |

### 1.2 Kıl çizgi — yapıyı bu taşır

| Token | Light | Dark | Kullanım |
| --- | --- | --- | --- |
| `--border-subtle` | `#edece8` | `rgba(255,255,255,.07)` | hücre içi ayraç (tablo dikey çizgileri) |
| `--border-default` | `#e6e5e1` | `rgba(255,255,255,.10)` | **varsayılan** — kart, panel, kabuk kenarı |
| `--border-strong` | `#d5d4cf` | `rgba(255,255,255,.18)` | **etkileşimli** — input, select, arama |

Kural: bir yüzey kenarı `--border-default`, bir **alan** kenarı `--border-strong`.
Böylece tıklanabilir olan, olmayandan çizgi ağırlığıyla ayrışır.

### 1.3 Marka

| Token | Light | Dark |
| --- | --- | --- |
| `--accent` | `#c70a0c` | `#f1494b` |
| `--accent-hover` | `#ab0709` | `#ff6062` |
| `--accent-pressed` | `#8f0507` | `#d92f31` |
| `--accent-soft` | `#fbebe9` | `rgba(241,73,75,.14)` |
| `--accent-ring` | `rgba(199,10,12,.16)` | `rgba(241,73,75,.24)` |

Kırmızının izinli olduğu yerler: birincil buton · aktif nav pill'i ve öncü noktası ·
marka roundel'i · odak halkası · link · giriş ekranı marka paneli · `V (Void)` pill'i.
**Başka hiçbir yerde dolu kırmızı yüzey yoktur.**

### 1.4 Statü tonları

Her ton `bg / text / dot` üçlüsü taşır: `--tone-<ad>-bg|text|dot`.

| Ton | Light text | Dot |
| --- | --- | --- |
| `green` | `#047857` | `#10b981` |
| `blue` | `#1d4ed8` | `#3b82f6` |
| `orange` | `#c2410c` | `#f97316` |
| `amber` | `#b45309` | `#f59e0b` |
| `violet` | `#6d28d9` | `#8b5cf6` |
| `pink` | `#be185d` | `#ec4899` |
| `red` | `#b91c1c` | `#ef4444` |
| `gray` | `#6b6862` | `#a3a099` |

Eski beşli semantik adlar (`--success-*`, `--warning-*`, `--danger-*`, `--info-*`,
`--neutral-*`) hâlâ tanımlıdır ama artık **bu tonlara bağlıdır** — yeni kodda
doğrudan `--tone-*` kullan.

---

## 2. Statü sözlüğü — 17 kod, 8 aile

Kaynak: `frontend/src/components/domain/statusTone.ts`.
Bu bir **sunum** kararıdır; bu yüzden `domain/`de değil sunum katmanındadır.
`domain/couponStatus.ts` (etiket, final bayrağı, FSM) **dokunulmamıştır.**

| Ton | Aile | Kodlar |
| --- | --- | --- |
| 🟢 green | kullanılabilir & uçuldu | `O` Open · `F` Flown ✓ |
| 🔵 blue | havalimanı & DCS akışı | `A` Airport Ctrl · `C` Checked-In · `L` Lifted |
| 🟠 orange | düzensiz operasyon | `I` IRROP |
| 🟡 amber | beklemede / kısıtlı | `S` Suspended · `U` Unavailable · `Y` Refund TFC |
| 🟣 violet | değişim / reissue | `E` Exchanged · `G` Exch (FIM) |
| 🩷 pink | iade | `R` Refunded |
| 🔴 red | iptal | `V` Void |
| ⚪ gray | belge & kapanış | `N` · `P` Printed · `X` · `Z` Closed |

**Renk aileyi anlatır, etiket kimliği anlatır.** `O` ile `F` aynı yeşil ailededir;
"Open" ve "Flown ✓" etiketleri ayırır. Aile içinde ayrım gereken yerde
(donut, timeline noktası) `STATUS_TONE[x].hex` açık→koyu adımı kullanılır.

Final statüler kilit ikonu (🔒) taşır; `F` ise ✓ taşır — ikonlar renkten bağımsız
ikinci bir sinyaldir (renk körlüğü güvencesi).

---

## 3. Tipografi

| Rol | Boyut / ağırlık | Not |
| --- | --- | --- |
| Sayfa başlığı (`PageHeader`, `h1`) | 26px / 600, `tracking-[-0.02em]` | accent şerit **yok** |
| Kart başlığı | 18px / 600 | |
| Gövde | 14px / 400 | `body` varsayılanı |
| İkincil | 13px / 400, `--text-secondary` | |
| **microlabel** | 10.5px / 600, `letter-spacing .09em`, UPPERCASE, `--text-tertiary` | `.microlabel` sınıfı — tablo başlığı, grup başlığı, `Meta` etiketi, KPI etiketi |
| Veri (mono) | `font-mono` + `tabular-nums` | bilet no, tutar, saat, kod, sayaç |

**Two-tone tutar** (`.amount`): tam kısım `--text-primary` 600, ondalık + para
birimi `--text-tertiary` 400. Artık mono ailededir.

---

## 4. Bileşen anatomileri

### 4.1 Buton — `components/ui/button.tsx`

Tek reçete: `.btn-face` (dikey gradyan + 1px ring + inset üst highlight).

| variant | Yüz | Kullanım |
| --- | --- | --- |
| `primary` | `.btn-green` → THY kırmızısı gradyanı | sayfanın tek birincil aksiyonu |
| `secondary` | `.btn-white` → surface›elev gradyanı + kıl çizgi ring | araç çubuğu, ikincil |
| `ghost` | şeffaf, hover'da `--bg-sunken` | ikon butonları, menü satırları |
| `danger` | `.btn-danger` | yalnız yıkıcı onay (void, sil) |

Boyut: `sm` 32px · `md` 36px · `lg` 44px · `icon` 36×36.
Biçim: `shape="pill"` (varsayılan) · `shape="rect"` 10px.
Odak: 3px `--accent-ring`. Basılı: `scale(.985)`.

### 4.2 Kart — `components/ui/card.tsx`

`bg-surface` + `border-[var(--border-default)]` + `rounded-lg` (16px). Gölge yok.
Kart içi gömülü bölüm için `InsetPanel` (elev, çizgisiz, 12px).

### 4.3 Alan (input / select / decimal / date)

36px yükseklik · `rounded-[10px]` · `border-strong` · odakta accent kenar +
3px `--accent-ring`. Hatada `--tone-red-dot` kenarı.
`DecimalInput` **her zaman mono**; placeholder sans kalır.

### 4.4 Tablo — `components/ui/data-table.tsx`

HashUI **hücre-çerçeveli grid** deseni (`ui-design-4`):

- Dış: `rounded-lg` + `border-default`, `overflow-hidden`
- Başlık: `bg-surface-alt`, `.microlabel` metrikleri, altta `border-default`
- **Her hücrede** sağda `border-subtle` dikey kıl çizgi (`last:border-r-0`)
- Satır ayracı `border-subtle`; hover `bg-surface-alt`; seçili `bg-accent-soft`
- Alt bilgi şeridi `bg-surface-alt` + üstte `border-default`
- TanStack Table mantığı (sıralama, filtre, kolon gizleme, CSV, sayfalama)
  **değişmemiştir.**

### 4.5 Statü pill — `.pill` + `.pill--<ton>`

24px yükseklik · tam yuvarlak · soft tint zemin · ton metni · 6px öncü nokta.
**Kenarlık ve gölge yok.** `StatusBadge` bunu `statusTone.ts` üzerinden kurar.

### 4.6 Katmanlar (modal / drawer / palet / popover)

Backdrop `rgba(28,27,24,.45)` + `blur(3px)` (dark: `black/60`).
Panel: `bg-surface` + `border-default`, **gölge yok**, köşe 16–20px.
Popover/menü: 14–16px köşe, `border-default`, 10px iç satır köşesi.
`role="dialog"` + `aria-label` **korunur** (e2e sözleşmesi).

### 4.7 Geri bildirim

- **Toast:** alttan ortada, `bg-surface` + `border-default` + ton ikonu, 16px köşe.
- **Alert:** ton tint zemini + `color-mix` ile %28 ton kenarı, 14px köşe, sol şerit yok.
- **Skeleton:** `inset › line › inset` gradyanı `hashui-shimmer` ile akar. **Spinner yok.**
- **EmptyState:** kıl çizgili squircle ikon karosu + başlık + ipucu.

---

## 5. Kabuk

```
┌────┬───────────────┬──────────────────────────────┐
│rail│  topbar (h-14, breadcrumb + ⌘K + hesap)      │
│w-16├───────────────┼──────────────────────────────┤
│    │ sidebar w-60  │  main (max-w-content)        │
└────┴───────────────┴──────────────────────────────┘
```

- **Rail** — `bg-surface`, sağda `border-default`. Marka: dolu kırmızı roundel.
  Aktif modül: `bg-accent-soft` yuvarlak + sol kenarda 3px kırmızı çubuk.
- **Topbar** — `bg-surface`, altta `border-default`. Solda breadcrumb
  (modül karosu › modül › alt bağlam), ortada-sağda ⌘K pill'i, sağda dil /
  bildirim / kullanıcı çipi (kırmızı avatar).
- **Sidebar** — `bg-surface`, sağda `border-default`. Üstte modülün birincil
  CTA'sı (`.btn-face btn-green` pill) + ⌘K kutusu. Gruplar `.microlabel` +
  collapsible. **Aktif öğe: `bg-accent-soft` pill + sol öncü nokta + kırmızı ikon.**
- **Panel modülünde sidebar render edilmez** (tam genişlik dashboard).

Kabuk artık **nötrdür**. `--shell-*` token'ları yüzey rampasını izler; dolu THY
kırmızısı yalnız **giriş ekranının marka panelinde** kalmıştır.

---

## 6. Giriş ekranı

Uygulamanın tek dolu marka yüzeyi. Sol panel:
`linear-gradient(155deg, #d21214, #a30709 46%, #5e0305)` + 34px blueprint ızgarası
(`rgba(255,255,255,.055)` çizgiler) — hepsi **tek** `background-image` katmanında.

> Tuzak: `.blueprint` yardımcı sınıfı `background-size: 26px` sabitler; gradyanla
> birlikte kullanılırsa gradyanı da döşer (yorgan efekti). Izgara + gradyan aynı
> `background-image` listesinde, `background-size: "34px 34px, 34px 34px, cover"` ile verilir.

Sağ panel nötr canvas üzerinde 20px köşeli form kartı + hızlı giriş kartları.

---

## 7. Hareket

`cubic-bezier(0.16, 1, 0.3, 1)`, 150–280ms. Sayfa geçişi `.page-in`, liste
girişi `.list-in` (kademeli), drawer/modal kendi keyframe'leri.
`prefers-reduced-motion` global olarak tüm süreleri sıfırlar.
**Neon, glow, parlama efekti yok** (yazıcı LED'i düz noktaya indirildi).

---

## 8. Yasaklar

1. `shadow-*` sınıfı eklemek (token'lar `none`; arbitrary drop shadow da yasak).
2. Neon / glow / dış parıltı.
3. Statü için marka kırmızısını kullanmak (`V` dışında) veya aksiyon için statü
   tonunu kullanmak.
4. `mono` yerine sans ile sayı dizmek.
5. Görünen metin, `placeholder`, `aria-label`, buton etiketi veya semantik rol
   değiştirmek — **e2e sözleşmesi**, `data-testid` yok.
6. `domain/`, `store/`, `lib/`, `i18n/`, `router.tsx` içine görsel karar sızdırmak.
7. `pages/ServiceMap.tsx`'e dokunmak — bilinçli olarak kendi scoped dark temasına
   sahiptir, bu sistemin dışındadır.

---

## 9. Nerede ne var

| Ne | Nerede |
| --- | --- |
| Token'lar, `.pill`, `.microlabel`, `.amount`, keyframe'ler | `frontend/src/index.css` |
| HashUI paketi (bileşen + `hashui.css` + ikonlar) | `frontend/src/ui/` |
| THY köprüsü (HashUI adları → Troya token'ları) | `frontend/src/ui/presets/thy.css` |
| Tailwind renk/font/köşe eşlemesi | `frontend/tailwind.config.ts` |
| Statü → ton sözlüğü | `frontend/src/components/domain/statusTone.ts` |
| Görsel doğrulama araçları | `frontend/scripts/v2shot.mjs`, `v2sweep.mjs` |
