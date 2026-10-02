/* Gráficos HTML/CSS accesibles: anillo de cobertura y biodiversidad (grupos y esfuerzo por año). */
(function () {
  const G = RAB.graficos = {};
  const F = RAB.fmt;
  const COL = { natural: '#295d3e', mixta: '#8fb78c', transformada: '#d9a441', plantacion: '#7a5230', otra: '#9aa59d' };
  const COL_TEMA = (c) => COL[c] || '#9aa59d';

  G.cobertura = function () {
    const d = RAB.datos, v = RAB.estado.v, z = v.zona, m = d.metricas();
    const pd = RAB.predioSel && RAB.predioSel();
    const fcvOk = z === 'toda';
    RAB.$('cobFcv').disabled = !fcvOk || !!pd; RAB.$('cobCorp').disabled = !!pd;
    const fuente = pd ? 'predio' : fcvOk ? v.cob : 'corp';
    RAB.$('cobFcv').setAttribute('aria-pressed', String(fuente === 'fcv' || fuente === 'predio'));
    RAB.$('cobCorp').setAttribute('aria-pressed', String(fuente === 'corp'));
    const NOM = {};
    d.zonas.cobertura_fcv.clases.forEach((x) => { NOM[x.nombre] = x.clase; });
    let items, pct, nota, fuenteTxt, sub;
    if (fuente === 'predio') {
      const ETQ = { bosque_avanzado: 'Bosque avanzado', bosque_joven: 'Bosque joven', matorral: 'Matorral', pastizal: 'Pastizal', plantacion_pino: 'Bosque de pino', vias: 'Vías', sin_vegetacion: 'Zonas sin vegetación', drenajes: 'Drenajes' };
      items = Object.entries(pd.cobertura_ha).filter(([, ha]) => ha > 0).map(([k, ha]) => ({ n: ETQ[k] || k, ha, clase: NOM[ETQ[k]] || 'otra' }));
      pct = RAB.predioNatural(pd) ?? 0;
      sub = `Predio: ${pd.nombre_predio}`;
      nota = items.length ? `Natural = bosque avanzado + bosque joven + matorral, sobre ${F.n(items.reduce((a, i) => a + i.ha, 0), 1)} ha con cobertura declarada para este predio.` : 'Este predio no tiene cobertura declarada en la base predial.';
      fuenteTxt = 'Fuente: base predial de FCV (coberturas por predio).';
    } else if (fuente === 'fcv') {
      const c = d.zonas.cobertura_fcv;
      items = c.clases.map((x) => ({ n: x.nombre, ha: x.ha, clase: x.clase }));
      pct = c.natural_pct;
      sub = `FCV · ${c.predios_con_dato} de ${c.predios_adquiridos} predios con dato`;
      nota = `Natural = bosque avanzado + bosque joven + matorral, sobre ${F.n(c.ha_total, 1)} ha con cobertura declarada. No es filtrable por zona.`;
      fuenteTxt = 'Fuente: base predial de FCV (coberturas por predio adquirido).';
    } else {
      items = m.cobertura.map((x) => ({ n: x.nombre, ha: x.ha, clase: x.clase }));
      pct = m.cobertura_natural_pct;
      sub = `Corpocaldas · ${RAB.datos.nombreZona(z)}`;
      nota = `Natural = bosque denso alto, arbustal denso y vegetación secundaria (${F.n(pct, 1)} %). Si se suma el bosque fragmentado y el mosaico con espacios naturales: ${F.n(m.cobertura_natural_mixta_pct, 1)} %. La escala de esta capa es más gruesa que la de FCV.`;
      fuenteTxt = 'Fuente: capa de coberturas y suelos de Corpocaldas, intersectada con la zona. Clasificación natural / mixta / transformada: del tablero.';
    }
    RAB.$('cobSub').textContent = sub; RAB.$('cobNota').textContent = nota; RAB.$('cobFuente').textContent = fuenteTxt;
    RAB.$('cobPct').textContent = F.n(pct, 1) + ' %';
    const tot = items.reduce((s, i) => s + i.ha, 0) || 1;
    let acc = 0;
    const seg = items.map((i) => { const a = acc; acc += 100 * i.ha / tot; return `${COL_TEMA(i.clase)} ${a.toFixed(2)}% ${acc.toFixed(2)}%`; });
    const an = RAB.$('cobAnillo');
    an.style.background = `conic-gradient(${seg.join(',')})`;
    an.setAttribute('aria-label', `Cobertura natural ${F.n(pct, 1)} por ciento. ` + items.map((i) => `${i.n} ${F.n(i.ha, 1)} hectáreas`).join('; '));
    RAB.$('cobLeyenda').innerHTML = items.map((i) => `<li><i class="sw" style="background:${COL_TEMA(i.clase)}"></i><span>${RAB.esc(i.n)}</span><b>${F.n(i.ha, 1)} ha</b></li>`).join('');
  };

  let anio = null, timer = null, anios = [];
  function registros() {
    const z = RAB.estado.v.zona, g = RAB.$('bioGrupoSel').value;
    return RAB.datos.bio.registros.filter((r) => (z === 'toda' || r[9] === z) && (g === 'todos' || r[0] === g));
  }
  G.bio = function () {
    const d = RAB.datos, bio = d.bio, z = RAB.estado.v.zona, m = d.metricas().biodiversidad;
    const sel = RAB.$('bioGrupoSel');
    if (sel.options.length === 1) Object.entries(bio.grupos).forEach(([k, n]) => sel.add(new Option(n, k)));
    RAB.$('bioSub').textContent = `${F.n(m.registros)} registros · ${F.n(m.especies)} especies · ${RAB.datos.nombreZona(z)}`;
    RAB.barras(RAB.$('bioGrupos'), Object.entries(bio.grupos).map(([k, n]) => ({
      et: n, v: m.por_grupo[k].registros, sub: `${F.n(m.por_grupo[k].especies)} especies · ${F.n(m.por_grupo[k].amenazadas)} amenazadas`,
    })), (v) => F.n(v));
    const rs = registros();
    const ys = [...new Set(rs.map((r) => r[2]).filter(Boolean))].sort();
    anios = ys.length ? ys : [];
    const sl = RAB.$('bioSlider');
    if (anios.length) { sl.min = anios[0]; sl.max = anios[anios.length - 1]; if (anio === null || anio < anios[0] || anio > anios[anios.length - 1]) anio = anios[anios.length - 1]; sl.value = anio; }
    sl.disabled = !anios.length;
    G.anios();
  };
  G.anios = function () {
    const rs = registros(), cont = RAB.$('bioAnios');
    if (!anios.length) { cont.innerHTML = '<div class="vacio">Sin registros con año en esta selección.</div>'; RAB.$('bioAnio').textContent = '—'; RAB.$('bioDetalle').textContent = ''; return; }
    const lo = anios[0], hi = anios[anios.length - 1], lista = [];
    for (let y = lo; y <= hi; y++) lista.push(y);
    const n = (y) => rs.filter((r) => r[2] === y).length;
    const max = Math.max(...lista.map(n)) || 1;
    cont.innerHTML = lista.map((y) => `<div class="col${y === anio ? ' on' : ''}"><em>${F.n(n(y))}</em><span style="height:${Math.max(2, 100 * n(y) / max)}%"></span>${y}</div>`).join('');
    cont.setAttribute('aria-label', 'Registros por año: ' + lista.map((y) => `${y}: ${n(y)}`).join(', '));
    const ry = rs.filter((r) => r[2] === anio);
    const jornadas = new Set(ry.map((r) => r[3]).filter(Boolean)).size;
    const antes = new Set(rs.filter((r) => r[2] < anio && r[1]).map((r) => r[1]));
    const delAnio = new Set(ry.filter((r) => r[1]).map((r) => r[1]));
    const nuevas = [...delAnio].filter((e) => !antes.has(e)).length;
    const acum = new Set(rs.filter((r) => r[2] <= anio && r[1]).map((r) => r[1])).size;
    RAB.$('bioAnio').textContent = anio;
    RAB.$('bioDetalle').innerHTML = `<b>${anio}</b>: ${F.n(ry.length)} registros · ${F.n(jornadas)} jornadas con fecha · ${F.n(delAnio.size)} especies (${F.n(nuevas)} nuevas) · acumulado ${F.n(acum)}.`;
  };
  G.iniciarBio = function () {
    RAB.$('bioGrupoSel').onchange = () => G.bio();
    RAB.$('bioSlider').oninput = (e) => { anio = +e.target.value; G.anios(); };
    RAB.$('bioPlay').onclick = (e) => {
      const b = e.currentTarget;
      if (timer) { clearInterval(timer); timer = null; b.textContent = '▶'; return; }
      if (!anios.length) return;
      if (anio >= anios[anios.length - 1]) anio = anios[0] - 1;
      b.textContent = '❚❚';
      timer = setInterval(() => {
        anio += 1; RAB.$('bioSlider').value = anio; G.anios();
        if (anio >= anios[anios.length - 1]) { clearInterval(timer); timer = null; b.textContent = '▶'; }
      }, 900);
    };
  };
})();
