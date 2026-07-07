# Sephora Viewer · 404LAB

Aplicación de captura y revisión de hojas de rendición de ruta manuscritas, con dos roles:

- **Conductor (móvil)**: captura fotos con ajuste de recorte manual + optimización automática.
- **Administrador (escritorio/tablet)**: revisa la cola, procesa con IA bajo demanda (Qwen-VL), edita y valida.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- shadcn/ui + Tailwind CSS v4
- TanStack Query + TanStack Table
- Zustand (sesión mock)
- Scanic (detección de bordes) + react-image-crop (ajuste manual) + Pica + Compressor.js
- Qwen-VL vía API OpenAI-compatible (DashScope) — con **fallback automático a mock** si no hay API key
- jsPDF + jspdf-autotable

## Inicio rápido

```bash
npm install
cp .env.example .env.local   # opcional, para conectar Qwen real
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) y elige **Conductor** o **Administrador**.

### Conectar Qwen real

Define en `.env.local`:

```
QWEN_API_KEY=sk-...
QWEN_MODEL=qwen-vl-plus
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

Sin estas variables, el endpoint `/api/records/:id/process-ai` devuelve datos simulados realistas para poder demostrar la UI sin coste.

## Flujo de imagen (conductor)

1. Captura nativa (`<input capture="environment">`).
2. **Editor de recorte**: Scanic detecta el documento y propone un rectángulo. El conductor lo confirma o ajusta arrastrando.
3. Resize Lanczos a 1500px con **Pica**.
4. Compresión JPEG 70% con **Compressor.js**.
5. Envío a `/api/records/upload`. **Cada envío crea un registro nuevo** (no agrupa por dispositivo).

## Flujo de extracción (admin)

- Cada imagen del registro se puede procesar individualmente con "Procesar con IA".
- **Primera imagen** → Qwen genera la plantilla JSON inicial (todos los campos + bboxes).
- **Imágenes siguientes** → Qwen recibe el JSON previo y solo añade/completa los campos faltantes (sin pisar valores ya rellenos correctamente).
- El admin edita campos manualmente; sus cambios prevalecen sobre la IA.
- Hover sobre cualquier campo → resalta la `bbox` correspondiente sobre la imagen.

## Estructura del JSON extraído

Definido en [`src/features/records/types.ts`](src/features/records/types.ts).
Cada campo es `{ valor: string, bbox: [x_min, y_min, x_max, y_max] }` con coordenadas normalizadas 0-1000.

Secciones:
- Encabezado (fecha, conductor, auxiliar, n_recorrido, patente, cant_fact, valor_total, hora_de_salida)
- Rendición (efectivo, cheques, transferencia, total, etc.)
- Detalle de cheques (array)
- Detalle de efectivo (billetes + total)
- N/C rechazo total / parcial / por negocios (arrays + totales)
- Depósito y observaciones

## Estructura de carpetas

```
src/
  app/
    (driver)/driver/             # Flujo móvil conductor
    (admin)/admin/               # Panel administrador
    api/records/                 # API routes (Next)
  components/
    common/                      # Reutilizables (StatusBadge, ImageWithZoom, etc.)
    driver/                      # CameraInput, CropEditor, OptimizationProgress, CapturedImagesList
    admin/
      RecordsTable.tsx
      record-detail/             # ImageGallery, ExtractionForm, RowsEditor, FieldInput, ActionBar, etc.
  features/
    records/                     # types, queries, mutations, status, extraction-merge
    image-pipeline/              # scanic (detect+crop), pica, compressor, pipeline
    qwen/                        # prompts, client (server-only), mock
    pdf/                         # generateRecordPdf
    auth/                        # session-store, device-id
  mocks/                         # DB en memoria + seed
```

## Scripts

| Comando        | Descripción              |
|----------------|--------------------------|
| `npm run dev`  | Servidor de desarrollo   |
| `npm run build`| Build de producción      |
| `npm run start`| Servidor de producción   |
| `npm run lint` | ESLint                   |
