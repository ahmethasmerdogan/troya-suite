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
    col.accessor("occurredAt", { header: "Zaman", cell: (c) => <span className="num text-ink-2">{formatDateTime(c.getValue())}</span> }),
    col.accessor("standard", { header: "Standart", cell: (c) => <Pill tone="gray">{c.getValue()}</Pill> }),
    col.accessor("messageType", { header: "Tip", cell: (c) => <span className="num font-medium text-ink">{c.getValue()}</span> }),
    col.accessor("direction", { header: "Yön", cell: (c) => <span className="text-ink-2">{c.getValue() === "outbound" ? "Giden" : "Gelen"}</span> }),
    col.accessor("partnerCarrier", { header: "Partner", cell: (c) => <span className="num text-ink-2">{c.getValue()}</span> }),
    col.accessor("ticketNumber", { header: "Belge", cell: (c) => <span className="num text-ink-2">{c.getValue() ?? "—"}</span> }),
    col.accessor("status", { header: "Durum", enableSorting: false, cell: (c) => <Pill tone={TONE[c.getValue()]}>{c.getValue()}</Pill> }),
  ] as ColumnDef<InterlineMessage, unknown>[];

  return (
    <>
      <PageTitle title={t("nav.messages")} hint="Ortak taşıyıcılarla belge mesajlaşması — EDIFACT, NDC ve ONE Order zarfları." />
      <DataTable
        data={data ?? []}
        columns={columns}
        loading={isLoading}
        onRowClick={setOpen}
        rowKey={(m) => `${m.messageType} ${m.partnerCarrier}`}
        pageSize={12}
        exportName="mesajlar"
        empty={{ title: "Mesaj yok" }}
      />
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.messageType ?? ""} hint={open?.summary} width="lg">
        {open && (
          <Panel>
            <PanelHead title="Ham mesaj" hint={`${open.standard} · ${open.partnerCarrier}`} />
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
