/*
  Sindicato Baba · plataforma local del organizador.
  Script clásico: modelo puro (require en Node, globalThis.SindicatoBaba en el navegador y en Deno)
  más la interfaz. Sin red ni dependencias. Montos en centavos enteros de USD.
*/
(function (root) {
  'use strict';

  // ============================== Modelo (puro) ==============================

  const APP_ID = 'sindicato-baba-pm';
  const LEGACY_APP_ID = 'operacion-relampago-pm'; // nombre anterior del evento: sus datos y respaldos siguen valiendo
  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = APP_ID + ':v1';
  const BACKUP_KEY = STORAGE_KEY + ':respaldo';
  const CORRUPT_KEY = STORAGE_KEY + ':ilegible';
  const CLAVE_KEY = STORAGE_KEY + ':clave'; // clave de la plataforma compartida (Edge Function `pm`)

  const LIMITS = Object.freeze({
    ticketsModel: 10000, ticketsUI: 500, moneyCents: 1e8, units: 100000,
    budget: 50, tasks: 100, ops: 60, sponsors: 20, barLines: 30,
    title: 120, name: 80, owner: 80, short: 120, note: 500, importBytes: 262144,
  });

  const ENUMS = {
    task_status: { pendiente: 'Pendiente', en_curso: 'En curso', bloqueado: 'Bloqueado', hecho: 'Hecho' },
    area: { local: 'Local y patrocinio', tecnica: 'Técnica y artistas', acceso: 'Acceso y pagos', seguridad: 'Seguridad y logística', comunicacion: 'Comunicación y cierre' },
    budget_status: { declarado: 'Declarado', cotizado: 'Cotizado', comprometido: 'Comprometido' },
    sponsor_status: { por_definir: 'Por definir', en_conversacion: 'En conversación', confirmado: 'Confirmado' },
    sponsor_kind: { producto: 'En producto', efectivo: 'En efectivo' },
    ops_group: { acuerdos: 'Acuerdos', dia: 'Día del evento', cierre: 'Cierre' },
    bar_base: { '': 'Por definir', bruto: 'Ventas brutas del producto patrocinado', neto: 'Utilidad (ventas menos costos)' },
    preset: { actual: 'Actual', sonido: 'El local aporta el sonido', tecnica_puerta: 'El local absorbe técnica y puerta' },
    role: { '': 'Extra', artista_principal: 'Artista principal', artistas: 'Otros artistas', equipos: 'Equipos', sonido: 'Sonido', puerta: 'Puerta' },
  };
  // Qué partidas (por rol) quita cada propuesta del costo previsto. Solo propuestas.
  const PRESET_COVERS = { actual: [], sonido: ['sonido'], tecnica_puerta: ['equipos', 'sonido', 'puerta'] };
  const COMPARE_TICKETS = [60, 80, 100, 120];
  const COMPARE_TARIFFS = [1000, 1200, 1500];

  const has = (map, k) => map != null && Object.prototype.hasOwnProperty.call(map, k);

  function defaultScenario() {
    return {
      tickets: 100, lowPct: 0, priceLowCents: 1000, priceHighCents: 1500, courtesies: 0,
      venuePct: 0, feePct: 0, feePerTicketCents: 0, sponsorCashCents: 0, preset: 'actual', includeBar: false,
    };
  }

  function defaultState() {
    const b = (id, role, name, usd) => ({ id, role, name, estimateCents: usd * 100, status: 'declarado', paidCents: 0, advanceCents: null });
    const t = (id, title, area, note) => ({ id, title, area, owner: '', due: '', status: 'pendiente', note });
    const o = (id, group, title, note) => ({ id, group, title, owner: '', status: 'pendiente', note });
    return {
      app: APP_ID, schemaVersion: SCHEMA_VERSION, savedAt: null,
      event: { date: '2026-10-29', time: '21:00' },
      scenario: defaultScenario(),
      budget: [
        b('b-artista-principal', 'artista_principal', 'Artista principal', 400),
        b('b-otros-artistas', 'artistas', 'Otros artistas (en conjunto)', 100),
        b('b-equipos', 'equipos', 'Equipos', 100),
        b('b-sonido', 'sonido', 'Sonido', 100),
        b('b-puerta', 'puerta', 'Puerta', 50),
      ],
      real: { sold: 0, courtesies: 0, ticketsCollectedCents: 0, sponsorCollectedCents: 0, barCollectedCents: 0, ownContributionCents: 0 },
      sponsors: [
        { id: 's-cerveza', name: 'Cerveza', kind: 'producto', quantity: '', conditions: '', status: 'por_definir' },
        { id: 's-anis', name: 'Anís', kind: 'producto', quantity: '', conditions: '', status: 'por_definir' },
      ],
      bar: {
        base: '', pct: null, lines: [
          { id: 'l-cerveza', product: 'Cerveza', units: null, salesCents: null, costCents: null },
          { id: 'l-anis', product: 'Anís', units: null, salesCents: null, costCents: null },
        ],
      },
      tasks: [
        t('t-local', 'Cerrar acuerdo con el local y reparto', 'local', 'Qué cubre el local y reparto de taquilla y barra (base y porcentaje por definir).'),
        t('t-artistas', 'Confirmar artistas y rider', 'tecnica', ''),
        t('t-tecnica', 'Técnica y montaje', 'tecnica', ''),
        t('t-acceso', 'Acceso digital y cobros', 'acceso', 'Plataforma, comisiones y respaldo sin internet por definir.'),
        t('t-seguridad', 'Seguridad, aforo y permisos', 'seguridad', ''),
        t('t-promo', 'Promoción con precios claros', 'comunicacion', 'Comunicar las dos tarifas: 10 USD anticipada, antes de la fiesta; 15 USD en puerta, el día de la fiesta. No anunciar solo la de 10.'),
        t('t-cierre', 'Caja y cierre', 'comunicacion', ''),
      ],
      ops: [
        o('o-local', 'acuerdos', 'Acuerdo con el local: qué cubre, horario y reparto', ''),
        o('o-proveedores', 'acuerdos', 'Proveedores de sonido y equipos', ''),
        o('o-lineup', 'acuerdos', 'Lineup y horarios de artistas', ''),
        o('o-patrocinio', 'acuerdos', 'Propuesta de reparto del patrocinio: 50% organización / 50% local', 'Propuesta, no aceptada por el local. 50% organización y 50% local sobre las ventas brutas solo del producto patrocinado, no toda la barra. Queda fuera del presupuesto base hasta cerrar base y porcentaje.'),
        o('o-servicio', 'acuerdos', 'Propuesta de costos de servicio de barra', 'Propuesta, no aceptada por el local: el local cubre hielo, vasos y personal con su mitad, sin cargos adicionales. No suma costos al presupuesto.'),
        o('o-montaje', 'dia', 'Montaje y prueba de sonido', ''),
        o('o-acceso', 'dia', 'Acceso: una sola lista de entradas y respaldo sin internet', 'Lista descargada o impresa en la puerta. Este sitio no escanea ni valida códigos.'),
        o('o-seguridad', 'dia', 'Seguridad y aforo', 'No se recorta para ahorrar.'),
        o('o-horarios', 'dia', 'Horarios y transporte', ''),
        o('o-caja', 'cierre', 'Conciliación de caja', 'Cobros reales contra entradas vendidas y pagos hechos.'),
        o('o-stock', 'cierre', 'Stock y sobrantes de barra', ''),
        o('o-pagos', 'cierre', 'Pagos a artistas y proveedores', ''),
      ],
    };
  }

  let seq = 0;
  function newId(prefix) {
    seq += 1;
    return prefix + '-' + Date.now().toString(36) + seq.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function newItem(list, opts) {
    const o = opts || {};
    switch (list) {
      case 'budget': return { id: newId('b'), role: '', name: 'Partida nueva', estimateCents: 0, status: 'declarado', paidCents: 0, advanceCents: null };
      case 'tasks': return { id: newId('t'), title: 'Tarea nueva', area: has(ENUMS.area, o.area) ? o.area : 'local', owner: '', due: '', status: 'pendiente', note: '' };
      case 'ops': return { id: newId('o'), group: has(ENUMS.ops_group, o.group) ? o.group : 'acuerdos', title: 'Punto nuevo', owner: '', status: 'pendiente', note: '' };
      case 'sponsors': return { id: newId('s'), name: 'Patrocinio nuevo', kind: 'producto', quantity: '', conditions: '', status: 'por_definir' };
      case 'barLines': return { id: newId('l'), product: 'Producto nuevo', units: null, salesCents: null, costCents: null };
    }
    throw new RangeError('Lista desconocida: ' + list);
  }

  // ---------- Esquema y validación ----------

  const RULES = {
    event: { date: ['date'], time: ['time'] },
    scenario: {
      tickets: ['int', 0, LIMITS.ticketsModel], lowPct: ['int', 0, 100],
      priceLowCents: ['cents'], priceHighCents: ['cents'], courtesies: ['int', 0, LIMITS.ticketsModel],
      venuePct: ['pct'], feePct: ['pct'], feePerTicketCents: ['cents'], sponsorCashCents: ['cents'],
      preset: ['en', 'preset'], includeBar: ['bool'],
    },
    real: {
      sold: ['int', 0, LIMITS.ticketsModel], courtesies: ['int', 0, LIMITS.ticketsModel],
      ticketsCollectedCents: ['cents'], sponsorCollectedCents: ['cents'], barCollectedCents: ['cents'], ownContributionCents: ['cents'],
    },
    bar: { base: ['en', 'bar_base'], pct: ['pctOpt'] },
    budget: { id: ['id'], role: ['en', 'role'], name: ['req', LIMITS.name], estimateCents: ['cents'], status: ['en', 'budget_status'], paidCents: ['cents'], advanceCents: ['centsOpt'] },
    tasks: { id: ['id'], title: ['req', LIMITS.title], area: ['en', 'area'], owner: ['str', LIMITS.owner], due: ['date'], status: ['en', 'task_status'], note: ['str', LIMITS.note] },
    ops: { id: ['id'], group: ['en', 'ops_group'], title: ['req', LIMITS.title], owner: ['str', LIMITS.owner], status: ['en', 'task_status'], note: ['str', LIMITS.note] },
    sponsors: { id: ['id'], name: ['req', LIMITS.name], kind: ['en', 'sponsor_kind'], quantity: ['str', LIMITS.short], conditions: ['str', LIMITS.note], status: ['en', 'sponsor_status'] },
    barLines: { id: ['id'], product: ['req', LIMITS.name], units: ['intOpt', 0, LIMITS.units], salesCents: ['centsOpt'], costCents: ['centsOpt'] },
  };

  function isDate(v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(v + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }

  function check(rule, v) {
    const t = rule[0], a = rule[1], b = rule[2];
    switch (t) {
      case 'int': return Number.isInteger(v) && v >= a && v <= b;
      case 'intOpt': return v === null || (Number.isInteger(v) && v >= a && v <= b);
      case 'cents': return Number.isInteger(v) && v >= 0 && v <= LIMITS.moneyCents;
      case 'centsOpt': return v === null || check(['cents'], v);
      case 'pct': return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
      case 'pctOpt': return v === null || check(['pct'], v);
      case 'str': return typeof v === 'string' && v.length <= a;
      case 'req': return typeof v === 'string' && v.length <= a && v.trim() !== '';
      case 'en': return typeof v === 'string' && has(ENUMS[a], v);
      case 'bool': return typeof v === 'boolean';
      case 'date': return v === '' || (typeof v === 'string' && isDate(v));
      case 'time': return v === '' || (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v));
      case 'id': return typeof v === 'string' && /^[a-z0-9-]{1,40}$/.test(v);
    }
    return false;
  }

  const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
  const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
  function badKeys(v, depth) {
    if (depth > 6) return true;
    if (Array.isArray(v)) return v.some(x => badKeys(x, depth + 1));
    if (v !== null && typeof v === 'object') return Object.keys(v).some(k => BAD_KEYS.indexOf(k) >= 0 || badKeys(v[k], depth + 1));
    return false;
  }

  // Construye un objeto nuevo solo con las claves del esquema: nunca copia claves desconocidas.
  function vObj(src, rules, path, errors) {
    if (!isPlain(src)) { errors.push(path + ': falta o no es un objeto.'); return null; }
    const out = {};
    for (const k of Object.keys(rules)) {
      if (check(rules[k], src[k])) out[k] = src[k];
      else errors.push(path + '.' + k + ': valor inválido o faltante.');
    }
    return out;
  }

  function vList(src, rules, max, path, errors) {
    if (!Array.isArray(src)) { errors.push(path + ': falta o no es una lista.'); return []; }
    if (src.length > max) { errors.push(path + ': más de ' + max + ' elementos.'); return []; }
    const ids = new Set();
    const out = [];
    src.forEach((x, i) => {
      const o = vObj(x, rules, path + '[' + i + ']', errors);
      if (!o) return;
      if (ids.has(o.id)) errors.push(path + ': id repetido (' + o.id + ').');
      ids.add(o.id);
      out.push(o);
    });
    return out;
  }

  function validateState(input) {
    if (!isPlain(input)) return { ok: false, errors: ['El contenido no es un respaldo de esta plataforma.'] };
    if (badKeys(input, 0)) return { ok: false, errors: ['El respaldo contiene claves no permitidas (__proto__, constructor o prototype) o demasiado anidamiento.'] };
    const errors = [];
    if (input.app !== APP_ID && input.app !== LEGACY_APP_ID) errors.push('No es un respaldo de esta plataforma.');
    if (input.schemaVersion !== SCHEMA_VERSION) errors.push('Versión de esquema no compatible (se espera ' + SCHEMA_VERSION + ').');
    const okSaved = input.savedAt === null || (typeof input.savedAt === 'string' && input.savedAt.length <= 40 && !Number.isNaN(Date.parse(input.savedAt)));
    if (!okSaved) errors.push('savedAt: fecha inválida.');
    const out = { app: APP_ID, schemaVersion: SCHEMA_VERSION, savedAt: okSaved ? input.savedAt : null };
    out.event = vObj(input.event, RULES.event, 'event', errors);
    out.scenario = vObj(input.scenario, RULES.scenario, 'scenario', errors);
    out.real = vObj(input.real, RULES.real, 'real', errors);
    out.budget = vList(input.budget, RULES.budget, LIMITS.budget, 'budget', errors);
    out.tasks = vList(input.tasks, RULES.tasks, LIMITS.tasks, 'tasks', errors);
    out.ops = vList(input.ops, RULES.ops, LIMITS.ops, 'ops', errors);
    out.sponsors = vList(input.sponsors, RULES.sponsors, LIMITS.sponsors, 'sponsors', errors);
    const bar = vObj(input.bar, RULES.bar, 'bar', errors);
    out.bar = bar && { base: bar.base, pct: bar.pct, lines: vList(input.bar.lines, RULES.barLines, LIMITS.barLines, 'bar.lines', errors) };
    const roles = out.budget.map(b => b.role).filter(Boolean);
    if (new Set(roles).size !== roles.length) errors.push('budget: hay dos partidas con el mismo rol.');
    if (errors.length) return { ok: false, errors: errors.slice(0, 20) };
    return { ok: true, state: out };
  }

  function parseBackup(text) {
    if (typeof text !== 'string' || text === '') return { ok: false, errors: ['El archivo está vacío.'] };
    if (text.length > LIMITS.importBytes) return { ok: false, errors: ['El archivo supera ' + Math.round(LIMITS.importBytes / 1024) + ' KB.'] };
    let data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, errors: ['El archivo no es JSON válido.'] }; }
    return validateState(data);
  }

  const serializeState = state => JSON.stringify(state, null, 2);

  // ---------- Campos de la interfaz ----------

  const ok = value => ({ ok: true, value });
  const no = error => ({ ok: false, error });

  // spec: int:min:max | intOpt:min:max | money | moneyOpt | pct | pctOpt | text:max | req:max | date | time | en:enum | bool
  function parseField(spec, raw) {
    const p = String(spec).split(':'), t = p[0];
    if (t === 'bool') return typeof raw === 'boolean' ? ok(raw) : no('Valor inválido.');
    if (typeof raw !== 'string') return no('Valor inválido.');
    const s = raw.trim();
    switch (t) {
      case 'int': case 'intOpt': {
        const min = Number(p[1]), max = Number(p[2]);
        if (s === '') return t === 'intOpt' ? ok(null) : no('Campo requerido: escribe un número entero (0 si no hay).');
        if (s[0] === '-') return no('No puede ser negativo.');
        if (!/^\d{1,6}$/.test(s)) return no('Escribe un número entero, sin decimales ni separadores.');
        const v = Number(s);
        if (v < min) return no('Mínimo ' + fmtInt(min) + '.');
        if (v > max) return no('Máximo ' + fmtInt(max) + '.');
        return ok(v);
      }
      case 'money': case 'moneyOpt': {
        if (s === '') return t === 'moneyOpt' ? ok(null) : no('Campo requerido: escribe un monto (0 si no aplica).');
        if (s[0] === '-') return no('No puede ser negativo.');
        const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(s);
        if (!m) return no('Escribe un monto en USD con hasta dos decimales y sin separador de miles (ej. 12.50).');
        const v = Number(m[1]) * 100 + Number(((m[2] || '') + '00').slice(0, 2));
        if (v > LIMITS.moneyCents) return no('Máximo ' + fmtMoney(LIMITS.moneyCents) + '.');
        return ok(v);
      }
      case 'pct': case 'pctOpt': {
        if (s === '') return t === 'pctOpt' ? ok(null) : no('Campo requerido: escribe un porcentaje (0 si no aplica).');
        if (s[0] === '-') return no('No puede ser negativo.');
        const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(s);
        if (!m) return no('Escribe un porcentaje de 0 a 100, con hasta dos decimales.');
        const v = Number(m[1]) + Number(((m[2] || '') + '00').slice(0, 2)) / 100;
        if (v > 100) return no('Máximo 100%.');
        return ok(Math.round(v * 100) / 100);
      }
      case 'text': case 'req': {
        const max = Number(p[1]);
        if (t === 'req' && s === '') return no('No puede quedar vacío.');
        if (s.length > max) return no('Máximo ' + max + ' caracteres.');
        return ok(s);
      }
      case 'date': return s === '' || isDate(s) ? ok(s) : no('Fecha inválida.');
      case 'time': return check(['time'], s) ? ok(s) : no('Hora inválida (usa HH:MM).');
      case 'en': return has(ENUMS[p[1]], s) ? ok(s) : no('Opción inválida.');
    }
    return no('Tipo de campo desconocido.');
  }

  // ---------- Cálculo ----------

  function assertScenario(sc) {
    for (const k of Object.keys(RULES.scenario)) if (!check(RULES.scenario[k], sc[k])) throw new RangeError('Escenario inválido: ' + k);
  }
  function assertBudget(budget) {
    if (!Array.isArray(budget)) throw new RangeError('Presupuesto inválido.');
    for (const it of budget) {
      if (!check(['cents'], it.estimateCents) || !check(['cents'], it.paidCents) || !check(['centsOpt'], it.advanceCents) || !check(['en', 'role'], it.role)) {
        throw new RangeError('Partida inválida: ' + it.id);
      }
    }
  }
  function assertBar(bar) {
    if (!bar || !check(RULES.bar.base, bar.base) || !check(RULES.bar.pct, bar.pct) || !Array.isArray(bar.lines)) throw new RangeError('Barra inválida.');
    for (const l of bar.lines) if (!check(['centsOpt'], l.salesCents) || !check(['centsOpt'], l.costCents)) throw new RangeError('Producto de barra inválido: ' + l.id);
  }

  // Enteros que siempre suman n; .5 redondea hacia la tarifa anticipada.
  function splitTickets(n, lowPct) {
    const low = Math.round(n * lowPct / 100);
    return { low, high: n - low };
  }

  const isCovered = (item, preset) => item.role !== '' && has(PRESET_COVERS, preset) && PRESET_COVERS[preset].indexOf(item.role) >= 0;

  // Por partida: max(estimado, pagado), para no ocultar sobrecostos. Si la propuesta la cubre, solo cuenta lo ya pagado.
  function forecastCost(budget, preset) {
    if (!has(PRESET_COVERS, preset)) throw new RangeError('Propuesta desconocida: ' + preset);
    assertBudget(budget);
    let c = 0;
    for (const it of budget) c += isCovered(it, preset) ? it.paidCents : Math.max(it.estimateCents, it.paidCents);
    return c;
  }

  function budgetTotals(budget, preset) {
    const t = { declaredCents: 0, forecastCents: forecastCost(budget, preset), paidCents: 0, pendingCents: 0, overCents: 0 };
    for (const it of budget) {
      t.declaredCents += it.estimateCents;
      t.paidCents += it.paidCents;
      t.pendingCents += Math.max(0, it.estimateCents - it.paidCents);
      t.overCents += Math.max(0, it.paidCents - it.estimateCents);
    }
    return t;
  }

  function barShare(bar) {
    assertBar(bar);
    let sales = 0, costs = 0, missingSales = 0, missingCosts = 0;
    for (const l of bar.lines) {
      if (l.salesCents === null) missingSales++; else sales += l.salesCents;
      if (l.costCents === null) missingCosts++; else costs += l.costCents;
    }
    const r = { status: 'ok', cents: 0, baseCents: 0, salesCents: sales, costCents: costs, missingSales, missingCosts, reason: '' };
    if (bar.base === '' || bar.pct === null) return Object.assign(r, { status: 'pendiente', reason: 'Falta acordar la base y el porcentaje del organizador.' });
    if (!bar.lines.length || missingSales) return Object.assign(r, { status: 'incompleto', reason: 'Faltan datos de ventas en el registro de barra.' });
    if (bar.base === 'neto' && missingCosts) return Object.assign(r, { status: 'incompleto', reason: 'Faltan datos de costos en el registro de barra (la base es la utilidad).' });
    r.baseCents = bar.base === 'bruto' ? sales : Math.max(0, sales - costs);
    r.cents = Math.round(r.baseCents * bar.pct / 100);
    return r;
  }

  function core(sc, n, costCents, bar) {
    const sp = splitTickets(n, sc.lowPct);
    const gross = sp.low * sc.priceLowCents + sp.high * sc.priceHighCents;
    const venue = Math.round(gross * sc.venuePct / 100);
    const feePct = Math.round(gross * sc.feePct / 100);
    const feeTicket = n * sc.feePerTicketCents;
    const ded = venue + feePct + feeTicket;
    const barC = sc.includeBar && bar.status === 'ok' ? bar.cents : 0;
    const retained = gross - ded;
    return {
      tickets: n, low: sp.low, high: sp.high, courtesies: sc.courtesies, attendance: n + sc.courtesies,
      grossCents: gross, venueCents: venue, feePctCents: feePct, feeTicketCents: feeTicket, deductionsCents: ded,
      retainedCents: retained, sponsorCents: sc.sponsorCashCents, barCents: barC, costCents,
      saldoCents: retained + sc.sponsorCashCents + barC - costCents,
    };
  }

  function prepare(state, over) {
    const sc = Object.assign({}, state.scenario, over || {});
    assertScenario(sc);
    return { sc, cost: forecastCost(state.budget, sc.preset), bar: barShare(state.bar) };
  }

  // Saldo = taquilla retenida + patrocinio en efectivo + barra del organizador (solo con interruptor y acuerdo) − costo previsto.
  function calcScenario(state, over) {
    const p = prepare(state, over);
    const r = core(p.sc, p.sc.tickets, p.cost, p.bar);
    r.bar = { requested: p.sc.includeBar, status: p.bar.status, cents: r.barCents, reason: p.bar.reason };
    r.warnings = [];
    if (r.deductionsCents > r.grossCents) r.warnings.push('deducciones_superan_bruto');
    if (p.sc.includeBar && p.bar.status !== 'ok') r.warnings.push('barra_sin_acuerdo');
    return r;
  }

  // Menor n entre 0 y 10000 con saldo ≥ 0 y la misma mezcla; null si no se alcanza.
  function breakEven(state, over) {
    const p = prepare(state, over);
    for (let n = 0; n <= LIMITS.ticketsModel; n++) if (core(p.sc, n, p.cost, p.bar).saldoCents >= 0) return n;
    return null;
  }

  function compareGrid(state) {
    return {
      tariffs: COMPARE_TARIFFS.slice(),
      rows: COMPARE_TICKETS.map(n => ({ n, saldos: COMPARE_TARIFFS.map(t => calcScenario(state, { tickets: n, lowPct: 0, priceHighCents: t }).saldoCents) })),
      minimum: COMPARE_TARIFFS.map(t => breakEven(state, { lowPct: 0, priceHighCents: t })),
    };
  }

  // Rango del gráfico: 60..150 por defecto; se abre solo para incluir el escenario o el mínimo.
  function chartDomain(n, eq) {
    const hasEq = eq !== null && eq !== undefined;
    const lo0 = Math.min(60, n, hasEq ? eq : 60);
    const hi0 = Math.max(150, n, hasEq && eq <= LIMITS.ticketsUI ? eq : 150);
    const lo = lo0 < 60 ? Math.max(0, Math.floor(lo0 / 10) * 10 - 10) : 60;
    const hi = hi0 > 150 ? Math.min(Math.max(LIMITS.ticketsUI, n), Math.ceil(hi0 / 10) * 10 + 10) : 150;
    return { lo, hi };
  }

  function chartSeries(state, lo, hi) {
    if (!check(['int', 0, LIMITS.ticketsModel], lo) || !check(['int', lo, LIMITS.ticketsModel], hi)) throw new RangeError('Rango inválido.');
    const p = prepare(state);
    const out = [];
    for (let n = lo; n <= hi; n++) out.push({ n, saldoCents: core(p.sc, n, p.cost, p.bar).saldoCents });
    return out;
  }

  function niceTicks(min, max, count) {
    if (!(Number.isFinite(min) && Number.isFinite(max))) return [0];
    if (min === max) { min -= 100; max += 100; }
    const raw = (max - min) / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
    const out = [];
    for (let k = Math.floor(min / step); k <= Math.ceil(max / step); k++) out.push(k * step + 0);
    return out;
  }

  function cashReal(state) {
    const r = state.real;
    for (const k of Object.keys(RULES.real)) if (!check(RULES.real[k], r[k])) throw new RangeError('Caja inválida: ' + k);
    assertBudget(state.budget);
    const income = r.ticketsCollectedCents + r.sponsorCollectedCents + r.barCollectedCents;
    let paid = 0, due = 0, unknown = 0;
    for (const it of state.budget) {
      paid += it.paidCents;
      if (it.advanceCents === null) { if (it.paidCents < it.estimateCents) unknown++; }
      else due += Math.max(0, it.advanceCents - it.paidCents);
    }
    const cash = income + r.ownContributionCents - paid;
    return {
      incomeCents: income, ownCents: r.ownContributionCents, paidCents: paid, cashCents: cash,
      operatingCents: income - paid, advancesDueCents: due, advancesUnknown: unknown, preOpeningCents: cash - due,
    };
  }

  const nextAction = tasks => tasks.find(t => t.status === 'en_curso') || tasks.find(t => t.status === 'pendiente') || null;
  const blockedTasks = tasks => tasks.filter(t => t.status === 'bloqueado');
  const resetScenario = state => Object.assign({}, state, { scenario: defaultScenario() });

  // ---------- Formato ----------

  const NF0 = new Intl.NumberFormat('es-419', { maximumFractionDigits: 0 });
  const NF2 = new Intl.NumberFormat('es-419', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmtMoney(c) {
    const a = Math.abs(c);
    return (c < 0 ? '−$' : '$') + (a % 100 === 0 ? NF0.format(a / 100) : NF2.format(a / 100));
  }
  const fmtInt = n => NF0.format(n);
  const fmtInput = c => (c === null || c === undefined ? '' : c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2));

  // ---------- CSV ----------

  function csvCell(v) {
    let s = String(v === undefined || v === null ? '' : v);
    // Texto que empieza como fórmula se neutraliza; los números negativos quedan como números.
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  const dec = c => (c / 100).toFixed(2);

  function toCSV(state) {
    const sc = state.scenario, r = calcScenario(state), eq = breakEven(state);
    const t = budgetTotals(state.budget, sc.preset), g = compareGrid(state), cash = cashReal(state);
    const rows = [
      ['Sindicato Baba · escenario (hipótesis, no garantía)', ''],
      ['Concepto', 'Valor'],
      ['Entradas pagadas (escenario)', sc.tickets],
      ['Proporción a tarifa anticipada (%)', sc.lowPct],
      ['Tarifa anticipada, antes de la fiesta (USD)', dec(sc.priceLowCents)],
      ['Tarifa en puerta, día de la fiesta (USD)', dec(sc.priceHighCents)],
      ['Cortesías (sin ingreso)', sc.courtesies],
      ['Propuesta de costos (no acordada)', ENUMS.preset[sc.preset]],
      ['Reparto del local (%, hipótesis)', sc.venuePct],
      ['Comisión de cobro (%, hipótesis)', sc.feePct],
      ['Cargo por entrada (USD, hipótesis)', dec(sc.feePerTicketCents)],
      ['Barra sumada al saldo', sc.includeBar ? 'Sí' : 'No'],
      ['Entradas a tarifa anticipada', r.low],
      ['Entradas a tarifa en puerta', r.high],
      ['Bruto de taquilla', dec(r.grossCents)],
      ['Deducciones: reparto, comisión y cargos (se restan)', dec(r.deductionsCents)],
      ['Taquilla retenida', dec(r.retainedCents)],
      ['Patrocinio en efectivo (se suma)', dec(r.sponsorCents)],
      ['Reparto de barra (se suma)', dec(r.bar.cents)],
      ['Costo previsto (se resta)', dec(r.costCents)],
      ['Saldo previsto', dec(r.saldoCents)],
      ['Mínimo de entradas para cubrir costos', eq === null ? 'No alcanzable hasta 10000' : eq],
      [],
      ['Partida', 'Estimado', 'Estado', 'Pagado', 'Pendiente', 'Adelanto antes de abrir'],
    ];
    for (const b of state.budget) {
      rows.push([b.name, dec(b.estimateCents), ENUMS.budget_status[b.status], dec(b.paidCents), dec(Math.max(0, b.estimateCents - b.paidCents)), b.advanceCents === null ? 'Sin dato' : dec(b.advanceCents)]);
    }
    rows.push(['Base declarada', dec(t.declaredCents)], ['Pagado', dec(t.paidCents)], ['Pendiente por pagar', dec(t.pendingCents)], []);
    rows.push(['Caja real (registrado)', ''], ['Ingresos cobrados', dec(cash.incomeCents)], ['Aporte propio (no es ingreso)', dec(cash.ownCents)],
      ['Pagado', dec(cash.paidCents)], ['Caja disponible', dec(cash.cashCents)], []);
    rows.push(['Comparación: entradas pagadas a tarifa única (sin probabilidades)'].concat(g.tariffs.map(x => 'Tarifa ' + dec(x))));
    for (const row of g.rows) rows.push([row.n].concat(row.saldos.map(dec)));
    rows.push(['Mínimo para cubrir costos'].concat(g.minimum.map(m => (m === null ? 'No alcanzable' : m))), []);
    rows.push(['Nota', 'Sensibilidad, no predicción. Cambiar el precio no cambia la demanda en este modelo. Ningún acuerdo está cerrado.']);
    return '﻿' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  // ---------- Persistencia (storage = localStorage o un sustituto) ----------

  function saveState(storage, state, now) {
    if (!storage) return { ok: false, error: 'Este navegador no permite guardar datos locales.' };
    const savedAt = (now || new Date()).toISOString();
    try {
      storage.setItem(STORAGE_KEY, serializeState(Object.assign({}, state, { savedAt })));
      return { ok: true, savedAt };
    } catch (e) {
      return { ok: false, error: e && e.name === 'QuotaExceededError' ? 'El almacenamiento del navegador está lleno.' : 'No se pudo escribir en el almacenamiento del navegador.' };
    }
  }

  function loadState(storage) {
    if (!storage) return { state: defaultState(), source: 'seed', available: false };
    let raw;
    try {
      // Copia una vez lo guardado con el nombre anterior; las claves viejas quedan intactas.
      if (storage.getItem(STORAGE_KEY) === null) for (const s of [':v1', ':v1:respaldo']) { const v = storage.getItem(LEGACY_APP_ID + s); if (v !== null) storage.setItem(APP_ID + s, v); }
      raw = storage.getItem(STORAGE_KEY);
    } catch (e) { return { state: defaultState(), source: 'seed', available: false }; }
    if (raw === null || raw === undefined) return { state: defaultState(), source: 'seed', available: true };
    const r = parseBackup(raw);
    if (r.ok) return { state: r.state, source: 'stored', available: true };
    try { storage.setItem(CORRUPT_KEY, raw); } catch (e) { /* sin espacio: el dato original sigue en STORAGE_KEY hasta el próximo guardado */ }
    return { state: defaultState(), source: 'corrupt', available: true, errors: r.errors };
  }

  function backupBeforeReplace(storage, state) {
    if (!storage) return { ok: false };
    try { storage.setItem(BACKUP_KEY, serializeState(state)); return { ok: true }; } catch (e) { return { ok: false }; }
  }

  function readBackup(storage) {
    if (!storage) return { ok: false, errors: ['Sin almacenamiento.'] };
    let raw;
    try { raw = storage.getItem(BACKUP_KEY); } catch (e) { return { ok: false, errors: ['Sin almacenamiento.'] }; }
    if (raw === null || raw === undefined) return { ok: false, errors: ['No hay respaldo anterior.'] };
    return parseBackup(raw);
  }

  const Model = {
    APP_ID, SCHEMA_VERSION, STORAGE_KEY, BACKUP_KEY, CORRUPT_KEY, CLAVE_KEY, LIMITS, ENUMS, PRESET_COVERS, COMPARE_TICKETS, COMPARE_TARIFFS,
    defaultState, defaultScenario, newItem, splitTickets, isCovered, forecastCost, budgetTotals, barShare, calcScenario, breakEven,
    compareGrid, chartDomain, chartSeries, niceTicks, cashReal, nextAction, blockedTasks, resetScenario, parseField, validateState,
    parseBackup, serializeState, saveState, loadState, backupBeforeReplace, readBackup, toCSV, fmtMoney, fmtInt, fmtInput,
  };

  if (typeof module === 'object' && module.exports) module.exports = Model;
  else root.SindicatoBaba = Model; // navegador, y Deno en la Edge Function `pm` (sin document ni module)
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => startUI(Model, document, window));
  else startUI(Model, document, window);

  // ============================== Interfaz ==============================

  function startUI(M, doc, win) {
    const L = M.LIMITS;
    const $ = id => doc.getElementById(id);
    const qa = (sel, el) => Array.prototype.slice.call((el || doc).querySelectorAll(sel));
    const NS = 'http://www.w3.org/2000/svg';
    const FIN = /^(scenario|real|bar|budget|barLines)\b/;
    const fm = M.fmtMoney, fi = M.fmtInt;
    const LISTS = {
      budget: { arr: () => state.budget, max: L.budget, first: 'name', render: () => renderBudget() },
      tasks: { arr: () => state.tasks, max: L.tasks, first: 'title', render: () => renderTasks() },
      ops: { arr: () => state.ops, max: L.ops, first: 'title', render: () => renderOps() },
      sponsors: { arr: () => state.sponsors, max: L.sponsors, first: 'name', render: () => renderSponsors() },
      barLines: { arr: () => state.bar.lines, max: L.barLines, first: 'product', render: () => renderBarLines() },
    };

    let storage = null;
    try { storage = win.localStorage; storage.getItem(M.STORAGE_KEY); } catch (e) { storage = null; }
    const loaded = M.loadState(storage);
    let state = loaded.state;
    let memBackup = null;
    let save = !loaded.available ? { ok: false, error: 'Este navegador no permite guardar datos locales.' }
      : loaded.source === 'stored' ? { ok: true, at: state.savedAt } : { ok: null };
    const invalid = new Map();
    const openSet = new Set();
    let lastChart = null;

    // Plataforma compartida (spec #2): mismo patrón LOCAL/API/KEY que ticketera/comun.js.
    // La publishable key es pública por diseño; lo que protege el estado es la clave.
    const LOCAL = ['localhost', '127.0.0.1'].includes(win.location.hostname);
    const PM_URL = (LOCAL ? 'http://127.0.0.1:54321' : 'https://ptbzdepejxxlavqfyepw.supabase.co') + '/functions/v1/pm';
    const PM_KEY = LOCAL ? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' : 'sb_publishable_iN1zfxf9SYEg42123alZHQ_4c3UYh_D';
    let clave = null;
    try { clave = storage && storage.getItem(M.CLAVE_KEY); } catch (e) { clave = null; }
    let base = null; // versión remota sobre la que trabaja esta pestaña; null = aún no leída
    let dirty = false; // hay cambios locales sin subir
    let sync = null; // { ok: true, version } | { ok: false, error }
    let aviso = '';
    let timer = 0;
    let cola = Promise.resolve(); // las llamadas a `pm` van de una en una

    // ---------- utilidades DOM (solo textContent / atributos, nunca HTML) ----------

    function h(tag, props, kids) {
      const el = doc.createElement(tag);
      if (props) for (const k of Object.keys(props)) {
        const v = props[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else el.setAttribute(k, v === true ? '' : String(v));
      }
      if (kids) for (const c of [].concat(kids)) if (c !== null && c !== undefined) el.append(c);
      return el;
    }
    function svg(tag, attrs, text) {
      const el = doc.createElementNS(NS, tag);
      for (const k of Object.keys(attrs)) el.setAttribute(k, String(attrs[k]));
      if (text !== undefined) el.textContent = text;
      return el;
    }
    function setText(el, s) { if (el && el.textContent !== s) el.textContent = s; }
    function tone(el, c) { if (!el) return; el.classList.toggle('neg', typeof c === 'number' && c < 0); el.classList.toggle('pos', typeof c === 'number' && c > 0); }
    function fillSelect(sel, map, first) {
      sel.textContent = '';
      if (first) sel.append(h('option', { value: '', text: first }));
      for (const k of Object.keys(map)) sel.append(h('option', { value: k, text: map[k] }));
    }
    const minus = c => (c === 0 ? '$0' : '−' + fm(c));
    const plus = c => (c === 0 ? '$0' : '+' + fm(c));
    const plural = (n, one, many) => fi(n) + ' ' + (n === 1 ? one : many);
    function fmtDate(iso) {
      const p = iso.split('-').map(Number);
      return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('es-419', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    const hhmm = iso => new Date(iso).toLocaleTimeString('es-419', { hour: '2-digit', minute: '2-digit' });
    const eqText = eq => (eq === null
      ? 'Mínimo para cubrir costos: no alcanzable con estas condiciones (probado hasta 10,000 entradas).'
      : 'Mínimo para cubrir costos: ' + plural(eq, 'entrada pagada', 'entradas pagadas') + ' con la misma mezcla.' + (eq > L.ticketsUI ? ' Supera el rango de 500 de esta interfaz.' : ''));

    // ---------- campos ----------

    function getPath(path) { return path.split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), state); }
    function setPath(path, v) { const ks = path.split('.'); const last = ks.pop(); ks.reduce((o, k) => o[k], state)[last] = v; }
    function toInput(spec, v) {
      if (v === null || v === undefined) return '';
      const t = spec.split(':')[0];
      return t === 'money' || t === 'moneyOpt' ? M.fmtInput(v) : String(v);
    }
    function setValue(el, v) {
      if (el.type === 'checkbox') el.checked = v === true;
      else if (el.type === 'radio') el.checked = el.value === v;
      else el.value = toInput(el.dataset.t, v);
    }
    const keyOf = el => el.dataset.k || (el.dataset.l + ':' + el.dataset.id + ':' + el.dataset.f);
    function setError(el, msg) {
      const key = keyOf(el);
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      setText($(el.id + '-err'), msg || '');
      if (msg) invalid.set(key, { fin: FIN.test(key) }); else invalid.delete(key);
    }
    const findItem = (list, id) => (Object.prototype.hasOwnProperty.call(LISTS, list) ? LISTS[list].arr().find(x => x.id === id) : undefined);
    const itemEl = (list, id) => doc.querySelector('[data-item="' + list + ':' + id + '"]');
    const outEl = (li, name) => li && li.querySelector('[data-o="' + name + '"]');

    function bindStatic() {
      for (const el of qa('[data-k]')) { setValue(el, getPath(el.dataset.k)); setError(el, ''); }
    }

    function onInput(e) {
      const el = e.target;
      if (!el || !el.dataset) return;
      if (el.hasAttribute('data-filter')) { renderTasks(); return; }
      if (!el.dataset.t) return;
      if (el.type === 'radio' && !el.checked) return;
      const r = M.parseField(el.dataset.t, el.type === 'checkbox' ? el.checked : el.value);
      if (!r.ok) { setError(el, r.error); renderDerived(); return; }
      if (el.dataset.l) {
        const it = findItem(el.dataset.l, el.dataset.id);
        if (!it) return;
        it[el.dataset.f] = r.value;
        setError(el, '');
        if (el.dataset.l === 'ops' && el.dataset.f === 'group' && e.type === 'change') { renderOps(); const n = $(el.id); if (n) n.focus(); }
      } else {
        setPath(el.dataset.k, r.value);
        for (const t of qa('[data-k="' + el.dataset.k + '"]')) { if (t !== el) setValue(t, r.value); setError(t, ''); }
      }
      persist();
      renderDerived();
    }

    // ---------- guardado ----------

    function persist() {
      const r = M.saveState(storage, state, new Date());
      if (r.ok) { state.savedAt = r.savedAt; save = { ok: true, at: r.savedAt }; }
      else save = { ok: false, error: r.error };
      // Con clave, agrupa la ráfaga de cambios en un solo guardado remoto.
      if (clave) { dirty = true; win.clearTimeout(timer); timer = win.setTimeout(() => enCola(subir), 1500); }
      renderSave();
    }

    function renderSave() {
      const det = $('save-detail');
      if (save.ok === true && clave && sync && sync.ok && !dirty) {
        setText($('ind-save'), 'Sincronizado ' + hhmm(save.at));
        setText(det, 'Guardado en este navegador y en la plataforma compartida (versión ' + sync.version + '): ' + new Date(save.at).toLocaleString('es-419') + '.');
      } else if (save.ok === true && clave && sync && !sync.ok) {
        setText($('ind-save'), 'Guardado solo en este navegador');
        setText(det, 'Guardado solo en este navegador (' + sync.error + '): ' + new Date(save.at).toLocaleString('es-419') + '. Se reintenta con el próximo cambio o al volver a esta pestaña.');
      } else if (save.ok === true) {
        setText($('ind-save'), 'Guardado ' + hhmm(save.at));
        setText(det, 'Último guardado en este navegador: ' + new Date(save.at).toLocaleString('es-419') + '.');
      } else if (save.ok === false) {
        setText($('ind-save'), 'Sin guardar');
        setText(det, 'Sin guardar: ' + save.error);
      } else {
        setText($('ind-save'), 'Plantilla');
        setText(det, 'Aún no hay cambios guardados: estás viendo la plantilla.');
      }
      const msgs = [];
      if (save.ok === false) msgs.push('No se guardó: ' + save.error + ' Los cambios siguen en esta pestaña; exporta un respaldo JSON para no perderlos.');
      if (loaded.source === 'corrupt') msgs.push('Los datos guardados no se pudieron leer: se cargó la plantilla y se conservó una copia sin leer en este navegador.');
      if (aviso) msgs.push(aviso);
      const al = $('storage-alert');
      setText(al, msgs.join(' '));
      al.hidden = !msgs.length;
    }

    function updateRestore() {
      $('btn-restore').hidden = !(memBackup || M.readBackup(storage).ok);
    }

    function dataMsg(s) { setText($('data-msg'), s); }

    // ---------- resultados ----------

    function renderDerived() {
      const finBad = Array.from(invalid.values()).filter(v => v.fin).length;
      const fe = $('fin-errors');
      setText(fe, finBad ? (finBad === 1 ? 'Hay 1 campo por corregir' : 'Hay ' + finBad + ' campos por corregir') + ': los resultados quedan en pausa y el valor con error no se guarda.' : '');
      fe.hidden = !finBad;
      let d = null;
      if (!finBad) {
        try {
          d = { r: M.calcScenario(state), eq: M.breakEven(state), cash: M.cashReal(state), tot: M.budgetTotals(state.budget, state.scenario.preset), bar: M.barShare(state.bar) };
        } catch (err) {
          d = null;
          setText(fe, 'Datos inconsistentes: ' + err.message + ' Restaura un respaldo o vuelve a la plantilla.');
          fe.hidden = false;
        }
      }
      renderTop(d);
      renderResumen(d);
      renderFinance(d);
      renderVentas(d);
      refreshItems();
    }

    function renderTop(d) {
      setText($('ind-prev'), d ? fm(d.r.saldoCents) : '—');
      tone($('ind-prev'), d && d.r.saldoCents);
      setText($('ind-real'), d ? fm(d.cash.cashCents) : '—');
      tone($('ind-real'), d && d.cash.cashCents);
    }

    function stateText(r) {
      const n = plural(r.tickets, 'entrada pagada', 'entradas pagadas');
      if (r.saldoCents > 0) return 'Superávit con ' + n + ' (hipótesis).';
      if (r.saldoCents === 0) return 'Equilibrio justo con ' + n + ' (hipótesis).';
      return 'Déficit: faltan ' + fm(-r.saldoCents) + ' con ' + n + ' (hipótesis).';
    }

    function renderResumen(d) {
      const sc = state.scenario;
      setText($('sum-prev'), d ? fm(d.r.saldoCents) : '—');
      tone($('sum-prev'), d && d.r.saldoCents);
      setText($('sum-prev-desc'), d ? 'Hipótesis: ' + plural(sc.tickets, 'entrada pagada', 'entradas pagadas') + ' (' + fi(d.r.low) + ' a ' + fm(sc.priceLowCents) + ', ' + fi(d.r.high) + ' a ' + fm(sc.priceHighCents) + '), costo previsto ' + fm(d.r.costCents) + '. No es garantía ni caja.' : 'Corrige los campos marcados en Finanzas.');
      setText($('sum-eq'), d ? eqText(d.eq) : '');
      setText($('sum-real'), d ? fm(d.cash.cashCents) : '—');
      tone($('sum-real'), d && d.cash.cashCents);
      setText($('sum-real-desc'), d ? 'Cobrado ' + fm(d.cash.incomeCents) + ' + aporte propio ' + fm(d.cash.ownCents) + ' − pagado ' + fm(d.cash.paidCents) + '.' : '');
      setText($('sum-pending'), d ? 'Por pagar según presupuesto: ' + fm(d.tot.pendingCents) + '. Adelantos antes de abrir: ' + fm(d.cash.advancesDueCents) + (d.cash.advancesUnknown ? ' y ' + plural(d.cash.advancesUnknown, 'partida', 'partidas') + ' sin dato.' : '.') : '');

      const ev = state.event;
      setText($('ev-out'), ev.date ? fmtDate(ev.date) + (ev.time ? ', ' + ev.time : ', hora por confirmar') + '.' : 'Jueves por confirmar: sin fecha exacta ni hora.');

      const next = M.nextAction(state.tasks);
      setText($('next-title'), next ? next.title : 'No hay tareas pendientes ni en curso.');
      setText($('next-meta'), next ? taskMeta(next) + ' · ' + M.ENUMS.task_status[next.status] : '');
      const bl = M.blockedTasks(state.tasks);
      const ul = $('blocked');
      ul.textContent = '';
      if (!bl.length) ul.append(h('li', { class: 'meta', text: 'Ninguna tarea bloqueada.' }));
      for (const t of bl) ul.append(h('li', null, [h('strong', { text: t.title }), t.note ? ' · ' + t.note : '']));
      const done = state.tasks.filter(t => t.status === 'hecho').length;
      setText($('plan-progress'), fi(done) + ' de ' + plural(state.tasks.length, 'tarea hecha', 'tareas hechas') + '.');
    }

    function ledger(dl, rows) {
      dl.textContent = '';
      for (const row of rows) {
        dl.append(h('dt', { class: row[2] || null, text: row[0] }), h('dd', { class: row[2] || null, text: row[1] }));
      }
    }

    function renderFinance(d) {
      const sc = state.scenario;
      setText($('sc-mix-out'), d ? fi(d.r.low) + ' a ' + fm(sc.priceLowCents) + ' y ' + fi(d.r.high) + ' a ' + fm(sc.priceHighCents) : '—');
      const rs = $('res-saldo');
      setText(rs, d ? fm(d.r.saldoCents) : '—');
      tone(rs, d && d.r.saldoCents);
      setText($('res-state'), d ? stateText(d.r) : 'Sin resultado: corrige los campos marcados.');
      setText($('res-eq'), d ? eqText(d.eq) : '');
      const warns = [];
      if (d && d.r.warnings.indexOf('deducciones_superan_bruto') >= 0) warns.push('El reparto y los cargos superan la taquilla: cada entrada resta en vez de sumar.');
      if (d && d.r.warnings.indexOf('barra_sin_acuerdo') >= 0) warns.push('La barra está activada pero sin acuerdo completo: se suma $0.');
      setText($('res-warn'), warns.join(' '));
      $('res-warn').hidden = !warns.length;

      ledger($('res-ledger'), d ? [
        ['Entradas a tarifa anticipada (' + fm(sc.priceLowCents) + ')', fi(d.r.low)],
        ['Entradas a tarifa en puerta (' + fm(sc.priceHighCents) + ')', fi(d.r.high)],
        ['Cortesías (aparte, sin ingreso)', fi(d.r.courtesies)],
        ['Bruto de taquilla', fm(d.r.grossCents), 'sub'],
        ['Reparto del local (hipótesis)', minus(d.r.venueCents)],
        ['Comisión de cobro (hipótesis)', minus(d.r.feePctCents)],
        ['Cargos por entrada (hipótesis)', minus(d.r.feeTicketCents)],
        ['Taquilla retenida', fm(d.r.retainedCents), 'sub'],
        ['Patrocinio en efectivo', plus(d.r.sponsorCents)],
        ['Reparto de barra', !d.r.bar.requested ? 'No incluido' : d.r.bar.status === 'ok' ? plus(d.r.bar.cents) : 'Pendiente: $0'],
        ['Costo previsto (' + M.ENUMS.preset[sc.preset].toLowerCase() + ')', minus(d.r.costCents)],
        ['Saldo previsto', fm(d.r.saldoCents), 'total'],
      ] : []);

      for (const k of Object.keys(M.PRESET_COVERS)) setText($('pr-' + k + '-ref'), d ? 'Costo previsto: ' + fm(M.forecastCost(state.budget, k)) + '.' : '');
      const used = [sc.venuePct, sc.feePct, sc.feePerTicketCents, sc.sponsorCashCents].filter(x => x > 0).length;
      setText($('fees-sum'), used ? '· ' + fi(used) + ' en uso' : '· todo en 0');
      setText($('sc-bar-out'), !d ? '' : !sc.includeBar
        ? 'No se suma. Acuerdo de barra: ' + (d.bar.status === 'ok' ? 'completo, daría ' + fm(d.bar.cents) : d.bar.status === 'pendiente' ? 'pendiente' : 'datos incompletos') + '.'
        : d.bar.status === 'ok' ? 'Se suma ' + fm(d.bar.cents) + ' (' + M.ENUMS.bar_base[state.bar.base].toLowerCase() + ', ' + state.bar.pct + '%).'
          : 'Activado, pero se suma $0: ' + d.bar.reason);

      setText($('bt-declared'), d ? fm(d.tot.declaredCents) : '—');
      setText($('bt-paid'), d ? fm(d.tot.paidCents) : '—');
      setText($('bt-pending'), d ? fm(d.tot.pendingCents) : '—');
      setText($('bt-forecast'), d ? fm(d.r.costCents) : '—');
      setText($('bt-note'), d && d.tot.overCents ? 'Pagado por encima del estimado: ' + fm(d.tot.overCents) + ' (ya incluido en el costo previsto).' : '');

      setText($('cr-income'), d ? fm(d.cash.incomeCents) : '—');
      setText($('cr-own-out'), d ? fm(d.cash.ownCents) : '—');
      setText($('cr-paid'), d ? minus(d.cash.paidCents) : '—');
      setText($('cr-cash'), d ? fm(d.cash.cashCents) : '—');
      tone($('cr-cash'), d && d.cash.cashCents);
      setText($('cr-oper'), d ? fm(d.cash.operatingCents) : '—');
      tone($('cr-oper'), d && d.cash.operatingCents);
      setText($('cr-adv'), d ? minus(d.cash.advancesDueCents) + (d.cash.advancesUnknown ? ' · ' + plural(d.cash.advancesUnknown, 'partida', 'partidas') + ' sin dato' : '') : '—');
      setText($('cr-pre'), d ? fm(d.cash.preOpeningCents) + (d.cash.advancesUnknown ? ' (incompleto)' : '') : '—');
      tone($('cr-pre'), d && d.cash.preOpeningCents);

      renderCompare(d);
      drawChart(d);
      renderChartTable(d);
    }

    function renderCompare(d) {
      const tb = $('cmp-body');
      tb.textContent = '';
      if (!d) return;
      const g = M.compareGrid(state);
      for (const row of g.rows) {
        const tr = h('tr', null, [h('th', { scope: 'row', text: fi(row.n) })]);
        for (const c of row.saldos) { const td = h('td', { text: fm(c) }); tone(td, c); tr.append(td); }
        tb.append(tr);
      }
      const tr = h('tr', { class: 'min' }, [h('th', { scope: 'row', text: 'Mínimo para cubrir' })]);
      for (const m of g.minimum) tr.append(h('td', { text: m === null ? 'No alcanzable' : fi(m) }));
      tb.append(tr);
    }

    function drawChart(d) {
      lastChart = d;
      const el = $('chart'), wrap = $('chart-wrap');
      const W = Math.round(wrap.clientWidth);
      if (!d || W < 200) { el.textContent = ''; setText($('chart-desc'), d ? '' : 'Sin gráfico mientras haya campos por corregir.'); return; }
      const H = W < 480 ? 240 : 280, PL = 72, PR = 16, PT = 24, PB = 48;
      const dom = M.chartDomain(d.r.tickets, d.eq);
      const pts = M.chartSeries(state, dom.lo, dom.hi);
      let lo = 0, hi = 0;
      for (const p of pts) { lo = Math.min(lo, p.saldoCents); hi = Math.max(hi, p.saldoCents); }
      if (lo === hi) { lo -= 10000; hi += 10000; }
      const ticks = M.niceTicks(lo, hi, 5);
      lo = ticks[0]; hi = ticks[ticks.length - 1];
      const X = n => PL + (n - dom.lo) / (dom.hi - dom.lo) * (W - PL - PR);
      const Y = c => PT + (hi - c) / (hi - lo) * (H - PT - PB);
      el.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      el.setAttribute('width', W);
      el.setAttribute('height', H);
      const g = [];
      if (lo < 0) {
        g.push(svg('rect', { x: PL, y: Y(0), width: W - PL - PR, height: Y(lo) - Y(0), class: 'c-deficit' }));
        if (Y(lo) - Y(0) > 28) g.push(svg('text', { x: W - PR - 8, y: Y(lo) - 8, 'text-anchor': 'end', class: 'c-zone' }, 'Zona de déficit'));
      }
      for (const c of ticks) {
        g.push(svg('line', { x1: PL, x2: W - PR, y1: Y(c), y2: Y(c), class: c === 0 ? 'c-zero' : 'c-grid' }));
        g.push(svg('text', { x: PL - 8, y: Y(c) + 4, 'text-anchor': 'end', class: 'c-lab' }, fm(c)));
      }
      const span = dom.hi - dom.lo, maxT = Math.max(2, Math.floor((W - PL - PR) / 56));
      const step = [5, 10, 20, 25, 50, 100].find(x => span / x <= maxT) || 100;
      for (let n = Math.ceil(dom.lo / step) * step; n <= dom.hi; n += step) {
        g.push(svg('line', { x1: X(n), x2: X(n), y1: H - PB, y2: H - PB + 4, class: 'c-zero' }));
        g.push(svg('text', { x: X(n), y: H - PB + 20, 'text-anchor': 'middle', class: 'c-lab' }, fi(n)));
      }
      g.push(svg('text', { x: PL + (W - PL - PR) / 2, y: H - 6, 'text-anchor': 'middle', class: 'c-axis' }, 'Entradas pagadas (misma mezcla y precios)'));
      g.push(svg('polyline', { points: pts.map(p => X(p.n).toFixed(1) + ',' + Y(p.saldoCents).toFixed(1)).join(' '), class: 'c-line' }));
      if (d.eq !== null && d.eq >= dom.lo && d.eq <= dom.hi) {
        const ex = X(d.eq), right = ex > W - 120;
        g.push(svg('line', { x1: ex, x2: ex, y1: PT, y2: H - PB, class: 'c-eq' }));
        g.push(svg('text', { x: ex + (right ? -6 : 6), y: PT + 12, 'text-anchor': right ? 'end' : 'start', class: 'c-eqlab' }, 'Mínimo: ' + fi(d.eq)));
      }
      const cx = X(d.r.tickets), cy = Y(d.r.saldoCents), side = cx > W - 150;
      g.push(svg('circle', { cx: cx, cy: cy, r: 6, class: d.r.saldoCents < 0 ? 'c-dot neg' : 'c-dot' }));
      g.push(svg('text', { x: cx + (side ? -10 : 10), y: Math.max(PT + 28, cy - 10), 'text-anchor': side ? 'end' : 'start', class: 'c-cur' }, fi(d.r.tickets) + ' → ' + fm(d.r.saldoCents)));
      el.textContent = '';
      for (const n of g) el.append(n);
      setText($('chart-desc'), 'Saldo previsto de ' + fi(dom.lo) + ' a ' + fi(dom.hi) + ' entradas pagadas: ' + fm(pts[0].saldoCents) + ' con ' + fi(dom.lo) + ' y ' + fm(pts[pts.length - 1].saldoCents) + ' con ' + fi(dom.hi) + '. Escenario actual: ' + fi(d.r.tickets) + ' entradas, ' + fm(d.r.saldoCents) + '. ' + eqText(d.eq) + ' La franja sombreada bajo $0 es déficit.');
    }

    function renderChartTable(d) {
      const tb = $('chart-table');
      tb.textContent = '';
      if (!d) return;
      const dom = M.chartDomain(d.r.tickets, d.eq);
      const step = dom.hi - dom.lo > 150 ? 50 : 10;
      for (const p of M.chartSeries(state, dom.lo, dom.hi)) {
        if (p.n % step && p.n !== d.r.tickets && p.n !== d.eq) continue;
        const tag = p.n === d.r.tickets ? ' (escenario)' : p.n === d.eq ? ' (mínimo)' : '';
        const td = h('td', { text: fm(p.saldoCents) });
        tone(td, p.saldoCents);
        tb.append(h('tr', null, [h('th', { scope: 'row', text: fi(p.n) + tag }), td]));
      }
    }

    function renderVentas(d) {
      const rl = state.real;
      setText($('v-sold-out'), plural(rl.sold, 'entrada pagada', 'entradas pagadas') + (rl.courtesies ? ' + ' + plural(rl.courtesies, 'cortesía', 'cortesías') : ''));
      setText($('v-sc-out'), plural(state.scenario.tickets, 'entrada', 'entradas') + ' (hipótesis)');
      setText($('v-eq-out'), d ? (d.eq === null ? 'No alcanzable' : plural(d.eq, 'entrada', 'entradas')) : '—');
      setText($('v-missing-out'), d ? (d.eq === null ? '—' : plural(Math.max(0, d.eq - rl.sold), 'entrada', 'entradas')) : '—');
      if (!d) { for (const id of ['bar-sales', 'bar-costs', 'bar-share', 'bar-status']) setText($(id), '—'); return; }
      const b = d.bar;
      setText($('bar-sales'), fm(b.salesCents) + (b.missingSales ? ' · ' + plural(b.missingSales, 'producto', 'productos') + ' sin dato' : ''));
      setText($('bar-costs'), fm(b.costCents) + (b.missingCosts ? ' · ' + plural(b.missingCosts, 'producto', 'productos') + ' sin dato' : ''));
      setText($('bar-share'), b.status === 'ok' ? fm(b.cents) : b.status === 'pendiente' ? 'Pendiente de acuerdo' : 'Datos incompletos');
      setText($('bar-status'), b.status === 'ok'
        ? 'Calculado sobre ' + M.ENUMS.bar_base[state.bar.base].toLowerCase() + ' al ' + state.bar.pct + '%. ' + (state.scenario.includeBar ? 'Se suma al saldo previsto.' : 'No se suma al saldo previsto: actívalo en Finanzas si corresponde.')
        : b.reason + ' No se suma al saldo previsto.');
    }

    // ---------- listas ----------

    function taskMeta(t) {
      return [M.ENUMS.area[t.area], t.owner || 'sin responsable', t.due ? fmtDate(t.due) : 'sin fecha'].join(' · ');
    }

    function refreshItems() {
      const preset = state.scenario.preset;
      for (const b of state.budget) {
        const li = itemEl('budget', b.id);
        if (!li) continue;
        const pend = b.estimateCents - b.paidCents;
        const parts = [M.ENUMS.budget_status[b.status], 'pagado ' + fm(b.paidCents), pend >= 0 ? 'pendiente ' + fm(pend) : 'sobrecosto ' + fm(-pend),
          b.advanceCents === null ? 'adelanto sin dato' : 'adelanto ' + fm(b.advanceCents)];
        if (M.isCovered(b, preset)) parts.push('la cubre el local en la propuesta elegida');
        setText(outEl(li, 'sum'), parts.join(' · '));
      }
      for (const [list, arr] of [['tasks', state.tasks], ['ops', state.ops]]) {
        for (const t of arr) {
          const li = itemEl(list, t.id);
          if (!li) continue;
          li.setAttribute('data-status', t.status);
          setText(outEl(li, 'title'), t.title);
          setText(outEl(li, 'meta'), list === 'tasks' ? taskMeta(t) : (t.owner || 'sin responsable') + (t.note ? ' · ' + t.note : ''));
        }
      }
      for (const s of state.sponsors) {
        const li = itemEl('sponsors', s.id);
        if (!li) continue;
        setText(outEl(li, 'sum'), [M.ENUMS.sponsor_kind[s.kind], s.quantity || 'cantidad por definir', s.conditions ? 'con condiciones' : 'condiciones por definir', M.ENUMS.sponsor_status[s.status]].join(' · '));
      }
    }

    function field(list, item, f, label, spec, kind, x) {
      x = x || {};
      const id = list + '-' + item.id + '-' + f;
      let input;
      if (kind === 'select') { input = h('select', { id }); fillSelect(input, M.ENUMS[spec.split(':')[1]]); }
      else if (kind === 'textarea') input = h('textarea', { id, rows: 2 });
      else input = h('input', { id, type: kind === 'date' ? 'date' : 'text', inputmode: kind === 'money' ? 'decimal' : kind === 'int' ? 'numeric' : null, autocomplete: 'off' });
      input.dataset.l = list;
      input.dataset.id = item.id;
      input.dataset.f = f;
      input.dataset.t = spec;
      const hint = x.hint ? h('p', { class: 'hint', id: id + '-hint', text: x.hint }) : null;
      input.setAttribute('aria-describedby', [x.describedBy, hint ? id + '-hint' : null, id + '-err'].filter(Boolean).join(' '));
      input.setAttribute('aria-invalid', 'false');
      setValue(input, item[f]);
      return h('div', { class: 'field' + (x.cls ? ' ' + x.cls : '') }, [h('label', { for: id, class: x.srLabel ? 'sr' : null, text: label }), input, hint, h('p', { class: 'err', id: id + '-err' })]);
    }

    function fold(summary, key, kids) {
      const d = h('details', { class: 'fold', 'data-open': key }, [summary].concat(kids));
      d.open = openSet.has(key);
      return d;
    }
    const delBtn = (list, id, text) => h('button', { type: 'button', class: 'btn btn-danger', 'data-action': 'del', 'data-l': list, 'data-id': id, text });

    function budgetItem(b) {
      const key = 'budget:' + b.id;
      return h('li', { class: 'item', 'data-item': key }, [
        h('div', { class: 'row-main' }, [
          field('budget', b, 'name', 'Partida', 'req:' + L.name, 'text'),
          field('budget', b, 'estimateCents', 'Estimado (USD)', 'money', 'money', { cls: 'amount' }),
        ]),
        fold(h('summary', null, [h('span', { 'data-o': 'sum' })]), key, [
          h('div', { class: 'row-3' }, [
            field('budget', b, 'status', 'Estado', 'en:budget_status', 'select'),
            field('budget', b, 'paidCents', 'Pagado (USD)', 'money', 'money', { cls: 'amount' }),
            field('budget', b, 'advanceCents', 'Adelanto antes de abrir (USD)', 'moneyOpt', 'money', { cls: 'amount', hint: 'Vacío = sin dato.' }),
          ]),
          h('div', { class: 'actions' }, [delBtn('budget', b.id, 'Eliminar partida')]),
        ]),
      ]);
    }

    function statusRow(list, t) {
      const tid = list + '-' + t.id + '-titleout';
      return h('div', { class: 'task-head' }, [
        h('p', { class: 'task-title', id: tid, 'data-o': 'title' }),
        field(list, t, 'status', 'Estado', 'en:task_status', 'select', { cls: 'status', srLabel: true, describedBy: tid }),
      ]);
    }

    function taskItem(t) {
      const key = 'tasks:' + t.id;
      return h('li', { class: 'item task', 'data-item': key, 'data-status': t.status }, [
        statusRow('tasks', t),
        h('p', { class: 'meta', 'data-o': 'meta' }),
        fold(h('summary', { text: 'Editar tarea' }), key, [
          h('div', { class: 'form' }, [
            field('tasks', t, 'title', 'Título', 'req:' + L.title, 'text'),
            h('div', { class: 'row-2' }, [
              field('tasks', t, 'area', 'Área', 'en:area', 'select'),
              field('tasks', t, 'due', 'Fecha límite', 'date', 'date', { hint: 'Vacío = sin fecha.' }),
            ]),
            field('tasks', t, 'owner', 'Responsable', 'text:' + L.owner, 'text', { hint: 'Vacío = sin responsable.' }),
            field('tasks', t, 'note', 'Nota', 'text:' + L.note, 'textarea'),
          ]),
          h('div', { class: 'actions' }, [delBtn('tasks', t.id, 'Borrar tarea')]),
        ]),
      ]);
    }

    function opItem(o) {
      const key = 'ops:' + o.id;
      return h('li', { class: 'item task', 'data-item': key, 'data-status': o.status }, [
        statusRow('ops', o),
        h('p', { class: 'meta', 'data-o': 'meta' }),
        fold(h('summary', { text: 'Editar' }), key, [
          h('div', { class: 'form' }, [
            field('ops', o, 'title', 'Punto', 'req:' + L.title, 'text'),
            h('div', { class: 'row-2' }, [
              field('ops', o, 'group', 'Grupo', 'en:ops_group', 'select'),
              field('ops', o, 'owner', 'Responsable', 'text:' + L.owner, 'text', { hint: 'Vacío = sin responsable.' }),
            ]),
            field('ops', o, 'note', 'Nota', 'text:' + L.note, 'textarea'),
          ]),
          h('div', { class: 'actions' }, [delBtn('ops', o.id, 'Borrar punto')]),
        ]),
      ]);
    }

    function sponsorItem(s) {
      const key = 'sponsors:' + s.id;
      return h('li', { class: 'item', 'data-item': key }, [
        h('div', { class: 'row-main' }, [
          field('sponsors', s, 'name', 'Patrocinio', 'req:' + L.name, 'text'),
          field('sponsors', s, 'kind', 'Tipo', 'en:sponsor_kind', 'select'),
        ]),
        fold(h('summary', null, [h('span', { 'data-o': 'sum' })]), key, [
          h('div', { class: 'form' }, [
            h('div', { class: 'row-2' }, [
              field('sponsors', s, 'quantity', 'Cantidad', 'text:' + L.short, 'text', { hint: 'Vacío = por definir.' }),
              field('sponsors', s, 'status', 'Estado', 'en:sponsor_status', 'select'),
            ]),
            field('sponsors', s, 'conditions', 'Condiciones', 'text:' + L.note, 'textarea', { hint: 'Vacío = por definir.' }),
          ]),
          h('div', { class: 'actions' }, [delBtn('sponsors', s.id, 'Eliminar patrocinio')]),
        ]),
      ]);
    }

    function barItem(l) {
      return h('li', { class: 'item', 'data-item': 'barLines:' + l.id }, [
        field('barLines', l, 'product', 'Producto', 'req:' + L.name, 'text'),
        h('div', { class: 'row-3' }, [
          field('barLines', l, 'units', 'Unidades', 'intOpt:0:' + L.units, 'int', { cls: 'amount' }),
          field('barLines', l, 'salesCents', 'Ventas (USD)', 'moneyOpt', 'money', { cls: 'amount' }),
          field('barLines', l, 'costCents', 'Costos (USD)', 'moneyOpt', 'money', { cls: 'amount' }),
        ]),
        h('p', { class: 'hint', text: 'Vacío = sin dato.' }),
        h('div', { class: 'actions' }, [delBtn('barLines', l.id, 'Eliminar producto')]),
      ]);
    }

    function fill(el, kids) {
      for (const i of qa('[aria-invalid="true"]', el)) invalid.delete(keyOf(i));
      el.textContent = '';
      for (const k of kids) el.append(k);
    }

    function renderBudget() { fill($('budget-list'), state.budget.map(budgetItem)); }
    function renderSponsors() { fill($('sponsor-list'), state.sponsors.map(sponsorItem)); }
    function renderBarLines() { fill($('bar-list'), state.bar.lines.length ? state.bar.lines.map(barItem) : [h('li', { class: 'empty', text: 'Sin productos registrados.' })]); }
    function renderOps() {
      for (const g of Object.keys(M.ENUMS.ops_group)) {
        const items = state.ops.filter(o => o.group === g);
        fill($('ops-' + g), items.length ? items.map(opItem) : [h('li', { class: 'empty', text: 'Sin puntos en este grupo.' })]);
      }
    }
    function renderTasks() {
      const fs = $('f-status').value, fa = $('f-area').value;
      const shown = state.tasks.filter(t => (!fs || t.status === fs) && (!fa || t.area === fa));
      fill($('task-list'), shown.length ? shown.map(taskItem)
        : [h('li', { class: 'empty', text: state.tasks.length ? 'Ninguna tarea coincide con el filtro.' : 'No hay tareas: añade la primera.' })]);
      const done = state.tasks.filter(t => t.status === 'hecho').length;
      setText($('plan-count'), 'Se muestran ' + fi(shown.length) + ' de ' + plural(state.tasks.length, 'tarea', 'tareas') + ' · ' + plural(done, 'hecha', 'hechas') + '.');
      refreshItems();
    }
    function renderAllLists() { renderBudget(); renderTasks(); renderOps(); renderSponsors(); renderBarLines(); }

    function addItem(list, group) {
      const L2 = LISTS[list];
      if (!L2) return;
      const arr = L2.arr();
      if (arr.length >= L2.max) { setText($('msg-' + list), 'Límite de ' + L2.max + ' elementos alcanzado.'); return; }
      const it = M.newItem(list, { group, area: list === 'tasks' ? $('f-area').value : undefined });
      arr.push(it);
      if (list === 'tasks' && $('f-status').value && $('f-status').value !== it.status) $('f-status').value = '';
      openSet.add(list + ':' + it.id);
      L2.render();
      persist();
      renderDerived();
      setText($('msg-' + list), '');
      const first = $(list + '-' + it.id + '-' + L2.first);
      if (first) { first.focus(); first.select(); }
    }

    function delItem(list, id) {
      const L2 = LISTS[list];
      if (!L2) return;
      const arr = L2.arr(), i = arr.findIndex(x => x.id === id);
      if (i < 0) return;
      const name = arr[i].title || arr[i].name || arr[i].product || 'este elemento';
      if (!win.confirm('¿Borrar «' + name + '»? No se puede deshacer, salvo con un respaldo JSON.')) return;
      arr.splice(i, 1);
      openSet.delete(list + ':' + id);
      L2.render();
      persist();
      renderDerived();
      setText($('msg-' + list), '«' + name + '» borrado.');
      const add = doc.querySelector('[data-action="add"][data-l="' + list + '"]');
      if (add) add.focus();
    }

    // ---------- datos: respaldo, importación, reinicios ----------

    function stamp() { return new Date().toISOString().slice(0, 10); }
    function download(text, name, type) {
      const url = URL.createObjectURL(new Blob([text], { type }));
      const a = h('a', { href: url, download: name });
      doc.body.append(a);
      a.click();
      a.remove();
      win.setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    // Copia los datos actuales antes de reemplazarlos: en el navegador y, si no hay espacio, como descarga.
    function keepBackup() {
      memBackup = M.serializeState(state);
      if (!M.backupBeforeReplace(storage, state).ok) download(memBackup, 'sindicato-baba-respaldo-previo-' + stamp() + '.json', 'application/json');
    }

    function replaceState(s) {
      state = s;
      invalid.clear();
      openSet.clear();
      bindStatic();
      renderAllLists();
      persist();
      renderDerived();
      updateRestore();
    }

    // ---------- plataforma compartida (Edge Function `pm`) ----------

    function enCola(fn) { cola = cola.then(fn).catch(e => console.error(e)); return cola; }

    function remoto(body) {
      return win.fetch(PM_URL, { method: 'POST', headers: { apikey: PM_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ clave }, body)),
        signal: win.AbortSignal.timeout && win.AbortSignal.timeout(20000) }) // un pedido colgado no traba la cola
        .then(r => r.json().catch(() => null).then(d => ({ status: r.status, d })), () => ({ status: 0, d: null }));
    }

    // 401 olvida la clave. Sin red, 5xx u otro error: lo local queda y se reintenta en el próximo cambio o al volver a la pestaña.
    function fallo(r) {
      if (r.status === 401) { olvidarClave('La clave de la plataforma no es válida y se olvidó. Escríbela de nuevo.'); return; }
      sync = { ok: false, error: r.status === 0 ? 'sin conexión' : 'error ' + r.status + (r.d && r.d.error ? ': ' + r.d.error : '') };
      renderSave();
    }

    async function leerRemoto() {
      if (!clave) return;
      const k = clave;
      const r = await remoto({ accion: 'leer' });
      if (clave !== k) return; // se olvidó o cambió la clave con el pedido en vuelo: la respuesta ya no aplica
      if (r.status !== 200 || !r.d) return fallo(r);
      // Remoto vacío y datos guardados aquí: se suben con base 0.
      if (r.d.version === 0) { if (base !== 0 && state.savedAt) dirty = true; base = 0; }
      else if (r.d.version !== base) return adoptar(r.d);
      if (dirty) return subir();
      sync = { ok: true, version: base };
      renderSave();
    }

    async function subir() {
      if (!clave) return;
      if (base === null) return leerRemoto();
      if (!dirty) return;
      dirty = false;
      const k = clave;
      const r = await remoto({ accion: 'guardar', base, autor: 'navegador', estado: state });
      if (clave !== k) return; // ídem: no tocar una pestaña que ya se desconectó
      if (r.status === 200 && r.d) { base = r.d.version; sync = { ok: true, version: base }; aviso = ''; renderSave(); return; }
      if (r.status === 409 && r.d) return adoptar(r.d);
      dirty = true;
      fallo(r);
    }

    const canon = s => { const r = M.validateState(Object.assign({}, s, { savedAt: null })); return r.ok ? M.serializeState(r.state) : ''; };

    // Lo remoto reemplaza a lo local; antes, lo local queda como respaldo anterior (salvo que sean iguales).
    // Del cuerpo de `leer` solo se usan version y estado: claves extra (el futuro bloque `ticketera`) no entran al estado.
    // ponytail: un solo respaldo y `base` solo en memoria: al reabrir gana el remoto y un segundo conflicto pisa el respaldo; si Mau edita a diario aquí, guardar `base` en localStorage y respaldos con historial.
    function adoptar(d) {
      const r = M.validateState(d.estado);
      if (!r.ok) { sync = { ok: false, error: 'la versión compartida ' + d.version + ' no es válida' }; renderSave(); return; }
      const distinto = canon(state) !== canon(r.state);
      if (distinto) keepBackup();
      base = d.version;
      replaceState(r.state);
      win.clearTimeout(timer); // replaceState → persist programó subir lo que acaba de bajar
      dirty = false;
      sync = { ok: true, version: base };
      if (distinto) {
        aviso = 'Se cargó la versión ' + d.version + ' de la plataforma compartida, guardada por ' + d.autor + ' (' + hhmm(d.guardado_en) + '). Lo que tenías en este navegador quedó como respaldo anterior.';
        dataMsg(aviso);
      }
      renderSave();
    }

    function renderClave() {
      $('pm-form').hidden = !!clave;
      $('btn-forget').hidden = !clave;
    }

    function olvidarClave(msg) {
      clave = null; base = null; dirty = false; sync = null; aviso = '';
      win.clearTimeout(timer);
      try { storage.removeItem(M.CLAVE_KEY); } catch (e) { /* sin almacenamiento: no había clave guardada */ }
      renderClave();
      renderSave();
      dataMsg(msg);
    }

    function onClave(e) {
      e.preventDefault();
      const v = $('pm-clave').value.trim();
      if (!v) return;
      clave = v;
      base = null;
      try { storage.setItem(M.CLAVE_KEY, v); } catch (err) { /* sin almacenamiento: la clave vale solo en esta pestaña */ }
      $('pm-clave').value = '';
      renderClave();
      dataMsg('Clave guardada en este navegador. El indicador de guardado muestra si quedó sincronizado.');
      enCola(leerRemoto);
    }

    async function onImport(e) {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (f.size > L.importBytes) { dataMsg('No se importó: el archivo supera ' + Math.round(L.importBytes / 1024) + ' KB.'); return; }
      let text;
      try { text = await f.text(); } catch (err) { dataMsg('No se pudo leer el archivo.'); return; }
      const r = M.parseBackup(text);
      if (!r.ok) { dataMsg('No se importó. ' + r.errors.slice(0, 3).join(' ') + (r.errors.length > 3 ? ' (y ' + (r.errors.length - 3) + ' errores más)' : '')); return; }
      const s = r.state;
      if (!win.confirm('¿Reemplazar todos los datos actuales por este respaldo (' + plural(s.budget.length, 'partida', 'partidas') + ', ' + plural(s.tasks.length, 'tarea', 'tareas') + ', ' + plural(s.ops.length, 'punto', 'puntos') + ' de operación)? Los datos actuales se guardarán como respaldo previo.')) { dataMsg('Importación cancelada: no cambió nada.'); return; }
      keepBackup();
      replaceState(s);
      dataMsg('Respaldo importado. Los datos anteriores quedaron como respaldo previo.');
    }

    function restoreBackup() {
      let b = M.readBackup(storage);
      if (!b.ok && memBackup) b = M.parseBackup(memBackup);
      if (!b.ok) { dataMsg('No hay un respaldo anterior en este navegador.'); updateRestore(); return; }
      if (!win.confirm('¿Restaurar el respaldo anterior? Los datos actuales quedarán como respaldo.')) return;
      keepBackup();
      replaceState(b.state);
      dataMsg('Respaldo anterior restaurado. Los datos que tenías quedaron como respaldo.');
    }

    function resetAll() {
      if (!win.confirm('¿Borrar TODOS los datos de este navegador' + (clave ? ' y de la plataforma compartida' : '') + ' (presupuesto, caja, tareas, ventas y operación) y volver a la plantilla? Se guardará una copia para poder restaurarla.')) return;
      keepBackup();
      replaceState(M.defaultState());
      dataMsg('Datos reemplazados por la plantilla. Puedes restaurar la copia anterior.');
    }

    function resetScenario() {
      state = M.resetScenario(state);
      for (const el of qa('[data-k^="scenario."]')) { setValue(el, getPath(el.dataset.k)); setError(el, ''); }
      persist();
      renderDerived();
      setText($('esc-msg'), 'Escenario restablecido. Presupuesto, caja, tareas y operación no cambiaron.');
    }

    function onClick(e) {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      const a = b.getAttribute('data-action');
      if (a === 'add') addItem(b.getAttribute('data-l'), b.getAttribute('data-group') || undefined);
      else if (a === 'del') delItem(b.getAttribute('data-l'), b.getAttribute('data-id'));
      else if (a === 'reset-scenario') resetScenario();
      else if (a === 'reset-all') resetAll();
      else if (a === 'restore-backup') restoreBackup();
      else if (a === 'forget-key') olvidarClave('Clave olvidada: desde ahora se guarda solo en este navegador.');
      else if (a === 'import-json') $('import-file').click();
      else if (a === 'export-json') { download(M.serializeState(state), 'sindicato-baba-respaldo-' + stamp() + '.json', 'application/json'); dataMsg('Respaldo exportado. Guárdalo en un lugar privado: incluye todo lo que anotaste.'); }
      else if (a === 'export-csv') {
        if (Array.from(invalid.values()).some(v => v.fin)) { setText($('csv-msg'), 'Corrige los campos marcados antes de exportar.'); return; }
        download(M.toCSV(state), 'sindicato-baba-escenario-' + stamp() + '.csv', 'text/csv;charset=utf-8');
        setText($('csv-msg'), 'CSV exportado.');
      }
    }

    // ---------- navegación ----------

    function route(focus) {
      let id = '';
      try { id = decodeURIComponent(win.location.hash.slice(1)); } catch (e) { id = ''; }
      let target = /^[a-z0-9-]+$/.test(id) ? $(id) : null;
      let view = target && target.closest('.view');
      if (!view) { view = $('resumen'); target = view; }
      for (const v of qa('.view')) v.hidden = v !== view;
      for (const a of qa('.top nav a')) {
        if (a.getAttribute('href') === '#' + view.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      }
      const h1 = view.querySelector('h1');
      doc.title = (view.id === 'resumen' ? '' : h1.textContent + ' · ') + 'Sindicato Baba';
      renderDerived();
      if (!focus) return;
      if (target === view) { win.scrollTo(0, 0); h1.focus({ preventScroll: true }); }
      else { target.scrollIntoView({ block: 'start' }); if (target.tabIndex < 0 && !/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(target.tagName)) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    }

    // ---------- arranque ----------

    for (const sel of qa('select[data-enum]')) fillSelect(sel, M.ENUMS[sel.getAttribute('data-enum')], sel.getAttribute('data-first'));
    bindStatic();
    renderAllLists();
    renderSave();
    updateRestore();
    doc.addEventListener('input', onInput);
    doc.addEventListener('change', onInput);
    doc.addEventListener('click', onClick);
    doc.addEventListener('toggle', e => {
      const d = e.target;
      const key = d && d.getAttribute && d.getAttribute('data-open');
      if (key) { if (d.open) openSet.add(key); else openSet.delete(key); }
    }, true);
    $('import-file').addEventListener('change', onImport);
    $('pm-form').addEventListener('submit', onClave);
    win.addEventListener('focus', () => { if (clave) enCola(leerRemoto); });
    renderClave();
    if (clave) enCola(leerRemoto);
    win.addEventListener('hashchange', () => route(true));
    if ('ResizeObserver' in win) {
      let raf = 0;
      new win.ResizeObserver(() => { win.cancelAnimationFrame(raf); raf = win.requestAnimationFrame(() => { drawChart(lastChart); }); }).observe($('chart-wrap'));
    }
    route(false);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
