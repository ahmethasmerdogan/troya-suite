import { Ticket } from "lucide-react";
import { SplitView } from "@/components/layout/views";
import { OrderListPane } from "@/components/panes/OrderListPane";
import { Empty } from "@/components/ui/surface";
import { useT } from "@/i18n";

// `/orders` — order-native görünüm (ONE Order yönü), seçim bekleyen hâl.
export function Orders() {
  const t = useT();
  return (
    <SplitView
      list={<OrderListPane />}
      detail={
        <div className="flex h-full flex-col">
          <div className="border-b border-line px-5 py-3.5 lg:px-6">
            <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">{t("nav.orders")}</h1>
            <p className="mt-0.5 text-[13px] text-ink-2">{t("orders.desc")}</p>
          </div>
          <div className="grid flex-1 place-items-center">
            <Empty icon={<Ticket size={22} strokeWidth={1.5} />} title="Bir order seçin"
              hint="Soldaki listeden bir order'a tıklayın; kalemleri ve bağlı belgeleri burada açılır." />
          </div>
        </div>
      }
    />
  );
}
