import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateRecords } from "@/lib/invalidate";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { CalendarSearch, Plus, Trash2 } from "lucide-react";
import { createPnr, type ReservationSegment } from "@/domain/reservation";
import { FARE_TYPES } from "@/domain/fareTypes";
import { AirportPicker, DayPicker, TimePicker, ymd } from "@/components/ui/pickers";
import { useUI } from "@/store/ui";
import type { Passenger } from "@/domain/types";
import { Button, Field, Input, Select } from "@/components/ui/core";
import { PageTitle, Panel, PanelHead, PanelBody } from "@/components/ui/surface";
import { Banner } from "@/components/ui/banner";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n";
import { useErrorText } from "@/lib/useErrorText";

// Yeni rezervasyon — yolcu ve segment girişi, sonra PNR üretimi.
const emptyPax = (): Passenger => ({ surname: "", givenName: "", title: "MR" });
const emptySeg = (): ReservationSegment => ({
  origin: "IST", destination: "", carrier: "TK", flightNumber: "", rbd: "Y",
  departure: "", arrival: "", status: "HK",
});

export function CreatePnr() {
  const t = useT();
  const errText = useErrorText();
  const navigate = useNavigate();
  const user = useUI((x) => x.user);
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

  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: () => createPnr({
      passengers: pax.map((p) => ({ ...p, surname: p.surname.trim().toUpperCase(), givenName: p.givenName.trim().toUpperCase() })),
      segments: segs.map((s) => ({ ...s, origin: s.origin.toUpperCase(), destination: s.destination.toUpperCase(), carrier: s.carrier.toUpperCase(), rbd: s.rbd.toUpperCase() })),
      contact: contact || undefined,
      by: user?.name,
    }),
    onSuccess: (p) => {
      // Liste, PNR panosu ve kuyruklar yeni kaydı hemen göstersin.
      invalidateRecords(qc);
      toast.success(t("chat.res.new.created"), `PNR ${p.recordLocator}`);
      navigate({ to: "/res/$pnr", params: { pnr: p.recordLocator } });
    },
    onError: (e: Error) => setError(errText(e)),
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
            action={
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/res/availability" })}><CalendarSearch size={15} strokeWidth={1.75} /> {t("res.new.pickFromAvail")}</Button>
                <Button variant="secondary" size="sm" onClick={() => setSegs((a) => [...a, { ...emptySeg(), origin: a[a.length - 1]?.destination || "IST" }])}><Plus size={15} strokeWidth={2} /> {t("chat.res.segment")}</Button>
              </>
            }
          />
          <PanelBody className="flex flex-col gap-3">
            {segs.map((s, i) => {
              // Kalkış yerel gün + saat olarak seçilir; varış bilinmiyorsa +3 sa varsayılır.
              const dep = s.departure ? new Date(s.departure) : null;
              const day = dep ? ymd(dep) : "";
              const time = dep ? `${String(dep.getHours()).padStart(2, "0")}:${String(dep.getMinutes()).padStart(2, "0")}` : "";
              const setDep = (d: string, tm: string) => {
                if (!d) return;
                const iso = new Date(`${d}T${tm || "09:00"}:00`);
                setSegAt(i, { departure: iso.toISOString(), arrival: new Date(iso.getTime() + 3 * 36e5).toISOString() });
              };
              return (
                <div key={i} className="grid grid-cols-2 gap-3 border-b border-hair pb-3 last:border-0 last:pb-0 sm:grid-cols-4 xl:grid-cols-8">
                  <Field label={t("chat.res.field.origin")}><AirportPicker value={s.origin} onChange={(v) => setSegAt(i, { origin: v })} placeholder="IST" /></Field>
                  <Field label={t("chat.res.field.destination")} required><AirportPicker value={s.destination} onChange={(v) => setSegAt(i, { destination: v })} placeholder="LHR" /></Field>
                  <Field label={t("chat.res.field.carrier")}><Input value={s.carrier} onChange={(e) => setSegAt(i, { carrier: e.target.value.toUpperCase() })} maxLength={2} className="uppercase" /></Field>
                  <Field label={t("chat.res.field.flightNumber")} required><Input value={s.flightNumber} onChange={(e) => setSegAt(i, { flightNumber: e.target.value })} placeholder="1987" className="num" /></Field>
                  <Field label={t("chat.res.field.rbd")}>
                    <Select value={s.rbd} onChange={(e) => setSegAt(i, { rbd: e.target.value })}>
                      {[...new Set([s.rbd, ...FARE_TYPES.map((f) => f.rbd)])].map((r) => (
                        <option key={r} value={r}>{r}{FARE_TYPES.find((f) => f.rbd === r) ? ` · ${FARE_TYPES.find((f) => f.rbd === r)!.label}` : ""}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("chat.res.field.departure")} required className="sm:col-span-2">
                    <DayPicker value={day} onChange={(d) => setDep(d, time)} min={ymd(new Date())} />
                  </Field>
                  <Field label={t("res.new.depTime")}>
                    <TimePicker value={time} onChange={(tm) => setDep(day || ymd(new Date()), tm)} />
                  </Field>
                  {segs.length > 1 && (
                    <div className="col-span-full flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setSegs((a) => a.filter((_, j) => j !== i))}>
                        <Trash2 size={15} strokeWidth={1.75} /> {t("chat.res.remove")}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
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
          <Button disabled={!valid || create.isPending} onClick={() => { setError(null); create.mutate(); }}>
            {create.isPending ? t("chat.res.new.creating") : t("chat.res.new.submit")}
          </Button>
        </div>
      </div>
    </>
  );
}
