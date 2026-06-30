import { RECORRIDO_SUFFIX_LEN } from "./config";

export const BITACORA_SYSTEM_PROMPT = `Eres un asistente experto en bitácoras diarias de rutas de camiones en Chile. Tu trabajo es leer texto pegado desde Excel y devolver únicamente un JSON con la estructura exacta solicitada.`;

export function buildBitacoraUserPrompt(rawPaste: string): string {
  return `Analiza el siguiente texto copiado desde Excel (separado por tabulaciones) y estructúralo en JSON.

Reglas:
- "date": fecha del encabezado de la bitácora en formato YYYY-MM-DD (ej. del título "BITÁCORA ... 24-06-2026" → "2026-06-24").
- "title": título completo si aparece (ej. "BITÁCORA CL20 A 24-06-2026").
- "rows": una entrada por cada fila de datos (NO incluyas fila de encabezados de columnas).
- Columnas típicas: Territorio, Andén, Camión (patente), Chófer, Peoneta (auxiliar), Observ., Sector de Entrega, Recorrido, Primer Folio, Último Folio, Fact., Ptos., Monto Total.
- rowType "ruta": filas normales de ruta del día.
- rowType "entrega_pendiente": filas con "ENTREGA PENDIENTE"; extrae scheduledDate de la fila (fecha programada, puede ser distinta al date de la bitácora) en YYYY-MM-DD.
- rowType "manual": filas especiales sin camión (COMPRA PERSONAL, REGULARIZACION, etc.); manualSubtype en snake_case.
- rowType "totals": fila de totales globales al final (suma de facturas/montos).
- rowType "unknown": filas que no encajan.
- Ignora filas completamente vacías.
- Normaliza montos con punto como separador de miles (ej. 3.832.008).
- recorrido: número COMPLETO tal como aparece en la columna Recorrido (ej. "260006168"). recorridoSuffix: solo los últimos ${RECORRIDO_SUFFIX_LEN} dígitos (para cruce con la rendición); nunca omitas el recorrido completo en "recorrido".
- Patente: conserva formato legible (ej. "TWBD - 63").
- warnings: array de strings con ambigüedades detectadas.

Devuelve ÚNICAMENTE el JSON, sin texto adicional.

Texto pegado:
"""
${rawPaste.slice(0, 120000)}
"""`;
}

export const BITACORA_JSON_TEMPLATE = `{
  "date": "2026-06-24",
  "title": "BITÁCORA CL20 A 24-06-2026",
  "warnings": [],
  "rows": [
    {
      "rowType": "ruta",
      "territorio": "73064/69/78",
      "anden": "Pasillo",
      "patente": "TWBD - 63",
      "conductor": "Yelbrat",
      "auxiliar": "Mariano",
      "observacion": "Ruta",
      "sector": "Centro",
      "recorrido": "260006168",
      "recorridoSuffix": "6168",
      "primerFolio": "604993",
      "ultimoFolio": "605026",
      "cantFact": "34",
      "puntos": "27",
      "montoTotal": "3832008"
    }
  ]
}`;

export function buildBitacoraHintBlock(hint: {
  patente?: string;
  conductor?: string;
  auxiliar?: string;
  n_recorrido?: string;
  cant_fact?: string;
  valor_total?: string;
  sector?: string;
}): string {
  const lines: string[] = [
    "Contexto de bitácora matinal (referencia inicial del día; la hoja manuscrita puede diferir si hubo cambios durante el día):",
  ];
  if (hint.patente) lines.push(`- Patente sugerida: ${hint.patente}`);
  if (hint.conductor) lines.push(`- Conductor sugerido: ${hint.conductor}`);
  if (hint.auxiliar) lines.push(`- Auxiliar/peoneta sugerido: ${hint.auxiliar}`);
  if (hint.n_recorrido)
    lines.push(`- N° recorrido sugerido: ${hint.n_recorrido}`);
  if (hint.cant_fact) lines.push(`- Cant. facturas sugerida: ${hint.cant_fact}`);
  if (hint.valor_total)
    lines.push(`- Valor total sugerido: ${hint.valor_total}`);
  if (hint.sector) lines.push(`- Sector sugerido: ${hint.sector}`);
  lines.push(
    "Prioriza lo escrito en la imagen si contradice la bitácora. Usa la bitácora solo como pista cuando el manuscrito sea ambiguo."
  );
  return lines.join("\n");
}
