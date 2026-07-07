export const BRAND_LOGO_SRC = "/404lab.svg";
/** Marca corta (UI compacta: sidebar, header). */
export const BRAND_NAME = "Sephora";
/** Nombre completo del sistema. */
export const APP_NAME = "Sephora Viewer";
export const APP_TITLE = APP_NAME;
/** Empresa / identidad del logo. */
export const BRAND_LAB_NAME = "404LAB";

/**
 * Resolución máxima para la versión ORIGINAL (la que ve el admin con zoom).
 * 2000 px da una imagen nítida para revisión; el archivo queda en ~700 KB.
 */
export const PIPELINE_ORIGINAL_MAX_DIMENSION = 2000;
export const PIPELINE_ORIGINAL_JPEG_QUALITY = 0.85;

/**
 * Resolución para la versión PROCESADA (la que se envía a Qwen).
 * 1400 px → ~1.96 MP, combinado con QWEN_MAX_PIXELS=1,638,400 → ~1600 tokens
 * de visión por imagen (~35% más barato que el default de Qwen).
 */
export const PIPELINE_PROCESSED_MAX_DIMENSION = 1400;
export const PIPELINE_PROCESSED_JPEG_QUALITY = 0.8;

/**
 * Realce de contraste apagado por defecto.
 * El histogram-stretch hace que los trazos manuscritos se vean más gruesos y
 * el modelo confunde dígitos. Mejor enviar la imagen "natural" y dejar que el
 * modelo trabaje con lo que vería un humano.
 */
export const PIPELINE_ENHANCE_BY_DEFAULT = false;

/** @deprecated Mantén para compatibilidad con código existente. */
export const PIPELINE_MAX_DIMENSION = PIPELINE_ORIGINAL_MAX_DIMENSION;
/** @deprecated Mantén para compatibilidad con código existente. */
export const PIPELINE_JPEG_QUALITY = PIPELINE_ORIGINAL_JPEG_QUALITY;

export const COPY = {
  driver: {
    title: "Mis envíos",
    newRecord: "Nuevo Registro",
    empty: "Aún no has enviado documentos. Toca el botón de abajo para capturar tu primer registro.",
    optimizing: "Optimizando imagen...",
    send: "Enviar",
    addMore: "Agregar otra imagen",
    retake: "Tomar otra foto",
    confirm: "Confirmar imagen",
  },
  admin: {
    title: "Panel de revisión",
    processAI: "Procesar con IA",
    noExtraction: "La inteligencia artificial no ha sido ejecutada todavía. Pulse el botón para extraer datos del documento seleccionado.",
    save: "Guardar",
    markErrors: "Marcar con errores",
    reject: "Rechazar",
    exportPdf: "Exportar PDF",
    print: "Imprimir",
  },
  role: {
    driver: "Soy conductor",
    admin: "Soy administrador",
    driverDesc: "Captura documentos manuscritos desde tu teléfono.",
    adminDesc: "Revisa la cola de trabajo y valida los datos extraídos.",
  },
} as const;
