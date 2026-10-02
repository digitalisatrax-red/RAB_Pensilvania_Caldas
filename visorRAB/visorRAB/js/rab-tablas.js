/* Tablas filtrables con exportación CSV: especies y predios. */
(function () {
  const T = RAB.tablas = {};
  const F = RAB.fmt;
  const RANGO = { CR: 6, EN: 5, VU: 4, NT: 3, LC: 2, DD: 1, NE: 0 };
  const CORTO = { conservacion: 'Conservación', restauracion: 'Restauración', amortiguacion: 'Amortiguación', uso_intensivo: 'Uso intensivo', fuera: 'Fuera de zonas', sin_ubicacion: 'Sin ubicar' };
  let filas = [], visibles = 80;

  function cat(e) {
    const a = RANGO[e.u] ?? -1, b = RANGO[e.n] ?? -1;
    return a >= b ? e.u : e.n;
  }
  /* Agrega los registros de la zona elegida por especie. */
  T.agregarEspecies = function () {
    const bio = RAB.datos.bio, z = RAB.estado.v.zona, mapa = new Map();
    bio.registros.forEach((r) => {
      if (!r[1] || (z !== 'toda' && r[9] !== z)) return;
      let x = mapa.get(r[1]);
      if (!x) { const e = bio.especies[r[1]]; x = { sp: r[1], e, grupo: bio.grupos[e.g], fam: e.f, nc: e.nc, n: 0, zonas: new Set() }; mapa.set(r[1], x); }
      x.n += 1; x.zonas.add(r[9]);
    });
    return [...mapa.values()].map((x) => ({ ...x, cat: cat(x.e), amen: x.e.a, zonasTxt: [...x.zonas].map((k) => CORTO[k] || k).join(', ') }))
      .sort((a, b) => (b.amen - a.amen) || (b.n - a.n) || a.sp.localeCompare(b.sp));
  };
  function filtradas() {
    const q = RAB.norm(RAB.$('espBuscar').value), c = RAB.$('espCat').value;
    return filas.filter((f) => {
      if (q && !RAB.norm(f.sp + ' ' + (f.nc || '') + ' ' + (f.fam || '')).includes(q)) return false;
      if (c === 'ALL') return true;
      if (c === 'AMEN') return f.amen;
      return f.e.u === c || f.e.n === c;
    });
  }
  const chip = (e) => {
    const c = cat(e);
    return c ? `<span class="chip ${c.toLowerCase()}" title="UICN: ${RAB.esc(e.u || '—')} · Nacional: ${RAB.esc(e.n || '—')}">${c}</span>` : '—';
  };
  T.especies = function () {
    if (!RAB.datos.bio) return;
    filas = T.agregarEspecies();
    visibles = 80; T.pintarEspecies();
  };
  T.pintarEspecies = function () {
    const f = filtradas(), cuerpo = RAB.$('espCuerpo');
    RAB.$('espCuenta').textContent = `${F.n(f.length)} de ${F.n(filas.length)} taxones · ${RAB.datos.nombreZona(RAB.estado.v.zona)}`;
    if (!f.length) { cuerpo.innerHTML = '<tr><td colspan="6" class="vacio">Sin registros que coincidan en esta zona.</td></tr>'; RAB.$('espMas').hidden = true; return; }
    cuerpo.innerHTML = f.slice(0, visibles).map((x) => `<tr><td>${RAB.esc(x.grupo)}</td><td><i>${RAB.esc(x.sp)}</i><br><small>${RAB.esc(x.nc || '')}</small></td><td class="num">${F.n(x.n)}</td><td>${chip(x.e)}</td><td>${RAB.esc(x.zonasTxt)}</td></tr>`).join('');
    RAB.$('espMas').hidden = f.length <= visibles;
  };
  T.csvEspecies = function () {
    const f = filtradas();
    RAB.descargar('especies_rab.csv', RAB.csv(['grupo', 'familia', 'especie', 'nombre_comun', 'registros', 'categoria_uicn', 'categoria_nacional', 'zonas'],
      f.map((x) => [x.grupo, x.fam, x.sp, x.nc, x.n, x.e.u, x.e.n, x.zonasTxt])), 'text/csv;charset=utf-8');
    RAB.aviso(`CSV con ${f.length} taxones (filtros aplicados).`);
  };

  const bosque = (p) => (p.cobertura_ha.bosque_avanzado || 0) + (p.cobertura_ha.bosque_joven || 0);
  T.predios = function () {
    const P = RAB.datos.predios, r = P.resumen;
    RAB.$('predSub').textContent = `${r.adquiridos} adquiridos (${F.n(r.ha_adquiridas_sig, 1)} ha SIG) · ${r.por_adquirir} listos para compra (${F.n(r.ha_por_adquirir_sig, 1)} ha)`;
    RAB.$('predCuerpo').innerHTML = P.predios.map((p) => `<tr><td>${RAB.esc(p.nombre_predio)}</td><td>${RAB.esc(p.estado)}</td><td class="num">${p.area_sig_ha === null ? '—' : F.n(p.area_sig_ha, 2)}</td><td class="num">${p.cobertura_ha.bosque_avanzado || p.cobertura_ha.bosque_joven ? F.n(bosque(p), 2) : '—'}</td><td class="num">${p.cobertura_ha.pastizal ? F.n(p.cobertura_ha.pastizal, 2) : '—'}</td></tr>`).join('');
    RAB.$('predNota').textContent = `${r.adquiridos_sin_area_sig} predios adquiridos no tienen área SIG en la base (solo área de escritura). La base predial no tiene geometría: esta tabla no cambia con la zona.`;
  };
  T.csvPredios = function () {
    const P = RAB.datos.predios.predios;
    RAB.descargar('predios_rab.csv', RAB.csv(['predio', 'estado', 'area_sig_ha', 'area_escritura_ha', 'bosque_avanzado_ha', 'bosque_joven_ha', 'matorral_ha', 'plantacion_pino_ha', 'pastizal_ha'],
      P.map((p) => [p.nombre_predio, p.estado, p.area_sig_ha, p.area_escritura_ha, p.cobertura_ha.bosque_avanzado, p.cobertura_ha.bosque_joven, p.cobertura_ha.matorral, p.cobertura_ha.plantacion_pino, p.cobertura_ha.pastizal])), 'text/csv;charset=utf-8');
  };
  T.iniciar = function () {
    RAB.$('espBuscar').oninput = RAB.debounce(() => { visibles = 80; T.pintarEspecies(); }, 120);
    RAB.$('espCat').onchange = () => { visibles = 80; T.pintarEspecies(); };
    RAB.$('espMas').onclick = () => { visibles += 80; T.pintarEspecies(); };
    RAB.$('espCsv').onclick = T.csvEspecies;
    RAB.$('predCsv').onclick = T.csvPredios;
  };
})();
