// GET /media/<id>-<ancho>.webp — fotos subidas desde el panel, guardadas en KV.
export async function onRequestGet({ params, env }) {
  const name = String(params.name || "");
  if (!/^[a-z0-9-]+-(320|480)\.webp$/i.test(name) || !env.DATA) return new Response("No encontrado", { status: 404 });
  const { value, metadata } = await env.DATA.getWithMetadata(`media:${name}`, "arrayBuffer");
  if (!value) return new Response("No encontrado", { status: 404 });
  return new Response(value, { headers: { "content-type": (metadata && metadata.type) || "image/webp", "cache-control": "public, max-age=31536000, immutable" } });
}
