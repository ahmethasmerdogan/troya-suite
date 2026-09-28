import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, TriangleAlert, X } from "lucide-react";
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

/** Üst şerit — en öncelikli açık duyuru. */
export function AnnouncementBar() {
  const t = useT();
  const notices = useNotices();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const open = notices.filter((n) => !dismissed.includes(n.id));
  const top = open[0];
  if (!top) return null;

  const tone = SEV_TONE[top.severity];
  const Icon = top.severity === "info" ? Megaphone : TriangleAlert;

  return (
    <div
      role="status"
      data-print-hide
      className="anim-rise flex items-center gap-2.5 border-b border-line px-3 py-2 sm:px-4"
      style={{ background: TONE_WASH[tone], color: TONE_INK[tone] }}
    >
      <Icon size={15} strokeWidth={2} className="flex-shrink-0" style={{ color: TONE_DOT[tone] }} />
      <span
        className="flex-shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{ background: TONE_DOT[tone], color: "#fff" }}
      >
        {t(SEV_LABEL_KEY[top.severity])}
      </span>
      <span className="truncate text-[12.5px] font-semibold">{top.title}</span>
      <span className="hidden min-w-0 flex-1 truncate text-[12.5px] opacity-85 sm:block">{top.detail}</span>
      {open.length > 1 && (
        <span className="num flex-shrink-0 rounded-full bg-black/8 px-1.5 py-0.5 text-[11px] font-medium dark:bg-white/10">
          +{open.length - 1}
        </span>
      )}
      {top.to && (
        <Link to={top.to} className="flex-shrink-0 text-[12.5px] font-semibold underline underline-offset-2">
          {t("shell.notice.open")}
        </Link>
      )}
      <button
        onClick={() => setDismissed((d) => {
          const next = [...d, top.id];
          try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next.slice(-60))); } catch { /* depolama kapalı */ }
          return next;
        })}
        aria-label={t("shell.notice.dismiss")}
        className="flex-shrink-0 rounded-sm p-0.5 opacity-60 transition-opacity hover:opacity-100"
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
