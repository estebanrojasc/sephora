"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Plus, Trash2, ClipboardPaste, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Catalog,
  CatalogItem,
  CreateCatalogPayload,
} from "@/features/catalogs/types";
import { CATALOG_FIELD_KEYS } from "@/features/catalogs/types";

export interface CatalogEditorHandle {
  /** True si hay cambios pendientes que se perderían al cerrar. */
  isDirty: () => boolean;
}

interface CatalogEditorProps {
  initial?: Catalog;
  saving?: boolean;
  onSave: (payload: CreateCatalogPayload) => void | Promise<void>;
  onCancel: () => void;
}

/** Parsea texto pegado por el usuario y lo separa en valores individuales. */
function parseBulkInput(text: string): string[] {
  return text
    .split(/[\n,;\t]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export const CatalogEditor = forwardRef<CatalogEditorHandle, CatalogEditorProps>(
  function CatalogEditor({ initial, saving, onSave, onCancel }, ref) {
    const [name, setName] = useState(initial?.name ?? "");
    const [fieldKey, setFieldKey] = useState(
      initial?.fieldKey ?? CATALOG_FIELD_KEYS[0]!.value
    );
    const [active, setActive] = useState(initial?.active ?? true);
    const [items, setItems] = useState<CatalogItem[]>(initial?.items ?? []);
    const [newValue, setNewValue] = useState("");
    const [bulkText, setBulkText] = useState("");

    // Snapshot inicial para detectar cambios.
    const initialSnapshot = useRef(
      JSON.stringify({
        name: initial?.name ?? "",
        fieldKey: initial?.fieldKey ?? CATALOG_FIELD_KEYS[0]!.value,
        active: initial?.active ?? true,
        items: (initial?.items ?? []).map((i) => i.value.trim()),
      })
    );

    const isDirty = () => {
      const current = JSON.stringify({
        name,
        fieldKey,
        active,
        items: items.map((i) => i.value.trim()).filter(Boolean),
      });
      return current !== initialSnapshot.current;
    };

    useImperativeHandle(ref, () => ({ isDirty }));

    const existingValues = useMemo(
      () => new Set(items.map((it) => it.value.trim().toLowerCase())),
      [items]
    );

    const addOne = () => {
      const v = newValue.trim();
      if (!v) return;
      if (existingValues.has(v.toLowerCase())) {
        setNewValue("");
        return;
      }
      setItems((arr) => [
        ...arr,
        { id: crypto.randomUUID(), value: v, aliases: [] },
      ]);
      setNewValue("");
    };

    const addBulk = () => {
      const parsed = parseBulkInput(bulkText);
      if (parsed.length === 0) return;
      const existing = new Set(existingValues);
      const toAdd: CatalogItem[] = [];
      for (const v of parsed) {
        const key = v.toLowerCase();
        if (existing.has(key)) continue;
        existing.add(key);
        toAdd.push({ id: crypto.randomUUID(), value: v, aliases: [] });
      }
      if (toAdd.length > 0) setItems((arr) => [...arr, ...toAdd]);
      setBulkText("");
    };

    const removeItem = (id: string) =>
      setItems((arr) => arr.filter((it) => it.id !== id));

    const updateItem = (id: string, value: string) =>
      setItems((arr) =>
        arr.map((it) => (it.id === id ? { ...it, value } : it))
      );

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      void onSave({
        name: name.trim(),
        fieldKey,
        active,
        items: items.filter((it) => it.value.trim()),
      });
    };

    // Agrupamos las opciones del select por categoría (renderizamos un header
    // inerte entre cada grupo). base-ui no expone optgroup nativo en `Select`,
    // así que usamos un SelectItem con `disabled` como cabecera visual.
    const grouped = useMemo(() => {
      const map = new Map<string, typeof CATALOG_FIELD_KEYS>();
      for (const f of CATALOG_FIELD_KEYS) {
        const arr = map.get(f.group) ?? [];
        arr.push(f);
        map.set(f.group, arr);
      }
      return Array.from(map.entries());
    }, []);

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Nombre</Label>
            <Input
              id="cat-name"
              placeholder="Ej. Bancos chilenos"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-field">Vinculado al campo</Label>
            <Select
              value={fieldKey}
              onValueChange={(v) => v && setFieldKey(v)}
            >
              <SelectTrigger id="cat-field">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {grouped.map(([group, options], gi) => (
                  <div key={group}>
                    {gi > 0 && <div className="my-1 border-t" />}
                    <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group}
                    </div>
                    {options.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              El selector del campo aparecerá al revisar este dato en cada
              registro.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="cat-active"
            checked={active}
            onCheckedChange={setActive}
          />
          <Label htmlFor="cat-active" className="cursor-pointer">
            Catálogo activo (aparece al revisar registros)
          </Label>
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">
              Valores permitidos
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {items.length} ítem{items.length === 1 ? "" : "s"}
              </span>
            </Label>
          </div>

          {/* Pegado masivo: lo más cómodo para crear catálogos. */}
          <div className="space-y-1.5">
            <Label
              htmlFor="cat-bulk"
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <ClipboardPaste className="size-3" />
              Pegar lista (uno por línea, o separados por coma, ; o tab)
            </Label>
            <Textarea
              id="cat-bulk"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={3}
              placeholder={"Banco de Chile\nBancoEstado\nBCI\nSantander\nItaú"}
              className="text-sm"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-muted-foreground">
                Los duplicados se descartan automáticamente.
              </p>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={addBulk}
                disabled={!bulkText.trim()}
                className="gap-1 bg-indigo-600 hover:bg-indigo-500"
              >
                <ListPlus className="size-3.5" />
                Agregar lista ({parseBulkInput(bulkText).length})
              </Button>
            </div>
          </div>

          {/* Añadir uno a uno (cómodo para correcciones puntuales). */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              o agregar uno a uno
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Escribe un valor y presiona Enter"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOne();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addOne}
                className="gap-1"
              >
                <Plus className="size-3.5" />
                Añadir
              </Button>
            </div>
          </div>

          {/* Lista de valores ya añadidos. */}
          <div className="max-h-56 space-y-1 overflow-auto rounded-md border bg-background p-2">
            {items.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Sin valores aún. Pega una lista o agrega uno arriba.
              </p>
            ) : (
              items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-1.5 rounded bg-muted/40 p-1 pl-2"
                >
                  <Input
                    value={it.value}
                    onChange={(e) => updateItem(it.id, e.target.value)}
                    className="h-7 border-none bg-transparent text-sm shadow-none focus-visible:ring-0"
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => removeItem(it.id)}
                    className="text-muted-foreground hover:text-red-600"
                    aria-label="Eliminar valor"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500"
            disabled={saving || !name.trim()}
          >
            {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear"}
          </Button>
        </div>
      </form>
    );
  }
);
