/* Tarjetas que se recalculan desde data/zonas.json: KPIs, zonas, alertas, riesgos y agua. */
(function () {
  const K = RAB.kpis = {};
  const F = RAB.fmt;

  K.kpis = function () {
    const d = RAB.datos, z = RAB.estado.v.zona, m = d.metricas(z), b = m.biodiversidad;
    const nom = d.nombreZona(z);
    const prot = z === 'toda' ? d.zonas.predios.ha_adquiridas_sig : m.area_ha;
    const pr = d.zonas.predios, protNota = z === 'toda' ? `Suma SIG de ${pr.adquiridos - pr.adquiridos_sin_area_sig} de ${pr.adquiridos} predios adquiridos` : 'Zona dentro de predios adquiridos';
    const k = [
      ['◈', nom, 'Zona seleccionada', 'kpi-nombre'],
      ['▧', F.n(m.area_ha, 1), 'Superficie · ha'],
      ['♧', F.n(prot, 1), 'Bajo protección predial · ha<br>' + protNota],
      ['✦', F.n(b.especies), 'Especies registradas<br>' + F.n(b.registros) + ' registros'],
      ['⚠', F.n(b.amenazadas), 'Especies amenazadas VU/EN/CR'],
      ['◉', F.n(m.riesgos_total), 'Puntos de riesgo' + (z === 'toda' ? '<br>incluye entorno inmediato' : '<br>dentro de la zona')],
    ];
    RAB.$('kpis').innerHTML = k.map(([ic, v, et, cl]) => `<div class="kpi"><div class="kpi-icon" aria-hidden="true">${ic}</div><div><strong class="${cl || ''}">${RAB.esc(v)}</strong><small>${et}</small></div></div>`).join('');
    RAB.$('encArea').textContent = F.n(d.zonas.reserva.area_ha, 1) + ' ha';
  };

  K.zonas = function () {
    const d = RAB.datos, sel = RAB.estado.v.zona, total = d.zonas.reserva.area_ha;
    const item = (id, nombre, ha, color) => `<button type="button" class="zona-item${sel === id ? ' activa' : ''}" data-zona="${id}" aria-pressed="${sel === id}">
      <span class="nombre">${color ? `<i class="sw" style="background:${color}"></i>` : ''}${RAB.esc(nombre)}</span><b>${F.n(ha, 1)} ha</b>
      <span class="barra-fondo"><span style="width:${Math.max(1.5, 100 * ha / total).toFixed(1)}%;${color ? 'background:' + color : ''}"></span></span></button>`;
    RAB.$('zonaLista').innerHTML = item('toda', 'Toda la reserva', total, '') + d.zonas.zonas.map((z) => item(z.id, z.nombre, z.area_ha, z.color)).join('');
    RAB.$('zonaLista').querySelectorAll('button').forEach((b) => { b.onclick = () => RAB.estado.set({ zona: b.dataset.zona }); });
  };

  K.alertas = function () {
    const d = RAB.datos, z = RAB.estado.v.zona;
    let lista = d.zonas.alertas;
    if (z !== 'toda') lista = lista.filter((a) => a.zona === z);
    const col = (t) => (d.cat.capas.find((c) => c.riesgo === t) || { simbologia: { color: '#555' } }).simbologia.color;
    const el = RAB.$('alertaLista');
    if (!lista.length) { el.innerHTML = '<div class="vacio">Sin registros de riesgo en esta zona.</div>'; return; }
    el.innerHTML = lista.slice(0, 60).map((a, i) => `<button type="button" class="alert-item" data-i="${i}">
      <span class="pt" style="background:${col(a.tipo)}"></span><span>${RAB.esc(a.etiqueta)}${a.n > 1 ? ` ×${a.n}` : ''}<small>${RAB.esc(d.nombreZona(a.zona))}</small></span><b>${a.dist_conservacion_m === 0 ? 'dentro' : F.n(a.dist_conservacion_m) + ' m'}</b></button>`).join('');
    el.querySelectorAll('button').forEach((b) => { b.onclick = () => { const a = lista[+b.dataset.i]; RAB.mapa.volarA([a.lon, a.lat], 16); }; });
  };

  function barras(ul, items, formato) {
    if (!items.length) { ul.innerHTML = '<li class="vacio">Sin registros en esta zona.</li>'; return; }
    const max = Math.max(...items.map((i) => i.v)) || 1;
    ul.innerHTML = items.map((i) => `<li><span class="et">${RAB.esc(i.et)}${i.sub ? `<small>${RAB.esc(i.sub)}</small>` : ''}</span><span class="tr"><span style="width:${(100 * i.v / max).toFixed(1)}%;${i.color ? 'background:' + i.color : ''}"></span></span><b>${formato(i.v)}</b></li>`).join('');
  }
  RAB.barras = barras;

  K.riesgos = function () {
    const d = RAB.datos, m = d.metricas(), z = RAB.estado.v.zona;
    const items = Object.entries(m.riesgos).filter(([, n]) => n > 0).map(([t, n]) => ({
      et: d.zonas.etiquetas_riesgo[t], v: n, color: (d.cat.capas.find((c) => c.riesgo === t) || {}).simbologia?.color,
      sub: z === 'toda' && m.riesgos_entorno ? `${m.riesgos_entorno[t]} en el entorno` : '',
    })).sort((a, b) => b.v - a.v);
    RAB.$('riesgoSub').textContent = `${F.n(m.riesgos_total)} puntos · ${RAB.datos.nombreZona(z)}`;
    barras(RAB.$('riesgoBarras'), items, (v) => F.n(v));
  };

  K.agua = function () {
    const m = RAB.datos.metricas();
    RAB.$('aguaSub').textContent = `Red hídrica: ${F.n(m.red_hidrica_km, 2)} km · Vías y caminos: ${F.n(m.vias_km, 2)} km`;
    barras(RAB.$('aguaBarras'), m.microcuencas.map((x) => ({ et: x.nombre, v: x.ha })), (v) => F.n(v, 1) + ' ha');
  };

  K.zonaExtra = function () {
    const m = RAB.datos.metricas();
    barras(RAB.$('zonaUso'), m.uso_suelo.map((x) => ({ et: x.nombre, v: x.ha })), (v) => F.n(v, 1) + ' ha');
    barras(RAB.$('zonaGeo'), m.geomorfologia.slice(0, 4).map((x) => ({ et: x.nombre, v: x.ha })), (v) => F.n(v, 1) + ' ha');
  };

  K.todo = function () { K.kpis(); K.zonas(); K.zonaExtra(); K.alertas(); K.riesgos(); K.agua(); };
})();
