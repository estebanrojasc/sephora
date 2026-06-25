"use client";

import { useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface BitacoraPasteZoneProps {
  value: string;
  onChange: (value: string) => void;
  onPaste: (raw: string) => void;
}

export function BitacoraPasteZone({
  value,
  onChange,
  onPaste,
}: BitacoraPasteZoneProps) {
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const tsv = e.clipboardData.getData("text/plain");
      const html = e.clipboardData.getData("text/html");
      const raw = tsv.trim() ? tsv : html;
      if (raw.trim()) {
        e.preventDefault();
        onChange(raw);
        onPaste(raw);
      }
    },
    [onChange, onPaste]
  );

  return (
    <div className="space-y-2">
      <Label>Pegar tabla desde Excel</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        placeholder="Copia la tabla en Excel (Ctrl+C) y pégala aquí (Ctrl+V)…"
        className="min-h-[120px] font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground">
        Copia la selección en Excel (Ctrl+C) y pégala aquí (Ctrl+V). Al pegar
        avanzarás automáticamente al paso de revisión.
      </p>
    </div>
  );
}
