import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { searchEmds } from "@/domain/api";
import { StatusPill } from "@/components/domain/StatusPill";
import { SearchInput } from "@/components/ui/core";
import { Skeleton } from "@/components/ui/skeleton";
import { ListHead, ListBody, ListFoot } from "@/components/layout/views";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * EMD liste paneli (Handbook Ch 5). Kayıtlar gerçek bir tabloda durur:
 * belge numarası kendi hücresinde tek başına, kalan bilgi ikinci hücrede.
 */
const pane = { q: "" };

export function EmdListPane({ selected }: { selected?: string }) {
  const [q, setQState] = useState(pane.q);
  const navigate = useNavigate();
  const t = useT();
  const setQ = (v: string) => { pane.q = v; setQState(v); };
  const { data, isLoading } = useQuery({ queryKey: ["emds", q], queryFn: () => searchEmds(q) });
  const rows = data ?? [];

  return (
    <>
      <ListHead>
        <SearchInput value={q} onChange={setQ} placeholder={t("search.emds.placeholder")} />
      </ListHead>

      <ListBody>
        {isLoading ? (
          <div className="flex flex-col gap-3 p-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="text-[14px] font-semibold text-ink">{t("search.emds.empty.title")}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{t("search.emds.empty.hint")}</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {rows.map((e) => {
                const on = e.emdNumber === selected;
                const c = e.coupons[0];
                return (
                  <tr
                    key={e.emdNumber}
                    onClick={() => navigate({ to: "/emds/$emdNumber", params: { emdNumber: e.emdNumber } })}
                    aria-label={`${e.emdNumber} · ${e.passenger.surname}/${e.passenger.givenName}`}
                    className={cn("cursor-pointer border-b border-hair transition-colors", on ? "bg-brand-wash" : "hover:bg-raised")}
                  >
                    <td className={cn("num relative w-[108px] px-3 py-2.5 align-top text-[12.5px] font-medium text-ink",
                      on && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-brand before:content-['']")}>
                      {e.emdNumber}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-[13px] text-ink-2">{c?.description ?? "—"}</span>
                        {c && <StatusPill status={c.status} />}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-3">
                        <span className="num">EMD-{e.type}</span>
                        {c?.rfisc && <span className="num">{c.rfisc}</span>}
                        <span className="truncate">{e.passenger.surname}/{e.passenger.givenName}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </ListBody>

      <ListFoot><span className="num">{t("search.emds.count", { n: rows.length })}</span></ListFoot>
    </>
  );
}
