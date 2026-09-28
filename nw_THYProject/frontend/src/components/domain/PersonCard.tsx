import { useNavigate } from "@tanstack/react-router";
import { AtSign, Building2, MapPin, MessageSquare, Phone, UserRound } from "lucide-react";
import { useUsers } from "@/store/users";
import { useChat } from "@/store/chat";
import { useUI } from "@/store/ui";
import { managerOf, reportsOf, unitLabel } from "@/domain/users";
import { dmThreadId, presenceLabel, PRESENCE_META } from "@/domain/chat";
import { presenceOf } from "@/store/chat";
import { roleLabel } from "@/domain/auth";
import { useT } from "@/i18n";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/ui";
import { cn, locale } from "@/lib/utils";

/* ====================================================================
   Kişi kartı — Teams'teki gibi.

   Mesajlaşmada kullanıcı hakkında yalnız ad, baş harf ve rol etiketi
   görünüyordu; unvanı, hangi birimde çalıştığı ve kime bağlı olduğu
   hiçbir yerde yazmıyordu. Bu kart o boşluğu doldurur ve dört yerde
   aynı anatomiyle görünür: sohbet listesi, sohbet başlığı, mesaj
   baloncuğu, kullanıcı yönetimi.
   ==================================================================== */

export function PersonCard({
  userId, variant = "popover", onNavigate, className,
}: {
  userId: string;
  variant?: "popover" | "panel";
  /** Kart bir menü içindeyse kapatmak için. */
  onNavigate?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const users = useUsers((s) => s.users);
  const presence = useChat((s) => s.presence);
  const me = useUI((s) => s.user);
  const lang = useUI((s) => s.lang);
  const openThread = useChat((s) => s.openThread);
  const t = useT();

  const u = users.find((x) => x.id === userId);
  if (!u) return null;

  const mgr = managerOf(users, u.id);
  const team = reportsOf(users, u.id);
  const p = presenceOf(presence, u.id);
  const meta = PRESENCE_META[p.status];

  const openChat = () => {
    if (!me) return;
    openThread(dmThreadId(me.id, u.id));
    onNavigate?.();
    navigate({ to: "/chat" });
  };

  return (
    <div className={cn(variant === "popover" ? "w-[19rem] p-3.5" : "p-0", className)}>
      <div className="flex items-start gap-3">
        <Avatar name={u.name} size="lg" status={p.online ? "online" : undefined} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-ink">{u.name}</div>
          <div className="truncate text-[12.5px] text-ink-2">{u.title}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Pill tone="gray">{roleLabel(u.role, lang)}</Pill>
            {u.status === "suspended" && <Pill tone="red">{t("admin.suspended")}</Pill>}
          </div>
        </div>
      </div>

      {/* Presence uydurulmaz: kalp atışı yoksa "çevrimdışı" ve son görülme yazar. */}
      <div className="mt-3 flex items-center gap-2 text-[12.5px]">
        <span
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ background: p.online ? `var(--t-${meta.tone}-d)` : "var(--line-strong)" }}
        />
        <span className={p.online ? "text-ink" : "text-ink-3"}>
          {p.online
            ? presenceLabel(p.status, lang)
            : p.lastSeen
              ? t("admin.person.lastSeen", { time: clock(p.lastSeen) })
              : t("admin.person.offline")}
        </span>
      </div>

      <dl className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3 text-[12.5px]">
        <Row icon={<Building2 size={13} strokeWidth={1.75} />} label={t("admin.person.unit")} value={unitLabel(u.unit, lang)} />
        <Row icon={<MapPin size={13} strokeWidth={1.75} />} label={t("admin.person.station")} value={u.location} mono />
        <Row icon={<AtSign size={13} strokeWidth={1.75} />} label={t("admin.person.email")} value={u.email} mono />
        {u.phone && <Row icon={<Phone size={13} strokeWidth={1.75} />} label={t("admin.person.phone")} value={u.phone} mono />}
        <Row
          icon={<UserRound size={13} strokeWidth={1.75} />}
          label={t("admin.person.manager")}
          value={mgr ? `${mgr.name} · ${mgr.title}` : "—"}
        />
        {team.length > 0 && (
          <Row
            icon={<UserRound size={13} strokeWidth={1.75} />}
            label={t("admin.person.team")}
            value={t(team.length === 1 ? "admin.person.teamValue.one" : "admin.person.teamValue", {
              n: team.length,
              names: team.map((member) => member.name.split(" ")[0]).join(", "),
            })}
          />
        )}
      </dl>

      {me && me.id !== u.id && (
        <div className="mt-3.5 flex items-center gap-2 border-t border-line pt-3">
          <button
            onClick={openChat}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-brand px-3 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
          >
            <MessageSquare size={14} strokeWidth={1.75} /> {t("admin.person.message")}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="mt-0.5 flex-shrink-0 text-ink-4">{icon}</span>
      <dt className="w-24 flex-shrink-0 text-ink-3">{label}</dt>
      <dd className={cn("min-w-0 flex-1 truncate text-ink-2", mono && "num")}>{value}</dd>
    </div>
  );
}

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
