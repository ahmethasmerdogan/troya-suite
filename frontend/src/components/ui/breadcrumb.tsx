import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

// Breadcrumb — detay sayfalarında konum/dönüş. Son öğe aktif (linksiz).
export interface Crumb { label: string; to?: string }

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1 text-[12px] text-tertiary" aria-label="breadcrumb">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {c.to && !last ? (
              <Link to={c.to} className="transition-colors hover:text-accent">{c.label}</Link>
            ) : (
              <span className={last ? "font-medium text-secondary" : ""}>{c.label}</span>
            )}
            {!last && <ChevronRight size={13} strokeWidth={1.75} className="text-disabled" />}
          </span>
        );
      })}
    </nav>
  );
}
