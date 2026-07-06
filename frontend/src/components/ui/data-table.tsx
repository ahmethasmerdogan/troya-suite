import { useState, useRef, useEffect } from "react";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel,
  flexRender, type ColumnDef, type SortingState, type VisibilityState, type RowSelectionState, type Table,
} from "@tanstack/react-table";
import {
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Columns3, Rows3, Rows4, Download, Check,
} from "lucide-react";
import { Skeleton } from "./skeleton";
import { SearchBar } from "./search-bar";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { cn } from "@/lib/utils";

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  emptyText?: string;
  emptyHint?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  pageSize?: number;
  selectable?: boolean;
  bulkActions?: (rows: T[]) => React.ReactNode;
  exportName?: string; // CSV dosya adı (verilirse Dışa Aktar butonu çıkar)
  columnToggle?: boolean;
}

function Checkbox({ checked, indeterminate, onChange, onClick }: { checked: boolean; indeterminate?: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onClick?: (e: React.MouseEvent) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate && !checked; }, [indeterminate, checked]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} onClick={onClick} className="h-3.5 w-3.5 cursor-pointer accent-[var(--accent)]" />;
}

export function DataTable<T>({
  data, columns, isLoading, onRowClick, emptyText = "Kayıt bulunamadı", emptyHint,
  searchable, searchPlaceholder = "Tabloda ara…", toolbar, pageSize,
  selectable, bulkActions, exportName, columnToggle = true,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [dense, setDenseState] = useState(() => (typeof localStorage !== "undefined" && localStorage.getItem("troya.tableDense") === "1"));
  const setDense = (v: boolean | ((d: boolean) => boolean)) => setDenseState((prev) => {
    const next = typeof v === "function" ? v(prev) : v;
    if (typeof localStorage !== "undefined") localStorage.setItem("troya.tableDense", next ? "1" : "0");
    return next;
  });
  const [colMenu, setColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const allColumns: ColumnDef<T, unknown>[] = selectable
    ? [{
        id: "_select",
        enableSorting: false, enableHiding: false,
        header: ({ table }: { table: Table<T> }) => <Checkbox checked={table.getIsAllPageRowsSelected()} indeterminate={table.getIsSomePageRowsSelected()} onChange={table.getToggleAllPageRowsSelectedHandler()} />,
        cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} onClick={(e) => e.stopPropagation()} />,
        meta: { width: "36px" },
      } as ColumnDef<T, unknown>, ...columns]
    : columns;

  const table = useReactTable({
    data, columns: allColumns,
    state: { sorting, globalFilter, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: !!selectable,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(pageSize ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    initialState: pageSize ? { pagination: { pageSize } } : {},
  });

  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide() && c.id !== "_select");

  const exportCsv = () => {
    const cols = table.getVisibleLeafColumns().filter((c) => c.id !== "_select");
    const head = cols.map((c) => `"${typeof c.columnDef.header === "string" ? c.columnDef.header : c.id}"`).join(",");
    const body = table.getFilteredRowModel().rows.map((r) =>
      cols.map((c) => { const v = r.getValue(c.id); return `"${String(v ?? "").replace(/"/g, '""')}"`; }).join(","),
    );
    const blob = new Blob(["﻿" + [head, ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportName ?? "export"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const rowPad = dense ? "py-1.5" : "py-3";
  const headPad = dense ? "py-2" : "py-2.5";

  return (
    <div className="flex flex-col gap-3">
      {/* toolbar */}
      {(searchable || toolbar || columnToggle || exportName) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable && <SearchBar className="min-w-[220px] flex-1" value={globalFilter} onChange={setGlobalFilter} placeholder={searchPlaceholder} />}
          {toolbar}
          <div className="ml-auto flex items-center gap-1.5">
            {exportName && (
              <Button variant="secondary" size="sm" onClick={exportCsv}><Download size={15} strokeWidth={1.75} /> CSV</Button>
            )}
            <Button variant="secondary" size="icon" onClick={() => setDense((d) => !d)} title={dense ? "Rahat" : "Sık"}>
              {dense ? <Rows4 size={16} strokeWidth={1.75} /> : <Rows3 size={16} strokeWidth={1.75} />}
            </Button>
            {columnToggle && hideable.length > 0 && (
              <div ref={colMenuRef} className="relative">
                <Button variant="secondary" size="sm" onClick={() => setColMenu((o) => !o)}><Columns3 size={15} strokeWidth={1.75} /> Kolonlar</Button>
                {colMenu && (
                  <div className="absolute right-0 top-10 z-30 w-52 rounded-md border border-[var(--border-subtle)] bg-surface p-1 shadow-sm">
                    {hideable.map((c) => (
                      <button key={c.id} onClick={() => c.toggleVisibility()} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-primary hover:bg-sunken">
                        <span className="flex h-4 w-4 items-center justify-center rounded border border-border-default">{c.getIsVisible() && <Check size={12} strokeWidth={2.5} className="text-accent" />}</span>
                        {typeof c.columnDef.header === "string" ? c.columnDef.header : c.id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* seçim çubuğu */}
      {selectable && selectedRows.length > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-[var(--accent-soft)] bg-accent-soft px-4 py-2 text-[13px] text-accent">
          <span className="font-medium">{selectedRows.length} satır seçili</span>
          {bulkActions?.(selectedRows)}
          <button onClick={() => table.resetRowSelection()} className="ml-auto font-medium hover:underline">Seçimi temizle</button>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-[var(--border-subtle)] bg-surface">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-[var(--border-default)] bg-surface-alt">
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta as { align?: string; width?: string } | undefined;
                  const sortable = h.column.getCanSort();
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : sortable ? "none" : undefined}
                      style={{ width: meta?.width }}
                      onClick={sortable ? h.column.getToggleSortingHandler() : undefined}
                      className={cn("px-4 text-[11px] font-medium uppercase tracking-[0.06em] text-secondary", headPad, meta?.align === "right" ? "text-right" : "text-left", sortable && "cursor-pointer select-none hover:text-primary")}
                    >
                      <span className={cn("inline-flex items-center gap-1", meta?.align === "right" && "flex-row-reverse")}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sortable && (sorted === "asc" ? <ChevronUp size={13} strokeWidth={2} className="text-accent" /> : sorted === "desc" ? <ChevronDown size={13} strokeWidth={2} className="text-accent" /> : <ChevronsUpDown size={13} strokeWidth={1.75} className="text-disabled" />)}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0">
                  {allColumns.map((_c, j) => <td key={j} className={cn("px-4", rowPad)}><Skeleton className="h-4 w-24" /></td>)}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={allColumns.length}><EmptyState title={emptyText} hint={emptyHint} /></td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    "border-b border-[var(--border-subtle)] transition-colors last:border-0 hover:bg-surface-alt",
                    onRowClick && "cursor-pointer",
                    row.getIsSelected() && "bg-accent-soft hover:bg-accent-soft",
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { align?: string } | undefined;
                    return (
                      <td key={cell.id} className={cn("px-4 text-sm", rowPad, meta?.align === "right" && "text-right")}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>

        {/* alt bilgi / sayfalama */}
        {!isLoading && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] bg-surface-alt px-4 py-2.5 text-[12px] text-tertiary">
            <span>{filteredCount} kayıt{selectedRows.length > 0 ? ` · ${selectedRows.length} seçili` : ""}</span>
            {pageSize && (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5">
                  Sayfa boyutu
                  <select value={table.getState().pagination.pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))} className="h-7 rounded border border-border-default bg-surface px-1.5 text-[12px] text-primary">
                    {[10, 20, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <span className="font-mono text-secondary">
                  {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
                  –{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredCount)} / {filteredCount}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="secondary" size="icon" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}><ChevronsLeft size={15} strokeWidth={1.75} /></Button>
                  <Button variant="secondary" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft size={15} strokeWidth={1.75} /></Button>
                  <Button variant="secondary" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight size={15} strokeWidth={1.75} /></Button>
                  <Button variant="secondary" size="icon" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}><ChevronsRight size={15} strokeWidth={1.75} /></Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
