import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { getOpsBoard, opsAlertText } from "@/domain/ops";
import { listRevenueAlerts } from "@/domain/api";
import { OPS_CHANNEL_ID } from "@/domain/chat";
import { useChat } from "@/store/chat";
import { useUI } from "@/store/ui";
import { TONE_DOT, TONE_INK, TONE_WASH, type Tone } from "@/components/ui/pill";
import { translate, useT } from "@/i18n";
import { usePerm } from "@/lib/usePerm";
import { cn } from "@/lib/utils";

/**
 * İstasyon duyuruları — kabuğun üstünde duran tek satır.
 *
 * Uydurma bildirim yok: kaynaklar gerçek. (1) operasyon uyarı motoru
 * (`domain/ops` — gate kapanıyor, biniş geride, MCT riski), (2) gelir koruma
 * denetimleri, (3) operasyon kanalına düşen son duyuru (gerçek chat verisi).
 * En yüksek önem sırada gösterilir; kalanların sayısı yanında durur ve
 * personel kapatabilir — kapatılan duyuru oturum boyunca geri gelmez.
 */
export type NoticeSeverity = "critical" | "warning" | "info";

export interface Notice {
  id: string;
  severity: NoticeSeverity;
  title: string;
  detail: string;
  /** Duyuruyu doğuran ekran. */
  to?: string;
  at?: string;
}

const SEV_TONE: Record<NoticeSeverity, Tone> = { critical: "red", warning: "amber", info: "blue" };
const SEV_LABEL_KEY = {
  critical: "shell.notice.critical",
  warning: "shell.notice.warning",
  info: "shell.notice.info",
} as const;
const RANK: Record<NoticeSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** Kabuk genelindeki bildirim akışı — hem üst şerit hem zil menüsü bunu okur. */
export function useNotices(): Notice[] {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const { data: board } = useQuery({ queryKey: ["opsBoard"], queryFn: getOpsBoard, refetchInterval: 30_000 });
  const { data: revenue = [] } = useQuery({ queryKey: ["revenueAlerts"], queryFn: listRevenueAlerts });
  // Kanal listesi artık dinamik; duyuru şeridi sabit id ile bağlanır.
  const opsChannel = useChat((s) => s.messages[OPS_CHANNEL_ID]);
  // Uyarı, açtığı ekranı görebilen role gösterilir: HUB uyarıları operasyon,
  // gelir koruma bulguları gelir görüntüleme yetkisi ister.
  const { can } = usePerm();

  const out: Notice[] = [];

  for (const a of can("ops.view") ? board?.alerts ?? [] : []) {
    const txt = opsAlertText(a, lang);
    out.push({
      id: `ops-${a.id}`,
      severity: a.severity,
      title: `${a.flightNumber} · ${txt.title}`,
      detail: txt.detail,
      to: "/ops",
    });
  }

  for (const r of can("revenue.view") ? revenue : []) {
    out.push({
      id: `rev-${r.id}`,
      severity: r.severity === "high" ? "critical" : r.severity === "medium" ? "warning" : "info",
      title: `${t("shell.notice.revenue")} · ${r.ticketNumber}`,
      detail: lang === "en" ? r.detailEn ?? r.detail : r.detail,
      to: "/admin/revenue",
      at: r.detectedAt,
    });
  }

  // Operasyon kanalının son duyurusu — mesajlaşma ile kabuk aynı gerçeği paylaşır.
  const last = opsChannel?.[opsChannel.length - 1];
  if (last) {
    out.push({
      id: `chat-${last.id}`,
      severity: "info",
      title: `${t("shell.notice.ops")} · ${last.fromName}`,
      detail: last.text,
      to: "/chat",
      at: last.at,
    });
  }

  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

// Kapatılan duyurular tarayıcıda kalır: her sayfa yenilemesinde aynı uyarıyı
// yeniden kapatmak zorunda bırakmak duyuru şeridini gürültüye çevirir.
const DISMISS_KEY = "troya.dismissedNotices";
function readDismissed(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Üst şerit — açık duyurular önem sırasıyla, tek satırda. Şerit sakin bir
 * yüzeydir (renk yalnız sol kenar, nokta ve etiket): her ekranın üstünde
 * durduğu için alarm rengine boyanmaz. Oklarla sıradaki duyuruya geçilir.
 */
export function AnnouncementBar() {
  const t = useT();
  const notices = useNotices();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [idx, setIdx] = useState(0);
  const open = notices.filter((n) => !dismissed.includes(n.id));
  if (open.length === 0) return null;
  const i = idx % open.length;
  const top = open[i];

  const tone = SEV_TONE[top.severity];
  const step = (d: number) => setIdx((i + d + open.length) % open.length);
  const nav = "grid size-6 flex-shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-inset hover:text-ink";

  return (
    <div
      role="status"
      data-print-hide
      className="anim-rise relative flex items-center gap-2.5 border-b border-line bg-panel py-1.5 pl-4 pr-2 sm:pr-3"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: TONE_DOT[tone] }} />
      <span aria-hidden className="relative flex size-2 flex-shrink-0">
        {top.severity === "critical" && (
          <span className="absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ background: TONE_DOT[tone] }} />
        )}
        <span className="relative size-2 rounded-full" style={{ background: TONE_DOT[tone] }} />
      </span>
      <span
        className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
        style={{ background: TONE_WASH[tone], color: TONE_INK[tone] }}
      >
        {t(SEV_LABEL_KEY[top.severity])}
      </span>
      <span className="min-w-0 truncate text-[12.5px] font-semibold text-ink">{top.title}</span>
      <span className="hidden min-w-0 flex-1 truncate text-[12.5px] text-ink-2 sm:block">{top.detail}</span>
      <span className="flex-1 sm:hidden" />
      {open.length > 1 && (
        <span className="flex flex-shrink-0 items-center">
          <button type="button" onClick={() => step(-1)} aria-label={t("shell.notice.prev")} className={nav}>
            <ChevronLeft size={14} strokeWidth={2} />
          </button>
          <span className="num min-w-[38px] text-center text-[11.5px] text-ink-3">{i + 1}/{open.length}</span>
          <button type="button" onClick={() => step(1)} aria-label={t("shell.notice.next")} className={nav}>
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </span>
      )}
      {top.to && (
        <Link
          to={top.to}
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium text-brand transition-colors hover:bg-brand-wash"
        >
          {t("shell.notice.open")} <ArrowRight size={13} strokeWidth={2} />
        </Link>
      )}
      <button
        type="button"
        onClick={() => setDismissed((d) => {
          const next = [...d, top.id];
          try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next.slice(-60))); } catch { /* depolama kapalı */ }
          return next;
        })}
        aria-label={t("shell.notice.dismiss")}
        className={nav}
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

/** Zil menüsündeki satır. */
export function NoticeRow({ notice, onNavigate }: { notice: Notice; onNavigate: () => void }) {
  const tone = SEV_TONE[notice.severity];
  const body = (
    <>
      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: TONE_DOT[tone] }} />
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-medium text-ink">{notice.title}</span>
          {notice.at && (
            <span className="num flex-shrink-0 text-[11px] text-ink-3">{ago(notice.at)}</span>
          )}
        </span>
        <span className="block text-[12px] leading-snug text-ink-2">{notice.detail}</span>
      </span>
    </>
  );
  const cls = "flex w-full gap-2.5 rounded-[10px] px-2.5 py-2 text-left hover:bg-inset";
  return notice.to ? (
    <Link to={notice.to} onClick={onNavigate} className={cls}>{body}</Link>
  ) : (
    <span className={cn(cls, "cursor-default")}>{body}</span>
  );
}

function ago(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return translate("shell.ago.now");
  if (m < 60) return translate("shell.ago.min", { n: m });
  const h = Math.round(m / 60);
  return h < 24 ? translate("shell.ago.hour", { n: h }) : translate("shell.ago.day", { n: Math.round(h / 24) });
}
