// Cliente mínimo de Supabase con fetch: RPC, Storage y Edge Functions. Sin supabase-js.
const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
// Producción: proyecto Supabase ref `ptbzdepejxxlavqfyepw`. La publishable key es pública por diseño.
const API = LOCAL ? "http://127.0.0.1:54321" : "https://ptbzdepejxxlavqfyepw.supabase.co";
const KEY = LOCAL ? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" : "sb_publishable_iN1zfxf9SYEg42123alZHQ_4c3UYh_D";

const ERRORES = {
  referencia_usada: "Esa referencia ya se usó en otra compra. Revisa el número; si es correcto, escríbenos.",
  tasa_vencida: "No pudimos actualizar la tasa BCV. Recarga la página en un momento.",
  nombre_invalido: "Escribe tu nombre.",
  cedula_invalida: "Revisa la cédula: solo números, con V o E delante si quieres.",
  telefono_invalido: "Revisa el teléfono: 11 dígitos, por ejemplo 04141234567.",
  metodo_invalido: "Elige un método de pago.",
  referencia_invalida: "La referencia debe tener al menos 4 caracteres.",
  captura_invalida: "Sube la captura como JPG, PNG o WEBP.",
};

async function pedir(url, opts) {
  const r = await fetch(url, { ...opts, headers: { apikey: KEY, ...opts.headers } });
  const d = await r.json().catch(() => null);
  if (!r.ok) {
    const code = d?.message ?? d?.error ?? `HTTP ${r.status}`;
    throw new Error(ERRORES[code] ?? code);
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
  if (file.size > 8 * 1024 * 1024) throw new Error("La captura pesa más de 8 MB.");
  const path = `${crypto.randomUUID()}.${ext}`;
  await pedir(`${API}/storage/v1/object/capturas/${path}`, { method: "POST", headers: { "Content-Type": file.type }, body: file });
  return path;
}

const usd = (cents) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
const bs = (n) => `Bs ${Number(n).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
