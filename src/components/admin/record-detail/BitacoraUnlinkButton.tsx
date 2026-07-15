"use client";

import { useState } from "react";
import { Link2Off, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useUnlinkRecordFromBitacora } from "@/features/records/mutations";
import type { Extraction } from "@/features/records/types";
import { cn } from "@/lib/utils";

interface BitacoraUnlinkButtonProps {
  recordId: string;
  extraction: Extraction | null;
  variant?: "outline" | "ghost";
  size?: "sm" | "default";
  className?: string;
  onUnlinked?: () => void;
}

export function BitacoraUnlinkButton({
  recordId,
  extraction,
  variant = "outline",
  size = "sm",
  className,
  onUnlinked,
}: BitacoraUnlinkButtonProps) {
  const unlink = useUnlinkRecordFromBitacora();
  const [open, setOpen] = useState(false);
  const meta = extraction?._meta?.bitacora;

  if (!meta?.bitacoraId) return null;

  const handleConfirm = async () => {
    try {
      await unlink.mutateAsync(recordId);
      toast.success("Registro desvinculado de la bitácora");
      setOpen(false);
      onUnlinked?.();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo desvincular"
      );
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn("gap-1.5", className)}
        disabled={unlink.isPending}
        onClick={() => setOpen(true)}
      >
        {unlink.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Link2Off className="size-3.5" />
        )}
        Desvincular de bitácora
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Desvincular de bitácora"
        description="El registro seguirá en Guardados con sus datos. Solo se quita el vínculo con la fila de bitácora; podrás borrar el día cuando no queden registros asociados."
        confirmLabel="Desvincular"
        loading={unlink.isPending}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}
