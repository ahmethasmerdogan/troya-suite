import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BadgeCheck, CircleAlert, CircleX, FileCheck2, IdCard, ShieldCheck } from "lucide-react";
import {
  LATE_REASONS, paxDocCheck, recordOkToBoard, recordPassportExpiry, recordTravelPermit,
  type CheckinPassenger, type DepartureFlight, type LateReason,
} from "@/domain/checkin";
import { PERMIT_TYPES, permitName, type DocVerdict } from "@/domain/travelDocs";
import { airportByCode } from "@/domain/airports";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/core";
import { Modal } from "@/components/ui/overlay";
import { DayPicker } from "@/components/ui/pickers";
import { Pill, type Tone } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { usePerm } from "@/lib/usePerm";
import { useT, type Key } from "@/i18n";
import { useErrorText } from "@/lib/useErrorText";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

export const VERDICT_TONE: Record<DocVerdict, Tone> = { ok: "green", conditional: "amber", not_ok: "red" };
export const VERDICT_PILL: Record<DocVerdict, Key> = { ok: "desk.pill.docsOk", conditional: "desk.pill.docsWarn", not_ok: "desk.pill.docsNotOk" };
const VERDICT_TEXT: Record<DocVerdict, Key> = { ok: "docs.verdict.ok", conditional: "docs.verdict.conditional", not_ok: "docs.verdict.not_ok" };
const VERDICT_ICON = { ok: BadgeCheck, conditional: CircleAlert, not_ok: CircleX };

/**
 * Seyahat belgesi kontrolü — gişenin Timatic ekranı.
 *
 * Üstte karar (OK / şartlı / NOT OK) ve gerekçe satırları; altında kararı
 * değiştirebilecek üç kayıt: pasaport son geçerliliği, giriş izni ve —
 * yalnız süpervizörde — varış ülkesi makamının "OK TO BOARD" onayı.
 * Her kayıt sunucuya gider; karar sunucudaki kuraldan yeniden hesaplanır.
 */
export function DocsModal({
  flight, pax, onClose, onSaved,
}: { flight: DepartureFlight; pax: CheckinPassenger; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const errText = useErrorText();
  const lang = useUI((s) => s.lang);
  const user = useUI((s) => s.user);
  const { can } = usePerm();
  const check = paxDocCheck(pax, flight);
  const Icon = VERDICT_ICON[check.verdict];

  const [expiry, setExpiry] = useState(pax.passportExpiry ?? "");
  const [ptype, setPtype] = useState(pax.visa?.type ?? check.permitType ?? PERMIT_TYPES[0]);
  const [pnum, setPnum] = useState(pax.visa?.number ?? "");
  const [puntil, setPuntil] = useState(pax.visa?.validUntil ?? "");
  const [otb, setOtb] = useState("");

  const done = (p: CheckinPassenger) => { toast.success(t("docs.toast.saved"), `${p.surname}/${p.givenName}`); onSaved(); };
  const fail = (e: Error) => toast.danger(t("docs.toast.failed"), errText(e));
  const saveExpiry = useMutation({ mutationFn: () => recordPassportExpiry(flight.flightId, pax.id, expiry), onSuccess: done, onError: fail });
  const savePermit = useMutation({
    mutationFn: () => recordTravelPermit(flight.flightId, pax.id, { type: ptype, number: pnum, validUntil: puntil }),
    onSuccess: done, onError: fail,
  });
  const saveOtb = useMutation({ mutationFn: () => recordOkToBoard(flight.flightId, pax.id, otb, user?.name ?? "—"), onSuccess: done, onError: fail });

  const from = airportByCode(flight.origin)?.countryCode ?? flight.origin;
  const to = airportByCode(flight.destination)?.countryCode ?? flight.destination;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal open onClose={onClose} width="lg" title={t("docs.title")} hint={t("docs.hint")}>
      <div className="flex flex-col gap-5">
        {/* karar */}
        <div
          className={cn("flex items-start gap-3 rounded-md border px-4 py-3",
            check.verdict === "ok" ? "border-[var(--t-green-d)] bg-[var(--t-green-w)]"
              : check.verdict === "conditional" ? "border-[var(--t-amber-d)] bg-[var(--t-amber-w)]"
                : "border-[var(--t-red-d)] bg-[var(--t-red-w)]")}
        >
          <Icon size={22} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" style={{ color: `var(--t-${VERDICT_TONE[check.verdict]}-d)` }} />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-ink">{t(VERDICT_TEXT[check.verdict])}</div>
            <div className="num mt-0.5 text-[12.5px] text-ink-2">
              {pax.surname}/{pax.givenName} · {t("docs.route", { nat: pax.nationality ?? "—", from, to })}
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {check.lines.map((l, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px]">
                  <span className={cn("mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full",
                    !l.ok ? "bg-[var(--t-red-d)]" : l.warn ? "bg-[var(--t-amber-d)]" : "bg-[var(--t-green-d)]")} />
                  <span className="text-ink">{lang === "en" ? l.en : l.tr}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* pasaport */}
        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-ink"><IdCard size={15} strokeWidth={1.75} className="text-ink-3" /> {t("docs.section.passport")}</h3>
          {pax.passport ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="num rounded-md border border-line bg-sunken px-3 py-2 text-[13px] text-ink">{pax.nationality} · {pax.passport}</div>
              <Field label={t("docs.expiry")} className="w-56">
                <DayPicker value={expiry} onChange={setExpiry} quick={false} placeholder="—" />
              </Field>
              <Button variant="secondary" size="sm" disabled={!expiry || expiry === pax.passportExpiry || saveExpiry.isPending} onClick={() => saveExpiry.mutate()}>
                {t("docs.saveExpiry")}
              </Button>
            </div>
          ) : (
            <p className="text-[13px] text-ink-3">{t("docs.passport.none")}</p>
          )}
        </section>

        {/* izin */}
        {(check.permitType || pax.visa) && (
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-ink"><FileCheck2 size={15} strokeWidth={1.75} className="text-ink-3" /> {t("docs.section.permit")}</h3>
            {check.permitType && (
              <p className="text-[12.5px] text-ink-2">{t("docs.permit.needed", { p: permitName(check.permitType, lang) })}</p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1.2fr]">
              <Field label={t("docs.permit.type")}>
                <Select value={ptype} onChange={(e) => setPtype(e.target.value)}>
                  {PERMIT_TYPES.map((p) => <option key={p} value={p}>{permitName(p, lang)}</option>)}
                </Select>
              </Field>
              <Field label={t("docs.permit.number")}>
                <Input value={pnum} onChange={(e) => setPnum(e.target.value.toUpperCase())} className="num uppercase" placeholder="D1234567" />
              </Field>
              <Field label={t("docs.permit.until")}>
                <DayPicker value={puntil} onChange={setPuntil} quick={false} min={today} placeholder="—" />
              </Field>
            </div>
            <div>
              <Button variant="secondary" size="sm" disabled={!pnum.trim() || !puntil || savePermit.isPending} onClick={() => savePermit.mutate()}>
                {t("docs.permit.save")}
              </Button>
            </div>
          </section>
        )}

        {/* OK TO BOARD */}
        {check.verdict === "not_ok" && (
          <section className="flex flex-col gap-2 rounded-md border border-line bg-sunken p-3">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-ink"><ShieldCheck size={15} strokeWidth={1.75} className="text-ink-3" /> {t("docs.section.otb")}</h3>
            <p className="text-[12.5px] text-ink-2">{t("docs.otb.hint")}</p>
            {can("checkin.override") ? (
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t("docs.otb.ref")} className="w-64">
                  <Input value={otb} onChange={(e) => setOtb(e.target.value.toUpperCase())} className="num uppercase" placeholder="OTB-DE-12345" />
                </Field>
                <Button variant="secondary" size="sm" disabled={otb.trim().length < 4 || saveOtb.isPending} onClick={() => saveOtb.mutate()}>
                  {t("docs.otb.save")}
                </Button>
              </div>
            ) : (
              <Pill tone="gray">{t("docs.otb.locked")}</Pill>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}

/**
 * Geç kabul — kontuar kapandıktan sonra, kapı kapanmadan önce.
 * Gerekçe ve onaylayan koltuk seçimine taşınır; kabul sunucuda bu bilgiyle
 * yapılır ve yolcu kaydına yazılır.
 */
export function LateAcceptModal({
  pax, onClose, onContinue,
}: { pax: CheckinPassenger; onClose: () => void; onContinue: (late: { reason: LateReason; note?: string }) => void }) {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const user = useUI((s) => s.user);
  const [reason, setReason] = useState<LateReason>("CONN");
  const [note, setNote] = useState("");
  const needNote = reason === "OTHER" && !note.trim();

  return (
    <Modal
      open
      onClose={onClose}
      width="md"
      title={t("late.title")}
      hint={t("late.hint")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={needNote} onClick={() => onContinue({ reason, note: note.trim() || undefined })}>{t("late.continue")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="text-[13px] text-ink-2"><b className="text-ink">{pax.surname}/{pax.givenName}</b> · PNR <span className="num">{pax.pnr}</span></div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-[13px] font-medium text-ink">{t("late.reason")}</legend>
          {LATE_REASONS.map((r) => (
            <label key={r.code} className={cn("flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-[13px] transition-colors",
              reason === r.code ? "border-brand bg-brand-wash text-ink" : "border-line text-ink-2 hover:bg-sunken")}>
              <input type="radio" name="late-reason" value={r.code} checked={reason === r.code} onChange={() => setReason(r.code)} className="accent-[var(--brand)]" />
              <span className="num w-12 text-[11.5px] font-semibold text-ink-3">{r.code}</span>
              {lang === "en" ? r.en : r.tr}
            </label>
          ))}
        </fieldset>
        <Field label={t("late.note")} hint={reason === "OTHER" ? t("late.note.required") : undefined} required={reason === "OTHER"}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Field>
        <div className="text-[12.5px] text-ink-3">{t("late.approver")}: <span className="font-medium text-ink">{user?.name ?? "—"}</span></div>
      </div>
    </Modal>
  );
}

/** Uçuş kapanışı onayı — geri alınamaz işlem tek tıkla yapılmaz. */
export function CloseOutModal({
  noShow, pending, onClose, onConfirm, earlyMin,
}: { noShow: number; pending: boolean; onClose: () => void; onConfirm: () => void; earlyMin?: number }) {
  const t = useT();
  // Çift tıklama ikinci kapanışı "zaten kapatılmış" hatasıyla denemesin.
  const fired = useRef(false);
  const confirm = () => { if (fired.current) return; fired.current = true; onConfirm(); };
  return (
    <Modal
      open
      onClose={onClose}
      width="sm"
      title={t("close.title")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="danger" disabled={pending} onClick={confirm}>{t("close.confirm")}</Button>
        </>
      }
    >
      {earlyMin != null && earlyMin > 15 && (
        <p className="mb-3 rounded-md bg-[var(--t-amber-w,#fff7e6)] px-3 py-2 text-[13px] text-[var(--t-amber-i)]">
          {t("close.early", { n: earlyMin })}
        </p>
      )}
      <p className="text-[13.5px] leading-relaxed text-ink-2">{t("close.body", { n: noShow })}</p>
    </Modal>
  );
}
