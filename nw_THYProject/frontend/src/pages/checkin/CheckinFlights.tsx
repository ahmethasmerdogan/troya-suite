import { PlaneTakeoff } from "lucide-react";
import { SplitView } from "@/components/layout/views";
import { FlightListPane } from "@/components/panes/FlightListPane";
import { Empty } from "@/components/ui/surface";

// `/checkin` — kalkış kontrolü, uçuş seçimi bekleyen hâl.
export function CheckinFlights() {
  return (
    <SplitView
      list={<FlightListPane />}
      detail={
        <div className="flex h-full flex-col">
          <div className="border-b border-line px-5 py-3.5 lg:px-6">
            <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">Uçuşlar</h1>
            <p className="mt-0.5 text-[13px] text-ink-2">
              Departure Control — pasaport / TC kimlik / uçuş kodu / yolcu adı ile ara ya da bir uçuşa girip kabul/biniş yap.
            </p>
          </div>
          <div className="grid flex-1 place-items-center">
            <Empty icon={<PlaneTakeoff size={22} strokeWidth={1.5} />} title="Bir uçuş seçin"
              hint="Soldaki listeden bir uçuşa tıklayın; yolcu kabul ve biniş burada açılır." />
          </div>
        </div>
      }
    />
  );
}
