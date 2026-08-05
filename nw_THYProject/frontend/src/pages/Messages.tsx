import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { listMessages } from "@/domain/api";
import type { InterlineMessage } from "@/domain/types";
import { PageTitle, Panel, PanelHead, PanelBody } from "@/components/ui/surface";
import { DataTable } from "@/components/ui/table";
import { Pill, type Tone } from "@/components/ui/pill";
import { Modal } from "@/components/ui/overlay";
import { useT } from "@/i18n";
import { formatDateTime } from "@/lib/utils";

// Interline mesajlaşma — outbox'tan çıkan ve gelen belge mesajları.
const TONE: Record<InterlineMessage["status"], Tone> = { sent: "blue", acked: "green", received: "violet", failed: "red" };
const col = createColumnHelper<InterlineMessage>();

export function Messages() {
  const t = useT();
  const [open, setOpen] = useState<InterlineMessage | null>(null);
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
    col.accessor("status", { header: t("common.status"), enableSorting: false, cell: (c) => <Pill tone={TONE[c.getValue()]}>{c.getValue()}</Pill> }),
  ] as ColumnDef<InterlineMessage, unknown>[];

  return (
    <>
      <PageTitle title={t("nav.messages")} hint={t("misc.messages.hint")} />
      <DataTable
        data={data ?? []}
        columns={columns}
        loading={isLoading}
        onRowClick={setOpen}
        rowKey={(m) => `${m.messageType} ${m.partnerCarrier}`}
        pageSize={12}
        exportName="mesajlar"
        empty={{ title: t("misc.messages.empty") }}
      />
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.messageType ?? ""} hint={open?.summary} width="lg">
        {open && (
          <Panel>
            <PanelHead title={t("misc.messages.raw")} hint={`${open.standard} · ${open.partnerCarrier}`} />
            <PanelBody>
              <pre className="num overflow-x-auto whitespace-pre-wrap rounded-md bg-sunken p-3 text-[11.5px] leading-relaxed text-ink-2">
                {open.payloadPreview}
              </pre>
            </PanelBody>
          </Panel>
        )}
      </Modal>
    </>
  );
}
