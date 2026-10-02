/* Herramientas de mapa: medición, GPS, pantalla completa y leyenda dinámica. */
(function () {
  const H = RAB.herr = {};
  let modo = null, pts = [];
  H.midiendo = () => !!modo;

  function fuenteMedida() {
    const m = RAB.mapa.map;
    if (!m.getSource('medida')) {
      m.addSource('medida', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'medida-fill', type: 'fill', source: 'medida', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#f2c14e', 'fill-opacity': 0.25 } });
      m.addLayer({ id: 'medida-linea', type: 'line', source: 'medida', paint: { 'line-color': '#f2c14e', 'line-width': 3, 'line-dasharray': [2, 1] } });
      m.addLayer({ id: 'medida-pts', type: 'circle', source: 'medida', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': '#111', 'circle-stroke-width': 2 } });
    }
    return m.getSource('medida');
  }
  function pintar() {
    const f = pts.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: {} }));
    if (pts.length > 1) f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: modo === 'area' && pts.length > 2 ? pts.concat([pts[0]]) : pts }, properties: {} });
    if (modo === 'area' && pts.length > 2) f.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [pts.concat([pts[0]])] }, properties: {} });
    fuenteMedida().setData({ type: 'FeatureCollection', features: f });
    const el = RAB.$('medida'); el.hidden = false;
    if (modo === 'dist') { const d = RAB.geo.largo(pts); el.textContent = d >= 1000 ? `Distancia: ${RAB.fmt.n(d / 1000, 2)} km` : `Distancia: ${RAB.fmt.n(d, 0)} m`; }
    else { const a = RAB.geo.area(pts); el.textContent = `Área: ${RAB.fmt.n(a / 1e4, 2)} ha · perímetro ${RAB.fmt.n(RAB.geo.largo(pts.concat(pts.length > 2 ? [pts[0]] : [])), 0)} m`; }
  }
  function activar(m) {
    const quitar = modo === m;
    modo = quitar ? null : m; pts = [];
    RAB.$('tDist').setAttribute('aria-pressed', String(modo === 'dist'));
    RAB.$('tArea').setAttribute('aria-pressed', String(modo === 'area'));
    RAB.mapa.map.getCanvas().style.cursor = modo ? 'crosshair' : '';
    if (RAB.mapa.map.getSource('medida')) fuenteMedida().setData({ type: 'FeatureCollection', features: [] });
    const el = RAB.$('medida');
    el.hidden = !modo; if (modo) el.textContent = 'Haga clic en el mapa para añadir puntos · doble clic para terminar';
  }
  H.iniciar = function () {
    const m = RAB.mapa.map;
    RAB.$('tDist').onclick = () => activar('dist');
    RAB.$('tArea').onclick = () => activar('area');
    m.on('click', (e) => { if (!modo) return; pts.push([e.lngLat.lng, e.lngLat.lat]); pintar(); });
    m.on('dblclick', (e) => { if (modo) { e.preventDefault(); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modo) activar(modo); });
    RAB.$('tGps').onclick = () => {
      if (!navigator.geolocation) { RAB.aviso('Este dispositivo no ofrece geolocalización.'); RAB.$('tGps').disabled = true; return; }
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const ll = [p.coords.longitude, p.coords.latitude];
          RAB.mapa.volarA(ll, 16);
          const dentro = (b) => ll[0] >= b[0] && ll[0] <= b[2] && ll[1] >= b[1] && ll[1] <= b[3];
          RAB.aviso(dentro(RAB.datos.zonas.reserva.bbox) ? `Ubicación ±${Math.round(p.coords.accuracy)} m` : 'Su ubicación está fuera de la reserva.');
        },
        () => { RAB.aviso('No se obtuvo permiso de ubicación. El resto del tablero funciona igual.', 5000); RAB.$('tGps').disabled = true; },
        { enableHighAccuracy: true, timeout: 12000 });
    };
    RAB.$('tPantalla').onclick = () => {
      const c = RAB.$('cardMapa');
      if (document.fullscreenElement) document.exitFullscreen(); else if (c.requestFullscreen) c.requestFullscreen(); else RAB.aviso('Pantalla completa no disponible en este navegador.');
    };
    document.addEventListener('fullscreenchange', () => setTimeout(() => m.resize(), 150));
    RAB.$('tLeyenda').onclick = (e) => {
      const b = e.currentTarget, on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on)); RAB.$('leyenda').hidden = !on;
    };
  };
  /* Leyenda dinámica: solo las capas encendidas. */
  H.leyenda = function () {
    const el = RAB.$('leyenda'), cat = RAB.datos;
    const caps = [...RAB.mapa.visibles].map((id) => cat.porId.get(id));
    if (!caps.length) { el.innerHTML = '<h3>Leyenda</h3><span>Sin capas activas</span>'; return; }
    el.innerHTML = '<h3>Leyenda</h3>' + caps.map((c) => {
      const s = c.simbologia;
      let filas;
      if (s.tipo === 'categorica') {
        filas = Object.entries(s.valores).slice(0, 8).map(([k, col]) => `<div class="fila"><span class="sw" style="background:${RAB.esc(col)}"></span>${RAB.esc(k)}</div>`).join('');
        if (Object.keys(s.valores).length > 8) filas += `<div class="fila">…y ${Object.keys(s.valores).length - 8} más</div>`;
      } else {
        const forma = c.geometria === 'punto' ? 'border-radius:50%' : c.geometria === 'linea' ? 'height:3px;margin:4px 0' : '';
        filas = `<div class="fila"><span class="sw" style="background:${RAB.esc(s.color)};${forma}"></span>${RAB.esc(c.nombre)}</div>`;
      }
      return `<div class="cap">${RAB.esc(c.nombre)}</div>${filas}`;
    }).join('');
  };
})();
