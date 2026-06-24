"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown, Check, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Catalog } from "@/features/catalogs/types";
import { cn } from "@/lib/utils";

interface CatalogPickerProps {
  catalog: Catalog;
  currentValue: string;
  onPick: (value: string) => void;
}

/**
 * Pequeño combobox que aparece a la derecha del input cuando hay un catálogo
 * activo asociado al campo. Permite filtrar y seleccionar un valor
 * estandarizado. Resalta si el valor escrito ya coincide con alguno.
 */
export function CatalogPicker({
  catalog,
  currentValue,
  onPick,
}: CatalogPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.items;
    return catalog.items.filter((it) => {
      if (it.value.toLowerCase().includes(q)) return true;
      return it.aliases?.some((a) => a.toLowerCase().includes(q));
    });
  }, [query, catalog.items]);

  const exactMatch = catalog.items.some(
    (it) =>
      it.value.toLowerCase() === currentValue.trim().toLowerCase() ||
      it.aliases?.some(
        (a) => a.toLowerCase() === currentValue.trim().toLowerCase()
      )
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors",
          exactMatch
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        )}
        title={`Catálogo: ${catalog.name}`}
      >
        <Sparkles className="size-3" />
        {catalog.name}
        <ChevronsUpDown className="size-3 opacity-60" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <Input
          autoFocus
          placeholder="Buscar…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-2 h-8 text-sm"
        />
        <div className="max-h-56 space-y-0.5 overflow-auto">
          {filtered.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              Sin coincidencias
            </p>
          ) : (
            filtered.map((it) => {
              const selected =
                it.value.toLowerCase() === currentValue.trim().toLowerCase();
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    onPick(it.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors",
                    selected
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200"
                      : "hover:bg-muted"
                  )}
                >
                  <Check
                    className={cn(
                      "size-3.5",
                      selected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {it.value}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
