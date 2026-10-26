// Cliente mínimo de Supabase con fetch: RPC, Storage y Edge Functions. Sin supabase-js.
const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
// Producción: proyecto Supabase ref `ptbzdepejxxlavqfyepw`. La publishable key es pública por diseño.
const API = LOCAL ? "http://127.0.0.1:54321" : "https://ptbzdepejxxlavqfyepw.supabase.co";
const KEY = LOCAL ? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" : "sb_publishable_iN1zfxf9SYEg42123alZHQ_4c3UYh_D";

// Datos de la fiesta y contacto humano (Mau). Un solo lugar para las tres páginas.
const FIESTA = { nombre: "Sindicato Baba", dj: "DJ BABATR", fecha: "jueves 29 de octubre", hora: "21:00", lugar: "CC Chacaíto" };
const CONTACTO_WA = "584145287337";
const waContacto = (texto) => `https://wa.me/${CONTACTO_WA}?text=${encodeURIComponent(texto)}`;

const ERRORES = {
  referencia_usada: "Esa referencia ya se usó en otra compra. Revisa el número; si es correcto, escríbenos.",
  tasa_vencida: "No pudimos actualizar la tasa BCV. Recarga la página en un momento.",
  nombre_invalido: "Escribe tu nombre y apellido.",
  cedula_invalida: "Revisa la cédula: solo números, con V o E delante si quieres.",
  telefono_invalido: "Revisa el teléfono: 11 dígitos, por ejemplo 04141234567.",
  metodo_invalido: "Elige un método de pago.",
  referencia_invalida: "La referencia debe tener al menos 4 caracteres.",
  captura_invalida: "Sube la captura como JPG, PNG o WEBP.",
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
    throw new Error(ERRORES[code] ?? `Algo falló de nuestro lado (${code}). Escríbenos por WhatsApp y lo resolvemos.`);
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
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

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
