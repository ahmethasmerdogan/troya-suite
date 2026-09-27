import { PageTitle, Panel, PanelHead, PanelBody, Rule } from "@/components/ui/surface";
import { useT, type Key } from "@/i18n";

/**
 * Kullanım kılavuzu — yeni personel için, jargonsuz.
 * Her bölüm bir işi anlatır: ne zaman kullanılır, nasıl yapılır, nelere dikkat.
 * Metinler sözlükte (docs2.guide.*); burada yalnız anahtarların iskeleti durur.
 */
const SECTIONS: { title: Key; steps: Key[]; care?: Key }[] = [
  {
    title: "docs2.guide.issue.title",
    steps: [
      "docs2.guide.issue.s1",
      "docs2.guide.issue.s2",
      "docs2.guide.issue.s3",
      "docs2.guide.issue.s4",
      "docs2.guide.issue.s5",
    ],
    care: "docs2.guide.issue.care",
  },
  {
    title: "docs2.guide.find.title",
    steps: [
      "docs2.guide.find.s1",
      "docs2.guide.find.s2",
      "docs2.guide.find.s3",
      "docs2.guide.find.s4",
    ],
  },
  {
    title: "docs2.guide.change.title",
    steps: [
      "docs2.guide.change.s1",
      "docs2.guide.change.s2",
      "docs2.guide.change.s3",
    ],
    care: "docs2.guide.change.care",
  },
  {
    title: "docs2.guide.checkin.title",
    steps: [
      "docs2.guide.checkin.s1",
      "docs2.guide.checkin.s2",
      "docs2.guide.checkin.s3",
    ],
  },
];

export function Guide() {
  const t = useT();
  return (
    <>
      <PageTitle title={t("nav.guide")} hint={t("docs2.guide.hint")} />
      <div className="flex flex-col gap-4">
        {SECTIONS.map((s) => (
          <Panel key={s.title}>
            <PanelHead title={t(s.title)} />
            <PanelBody className="flex flex-col gap-3">
              <ol className="flex flex-col gap-2">
                {s.steps.map((step, i) => (
                  <li key={step} className="flex gap-3 text-[13.5px] leading-relaxed text-ink-2">
                    <span className="num grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-sunken text-[11px] text-ink-3">{i + 1}</span>
                    {t(step)}
                  </li>
                ))}
              </ol>
              {s.care && (
                <>
                  <Rule label={t("docs2.guide.care")} />
                  <p className="text-[13px] leading-relaxed text-[var(--t-amber-i)]">{t(s.care)}</p>
                </>
              )}
            </PanelBody>
          </Panel>
        ))}
      </div>
    </>
  );
}
