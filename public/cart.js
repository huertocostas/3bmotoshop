// Carrito y checkout de 3B Moto Shop.
(function () {
  var d = document, KEY = "3b-cart", WA = "543856229058";
  var TALLES = ["XS", "S", "M", "L", "XL", "XXL"];
  var cart = load();
  var state = { view: "cart", customer: { name: "", dni: "", phone: "" }, delivery: "retiro", method: "mp", error: "", busy: false, result: null };
  var drawer = d.getElementById("drawer"), body = d.getElementById("drawerBody"), foot = d.getElementById("drawerFoot");
  var count = d.getElementById("cartCount"), openBtn = d.getElementById("cartOpen"), lastFocus = null;
  var title = d.getElementById("drawerTitle");
  var may = { ciudad: "", message: "" };

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} }
  function money(n) { return "$ " + Math.round(n).toLocaleString("es-AR"); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function total() { return cart.reduce(function (s, l) { return s + l.price * l.qty; }, 0); }
  function units() { return cart.reduce(function (s, l) { return s + l.qty; }, 0); }

  function badge() {
    var n = units(); count.textContent = n; count.hidden = !n;
    openBtn.setAttribute("aria-label", n ? "Abrir carrito, " + n + " productos" : "Abrir carrito");
  }

  // Botones "Agregar" del catálogo
  d.addEventListener("click", function (ev) {
    var b = ev.target.closest(".add"); if (!b) return;
    var card = b.closest(".prod"), id = b.getAttribute("data-id");
    var price = parseInt(card.querySelector(".price").textContent.replace(/\D/g, ""), 10);
    var sz = b.getAttribute("data-sizes") || "", needsSize = sz !== "";
    var ex = cart.find(function (l) { return l.id === id && !l.talle; });
    if (ex) ex.qty = Math.min(10, ex.qty + 1);
    else cart.push({ key: id + "-" + Date.now(), id: id, name: card.querySelector("h4").textContent, thumb: (card.querySelector(".prod__img img") || {}).getAttribute ? card.querySelector(".prod__img img").getAttribute("srcset").split(" ")[0] : "", price: price, qty: 1, s: needsSize, sizes: needsSize ? sz.split(",") : [], talle: "" });
    save(); badge();
    b.classList.add("is-added"); b.textContent = "Agregado";
    setTimeout(function () { b.classList.remove("is-added"); b.textContent = "Agregar"; }, 1400);
    openBtn.classList.remove("bump"); void openBtn.offsetWidth; openBtn.classList.add("bump");
    open();
  });

  function open(keep) { lastFocus = d.activeElement; if (keep !== true && state.view !== "cart") state.view = "cart"; render(); drawer.classList.add("is-open"); drawer.setAttribute("aria-hidden", "false"); d.body.style.overflow = "hidden"; setTimeout(function () { drawer.querySelector(".x").focus(); }, 50); }
  function close() { drawer.classList.remove("is-open"); drawer.setAttribute("aria-hidden", "true"); d.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }
  openBtn.addEventListener("click", function () { open(); });
  drawer.addEventListener("click", function (ev) { if (ev.target.closest("[data-close]")) close(); });
  d.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && drawer.classList.contains("is-open")) close(); });

  var MAY_LINK = '<p class="note may-link">¿Comprás por mayor? <button type="button" class="linkbtn" data-may>Pedí precio mayorista</button></p>';
  function render() {
    title.textContent = state.view === "mayorista" || (state.view === "done" && state.result && state.result.method === "mayorista") ? "Precio mayorista" : "Tu pedido";
    if (state.view === "done") return renderDone();
    if (state.view === "mayorista") return renderMay();
    if (!cart.length) {
      body.innerHTML = '<p class="empty">Tu carrito está vacío.<br>Elegí un casco del catálogo.</p>' + MAY_LINK;
      foot.innerHTML = '<a class="btn btn--ghost pay" href="#catalogo" data-close>Ver catálogo</a>';
      return;
    }
    var h = cart.map(function (l, i) {
      var sel = l.s ? '<select data-i="' + i + '" class="' + (l.talle ? "" : "need") + '" aria-label="Talle de ' + esc(l.name) + '"><option value="">Elegí talle</option>' +
        (l.sizes && l.sizes.length ? l.sizes : TALLES).map(function (t) { return '<option' + (l.talle === t ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select>" : "";
      return '<div class="line"><img src="' + esc(l.thumb || ("img/p/" + l.id + "-320.webp")) + '" alt="" width="64" height="80"><div><h4>' + esc(l.name) + '</h4><div class="lp">' + money(l.price) + "</div>" + sel + "</div>" +
        '<div class="qty"><button type="button" data-q="-1" data-i="' + i + '" aria-label="Quitar uno">−</button><span>' + l.qty + '</span><button type="button" data-q="1" data-i="' + i + '" aria-label="Agregar uno">+</button></div></div>';
    }).join("");
    h += '<p class="note" style="font-size:13px;margin-top:10px">¿No sabés tu talle? <a href="#tipos" data-close style="color:var(--accent)">Mirá la guía de talles</a>. Confirmamos stock por WhatsApp.</p>';
    h += '<form class="form" id="coForm" novalidate>' +
      '<label>Nombre y apellido<input name="name" autocomplete="name" required value="' + esc(state.customer.name) + '"></label>' +
      '<label>Teléfono / WhatsApp<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="385 ..." value="' + esc(state.customer.phone) + '"></label>' +
      '<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<fieldset class="opts"><legend>Entrega</legend>' +
      opt("delivery", "retiro", "Retiro en el local", "Av. Moreno Sur 652, El Morterito") +
      opt("delivery", "envio", "Envío a domicilio", "A todo el país. El costo se coordina por WhatsApp") + "</fieldset>" +
      '<fieldset class="opts"><legend>Forma de pago</legend>' +
      opt("method", "mp", "Mercado Pago", "Tarjeta de crédito, débito o dinero en cuenta") +
      opt("method", "efectivo", "Efectivo en el local", "Reservás ahora y pagás cuando pasás a buscarlo") + "</fieldset></form>" + MAY_LINK;
    body.innerHTML = h;
    var label = state.method === "mp" ? "Pagar con Mercado Pago" : "Reservar y pagar en el local";
    foot.innerHTML = '<div class="total"><span>Total</span><b>' + money(total()) + "</b></div>" +
      '<button class="btn pay" type="button" id="payBtn"' + (state.busy ? " disabled" : "") + ">" + (state.busy ? "Procesando…" : label) + "</button>" +
      (state.error ? '<p class="err" role="alert">' + esc(state.error) + "</p>" : "");
    d.getElementById("payBtn").addEventListener("click", submit);
  }
  // ---------- Consulta por precio mayorista (el único lugar donde se pide DNI) ----------
  function renderMay() {
    var n = units();
    body.innerHTML = '<p class="note" style="margin:0 0 4px">Dejanos tus datos y qué querés comprar. La consulta llega al WhatsApp mayorista y te contestamos por ahí con los precios.</p>' +
      '<form class="form" id="mayForm" novalidate>' +
      '<label>Nombre y apellido<input name="name" autocomplete="name" required value="' + esc(state.customer.name) + '"></label>' +
      '<label>DNI<input name="dni" inputmode="numeric" autocomplete="off" required placeholder="Sin puntos" maxlength="10" value="' + esc(state.customer.dni) + '"></label>' +
      '<label>Teléfono / WhatsApp<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="385 ..." value="' + esc(state.customer.phone) + '"></label>' +
      '<label>Ciudad<input name="ciudad" autocomplete="address-level2" maxlength="80" value="' + esc(may.ciudad) + '"></label>' +
      '<label>¿Qué querés comprar?<textarea name="message" rows="4" maxlength="1000" placeholder="Modelos, talles y cantidades">' + esc(may.message) + "</textarea></label>" +
      (n ? '<p class="note" style="margin:0">Incluimos ' + (n === 1 ? "el producto" : "los " + n + " productos") + " de tu carrito.</p>" : "") +
      '<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"></form>';
    foot.innerHTML = '<button class="btn pay" type="button" id="mayBtn"' + (state.busy ? " disabled" : "") + ">" + (state.busy ? "Enviando…" : "Enviar consulta") + "</button>" +
      '<button class="btn btn--ghost pay" type="button" id="mayBack">Volver al carrito</button>' +
      (state.error ? '<p class="err" role="alert">' + esc(state.error) + "</p>" : "");
    d.getElementById("mayBtn").addEventListener("click", submitMay);
    d.getElementById("mayBack").addEventListener("click", function () { state.view = "cart"; state.error = ""; render(); });
  }
  function submitMay() {
    state.error = "";
    if (state.customer.name.trim().split(/\s+/).length < 2) { state.error = "Escribí tu nombre y apellido."; return render(); }
    if (!/^\d{7,8}$/.test(state.customer.dni.replace(/\D/g, ""))) { state.error = "Escribí tu DNI (7 u 8 números, sin puntos)."; return render(); }
    if (state.customer.phone.replace(/\D/g, "").length < 8) { state.error = "Escribí un teléfono válido."; return render(); }
    if (!cart.length && may.message.trim().length < 3) { state.error = "Contanos qué querés comprar y cuántas unidades."; return render(); }
    state.busy = true; render();
    var hp = d.querySelector('#mayForm [name="website"]');
    fetch("/api/mayorista", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ customer: { name: state.customer.name, dni: state.customer.dni, phone: state.customer.phone, ciudad: may.ciudad }, message: may.message,
        items: cart.map(function (l) { return { id: l.id, qty: l.qty, talle: l.talle }; }), website: hp ? hp.value : "" })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        state.busy = false;
        if (!res.ok || !res.j.ok) { state.error = (res.j && res.j.error) || "No se pudo enviar la consulta."; return render(); }
        state.result = { method: "mayorista", id: res.j.id, wa: res.j.whatsapp, text: res.j.whatsappText }; state.view = "done"; may.message = ""; render();
      })
      .catch(function () { state.busy = false; state.error = "Sin conexión. Probá de nuevo."; render(); });
  }
  d.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-may]"); if (!b) return;
    ev.preventDefault(); state.view = "mayorista"; state.error = "";
    if (drawer.classList.contains("is-open")) render(); else open(true);
  });

  function opt(name, val, title, sub) {
    return '<label class="opt"><input type="radio" name="' + name + '" value="' + val + '"' + (state[name] === val ? " checked" : "") + "><span>" + title + "</span><small>" + sub + "</small></label>";
  }

  body.addEventListener("click", function (ev) {
    var q = ev.target.closest("[data-q]"); if (!q) return;
    var i = +q.getAttribute("data-i"); cart[i].qty += +q.getAttribute("data-q");
    if (cart[i].qty < 1) cart.splice(i, 1); else cart[i].qty = Math.min(10, cart[i].qty);
    save(); badge(); render();
  });
  body.addEventListener("change", function (ev) {
    var t = ev.target;
    if (t.matches("select[data-i]")) { cart[+t.getAttribute("data-i")].talle = t.value; t.classList.toggle("need", !t.value); save(); }
    if (t.name === "delivery" || t.name === "method") { state[t.name] = t.value; render(); }
  });
  body.addEventListener("input", function (ev) { var t = ev.target; if (t.name === "name" || t.name === "phone" || t.name === "dni") state.customer[t.name] = t.value; if (t.name === "ciudad" || t.name === "message") may[t.name] = t.value; });

  function submit() {
    state.error = "";
    var miss = cart.find(function (l) { return l.s && !l.talle; });
    if (miss) { state.error = 'Elegí el talle de "' + miss.name + '".'; return render(); }
    if (state.customer.name.trim().split(/\s+/).length < 2) { state.error = "Escribí tu nombre y apellido."; return render(); }    if (state.customer.phone.replace(/\D/g, "").length < 8) { state.error = "Escribí un teléfono válido."; return render(); }
    state.busy = true; render();
    var hp = d.querySelector('#coForm [name="website"]');
    fetch("/api/checkout", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: cart.map(function (l) { return { id: l.id, qty: l.qty, talle: l.talle }; }), customer: state.customer, delivery: state.delivery, method: state.method, website: hp ? hp.value : "" })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        state.busy = false;
        if (!res.ok || !res.j.ok) { state.error = (res.j && res.j.error) || "No se pudo procesar el pedido."; return render(); }
        if (res.j.method === "mp") { location.href = res.j.url; return; }
        state.result = res.j; state.view = "done"; cart = []; save(); badge(); render();
      })
      .catch(function () { state.busy = false; state.error = "Sin conexión. Probá de nuevo."; render(); });
  }

  function renderDone() {
    var r = state.result || {};
    if (r.method === "mayorista") {
      body.innerHTML = '<div class="done"><p class="mono kicker" style="justify-content:center">Consulta registrada</p><p class="big">Falta un paso</p>' +
        "<p>Tocá el botón para mandar la consulta al WhatsApp mayorista. Te contestamos por ahí con los precios.</p>" + (r.id ? '<span class="code">' + esc(r.id) + "</span>" : "") + "</div>";
      foot.innerHTML = '<a class="btn pay" href="https://wa.me/' + esc(r.wa) + "?text=" + encodeURIComponent(r.text || "") + '" target="_blank" rel="noopener">Enviar por WhatsApp</a>' +
        '<button class="btn btn--ghost pay" type="button" id="mayBack">Volver al carrito</button>';
      d.getElementById("mayBack").addEventListener("click", function () { state.view = "cart"; render(); });
      return;
    }
    var wa = "https://wa.me/" + WA + "?text=" + encodeURIComponent(r.whatsappText || "");
    if (r.method === "efectivo") {
      body.innerHTML = '<div class="done"><p class="mono kicker" style="justify-content:center">Reserva confirmada</p><p class="big">' + esc(r.when) + "</p>" +
        "<p>Pasá por <strong>" + esc(r.address) + "</strong> y pagás en efectivo al retirar.</p><p>Total: <strong>" + esc(r.total) + "</strong></p>" +
        '<span class="code">' + esc(r.id) + '</span><p style="font-size:13.5px">Mostrá este número de pedido en el local.</p></div>';
      foot.innerHTML = '<a class="btn pay" href="' + wa + '" target="_blank" rel="noopener">Avisar por WhatsApp</a>';
      return;
    }
    var map = { ok: ["Pago aprobado", "Ya recibimos tu pago. Te escribimos por WhatsApp para coordinar el retiro o el envío."],
      pendiente: ["Pago pendiente", "Mercado Pago está procesando el pago. Te avisamos apenas se acredite."],
      error: ["No se pudo completar el pago", "No se hizo ningún cobro. Podés intentar de nuevo o elegir pagar en efectivo en el local."] };
    var m = map[r.status] || map.error;
    body.innerHTML = '<div class="done"><p class="big">' + m[0] + "</p><p>" + m[1] + "</p>" + (r.id ? '<span class="code">' + esc(r.id) + "</span>" : "") + "</div>";
    foot.innerHTML = r.status === "error" ? '<button class="btn pay" type="button" id="retry">Volver al carrito</button>' :
      '<a class="btn pay" href="https://wa.me/' + WA + "?text=" + encodeURIComponent("Hola! Pagué el pedido " + (r.id || "") + " con Mercado Pago en la web.") + '" target="_blank" rel="noopener">Escribir por WhatsApp</a>';
    var rb = d.getElementById("retry"); if (rb) rb.addEventListener("click", function () { state.view = "cart"; render(); });
  }

  // Vuelta desde Mercado Pago: ?pago=ok|pendiente|error&pedido=...
  var qs = new URLSearchParams(location.search), pago = qs.get("pago");
  if (pago) {
    if (pago === "ok") { cart = []; save(); }
    state.result = { method: "mp", status: pago, id: qs.get("pedido") || qs.get("external_reference") };
    state.view = "done";
    history.replaceState(null, "", location.pathname + "#catalogo");
    badge(); open(true);
  } else badge();
})();
