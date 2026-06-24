"use client";

import { Fragment, useMemo, useState } from "react";
import { Copy, FileJson, WrapText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RawResponseDialogProps {
  raw?: string;
  model?: string;
  source?: "qwen" | "gemini" | "mock";
  withBboxes?: boolean;
}

const SOURCE_LABEL: Record<NonNullable<RawResponseDialogProps["source"]>, string> = {
  qwen: "Qwen",
  gemini: "Gemini",
  mock: "Simulado",
};

const SOURCE_VARIANT: Record<
  NonNullable<RawResponseDialogProps["source"]>,
  "default" | "secondary" | "outline"
> = {
  qwen: "default",
  gemini: "default",
  mock: "secondary",
};

export function RawResponseDialog({
  raw,
  model,
  source,
  withBboxes,
}: RawResponseDialogProps) {
  const [open, setOpen] = useState(false);
  const [wrap, setWrap] = useState(true);

  const pretty = useMemo(() => prettifyJson(raw ?? ""), [raw]);
  const isJson = useMemo(() => isLikelyJson(pretty), [pretty]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pretty);
      toast.success("Copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const lineCount = pretty ? pretty.split("\n").length : 0;
  const charCount = pretty ? pretty.length : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" disabled={!raw}>
            <FileJson className="size-4" />
            Ver respuesta IA
          </Button>
        }
      />
      <DialogContent className="flex max-h-[90vh] w-full max-w-4xl flex-col gap-3 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-5 pb-3 pt-5">
          <DialogTitle className="text-base">
            Respuesta cruda del modelo
          </DialogTitle>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            {source && (
              <Badge variant={SOURCE_VARIANT[source]} className="font-mono">
                {SOURCE_LABEL[source]}
              </Badge>
            )}
            {model && (
              <Badge variant="outline" className="font-mono">
                {model}
              </Badge>
            )}
            {withBboxes !== undefined && (
              <Badge variant="outline">
                Bboxes: {withBboxes ? "sí" : "no"}
              </Badge>
            )}
            {isJson && (
              <Badge variant="ghost" className="text-muted-foreground">
                {lineCount} líneas · {charCount.toLocaleString("es-CL")} caracteres
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 px-5">
          <p className="text-xs text-muted-foreground">
            {isJson
              ? "JSON formateado con resaltado de sintaxis."
              : "La respuesta no es JSON válido; se muestra el texto tal cual."}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWrap((w) => !w)}
              title={wrap ? "Desactivar ajuste de línea" : "Activar ajuste de línea"}
            >
              <WrapText className="size-4" />
              {wrap ? "Sin ajuste" : "Ajustar líneas"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copy}
              disabled={!raw}
            >
              <Copy className="size-4" />
              Copiar
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "mx-5 mb-5 flex-1 overflow-auto rounded-md border bg-muted/30 font-mono text-[12px] leading-relaxed",
            "min-h-[280px] max-h-[65vh]"
          )}
        >
          {pretty ? (
            <pre
              className={cn(
                "p-4",
                wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"
              )}
            >
              {isJson ? <JsonHighlighted text={pretty} /> : pretty}
            </pre>
          ) : (
            <p className="p-4 text-muted-foreground">
              Sin respuesta cruda disponible.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function prettifyJson(s: string): string {
  if (!s) return "";
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

function isLikelyJson(s: string): boolean {
  if (!s) return false;
  const t = s.trimStart();
  return t.startsWith("{") || t.startsWith("[");
}

/**
 * Resaltado liviano de JSON sin dependencias. Tokeniza claves, strings,
 * números, booleanos y null y los envuelve en spans con colores Tailwind.
 * El resto del texto (llaves, comas, espacios) se conserva sin colorear.
 */
function JsonHighlighted({ text }: { text: string }) {
  const TOKEN_RE =
    /"(?:[^"\\]|\\.)*"\s*:|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g;

  const parts: Array<{ key: string; node: React.ReactNode }> = [];
  let lastIndex = 0;
  let i = 0;
  let m: RegExpExecArray | null;

  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push({ key: `t${i++}`, node: text.slice(lastIndex, m.index) });
    }
    const tok = m[0];
    let cls = "";
    if (/:\s*$/.test(tok)) {
      cls = "text-sky-700 dark:text-sky-300";
    } else if (tok.startsWith('"')) {
      cls = "text-emerald-700 dark:text-emerald-300";
    } else if (tok === "true" || tok === "false") {
      cls = "text-purple-700 dark:text-purple-300";
    } else if (tok === "null") {
      cls = "text-rose-600 dark:text-rose-400";
    } else {
      cls = "text-amber-700 dark:text-amber-400";
    }
    parts.push({
      key: `s${i++}`,
      node: <span className={cls}>{tok}</span>,
    });
    lastIndex = m.index + tok.length;
  }
  if (lastIndex < text.length) {
    parts.push({ key: `t${i++}`, node: text.slice(lastIndex) });
  }

  return (
    <>
      {parts.map((p) => (
        <Fragment key={p.key}>{p.node}</Fragment>
      ))}
    </>
  );
}
