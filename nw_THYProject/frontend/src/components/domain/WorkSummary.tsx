import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Inbox } from "lucide-react";
import { listQueueItems } from "@/domain/api";
import { QUEUES } from "@/domain/queues";
import { applyWork, useQueueWork } from "@/store/queueWork";
import { usePerm } from "@/lib/usePerm";
import { Panel, PanelHead, PanelBody } from "@/components/ui/surface";
import { Pill } from "@/components/ui/pill";
import { useT } from "@/i18n";
import { useUI } from "@/store/ui";

/**
 * Panel — "Bugünün işleri". Günün kuyruktan başlaması için kuyrukların
 * özeti: toplam, acil ve en öndeki üç iş; tamamı `/queues`'da.
 */
export function WorkSummary() {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const { can } = usePerm();
  const work = useQueueWork();
  const { data } = useQuery({ queryKey: ["queues"], queryFn: listQueueItems, staleTime: 0 });
  const allowed = new Set(QUEUES.filter((q) => !q.perm || can(q.perm)).map((q) => q.id));
  const items = applyWork((data ?? []).filter((i) => allowed.has(i.queue)), work, Date.now());
  const urgent = items.filter((i) => i.priority === "high").length;

  return (
    <Panel>
      <PanelHead
        title={<span className="inline-flex items-center gap-2"><Inbox size={16} strokeWidth={1.75} className="text-brand" /> {t("panel.work.title")}</span>}
        hint={items.length ? t("panel.work.hint", { n: items.length, u: urgent }) : t("panel.work.empty")}
        action={
          <Link to="/queues" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand">
            {t("nav.queues")} <ArrowRight size={14} strokeWidth={2} />
          </Link>
        }
      />
      <PanelBody className="flex flex-col gap-0.5 pt-1.5">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-[13px] text-ink-2">
            <CheckCircle2 size={16} strokeWidth={1.75} className="text-[var(--t-green-d)]" /> {t("panel.work.clear")}
          </div>
        ) : items.slice(0, 3).map((i) => (
          <Link key={i.id} to="/queues" className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-sunken">
            <span className="num w-10 flex-shrink-0 text-[11.5px] text-ink-3">Q{QUEUES.find((q) => q.id === i.queue)?.no}</span>
            <span className="min-w-0 flex-1">
              <span className="num block truncate text-[13px] font-medium text-ink">{lang === "en" ? i.titleEn : i.title}</span>
              <span className="block truncate text-[12px] text-ink-3">{lang === "en" ? i.detailEn : i.detail}</span>
            </span>
            {i.priority === "high" && <Pill tone="red">{t("queues.prio.high")}</Pill>}
          </Link>
        ))}
      </PanelBody>
    </Panel>
  );
}
