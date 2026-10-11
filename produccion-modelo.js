// ═══════════════════════════════════════════════
//  Sistema Fën — Producción: de la planilla a la base nueva (fen-produccion)  v0.33.0
//  v0.33.0: la versión real sale de la columna version_sistema (la escribe la aprobación desde Sistema Fën).
//  Arma los documentos desde las hojas que entrega el script de Producción (v2.2.0).
//  Sin costos: la base de las jefas no guarda costos ni precios (el script ya los quita).
//  Función pura (sin red): se puede probar sola.
// ═══════════════════════════════════════════════
export const AREAS = { PAN: 'Panadería', BOL: 'Bollería', PAS: 'Pastelería', CAF: 'Cafetería' };
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const COSTO = /costo|precio|valor|monto|utilidad|margen/i;

const clave = h => String(h || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const texto = v => (v === null || v === undefined ? '' : String(v).trim());
export const num = v => { if (typeof v === 'number') return isFinite(v) ? v : 0; const t = String(v ?? '').trim().replace(/\s/g, ''); if (!t) return 0; const n = Number(/,\d+$/.test(t) && !/\.\d{3}/.test(t) ? t.replace(',', '.') : t.replace(/,/g, '')); return isFinite(n) ? n : 0; };
const numONull = v => (v === '' || v === null || v === undefined ? null : num(v));
const json = (t, def) => { if (Array.isArray(t)) return t; try { const v = JSON.parse(String(t || '')); return v ?? def; } catch (e) { return def; } };
const sinCostos = o => { if (Array.isArray(o)) return o.map(sinCostos); if (o && typeof o === 'object') { const r = {}; Object.entries(o).forEach(([k, v]) => { if (!COSTO.test(k)) r[k] = sinCostos(v); }); return r; } return o; };
const siNo = v => /^(si|sí|true|1)$/i.test(texto(v));

// filas de una hoja { c: encabezados, f: [[n° de fila, ...valores]] } → objetos con claves normalizadas
export function filas(h) {
  if (!h) return [];
  const c = h.c.map(clave);
  return h.f.map(r => { const o = { _fila: r[0] }; c.forEach((k, i) => { if (k && !(k in o)) o[k] = r[i + 1]; }); return o; });
}
const AAAAMMDD = /^\d{4}-\d{2}-\d{2}$/;
const lunesDe = t => { const d = new Date(t + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function lunesDeSemanaIso(id) {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(texto(id));
  if (!m) return '';
  const e4 = new Date(Number(m[1]), 0, 4, 12), l = new Date(e4); l.setDate(e4.getDate() - ((e4.getDay() + 6) % 7) + (Number(m[2]) - 1) * 7);
  return `${l.getFullYear()}-${String(l.getMonth() + 1).padStart(2, '0')}-${String(l.getDate()).padStart(2, '0')}`;
}
// La versión de la app antigua crecía como texto ("1", "11", "111"): cuenta las veces
const version = v => { const t = texto(v); if (/^1{2,}$/.test(t)) return t.length; const n = num(t); return n > 0 ? Math.round(n) : 1; };

export function armar(hojas, personasAreas) {
  const avisos = [], docs = { recetas: {}, mps: {}, planes: {}, config: {}, personas: {} };
  const aviso = (hoja, fila, t) => avisos.push({ hoja, fila, texto: t });

  // Materias primas (sin costos)
  const mps = filas(hojas.MP_maestro);
  mps.forEach(r => {
    const id = texto(r.id_mp); if (!id) { aviso('MP_maestro', r._fila, 'Fila sin ID_MP: no se copia.'); return; }
    if (docs.mps[id]) { aviso('MP_maestro', r._fila, `ID ${id} repetido: queda la primera fila.`); return; }
    docs.mps[id] = {
      nombre: texto(r.nombre), categoria: texto(r.categoria), tipo: texto(r.tipo), unidad: texto(r.unidad_compra) || 'kg',
      estado: texto(r.estado) || 'activa', areas: texto(r.areas_habilitadas).split(',').map(x => x.trim()).filter(Boolean),
      recetaOrigen: texto(r.receta_id_origen), reemplazadaPor: texto(r.reemplazada_por), critica: siNo(r.es_critica), stockSeguridad: num(r.stock_seguridad),
      solicitadaPor: texto(r.solicitada_por), origen: { hoja: 'MP_maestro', fila: r._fila }
    };
  });

  // Recetas de cada área
  Object.keys(AREAS).forEach(area => {
    const hoja = area + '_recetas';
    filas(hojas[hoja]).forEach(r => {
      const id = texto(r.id_receta); if (!id) { aviso(hoja, r._fila, 'Fila sin ID_receta: no se copia.'); return; }
      if (docs.recetas[id]) { aviso(hoja, r._fila, `ID ${id} repetido: queda la primera fila.`); return; }
      const ings = json(r.ingredientes_json, []);
      if (!Array.isArray(ings)) aviso(hoja, r._fila, `${texto(r.nombre)}: los ingredientes no se pudieron leer.`);
      const ingredientes = (Array.isArray(ings) ? ings : []).map(i => {
        const x = sinCostos(i || {});
        const o = { ...x, id: texto(x.id), nombre: texto(x.nombre), gramos: num(x.gramos), unidades: numONull(x.unidades), pct: numONull(x.pct) };
        if (x.unidad_receta) { o.unidad = texto(x.unidad_receta); delete o.unidad_receta; }
        return o;
      });
      const nombre = texto(r.nombre);
      const tipo = texto(r.tipo_receta) || 'receta';
      // Si es sub receta: su ID en materias primas (SR…), por la receta de origen o por el nombre
      const mp = Object.entries(docs.mps).find(([, m]) => m.recetaOrigen === id)
        || (tipo === 'sub_receta' ? Object.entries(docs.mps).find(([mid, m]) => clave(m.nombre) === clave(nombre) && (m.tipo === 'sub_receta' || /^SR/.test(mid))) : null);
      const pasos = json(r.pasos_json, []);
      docs.recetas[id] = {
        area, nombre, estado: texto(r.estado) || 'borrador', tipo,
        porciones: num(r.porciones_base) || 1, unidad: texto(r.porciones_base_unidad) === 'g' ? 'g' : 'un',
        harinaTotal: num(r.peso_harina_total_g), ingredientes,
        insumos: sinCostos(json(r.insumos_json, [])) || [],
        pasos: Array.isArray(pasos) ? pasos.map(p => texto(typeof p === 'object' && p ? p.texto : p)).filter(Boolean) : [],
        procedimiento: texto(r.observaciones_procedimiento), notas: texto(r.sistematizacion_notas),
        clasificacion: texto(r.tipo_preparacion), pesoUnidad: num(r.peso_unidad_mb_g), planificable: texto(r.planificable_directo) !== 'no',
        vendeDirecto: texto(r.vende_directo) !== 'no', varianteDe: texto(r.variante_de_id), seCongela: siNo(r.se_congela),
        unidadesPorCaja: num(r.unidades_por_caja), version: num(r.version_sistema) > 0 ? Math.round(num(r.version_sistema)) : version(r.version), aprobadaPor: texto(r.aprobada_por),
        aprobadaEn: texto(r.fecha_consolidacion), mpId: mp ? mp[0] : '', origen: { hoja, fila: r._fila }
      };
      if (!ingredientes.length) aviso(hoja, r._fila, `${nombre}: sin ingredientes.`);
    });
  });
  // Ingredientes que no existen en materias primas ni como receta (quedan igual, se avisa)
  Object.entries(docs.recetas).forEach(([id, r]) => r.ingredientes.forEach(i => {
    if (i.id && !docs.mps[i.id] && !docs.recetas[i.id]) aviso(r.origen.hoja, r.origen.fila, `${r.nombre}: el ingrediente "${i.nombre}" (${i.id}) no está en MP_maestro.`);
  }));

  // Planes semanales: una fila por receta y semana → planes/{AREA}_{lunes}
  let celdas = { PAN: 0, BOL: 0, PAS: 0 }, unidades = { PAN: 0, BOL: 0, PAS: 0 };
  ['PAN', 'BOL', 'PAS'].forEach(area => {
    const hoja = area + '_planificacion';
    filas(hojas[hoja]).forEach(r => {
      const rid = texto(r.id_receta); if (!rid) return;
      const fi = texto(r.fecha_inicio).slice(0, 10);
      const lunes = AAAAMMDD.test(fi) ? lunesDe(fi) : lunesDeSemanaIso(r.semana_id);
      if (!lunes) { aviso(hoja, r._fila, `Semana "${texto(r.semana_id)}" sin fecha: no se copia.`); return; }
      const id = `${area}_${lunes}`;
      const p = docs.planes[id] || (docs.planes[id] = { area, lunes, semanaIso: texto(r.semana_id), filas: {}, nombres: {}, origen: 'planilla' });
      const dias = {};
      DIAS.forEach((d, i) => { const v = num(r[d]); if (v) { dias['d' + i] = v; celdas[area]++; unidades[area] += v; } });
      if (p.filas[rid]) { aviso(hoja, r._fila, `${texto(r.nombre_receta) || rid} aparece dos veces en la semana ${texto(r.semana_id)}: se suman.`); DIAS.forEach((_, i) => { const k = 'd' + i; if (dias[k]) p.filas[rid][k] = (p.filas[rid][k] || 0) + dias[k]; }); }
      else p.filas[rid] = dias;
      p.nombres[rid] = texto(r.nombre_receta) || (docs.recetas[rid] || {}).nombre || rid;
    });
  });

  // Configuración (bloque "subrecetas" de la hoja Config) → config/PAN, config/BOL, config/CAF
  const cfgFilas = filas(hojas.Config);
  const sub = cfgFilas.find(r => clave(r.parametro || r.clave) === 'subrecetas');
  const c = sub ? json(sub.valor, null) : null;
  if (c && typeof c === 'object') {
    docs.config.PAN = { mm_blanca: c.mm_blanca || null, mm_integral: c.mm_integral || null, poolish: c.poolish || null, pie_mm: c.pie_mm || null, origen: 'planilla' };
    if (c.bol) { const { stock_masas, stock_productos, plan_masas, ...b } = c.bol; docs.config.BOL = { ...b, origen: 'planilla' }; }
    if (c.caf) { const { stock, ...f } = c.caf; docs.config.CAF = { ...f, origen: 'planilla' }; }
  } else aviso('Config', null, 'No se encontró la configuración de masa madre y poolish ("subrecetas"): se usan los valores por defecto.');
  Object.keys(AREAS).forEach(a => { if (!docs.config[a]) docs.config[a] = { origen: 'planilla' }; });

  // Personas que entran con PIN, por área (de Asistencia; sin PIN)
  (personasAreas || []).forEach(a => (a.personas || []).forEach(p => {
    const id = texto(p.email).toLowerCase(); if (!id) return;
    const d = docs.personas[id] || (docs.personas[id] = { nombre: texto(p.nombre) || id, email: id, areas: [], activa: true });
    if (!d.areas.includes(a.codigo)) d.areas.push(a.codigo);
  }));
  if (!personasAreas) aviso('Asistencia', null, 'No se pudo leer quién entra a cada área (Asistencia no respondió). Las personas no se copian esta vez.');

  const porArea = {}; Object.keys(AREAS).forEach(a => { porArea[a] = Object.values(docs.recetas).filter(r => r.area === a).length; });
  return {
    docs, avisos,
    resumen: { recetas: Object.keys(docs.recetas).length, recetasPorArea: porArea, mps: Object.keys(docs.mps).length, planes: Object.keys(docs.planes).length, celdas, unidades, personas: Object.keys(docs.personas).length }
  };
}
