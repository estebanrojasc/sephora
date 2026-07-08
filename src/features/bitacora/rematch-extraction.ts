import "server-only";
import type { Extraction, Record } from "@/features/records/types";
import {
  findActiveBitacoraForDate,
  appendBitacoraRowRecordLink,
  removeBitacoraRowRecordLink,
} from "@/lib/repositories/bitacoras";
import {
  getExtractionDayForBitacora,
  matchRecordToBitacora,
} from "@/features/bitacora/match";
import {
  buildBitacoraMetaBlock,
  syncBitacoraMetaInExtraction,
} from "@/features/bitacora/meta";

/**
 * Tras un PATCH de extracción: si cambió el día (fecha del documento) o el
 * meta apunta a una bitácora/fila inexistente, re-matchea o limpia `_meta.bitacora`.
 * Opcionalmente sincroniza el vínculo fila↔record en la bitácora.
 */
export async function rematchExtractionBitacora(
  record: Record,
  extraction: Extraction,
  options?: { syncRowLink?: boolean }
): Promise<Extraction> {
  const day = getExtractionDayForBitacora(extraction, record);
  const previousMeta = extraction._meta?.bitacora;
  const bitacora = await findActiveBitacoraForDate(day);

  let next: Extraction = extraction;

  if (!bitacora) {
    if (previousMeta) {
      next = {
        ...extraction,
        _meta: {
          ...extraction._meta!,
          bitacora: undefined,
        },
      };
      if (options?.syncRowLink !== false && previousMeta.bitacoraId && previousMeta.rowId) {
        await removeBitacoraRowRecordLink(
          previousMeta.bitacoraId,
          previousMeta.rowId,
          record.id
        );
      }
    }
    return syncBitacoraMetaInExtraction(next);
  }

  const scored = { ...record, extraction };
  const existingRow = previousMeta?.rowId
    ? bitacora.rows.find((r) => r.id === previousMeta.rowId)
    : undefined;

  // Meta del mismo día y fila aún existe → solo sync excel.
  if (
    previousMeta &&
    previousMeta.bitacoraId === bitacora.id &&
    existingRow
  ) {
    next = syncBitacoraMetaInExtraction(extraction);
  } else {
    // Día distinto o fila huérfana → rematch automático o limpiar.
    const match = matchRecordToBitacora(scored, bitacora);
    if (match) {
      const meta = buildBitacoraMetaBlock(
        bitacora,
        match.row,
        match.matchScore,
        extraction
      );
      next = syncBitacoraMetaInExtraction({
        ...extraction,
        _meta: {
          ...extraction._meta!,
          bitacora: meta,
        },
      });
    } else {
      next = {
        ...extraction,
        _meta: {
          ...extraction._meta!,
          bitacora: undefined,
        },
      };
    }

    if (options?.syncRowLink !== false && previousMeta?.bitacoraId && previousMeta.rowId) {
      const stillSame =
        next._meta?.bitacora?.bitacoraId === previousMeta.bitacoraId &&
        next._meta?.bitacora?.rowId === previousMeta.rowId;
      if (!stillSame) {
        await removeBitacoraRowRecordLink(
          previousMeta.bitacoraId,
          previousMeta.rowId,
          record.id
        );
      }
    }
  }

  if (options?.syncRowLink !== false) {
    const meta = next._meta?.bitacora;
    if (meta?.bitacoraId && meta.rowId) {
      await appendBitacoraRowRecordLink(meta.bitacoraId, meta.rowId, record.id);
    }
  }

  return next;
}
