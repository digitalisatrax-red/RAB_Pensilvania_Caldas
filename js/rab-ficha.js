/* Ficha de zona imprimible: se arma justo antes de imprimir (botón o Ctrl+P). */
(function () {
  RAB.ficha = {};
  const F = RAB.fmt;
  RAB.ficha.construir = function () {
    const d = RAB.datos, z = RAB.estado.v.zona, m = d.metricas(), b = m.biodiversidad, nom = d.nombreZona(z);
    let img = '';
    try { img = RAB.mapa.map.getCanvas().toDataURL('image/png'); } catch (e) { img = ''; }
    const prot = z === 'toda' ? d.zonas.predios.ha_adquiridas_sig : m.area_ha;
    const kp = [['Superficie', F.n(m.area_ha, 1) + ' ha'], ['Bajo protección predial', F.n(prot, 1) + ' ha'], ['Especies registradas', F.n(b.especies)],
      ['Especies amenazadas (VU/EN/CR)', F.n(b.amenazadas)], ['Registros de biodiversidad', F.n(b.registros)], ['Puntos de riesgo', F.n(m.riesgos_total)]];
    const cobFcv = d.zonas.cobertura_fcv;
    const filasCob = (z === 'toda' ? cobFcv.clases.map((c) => [c.nombre, c.ha]) : m.cobertura.map((c) => [c.nombre, c.ha]));
    const fuenteCob = z === 'toda' ? 'Fuente: base predial de FCV (coberturas declaradas por predio).' : 'Fuente: coberturas y suelos de Corpocaldas, intersectadas con la zona.';
    const rs = Object.entries(m.riesgos).filter(([, n]) => n > 0).map(([t, n]) => [d.zonas.etiquetas_riesgo[t], n]);
    const esp = d.bio ? RAB.tablas.agregarEspecies().slice(0, 15) : [];
    const tabla = (cab, filas, num = []) => `<table><thead><tr>${cab.map((c, i) => `<th class="${num.includes(i) ? 'num' : ''}">${RAB.esc(c)}</th>`).join('')}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((c, i) => `<td class="${num.includes(i) ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    RAB.$('ficha').innerHTML = `
      <header><div><h1>Ficha de zona · ${RAB.esc(nom)}</h1><div class="meta" style="text-align:left">RAB · Pensilvania, Caldas</div></div>
      <div class="meta"><img src="assets/logo-fcv.png" alt="FCV"><br>${new Date().toLocaleDateString('es-CO', { dateStyle: 'long' })}</div></header>
      <div class="kpis">${kp.map(([a, v]) => `<div><strong>${RAB.esc(v)}</strong><span>${RAB.esc(a)}</span></div>`).join('')}</div>
      <h2>Mapa</h2>${img ? `<img class="mapa" src="${img}" alt="Mapa de la zona">` : '<p>El navegador no permitió capturar el mapa.</p>'}
      <p class="fuente">Fuente: capas activas del visor (ver leyenda en pantalla). Mapa base © OpenStreetMap, CARTO o Esri según la selección.</p>
      <h2>Coberturas</h2>${tabla(['Cobertura', 'Área (ha)'], filasCob.map(([n, h]) => [RAB.esc(n), F.n(h, 1)]), [1])}<p class="fuente">${fuenteCob}</p>
      <h2>Riesgos registrados</h2>${rs.length ? tabla(['Tipo', 'Puntos'], rs.map(([n, v]) => [RAB.esc(n), F.n(v)]), [1]) : '<p>Sin puntos de riesgo en esta zona.</p>'}<p class="fuente">Fuente: capas de riesgo de FCV. Los puntos señalan dónde verificar; no prueban afectación.</p>
      <h2>Especies (primeras 15; amenazadas primero)</h2>${esp.length ? tabla(['Grupo', 'Especie', 'Nombre común', 'Reg.', 'Cat.'], esp.map((x) => [RAB.esc(x.grupo), `<i>${RAB.esc(x.sp)}</i>`, RAB.esc(x.nc || '—'), F.n(x.n), RAB.esc(x.cat || '—')]), [3]) : '<p>Sin especies identificadas en esta zona.</p>'}
      <p class="fuente">Fuente: bases de biodiversidad de FCV (IAvH, PNNSF, Aves Pensilvania, eBird). Cat. = categoría UICN/nacional más alta.</p>
      ${z === 'toda' ? `<h2>Predios</h2><p>${d.zonas.predios.adquiridos} adquiridos (${F.n(d.zonas.predios.ha_adquiridas_sig, 1)} ha SIG) y ${d.zonas.predios.por_adquirir} listos para compra (${F.n(d.zonas.predios.ha_por_adquirir_sig, 1)} ha).</p><p class="fuente">Fuente: bases prediales de FCV, anonimizadas.</p>` : ''}
      <div class="pie">Vista reproducible: ${RAB.esc(RAB.estado.enlace())}<br>Áreas en EPSG:9377. Este documento resume un tablero en evolución; las cifras dependen de las fuentes citadas y de los metadatos pendientes de confirmar en el catálogo.</div>`;
  };
  RAB.ficha.iniciar = function () {
    window.addEventListener('beforeprint', RAB.ficha.construir);
    RAB.$('btnFicha').onclick = () => { RAB.ficha.construir(); setTimeout(() => window.print(), 80); };
  };
})();
