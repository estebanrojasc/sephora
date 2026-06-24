"use client";

import { useRef, useState } from "react";
import { Plus, Database, Edit3, Trash2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  CatalogEditor,
  type CatalogEditorHandle,
} from "@/components/admin/catalogs/CatalogEditor";
import {
  useCatalogs,
  useCreateCatalog,
  useDeleteCatalog,
  useUpdateCatalog,
} from "@/features/catalogs/queries";
import type { Catalog } from "@/features/catalogs/types";
import { CATALOG_FIELD_KEYS } from "@/features/catalogs/types";
import { toast } from "sonner";

export default function CatalogsPage() {
  const { data: catalogs = [], isLoading } = useCatalogs();
  const createMutation = useCreateCatalog();
  const updateMutation = useUpdateCatalog();
  const deleteMutation = useDeleteCatalog();

  const [editing, setEditing] = useState<Catalog | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const editorRef = useRef<CatalogEditorHandle>(null);

  const closeEditor = () => {
    setEditing(null);
    setConfirmDiscard(false);
  };

  /** Pide confirmación si hay cambios sin guardar antes de cerrar. */
  const requestCloseEditor = () => {
    if (editorRef.current?.isDirty()) {
      setConfirmDiscard(true);
      return;
    }
    closeEditor();
  };

  const labelFor = (key: string) =>
    CATALOG_FIELD_KEYS.find((f) => f.value === key)?.label ?? key;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Catálogos"
          description="Listas controladas que aparecerán como sugerencias al revisar campos extraídos por la IA. Ideal para choferes, auxiliares, bancos, patentes, etc."
        />
        <Button
          onClick={() => setEditing("new")}
          className="gap-2 bg-indigo-600 hover:bg-indigo-500"
        >
          <Plus className="size-4" />
          Nuevo catálogo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Cargando…
        </div>
      ) : catalogs.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
            <Database className="size-7" />
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Aún no creaste catálogos. Crea uno para estandarizar los valores
            que la IA escribe (por ejemplo: lista de bancos, conductores,
            auxiliares).
          </p>
          <Button
            onClick={() => setEditing("new")}
            className="gap-2 bg-indigo-600 hover:bg-indigo-500"
          >
            <Plus className="size-4" />
            Crear primer catálogo
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalogs.map((cat) => (
            <Card
              key={cat.id}
              className="flex flex-col gap-3 p-4 transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{cat.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Vinculado a: {labelFor(cat.fieldKey)}
                  </p>
                </div>
                {cat.active ? (
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-200">
                    Activo
                  </Badge>
                ) : (
                  <Badge variant="outline">Inactivo</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {cat.items.length} ítem{cat.items.length === 1 ? "" : "s"}
              </p>
              <div className="mt-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setEditing(cat)}
                >
                  <Edit3 className="size-3.5" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                  onClick={() => setDeletingId(cat.id)}
                >
                  <Trash2 className="size-3.5" />
                  Eliminar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (createMutation.isPending || updateMutation.isPending) return;
          if (!open) requestCloseEditor();
        }}
      >
        <DialogContent
          className="max-w-2xl"
          showCloseButton={
            !createMutation.isPending && !updateMutation.isPending
          }
        >
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? "Nuevo catálogo" : "Editar catálogo"}
            </DialogTitle>
          </DialogHeader>
          {editing !== null && (
            <CatalogEditor
              ref={editorRef}
              initial={editing === "new" ? undefined : editing}
              saving={createMutation.isPending || updateMutation.isPending}
              onSave={async (payload) => {
                try {
                  if (editing === "new") {
                    await createMutation.mutateAsync(payload);
                    toast.success("Catálogo creado");
                  } else {
                    await updateMutation.mutateAsync({
                      id: editing.id,
                      payload,
                    });
                    toast.success("Catálogo actualizado");
                  }
                  closeEditor();
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Error guardando"
                  );
                }
              }}
              onCancel={requestCloseEditor}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmación de descartar cambios al cerrar el editor con dirty state. */}
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={(o) => !o && setConfirmDiscard(false)}
        title="¿Descartar cambios?"
        description="Hay cambios sin guardar en el catálogo. Si cierras ahora se perderán."
        confirmLabel="Descartar"
        cancelLabel="Seguir editando"
        variant="destructive"
        onConfirm={closeEditor}
      />

      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title="¿Eliminar catálogo?"
        description="Los registros existentes no se modifican; solo dejará de sugerirse al revisar."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deletingId) return;
          try {
            await deleteMutation.mutateAsync(deletingId);
            toast.success("Catálogo eliminado");
            setDeletingId(null);
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : "No se pudo eliminar"
            );
          }
        }}
      />
    </div>
  );
}
