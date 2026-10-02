/* Estado del tablero ↔ URL (enlaces permanentes). */
(function () {
  const DEF = { modo: 'zonificacion', zona: 'toda', base: 'claro', bop: 100, etq: false, predio: null, capas: null, tema: null, cob: 'fcv', vista: null };
  const subs = [];
  RAB.estado = {
    v: Object.assign({}, DEF),
    init(cat, zonas) {
      const q = new URLSearchParams(location.search);
      const modos = cat.modos.map((m) => m.id);
      const ids = new Set(cat.capas.map((c) => c.id));
      const v = this.v;
      if (modos.includes(q.get('modo'))) v.modo = q.get('modo');
      const zs = ['toda'].concat(zonas.zonas.map((z) => z.id));
      if (zs.includes(q.get('zona'))) v.zona = q.get('zona');
      if (['blanco', 'claro', 'color', 'oscuro', 'satelite', 'osm'].includes(q.get('base'))) v.base = q.get('base');
      if (q.has('bop') && isFinite(+q.get('bop'))) v.bop = Math.min(100, Math.max(0, +q.get('bop')));
      if (q.get('etq') === '1') v.etq = true;
      if (q.has('predio')) v.predio = q.get('predio');
      if (['claro', 'oscuro'].includes(q.get('tema'))) v.tema = q.get('tema');
      if (['fcv', 'corp'].includes(q.get('cob'))) v.cob = q.get('cob');
      v.capas = q.has('capas') ? q.get('capas').split(',').filter((c) => ids.has(c)) : this.capasDelModo(cat, v.modo);
      const vis = (q.get('vista') || '').split(',').map(Number);
      if (vis.length === 3 && vis.every((x) => isFinite(x))) v.vista = vis;
      this.cat = cat;
    },
    capasDelModo(cat, modo) { return (cat.modos.find((m) => m.id === modo) || { capas: [] }).capas.slice(); },
    set(p, opts = {}) {
      Object.assign(this.v, p);
      this.escribir();
      if (!opts.silencio) subs.slice().forEach((f) => f(p));
    },
    on(f) { subs.push(f); },
    escribir: RAB.debounce(function () {
      const v = RAB.estado.v, q = new URLSearchParams();
      if (v.modo !== DEF.modo) q.set('modo', v.modo);
      if (v.zona !== DEF.zona) q.set('zona', v.zona);
      if (v.base !== DEF.base) q.set('base', v.base);
      if (v.bop !== DEF.bop) q.set('bop', v.bop);
      if (v.etq) q.set('etq', '1');
      if (v.predio) q.set('predio', v.predio);
      if (v.tema) q.set('tema', v.tema);
      if (v.cob !== DEF.cob) q.set('cob', v.cob);
      const def = RAB.estado.capasDelModo(RAB.estado.cat, v.modo).sort().join(',');
      if (v.capas && v.capas.slice().sort().join(',') !== def) q.set('capas', v.capas.join(','));
      if (v.vista) q.set('vista', v.vista.join(','));
      const s = q.toString();
      try { history.replaceState(null, '', location.pathname + (s ? '?' + s : '')); } catch (e) { /* file:// u otros */ }
    }, 250),
    enlace() { this.escribir(); const q = location.search; return location.origin + location.pathname + q; },
  };
})();
