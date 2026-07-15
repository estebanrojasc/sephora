"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  BitacoraEditor,
  BitacoraVersionSelector,
} from "@/components/admin/bitacora/BitacoraEditor";
import {
  useBitacoraVersions,
  useDeleteBitacoraDay,
  useDeleteBitacoraVersion,
} from "@/features/bitacora/queries";
import { Button, buttonVariants } from "@/components/ui/button";
import { writeStoredBitacoraDate } from "@/lib/admin-session-storage";
import { cn } from "@/lib/utils";

export function BitacoraDatePageClient({ date }: { date: string }) {
  const router = useRouter();
  const {
    data: versions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useBitacoraVersions(date);
  const deleteVersion = useDeleteBitacoraVersion();
  const deleteDay = useDeleteBitacoraDay();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [editing, setEditing] = useState(false);
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState(false);
  const [confirmDeleteDay, setConfirmDeleteDay] = useState(false);

  useEffect(() => {
    setSelectedId(undefined);
    setEditing(false);
  }, [date]);

  useEffect(() => {
    if (date) writeStoredBitacoraDate(date);
  }, [date]);

  const active = versions.find((v) => v.isActive);
  const selected =
    versions.find((v) => v.id === (selectedId ?? active?.id)) ?? versions[0];

  const title = useMemo(() => {
    if (!selected) return `Bitácora ${date}`;
    return selected.title ?? `Bitácora ${date}`;
  }, [selected, date]);

  const handleDeleteVersion = async () => {
    if (!selected) return;
    try {
      const result = await deleteVersion.mutateAsync(selected.id);
      toast.success(
        result.reactivatedId
          ? "Versión eliminada · se reactivó la anterior"
          : "Versión eliminada"
      );
      setConfirmDeleteVersion(false);
      setEditing(false);
      if (!result.reactivatedId) {
        router.push("/admin/bitacora");
        return;
      }
      setSelectedId(result.reactivatedId);
      await refetch();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo eliminar la versión"
      );
    }
  };

  const handleDeleteDay = async () => {
    try {
      const result = await deleteDay.mutateAsync(date);
      toast.success(
        `Bitácora del día eliminada (${result.deletedCount} versión(es)). Los registros en Guardados no se borran.`
      );
      setConfirmDeleteDay(false);
      router.push("/admin/bitacora");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo eliminar el día"
      );
    }
  };

  if (isError) {
    return (
      <div className="space-y-4">
        <PageHeader title={`Bitácora ${date}`} />
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-medium">No se pudo cargar la bitácora</p>
          <p className="mt-1 text-xs opacity-90">
            {error instanceof Error ? error.message : "Error desconocido"}
          </p>
          <button
            type="button"
            className="mt-2 text-xs underline"
            onClick={() => void refetch()}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (isLoading && versions.length === 0) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  if (!selected) {
    return (
      <div className="space-y-4">
        <PageHeader title={`Bitácora ${date}`} />
        <p className="text-sm text-muted-foreground">
          No hay bitácora para esta fecha.{" "}
          <Link
            href={`/admin/bitacora/nueva?date=${date}`}
            className="text-indigo-600 underline"
          >
            Crear una
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/bitacora"
        className="inline-flex h-8 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver al listado
      </Link>
      <PageHeader
        title={title}
        description={`Fecha ${date} · versión ${selected.version}${selected.isActive ? " (activa)" : " (historial)"}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {selected.isActive && !editing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-3.5" />
                Editar
              </Button>
            )}
            <Link
              href={`/admin/bitacora/nueva?date=${date}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Nueva versión
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setConfirmDeleteVersion(true)}
            >
              <Trash2 className="size-3.5" />
              Eliminar versión
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setConfirmDeleteDay(true)}
            >
              Eliminar día
            </Button>
          </div>
        }
      />
      {versions.length > 1 && !editing && (
        <BitacoraVersionSelector
          versions={versions}
          selectedId={selected.id}
          onSelect={(id) => {
            setSelectedId(id);
            setEditing(false);
          }}
        />
      )}
      <BitacoraEditor
        key={`${selected.id}-${editing ? "edit" : "view"}`}
        initial={selected}
        readOnly={!editing}
        editing={editing && selected.isActive}
        onCancelEdit={() => {
          setEditing(false);
        }}
        onSavedInPlace={() => {
          setEditing(false);
          void refetch();
        }}
      />

      <ConfirmDialog
        open={confirmDeleteVersion}
        onOpenChange={setConfirmDeleteVersion}
        title="Eliminar esta versión"
        description="Se borrará solo este documento de bitácora. Los registros en Guardados (con o sin fotos) siguen existiendo. Si es la versión activa, se reactivará la versión anterior."
        confirmLabel="Eliminar versión"
        variant="destructive"
        loading={deleteVersion.isPending}
        onConfirm={() => void handleDeleteVersion()}
      />
      <ConfirmDialog
        open={confirmDeleteDay}
        onOpenChange={setConfirmDeleteDay}
        title={`Eliminar bitácora del ${date}`}
        description="Se borrarán todas las versiones de este día. Los registros en Guardados no se eliminan; bórralos desde la cola si ya no los necesitas."
        confirmLabel="Eliminar día"
        variant="destructive"
        loading={deleteDay.isPending}
        onConfirm={() => void handleDeleteDay()}
      />
    </div>
  );
}
