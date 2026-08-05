import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, HelpCircle, Keyboard, Lightbulb, X } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";

/* ====================================================================
   Ekran yardımı — yeni personel için.

   Sistem IATA terimleriyle konuşuyor (kupon, EMD, ADC, RFISC, ETSU) ve
   gişeye yeni başlayan biri için bu kelimeler ekranı okunmaz kılıyor.
   Alan ipuçları zaten var (`FIELD_HELP`); eksik olan EKRAN düzeyindeydi:
   "burada ne yapıyorum, neye dikkat etmeliyim, hangi kısayol işime yarar".

   Topbar'daki soru işareti bunu açar; içerik rotaya göre değişir.
   ==================================================================== */

interface ScreenGuide {
  title: string;
  what: string;
  steps: string[];
  watch?: string[];
  shortcuts?: [string, string][];
}

const GUIDES: { match: (path: string) => boolean; guide: ScreenGuide }[] = [
  {
    match: (p) => p === "/issue",
    guide: {
      title: "Bilet Kesme",
      what: "Yolcuya elektronik bilet düzenlersiniz. Beş adım: yolcu, sefer, ücret, ödeme, onay.",
      steps: [
        "Ad ve soyadı pasaporttaki gibi yazın — sonradan değiştirmek yeni belge gerektirir.",
        "Uçuş numarasını SİZ yazmazsınız: güzergâh ve tarihi girin, sistem o günün seferlerini listeler.",
        "Ücreti de siz yazmazsınız: sistem tarifesinden uygun ücreti seçersiniz; RBD ve ücret kodu otomatik dolar.",
        "Onay ekranında özeti okuyup beyanı işaretlemeden kesim yapılmaz.",
      ],
      watch: [
        "Kucak bebeği 24 aydan küçük olmalı; büyükse çocuk (CHD) bileti gerekir.",
        "Ücretli özel hizmet seçerseniz ayrıca EMD düzenlenir.",
        "Void yalnız satış günü içinde mümkündür; sonrası iade kurallarına tabidir.",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/tickets/"),
    guide: {
      title: "Bilet Kaydı",
      what: "Belgenin tamamı: kuponlar, ücret dökümü, kontrol bilgisi ve yaşam döngüsü.",
      steps: [
        "Üstteki belge yüzü yolcunun elindeki bilete karşılık gelir; Yazdır ile kâğıda basılır.",
        "Her bacak ayrı bir KUPONDUR ve statüsü bağımsız yürür (O açık, F uçulmuş, V iptal…).",
        "Exchange / Refund / Void toolbar'da; diğer işlemler 'İşlemler' menüsündedir.",
        "Yaşam döngüsü kaydın denetim geçmişidir — kim, ne zaman, ne yaptı, ne kadar.",
      ],
      watch: [
        "Kupon kontrolü başka taşıyıcıdaysa işlem yapılamaz; önce kontrolü isteyin.",
        "Kuponlar sırayla kullanılır: önceki kupon açıkken sonraki honor edilmez.",
      ],
      shortcuts: [["e", "Exchange"], ["r", "Refund"], ["v", "Void"]],
    },
  },
  {
    match: (p) => p === "/search",
    guide: {
      title: "Bilet Arama",
      what: "Tek çubuk her şeyi tanır: bilet no, PNR, yolcu adı, havalimanı, uçuş no, kart son 4 hane.",
      steps: [
        "Durum sekmeleri 17 kupon kodunu gruplar — void edilen bilet kaybolmaz, 'İptal (Void)' sekmesindedir.",
        "Gelişmiş panel tarih aralığı, FOID ve kart ile daraltır.",
        "Satır sonundaki ikonlar: kaydı aç, yolcu belgesi.",
        "CSV dışa aktarımı ekranda göründüğü gibi çıkar (Excel uyumlu).",
      ],
      shortcuts: [["⌘K", "Komut paleti"]],
    },
  },
  {
    match: (p) => p.startsWith("/checkin/") && p.includes("/seat/"),
    guide: {
      title: "Koltuk Seçimi",
      what: "Kabin uçağın gerçek düzeninden çizilir; her koltuk her yolcuya verilemez.",
      steps: [
        "Turuncu ⊘ koltuk bu yolcuya kapalıdır; nedeni sağdaki 'Kapalı koltuklar' panelinde yazar.",
        "Yeşil zeminli sıralar acil çıkış sıralarıdır.",
        "Seçtiğiniz koltuğun tarifi (pencere/koridor, çıkış, bölme başı) alt şeritte görünür.",
      ],
      watch: [
        "Bebekli, çocuk ve hareket kısıtlı yolcu çıkış sırasına oturamaz (EASA/DOT).",
        "WCHC ve sedye yolcusu yalnız pencere kenarına; evcil hayvan bölme başına oturamaz.",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/checkin"),
    guide: {
      title: "Yolcu Kabul",
      what: "Uçuşa yolcu kabul eder, biniş yapar ve kapıyı kapatırsınız. Her adım bilet kuponunu ilerletir.",
      steps: [
        "Kontrol al: kuponları havalimanı kontrolüne alır (O→A).",
        "Kabul et: koltuk verir, kuponu check-in'e taşır (A→C) ve bagajı kupona yazar.",
        "Bindir: kuponu uçağa alınmış yapar (C→L).",
        "Uçuşu kapat: binenlerin kuponu uçulmuş olur (L→F), binmeyenler no-show.",
      ],
      watch: ["Uluslararası uçuşta APIS (pasaport + uyruk) eksikse kabul yapılamaz."],
    },
  },
  {
    match: (p) => p.startsWith("/report"),
    guide: {
      title: "Raporlar",
      what: "Üç rapor üç ayrı soruya cevap verir.",
      steps: [
        "Satış / İşlem: bugün ne oldu — belge belge işlem listesi.",
        "Mali Rapor: ceza, vergi, KDV ve iade türü kırılımı.",
        "Dönem Kapanışı: günü kapatır; kapanan dönemde void ve iade geri alma yapılamaz.",
      ],
      watch: ["Dönem kapanışı geri alınamaz; kapatmadan önce açık kalemleri kontrol edin."],
    },
  },
  {
    match: (p) => p.startsWith("/res"),
    guide: {
      title: "Rezervasyon (QuickRes)",
      what: "PNR arar, açar ve yeni rezervasyon oluşturursunuz.",
      steps: [
        "Uygunluk sorgusunda sınıfa tıklamak rezervasyon formunu o seferle doldurur.",
        "PNR detayında 'Bilet Kes' yolcu ve seferi kesim formuna taşır.",
        "Kesim tamamlanınca doküman numarası PNR'a yazılır ve rezervasyon 'biletlendi' olur.",
      ],
      watch: ["Kesim süre limiti (TTL/ADTK) dolan rezervasyon düşebilir — uyarı bandına dikkat edin."],
    },
  },
  {
    match: (p) => p === "/chat",
    guide: {
      title: "Mesajlaşma",
      what: "Gişedeki personelin süpervizöre soru sorduğu yer. Kanallar herkese açık, kişiler birebir.",
      steps: [
        "'Bilet ekle' ile kaydı mesaja iliştirin — karşı taraf sağ panelde canlı görür.",
        "Kişi satırındaki (i) kişi kartını açar: unvan, birim, kime bağlı olduğu.",
        "Durumunuzu (Müsait / Meşgul / Uzakta) kendiniz bildirirsiniz.",
      ],
    },
  },
];

const DEFAULT_GUIDE: ScreenGuide = {
  title: "Troya Suite",
  what: "Rezervasyon (QuickRes), biletleme (Troya) ve yolcu kabul (QuickCheck-in) tek panelde.",
  steps: [
    "Üstteki modül şeridi hangi işi yaptığınızı seçer; alt satır o modülün bölümleridir.",
    "⌘K komut paleti bilet no, PNR ya da EMD numarasını doğrudan açar.",
    "Yetkiniz olmayan işlem kilitli görünür; üzerine gelince hangi rolün gerektiği yazar.",
  ],
  shortcuts: [["⌘K", "Komut paleti"]],
};

function guideFor(path: string): ScreenGuide {
  return GUIDES.find((g) => g.match(path))?.guide ?? DEFAULT_GUIDE;
}

/** Topbar'daki soru işareti — bulunduğunuz ekranın kılavuzu. */
export function ScreenHelpButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const g = guideFor(path);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Bu ekran nasıl kullanılır"
        title="Bu ekran nasıl kullanılır"
        className={cn(
          "grid h-8 w-8 place-items-center rounded-[10px] text-ink-3 transition-colors hover:bg-inset hover:text-ink",
          className,
        )}
      >
        <HelpCircle size={17} strokeWidth={1.75} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`${g.title} — nasıl kullanılır`} width="md">
        <div className="flex flex-col gap-4">
          <p className="text-[13.5px] leading-relaxed text-ink-2">{g.what}</p>

          <section>
            <div className="microlabel mb-1.5">Adımlar</div>
            <ol className="flex flex-col gap-1.5">
              {g.steps.map((s, i) => (
                <li key={s} className="flex gap-2.5 text-[13px] text-ink-2">
                  <span className="num mt-px grid h-4.5 w-4.5 flex-shrink-0 place-items-center rounded-full bg-inset text-[10.5px] text-ink-3">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </section>

          {g.watch && (
            <section className="rounded-md border border-line bg-inset p-3">
              <div className="microlabel mb-1.5 flex items-center gap-1.5">
                <Lightbulb size={13} strokeWidth={1.75} className="text-[var(--t-amber-i)]" /> Dikkat
              </div>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-[12.5px] text-ink-2">
                {g.watch.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </section>
          )}

          {g.shortcuts && (
            <section>
              <div className="microlabel mb-1.5 flex items-center gap-1.5">
                <Keyboard size={13} strokeWidth={1.75} /> Kısayollar
              </div>
              <div className="flex flex-wrap gap-2">
                {g.shortcuts.map(([k, label]) => (
                  <span key={k} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[12px] text-ink-2">
                    <kbd className="num rounded-sm bg-inset px-1.5 py-0.5 text-[11px] text-ink">{k}</kbd>
                    {label}
                  </span>
                ))}
              </div>
            </section>
          )}

          <div className="flex items-center gap-2 border-t border-line pt-3">
            <Link
              to="/guide" onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand hover:underline"
            >
              <BookOpen size={14} strokeWidth={1.75} /> Tüm kullanım kılavuzu
            </Link>
            <button onClick={() => setOpen(false)} className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink">
              <X size={13} strokeWidth={2} /> Kapat
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
