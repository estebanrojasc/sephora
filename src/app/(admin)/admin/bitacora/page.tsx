"use client";

/**
 * Página 100 % cliente: evita segment cache RSC de Vercel (304 con lista vacía).
 * Los datos vienen siempre de GET /api/bitacora/dates en el montaje.
 */
export { BitacoraListPageClient as default } from "@/components/admin/bitacora/BitacoraListPageClient";
