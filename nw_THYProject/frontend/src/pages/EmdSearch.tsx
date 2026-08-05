import { Package } from "lucide-react";
import { SplitView } from "@/components/layout/views";
import { EmdListPane } from "@/components/panes/EmdListPane";
import { Empty } from "@/components/ui/surface";
import { useT } from "@/i18n";

// `/emds` — EMD retrieval (Handbook Ch 5), seçim bekleyen hâl.
export function EmdSearch() {
  const t = useT();
  return (
    <SplitView
      list={<EmdListPane />}
      detail={
        <div className="flex h-full flex-col">
          <div className="border-b border-line px-5 py-3.5 lg:px-6">
            <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">{t("nav.emd.search")}</h1>
            <p className="mt-0.5 text-[13px] text-ink-2">{t("emd.search.desc")}</p>
          </div>
          <div className="grid flex-1 place-items-center">
            <Empty icon={<Package size={22} strokeWidth={1.5} />} title={t("misc.emds.empty")}
              hint={t("misc.emds.emptyHint")} />
          </div>
        </div>
      }
    />
  );
}
