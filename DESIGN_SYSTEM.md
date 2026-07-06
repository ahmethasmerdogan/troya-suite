# Troya — Design System (DESIGN_SYSTEM.md)

> **Bu dosya tasarımın tek kaynak gerçeğidir (single source of truth).** Her UI kararı buradan gelir; sapma yok. shadcn/ui bileşenleri kurulduktan sonra bu token'larla **override** edilir.
>
> **Köken:** Bu tasarım dili senin daha önce **CRM + ERP** projende hazırladığın `DESIGN_LANGUAGE.md`'den alındı ve Troya biletleme domaine uyarlandı. Estetik: **fintech-grade minimalizm** — Linear / Vercel / Stripe Dashboard / Mercury Bank ekolü. O projeye özel mimari (Laravel/Breeze/multi-tenancy) **alınmadı**; sadece görsel tasarım dili taşındı.
>
> **Stack:** Vite + React + TypeScript · Tailwind · shadcn/ui · Lucide · cmdk (CRM+ERP'deki Next/Laravel değil — token'lar stack-agnostik).

---

## 0. Hard Rules (istisnasız)

1. **Beyaz boşluk lüks gibi davranılır.** Component'ler yapışmaz. Card iç padding min `24px`, genelde `32px`. (Agent ekranları yoğun ama nefes alır.)
2. **Tek primary accent:** `#2563EB` (blue). Renk patlaması yasak. Diğer renkler **yalnızca status semantics** için.
3. **Gri border'lar görünür-görünmez sınırında:** `1px solid #E0E2E6` veya daha açık. Asla koyu border (`#C4C7CD`'den koyu) kullanma.
4. **Gölgeler ultra-subtle.** Card'lar default'ta **gölgesiz, sadece border**. Minimal gölge yalnızca hover/modal/dropdown.
5. **Hiyerarşi font weight ile değil, `size + color` ile.** Bold çoğu yerde gereksiz.
6. **Status badge'leri her zaman pill** (soft tinted bg + matching text + opsiyonel dot).
7. **Sidebar section'lara bölünür** — tiny UPPERCASE label'larla.
8. **Dark UI element'leri tam siyah değil** — `#0F1012` / `#1C1D21`, üstte beyaz text. Yalnızca toast/tooltip/popover/contextual için.
9. **Loading = skeleton, asla spinner.**
10. **İkon stroke `1.75`** (Lucide default 2 değil). Renk = text rengiyle aynı.
11. **Sayılar "big-number two-tone":** tam sayı koyu, ondalık + birim açık gri. (Bizde **fare/TFC/total** gösterimi — imza detay.)

> **Component üretme sırası:** (1) shadcn'de var mı → varsa al, bu dosyaya göre style et. (2) Yoksa §8 spec'lerinden inşa et. (3) Asla kafadan renk/spacing/radius uydurma.

---

## 1. Renk token'ları

CRM+ERP design language'ından birebir alınan palet:

```css
:root {
  /* === Surfaces === */
  --bg-page:           #F4F5F7;  /* sayfa zemini, çok açık cool gray */
  --bg-surface:        #FFFFFF;  /* card, modal, panel */
  --bg-surface-alt:    #FAFAFB;  /* card içi nested section, tablo header şeridi */
  --bg-sunken:         #F0F1F3;  /* input alanı, card içi callout */

  /* === Inverse / Dark (toast, tooltip, popover) === */
  --bg-inverse:        #0F1012;  /* near-black, hafif sıcak */
  --bg-inverse-alt:    #1C1D21;
  --text-on-inverse:   #FFFFFF;
  --text-on-inverse-2: #A8AAB0;

  /* === Text === */
  --text-primary:      #0A0B0D;  /* near-black; body + sayı tam kısmı */
  --text-secondary:    #5C6068;  /* label, tablo header, alt başlık */
  --text-tertiary:     #9CA0A8;  /* ondalık, currency code, helper */
  --text-disabled:     #C4C7CD;

  /* === Borders === */
  --border-subtle:     #ECEDEF;  /* card çizgisi, tablo satır ayıracı */
  --border-default:    #E0E2E6;  /* input, button outline */
  --border-strong:     #C4C7CD;  /* input hover/focus */

  /* === Accent (TEK primary) === */
  --accent:            #2563EB;  /* primary CTA, aktif nav, link, chart, focus, progress */
  --accent-hover:      #1D4FD8;
  --accent-pressed:    #1A45BF;
  --accent-soft:       #E8EEFD;  /* seçili satır bg, link hover bg */
  --accent-text-on:    #FFFFFF;

  /* === Semantic — Status Pills (soft variants) === */
  --success-bg: #E6F6EC;  --success-text: #117A3D;  --success-dot: #16A34A;
  --warning-bg: #FEF3C7;  --warning-text: #92590B;  --warning-dot: #D97706;
  --danger-bg:  #FCE8E8;  --danger-text:  #B42318;  --danger-dot:  #DC2626;
  --info-bg:    #E8EEFD;  --info-text:    #1D4FD8;   --info-dot:    #2563EB;
  --neutral-bg: #F0F1F3;  --neutral-text: #5C6068;
}
```

**Renk hard rules:**
- Mavi `--accent` **yalnızca**: primary CTA, aktif nav indicator, chart stroke, link text, focus'lu input border, progress fill. **Asla card background, asla section accent şeridi.**
- Status pill'ler **asla satüre bg kullanmaz** — sadece soft variant.
- `--bg-inverse` **yalnızca** toast/tooltip/popover/contextual notification/chart hover label. Asla hero/marketing.

> **✓ KARAR — accent = mavi `#2563EB` (sabit).** Gerekçe: (1) CRM+ERP design dili bunun üzerine kurulu, sadık kalıyoruz; (2) THY kırmızısı zaten **danger** semantik rengi (`#DC2626`/`#B42318`) — primary accent yapılırsa CTA'lar hata gibi görünür, çakışır; (3) navy (`#063048`) bir accent olamayacak kadar koyu (focus ring, link, chart stroke satürasyon ister). **THY kimliği** logo lockup ile gelir; istenirse **yapısal navy** (sidebar/header) opsiyonel bir tema toggle'ı olarak eklenebilir, ama **fonksiyonel accent mavi kalır** — tek kısıtlı accent ilkesi korunur.
>
> **⟳ OVERRIDE (2026-06-14, kullanıcı talebi): accent = THY kırmızısı `#E81932`.** Marka kimliği önceliklendirildi. Primary CTA / aktif nav / link / focus / KPI ikonları artık THY kırmızısı. Çakışma yönetimi: (a) **coupon status / semantic renkler korundu** — `info` mavi (`O/A/C/L`), `success` yeşil, `warning` amber, `danger` kırmızı; anlam kaybı yok. (b) **danger daha koyu brick kırmızı** (`#B42318`) tutuldu, primary parlak THY kırmızısından ayrışsın diye; yıkıcı işlemler (Void/Refund) zaten modal/drawer içinde "geri alınamaz" uyarısıyla geliyor. (c) Koyu temada accent `#FB5168` (koyu zeminde okunur). Marka laciverti `--thy-navy #1A2A4F` token olarak mevcut (yapısal kullanım için).
>
> **⟳ v2 REVİZYON (2026-07-04): "Enterprise Ops Console".** Görsel dil majör yenilendi; güncel token değerleri `frontend/src/index.css`'tedir (tek doğruluk oradadır, buradaki v1 hex'leri tarihseldir). Değişenler:
> 1. **Kabuk mimarisi:** kırmızı full-bleed topbar KALDIRILDI → **sol ikon rayı** (`w-16`, tema-sabit THY laciverti `--shell-bg #0C1526`, modül gezinme + tema/chat/ayar) + **açık topbar** (`h-14`, modül bağlamı + ⌘K arama + kullanıcı çipi) + **kontekst sidebar** (`w-60`, modülün birincil CTA'sı + gruplar). Kırmızı artık yalnızca **fonksiyonel accent** (CTA, aktif gösterge, marka karosu) — dev kırmızı yüzey yok.
> 2. **Yapısal kabuk token seti** eklendi: `--shell-bg/-deep/surface/hover/active/border/text/dim/glow` — rail, login sol paneli, MobileNav başlığı, Panel docs şeridi bunları kullanır (`.shell-panel` yüzey sınıfı: navy gradyan + sol-üst kırmızı ışıma).
> 3. **Nötr palet:** zinc → **soğuk gri rampa** (text `#101828/#475467/#98A2B3`, sayfa `#F5F6F8`); koyu tema **mavi-tonlu konsol** (`#0B0E14` sayfa / `#12161F` yüzey). Accent koyu THY kırmızısı `#C70A0C` (dark'ta `#F1494B`); `--accent-ring` focus halka tokeni eklendi.
> 4. **Semantik tonlara `--*-border` eklendi** (success/warning/danger/info/neutral); **pill'ler ince inset ring taşır** (tanımlı kenar). Login'deki tanımsız `--danger-border` bug'ı böylece kapandı.
> 5. **Elevation:** 5 kademeli katmanlı gölge (`--shadow-xs…xl`, Tailwind `shadow-xs…xl`). **Kural 4 güncellendi:** kartlar artık `shadow-xs` (ultra-subtle) taşır; modal/dropdown `shadow-lg/xl`; backdrop `rgba(9,16,32,0.5)` + 2px blur.
> 6. **Primitifler:** primary buton "raised" (üst iç ışık + gölge, basılınca düz); input/select/search focus'u **3px yumuşak accent halka**; skeleton shimmer tema-duyarlı (`--shimmer`); StatCard v2 (uppercase mikro-label + ikon karosu); PageHeader v2 (24px başlık + sol 3px accent işaret çizgisi).
> 7. **TicketDetail araç çubuğu:** 9 düz buton → 3 birincil (Exchange/Refund/Void) + **"İşlemler" dropdown** (Revalidate/IRROP/No-show/Ciro/Bagaj/Kağıda Bas, yetki kilitleri tooltip'te) + primary Yazdır.

---

## 2. shadcn/ui entegrasyonu

shadcn HSL değişkenlerini yukarıdaki token'lara bağla (`src/index.css`):

```css
@layer base {
  :root {
    --background: 220 16% 96%;      /* #F4F5F7 */
    --foreground: 220 13% 5%;       /* #0A0B0D */
    --card: 0 0% 100%;              /* #FFFFFF */
    --card-foreground: 220 13% 5%;
    --popover: 220 9% 6%;           /* dark popover #0F1012 */
    --popover-foreground: 0 0% 100%;
    --primary: 217 91% 60%;         /* #2563EB */
    --primary-foreground: 0 0% 100%;
    --secondary: 220 14% 96%;
    --muted: 220 14% 95%;
    --muted-foreground: 218 6% 38%; /* #5C6068 */
    --accent: 222 89% 95%;          /* #E8EEFD soft */
    --border: 220 9% 89%;           /* #E0E2E6 */
    --input: 220 9% 89%;
    --ring: 217 91% 60%;            /* focus = accent */
    --radius: 0.625rem;             /* 10px default */
  }
  .dark {
    --background: 240 8% 4%;  --foreground: 0 0% 98%;
    --card: 240 8% 9%;        --muted-foreground: 240 5% 70%;
    --border: 240 5% 18%;     --primary: 217 91% 60%;
  }
}
```

Tailwind `theme.extend` ile semantic token'ları da expose et (`success`, `warning`, `danger`, `info`, `neutral`) ki pill'ler util class'la kurulabilsin.

---

## 3. Tipografi

```css
--font-sans: "Geist Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "Geist Mono", "JetBrains Mono", monospace;
```
`npm install geist` → Vite'ta font yükle. **Apple-benzeri yumuşak** his.

**Mono nerede:** ticket number, fare/TFC/total, NUC/ROE, tarih-saat, kupon/PNR kodları, fare basis. (Hizalama-yoğun havacılık verisi mono'da okunaklı.)

**Ölçek (size + color ile hiyerarşi):**
| Token | Size | Weight | Kullanım |
|---|---|---|---|
| `display` | 28px | 600 | Sayfa başlığı |
| `heading` | 18px | 600 | Panel/section başlık |
| `subhead` | 14px | 600 | Kart başlık |
| `body` | 14px | 400 | Genel metin |
| `label` | 13px | 500 | Form label, tablo header |
| `caption` | 11px | 500, `tracking 0.06em`, UPPERCASE | Sidebar section, badge üst yazı |
| `mono` | 13px | 400 | Kod, sayısal veri |

**Big-number two-tone (imza kural — fare gösterimi):**
```html
<span class="amount">
  <span class="int">1,285,000</span><span class="dec">.00</span>
  <span class="cur">JPY</span>
</span>
```
```css
.amount .int { color: var(--text-primary); font: 600 20px var(--font-mono); }
.amount .dec,
.amount .cur { color: var(--text-tertiary); font: 400 14px var(--font-mono); }
```
Bilet TOT/FARE/TAX, exchange ADC farkı, refund tutarı hep bu pattern'de.

---

## 4. Spacing & layout

**Base 4px.** Tight `8` · default `16` · comfortable `24` (**card padding default**) · spacious `32` (modal/section) · generous `48`.

**v2 kabuk düzeni (2026-07-04):**
```
┌────┬────────────────────────────────────────────────┐
│ R  │  Topbar (h-14, açık): modül bağlamı · ⌘K · kullanıcı çipi │
│ a  ├──────────┬─────────────────────────────────────┤
│ i  │ Sidebar  │  Page header (pb-5, sol accent çizgi)│
│ l  │ (w-60)   │  Content grid (gap-4/6)             │
│w-16│ CTA+grup │  max-w-[1440px] mx-auto, px-8       │
└────┴──────────┴─────────────────────────────────────┘
Rail = tema-sabit lacivert (--shell-*); Panel modülünde sidebar yok (tam genişlik).
```

**Sidebar:** `256px`, bg `--bg-surface-alt`, `px-3 py-4`; section'lar `mb-6`; section label `text-xs uppercase tracking-wider text-secondary px-3 mb-2`; nav item `h-9 px-3 rounded-[10px] gap-3 text-sm`; **active** `bg-surface + 1px border + ultra-subtle shadow + accent sol indicator`; hover `bg-sunken`.

**Troya sidebar section örneği** (kesin IA → DESIGN_ROADMAP §2):
```
BİLETLEME      → Bilet Kes · Bilet Ara
İŞLEMLER       → Exchange/Reissue · Refund · Void
DOKÜMANLAR     → EMD / Ancillary
INTERLINE      → Mesajlar · Bilateral Anlaşmalar
YÖNETİM        → Kullanıcılar · Loglar
```

---

## 5. Border radius

```css
--radius-sm: 6px;     /* küçük chip */
--radius:    10px;    /* DEFAULT — button, input, küçük card */
--radius-md: 12px;    /* card */
--radius-lg: 16px;    /* büyük card, modal, command palette */
--radius-pill: 9999px;/* status badge, tab */
```
**Kural:** component büyüdükçe radius büyür.

---

## 6. Gölge & elevation

```css
--shadow-xs: 0 1px 2px rgba(10,11,13,0.04);   /* aktif nav, hover */
--shadow-sm: 0 2px 8px rgba(10,11,13,0.06);   /* dropdown, popover */
--shadow-md: 0 8px 24px rgba(10,11,13,0.10);  /* modal, toast */
```
Card default = gölge yok, sadece `border-subtle`. Gölge sadece "yüzen" element'te.

---

## 7. İkonografi
Lucide, **stroke-width `1.75`**, boyut text'e oranlı (16px inline, 18-20px nav). Renk = yanındaki text rengi. Dolu/renkli ikon yok (status dot hariç).

---

## 8. Component'ler (shadcn-first)

**8.1 Button** — radius `10px`. Primary: `bg-accent text-white`, hover `--accent-hover`. Secondary: `bg-surface + border-default`. **Asla yan yana iki primary.** Cancel/Back her zaman secondary ve primary'nin **soluna**. Icon-leading: 16px ikon (1.75 stroke) + label.

**8.2 Status Pill** — biletlemenin kalbi (§9'a bağlanır):
```css
.pill { display:inline-flex; align-items:center; gap:6px; height:24px;
  padding:0 10px; border-radius:9999px; font:500 13px/1 var(--font-sans); white-space:nowrap; }
.pill::before { content:''; width:6px; height:6px; border-radius:50%; }
.pill--success{background:var(--success-bg);color:var(--success-text)} .pill--success::before{background:var(--success-dot)}
.pill--info   {background:var(--info-bg);   color:var(--info-text)}    .pill--info::before{background:var(--info-dot)}
.pill--warning{background:var(--warning-bg);color:var(--warning-text)} .pill--warning::before{background:var(--warning-dot)}
.pill--danger {background:var(--danger-bg); color:var(--danger-text)}  .pill--danger::before{background:var(--danger-dot)}
.pill--neutral{background:var(--neutral-bg);color:var(--neutral-text)} .pill--neutral::before{background:var(--neutral-text);opacity:.6}
```

**8.3 Card** — `bg-surface`, `border-subtle`, radius `12-16px`, padding `24-32px`, gölge yok.

**8.4 Table** (TanStack Table) — header `bg-surface-alt`, label `caption` stili; satır ayıracı `border-subtle`; satır hover `bg-sunken`; **dense** (satır ~44px); sayısal kolonlar mono + sağa hizalı. Bilet/kupon listeleri burada.

**8.5 Form** (RHF + Zod) — label `13px/500` üstte; input `bg-sunken` veya `bg-surface + border-default`, radius `10px`, focus `ring accent`; hata `--danger-text` + alan altında (genel hata değil, **alan bazında** — backend validation buraya map).

**8.6 Modal/Dialog** — radius `16px`, padding `32px`, `--shadow-md`, backdrop `rgba(10,11,13,0.4)`.

**8.7 Toast (alttan gelir, dark)** — `bg-inverse`, beyaz text, radius `12px`, `--shadow-md`; **bottom'dan slide**, `cubic-bezier(0.16,1,0.3,1)`, ~280ms; sol kenar 3px renk şeridi (success/warning/danger); stack + auto-dismiss; ARIA `role="status"`.

**8.8 Tooltip/Popover** — `bg-inverse`, beyaz text, radius `6-8px`, küçük.

**8.9 Command Palette (cmdk)** — light surface (`bg-surface`), `border-subtle`, radius `16px`, `--shadow-md`; item: ikon (1.75) + label + sağda kısayol ipucu (`mono`, `text-tertiary`); fuzzy search; son işlemler; aksiyon grupları (Bilet, Ara, İşlem…). **Uzman hızının anahtarı.**

**8.10 Skeleton** — tüm loading'lerde; `bg-sunken` + subtle shimmer. **Spinner yok.**

---

## 9. Domain adaptasyonu (tasarım × biletleme)

### 9.1 Coupon Status → Pill mapping
CRM+ERP'nin "Paid/Pending/Failed" pill mantığı, biletlemenin resmî 17 kupon statüsüne uyarlandı. **Renk semantiği tunable** (DESIGN_ROADMAP §7); aşağıdaki mantıklı varsayılan:

| Status | Anlam | Pill | Not |
|---|---|---|---|
| `O` | Open For Use | `info` | Aktif/aksiyon alınabilir state |
| `A` | Airport Control | `info` | Kontrol/transit |
| `C` | Checked-In | `info` | |
| `L` | Lifted/Boarded | `info` | |
| `I` | Irregular Ops | `warning` | Dikkat |
| `S` | Suspended | `warning` | |
| `U` | Unavailable | `warning` | |
| `Y` | Refund TFC | `warning` | |
| `N` | Notification | `neutral` | |
| `F` | Flown/Used ✓ | `success` | Final-iyi (✓ ikon) |
| `E` | Exchanged/Reissued | `neutral` | Final-dönüştürüldü |
| `G` | Exchanged/FIM | `neutral` | Final |
| `P` | Printed | `neutral` | Final |
| `X` | Print Exchange | `neutral` | Final |
| `R` | Refunded | `danger` | Final-değer çıktı |
| `V` | Void | `danger` | Final |
| `Z` | Closed | `danger` | Final |

> Aynı renk bucket'ındakiler **pill label'ı** ile ayrışır (örn. "Flown" vs "Exchanged" ikisi de var ama farklı etiket). Final statüler için pill'e ince bir kilit ikonu eklenebilir (artık değişmez sinyali).

### 9.2 Fare/TFC gösterimi
§3'teki big-number two-tone: TOT/FARE/TAX, exchange ADC, refund tutarı. Tax kolonları (tax code mono + tutar two-tone). Negatif/iade tutarlar `--danger-text`, ek tahsilat (ADC) `--text-primary`.

### 9.3 Coupon lifecycle timeline (event sourcing vitrini)
Dikey timeline; her event bir satır: solda **status-renkli dot** + dikey bağlantı çizgisi (`border-subtle`), event adı (`body`), zaman (`mono`, `text-tertiary`), aktör/carrier. Exchange'de eski→yeni bilet **bağlantı kartı** (accent-soft bg). Hover'da detay `bg-inverse` popover'da. Geçmiş = açık/soluk, güncel = tam opak.

### 9.4 Control indicator
Ticket header'da "şu an kimde kontrol var" rozeti: Validating Carrier'daysa `neutral`, başka carrier'a devredildiyse `info` + lease bitiş süresi (`mono`). 72 saat lease yaklaşıyorsa `warning`.

---

## 10. Motion
Süre: micro `150ms`, default `200ms`, panel/toast `280ms`. Easing `cubic-bezier(0.16,1,0.3,1)` (giriş), `ease-out` (çıkış). `prefers-reduced-motion` → animasyonları kapat.

---

## 11. Don'ts
1. İkinci bir accent rengi (mavi VEYA kırmızı, ikisi birden değil). 2. Card'a accent/satüre background. 3. Koyu border. 4. Gradient. 5. Spinner (skeleton kullan). 6. Yan yana iki primary buton. 7. Bold ile hiyerarşi kurma (size+color). 8. Hard-coded hex/inline style (token kullan). 9. shadcn dışı UI kit (Flowbite/AdminLTE vb.) ekleme. 10. Üstten gelen toast (alttan gelir). 11. Pill yerine köşeli badge.

---

## 12. Roadmap'e nasıl oturuyor + checklist

Bu dosya `docs/DESIGN_ROADMAP.md`'nin şu bölümlerini **cevaplar**: §4 (component lib = shadcn + bu spec'ler), §5 (token/görsel dil). Hâlâ **senin doldurman gerekenler**: §1 prensip nüansı, §2 kesin IA/nav, §3 ekran-ekran tasarım, §6 etkileşim akış tipleri, §7 timeline detay + statü renk semantiği onayı, §10 prototip sırası.

**Claude Code checklist (her yeni UI'da):**
- [ ] shadcn'de component var mı? Varsa al, bu dosyaya göre style et
- [ ] Renk/spacing/radius **token'dan** (hard-coded yok)
- [ ] Status → `.pill` (§8.2 + §9.1 mapping)
- [ ] Para → big-number two-tone (§3)
- [ ] Loading → skeleton; Toast → alttan/dark
- [ ] İkon stroke 1.75; aktif nav accent indicator
- [ ] Tek accent (mavi/kırmızı kararına sadık)

> **Köken:** CRM + ERP `DESIGN_LANGUAGE.md` (fintech-minimalizm) → Troya biletleme'ye uyarlandı. Görsel dil aynı; domain pattern'leri (coupon pill, fare two-tone, lifecycle timeline) eklendi.
