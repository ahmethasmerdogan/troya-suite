import { PageTitle, Panel, PanelHead, PanelBody, Rule } from "@/components/ui/surface";
import { useT } from "@/i18n";

/**
 * Kullanım kılavuzu — yeni personel için, jargonsuz.
 * Her bölüm bir işi anlatır: ne zaman kullanılır, nasıl yapılır, nelere dikkat.
 */
const SECTIONS: { title: string; steps: string[]; care?: string }[] = [
  {
    title: "Bilet kesmek",
    steps: [
      "Soldaki raydan Troya modülüne geçin, ardından Bilet Kes'e basın.",
      "Yolcu bilgilerini pasaporttaki ile birebir girin; sistem büyük harfe çevirir.",
      "Güzergâh ve tarihi girin, çıkan uçuş listesinden uçuşu seçin — sefer no elle yazılmaz.",
      "Sistem ücret tarifesini çıkarır; duruma uygun ücreti seçin (RBD ve fare basis otomatik oluşur).",
      "Ödeme şeklini girin, özeti kontrol edin ve onay kutusunu işaretleyerek kesin.",
    ],
    care: "Kesim geri alınamaz. Void yalnız satış günü içinde mümkündür.",
  },
  {
    title: "Bilet bulmak",
    steps: [
      "Bilet Ara ekranında tek çubuk yeter: bilet no, PNR, yolcu soyadı, havalimanı, uçuş no ya da kartın son 4 hanesi.",
      "Daha dar arama için Gelişmiş'e basıp tarih aralığı ve kimlik gibi alanları kullanın.",
      "Sol listeden kayda tıklayın; sağda bilet açılır, liste yerinde kalır.",
      "Her yerden ⌘K ile de arayabilirsiniz: 13 hane belge, 6 karakter PNR olarak algılanır.",
    ],
  },
  {
    title: "Değişiklik, iade, iptal",
    steps: [
      "Bileti açın; üstteki şeritte Exchange, Refund ve Void doğrudan durur.",
      "Diğer işlemler (revalidation, IRROP, ciro, kağıda basma, no-show) İşlemler menüsündedir.",
      "Her işlem sonucu ekranda gösterir ve kupon statüsünü değiştirir; geçmiş yaşam döngüsünde kalır.",
    ],
    care: "Yetkiniz yetmiyorsa buton pasif görünür; üzerine gelince gereken rol yazar.",
  },
  {
    title: "Check-in ve biniş",
    steps: [
      "QuickCheck-in modülünde uçuşu seçin.",
      "Check-in sekmesinde yolcuyu kabul edin ve koltuk verin; sistem uygun olmayan koltuğu engeller.",
      "Biniş sekmesinde yolcuları bindirin; kupon statüsü otomatik ilerler.",
    ],
  },
];

export function Guide() {
  const t = useT();
  return (
    <>
      <PageTitle title={t("nav.guide")} hint="Sık yapılan işler, adım adım. Kısaltma bilmenize gerek yok." />
      <div className="flex flex-col gap-4">
        {SECTIONS.map((s) => (
          <Panel key={s.title}>
            <PanelHead title={s.title} />
            <PanelBody className="flex flex-col gap-3">
              <ol className="flex flex-col gap-2">
                {s.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-ink-2">
                    <span className="num grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-sunken text-[11px] text-ink-3">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              {s.care && (
                <>
                  <Rule label="Dikkat" />
                  <p className="text-[13px] leading-relaxed text-[var(--t-amber-i)]">{s.care}</p>
                </>
              )}
            </PanelBody>
          </Panel>
        ))}
      </div>
    </>
  );
}
