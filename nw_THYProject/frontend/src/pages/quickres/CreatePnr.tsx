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
      toast.success(t("chat.res.new.created"), `PNR ${p.recordLocator}`);
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
      <PageTitle title={t("nav.res.new")} hint={t("chat.res.new.hint")} />

      <div className="flex flex-col gap-4">
        {q.fn && q.dep && (
          <Banner kind="info" title={t("chat.res.new.fromAvail")}>
            {t("chat.res.new.fromAvailBody", {
              flight: `${q.cx ?? ""}${q.fn}`,
              o: q.o ?? "",
              d: q.d ?? "",
              rbd: q.rbd ?? "",
            })}
          </Banner>
        )}
        <Panel>
          <PanelHead
            title={t("chat.res.passengers")}
            hint={t("chat.res.new.paxHint")}
            action={<Button variant="secondary" size="sm" onClick={() => setPax((a) => [...a, emptyPax()])}><Plus size={15} strokeWidth={2} /> {t("common.passenger")}</Button>}
          />
          <PanelBody className="flex flex-col gap-3">
            {pax.map((p, i) => (
              <div key={i} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <Field label={t("chat.res.field.surname")} required><Input value={p.surname} onChange={(e) => setPaxAt(i, { surname: e.target.value })} placeholder="ERDOGAN" className="uppercase" /></Field>
                <Field label={t("chat.res.field.givenName")} required><Input value={p.givenName} onChange={(e) => setPaxAt(i, { givenName: e.target.value })} placeholder="AHMET" className="uppercase" /></Field>
                <Field label={t("chat.res.field.title")}>
                  <Select value={p.title} onChange={(e) => setPaxAt(i, { title: e.target.value })}>
                    {["MR", "MRS", "MS", "CHD", "INF"].map((x) => <option key={x}>{x}</option>)}
                  </Select>
                </Field>
                <div className="flex items-end">
                  {pax.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => setPax((a) => a.filter((_, j) => j !== i))}>
                      <Trash2 size={15} strokeWidth={1.75} /> {t("chat.res.remove")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead
            title={t("chat.res.segments")}
            hint={t("chat.res.new.segHint")}
            action={<Button variant="secondary" size="sm" onClick={() => setSegs((a) => [...a, emptySeg()])}><Plus size={15} strokeWidth={2} /> {t("chat.res.segment")}</Button>}
          />
          <PanelBody className="flex flex-col gap-3">
            {segs.map((s, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                <Field label={t("chat.res.field.origin")}><Input value={s.origin} onChange={(e) => setSegAt(i, { origin: e.target.value })} maxLength={3} className="uppercase" /></Field>
                <Field label={t("chat.res.field.destination")} required><Input value={s.destination} onChange={(e) => setSegAt(i, { destination: e.target.value })} maxLength={3} className="uppercase" /></Field>
                <Field label={t("chat.res.field.carrier")}><Input value={s.carrier} onChange={(e) => setSegAt(i, { carrier: e.target.value })} maxLength={2} className="uppercase" /></Field>
                <Field label={t("chat.res.field.flightNumber")} required><Input value={s.flightNumber} onChange={(e) => setSegAt(i, { flightNumber: e.target.value })} placeholder="1987" /></Field>
                <Field label={t("chat.res.field.rbd")}><Input value={s.rbd} onChange={(e) => setSegAt(i, { rbd: e.target.value })} maxLength={1} className="uppercase" /></Field>
                <Field label={t("chat.res.field.departure")} required>
                  <Input type="datetime-local" value={s.departure ? s.departure.slice(0, 16) : ""}
                    onChange={(e) => { const v = e.target.value; if (v) setSegAt(i, { departure: new Date(v).toISOString(), arrival: new Date(new Date(v).getTime() + 3 * 36e5).toISOString() }); }} />
                </Field>
              </div>
            ))}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelBody>
            <Field label={t("chat.res.contact")} hint={t("chat.res.new.contactHint")}>
              <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="ahmet@ornek.com" />
            </Field>
          </PanelBody>
        </Panel>

        {error && <Banner kind="danger" title={t("chat.res.new.error")}>{error}</Banner>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => navigate({ to: "/res" })}>{t("common.cancel")}</Button>
          <Button variant="success" disabled={!valid || create.isPending} onClick={() => { setError(null); create.mutate(); }}>
            {create.isPending ? t("chat.res.new.creating") : t("chat.res.new.submit")}
          </Button>
        </div>
      </div>
    </>
  );
}
