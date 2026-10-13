// ═══════════════════════════════════════════════
//  Buscador para listas de materias primas e insumos  v1.0.0
//  (misma copia en fen-cocina y en Sistema Fën; pedido de Emmanuel, 12-oct)
//
//  conBuscador(select): pone arriba del <select> un campo "Escribe para buscar…". Al escribir, la lista
//  queda solo con lo que coincide (sin importar tildes ni mayúsculas, en cualquier parte del nombre,
//  varias palabras en cualquier orden), se elige la primera y se avisa con 'change'. Si no hay nada:
//  "Sin resultados" y la lista vuelve a como estaba antes de escribir. Escape o borrar = vuelve la lista completa.
//  El <select> sigue mandando: el código que lee select.value no cambia. Las opciones con valor ""
//  ("Elige…", "(no descuenta)") se quedan siempre. Se puede llamar varias veces (data-buscador).
// ═══════════════════════════════════════════════

// Sin tildes, minúsculas y espacios simples
export const normalizar = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// ¿El nombre tiene todas las palabras de la búsqueda (en cualquier orden y parte)? Búsqueda vacía = sí
export function coincide(nombre, busqueda) {
  const n = normalizar(nombre), palabras = normalizar(busqueda).split(' ').filter(Boolean);
  return palabras.every(p => n.includes(p));
}

// De una lista [{ valor, texto }], las que coinciden (las de valor "" siempre quedan)
export const filtrar = (opciones, busqueda) => opciones.filter(o => o.valor === '' || coincide(o.texto, busqueda));

let cuenta = 0;
const LUPA = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';

export function conBuscador(select) {
  if (!select || select.tagName !== 'SELECT' || select.dataset.buscador === '1') return null;
  select.dataset.buscador = '1';
  const doc = select.ownerDocument;
  const todas = [...select.options].map(o => ({ valor: o.value, texto: o.textContent, disabled: o.disabled }));
  const base = select.id || ('buscador-' + (++cuenta));
  const caja = doc.createElement('div');
  caja.className = 'buscador';
  const etq = select.labels && select.labels[0] ? select.labels[0].textContent.trim() : (select.getAttribute('aria-label') || 'la lista');
  caja.innerHTML = `<label class="sr"></label><span class="buscador-ic">${LUPA}</span><input type="search" placeholder="Escribe para buscar…" autocomplete="off" spellcheck="false"><span class="buscador-msg" role="status" aria-live="polite"></span>`;
  const [lab, inp, ms] = [caja.querySelector('label'), caja.querySelector('input'), caja.querySelector('.buscador-msg')];
  lab.textContent = 'Buscar: ' + etq; lab.htmlFor = base + '-buscar';
  inp.id = base + '-buscar'; ms.id = base + '-buscar-msg';
  inp.setAttribute('aria-controls', base); inp.setAttribute('aria-describedby', ms.id);
  if (!select.id) select.id = base;
  select.parentNode.insertBefore(caja, select);
  const input = inp, msg = ms;

  const pintar = lista => {
    const actual = select.value;
    select.textContent = '';
    lista.forEach(o => { const op = doc.createElement('option'); op.value = o.valor; op.textContent = o.texto; op.disabled = !!o.disabled; select.appendChild(op); });
    if (lista.some(o => o.valor === actual)) select.value = actual;
  };
  const elegir = valor => { if (select.value === valor) return; select.value = valor; select.dispatchEvent(new Event('change', { bubbles: true })); };
  let antes = null;   // lo elegido antes de empezar a escribir: si no hay resultados, vuelve a eso
  const aplicar = () => {
    const q = input.value;
    if (!normalizar(q)) { pintar(todas); msg.textContent = ''; input.removeAttribute('aria-invalid'); antes = null; return; }
    if (antes === null) antes = select.value;
    const vis = filtrar(todas, q), reales = vis.filter(o => o.valor !== '' && !o.disabled);
    if (!reales.length) { pintar(todas); elegir(antes); msg.textContent = 'Sin resultados'; input.setAttribute('aria-invalid', 'true'); return; }
    pintar(vis);
    msg.textContent = reales.length === 1 ? '1 resultado' : reales.length + ' resultados';
    input.removeAttribute('aria-invalid');
    elegir(reales[0].valor);
  };
  input.addEventListener('input', ev => { ev.stopPropagation(); aplicar(); });
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && input.value) { ev.preventDefault(); ev.stopPropagation(); input.value = ''; aplicar(); }
    else if (ev.key === 'Enter') { ev.preventDefault(); select.focus(); }
    else if (ev.key === 'ArrowDown') { ev.preventDefault(); select.focus(); }
  });
  return { input, aplicar };
}
