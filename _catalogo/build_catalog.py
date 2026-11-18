"""Regenera la sección de catálogo de index.html a partir de catalogo.json.
Uso: py build_catalog.py   (desde 3b-motoshop/src)
catalogo.json = [[categoria, nombre, descripcion, precio, archivo_foto], ...]
Fotos: site/img/p/<8 primeros chars>-480.webp y -320.webp"""
import json, re, html, urllib.parse, pathlib

HERE = pathlib.Path(__file__).parent
SITE = HERE.parent
WA = "543856229058"
FECHA = "17/11/2026"
ORDER = ["LS2 COSMOS", "LS2 ROOKIE", "SHAFT", "AXOR", "HRO", "FXX", "AXXIS", "EDGE", "ICH", "PROTORK", "Accesorios"]
KEEP_CAPS = {"LS2", "FXX", "HRO", "ICH", "PRO", "AXOR", "AXXIS", "EDGE", "SHAFT", "PROTORK"}
PRETTY = {"JOKER": "Joker"}

data = json.loads((HERE / "catalogo.json").read_text(encoding="utf-8"))

def clean_name(n):
    n = re.sub(r"\s+", " ", n).strip()
    out = []
    for w in n.split(" "):
        if w in PRETTY: w = PRETTY[w]
        elif w.isupper() and len(w) > 3 and w not in KEEP_CAPS: w = w.lower()
        out.append(w)
    n = " ".join(out)
    return n[0].upper() + n[1:]

def clean_price(p):
    digits = re.sub(r"[^\d,\.]", "", p)
    if re.fullmatch(r"\d{3},\d{2}", digits):  # "$ 102,05" -> typo of 102.050 in the source
        digits = digits.replace(",", ".") + "0"
    value = int(digits.replace(".", "").replace(",", ""))
    return value, "$ " + f"{value:,}".replace(",", ".")

def slug(c): return re.sub(r"[^a-z0-9]+", "-", c.lower()).strip("-")

groups = {c: [] for c in ORDER}
for cat, name, desc, price, foto in data:
    v, ptxt = clean_price(price)
    groups.setdefault(cat, []).append(dict(name=clean_name(name), desc=desc.strip().rstrip("."), value=v, price=ptxt, id=foto[:8]))

total = sum(len(v) for v in groups.values())
e = html.escape
blocks, ld = [], []
for cat in ORDER:
    items = groups.get(cat) or []
    if not items: continue
    items.sort(key=lambda x: (x["value"], x["name"]))
    s = slug(cat)
    lo = items[0]["price"]
    cards = []
    for it in items:
        msg = f"Hola! Me interesa el {it['name']} ({it['price']}) que vi en la web. ¿Hay stock?"
        wa = f"https://wa.me/{WA}?text=" + urllib.parse.quote(msg)
        cards.append(
            f'<article class="prod"><div class="prod__img"><img src="img/p/{it["id"]}-480.webp" '
            f'srcset="img/p/{it["id"]}-320.webp 320w, img/p/{it["id"]}-480.webp 480w" sizes="(max-width:700px) 46vw, (max-width:1020px) 30vw, 280px" '
            f'width="480" height="600" loading="lazy" decoding="async" alt="{e(it["name"])}"></div>'
            f'<div class="prod__body"><h4>{e(it["name"])}</h4><p>{e(it["desc"])}</p>'
            f'<div class="prod__foot"><span class="price">{it["price"]}</span>'
            f'<a class="ask" href="{e(wa)}" target="_blank" rel="noopener" aria-label="Consultar por WhatsApp: {e(it["name"])}">Consultar</a></div></div></article>')
        ld.append({"@type": "Product", "name": it["name"], "brand": {"@type": "Brand", "name": cat.split(" ")[0] if cat != "Accesorios" else "3B Moto Shop"},
                   "image": f"https://3bmotoshop.vercel.app/img/p/{it['id']}-480.webp", "description": it["desc"],
                   "offers": {"@type": "Offer", "price": it["value"], "priceCurrency": "ARS", "availability": "https://schema.org/InStock"}})
    n = len(items)
    blocks.append(f'<details class="brand" id="m-{s}"><summary class="brand__head"><h3>{e(cat)}</h3>'
                  f'<p class="mono">{n} {"modelo" if n == 1 else "modelos"} · desde {lo}</p><span class="chev" aria-hidden="true"></span></summary>'
                  f'<div class="grid">{"".join(cards)}</div></details>')

ldjson = json.dumps({"@context": "https://schema.org", "@type": "ItemList", "name": "Catálogo 3B Moto Shop",
                     "itemListElement": [{"@type": "ListItem", "position": i + 1, "item": p} for i, p in enumerate(ld)]},
                    ensure_ascii=False, separators=(",", ":"))

section = f'''<!--CATALOGO:START-->
<section class="sec" id="catalogo" style="padding-top:0">
  <div class="wrap">
    <div class="sec__head rv">
      <p class="mono kicker">Catálogo y precios</p>
      <h2>Elegí por marca</h2>
    </div>
    <p class="cat-hint">{total} productos en {len(blocks)} categorías. Tocá una marca para ver modelos y precios.</p>
    <div class="brands-list">{"".join(blocks)}</div>
    <p class="cat-note">Precios del <a href="https://catalogo.treinta.co/3B_Motoshop-Catalogo" target="_blank" rel="noopener">catálogo online</a> al {FECHA}. Pueden cambiar sin aviso: consultá stock y talle por WhatsApp antes de comprar.</p>
  </div>
  <script type="application/ld+json">{ldjson}</script>
</section>
<!--CATALOGO:END-->'''

idx = SITE / "index.html"
s = idx.read_text(encoding="utf-8")
s = re.sub(r"<!--CATALOGO:START-->.*?<!--CATALOGO:END-->", lambda m: section, s, flags=re.S)
idx.write_text(s, encoding="utf-8", newline="\n")
print("productos:", total, {k: len(v) for k, v in groups.items() if v})
