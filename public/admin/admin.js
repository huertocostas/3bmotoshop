// Panel de administración del catálogo de 3B Moto Shop.
(function () {
  var TALLES = ["XS", "S", "M", "L", "XL", "XXL"], UNICO = "Único", CATS = ["Integral", "Modular", "Cross", "Accesorios"];
  var app = document.getElementById("app");
  var cat = null, version = 0, dirty = false, query = "", saving = false, tab = "cat", report = null;
  var SV = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var I = { edit: SV + '<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>', up: SV + '<path d="m18 15-6-6-6 6"/></svg>',
    down: SV + '<path d="m6 9 6 6 6-6"/></svg>', x: SV + '<path d="M18 6 6 18M6 6l12 12"/></svg>', plus: SV + '<path d="M12 5v14M5 12h14"/></svg>' };

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function money(n) { return "$ " + Math.round(n).toLocaleString("es-AR"); }
  function api(path, opts) {
    opts = opts || {}; opts.headers = Object.assign({ "x-admin": "1" }, opts.headers || {});
    if (opts.json !== undefined) { opts.body = JSON.stringify(opts.json); opts.headers["content-type"] = "application/json"; delete opts.json; }
    return fetch(path, opts).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); });
  }
  function toast(msg) {
    var t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200);
  }
  function thumb(p) { return p.img ? (p.img.indexOf("media/") === 0 ? "/" : "/") + p.img + "-320.webp" : ""; }
  function markDirty() { dirty = true; status(); }
  function status() {
    var s = document.getElementById("status"), b = document.getElementById("save");
    if (!s) return;
    s.className = "status" + (dirty ? " dirty" : " ok");
    s.textContent = saving ? "Guardando…" : dirty ? "Cambios sin guardar" : "Todo guardado";
    b.disabled = !dirty || saving;
  }
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  // ---------- Login ----------
  function showLogin(msg) {
    app.innerHTML = '<div class="login"><form id="lf"><img src="/img/logo-88.webp" alt="3B Moto Shop" width="196" height="44"><h1 style="font-size:24px">Panel de catálogo</h1>' +
      '<label>Contraseña<input type="password" name="pw" autocomplete="current-password" required autofocus></label>' +
      '<button class="btn" type="submit">Entrar</button><p class="err" id="lerr" role="alert">' + esc(msg || "") + "</p></form></div>";
    document.getElementById("lf").addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = e.target.querySelector("button"); btn.disabled = true;
      api("/api/admin/login", { method: "POST", json: { password: e.target.pw.value } }).then(function (r) {
        btn.disabled = false;
        if (r.ok) load(); else document.getElementById("lerr").textContent = r.error || "No se pudo entrar.";
      });
    });
  }

  function load() {
    api("/api/admin/catalog").then(function (r) {
      if (r._status === 401) return showLogin();
      if (!r.products) return showLogin(r.error || "No se pudo cargar el catálogo.");
      cat = { brands: r.brands.slice(), products: r.products.map(function (p) { return Object.assign({}, p); }) };
      version = r.version; dirty = false; render();
    });
  }

  function stockText(p) {
    var st = p.stock || {};
    if (p.sizes === null) { var n = st[UNICO] || 0; return n ? n + (n === 1 ? " unidad" : " unidades") : "Sin stock"; }
    var parts = TALLES.filter(function (t) { return st[t] > 0; }).map(function (t) { return t + " " + st[t]; });
    return parts.length ? "Stock: " + parts.join(" · ") : "Sin stock";
  }
  function header() {
    return '<header class="top"><div class="wrap"><img src="/img/logo-88.webp" alt="3B Moto Shop" width="151" height="34">' +
      '<nav class="tabs" aria-label="Secciones"><button type="button" data-tab="cat"' + (tab === "cat" ? ' aria-current="page"' : "") + '>Catálogo</button>' +
      '<button type="button" data-tab="ventas"' + (tab === "ventas" ? ' aria-current="page"' : "") + ">Ventas</button></nav><span class=\"sp\"></span>" +
      (tab === "cat" ? '<span id="status" class="status"></span><button class="btn" id="save" type="button">Guardar cambios</button>' : "") + "</div></header>";
  }

  // ---------- Lista ----------
  function render() {
    if (tab === "ventas") return renderVentas();
    var q = query.trim().toLowerCase();
    var html = header() + '<main class="wrap">' +
      '<div class="bar"><input type="search" id="q" placeholder="Buscar producto…" value="' + esc(query) + '" aria-label="Buscar producto">' +
      '<button class="btn btn--ghost" id="add" type="button">' + I.plus + 'Agregar producto</button></div>' +
      '<p class="help">Cambiá precios y disponibilidad acá mismo, o tocá el lápiz para editar todo (foto, stock por talle, marca, categoría). Cada venta pagada descuenta el stock sola. Después tocá <b>Guardar cambios</b>: se ve en la página al instante. ' +
      '<a href="/#catalogo" target="_blank" rel="noopener" style="color:var(--cyan)">Ver página</a> · <a href="#" id="logout" style="color:var(--muted)">Salir</a></p>';
    var shown = 0;
    cat.brands.forEach(function (b, bi) {
      var items = cat.products.filter(function (p) { return p.brand === b && (!q || (p.name + " " + p.brand + " " + (p.desc || "")).toLowerCase().indexOf(q) >= 0); });
      if (!items.length) return;
      shown += items.length;
      var total = cat.products.filter(function (p) { return p.brand === b; }).length;
      html += '<section class="group"><div class="group__head"><h2>' + esc(b) + "<small>" + total + (total === 1 ? " producto" : " productos") + "</small></h2>" +
        (q ? "" : '<button class="ico" data-mv="' + bi + '" data-d="-1" aria-label="Subir marca ' + esc(b) + '"' + (bi === 0 ? " disabled" : "") + '>' + I.up + '</button><button class="ico" data-mv="' + bi + '" data-d="1" aria-label="Bajar marca ' + esc(b) + '"' + (bi === cat.brands.length - 1 ? " disabled" : "") + ">" + I.down + "</button>" +
          '<button class="ico" data-rn="' + bi + '" aria-label="Renombrar marca ' + esc(b) + '">' + I.edit + '</button>') + "</div>";
      items.sort(function (a, c) { return a.price - c.price; }).forEach(function (p) {
        var sizes = stockText(p);
        html += '<div class="row' + (p.active === false ? " off" : "") + '">' +
          (p.img ? '<img src="' + thumb(p) + '" alt="" loading="lazy" width="56" height="70">' : '<div class="noimg"></div>') +
          '<div class="info"><div class="nm">' + esc(p.name) + '</div><div class="meta">' + esc(sizes) + "</div></div>" +
          '<label class="price"><span>$</span><input type="number" inputmode="numeric" min="0" step="100" value="' + p.price + '" data-price="' + esc(p.id) + '" aria-label="Precio de ' + esc(p.name) + '"></label>' +
          '<label class="sw" title="Disponible en la página"><input type="checkbox" data-act="' + esc(p.id) + '"' + (p.active !== false ? " checked" : "") + ' aria-label="Disponible: ' + esc(p.name) + '"><span></span></label>' +
          '<button class="ico edit" data-ed="' + esc(p.id) + '" aria-label="Editar ' + esc(p.name) + '">' + I.edit + '</button></div>';
      });
      html += "</section>";
    });
    if (!shown) html += '<p class="empty">' + (q ? "No hay productos que coincidan." : "Todavía no hay productos. Agregá el primero.") + "</p>";
    html += '<div style="height:60px"></div></main><dialog id="dlg"></dialog>';
    app.innerHTML = html;
    status();
  }

  app.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "q") { query = t.value; var pos = t.selectionStart; render(); var n = document.getElementById("q"); n.focus(); n.setSelectionRange(pos, pos); return; }
    if (t.dataset.price) { var p = find(t.dataset.price); p.price = Math.max(0, Math.round(Number(t.value) || 0)); markDirty(); }
  });
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (t.dataset.act) { find(t.dataset.act).active = t.checked; t.closest(".row").classList.toggle("off", !t.checked); markDirty(); }
  });
  app.addEventListener("click", function (e) {
    var t = e.target.closest("button, a"); if (!t) return;
    if (t.dataset.tab) { if (t.dataset.tab !== tab) { tab = t.dataset.tab; if (tab === "ventas") report = null; render(); } return; }
    if (t.dataset.venta) return setVenta(+t.dataset.venta, t.dataset.estado, t);
    if (t.id === "save") return save();
    if (t.id === "add") return edit(null);
    if (t.id === "logout") { e.preventDefault(); if (dirty && !confirm("Tenés cambios sin guardar. ¿Salir igual?")) return; dirty = false; api("/api/admin/login", { method: "DELETE" }).then(function () { showLogin(); }); return; }
    if (t.dataset.ed) return edit(t.dataset.ed);
    if (t.dataset.mv) { var i = +t.dataset.mv, j = i + +t.dataset.d, b = cat.brands; var x = b[i]; b[i] = b[j]; b[j] = x; markDirty(); render(); return; }
    if (t.dataset.rn) {
      var old = cat.brands[+t.dataset.rn], nn = (prompt("Nuevo nombre para la marca " + old + ":", old) || "").trim();
      if (!nn || nn === old) return;
      if (cat.brands.indexOf(nn) >= 0) return alert("Ya existe una marca con ese nombre.");
      cat.brands[+t.dataset.rn] = nn; cat.products.forEach(function (p) { if (p.brand === old) p.brand = nn; }); markDirty(); render();
    }
  });
  function find(id) { return cat.products.filter(function (p) { return p.id === id; })[0]; }

  // ---------- Ventas (tablas ventas / detalle_ventas y vistas del esquema) ----------
  var ESTADO = { pendiente: "Pendiente", pagada: "Pagada", cancelada: "Cancelada" };
  function fecha(s) { var d = new Date(String(s).replace(" ", "T") + "Z"); return d.toLocaleString("es-AR", { timeZone: "America/Argentina/Cordoba", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }); }
  function renderVentas() {
    var html = header() + '<main class="wrap">';
    if (!report) {
      app.innerHTML = html + '<p class="empty">Cargando ventas…</p></main>';
      api("/api/admin/ventas").then(function (r) {
        if (r._status === 401) return showLogin();
        report = r.ventas ? r : { error: r.error || "No se pudieron cargar las ventas." }; if (tab === "ventas") render();
      });
      return;
    }
    if (report.error) { app.innerHTML = html + '<p class="empty">' + esc(report.error) + "</p></main>"; return; }
    html += '<p class="help">Los pagos con Mercado Pago se marcan solos. Las reservas en efectivo marcalas como pagadas cuando las cobres: ahí se descuenta el stock. Cancelar una venta pagada devuelve el stock.</p>';
    html += '<section class="group"><div class="group__head"><h2>Últimas ventas<small>' + report.ventas.length + "</small></h2></div>";
    if (!report.ventas.length) html += '<p class="empty">Todavía no hay ventas.</p>';
    report.ventas.forEach(function (v) {
      var items = v.items.map(function (i) { return i.cantidad + "× " + esc(i.nombre) + (i.talle && i.talle !== UNICO ? " · " + esc(i.talle) : ""); }).join("<br>");
      var acts = (v.estado !== "pagada" ? '<button class="btn" type="button" data-venta="' + v.id_venta + '" data-estado="pagada">Marcar pagada</button>' : "") +
        (v.estado !== "cancelada" ? '<button class="btn btn--ghost" type="button" data-venta="' + v.id_venta + '" data-estado="cancelada">Cancelar</button>' : "");
      html += '<div class="venta"><div class="vh"><b>' + esc(v.codigo) + '</b><span class="badge ' + v.estado + '">' + ESTADO[v.estado] + '</span><span class="meta">' + fecha(v.fecha_venta) + " · " +
        (v.metodo === "efectivo" ? "Efectivo" : "Mercado Pago") + " · " + (v.entrega === "envio" ? "Envío" : "Retiro") + '</span><b class="tot">' + money(v.total) + "</b></div>" +
        '<div class="vb"><div>' + items + '</div><div class="meta">' + esc(v.cliente) + " · DNI " + esc(v.dni) + (v.telefono ? ' · <a href="https://wa.me/' + esc(String(v.telefono).replace(/\D/g, "")) + '" target="_blank" rel="noopener">' + esc(v.telefono) + "</a>" : "") + (v.pago_mp ? " · Pago MP #" + esc(v.pago_mp) : "") + "</div></div>" +
        '<div class="va">' + acts + "</div></div>";
    });
    html += "</section>";
    var ceros = report.stockBajo.filter(function (s) { return !s.stock; }).length;
    html += '<section class="group"><details class="bajo"><summary class="group__head"><h2>Stock bajo<small>' + ceros + " talles sin stock · " + (report.stockBajo.length - ceros) + " con 1 unidad</small></h2></summary>" +
      (report.stockBajo.length ? '<div class="tbl">' + report.stockBajo.map(function (s) { return "<div><span>" + esc(s.nombre) + '</span><span class="meta">' + esc(s.talle) + '</span><b class="' + (s.stock ? "" : "cero") + '">' + s.stock + "</b></div>"; }).join("") + "</div>" : '<p class="empty">Nada para reponer.</p>') + "</details></section>";
    if (report.top.length) html += '<section class="group"><div class="group__head"><h2>Más vendidos</h2></div><div class="tbl">' + report.top.map(function (t) { return "<div><span>" + esc(t.casco) + '</span><span class="meta">' + t.unidades_vendidas + " u.</span><b>" + money(t.ingresos) + "</b></div>"; }).join("") + "</div></section>";
    if (report.clientes.length) html += '<section class="group"><div class="group__head"><h2>Mejores clientes</h2></div><div class="tbl">' + report.clientes.map(function (c) { return "<div><span>" + esc(c.cliente) + '</span><span class="meta">' + c.compras_realizadas + (c.compras_realizadas === 1 ? " compra" : " compras") + "</span><b>" + money(c.total_gastado) + "</b></div>"; }).join("") + "</div></section>";
    app.innerHTML = html + '<div style="height:60px"></div></main><dialog id="dlg"></dialog>';
  }
  function setVenta(id, estado, btn) {
    var v = report.ventas.filter(function (x) { return x.id_venta === id; })[0];
    var msg = estado === "pagada" ? "¿Marcar " + v.codigo + " como pagada? Se descuenta el stock." : "¿Cancelar " + v.codigo + "?" + (v.estado === "pagada" ? " Se devuelve el stock." : "");
    if (!confirm(msg)) return;
    btn.disabled = true;
    api("/api/admin/ventas", { method: "POST", json: { id: id, estado: estado } }).then(function (r) {
      if (!r.ok) { btn.disabled = false; return alert(r.error || "No se pudo cambiar."); }
      toast(estado === "pagada" ? "Venta pagada. Stock descontado." : "Venta cancelada.");
      report = null; render();
      if (!dirty) load(); // el stock cambió: recarga el catálogo (si no hay cambios sin guardar)
    });
  }

  // ---------- Editar / agregar ----------
  function edit(id) {
    var isNew = !id;
    var p = isNew ? { id: "p" + Date.now().toString(36), brand: cat.brands[0] || "", categoria: "Integral", name: "", desc: "", price: 0, img: "", sizes: [], stock: {}, active: true } : Object.assign({}, find(id));
    var st = p.stock || {};
    var cats = CATS.concat(cat.products.map(function (x) { return x.categoria; })).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
    var dlg = document.getElementById("dlg");
    var opts = cat.brands.map(function (b) { return "<option" + (b === p.brand ? " selected" : "") + ">" + esc(b) + "</option>"; }).join("") + '<option value="__new">+ Nueva marca…</option>';
    dlg.innerHTML = '<form method="dialog" id="ef"><div class="mhead"><h3 style="font-size:20px">' + (isNew ? "Nuevo producto" : "Editar producto") + '</h3><button class="ico" value="cancel" aria-label="Cerrar">' + I.x + '</button></div><div class="mbody">' +
      '<div class="photo">' + (p.img ? '<img id="pimg" src="' + thumb(p) + '" alt="">' : '<div class="noimg" id="pimg"></div>') +
      '<label>Foto<input type="file" id="pfile" accept="image/*"><small id="pmsg">Se recorta y achica sola (formato vertical).</small></label></div>' +
      '<div class="two"><label>Marca<select name="brand">' + opts + '</select></label><label>Precio ($)<input type="number" name="price" inputmode="numeric" min="0" step="100" required value="' + p.price + '"></label></div>' +
      '<label id="nbw" hidden>Nombre de la nueva marca<input type="text" name="newbrand" maxlength="40"></label>' +
      '<label>Categoría<select name="categoria">' + cats.map(function (c) { return "<option" + (c === p.categoria ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select></label>" +
      '<label>Nombre<input type="text" name="name" maxlength="100" required value="' + esc(p.name) + '"></label>' +
      '<label>Descripción<textarea name="desc" maxlength="300">' + esc(p.desc) + "</textarea></label>" +
      '<fieldset style="border:0;padding:0;margin:0;display:grid;gap:10px"><legend style="color:var(--muted);font-size:14px;margin-bottom:6px">Stock: unidades por talle (0 = no hay)</legend>' +
      '<div class="sizes" id="sizes">' + TALLES.map(function (t) { return '<label class="qty"><span>' + t + '</span><input type="number" name="sz_' + t + '" min="0" max="9999" step="1" inputmode="numeric" value="' + (st[t] || 0) + '"></label>'; }).join("") + "</div>" +
      '<label class="check"><input type="checkbox" name="nosize"' + (p.sizes === null ? " checked" : "") + "> Este producto no usa talle (por ejemplo, antiparras)</label>" +
      '<label class="qty" id="unico"><span>Unidades</span><input type="number" name="sz_unico" min="0" max="9999" step="1" inputmode="numeric" value="' + (st[UNICO] || 0) + '"></label></fieldset>' +
      '<label class="check"><input type="checkbox" name="active"' + (p.active !== false ? " checked" : "") + "> Mostrar en la página (disponible)</label>" +
      '<p class="err" id="eerr" role="alert"></p></div><div class="mfoot">' + (isNew ? "<span></span>" : '<button class="btn btn--danger" type="button" id="del">Borrar producto</button>') +
      '<span style="display:flex;gap:10px"><button class="btn btn--ghost" value="cancel">Cancelar</button><button class="btn" type="button" id="ok">Listo</button></span></div></form>';
    var f = document.getElementById("ef");
    function syncSizes() { document.getElementById("sizes").hidden = f.nosize.checked; document.getElementById("unico").hidden = !f.nosize.checked; }
    syncSizes(); f.nosize.addEventListener("change", syncSizes);
    f.brand.addEventListener("change", function () { document.getElementById("nbw").hidden = f.brand.value !== "__new"; });
    document.getElementById("pfile").addEventListener("change", function (e) {
      var file = e.target.files[0]; if (!file) return;
      var msg = document.getElementById("pmsg"); msg.textContent = "Procesando y subiendo foto…";
      upload(file).then(function (img) {
        p.img = img; var el = document.getElementById("pimg");
        var n = document.createElement("img"); n.id = "pimg"; n.src = thumb(p); n.alt = ""; el.replaceWith(n);
        msg.textContent = "Foto lista. Tocá Listo y después Guardar cambios.";
      }).catch(function (err) { msg.textContent = err.message || "No se pudo subir la foto."; });
    });
    document.getElementById("ok").addEventListener("click", function () {
      var err = document.getElementById("eerr");
      var brand = f.brand.value === "__new" ? f.newbrand.value.trim() : f.brand.value;
      if (!brand) return (err.textContent = "Elegí o escribí una marca.");
      if (!f.name.value.trim()) return (err.textContent = "Escribí el nombre del producto.");
      var price = Math.round(Number(f.price.value));
      if (!(price > 0)) return (err.textContent = "Poné un precio válido.");
      p.brand = brand; p.name = f.name.value.trim(); p.desc = f.desc.value.trim(); p.price = price; p.active = f.active.checked;
      p.categoria = f.categoria.value;
      var n = function (el) { return Math.max(0, Math.min(9999, Math.round(Number(el.value) || 0))); };
      if (f.nosize.checked) { p.stock = {}; p.stock[UNICO] = n(f.sz_unico); p.sizes = null; }
      else { p.stock = {}; TALLES.forEach(function (t) { p.stock[t] = n(f["sz_" + t]); }); p.sizes = TALLES.filter(function (t) { return p.stock[t] > 0; }); }
      if (cat.brands.indexOf(brand) < 0) cat.brands.push(brand);
      if (isNew) cat.products.push(p); else Object.assign(find(p.id), p);
      dlg.close(); markDirty(); render();
      toast(isNew ? "Producto agregado. Acordate de guardar." : "Cambios listos. Acordate de guardar.");
    });
    var del = document.getElementById("del");
    if (del) del.addEventListener("click", function () {
      if (!confirm('¿Borrar "' + p.name + '" del catálogo? Se borra de la página cuando guardes.')) return;
      cat.products = cat.products.filter(function (x) { return x.id !== p.id; }); dlg.close(); markDirty(); render();
    });
    dlg.showModal();
  }

  // Recorta la foto a 4:5 y la achica en el navegador; sube dos tamaños.
  function upload(file) {
    if (!/^image\//.test(file.type)) return Promise.reject(new Error("El archivo no es una imagen."));
    return loadImage(file).then(function (img) {
      return Promise.all([shrink(img, 480, 600), shrink(img, 320, 400)]);
    }).then(function (b) {
      var fd = new FormData(); fd.append("w480", b[0], "a"); fd.append("w320", b[1], "b");
      return fetch("/api/admin/image", { method: "POST", body: fd, headers: { "x-admin": "1" } }).then(function (r) { return r.json(); });
    }).then(function (r) { if (!r.ok) throw new Error(r.error || "No se pudo subir."); return r.img; });
  }
  function loadImage(file) {
    if (window.createImageBitmap) return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () { return viaTag(file); });
    return viaTag(file);
  }
  function viaTag(file) {
    return new Promise(function (ok, ko) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ko(new Error("No se pudo leer la foto.")); }; i.src = URL.createObjectURL(file); });
  }
  function shrink(img, w, h) {
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    var iw = img.width, ih = img.height, s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s;
    var x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return new Promise(function (ok) {
      c.toBlob(function (b) {
        if (b && b.type === "image/webp") return ok(b);
        c.toBlob(function (j) { ok(j); }, "image/jpeg", 0.82); // Safari no genera WebP: usa JPEG
      }, "image/webp", 0.8);
    });
  }

  function save() {
    saving = true; status();
    api("/api/admin/catalog", { method: "PUT", json: { version: version, catalog: cat } }).then(function (r) {
      saving = false;
      if (r.ok) { version = r.version; dirty = false; status(); toast("Guardado ✓ Ya se ve en la página."); return; }
      if (r._status === 401) { status(); return alert("Se cerró la sesión. Copiá tus cambios y volvé a entrar."); }
      status(); alert(r.error || "No se pudo guardar.");
    }).catch(function () { saving = false; status(); alert("Sin conexión. Probá de nuevo."); });
  }

  api("/api/admin/login").then(function (r) {
    if (!r.configured) return showLogin("Falta configurar la contraseña (ADMIN_PASSWORD) en Cloudflare.");
    if (r.admin) load(); else showLogin();
  });
})();
