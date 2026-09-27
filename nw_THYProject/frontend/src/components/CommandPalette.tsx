import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import {
  BookMarked, ClipboardList, FileText, LayoutDashboard, Package, PlaneTakeoff,
  Search, Ticket, TicketPlus, Inbox } from "lucide-react";
import { searchEmds, searchTickets } from "@/domain/api";
import { searchPnrs } from "@/domain/reservation";
import type { Emd, TicketSummary } from "@/domain/types";
import type { PnrSummary } from "@/domain/reservation";
import { useUI } from "@/store/ui";
import { useT, translate } from "@/i18n";
import { Kbd } from "@/components/ui/core";
import { cn } from "@/lib/utils";

/**
 * ⌘K — birleşik retrieval.
 *
 * Troya'nın kriptik komut satırının yerine geçen tek giriş noktası:
 * yazılan şeyin NE olduğunu biçiminden anlar (13 hane → belge, 6 alfanümerik
 * → PNR, ORD… → order) ve doğrudan kaydı açar. Bulamazsa metin araması yapar.
 */
export function CommandPalette() {
  const open = useUI((s) => s.commandOpen);
  const setOpen = useUI((s) => s.setCommandOpen);
  const navigate = useNavigate();
  const t = useT();
  const [q, setQ] = useState("");

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [emds, setEmds] = useState<Emd[]>([]);
  const [pnrs, setPnrs] = useState<PnrSummary[]>([]);

  // ⌘K / Ctrl+K her yerden açar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        useUI.getState().toggleCommand();
        return;
      }
      // Palette "ESC" rozetini gösteriyordu ama tuş bağlı değildi.
      if (e.key === "Escape" && useUI.getState().commandOpen) {
        e.preventDefault();
        useUI.getState().setCommandOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (!open) setQ(""); }, [open]);

  // Arama — kısa sorguda ağ yok.
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) { setTickets([]); setEmds([]); setPnrs([]); return; }
    let alive = true;
    const timer = setTimeout(async () => {
      const [t, e, p] = await Promise.all([searchTickets(term), searchEmds(term), searchPnrs(term)]);
      if (!alive) return;
      setTickets(t.slice(0, 5));
      setEmds(e.slice(0, 4));
      setPnrs(p.slice(0, 4));
    }, 140);
    return () => { alive = false; clearTimeout(timer); };
  }, [q, open]);

  // Etiketleri sözlükten okur; her render'da yeniden çalışması dil değişince
  // rozetin de dönmesini sağlar (hesap zaten bir regex kadar ucuz).
  const shape = detect(q);
  const go = (fn: () => void) => { setOpen(false); fn(); };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={t("search.cmd.label")}>
      <div className="anim-fade absolute inset-0 bg-[rgba(26,26,23,0.45)] backdrop-blur-[3px] dark:bg-black/60" onClick={() => setOpen(false)} />
      <Command
        label={t("search.cmd.label")}
        shouldFilter={false}
        className="anim-pop absolute left-1/2 top-[14vh] w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-panel"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} strokeWidth={1.75} className="text-ink-3" />
          <Command.Input
            value={q}
            onValueChange={setQ}
            autoFocus
            placeholder={t("search.cmd.placeholder")}
            className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
          />
          {shape && <span className="num shrink-0 rounded-sm bg-sunken px-1.5 py-0.5 text-[11px] text-ink-2">{shape.hint}</span>}
          <Kbd>ESC</Kbd>
        </div>

        <Command.List className="max-h-[52vh] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-8 text-center text-[13px] text-ink-3">
            {q.trim().length < 2 ? t("search.cmd.minChars") : t("search.cmd.noResult")}
          </Command.Empty>

          {/* Biçimden anlaşılan doğrudan hedef — en üstte, tek tuşla açılır. */}
          {shape?.direct && (
            <Group heading={t("search.cmd.group.direct")}>
              <Row
                icon={shape.direct.icon}
                mono
                label={shape.direct.label}
                hint={shape.direct.hint}
                onSelect={() => go(shape.direct!.go(navigate))}
              />
            </Group>
          )}

          {tickets.length > 0 && (
            <Group heading={t("search.cmd.group.tickets")}>
              {tickets.map((t) => (
                <Row
                  key={t.ticketNumber}
                  icon={<Ticket size={15} strokeWidth={1.75} />}
                  mono
                  label={t.ticketNumber}
                  hint={`${t.passengerName} · ${t.route}`}
                  onSelect={() => go(() => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: t.ticketNumber } }))}
                />
              ))}
            </Group>
          )}

          {emds.length > 0 && (
            <Group heading={t("search.cmd.group.emds")}>
              {emds.map((e) => (
                <Row
                  key={e.emdNumber}
                  icon={<Package size={15} strokeWidth={1.75} />}
                  mono
                  label={e.emdNumber}
                  hint={e.coupons[0]?.description}
                  onSelect={() => go(() => navigate({ to: "/emds/$emdNumber", params: { emdNumber: e.emdNumber } }))}
                />
              ))}
            </Group>
          )}

          {pnrs.length > 0 && (
            <Group heading={t("search.cmd.group.pnrs")}>
              {pnrs.map((p) => (
                <Row
                  key={p.recordLocator}
                  icon={<BookMarked size={15} strokeWidth={1.75} />}
                  mono
                  label={p.recordLocator}
                  hint={`${p.passengerName} · ${p.route}`}
                  onSelect={() => go(() => navigate({ to: "/res/$pnr", params: { pnr: p.recordLocator } }))}
                />
              ))}
            </Group>
          )}

          <Group heading={t("search.cmd.group.go")}>
            <Row icon={<TicketPlus size={15} strokeWidth={1.75} />} label={t("nav.issue")} onSelect={() => go(() => navigate({ to: "/issue" }))} />
            <Row icon={<Search size={15} strokeWidth={1.75} />} label={t("nav.search")} onSelect={() => go(() => navigate({ to: "/search" }))} />
            <Row icon={<Inbox size={15} strokeWidth={1.75} />} label={t("nav.queues")} hint="Q8 · Q7 · QT" onSelect={() => go(() => navigate({ to: "/queues" }))} />
            <Row icon={<Package size={15} strokeWidth={1.75} />} label={t("nav.emd.search")} onSelect={() => go(() => navigate({ to: "/emds" }))} />
            <Row icon={<ClipboardList size={15} strokeWidth={1.75} />} label={t("nav.report")} onSelect={() => go(() => navigate({ to: "/report" }))} />
            <Row icon={<PlaneTakeoff size={15} strokeWidth={1.75} />} label={t("nav.section.checkin")} onSelect={() => go(() => navigate({ to: "/checkin" }))} />
            <Row icon={<LayoutDashboard size={15} strokeWidth={1.75} />} label={t("module.panel")} onSelect={() => go(() => navigate({ to: "/" }))} />
          </Group>
        </Command.List>
      </Command>
    </div>,
    document.body,
  );
}

/* --- yazılanın biçiminden hedefi anla -------------------------------- */
type Nav = ReturnType<typeof useNavigate>;
function detect(raw: string): { hint: string; direct?: { icon: React.ReactNode; label: string; hint: string; go: (n: Nav) => () => void } } | null {
  const s = raw.trim().toUpperCase();
  if (!s) return null;
  if (/^\d{13}$/.test(s))
    return {
      hint: translate("search.cmd.shape.digits13"),
      direct: {
        icon: <Ticket size={15} strokeWidth={1.75} />,
        label: s,
        hint: translate("search.cmd.open.ticket"),
        go: (n) => () => n({ to: "/tickets/$ticketNumber", params: { ticketNumber: s } }),
      },
    };
  if (/^ORD[-\w]*$/.test(s))
    return {
      hint: translate("search.cmd.shape.order"),
      direct: {
        icon: <FileText size={15} strokeWidth={1.75} />,
        label: s,
        hint: translate("search.cmd.open.order"),
        go: (n) => () => n({ to: "/orders/$orderId", params: { orderId: s } }),
      },
    };
  if (/^[A-Z0-9]{6}$/.test(s))
    return {
      hint: translate("search.cmd.shape.pnr"),
      direct: {
        icon: <BookMarked size={15} strokeWidth={1.75} />,
        label: s,
        hint: translate("search.cmd.open.pnr"),
        go: (n) => () => n({ to: "/res/$pnr", params: { pnr: s } }),
      },
    };
  return { hint: translate("search.shape.text") };
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="px-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-ink-3"
    >
      {children}
    </Command.Group>
  );
}

function Row({
  icon, label, hint, mono, onSelect,
}: { icon: React.ReactNode; label: string; hint?: string; mono?: boolean; onSelect: () => void }) {
  return (
    <Command.Item
      value={`${label} ${hint ?? ""}`}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ink aria-selected:bg-brand-wash aria-selected:text-brand"
    >
      <span className="text-ink-3">{icon}</span>
      <span className={cn(mono && "num")}>{label}</span>
      {hint && <span className="ml-auto truncate text-[11.5px] text-ink-3">{hint}</span>}
    </Command.Item>
  );
}
