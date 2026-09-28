import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  Ban, ChevronDown, Clock, History, MessageSquarePlus, Plane, StickyNote, Ticket as TicketIcon, TicketPlus, User, X,
} from "lucide-react";
import {
  addRemark, cancelPnr, cancelSegment, extendTtl, getPnr, paxKey, ttlState, type Pnr, type PnrRemark,
} from "@/domain/reservation";
import { SplitView, DetailHead, DetailBody } from "@/components/layout/views";
import { PnrListPane } from "@/components/panes/PnrListPane";
import { TtlBadge } from "@/components/domain/TtlBadge";
import { Tip } from "@/components/tips/Tip";
import { PnrStatusPill } from "@/components/domain/PnrStatusPill";
import { Button, Field, IconButton, Input, Select, Textarea } from "@/components/ui/core";
import { Panel, PanelHead, PanelBody, Meta, MetaGrid, Empty } from "@/components/ui/surface";
import { Menu, MenuItem, Modal, useOutside } from "@/components/ui/overlay";
import { Pill } from "@/components/ui/pill";
import { Banner } from "@/components/ui/banner";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n";
import { useErrorText } from "@/lib/useErrorText";
import { useUI } from "@/store/ui";
import { cn, formatDateTime, flightCode } from "@/lib/utils";

// PNR detay — yolcular, segmentler, notlar, geçmiş ve kesilmiş biletler (Troya linkage).

export function PnrDetail() {
  const { pnr: rl } = useParams({ from: "/res/$pnr" });
  const t = useT();
  const errText = useErrorText();
  const lang = useUI((s) => s.lang);
  const user = useUI((s) => s.user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Depo yerinde değişir; sorgu her seferinde yeni üst nesne döndürsün ki ekran yeniden çizilsin.
  const { data: pnr, isLoading } = useQuery({
    queryKey: ["pnr", rl],
    queryFn: async () => { const p = await getPnr(rl); return p ? { ...p } : null; },
    structuralSharing: false,
  });
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useOutside(menuRef, () => setMenu(false));
  const [cancelOpen, setCancelOpen] = useState(false);
  const [remarkOpen, setRemarkOpen] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["pnr", rl] });
    qc.invalidateQueries({ queryKey: ["pnrs"] });
    qc.invalidateQueries({ queryKey: ["queues"] });
  };
  const fail = (e: Error) => toast.danger(t("res.toast.failed"), errText(e));
  const by = user?.name ?? "—";
  const ttlMut = useMutation({ mutationFn: () => extendTtl(rl, by), onSuccess: () => { toast.success(t("res.toast.ttl"), rl); refresh(); }, onError: fail });
  const segMut = useMutation({ mutationFn: (i: number) => cancelSegment(rl, i, by), onSuccess: () => { toast.success(t("res.toast.segCancelled"), rl); refresh(); }, onError: fail });

  const withList = (detail: React.ReactNode) => <SplitView list={<PnrListPane selected={rl} />} detail={detail} />;

  if (isLoading) return withList(<DetailBody><Skeleton className="h-64 w-full" /></DetailBody>);
  if (!pnr) return withList(<DetailBody><p className="text-sm text-ink-2">{t("common.notFound")}: {rl}</p></DetailBody>);

  const ttl = ttlState(pnr);
  const done = new Set(pnr.ticketedPax ?? []);
  const active = pnr.status === "active";
  const liveSegs = pnr.segments.filter((s) => s.status !== "XX").length;
  const history = [...(pnr.history ?? [])].reverse();

  return withList(
    <>
      <DetailHead
        title={
          <>
            <span className="num text-[19px] font-semibold text-ink">{pnr.recordLocator}</span>
            <PnrStatusPill status={pnr.status} done={pnr.ticketedPax?.length ?? 0} total={pnr.passengers.length} />
            {ttl.kind !== "none" && <TtlBadge status={pnr.status} ttl={pnr.ttl} />}
            {ttl.kind !== "none" && <Tip id="res.ttl" />}
          </>
        }
        actions={
          <>
            {/* Biletlenmiş rezervasyonda "Bilet Kes" mükerrer kesime davetiyeydi;
                tüm yolcular biletlendiyse birincil aksiyon kesilmiş bileti açmaktır. */}
            {active ? (
              <Button onClick={() => navigate({ to: "/issue", search: { pnr: pnr.recordLocator } })}>
                <TicketPlus size={15} strokeWidth={1.75} /> {t("nav.issue")}
              </Button>
            ) : pnr.status === "ticketed" && pnr.ticketNumbers[0] ? (
              <Button variant="secondary" onClick={() => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: pnr.ticketNumbers[0] } })}>
                <TicketIcon size={15} strokeWidth={1.75} /> {t("chat.res.openTicket")}
              </Button>
            ) : null}
            {pnr.status !== "cancelled" && (
              <div ref={menuRef} className="relative">
                <Button variant="secondary" onClick={() => setMenu((o) => !o)} aria-expanded={menu}>
                  {t("res.actions")} <ChevronDown size={14} strokeWidth={2} />
                </Button>
                {menu && (
                  <Menu className="w-64">
                    <MenuItem icon={<Clock size={15} strokeWidth={1.75} />} disabled={!active || ttlMut.isPending}
                      onSelect={() => { setMenu(false); ttlMut.mutate(); }}>
                      {t("res.action.extendTtl")}
                    </MenuItem>
                    <MenuItem icon={<MessageSquarePlus size={15} strokeWidth={1.75} />} onSelect={() => { setMenu(false); setRemarkOpen(true); }}>
                      {t("res.action.remark")}
                    </MenuItem>
                    <MenuItem danger icon={<Ban size={15} strokeWidth={1.75} />} disabled={!active}
                      onSelect={() => { setMenu(false); setCancelOpen(true); }}>
                      {t("res.action.cancel")}
                    </MenuItem>
                  </Menu>
                )}
              </div>
            )}
          </>
        }
      />
      <DetailBody>
        {ttl.kind === "warning" && (
          <Banner kind="warning" title={t("chat.res.ttl.warnTitle")}>
            {t("chat.res.ttl.warnBody", { n: ttl.hoursLeft })}
          </Banner>
        )}
        {ttl.kind === "expired" && (
          <Banner kind="danger" title={t("chat.res.ttl.expiredTitle")}>
            {t("chat.res.ttl.expiredBody")}
          </Banner>
        )}

        <Panel>
          <PanelHead title={t("chat.res.reservation")} />
          <PanelBody>
            <MetaGrid>
              <Meta label={t("chat.res.createdAt")} value={formatDateTime(pnr.createdAt)} mono />
              <Meta label={t("common.passenger")} value={String(pnr.passengers.length)} mono />
              <Meta label={t("chat.res.segment")} value={String(liveSegs)} mono />
              <Meta label={t("chat.res.contact")} value={pnr.contact ?? "—"} />
            </MetaGrid>
          </PanelBody>
        </Panel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel>
            <PanelHead title={t("chat.res.passengers")} />
            <PanelBody className="pt-1">
              {pnr.passengers.map((p, i) => (
                <div key={i} className="flex items-center gap-2.5 border-b border-hair py-2.5 last:border-0">
                  <User size={15} strokeWidth={1.75} className="text-ink-3" />
                  <span className="text-[13.5px] text-ink">{p.surname}/{p.givenName}</span>
                  {p.title && <span className="num text-[11.5px] text-ink-3">{p.title}</span>}
                  {pnr.status !== "cancelled" && (
                    <Pill tone={done.has(paxKey(p)) ? "green" : "gray"} className="ml-auto">
                      {done.has(paxKey(p)) ? t("chat.res.paxTicketed") : t("chat.res.paxAwaiting")}
                    </Pill>
                  )}
                </div>
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead title={t("chat.res.segments")} />
            <PanelBody className="pt-1">
              {pnr.segments.map((s, i) => {
                const gone = s.status === "XX";
                return (
                  <div key={i} className={cn("flex items-center gap-3 border-b border-hair py-2.5 last:border-0", gone && "opacity-60")}>
                    <Plane size={15} strokeWidth={1.75} className="flex-shrink-0 text-ink-3" />
                    <span className={cn("num text-[13px] font-medium text-ink", gone && "line-through")}>{flightCode(s.carrier, s.flightNumber)}</span>
                    <span className="num text-[13px] text-ink-2">{s.origin} → {s.destination}</span>
                    <span className="num text-[11.5px] text-ink-3">{s.rbd}</span>
                    <span className="num ml-auto text-[12px] text-ink-3">{formatDateTime(s.departure)}</span>
                    <Pill tone={gone ? "red" : "gray"}>{gone ? t("res.segCancelled") : s.status}</Pill>
                    {active && !gone && liveSegs > 1 && (
                      <IconButton label={`${t("res.action.cancelSeg")} ${flightCode(s.carrier, s.flightNumber)}`} size="sm"
                        disabled={segMut.isPending} onClick={() => segMut.mutate(i)}>
                        <X size={14} strokeWidth={2} />
                      </IconButton>
                    )}
                  </div>
                );
              })}
            </PanelBody>
          </Panel>
        </div>

        {pnr.ticketNumbers.length > 0 && (
          <Panel>
            <PanelHead title={t("chat.res.issuedTickets")} />
            <PanelBody className="flex flex-wrap gap-2 pt-1">
              {pnr.ticketNumbers.map((tn) => (
                <Link key={tn} to="/tickets/$ticketNumber" params={{ ticketNumber: tn }}
                  className="num rounded-md bg-brand-wash px-2.5 py-1.5 text-[12.5px] font-medium text-brand transition-opacity hover:opacity-80">
                  {tn}
                </Link>
              ))}
            </PanelBody>
          </Panel>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel>
            <PanelHead
              title={t("res.remarks")}
              action={pnr.status !== "cancelled" ? (
                <Button variant="ghost" size="sm" onClick={() => setRemarkOpen(true)}><MessageSquarePlus size={15} strokeWidth={1.75} /> {t("res.action.remark")}</Button>
              ) : undefined}
            />
            <PanelBody className="flex flex-col gap-2 pt-2">
              {!pnr.remarks?.length ? (
                <Empty icon={<StickyNote size={20} strokeWidth={1.5} />} title={t("res.remarks.none")} />
              ) : (
                pnr.remarks.map((r, i) => (
                  <div key={i} className="rounded-md border border-line px-3 py-2">
                    <div className="flex items-center gap-2 text-[11.5px] text-ink-3">
                      <Pill tone={r.kind === "OSI" ? "blue" : "gray"}>{r.kind}</Pill>
                      <span>{r.by}</span>
                      <span className="num ml-auto">{formatDateTime(r.at)}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-ink">{r.text}</p>
                  </div>
                ))
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead title={t("res.history")} hint={t("res.history.hint")} />
            <PanelBody className="pt-2">
              <ol className="relative flex flex-col gap-3 border-l border-line pl-4">
                {history.map((h, i) => (
                  <li key={i} className="relative">
                    <span aria-hidden className={cn("absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-panel",
                      h.action === "cancelled" || h.action === "segment_cancelled" ? "bg-[var(--t-red-d)]"
                        : h.action === "ticketed" ? "bg-[var(--t-green-d)]" : "bg-ink-3")} />
                    <div className="text-[13px] text-ink">{lang === "en" ? h.textEn : h.text}</div>
                    <div className="num text-[11.5px] text-ink-3">{formatDateTime(h.at)} · {h.by}</div>
                  </li>
                ))}
                {history.length === 0 && <li className="text-[13px] text-ink-3"><History size={14} className="mr-1 inline" />—</li>}
              </ol>
            </PanelBody>
          </Panel>
        </div>
      </DetailBody>

      {cancelOpen && <CancelPnrModal pnr={pnr} by={by} onClose={() => setCancelOpen(false)} onDone={() => { setCancelOpen(false); refresh(); }} />}
      {remarkOpen && <RemarkModal rl={pnr.recordLocator} by={by} onClose={() => setRemarkOpen(false)} onDone={() => { setRemarkOpen(false); refresh(); }} />}
    </>,
  );
}

function CancelPnrModal({ pnr, by, onClose, onDone }: { pnr: Pnr; by: string; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const errText = useErrorText();
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => cancelPnr(pnr.recordLocator, by, reason.trim() || undefined),
    onSuccess: () => { toast.success(t("res.toast.cancelled"), pnr.recordLocator); onDone(); },
    onError: (e: Error) => toast.danger(t("res.toast.failed"), errText(e)),
  });
  return (
    <Modal open onClose={onClose} width="sm" title={t("res.cancel.title")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="danger" disabled={m.isPending} onClick={() => m.mutate()}>{t("res.cancel.confirm")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13.5px] leading-relaxed text-ink-2">{t("res.cancel.body")}</p>
        <Field label={t("res.cancel.reason")}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function RemarkModal({ rl, by, onClose, onDone }: { rl: string; by: string; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const errText = useErrorText();
  const [kind, setKind] = useState<PnrRemark["kind"]>("RM");
  const [text, setText] = useState("");
  const m = useMutation({
    mutationFn: () => addRemark(rl, kind, text, by),
    onSuccess: () => { toast.success(t("res.toast.remark"), rl); onDone(); },
    onError: (e: Error) => toast.danger(t("res.toast.failed"), errText(e)),
  });
  return (
    <Modal open onClose={onClose} width="md" title={t("res.remark.title")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={text.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>{t("res.remark.save")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label={t("res.remark.kind")}>
          <Select value={kind} onChange={(e) => setKind(e.target.value as PnrRemark["kind"])}>
            <option value="RM">{t("res.remark.rm")}</option>
            <option value="OSI">{t("res.remark.osi")}</option>
          </Select>
        </Field>
        <Field label={t("res.remark.text")}>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={200} />
        </Field>
      </div>
    </Modal>
  );
}
