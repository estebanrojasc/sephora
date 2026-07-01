/** Marca única por request SSR; evita 304 en segment cache de Vercel. */
export function AdminRenderNonce({ nonce }: { nonce: number }) {
  return <div hidden aria-hidden data-admin-render={String(nonce)} />;
}
