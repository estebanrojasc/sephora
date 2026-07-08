"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  useDeleteRecord,
  useUploadImages,
} from "@/features/records/mutations";
import {
  canAppendImagesToRecord,
  type Record,
} from "@/features/records/types";
import { toast } from "sonner";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

interface AdminRecordMediaActionsProps {
  record: Record;
}

/** Acciones de media: agregar hojas (admin) y eliminar registro. */
export function AdminRecordMediaActions({
  record,
}: AdminRecordMediaActionsProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadImages();
  const deleteRecord = useDeleteRecord();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canAppend = canAppendImagesToRecord(record.status);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const images = await Promise.all(
        Array.from(files).map(async (file, i) => {
          const dataUrl = await fileToDataUrl(file);
          return {
            dataUrl,
            processedDataUrl: dataUrl,
            name: file.name || `admin-extra-${i + 1}.jpg`,
          };
        })
      );
      await upload.mutateAsync({
        deviceId: record.deviceId,
        driverId: record.driverId,
        driverName: record.driverName,
        recordId: record.id,
        images,
      });
      toast.success(
        images.length === 1
          ? "Hoja agregada al registro"
          : `${images.length} hojas agregadas`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudieron agregar las imágenes"
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    try {
      await deleteRecord.mutateAsync(record.id);
      toast.success("Registro eliminado");
      router.push("/admin");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo eliminar"
      );
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {canAppend && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
          Agregar hoja
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setDeleteOpen(true)}
        disabled={deleteRecord.isPending}
      >
        <Trash2 className="size-4" />
        Eliminar
      </Button>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar este registro?"
        description="Se borrará el envío y sus imágenes del almacenamiento. Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        variant="destructive"
        onConfirm={() => void handleDelete()}
        loading={deleteRecord.isPending}
      />
    </>
  );
}
