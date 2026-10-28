// Cliente mínimo de Supabase con fetch: RPC, Storage y Edge Functions. Sin supabase-js.
const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
// Producción: proyecto Supabase ref `ptbzdepejxxlavqfyepw`. La publishable key es pública por diseño.
const API = LOCAL ? "http://127.0.0.1:54321" : "https://ptbzdepejxxlavqfyepw.supabase.co";
const KEY = LOCAL ? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" : "sb_publishable_iN1zfxf9SYEg42123alZHQ_4c3UYh_D";

// Datos de la fiesta y contacto humano (WhatsApp del organizador). Un solo lugar para las tres páginas.
const FIESTA = { nombre: "Sindicato Baba", dj: "DJ BABATR", fecha: "jueves 29 de octubre", hora: "21:00", lugar: "CC Chacaíto", mapa: "https://maps.app.goo.gl/D9tyCVLa8ppZVfDE6" };
const CONTACTO_WA = "584145287337";
const waContacto = (texto) => `https://wa.me/${CONTACTO_WA}?text=${encodeURIComponent(texto)}`;

const ERRORES = {
  referencia_usada: "Esa referencia ya se usó en otra compra. Revisa el número; si es correcto, escríbenos.",
  tasa_vencida: "No pudimos actualizar la tasa BCV. Recarga la página en un momento.",
  nombre_invalido: "Escribe tu nombre y apellido.",
  cedula_invalida: "Revisa la cédula: solo números, con V o E delante si quieres.",
  telefono_invalido: "Revisa el teléfono: 11 dígitos, por ejemplo 04141234567.",
  whatsapp_invalido: "Revisa el WhatsApp: 11 dígitos como 04141234567, o con código de país si es de fuera (+1…).",
  metodo_invalido: "Elige un método de pago.",
  referencia_invalida: "Escribe al menos los últimos 6 caracteres de la referencia.",
  captura_invalida: "Sube la captura como JPG, PNG o WEBP.",
  pagador_invalido: "Revisa los datos de la cuenta desde la que pagaste.",
  sin_conexion: "Sin conexión. Revisa tu señal y vuelve a intentar.",
};

class ErrorRed extends Error {}

async function pedir(url, opts) {
  let r;
  try {
    r = await fetch(url, { ...opts, headers: { apikey: KEY, ...opts.headers } });
  } catch {
    throw new ErrorRed(ERRORES.sin_conexion);
  }
  const d = await r.json().catch(() => null);
  if (!r.ok) {
    const code = d?.message ?? d?.error ?? `HTTP ${r.status}`;
    // Lo no mapeado es un fallo nuestro, no del comprador: se le da una salida humana.
    throw Object.assign(new Error(ERRORES[code] ?? `Algo falló de nuestro lado (${code}). Escríbenos por WhatsApp y lo resolvemos.`), { status: r.status });
  }
  return d;
}

const rpc = (fn, args = {}) =>
  pedir(`${API}/rest/v1/rpc/${fn}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args) });

const funcion = (nombre, body = {}) =>
  // keepalive: la compra navega a orden.html sin esperar a `revisar` y la petición debe sobrevivir.
  pedir(`${API}/functions/v1/${nombre}`, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function subirCaptura(file) {
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
  if (!ext) throw new Error(ERRORES.captura_invalida);
  if (file.size > 8 * 1024 * 1024) throw new Error("La captura pesa más de 8 MB. Toma una captura de pantalla en vez de una foto.");
  const path = `${crypto.randomUUID()}.${ext}`;
  await pedir(`${API}/storage/v1/object/capturas/${path}`, { method: "POST", headers: { "Content-Type": file.type }, body: file });
  return path;
}

const usd = (cents) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
const eur = (cents) => `€${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
const bs = (n) => `Bs ${Number(n).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// Lo que acepta la app del banco: sin "Bs", sin puntos de miles, coma decimal.
const bsPlano = (n) => Number(n).toFixed(2).replace(".", ",");
const fechaCorta = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
const fechaHora = (iso) => new Date(iso).toLocaleString("es-VE", { timeZone: "America/Caracas", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const horaCorta = (iso) => new Date(iso).toLocaleTimeString("es-VE", { timeZone: "America/Caracas", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
// Misma regla que normalizar_whatsapp en SQL: venezolano (04141234567, 4141234567, +58 0414…) → 58…;
// con código de país, 10 a 15 dígitos tal cual.
function normalizarWhatsapp(s) {
  const d = String(s ?? "").replace(/\D/g, "");
  if (/^0\d{10}$/.test(d)) return `58${d.slice(1)}`;
  if (/^580\d{10}$/.test(d)) return `58${d.slice(3)}`;
  if (/^[24]\d{9}$/.test(d)) return `58${d}`;
  return /^[1-9]\d{9,14}$/.test(d) ? d : null;
}
// "Para el ···1234 · pendiente de envío" / "Enviada al ···1234 a las 21:03"; nada si la entrada no tiene WhatsApp.
const estadoEnvio = (x) => (!x?.whatsapp_mascara ? ""
  : x.avisada_en ? `Enviada al ···${x.whatsapp_mascara} a las ${horaCorta(x.avisada_en)}`
  : `Para el ···${x.whatsapp_mascara} · pendiente de envío`);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Boleto de una entrada, igual en entrada.html y orden.html (las dos cargan qrcode.min.js). Como el pase de
// cortesía, con el QR antes de los datos para que salga en la captura; `extra` va bajo el código de respaldo.
function boleto(e, token, extra = e.whatsapp_mascara ? `<p class="muted">Para el WhatsApp ···${esc(e.whatsapp_mascara)}</p>` : "") {
  let svg;
  try { const q = qrcode(0, "M"); q.addData(token); q.make(); svg = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); }
  catch { svg = `<p class="error">No se pudo dibujar el QR. Muestra el código de respaldo.</p>`; }
  return `
    <article class="boleto">
      <div class="boleto-banner">
        <img src="banner-fotocopia.jpg" srcset="banner-fotocopia.jpg 1080w, banner-fotocopia@2x.jpg 2160w" sizes="(min-width: 34rem) 34rem, 100vw" alt="DJ BABATR en letras cromadas sobre cables y fachada de Caracas en fotocopia" width="1080" height="480">
        <span class="cinta">Entrada general</span>
      </div>
      <h1>${FIESTA.nombre}</h1>
      <p class="sub">${FIESTA.dj} · Entrada ${e.posicion} de ${e.total}</p>
      <div class="corte"></div>
      <div class="qr">
        ${svg}
        <p class="muted">Código de respaldo: ${token.slice(0, 8)}</p>
        ${extra}
      </div>
      <div class="corte"></div>
      <dl class="boleto-datos">
        <div><dt>Fecha</dt><dd>${FIESTA.fecha}</dd></div>
        <div><dt>Hora</dt><dd>${FIESTA.hora}</dd></div>
        <div><dt>Lugar</dt><dd><a href="${FIESTA.mapa}" target="_blank" rel="noopener">${FIESTA.lugar}</a></dd></div>
        <div><dt>Orden</dt><dd>#${e.numero}</dd></div>
      </dl>
      <div class="corte"></div>
      <p class="apoyo">Con el apoyo de</p>
      <div class="patrocinio">
        <img src="logo-zulia.png" alt="Cerveza Zulia" width="47" height="62">
        <img src="logo-malportada.png" alt="Malportada" width="62" height="48">
        <img src="logo-bandera.png" alt="Bandera" width="92" height="24">
      </div>
    </article>`;
}

// Botón "Copiar" con feedback dentro del mismo botón; `data-copiar` lleva el valor plano.
function copiarDesde(root) {
  root.addEventListener("click", async (ev) => {
    const b = ev.target.closest("button[data-copiar]");
    if (!b) return;
    ev.preventDefault();
    try {
      await navigator.clipboard.writeText(b.dataset.copiar);
      const antes = b.textContent;
      b.textContent = "Copiado";
      b.classList.add("ok");
      setTimeout(() => { b.textContent = antes; b.classList.remove("ok"); }, 2000);
    } catch {
      b.textContent = "No se pudo copiar";
    }
  });
}

const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
