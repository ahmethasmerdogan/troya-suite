# v2 Sıfırdan Yeniden Yazım — Durum

**Karar:** bölünmüş konsol kompozisyonu + sıfırdan temel ("kurumsal sakin").
HashUI kaldırıldı; tasarım sistemi bu projede kendi başına tanımlanıyor.

**v1 (`../frontend`) dokunulmadı** — davranış referansı ve çalışan sürüm odur.
`nw_THYProject/frontend` şu an DERLENMİYOR: sunum katmanı silindi, yeniden
yazımın ortasında. Kayıp yok.

## Bitti

- `src/index.css` — tasarım sistemi (yüzey/çizgi/mürekkep/marka/8 statü tonu/ölçü)
- `tailwind.config.ts` — token'ların adlandırılmış yüzü, ham renk yok, gölge `none`
- `src/components/ui/` — `skeleton` `core` `surface` `pill` `overlay` `toast` `banner` `table`
- `src/components/layout/` — `shape.ts` `views.tsx` `Rail.tsx` `AppShell.tsx` `MobileNav.tsx`
- `src/components/` — `BrandMark.tsx` `RouteFallback.tsx`
- `src/components/layout/Topbar.tsx` — modül menüsü (sidebar'ın yerine) + ⌘K + dil/bildirim/hesap
- `src/components/CommandPalette.tsx` — biçimden hedef algılama (13 hane→belge, 6 alnum→PNR, ORD→order) + canlı arama
- `src/components/domain/` — `statusTone.ts` `StatusPill` `Money` `RouteCell` `TtlBadge`
  `ControlIndicator` `CouponTimeline` `FareBreakdown` `ConfirmDestructive`

Bu noktada `tsc` yalnız EKSİK SAYFALAR için hata veriyor; kabuk ve bileşen
katmanı temiz derleniyor.

## Kalan

1. Domain: `TicketCard` (boarding-pass görünümü) `EmdSection`
2. Akışlar (10): exchange · refund · void · irrop · endorse · revalidate · print · noshow · baggage · addEmd
5. Liste panelleri (5): ticket · emd · order · pnr · flight
6. 26 sayfa — `router.tsx` yol ve export adları SABİT (dokunulmaz)
7. Kapı: tsc + 119 vitest + 21 e2e + build + 26 rota × iki tema sweep
8. `DESIGN_SYSTEM.md` sıfırdan, `CLAUDE.md` tarihli not

## Uyulacak sözleşme

- `domain/` `store/` `lib/` `i18n/` `router.tsx` `e2e/` **değişmez**
- Görünen metin, `placeholder`, `aria-label`, buton etiketi, semantik rol **harfi harfine korunur**
- `pages/ServiceMap.tsx` kapsam dışı (kendi scoped dark teması)
- e2e tuzağı: liste satırı `<button>` ise `aria-label` ZORUNLU — yoksa içindeki
  statü etiketi ("Exchanged") `getByRole("button", {name:/Exchange/})` ile eşleşir
- Node: `export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"` (sistem Node 26 takılıyor)
