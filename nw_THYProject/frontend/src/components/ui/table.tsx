import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel, flexRender,
  type ColumnDef, type SortingState, type VisibilityState,
} from "@tanstack/react-table";
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown,
  Columns3, Download, Rows2, Rows3,
} from "lucide-react";
import { Button, IconButton } from "./core";
import { Empty } from "./surface";
import { Skeleton } from "./skeleton";
import { useOutside } from "./overlay";
import { toCsv, downloadCsv, csvFileName } from "@/lib/csv";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/tips/Tip";

/* ====================================================================
   Veri tablosu — kurumsal operasyon grid'i.

   Bir listeden fazlasıdır: operatör gün boyu burada tarama yapar, o yüzden
   her hücre kendi kıl çizgisiyle sınırlanır (göz dikey de tarar), başlık
   kaydırmada yapışır, satırın solunda durumunu söyleyen bir şerit durur ve
   satır üstüne gelince aksiyonlar görünür.

   Sayısal kolonlar sağa yaslı ve mono; alt şeritte toplam satırı, kayıt
   sayısı ve sayfalama bir arada durur.
   ==================================================================== */

export interface TableColumnMeta<T = unknown> {
  align?: "right" | "center";
  width?: string;
  /** Alt toplam şeridinde bu kolonun altına yazılacak değer. */
  summary?: ReactNode;
  /** Başlık bir bileşense CSV ve kolon menüsü bu etiketi kullanır. */
  label?: string;
  /**
   * CSV'ye yazılacak değer.
   *
   * `row.getValue` yalnız accessor'ı çalıştırır, `cell` render'ını YOK SAYAR:
   * ekranda "01.07.2026" görünen tarih dosyaya ISO olarak, pill etiketi ham
   * statü kodu olarak düşüyordu. Kolon kendi dışa aktarım değerini söyler.
   */
  exportValue?: (row: T) => string | number | null | undefined;
  /** Yalnız arayüz için olan kolon (aksiyon vb.) — dosyaya girmez. */
  exportSkip?: boolean;
  /**
   * Yalnız dosya için olan kolon — ekranda hiç görünmez.
   *
   * Para birimi gibi alanlar ekranda tutarın yanında zaten yazıyor; ama
   * Excel'de tutarın SAYI kalması için ayrı sütun gerekiyor.
   */
  exportOnly?: boolean;
}

type Leaf = { id: string; columnDef: { header?: unknown; meta?: unknown } };
const metaOf = <R,>(c: Leaf) => c.columnDef.meta as TableColumnMeta<R> | undefined;
/** Kolonun insan okunur adı: meta.label → string başlık → id. */
function colLabel(c: Leaf): string {
  const m = metaOf(c);
  if (m?.label) return m.label;
  const h = c.columnDef.header;
  return typeof h === "string" && h.trim() ? h : c.id;
}

export function DataTable<T>({
  data,
  columns,
  loading,
  onRowClick,
  rowKey,
  rowTone,
  rowActions,
  empty,
  toolbar,
  pageSize: initialPageSize,
  exportName,
  summary,
  maxHeight = "calc(100vh - 20rem)",
  className,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  /** Satırın erişilebilir adı — rol tabanlı seçicilere içerik metni karışmasın. */
  rowKey?: (row: T) => string;
  /** Satırın sol kenarındaki durum şeridi rengi (CSS renk değeri). */
  rowTone?: (row: T) => string | undefined;
  /** Satır üstüne gelince sağda beliren hızlı aksiyonlar. */
  rowActions?: (row: T) => ReactNode;
  empty?: { title: string; hint?: string; icon?: ReactNode };
  toolbar?: ReactNode;
  pageSize?: number;
  exportName?: string;
  /** Alt şeritte gösterilecek özet (toplam tutar gibi). */
  summary?: ReactNode;
  maxHeight?: string;
  className?: string;
}) {
  const t = useT();
  const [sorting, setSorting] = useState<SortingState>([]);
  // exportOnly kolonları hiç render edilmez; yalnız CSV'de yer alır.
  const [visibility, setVisibility] = useState<VisibilityState>(() => {
    const v: VisibilityState = {};
    for (const c of columns) {
      const m = (c as { meta?: TableColumnMeta }).meta;
      const id = (c as { id?: string }).id;
      if (m?.exportOnly && id) v[id] = false;
    }
    return v;
  });
  const [pageSize, setPageSize] = useState(initialPageSize ?? 0);
  const [colMenu, setColMenu] = useState(false);
  const colRef = useRef<HTMLDivElement>(null);
  useOutside(colRef, () => setColMenu(false));

  const [dense, setDense] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem("troya.dense") === "1",
  );
  const toggleDense = () =>
    setDense((d) => {
      const n = !d;
      try { localStorage.setItem("troya.dense", n ? "1" : "0"); } catch { /* yoksay */ }
      return n;
    });

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility: visibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(pageSize ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    initialState: pageSize ? { pagination: { pageSize } } : {},
  });
  if (pageSize && table.getState().pagination.pageSize !== pageSize) table.setPageSize(pageSize);

  const rows = table.getRowModel().rows;
  const total = table.getCoreRowModel().rows.length;
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide() && !metaOf(c)?.exportOnly);
  const leafs = table.getVisibleLeafColumns();
  const hasSummary = useMemo(
    () => leafs.some((c) => metaOf(c)?.summary != null),
    [leafs],
  );

  const exportCsv = () => {
    const cols = table.getAllLeafColumns().filter((c) => {
      const m = metaOf(c);
      if (m?.exportSkip) return false;
      return m?.exportOnly || c.getIsVisible();
    });
    const head = cols.map((c) => colLabel(c));
    const body = table.getSortedRowModel().rows.map((r) =>
      cols.map((c) => {
        const ex = metaOf<T>(c)?.exportValue;
        // Kolon kendi değerini söylüyorsa onu al; yoksa accessor değerine düş.
        return ex ? ex(r.original) : (r.getValue(c.id) as unknown);
      }),
    );
    // Ekranda görünen toplam satırı dosyada da bulunsun (muhasebe tutarlılığı).
    if (hasSummary) {
      body.push(cols.map((c, i) => {
        const s = metaOf(c)?.summary;
        if (typeof s === "string" || typeof s === "number") return s;
        return i === 0 ? t("shell.table.totalRow") : "";
      }));
    }
    downloadCsv(toCsv(head, body), csvFileName(exportName ?? "export", new Date()));
  };

  const rowH = dense ? "h-8" : "h-11";
  const headH = dense ? "h-9" : "h-10";

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {(toolbar || exportName || hideable.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <div data-tour="table.tools" className="ml-auto flex items-center gap-1.5">
            {exportName && <Tip id="table.export" />}
            {exportName && (
              <Button variant="secondary" size="sm" onClick={exportCsv}>
                <Download size={15} strokeWidth={1.75} /> CSV
              </Button>
            )}
            {hideable.length > 0 && (
              <div ref={colRef} className="relative">
                <Button variant="secondary" size="sm" onClick={() => setColMenu((o) => !o)}>
                  <Columns3 size={15} strokeWidth={1.75} /> {t("shell.table.columns")}
                  <ChevronDown size={13} strokeWidth={2} />
                </Button>
                {colMenu && (
                  <div className="anim-pop absolute right-0 top-[calc(100%+6px)] z-40 w-56 rounded-lg border border-line bg-panel p-1">
                    <div className="microlabel px-2.5 pb-1 pt-1.5">{t("shell.table.visibleColumns")}</div>
                    {hideable.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => c.toggleVisibility()}
                        className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left text-[13px] text-ink hover:bg-inset"
                      >
                        <span className={cn("grid h-4 w-4 place-items-center rounded-[5px] border",
                          c.getIsVisible() ? "border-[var(--brand)] bg-brand text-white" : "border-line-firm")}>
                          {c.getIsVisible() && <Check size={11} strokeWidth={3} />}
                        </span>
                        {colLabel(c)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <IconButton label={t(dense ? "shell.table.comfortable" : "shell.table.dense")} variant="secondary" size="sm" onClick={toggleDense}>
              {dense ? <Rows3 size={15} strokeWidth={1.75} /> : <Rows2 size={15} strokeWidth={1.75} />}
            </IconButton>
          </div>
        </div>
      )}

      <div data-tour="table.body" className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-auto" style={{ maxHeight }}>
          <table className="w-full min-w-[720px] border-collapse">
            <thead className="sticky top-0 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-elev">
                  {/* durum şeridi kolonu */}
                  {rowTone && <th className="w-[3px] border-b border-line p-0" aria-hidden />}
                  {hg.headers.map((h) => {
                    const meta = metaOf(h.column);
                    const sortable = h.column.getCanSort();
                    const dir = h.column.getIsSorted();
                    return (
                      <th
                        key={h.id}
                        scope="col"
                        style={{ width: meta?.width }}
                        aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : sortable ? "none" : undefined}
                        onClick={sortable ? h.column.getToggleSortingHandler() : undefined}
                        className={cn(
                          "microlabel border-b border-r border-line px-3 text-left last:border-r-0",
                          headH,
                          meta?.align === "right" && "text-right",
                          meta?.align === "center" && "text-center",
                          sortable && "cursor-pointer select-none hover:text-ink",
                        )}
                      >
                        <span className={cn("inline-flex items-center gap-1", meta?.align === "right" && "flex-row-reverse")}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sortable &&
                            (dir === "asc" ? <ChevronUp size={12} strokeWidth={2.5} className="text-brand" />
                              : dir === "desc" ? <ChevronDown size={12} strokeWidth={2.5} className="text-brand" />
                                : <ChevronsUpDown size={12} strokeWidth={1.75} className="text-ink-4" />)}
                        </span>
                      </th>
                    );
                  })}
                  {rowActions && <th className="w-px border-b border-line px-2 text-right" scope="col"><span className="microlabel">{t("shell.table.action")}</span></th>}
                </tr>
              ))}
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-hair last:border-0">
                    {rowTone && <td className="p-0" />}
                    {leafs.map((_c, j) => (
                      <td key={j} className={cn("border-r border-hair px-3 last:border-r-0", rowH)}>
                        <Skeleton className="h-3.5" style={{ width: `${45 + ((i * 7 + j * 13) % 45)}%` }} />
                      </td>
                    ))}
                    {rowActions && <td className="w-px px-2" />}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={leafs.length + (rowTone ? 1 : 0) + (rowActions ? 1 : 0)}>
                    <Empty title={empty?.title ?? t("shell.table.empty")} hint={empty?.hint} icon={empty?.icon} />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    aria-label={rowKey?.(row.original)}
                    className={cn(
                      "group border-b border-hair transition-colors last:border-0",
                      onRowClick && "cursor-pointer hover:bg-elev",
                    )}
                  >
                    {/* Durum şeridi — rengi doğrudan hücreye veriyoruz; tablo
                        hücresinde `height:100%` güvenilir değil. */}
                    {rowTone && (
                      <td className="w-[3px] p-0" aria-hidden style={{ background: rowTone(row.original) ?? "transparent" }} />
                    )}
                    {row.getVisibleCells().map((cell) => {
                      const meta = metaOf(cell.column);
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "border-r border-hair px-3 text-[13px] last:border-r-0",
                            rowH,
                            meta?.align === "right" && "text-right",
                            meta?.align === "center" && "text-center",
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                    {rowActions && (
                      // Aksiyon hücresi satır tıklamasını yutar; dokunmatikte
                      // butonlar HER ZAMAN görünür (hover yok), farede eskisi gibi belirir.
                      <td className="w-px whitespace-nowrap px-2" onClick={(e) => e.stopPropagation()}>
                        <span className="flex items-center justify-end gap-1 opacity-100 transition-opacity [@media(hover:hover)]:opacity-55 [@media(hover:hover)]:group-hover:opacity-100 group-focus-within:!opacity-100">
                          {rowActions(row.original)}
                        </span>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>

            {/* Toplam şeridi — sayısal kolonların altına hizalı */}
            {!loading && rows.length > 0 && hasSummary && (
              <tfoot className="sticky bottom-0">
                <tr className="bg-elev">
                  {rowTone && <td className="border-t border-line p-0" aria-hidden />}
                  {leafs.map((c, i) => {
                    const meta = metaOf(c);
                    return (
                      <td
                        key={c.id}
                        className={cn(
                          "border-r border-t border-line px-3 py-2 text-[12.5px] font-semibold text-ink last:border-r-0",
                          meta?.align === "right" && "text-right",
                          meta?.align === "center" && "text-center",
                        )}
                      >
                        {meta?.summary ?? (i === 0 ? <span className="microlabel">{t("common.total")}</span> : null)}
                      </td>
                    );
                  })}
                  {rowActions && <td className="w-px border-t border-line px-2" aria-hidden />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {!loading && rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line bg-elev px-3 py-2 text-[12px] text-ink-3">
            <span className="num">{t("shell.table.records", { n: total })}</span>
            {summary && <span className="text-ink-2">{summary}</span>}

            <span className="ml-auto flex items-center gap-2">
              {initialPageSize != null && (
                <label className="flex items-center gap-1.5">
                  {t("shell.table.page")}
                  <select
                    value={pageSize || total}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="num h-7 rounded-[8px] border border-line-firm bg-surface px-1.5 text-[12px] text-ink"
                  >
                    {[10, 12, 25, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              )}
              {pageSize > 0 && table.getPageCount() > 1 && (
                <>
                  <span className="num">
                    {table.getState().pagination.pageIndex * pageSize + 1}–
                    {Math.min((table.getState().pagination.pageIndex + 1) * pageSize, total)} / {total}
                  </span>
                  <IconButton label={t("shell.table.prev")} variant="secondary" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
                    <ChevronLeft size={15} strokeWidth={1.75} />
                  </IconButton>
                  <IconButton label={t("shell.table.next")} variant="secondary" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
                    <ChevronRight size={15} strokeWidth={1.75} />
                  </IconButton>
                </>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
