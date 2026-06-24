"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createCatalogApi,
  deleteCatalogApi,
  fetchCatalogs,
  updateCatalogApi,
} from "./api";
import type {
  Catalog,
  CreateCatalogPayload,
  UpdateCatalogPayload,
} from "./types";

const KEY = ["catalogs"] as const;

export function useCatalogs() {
  return useQuery<Catalog[]>({
    queryKey: KEY,
    queryFn: fetchCatalogs,
  });
}

/** Catálogos activos indexados por fieldKey (para integración con FieldInput). */
export function useActiveCatalogsByField() {
  const { data: catalogs = [] } = useCatalogs();
  const map = new Map<string, Catalog>();
  for (const c of catalogs) {
    if (c.active) map.set(c.fieldKey, c);
  }
  return map;
}

export function useCreateCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCatalogPayload) => createCatalogApi(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateCatalogPayload;
    }) => updateCatalogApi(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCatalogApi(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
