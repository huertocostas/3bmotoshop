// Panel de administración del catálogo de 3B Moto Shop.
(function () {
  var TALLES = ["XS", "S", "M", "L", "XL", "XXL"];
  var app = document.getElementById("app");
  var cat = null, version = 0, dirty = false, query = "", saving = false;

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

  // ---------- Lista ----------
  function render() {
    var q = query.trim().toLowerCase();
    var html = '<header class="top"><div class="wrap"><img src="/img/logo-88.webp" alt="3B Moto Shop" width="151" height="34"><span class="sp"></span>' +
      '<span id="status" class="status"></span><button class="btn" id="save" type="button">Guardar cambios</button></div></header><main class="wrap">' +
      '<div class="bar"><input type="search" id="q" placeholder="Buscar producto…" value="' + esc(query) + '" aria-label="Buscar producto">' +
      '<button class="btn btn--ghost" id="add" type="button">+ Agregar producto</button></div>' +
      '<p class="help">Cambiá precios y disponibilidad acá mismo, o tocá ✎ para editar todo (foto, talles, marca). Después tocá <b>Guardar cambios</b>: se ve en la página al instante. ' +
      '<a href="/#catalogo" target="_blank" rel="noopener" style="color:var(--cyan)">Ver página</a> · <a href="#" id="logout" style="color:var(--muted)">Salir</a></p>';
    var shown = 0;
    cat.brands.forEach(function (b, bi) {
      var items = cat.products.filter(function (p) { return p.brand === b && (!q || (p.name + " " + p.brand + " " + (p.desc || "")).toLowerCase().indexOf(q) >= 0); });
      if (!items.length) return;
      shown += items.length;
      var total = cat.products.filter(function (p) { return p.brand === b; }).length;
      html += '<section class="group"><div class="group__head"><h2>' + esc(b) + "<small>" + total + " productos</small></h2>" +
        (q ? "" : '<button class="ico" data-mv="' + bi + '" data-d="-1" aria-label="Subir marca ' + esc(b) + '"' + (bi === 0 ? " disabled" : "") + '>↑</button><button class="ico" data-mv="' + bi + '" data-d="1" aria-label="Bajar marca ' + esc(b) + '"' + (bi === cat.brands.length - 1 ? " disabled" : "") + ">↓</button>" +
          '<button class="ico" data-rn="' + bi + '" aria-label="Renombrar marca ' + esc(b) + '">✎</button>') + "</div>";
      items.sort(function (a, c) { return a.price - c.price; }).forEach(function (p) {
        var sizes = p.sizes === null ? "Sin talle" : p.sizes.length ? "Talles: " + p.sizes.join(" ") : "Sin talles en stock";
        html += '<div class="row' + (p.active === false ? " off" : "") + '">' +
          (p.img ? '<img src="' + thumb(p) + '" alt="" loading="lazy" width="56" height="70">' : '<div class="noimg"></div>') +
          '<div class="info"><div class="nm">' + esc(p.name) + '</div><div class="meta">' + esc(sizes) + "</div></div>" +
          '<label class="price"><span>$</span><input type="number" inputmode="numeric" min="0" step="100" value="' + p.price + '" data-price="' + esc(p.id) + '" aria-label="Precio de ' + esc(p.name) + '"></label>' +
          '<label class="sw" title="Disponible en la página"><input type="checkbox" data-act="' + esc(p.id) + '"' + (p.active !== false ? " checked" : "") + ' aria-label="Disponible: ' + esc(p.name) + '"><span></span></label>' +
          '<button class="ico edit" data-ed="' + esc(p.id) + '" aria-label="Editar ' + esc(p.name) + '">✎</button></div>';
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

  // ---------- Editar / agregar ----------
  function edit(id) {
    var isNew = !id;
    var p = isNew ? { id: "p" + Date.now().toString(36), brand: cat.brands[0] || "", name: "", desc: "", price: 0, img: "", sizes: TALLES.slice(), active: true } : Object.assign({}, find(id));
    var dlg = document.getElementById("dlg");
    var opts = cat.brands.map(function (b) { return "<option" + (b === p.brand ? " selected" : "") + ">" + esc(b) + "</option>"; }).join("") + '<option value="__new">+ Nueva marca…</option>';
    dlg.innerHTML = '<form method="dialog" id="ef"><div class="mhead"><h3 style="font-size:20px">' + (isNew ? "Nuevo producto" : "Editar producto") + '</h3><button class="ico" value="cancel" aria-label="Cerrar">×</button></div><div class="mbody">' +
      '<div class="photo">' + (p.img ? '<img id="pimg" src="' + thumb(p) + '" alt="">' : '<div class="noimg" id="pimg"></div>') +
      '<label>Foto<input type="file" id="pfile" accept="image/*"><small id="pmsg">Se recorta y achica sola (formato vertical).</small></label></div>' +
      '<div class="two"><label>Marca<select name="brand">' + opts + '</select></label><label>Precio ($)<input type="number" name="price" inputmode="numeric" min="0" step="100" required value="' + p.price + '"></label></div>' +
      '<label id="nbw" hidden>Nombre de la nueva marca<input type="text" name="newbrand" maxlength="40"></label>' +
      '<label>Nombre<input type="text" name="name" maxlength="120" required value="' + esc(p.name) + '"></label>' +
      '<label>Descripción<textarea name="desc" maxlength="300">' + esc(p.desc) + "</textarea></label>" +
      '<fieldset style="border:0;padding:0;margin:0;display:grid;gap:10px"><legend style="color:var(--muted);font-size:14px;margin-bottom:6px">Talles en stock</legend>' +
      '<div class="sizes" id="sizes">' + TALLES.map(function (t) { return '<label class="chip"><input type="checkbox" name="sz" value="' + t + '"' + (p.sizes && p.sizes.indexOf(t) >= 0 ? " checked" : "") + "><span>" + t + "</span></label>"; }).join("") + "</div>" +
      '<label class="check"><input type="checkbox" name="nosize"' + (p.sizes === null ? " checked" : "") + "> Este producto no usa talle (por ejemplo, antiparras)</label></fieldset>" +
      '<label class="check"><input type="checkbox" name="active"' + (p.active !== false ? " checked" : "") + "> Mostrar en la página (disponible)</label>" +
      '<p class="err" id="eerr" role="alert"></p></div><div class="mfoot">' + (isNew ? "<span></span>" : '<button class="btn btn--danger" type="button" id="del">Borrar producto</button>') +
      '<span style="display:flex;gap:10px"><button class="btn btn--ghost" value="cancel">Cancelar</button><button class="btn" type="button" id="ok">Listo</button></span></div></form>';
    var f = document.getElementById("ef");
    function syncSizes() { document.getElementById("sizes").style.opacity = f.nosize.checked ? ".35" : "1"; f.querySelectorAll("[name=sz]").forEach(function (c) { c.disabled = f.nosize.checked; }); }
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
      p.sizes = f.nosize.checked ? null : [].slice.call(f.querySelectorAll("[name=sz]:checked")).map(function (c) { return c.value; });
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
