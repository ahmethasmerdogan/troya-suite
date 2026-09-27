import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Ticket as TicketIcon } from "lucide-react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { listMessages } from "@/domain/api";
import type { InterlineMessage } from "@/domain/types";
import { PageTitle, Panel, PanelHead, PanelBody, Meta, MetaGrid } from "@/components/ui/surface";
import { Chip } from "@/components/layout/views";
import { Button } from "@/components/ui/core";
import { DataTable } from "@/components/ui/table";
import { Pill, type Tone } from "@/components/ui/pill";
import { Modal } from "@/components/ui/overlay";
import { useT, type Key } from "@/i18n";
import { formatDateTime } from "@/lib/utils";

// Interline mesajlaşma — outbox'tan çıkan ve gelen belge mesajları.
const TONE: Record<InterlineMessage["status"], Tone> = { sent: "blue", acked: "green", received: "violet", failed: "red" };
const STATUS_KEY: Record<InterlineMessage["status"], Key> = {
  sent: "misc.messages.status.sent", acked: "misc.messages.status.acked",
  received: "misc.messages.status.received", failed: "misc.messages.status.failed",
};
type Filter = "all" | "outbound" | "inbound" | "failed";
const FILTER_KEY: Record<Filter, Key> = {
  all: "misc.messages.filter.all", outbound: "misc.messages.filter.outbound",
  inbound: "misc.messages.filter.inbound", failed: "misc.messages.filter.failed",
};
const matches = (m: InterlineMessage, f: Filter) =>
  f === "all" ? true : f === "failed" ? m.status === "failed" : m.direction === f;
const col = createColumnHelper<InterlineMessage>();

export function Messages() {
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState<InterlineMessage | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading } = useQuery({ queryKey: ["messages"], queryFn: listMessages });

  const columns = [
    col.accessor("occurredAt", {
      header: t("misc.messages.col.time"),
      meta: { exportValue: (m: InterlineMessage) => formatDateTime(m.occurredAt) },
      cell: (c) => <span className="num text-ink-2">{formatDateTime(c.getValue())}</span>,
    }),
    col.accessor("standard", { header: t("misc.messages.col.standard"), cell: (c) => <Pill tone="gray">{c.getValue()}</Pill> }),
    col.accessor("messageType", { header: t("misc.messages.col.type"), cell: (c) => <span className="num font-medium text-ink">{c.getValue()}</span> }),
    col.accessor("direction", {
      header: t("misc.messages.col.direction"),
      meta: { exportValue: (m: InterlineMessage) => (m.direction === "outbound" ? t("misc.messages.outbound") : t("misc.messages.inbound")) },
      cell: (c) => <span className="text-ink-2">{c.getValue() === "outbound" ? t("misc.messages.outbound") : t("misc.messages.inbound")}</span>,
    }),
    col.accessor("partnerCarrier", { header: "Partner", cell: (c) => <span className="num text-ink-2">{c.getValue()}</span> }),
    col.accessor("ticketNumber", { header: t("misc.messages.col.document"), cell: (c) => <span className="num text-ink-2">{c.getValue() ?? "—"}</span> }),
    col.accessor("status", {
      header: t("common.status"), enableSorting: false,
      meta: { exportValue: (m: InterlineMessage) => t(STATUS_KEY[m.status]) },
      cell: (c) => <Pill tone={TONE[c.getValue()]}>{t(STATUS_KEY[c.getValue()])}</Pill>,
    }),
  ] as ColumnDef<InterlineMessage, unknown>[];

  return (
    <>
      <PageTitle title={t("nav.messages")} hint={t("misc.messages.hint")} />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", "outbound", "inbound", "failed"] as Filter[]).map((f) => (
          <Chip key={f} active={filter === f} count={(data ?? []).filter((m) => matches(m, f)).length} onClick={() => setFilter(f)}>
            {t(FILTER_KEY[f])}
          </Chip>
        ))}
      </div>
      <DataTable
        data={(data ?? []).filter((m) => matches(m, filter))}
        columns={columns}
        loading={isLoading}
        onRowClick={setOpen}
        rowKey={(m) => `${m.messageType} ${m.partnerCarrier}`}
        pageSize={12}
        exportName="mesajlar"
        empty={{ title: t("misc.messages.empty") }}
      />
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.messageType ?? ""}
        hint={open?.summary}
        width="lg"
        footer={open?.ticketNumber ? (
          <Button variant="secondary" onClick={() => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: open.ticketNumber! } })}>
            <TicketIcon size={15} strokeWidth={1.75} /> {t("misc.messages.openTicket")}
          </Button>
        ) : undefined}
      >
        {open && (
          <div className="flex flex-col gap-4">
            <MetaGrid>
              <Meta label={t("misc.messages.col.time")} value={formatDateTime(open.occurredAt)} mono />
              <Meta
                label={t("misc.messages.col.direction")}
                value={
                  <span className="inline-flex items-center gap-1">
                    {open.direction === "outbound" ? <ArrowUpRight size={14} strokeWidth={1.75} /> : <ArrowDownLeft size={14} strokeWidth={1.75} />}
                    {open.direction === "outbound" ? t("misc.messages.outbound") : t("misc.messages.inbound")}
                  </span>
                }
              />
              <Meta label="Partner" value={`${open.partnerCarrier} · ${open.standard}`} mono />
              <Meta label={t("common.status")} value={<Pill tone={TONE[open.status]}>{t(STATUS_KEY[open.status])}</Pill>} />
            </MetaGrid>
            <Panel>
              <PanelHead title={t("misc.messages.raw")} hint={`${open.standard} · ${open.partnerCarrier}`} />
              <PanelBody>
                <pre className="num overflow-x-auto whitespace-pre-wrap rounded-md bg-sunken p-3 text-[11.5px] leading-relaxed text-ink-2">
                  {open.payloadPreview}
                </pre>
              </PanelBody>
            </Panel>
          </div>
        )}
      </Modal>
    </>
  );
}
