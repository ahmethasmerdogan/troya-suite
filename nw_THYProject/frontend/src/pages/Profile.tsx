import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Moon, Sun, Languages } from "lucide-react";
import { queryTransactions } from "@/domain/api";
import { useUsers } from "@/store/users";
import { useUI } from "@/store/ui";
import { reportsOf, chainOf } from "@/domain/users";
import {
  PERMISSION_LABEL, ROLE_DESC, ROLE_LABEL, ROLE_ORDER, permissionsFor,
  type Permission, type Role,
} from "@/domain/auth";
import { PersonCard } from "@/components/domain/PersonCard";
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
  const { data: tx = [] } = useQuery({ queryKey: ["auditLog"], queryFn: () => queryTransactions({}) });

  if (!me) return <Banner kind="warning">Oturum bulunamadı.</Banner>;

  const user = users.find((u) => u.id === me.id) ?? me;
  const mine = permissionsFor(user.role);

  const team = reportsOf(users, user.id);
  const chain = chainOf(users, user.id);
  const myTx = tx.filter((t) => t.actor.includes(user.id) || t.actor.includes(user.location)).slice(0, 12);

  return (
    <>
      <PageTitle title="Profilim" hint="Kimlik bilgileriniz, yetkileriniz, ekibiniz ve son işlemleriniz." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHead title="Personel kartı" />
            <PanelBody>
              <PersonCard userId={user.id} variant="panel" />
            </PanelBody>
          </Panel>

          {chain.length > 0 && (
            <Panel>
              <PanelHead title="Bağlı olduğu yönetim zinciri" hint="Onay ve yetki devri bu hat üzerinden yürür." />
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
                    <Pill tone="gray">{ROLE_LABEL[c.role]}</Pill>
                  </div>
                ))}
              </PanelBody>
            </Panel>
          )}

          {team.length > 0 && (
            <Panel>
              <PanelHead title="Bana bağlı personel" hint={`${team.length} kişi`} />
              <PanelBody className="flex flex-col gap-1.5 pt-1">
                {team.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 border-b border-hair py-2 last:border-0">
                    <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-inset text-[10.5px] font-semibold text-ink-2">
                      {t.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{t.name}</span>
                      <span className="block truncate text-[11.5px] text-ink-3">{t.title} · {t.location}</span>
                    </span>
                    {t.status === "suspended" && <Pill tone="red">Devre dışı</Pill>}
                  </div>
                ))}
              </PanelBody>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHead
              title="Rolüm ve yetkilerim"
              hint={`${ROLE_LABEL[user.role]} — ${ROLE_DESC[user.role]}`}
              action={<Pill tone="gray">{mine.length} / {ALL_PERMS.length} yetki</Pill>}
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
                      title={has ? undefined : need ? `${ROLE_LABEL[need]} ve üzeri gerekir` : undefined}
                    >
                      <span
                        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ background: has ? "var(--t-green-d)" : "var(--line-strong)" }}
                      />
                      <span className="min-w-0 flex-1 truncate">{PERMISSION_LABEL[p]}</span>
                      {!has && need && <span className="flex-shrink-0 text-[10.5px]">{ROLE_LABEL[need]}+</span>}
                    </div>
                  );
                })}
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead title="Tercihler" hint="Yalnız sizin oturumunuzu etkiler." />
            <PanelBody className="flex flex-wrap gap-2">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink transition-colors hover:bg-elev"
              >
                {theme === "dark" ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
                {theme === "dark" ? "Açık tema" : "Koyu tema"}
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

          <Panel>
            <PanelHead title="Son işlemlerim" hint="Denetim kaydından — bu istasyonda yaptığınız işlemler." />
            <PanelBody className="pt-1">
              {myTx.length === 0 ? (
                <Empty title="Kayıt yok" hint="Bu oturumda henüz bir işlem yapmadınız." />
              ) : myTx.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center gap-3 border-b border-hair py-2.5 last:border-0">
                  <span className="num w-36 flex-shrink-0 text-[11.5px] text-ink-3">{formatDateTime(t.occurredAt)}</span>
                  <Link
                    to="/tickets/$ticketNumber" params={{ ticketNumber: t.ticketNumber }}
                    className="num text-[12.5px] font-medium text-brand hover:underline"
                  >
                    {t.ticketNumber}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{t.detail ?? t.type}</span>
                  {t.status && <StatusPill status={t.status} />}
                </div>
              ))}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
