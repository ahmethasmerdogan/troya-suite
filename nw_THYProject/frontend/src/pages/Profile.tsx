import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Moon, Sun, Languages } from "lucide-react";
import { queryTransactions } from "@/domain/api";
import { useUsers } from "@/store/users";
import { useUI } from "@/store/ui";
import { reportsOf, chainOf } from "@/domain/users";
import {
  ROLE_ORDER, permissionLabel, permissionsFor, roleDesc, roleLabel,
  type Permission, type Role,
} from "@/domain/auth";
import { useT } from "@/i18n";
import { PersonCard } from "@/components/domain/PersonCard";
import { TipsSettings } from "@/components/tips/TipsSettings";
import { StatusPill } from "@/components/domain/StatusPill";
import { PageTitle, Panel, PanelHead, PanelBody, Empty } from "@/components/ui/surface";
import { Pill } from "@/components/ui/pill";
import { Banner } from "@/components/ui/banner";
import { formatDateTime, cn } from "@/lib/utils";

/**
 * Profilim — personelin kendi kartı.
 *
 * Sistem kimin ne yapabildiğini biliyordu ama personel bunu hiçbir yerde
 * göremiyordu: hangi yetkilere sahip olduğu, kime bağlı olduğu, bugün ne
 * yaptığı. Bu sayfa o dört soruyu tek ekranda cevaplar.
 */
const ALL_PERMS = [...new Set(ROLE_ORDER.flatMap((r) => permissionsFor(r)))] as Permission[];

/** Bir yetkiyi ilk hangi rol getiriyor — kilitli satırda "X gerekir" için. */
function minRoleFor(perm: Permission): Role | undefined {
  return ROLE_ORDER.find((r) => permissionsFor(r).includes(perm));
}

export function Profile() {
  const me = useUI((s) => s.user);
  const { theme, setTheme, lang, setLang } = useUI();
  const users = useUsers((s) => s.users);
  const t = useT();
  const { data: tx = [] } = useQuery({ queryKey: ["auditLog"], queryFn: () => queryTransactions({}) });

  if (!me) return <Banner kind="warning">{t("admin.profile.noSession")}</Banner>;

  const user = users.find((u) => u.id === me.id) ?? me;
  const mine = permissionsFor(user.role);

  const team = reportsOf(users, user.id);
  const chain = chainOf(users, user.id);
  const myTx = tx.filter((t) => t.actor.includes(user.id) || t.actor.includes(user.location)).slice(0, 12);

  return (
    <>
      <PageTitle title={t("admin.profile.title")} hint={t("admin.profile.hint")} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHead title={t("admin.profile.card")} />
            <PanelBody>
              <PersonCard userId={user.id} variant="panel" />
            </PanelBody>
          </Panel>

          {chain.length > 0 && (
            <Panel>
              <PanelHead title={t("admin.profile.chain")} hint={t("admin.profile.chainHint")} />
              <PanelBody className="flex flex-col gap-1.5 pt-1">
                {chain.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2.5 border-b border-hair py-2 last:border-0">
                    <span className="num w-5 flex-shrink-0 text-[11px] text-ink-4">{i + 1}</span>
                    <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-inset text-[10.5px] font-semibold text-ink-2">
                      {c.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{c.name}</span>
                      <span className="block truncate text-[11.5px] text-ink-3">{c.title}</span>
                    </span>
                    <Pill tone="gray">{roleLabel(c.role, lang)}</Pill>
                  </div>
                ))}
              </PanelBody>
            </Panel>
          )}

          {team.length > 0 && (
            <Panel>
              <PanelHead title={t("admin.profile.team")} hint={t("admin.profile.teamHint", { n: team.length })} />
              <PanelBody className="flex flex-col gap-1.5 pt-1">
                {team.map((member) => (
                  <div key={member.id} className="flex items-center gap-2.5 border-b border-hair py-2 last:border-0">
                    <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-inset text-[10.5px] font-semibold text-ink-2">
                      {member.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{member.name}</span>
                      <span className="block truncate text-[11.5px] text-ink-3">{member.title} · {member.location}</span>
                    </span>
                    {member.status === "suspended" && <Pill tone="red">{t("admin.suspended")}</Pill>}
                  </div>
                ))}
              </PanelBody>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHead
              title={t("admin.profile.perms")}
              hint={`${roleLabel(user.role, lang)} — ${roleDesc(user.role, lang)}`}
              action={<Pill tone="gray">{t("admin.profile.permCount", { n: mine.length, total: ALL_PERMS.length })}</Pill>}
            />
            <PanelBody>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {ALL_PERMS.map((p) => {
                  const has = mine.includes(p);
                  const need = minRoleFor(p);
                  return (
                    <div
                      key={p}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12.5px]",
                        has ? "border-line bg-panel text-ink" : "border-hair bg-inset text-ink-4",
                      )}
                      title={has ? undefined : need ? t("admin.profile.needRole", { role: roleLabel(need, lang) }) : undefined}
                    >
                      <span
                        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ background: has ? "var(--t-green-d)" : "var(--line-strong)" }}
                      />
                      <span className="min-w-0 flex-1 truncate">{permissionLabel(p, lang)}</span>
                      {!has && need && <span className="flex-shrink-0 text-[10.5px]">{roleLabel(need, lang)}+</span>}
                    </div>
                  );
                })}
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead title={t("admin.profile.prefs")} hint={t("admin.profile.prefsHint")} />
            <PanelBody className="flex flex-wrap gap-2">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink transition-colors hover:bg-elev"
              >
                {theme === "dark" ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
                {theme === "dark" ? t("admin.profile.lightTheme") : t("admin.profile.darkTheme")}
              </button>
              <button
                onClick={() => setLang(lang === "tr" ? "en" : "tr")}
                className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink transition-colors hover:bg-elev"
              >
                <Languages size={15} strokeWidth={1.75} />
                {lang === "tr" ? "English" : "Türkçe"}
              </button>
            </PanelBody>
          </Panel>

          <TipsSettings />

          <Panel>
            <PanelHead title={t("admin.profile.recent")} hint={t("admin.profile.recentHint")} />
            <PanelBody className="pt-1">
              {myTx.length === 0 ? (
                <Empty title={t("admin.profile.recentEmpty")} hint={t("admin.profile.recentEmptyHint")} />
              ) : myTx.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center gap-3 border-b border-hair py-2.5 last:border-0">
                  <span className="num w-36 flex-shrink-0 text-[11.5px] text-ink-3">{formatDateTime(row.occurredAt)}</span>
                  <Link
                    to="/tickets/$ticketNumber" params={{ ticketNumber: row.ticketNumber }}
                    className="num text-[12.5px] font-medium text-brand hover:underline"
                  >
                    {row.ticketNumber}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{row.detail ?? row.type}</span>
                  {row.status && <StatusPill status={row.status} />}
                </div>
              ))}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
