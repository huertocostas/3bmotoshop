// GET / — sirve index.html con la sección de catálogo armada desde el catálogo editable (KV).
// Si el catálogo no se puede leer, queda la versión estática que ya trae index.html.
import { getCatalog } from "../lib/catalog-store.js";
import { renderCatalog } from "../lib/render.js";

export async function onRequestGet({ request, env }) {
  const res = await env.ASSETS.fetch(request);
  if (!res.ok || !(res.headers.get("content-type") || "").includes("text/html")) return res;
  let html;
  try { html = renderCatalog(await getCatalog(env), new URL(request.url).origin); } catch { return res; }
  const out = new HTMLRewriter().on("section#catalogo", { element(el) { el.replace(html, { html: true }); } }).transform(res);
  const h = new Headers(out.headers);
  h.set("cache-control", "no-cache");
  return new Response(out.body, { status: out.status, headers: h });
}
