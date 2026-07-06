import {
  LayoutDashboard, BookMarked, Ticket, PlaneTakeoff, ShieldCheck, Keyboard, Workflow, ListTree, BadgeInfo,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { ROLE_ORDER, ROLE_LABEL, ROLE_DESC, permissionsFor } from "@/domain/auth";
import { INTERIM_STATUSES, FINAL_STATUSES } from "@/domain/couponStatus";
import { cn } from "@/lib/utils";

// Kullanım kılavuzu — sistemin nasıl çalıştığı, menüler, roller, iş akışları, statü kodları.
const SECTIONS = [
  { id: "overview", label: "Genel Bakış", icon: BadgeInfo },
  { id: "modules", label: "Modüller & Menüler", icon: ListTree },
  { id: "roles", label: "Roller & Yetkiler", icon: ShieldCheck },
  { id: "flows", label: "İş Akışları", icon: Workflow },
  { id: "status", label: "Kupon Statü Kodları", icon: Ticket },
  { id: "shortcuts", label: "Kısayollar", icon: Keyboard },
];

const MODULE_MENUS: { icon: typeof Ticket; name: string; sub: string; items: [string, string][] }[] = [
  {
    icon: LayoutDashboard, name: "Panel", sub: "Anasayfa / kontrol merkezi",
    items: [["KPI şeridi", "Günün uçuş, check-in, PNR ve bilet özetleri"], ["Kupon durum dağılımı", "Tüm kuponların statü dağılımı (donut)"], ["Son aktivite", "Olay akışı (event-sourced)"], ["Modül kartları", "Hızlı modül girişi"]],
  },
  {
    icon: BookMarked, name: "QuickRes", sub: "Rezervasyon (PNR)",
    items: [["PNR Oluştur", "Yolcu + segment ile yeni PNR (wizard)"], ["PNR Ara", "PNR / yolcu / güzergah araması"], ["Uygunluk", "Koltuk müsaitlik (availability) görünümü"]],
  },
  {
    icon: Ticket, name: "Troya", sub: "Biletleme motoru",
    items: [
      ["Bilet Kes", "ET kesimi: yolcu → segment (havalimanı autocomplete) → fare/ödeme → onay"],
      ["Bilet Ara", "TKT no / PNR / yolcu / havalimanı; gelişmiş filtre"],
      ["Exchange / Refund / Void", "Para işlemleri — bilet bağlamında, yetki ister"],
      ["IRROP / Endorsement", "Olağandışı operasyon (FIM) ve ciro/kısıtlama"],
      ["EMD / Fazla Bagaj", "EMD-A/EMD-S; bagaj RFISC"],
      ["PTA", "Prepaid Ticket Advice — önceden ödenmiş bilet"],
      ["Order'lar", "ONE Order görünümü; Ticket/EMD fulfillment"],
      ["Mesajlar / Anlaşmalar", "Interline EDIFACT/NDC + bilateral registry"],
    ],
  },
  {
    icon: PlaneTakeoff, name: "QuickCheck-in", sub: "DCS — Departure Control",
    items: [["Uçuşlar", "Kalkış panosu; Check-in / Biniş sekmeleri; pasaport/TC/uçuş/ad arama"], ["Yolcu Kabul", "Check-in → koltuk + bagaj; APIS kontrolü"], ["Biniş (Boarding)", "Biniş kartı + boarding (C→L)"]],
  },
  {
    icon: ShieldCheck, name: "Yönetim", sub: "Admin",
    items: [["Gelir Koruma", "Anomali bayrakları (sıra/mükerrer/control)"], ["Roller & Yetkiler", "Rol-yetki matrisi"], ["Kullanıcılar", "Personel listesi ve rolleri"], ["Loglar", "Denetim (audit) kayıtları"], ["Ayarlar", "Dil, tema, istasyon"]],
  },
];

const FLOWS: [string, string][] = [
  ["Bilet kesimi", "Troya → Bilet Kes. 4 adım: Yolcu → Segment → Fare/Ödeme → Onay. Onayda kuponlar O (Open) açılır; çift-submit idempotency key ile engellenir; sunucu sonucu beklenir (optimistic UI yok)."],
  ["Exchange / Reissue", "Bilet detayı → Exchange. Eski açık kuponlar E olur, yeni bilet kesilir, ADC/residual hesaplanır, linkage kurulur. (Süpervizör+)"],
  ["Refund", "Bilet detayı → Refund. Seçili O kupon(lar) R olur; residual EMD-S'e; vefat/hastalık waiver ile ceza muaf. (Süpervizör+)"],
  ["Void", "Bilet detayı → Void. Yalnızca TÜM kuponlar O ise; hepsi V olur. (Süpervizör+)"],
  ["IRROP / FIM", "Aksayan kupon O→I→G; partner carrier'a ciro; Flight Interruption Manifest üretilir. (Şef+)"],
  ["EMD / Fazla Bagaj", "Bilet detayı → Bagaj/EMD. EMD-A (kupona bağlı) ya da EMD-S (bağımsız); RFISC seçimi."],
  ["PTA", "Troya → PTA. Sponsor öder, yolcu başka istasyonda bileti alır → 'Bilete Dönüştür'."],
  ["Check-in & Biniş", "QuickCheck-in → uçuş → Yolcu Kabul: check-in + koltuk (kupon O→C); Biniş sekmesinde board (C→L)."],
];

export function Guide() {
  return (
    <div>
      <PageHeader title="Kullanım Kılavuzu" description="Troya Suite nasıl çalışır, menüler ne işe yarar, roller ve iş akışları." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
        {/* in-page nav */}
        <nav className="hidden lg:block">
          <div className="sticky top-2 flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 rounded-md px-3 py-2 text-[13px] text-secondary transition-colors hover:bg-sunken hover:text-primary">
                <s.icon size={15} strokeWidth={1.75} className="text-tertiary" /> {s.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          <Section id="overview" title="Genel Bakış" icon={BadgeInfo}>
            <p className="text-[13px] leading-relaxed text-secondary">
              <b className="text-primary">Troya Suite</b>, IATA Ticketing Handbook çekirdeğinden türetilen modern bir biletleme platformudur.
              Tek çalışma alanında üç operasyon modülü + Panel + Yönetim sunar. Tüm para/statü işlemleri ortak <b className="text-primary">Engine</b>'e gider;
              arayüz bir <b className="text-primary">sunum adaptörü</b>dür (iş kuralı backend'de). Kupon yaşam döngüsü event-sourced; her aksiyon değişmez bir audit kaydıdır.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
              {["Event Sourcing", "CQRS", "Coupon FSM", "Idempotency", "Control / lease", "Order-native (gelecek)"].map((c) => (
                <span key={c} className="rounded-pill bg-sunken px-2.5 py-1 text-secondary">{c}</span>
              ))}
            </div>
          </Section>

          <Section id="modules" title="Modüller & Menüler" icon={ListTree}>
            <div className="flex flex-col gap-4">
              {MODULE_MENUS.map((m) => (
                <div key={m.name} className="rounded-lg border border-[var(--border-subtle)] bg-surface-alt p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-accent-soft text-accent"><m.icon size={17} strokeWidth={1.75} /></span>
                    <div><div className="text-[14px] font-semibold text-primary">{m.name}</div><div className="text-[11px] text-tertiary">{m.sub}</div></div>
                  </div>
                  <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    {m.items.map(([k, v]) => (
                      <div key={k} className="flex flex-col">
                        <dt className="text-[12px] font-medium text-primary">{k}</dt>
                        <dd className="text-[12px] leading-snug text-tertiary">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </Section>

          <Section id="roles" title="Roller & Yetkiler" icon={ShieldCheck}>
            <p className="mb-3 text-[13px] text-secondary">5 rol, kıdeme göre kümülatif yetki. Rolünüze göre menü ve aksiyonlar açılır/kilitlenir. Tam matris: <Link to="/admin/$section" params={{ section: "roles" }} className="font-medium text-accent hover:underline">Yönetim → Roller & Yetkiler</Link>.</p>
            <div className="flex flex-col gap-2">
              {ROLE_ORDER.map((r) => (
                <div key={r} className="flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2.5">
                  <span className="w-24 flex-shrink-0 text-[13px] font-semibold text-primary">{ROLE_LABEL[r]}</span>
                  <span className="flex-1 text-[12px] text-secondary">{ROLE_DESC[r]}</span>
                  <span className="flex-shrink-0 rounded-pill bg-sunken px-2 py-0.5 font-mono text-[11px] text-tertiary">{permissionsFor(r).length} yetki</span>
                </div>
              ))}
            </div>
          </Section>

          <Section id="flows" title="İş Akışları" icon={Workflow}>
            <div className="flex flex-col gap-2.5">
              {FLOWS.map(([k, v]) => (
                <div key={k} className="rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2.5">
                  <div className="text-[13px] font-semibold text-primary">{k}</div>
                  <div className="mt-0.5 text-[12px] leading-snug text-secondary">{v}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="status" title="Kupon Statü Kodları" icon={Ticket}>
            <p className="mb-3 text-[13px] text-secondary">IATA Handbook 1.1.4. Interim statüler kupon hayatta; final statüler terminal (bir daha işlem görmez).</p>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">Interim (ara)</div>
            <div className="flex flex-wrap gap-2">
              {INTERIM_STATUSES.map((s) => <StatusBadge key={s} status={s} showCode />)}
            </div>
            <div className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">Final (terminal)</div>
            <div className="flex flex-wrap gap-2">
              {FINAL_STATUSES.map((s) => <StatusBadge key={s} status={s} showCode />)}
            </div>
          </Section>

          <Section id="shortcuts" title="Kısayollar & İpuçları" icon={Keyboard}>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([
                ["⌘K / Ctrl+K", "Komut paleti — TKT no aç, ara, modül geç"],
                ["e / r / v", "Bilet detayında Exchange / Refund / Void"],
                ["Sağ-alt baloncuk", "Hızlı mesajlaşma (online şef/supervisor'a sor)"],
                ["Sağ üst avatar", "Rol değiştir (demo) · ayarlar"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2">
                  <kbd className="flex-shrink-0 rounded border border-[var(--border-default)] bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-secondary">{k}</kbd>
                  <span className="text-[12px] text-secondary">{v}</span>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: typeof Ticket; children: React.ReactNode }) {
  return (
    <Card id={id} className={cn("scroll-mt-4")}>
      <CardHeader className="flex-row items-center gap-2">
        <Icon size={18} strokeWidth={1.75} className="text-accent" />
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
