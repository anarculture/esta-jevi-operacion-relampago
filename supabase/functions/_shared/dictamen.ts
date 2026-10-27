// Coteja lo que la IA leyó en la captura contra la orden y la cuenta de destino.
// Nunca aprueba: solo orienta a Mau, que confirma contra su banco.

export type Ocr = {
  documentType: "pago_movil" | "binance" | "zelle" | "other";
  amount: string;
  reference: string;
  transactionDate: string;
  transactionTime?: string; // HH:MM impreso; se guarda para desempatar movimientos del mismo monto, no se coteja
  recipientName: string;
  recipientPhone: string;
  recipientId: string;
  editSignals: string;
  confidence: "high" | "medium" | "low";
  senderName: string;
  senderPhone: string;
  senderId: string;
  senderBank: string;
};

// Lo que declaró el comprador (crear_orden): pago móvil { banco, telefono, cedula }, Zelle { titular }, Binance { id }.
export type Pagador = { banco?: string; telefono?: string; cedula?: string; titular?: string; id?: string };

export type Orden = {
  metodo: string;
  referencia: string;
  monto_usd_cents: number;
  monto_bs: number | null;
  creada_en: string;
  pagador?: Pagador | null;
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
  // crear_orden exige 6 tipeados (rec. 2); una lectura más corta que la tipeada vale solo si trae 6 o más.
  const a = normRef(x.reference), b = normRef(o.referencia);
  if (!a) dudas.push("no se lee la referencia");
  else if (!(a.endsWith(b) || (b.endsWith(a) && a.length >= 6))) malos.push(`referencia ${x.reference} distinta a ${o.referencia}`);

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
  const titular = plain(String(destino.titular ?? ""));
  const porNombre = titular && plain(x.recipientName).includes(titular.split(" ")[0]);
  if (leidos.some((s) => nuestros.includes(s)) || porNombre) { /* destinatario nuestro */ }
  else if (leidos.length) malos.push("el destinatario no es nuestra cuenta");
  else dudas.push("no se lee el destinatario");

  // Emisor (issue #6, punto 2): solo duda, nunca malos. Se compara lo que se leyó completo contra lo
  // declarado; una lectura enmascarada (0414***567, V-**345678) o vacía no se compara.
  // Duda solo si nada de lo comparable coincide: un teléfono distinto con la cédula correcta suele
  // ser un error al declarar, no otro pagador, y Mau lo ve igual en el panel.
  const p = o.pagador ?? {};
  const oculto = (s: string) => /[*•…]/.test(s ?? "");
  const palabras = (s: string) => plain(s).split(/\s+/).filter((w) => w.length >= 3);
  const cotejos: boolean[] = [];
  const tel = [last10(x.senderPhone), last10(p.telefono ?? "")];
  if (!oculto(x.senderPhone) && tel[0].length === 10 && tel[1].length === 10) cotejos.push(tel[0] === tel[1]);
  // Cédula contra cédula o RIF (V-09876543-2): sin ceros a la izquierda, el RIF agrega un dígito verificador al final.
  const ced = [digits(x.senderId), digits(p.cedula ?? "")].map((s) => s.replace(/^0+/, ""));
  const [corta, larga] = ced[0].length <= ced[1].length ? ced : [ced[1], ced[0]];
  if (!oculto(x.senderId) && corta.length >= 5) cotejos.push(corta === larga || (larga.length === corta.length + 1 && larga.startsWith(corta)));
  const id = [plain(x.senderId), plain(p.id ?? "")];
  if (!oculto(x.senderId) && id[0] && id[1]) cotejos.push(id[0] === id[1]);
  // Titular: palabras completas de 3 o más letras ("Ana" no coincide con "Mariana"; "J" no cuenta).
  const [declarado, leido] = [palabras(p.titular ?? ""), palabras(x.senderName)];
  if (!oculto(x.senderName) && declarado.length && leido.length) cotejos.push(declarado.some((w) => leido.includes(w)));
  if (cotejos.length && !cotejos.some(Boolean)) dudas.push("el pagador leído no es el declarado");

  if (x.editSignals.trim()) dudas.push(`posible edición: ${x.editSignals.trim()}`);
  if (x.confidence === "low") dudas.push("captura poco legible");

  if (malos.length) return { dictamen: "no_coincide", motivo: [...malos, ...dudas].join("; ") };
  if (dudas.length) return { dictamen: "dudoso", motivo: dudas.join("; ") };
  return { dictamen: "coincide", motivo: "monto, referencia, fecha y destinatario coinciden" };
}
