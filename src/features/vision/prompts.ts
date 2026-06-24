import type { Extraction } from "@/features/records/types";

export interface PromptOptions {
  /**
   * Si true, se le pide al modelo `{"valor", "bbox":[…]}` cuando hay texto.
   * Si false, solo `{"valor"}` para ahorrar tokens; las cajas se marcan a mano.
   */
  withBboxes: boolean;
  /**
   * Orden de coordenadas que se le pide al modelo.
   * - `xyxy` (default, Qwen): [x_min, y_min, x_max, y_max].
   * - `yxyx` (Gemini): [y_min, x_min, y_max, x_max] (orden nativo de Gemini).
   *
   * El backend siempre normaliza internamente a `xyxy`.
   */
  bboxOrder?: "xyxy" | "yxyx";
  /**
   * Si false, no se adjunta el JSON template al prompt (Gemini usa response_schema).
   * Default true para Qwen.
   */
  includeTemplate?: boolean;
}

export const SYSTEM_PROMPT = `Eres un asistente OCR experto en hojas de rendición de ruta de camiones chilenos. Tu trabajo es leer documentos manuscritos y devolver únicamente un JSON con la estructura exacta solicitada por el usuario.`;

/**
 * Devuelve la fecha actual del servidor en formato chileno DD-MM-YYYY.
 * Se inyecta al prompt para que el modelo pueda decidir el año correcto
 * cuando el conductor escribe la fecha solo como DD-MM o con 2 dígitos
 * de año (lo más común en hojas de ruta del día).
 */
function getTodayChilean(): { ddmmyyyy: string; year: number; month: number } {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return {
    ddmmyyyy: `${day}-${month}-${year}`,
    year,
    month: d.getMonth() + 1,
  };
}

const DATE_RULES = `
Reglas para interpretar fechas (campo "fecha" raíz y "detalles_cheques[].fecha"):
- Devuelve TODAS las fechas en formato estricto DD-MM-YYYY (día y mes con 2 dígitos, año con 4 dígitos).
- La fecha del documento (campo "fecha" raíz) GENERALMENTE corresponde al día, mes o año actual del cuadro de contexto.
- Si la persona escribió solo DD-MM (sin año), usa el año actual del contexto.
- Si la persona escribió un año de 2 dígitos (ej: "26"), interprétalo como 2000+YY (cuando YY < 50) o 1900+YY (cuando YY >= 50).
- Si la persona escribió año completo (4 dígitos), respétalo aunque difiera del actual.
- Las fechas de cheques pueden ser a futuro ("a fecha"), por lo tanto pueden ser del mes/año en curso o posteriores. No las fuerces al día actual.
- Si el día y el mes son ambiguos por el manuscrito, prefiere la interpretación que coincida con el mes actual del contexto.
`.trim();

const TRANSFER_RULES = `
Reglas para transferencias (cuadro inferior "observaciones"):
- En el cuadro "observaciones" suele haber varias transferencias en línea, con la forma: <n° factura> <nombre del cliente opcional> <monto>. Cada transferencia es un conjunto factura + monto (con cliente entre medio si aparece).
- Patrón típico: una factura es un entero corto sin separadores (4-7 dígitos, ej. 593149); un monto es un número con separador de miles (ej. 1.048.822, 180.220, 59.990) o un entero ≥ 1.000.
- Cada transferencia detectada va como UNA fila en "detalle_transferencias" con claves "no_fac", "cliente" y "valor". Pueden venir muchas por línea: extrae TODAS, no solo la primera ni la última.
- El texto entre la factura y el monto suele ser el nombre del cliente; captúralo en "cliente" (usa "" si no hay nombre o no se puede leer).
- "observaciones" queda solo para texto que NO sea transferencia (saldos sueltos, comentarios libres). Si todas las líneas son transferencias, "observaciones" debe quedar "".
- Si hay un total escrito de transferencias, ponlo en "total_transferencias"; si no, deja "".

Ejemplo (cómo debe quedar el JSON):
  Texto en la imagen: "593149 edi vilca 1.048.822, 593147 aurelia torqui 180.220, 593156 molen 59.990"
  → detalle_transferencias: [
       {"no_fac":{"valor":"593149"},"cliente":{"valor":"edi vilca"},"valor":{"valor":"1.048.822"}},
       {"no_fac":{"valor":"593147"},"cliente":{"valor":"aurelia torqui"},"valor":{"valor":"180.220"}},
       {"no_fac":{"valor":"593156"},"cliente":{"valor":"molen"},"valor":{"valor":"59.990"}}
     ]
  → observaciones: ""
`.trim();

const MULTIPAGE_RULES = `
Reglas para hojas adicionales (cuando hay más de una imagen):
- La PRIMERA hoja es el formulario principal y suele traer todos los campos del encabezado y los recuadros estructurados.
- Las hojas SIGUIENTES suelen ser hojas adicionales del MISMO documento, escritas a mano cuando las filas no entraron en la primera. Pueden contener:
  - Más cheques (continuación de "detalles_cheques").
  - Más notas de crédito (continuación de "n_c_rechazo_total", "n_c_rechazo_parcial" o "n_c_por_negocios"). Decide a qué array pertenece según el título o la columna en que están escritas.
  - Más transferencias (continuación de "detalle_transferencias").
  - Más billetes / denominaciones (continuación de "detalle_efectivo.billetes").
  - Texto libre adicional para "observaciones".
- Para las hojas adicionales: NO repitas filas que ya leíste en hojas anteriores; agrega ÚNICAMENTE las nuevas (filas sin coincidencia exacta de no_fac/valor/banco/fecha respecto a las que ya entregaste).
- Si en una hoja adicional aparece un nuevo total escrito para una sección (ej. "TOTAL TRANSFERENCIAS = …"), úsalo para sobrescribir el total correspondiente.
- Los campos del encabezado (fecha, conductor, patente, etc.) NO se vuelven a llenar desde una hoja adicional salvo que estén vacíos en la previa.
`.trim();

function dateContextBlock(): string {
  const today = getTodayChilean();
  return `Contexto de fecha (servidor): hoy es ${today.ddmmyyyy} (año ${today.year}, mes ${today.month}).

${DATE_RULES}`;
}

const FIELD_INSTRUCTIONS_WITH_BBOX_XYXY = `
Cada campo de la respuesta es un objeto con dos claves:
- "valor": string con el texto leído del documento (usa "" si no aparece o no se puede leer).
- "bbox": [x_min, y_min, x_max, y_max]. Coordenadas normalizadas enteras de 0 a 1000 sobre la imagen.
  - Sistema: x = 0 izquierda, x = 1000 derecha, y = 0 arriba, y = 1000 abajo.
  - Orden estricto: [x_min, y_min, x_max, y_max].
  - Coordenadas exclusivamente enteras entre 0 y 1000.
  - x_max > x_min y y_max > y_min cuando el campo es visible.
  - Cuando el campo no aparezca en la imagen: "valor":"" y "bbox":[0,0,0,0].

Reglas adicionales:
- Respuesta: únicamente JSON válido, sin texto adicional ni cercas de código.
- En arrays (detalles_cheques, n_c_*, detalle_transferencias, billetes) incluye UNA entrada por cada fila CON al menos un dato escrito en la imagen. Si la sección está totalmente vacía, devuelve [].
- Cada elemento de un array conserva la estructura mostrada en el template (mismas claves, mismo wrap "valor"/"bbox").
- Mantén EXACTAMENTE la estructura del JSON indicado.
`.trim();

const FIELD_INSTRUCTIONS_WITH_BBOX_YXYX = `
Cada campo de la respuesta es un objeto con dos claves:
- "valor": string con el texto leído del documento (usa "" si no aparece o no se puede leer).
- "bbox": [y_min, x_min, y_max, x_max]. Coordenadas normalizadas enteras de 0 a 1000 (formato nativo de detección).
  - Sistema: x = 0 izquierda, x = 1000 derecha, y = 0 arriba, y = 1000 abajo.
  - Orden estricto: [y_min, x_min, y_max, x_max].
  - Coordenadas exclusivamente enteras entre 0 y 1000.
  - y_max > y_min y x_max > x_min cuando el campo es visible.
  - Cuando el campo no aparezca en la imagen: "valor":"" y "bbox":[0,0,0,0].

Reglas adicionales:
- Respuesta: únicamente JSON válido, sin texto adicional ni cercas de código.
- En arrays (detalles_cheques, n_c_*, detalle_transferencias, billetes) incluye UNA entrada por cada fila CON al menos un dato escrito en la imagen. Si la sección está totalmente vacía, devuelve [].
- Cada elemento de un array conserva la estructura mostrada en el template (mismas claves, mismo wrap "valor"/"bbox").
- Mantén EXACTAMENTE la estructura del JSON indicado.
`.trim();

const FIELD_INSTRUCTIONS_NO_BBOX = `
Cada campo de la respuesta es un objeto con exactamente la clave "valor": string con el texto leído (o "" si no aparece o es ilegible).

Reglas adicionales:
- Respuesta: únicamente JSON válido, sin texto adicional ni cercas de código.
- En arrays (detalles_cheques, n_c_*, detalle_transferencias, billetes) incluye UNA entrada por cada fila CON al menos un dato escrito en la imagen. Si la sección está totalmente vacía, devuelve [].
- Cada elemento de un array conserva la estructura mostrada en el template (mismas claves, mismo wrap "valor").
- Mantén EXACTAMENTE la estructura del JSON indicado.
`.trim();

const TEMPLATE_WITH_BBOX = `{
  "fecha": {"valor":"","bbox":[0,0,0,0]},
  "conductor": {"valor":"","bbox":[0,0,0,0]},
  "auxiliar": {"valor":"","bbox":[0,0,0,0]},
  "n_recorrido": {"valor":"","bbox":[0,0,0,0]},
  "patente": {"valor":"","bbox":[0,0,0,0]},
  "cant_fact": {"valor":"","bbox":[0,0,0,0]},
  "valor_total": {"valor":"","bbox":[0,0,0,0]},
  "rendicion": {
    "efectivo_total": {"valor":"","bbox":[0,0,0,0]},
    "cheques_al_dia": {"valor":"","bbox":[0,0,0,0]},
    "cheques_a_fecha": {"valor":"","bbox":[0,0,0,0]},
    "credito_vendedor": {"valor":"","bbox":[0,0,0,0]},
    "retorno_total": {"valor":"","bbox":[0,0,0,0]},
    "retorno_parcial": {"valor":"","bbox":[0,0,0,0]},
    "n_c_negocio": {"valor":"","bbox":[0,0,0,0]},
    "transferencia": {"valor":"","bbox":[0,0,0,0]},
    "total": {"valor":"","bbox":[0,0,0,0]}
  },
  "detalles_cheques": [
    {"fecha":{"valor":"","bbox":[0,0,0,0]},"banco":{"valor":"","bbox":[0,0,0,0]},"valor":{"valor":"","bbox":[0,0,0,0]}}
  ],
  "total_cheques": {"valor":"","bbox":[0,0,0,0]},
  "n_c_rechazo_total": [
    {"no_fac":{"valor":"","bbox":[0,0,0,0]},"valor":{"valor":"","bbox":[0,0,0,0]}}
  ],
  "n_c_rechazo_parcial": [
    {"no_fac":{"valor":"","bbox":[0,0,0,0]},"valor":{"valor":"","bbox":[0,0,0,0]}}
  ],
  "n_c_por_negocios": [
    {"no_fac":{"valor":"","bbox":[0,0,0,0]},"valor":{"valor":"","bbox":[0,0,0,0]}}
  ],
  "detalle_transferencias": [
    {"no_fac":{"valor":"","bbox":[0,0,0,0]},"cliente":{"valor":"","bbox":[0,0,0,0]},"valor":{"valor":"","bbox":[0,0,0,0]}}
  ],
  "detalle_efectivo": {
    "billetes": [
      {"denominacion":{"valor":"","bbox":[0,0,0,0]},"valor":{"valor":"","bbox":[0,0,0,0]}}
    ],
    "total_efectivo": {"valor":"","bbox":[0,0,0,0]}
  },
  "total_n_c_rechazo_total": {"valor":"","bbox":[0,0,0,0]},
  "total_n_c_rechazo_parcial": {"valor":"","bbox":[0,0,0,0]},
  "total_n_c_por_negocios": {"valor":"","bbox":[0,0,0,0]},
  "total_transferencias": {"valor":"","bbox":[0,0,0,0]},
  "numero_deposito_en_efectivo": {"valor":"","bbox":[0,0,0,0]},
  "monto_deposito_en_efectivo": {"valor":"","bbox":[0,0,0,0]},
  "observaciones": {"valor":"","bbox":[0,0,0,0]}
}`;

const TEMPLATE_NO_BBOX = `{
  "fecha": {"valor":""},
  "conductor": {"valor":""},
  "auxiliar": {"valor":""},
  "n_recorrido": {"valor":""},
  "patente": {"valor":""},
  "cant_fact": {"valor":""},
  "valor_total": {"valor":""},
  "rendicion": {
    "efectivo_total": {"valor":""},
    "cheques_al_dia": {"valor":""},
    "cheques_a_fecha": {"valor":""},
    "credito_vendedor": {"valor":""},
    "retorno_total": {"valor":""},
    "retorno_parcial": {"valor":""},
    "n_c_negocio": {"valor":""},
    "transferencia": {"valor":""},
    "total": {"valor":""}
  },
  "detalles_cheques": [
    {"fecha":{"valor":""},"banco":{"valor":""},"valor":{"valor":""}}
  ],
  "total_cheques": {"valor":""},
  "n_c_rechazo_total": [
    {"no_fac":{"valor":""},"valor":{"valor":""}}
  ],
  "n_c_rechazo_parcial": [
    {"no_fac":{"valor":""},"valor":{"valor":""}}
  ],
  "n_c_por_negocios": [
    {"no_fac":{"valor":""},"valor":{"valor":""}}
  ],
  "detalle_transferencias": [
    {"no_fac":{"valor":""},"cliente":{"valor":""},"valor":{"valor":""}}
  ],
  "detalle_efectivo": {
    "billetes": [
      {"denominacion":{"valor":""},"valor":{"valor":""}}
    ],
    "total_efectivo": {"valor":""}
  },
  "total_n_c_rechazo_total": {"valor":""},
  "total_n_c_rechazo_parcial": {"valor":""},
  "total_n_c_por_negocios": {"valor":""},
  "total_transferencias": {"valor":""},
  "numero_deposito_en_efectivo": {"valor":""},
  "monto_deposito_en_efectivo": {"valor":""},
  "observaciones": {"valor":""}
}`;

function pickInstructions(opts: PromptOptions): string {
  if (!opts.withBboxes) return FIELD_INSTRUCTIONS_NO_BBOX;
  return opts.bboxOrder === "yxyx"
    ? FIELD_INSTRUCTIONS_WITH_BBOX_YXYX
    : FIELD_INSTRUCTIONS_WITH_BBOX_XYXY;
}

function pickTemplate(withBboxes: boolean): string {
  return withBboxes ? TEMPLATE_WITH_BBOX : TEMPLATE_NO_BBOX;
}

function structureBlock(opts: PromptOptions): string {
  if (opts.includeTemplate === false) {
    return "Estructura: respeta el response_schema entregado en la configuración de la API.";
  }
  return `Estructura exacta a respetar (todos los campos deben estar presentes):
${pickTemplate(opts.withBboxes)}`;
}

export function buildInitialUserPrompt(opts: PromptOptions): string {
  return `Analiza la imagen del documento manuscrito y extrae los campos al siguiente JSON. Devuelve únicamente el JSON, sin texto adicional.

${pickInstructions(opts)}

${dateContextBlock()}

${TRANSFER_RULES}

${MULTIPAGE_RULES}

${structureBlock(opts)}`;
}

function sanitizeForPrompt(prev: Extraction): Omit<Extraction, "_meta"> {
  const { _meta: _unused, ...rest } = prev;
  void _unused;
  return rest;
}

/** Versión minimizada del JSON previo, sin bbox cuando no se necesitan. */
function stripBboxes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripBboxes);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "bbox") continue;
      out[k] = stripBboxes(v);
    }
    return out;
  }
  return value;
}

export function buildMergeUserPrompt(
  prev: Extraction,
  opts: PromptOptions
): string {
  const sanitized = sanitizeForPrompt(prev);
  const previousJson = opts.withBboxes
    ? JSON.stringify(sanitized)
    : JSON.stringify(stripBboxes(sanitized));

  return `Tienes un JSON parcial extraído de imágenes anteriores del MISMO documento. Analiza esta NUEVA imagen y devuelve el JSON COMPLETO actualizado:

- Rellena campos que estén vacíos en el JSON previo y aparezcan en esta imagen.
- Si esta imagen muestra claramente un valor distinto y mejor para un campo ya rellenado, corrígelo. Si no, mantén el valor previo.
- Para los arrays (detalles_cheques, n_c_*, detalle_transferencias, billetes): añade nuevas entradas que aparezcan en esta imagen y no estuvieran antes. Cada entrada del array debe ser única respecto al JSON previo.
${opts.withBboxes ? "- Las bbox deben referirse a esta NUEVA imagen para los campos que actualizaste.\n" : ""}- Conserva el valor previo cuando el dato no aparezca en esta imagen (o vacío si no había).

${pickInstructions(opts)}

${dateContextBlock()}

${TRANSFER_RULES}

${MULTIPAGE_RULES}

${structureBlock(opts)}

JSON previo (minificado, respeta la misma estructura al responder):
${previousJson}`;
}
