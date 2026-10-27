// Coteja lo que la IA leyó en la captura contra la orden y la cuenta de destino.
// Nunca aprueba: solo orienta a Mau, que confirma contra su banco.

export type Ocr = {
  documentType: "pago_movil" | "binance" | "zelle" | "other";
  amount: string;
  reference: string;
  transactionDate: string;
  recipientName: string;
  recipientPhone: string;
  recipientId: string;
  editSignals: string;
  confidence: "high" | "medium" | "low";
};

export type Orden = {
  metodo: string;
  referencia: string;
  monto_usd_cents: number;
  monto_bs: number | null;
  creada_en: string;
};

export type Destino = Record<string, string | boolean>;

export type Dictamen = { dictamen: "coincide" | "dudoso" | "no_coincide"; motivo: string };

// Igual que normalizar_referencia() en SQL.
export const normRef = (r: string) => r.replace(/[^A-Za-z0-9]/g, "").toUpperCase().replace(/^0+/, "");
const digits = (s: string) => (s ?? "").replace(/\D/g, "");
const last10 = (s: string) => digits(s).slice(-10);
const plain = (s: string) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function dictaminar(o: Orden, x: Ocr, destino: Destino): Dictamen {
  const malos: string[] = [];
  const dudas: string[] = [];
  const tipo = o.metodo.startsWith("pago_movil") ? "pago_movil" : o.metodo;

  if (x.documentType === "other") return { dictamen: "no_coincide", motivo: "la imagen no parece un comprobante" };
  if (x.documentType !== tipo) malos.push(`comprobante de ${x.documentType}, la orden es ${tipo}`);

  // Tolerancia absoluta y nunca a favor del pagador (docs/research/autenticidad-comprobantes.md, rec. 3):
  // la estafa típica es un pago real por menos con el monto editado en la captura.
  const esperado = tipo === "pago_movil" ? Number(o.monto_bs) : o.monto_usd_cents / 100;
  const tol = tipo === "pago_movil" ? 1 : 0.01;
  const monto = Number(x.amount);
  if (!x.amount || !Number.isFinite(monto)) dudas.push("no se lee el monto");
  else if (monto < esperado - tol) malos.push(`monto ${monto} menor al esperado ${esperado}`);
  else if (monto > esperado + tol) dudas.push(`monto ${monto} mayor al esperado ${esperado}`);

  // La app del banco a veces imprime la referencia larga y el comprador tipea los últimos dígitos.
  // Menos de 6 dígitos tipeados no identifican el pago (rec. 2): nunca coincide solo.
  const a = normRef(x.reference), b = normRef(o.referencia);
  if (!a) dudas.push("no se lee la referencia");
  else if (!(a.endsWith(b) || (b.endsWith(a) && a.length >= 6))) malos.push(`referencia ${x.reference} distinta a ${o.referencia}`);
  else if (b.length < 6) dudas.push(`referencia tipeada corta (${b.length} caracteres)`);

  // Ventana: del día de la orden a 1 día después (rec. 4). Una captura anterior puede ser un pago real reciclado.
  if (!x.transactionDate) dudas.push("no se lee la fecha");
  else {
    const dias = (Date.parse(x.transactionDate) - Date.parse(o.creada_en.slice(0, 10))) / 864e5;
    if (dias < 0) dudas.push(`captura del ${x.transactionDate}, anterior a la orden`);
    else if (dias > 1) dudas.push(`fecha ${x.transactionDate} lejos de la orden`);
  }

  const nuestros = [last10(String(destino.telefono ?? "")), digits(String(destino.cedula ?? "")),
    digits(String(destino.id ?? "")), plain(String(destino.correo ?? ""))].filter((s) => s.length >= 5);
  const leidos = [last10(x.recipientPhone), digits(x.recipientId), plain(x.recipientId)].filter((s) => s.length >= 5);
  // El nombre del titular solo no prueba el destino: un comprobante falso puede llevarlo. Con nombre y
  // sin correo/teléfono/ID legibles, la orden espera a Mau (dudoso); nunca aprueba sola.
  const titular = plain(String(destino.titular ?? ""));
  const porNombre = titular && plain(x.recipientName).includes(titular.split(" ")[0]);
  if (leidos.some((s) => nuestros.includes(s))) { /* destinatario nuestro */ }
  else if (leidos.length) malos.push("el destinatario no es nuestra cuenta");
  else if (porNombre) dudas.push("destinatario solo por nombre; confirmar la cuenta en el banco");
  else dudas.push("no se lee el destinatario");

  if (x.editSignals.trim()) dudas.push(`posible edición: ${x.editSignals.trim()}`);
  if (x.confidence === "low") dudas.push("captura poco legible");

  if (malos.length) return { dictamen: "no_coincide", motivo: [...malos, ...dudas].join("; ") };
  if (dudas.length) return { dictamen: "dudoso", motivo: dudas.join("; ") };
  return { dictamen: "coincide", motivo: "monto, referencia, fecha y destinatario coinciden" };
}
