import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import {
  TicketPlus, Search, ArrowLeftRight, Undo2, Ban, FileText, Ticket as TicketIcon,
  Package, MessagesSquare, Handshake,
} from "lucide-react";
import { useUI } from "@/store/ui";
import { isValidTicketNumber } from "@/domain/ticketNumber";

// Command palette — DESIGN_SYSTEM §8.9 + DESIGN_ROADMAP §2.
// Fuzzy, aksiyon grupları, son işlemler. Uzman hızının anahtarı.
export function CommandPalette() {
  const { commandOpen, setCommandOpen, toggleCommand, recentTickets, recentSearches, pushSearch } = useUI();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  // ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleCommand();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleCommand]);

  const run = (fn: () => void) => {
    setCommandOpen(false);
    setSearch("");
    fn();
  };

  const trimmed = search.trim();
  const looksLikeTicketNo = /^\d{6,13}$/.test(trimmed);

  return (
    <Command.Dialog
      open={commandOpen}
      onOpenChange={setCommandOpen}
      label="Komut paleti"
      className="fixed inset-0 z-50"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-[rgba(10,11,13,0.4)]"
        onClick={() => setCommandOpen(false)}
      />
      <div className="absolute left-1/2 top-[18vh] w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-surface shadow-md">
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4">
          <Search size={16} strokeWidth={1.75} className="text-tertiary" />
          <Command.Input
            autoFocus
            value={search}
            onValueChange={setSearch}
            placeholder="Komut veya bilet ara…"
            className="h-12 w-full bg-transparent text-sm text-primary outline-none placeholder:text-tertiary"
          />
        </div>
        <Command.List className="max-h-[360px] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-tertiary">
            Sonuç yok.
          </Command.Empty>

          {trimmed && (
            <Group heading="Bilet">
              {looksLikeTicketNo && (
                <Item
                  onSelect={() => run(() => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: trimmed } }))}
                  icon={<TicketIcon size={16} strokeWidth={1.75} />}
                  label={`Bileti aç: ${trimmed}`}
                  mono
                  hint={isValidTicketNumber(trimmed) ? "check ✓" : undefined}
                />
              )}
              <Item
                onSelect={() => run(() => { pushSearch(trimmed); navigate({ to: "/search", search: { q: trimmed } }); })}
                icon={<Search size={16} strokeWidth={1.75} />}
                label={`"${trimmed}" için ara`}
                hint="↵"
              />
            </Group>
          )}

          <Group heading="Aksiyonlar">
            <Item onSelect={() => run(() => navigate({ to: "/issue" }))} icon={<TicketPlus size={16} strokeWidth={1.75} />} label="Yeni bilet kes" shortcut="n" />
            <Item onSelect={() => run(() => navigate({ to: "/search" }))} icon={<Search size={16} strokeWidth={1.75} />} label="Bilet ara" shortcut="g t" />
            <Item onSelect={() => run(() => navigate({ to: "/search" }))} icon={<ArrowLeftRight size={16} strokeWidth={1.75} />} label="Exchange / Reissue başlat" hint="bilet seç" />
            <Item onSelect={() => run(() => navigate({ to: "/search" }))} icon={<Undo2 size={16} strokeWidth={1.75} />} label="Refund başlat" hint="bilet seç" />
            <Item onSelect={() => run(() => navigate({ to: "/search" }))} icon={<Ban size={16} strokeWidth={1.75} />} label="Void" hint="bilet seç" />
            <Item onSelect={() => run(() => navigate({ to: "/search" }))} icon={<FileText size={16} strokeWidth={1.75} />} label="EMD ekle" hint="bilet seç" />
          </Group>

          <Group heading="Git">
            <Item onSelect={() => run(() => navigate({ to: "/orders" }))} icon={<Package size={16} strokeWidth={1.75} />} label="Order'lar" />
            <Item onSelect={() => run(() => navigate({ to: "/messages" }))} icon={<MessagesSquare size={16} strokeWidth={1.75} />} label="Interline mesajları" />
            <Item onSelect={() => run(() => navigate({ to: "/agreements" }))} icon={<Handshake size={16} strokeWidth={1.75} />} label="Bilateral anlaşmalar" />
          </Group>

          {!trimmed && recentSearches.length > 0 && (
            <Group heading="Son aramalar">
              {recentSearches.map((s) => (
                <Item key={s} onSelect={() => run(() => { pushSearch(s); navigate({ to: "/search", search: { q: s } }); })} icon={<Search size={16} strokeWidth={1.75} />} label={s} />
              ))}
            </Group>
          )}

          {recentTickets.length > 0 && (
            <Group heading="Son açılan biletler">
              {recentTickets.map((tn) => (
                <Item
                  key={tn}
                  onSelect={() => run(() => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: tn } }))}
                  icon={<TicketIcon size={16} strokeWidth={1.75} />}
                  label={tn}
                  mono
                />
              ))}
            </Group>
          )}
        </Command.List>
      </div>
    </Command.Dialog>
  );
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="px-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-tertiary"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  onSelect, icon, label, shortcut, hint, disabled, mono,
}: {
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  hint?: string;
  disabled?: boolean;
  mono?: boolean;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      disabled={disabled}
      className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-sm text-primary aria-selected:bg-accent-soft aria-selected:text-accent data-[disabled=true]:cursor-not-allowed data-[disabled=true]:text-disabled"
    >
      <span className="text-secondary">{icon}</span>
      <span className={mono ? "font-mono text-[13px]" : ""}>{label}</span>
      {disabled && <span className="ml-auto text-[11px] text-disabled">yakında</span>}
      {hint && !disabled && <span className="ml-auto text-[11px] text-tertiary">{hint}</span>}
      {shortcut && !disabled && !hint && (
        <span className="ml-auto font-mono text-[11px] text-tertiary">{shortcut}</span>
      )}
    </Command.Item>
  );
}
