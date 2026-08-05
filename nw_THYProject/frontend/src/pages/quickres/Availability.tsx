import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { getAvailability, type FlightOption } from "@/domain/reservation";
import { Button, Field, Input } from "@/components/ui/core";
import { PageTitle, Panel, PanelHead, PanelBody, Empty } from "@/components/ui/surface";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/i18n";
import { formatDateTime, flightCode } from "@/lib/utils";

// Uygunluk sorgusu — hangi uçuşta hangi sınıfta kaç koltuk var.
export function Availability() {
  const t = useT();
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("IST");
  const [destination, setDestination] = useState("LHR");
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<FlightOption[] | null>(null);

  const search = useMutation({
    mutationFn: () => getAvailability(origin.toUpperCase(), destination.toUpperCase(), date),
    onSuccess: setRows,
  });

  return (
    <>
      <PageTitle title={t("nav.res.availability")} hint="Güzergâh ve tarihe göre uçuş ve sınıf uygunluğu. Bir sınıfa tıklayın — rezervasyon formu o seferle açılır." />

      <Panel className="mb-4">
        <PanelBody>
          <form
            onSubmit={(e) => { e.preventDefault(); search.mutate(); }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-4"
          >
            <Field label="Nereden"><Input value={origin} onChange={(e) => setOrigin(e.target.value)} maxLength={3} className="uppercase" /></Field>
            <Field label="Nereye"><Input value={destination} onChange={(e) => setDestination(e.target.value)} maxLength={3} className="uppercase" /></Field>
            <Field label="Tarih"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={search.isPending}>
                {search.isPending ? "Aranıyor…" : "Ara"}
              </Button>
            </div>
          </form>
        </PanelBody>
      </Panel>

      {search.isPending ? (
        <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : rows === null ? (
        <Empty title="Sorgu bekleniyor" hint="Güzergâh ve tarihi girip Ara'ya basın." />
      ) : rows.length === 0 ? (
        <Empty title="Uçuş bulunamadı" hint="Farklı bir tarih ya da güzergâh deneyin." />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((f) => (
            <Panel key={f.flightNumber}>
              <PanelHead
                title={<span className="num">{flightCode(f.carrier, f.flightNumber)}</span>}
                hint={<span className="num">{f.origin} → {f.destination} · {formatDateTime(f.departure)} · {Math.floor(f.durationMin / 60)}sa {f.durationMin % 60}dk</span>}
              />
              <PanelBody className="flex flex-wrap gap-2">
                {f.classes.map((c) => (
                  <button
                    key={c.rbd}
                    type="button"
                    disabled={c.available <= 0}
                    title={c.available > 0 ? "Bu sınıfla rezervasyon oluştur" : "Bu sınıfta koltuk yok"}
                    onClick={() => navigate({
                      to: "/res/new",
                      search: {
                        o: f.origin, d: f.destination, cx: f.carrier,
                        fn: f.flightNumber.replace(/^[A-Z]{2}/, ""), rbd: c.rbd,
                        dep: f.departure, arr: f.arrival,
                      },
                    })}
                    className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-left transition-colors hover:border-brand hover:bg-brand-wash disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:bg-transparent"
                  >
                    <span className="num text-[14px] font-semibold text-ink">{c.rbd}</span>
                    <Pill tone={c.cabin === "Business" ? "violet" : "gray"}>{c.cabin}</Pill>
                    <span className="num text-[12px] text-ink-3">{c.available} koltuk</span>
                    <span className="num text-[12.5px] font-medium text-ink">
                      {c.fareFrom.amount.toLocaleString("tr-TR")} {c.fareFrom.currency}
                    </span>
                  </button>
                ))}
              </PanelBody>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
