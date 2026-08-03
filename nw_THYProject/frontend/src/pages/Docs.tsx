import { useUI } from "@/store/ui";
import { PageTitle, Panel, PanelHead, PanelBody, Stat, Rule } from "@/components/ui/surface";
import { Pill } from "@/components/ui/pill";

/**
 * Sistem dokümantasyonu — paydaşa (THY/Hitit) sunulabilir teknik özet.
 * İçerik arayüz diline göre değişir.
 */
export function Docs() {
  const tr = useUI((s) => s.lang) === "tr";

  const modules = tr
    ? [
        ["QuickRes", "Rezervasyon: uygunluk, PNR oluşturma, arama, TTL takibi"],
        ["Troya", "Biletleme: kesim, exchange/refund/void, revalidation, EMD, interline, order"],
        ["QuickCheck-in", "DCS: yolcu kabul, koltuk kuralları, biniş kartı"],
        ["HUB Kontrol", "A-CDM tabanlı operasyon izleme, uyarı motoru"],
        ["Yönetim", "Rol & yetki matrisi, kullanıcılar, denetim kaydı"],
      ]
    : [
        ["QuickRes", "Reservation: availability, PNR creation, search, TTL tracking"],
        ["Troya", "Ticketing: issue, exchange/refund/void, revalidation, EMD, interline, order"],
        ["QuickCheck-in", "DCS: passenger acceptance, seat rules, boarding pass"],
        ["HUB Control", "A-CDM based operations monitoring, alert engine"],
        ["Admin", "Role & permission matrix, users, audit log"],
      ];

  const principles = tr
    ? [
        ["Event Sourcing", "State event'lerden türetilir; her değişiklik değişmez bir olay üretir. Audit, domainin tanımıdır."],
        ["CQRS", "Yazma (komut→aggregate→event) ve okuma (read model) ayrıdır."],
        ["Kupon FSM", "17 resmî statü ve geçişleri açık bir durum makinesinde tanımlıdır; izinsiz geçiş hata fırlatır."],
        ["Hexagonal", "Domain katmanı framework, veritabanı ve mesaj altyapısı bilmez."],
        ["Idempotency", "Para ve statü değiştiren her komut bir anahtar alır; tekrar aynı sonucu verir."],
        ["Outbox", "Veritabanı işlemi ile mesaj yayını atomiktir."],
      ]
    : [
        ["Event Sourcing", "State is derived from events; every change emits an immutable event. Audit is the definition of the domain."],
        ["CQRS", "Writes (command→aggregate→event) and reads (read model) are separate."],
        ["Coupon FSM", "17 official statuses and their transitions live in an explicit state machine; illegal transitions throw."],
        ["Hexagonal", "The domain layer knows nothing of frameworks, databases or messaging."],
        ["Idempotency", "Every money- or status-changing command takes a key; a retry yields the same result."],
        ["Outbox", "The database transaction and the message publish are atomic."],
      ];

  const stack = [
    ["Backend", "Kotlin · Spring Boot 3 · PostgreSQL 16 · Kafka/Redpanda · Redis"],
    ["Frontend", "Vite · React 18 · TypeScript · TanStack Router & Query · Zustand"],
    ["Altyapı", "Docker Compose · OpenAPI · JUnit 5 + Testcontainers · Playwright"],
  ];

  return (
    <>
      <PageTitle
        title={tr ? "Sistem Dokümantasyonu" : "System Documentation"}
        hint={tr
          ? "IATA Ticketing Handbook'tan türetilen elektronik biletleme platformunun teknik özeti."
          : "Technical overview of the electronic ticketing platform derived from the IATA Ticketing Handbook."}
      />

      <div className="mb-4 flex items-center gap-3 rounded-lg border border-line bg-panel px-5 py-4">
        <h2 className="text-[18px] font-semibold tracking-tight text-ink">Troya Suite</h2>
        <span className="text-[13px] text-ink-2">{tr ? "Modern Biletleme Platformu" : "Modern Ticketing Platform"}</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={tr ? "Kupon statüsü" : "Coupon statuses"} value="17" hint="Handbook 1.1.4" />
        <Stat label={tr ? "Handbook kapsamı" : "Handbook coverage"} value="Ch 1–15" />
        <Stat label={tr ? "Modül" : "Modules"} value="5" />
        <Stat label={tr ? "Arayüz dili" : "Interface language"} value="TR / EN" />
      </div>

      <div className="flex flex-col gap-4">
        <Panel>
          <PanelHead title={tr ? "Modüller & yetenekler" : "Modules & capabilities"} />
          <PanelBody className="flex flex-col gap-2.5">
            {modules.map(([n, d]) => (
              <div key={n} className="flex flex-wrap items-baseline gap-x-3 border-b border-hair pb-2.5 last:border-0">
                <span className="text-[13.5px] font-semibold text-ink">{n}</span>
                <span className="text-[13px] text-ink-2">{d}</span>
              </div>
            ))}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead title={tr ? "Mimari ilkeler" : "Architecture principles"} />
          <PanelBody className="grid gap-3 sm:grid-cols-2">
            {principles.map(([n, d]) => (
              <div key={n} className="rounded-md bg-raised p-3">
                <div className="text-[13px] font-semibold text-ink">{n}</div>
                <div className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{d}</div>
              </div>
            ))}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead title={tr ? "Teknoloji Yığını" : "Technology stack"} />
          <PanelBody className="flex flex-col gap-3">
            {stack.map(([k, v]) => (
              <div key={k}>
                <Rule label={k} />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {v.split(" · ").map((x) => <Pill key={x} tone="gray">{x}</Pill>)}
                </div>
              </div>
            ))}
            <p className="text-[12.5px] text-ink-3">Spring Boot 3 · Event Sourcing</p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead title={tr ? "IATA Handbook Kapsamı" : "IATA Handbook coverage"} />
          <PanelBody className="grid gap-2 sm:grid-cols-2">
            {[
              ["Ch 1", tr ? "Elektronik bilet kaydı, kupon statüleri, SAC" : "Electronic ticket record, coupon statuses, SAC"],
              ["Ch 2", tr ? "Bilet alanları, tour code, conjunction, mixed class" : "Ticket boxes, tour code, conjunction, mixed class"],
              ["Ch 5", tr ? "EMD-A / EMD-S, RFISC, ET senkronu" : "EMD-A / EMD-S, RFISC, ET synchronisation"],
              ["Ch 9", tr ? "PTA — ön ödemeli bilet talimatı" : "PTA — prepaid ticket advice"],
              ["Ch 12", tr ? "Revalidation ve rezervasyon değişikliği" : "Revalidation and reservations change"],
              ["Ch 13", tr ? "IRROP / FIM, no-show, muafiyetler" : "IRROP / FIM, no-show, waivers"],
              ["Ch 14", tr ? "Fazla bagaj, gelir koruma" : "Excess baggage, revenue protection"],
              ["Ch 15", tr ? "İade kuralları" : "Refund rules"],
              ["App B", tr ? "Yolcu bilgi belgesi zorunlu metinleri" : "Itinerary/receipt mandatory notices"],
            ].map(([c, d]) => (
              <div key={c} className="flex gap-2.5 text-[13px]">
                <span className="num flex-shrink-0 font-semibold text-brand">{c}</span>
                <span className="text-ink-2">{d}</span>
              </div>
            ))}
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
