import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { createPnr, type ReservationSegment } from "@/domain/reservation";
import type { Passenger } from "@/domain/types";
import { Button, Field, Input, Select } from "@/components/ui/core";
import { PageTitle, Panel, PanelHead, PanelBody } from "@/components/ui/surface";
import { Banner } from "@/components/ui/banner";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n";

// Yeni rezervasyon — yolcu ve segment girişi, sonra PNR üretimi.
const emptyPax = (): Passenger => ({ surname: "", givenName: "", title: "MR" });
const emptySeg = (): ReservationSegment => ({
  origin: "IST", destination: "", carrier: "TK", flightNumber: "", rbd: "Y",
  departure: "", arrival: "", status: "HK",
});

export function CreatePnr() {
  const t = useT();
  const navigate = useNavigate();
  // Uygunluk sorgusundan seçilen sefer (?o=&d=&cx=&fn=&rbd=&dep=&arr=) formu doldurur.
  const q = useSearch({ from: "/res/new" });
  const [pax, setPax] = useState<Passenger[]>([emptyPax()]);
  const [segs, setSegs] = useState<ReservationSegment[]>([
    q.fn && q.dep
      ? {
        origin: q.o ?? "IST", destination: q.d ?? "", carrier: q.cx ?? "TK", flightNumber: q.fn,
        rbd: q.rbd ?? "Y", departure: q.dep, arrival: q.arr ?? q.dep, status: "HK",
      }
      : emptySeg(),
  ]);
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => createPnr({ passengers: pax, segments: segs, contact: contact || undefined }),
    onSuccess: (p) => {
      toast.success("Rezervasyon oluşturuldu", `PNR ${p.recordLocator}`);
      navigate({ to: "/res/$pnr", params: { pnr: p.recordLocator } });
    },
    onError: (e: Error) => setError(e.message),
  });

  const valid = pax.every((p) => p.surname.trim().length >= 2 && p.givenName.trim())
    && segs.every((s) => s.destination.trim() && s.flightNumber.trim() && s.departure);

  const setPaxAt = (i: number, patch: Partial<Passenger>) =>
    setPax((a) => a.map((p, j) => (i === j ? { ...p, ...patch } : p)));
  const setSegAt = (i: number, patch: Partial<ReservationSegment>) =>
    setSegs((a) => a.map((s, j) => (i === j ? { ...s, ...patch } : s)));

  return (
    <>
      <PageTitle title={t("nav.res.new")} hint="Yolcu ve uçuş bilgilerini girin; sistem PNR (record locator) üretir." />

      <div className="flex flex-col gap-4">
        {q.fn && q.dep && (
          <Banner kind="info" title="Uygunluk sorgusundan gelindi">
            {q.cx}{q.fn} · {q.o} → {q.d} · sınıf {q.rbd} segment olarak dolduruldu. Yolcu bilgilerini girip rezervasyonu oluşturun.
          </Banner>
        )}
        <Panel>
          <PanelHead
            title="Yolcular"
            hint="Ad ve soyadı pasaporttaki ile birebir yazın."
            action={<Button variant="secondary" size="sm" onClick={() => setPax((a) => [...a, emptyPax()])}><Plus size={15} strokeWidth={2} /> Yolcu</Button>}
          />
          <PanelBody className="flex flex-col gap-3">
            {pax.map((p, i) => (
              <div key={i} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <Field label="Soyadı" required><Input value={p.surname} onChange={(e) => setPaxAt(i, { surname: e.target.value })} placeholder="ERDOGAN" className="uppercase" /></Field>
                <Field label="Ad" required><Input value={p.givenName} onChange={(e) => setPaxAt(i, { givenName: e.target.value })} placeholder="AHMET" className="uppercase" /></Field>
                <Field label="Ünvan">
                  <Select value={p.title} onChange={(e) => setPaxAt(i, { title: e.target.value })}>
                    {["MR", "MRS", "MS", "CHD", "INF"].map((x) => <option key={x}>{x}</option>)}
                  </Select>
                </Field>
                <div className="flex items-end">
                  {pax.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => setPax((a) => a.filter((_, j) => j !== i))}>
                      <Trash2 size={15} strokeWidth={1.75} /> Kaldır
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead
            title="Segmentler"
            hint="Her uçuş bacağı için bir segment."
            action={<Button variant="secondary" size="sm" onClick={() => setSegs((a) => [...a, emptySeg()])}><Plus size={15} strokeWidth={2} /> Segment</Button>}
          />
          <PanelBody className="flex flex-col gap-3">
            {segs.map((s, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                <Field label="Nereden"><Input value={s.origin} onChange={(e) => setSegAt(i, { origin: e.target.value })} maxLength={3} className="uppercase" /></Field>
                <Field label="Nereye" required><Input value={s.destination} onChange={(e) => setSegAt(i, { destination: e.target.value })} maxLength={3} className="uppercase" /></Field>
                <Field label="Taşıyıcı"><Input value={s.carrier} onChange={(e) => setSegAt(i, { carrier: e.target.value })} maxLength={2} className="uppercase" /></Field>
                <Field label="Uçuş No" required><Input value={s.flightNumber} onChange={(e) => setSegAt(i, { flightNumber: e.target.value })} placeholder="1987" /></Field>
                <Field label="Sınıf"><Input value={s.rbd} onChange={(e) => setSegAt(i, { rbd: e.target.value })} maxLength={1} className="uppercase" /></Field>
                <Field label="Kalkış" required>
                  <Input type="datetime-local" value={s.departure ? s.departure.slice(0, 16) : ""}
                    onChange={(e) => { const v = e.target.value; if (v) setSegAt(i, { departure: new Date(v).toISOString(), arrival: new Date(new Date(v).getTime() + 3 * 36e5).toISOString() }); }} />
                </Field>
              </div>
            ))}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelBody>
            <Field label="İletişim" hint="E-posta ya da telefon — bilgilendirme için.">
              <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="ahmet@ornek.com" />
            </Field>
          </PanelBody>
        </Panel>

        {error && <Banner kind="danger" title="Rezervasyon oluşturulamadı">{error}</Banner>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => navigate({ to: "/res" })}>{t("common.cancel")}</Button>
          <Button variant="success" disabled={!valid || create.isPending} onClick={() => { setError(null); create.mutate(); }}>
            {create.isPending ? "Oluşturuluyor…" : "Rezervasyon Oluştur"}
          </Button>
        </div>
      </div>
    </>
  );
}
