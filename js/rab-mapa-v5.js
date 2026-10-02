/* Mapa MapLibre: bases, capas bajo demanda, simbología desde el catálogo, popups y selección de zona. */
(function () {
  const esri = (n) => [`https://server.arcgisonline.com/ArcGIS/rest/services/${n}/MapServer/tile/{z}/{y}/{x}`];
  const ATR_ESRI = 'Tiles © Esri — Esri, HERE, Garmin, FAO, NOAA, USGS, OpenStreetMap contributors';
  // Se evitan las teselas de CARTO: desde sitios publicados devuelven marca de agua «API key required».
  const BASES = {
    claro: { tiles: esri('Canvas/World_Light_Gray_Base'), attr: ATR_ESRI, max: 16 },
    color: { tiles: esri('World_Topo_Map'), attr: ATR_ESRI, max: 19 },
    oscuro: { tiles: esri('Canvas/World_Dark_Gray_Base'), attr: ATR_ESRI, max: 16 },
    satelite: { tiles: esri('World_Imagery'), attr: 'Imágenes © Esri, Maxar, Earthstar Geographics', max: 19 },
    osm: { tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attr: '© OpenStreetMap contributors', max: 19 },
  };
  const RANGO = { poligono: 0, linea: 1, punto: 2 };
  const mapa = RAB.mapa = { map: null, listo: false, visibles: new Set(), opac: {}, onEstadoCapa: null, marcador: null };

  function colorExpr(s) {
    if (s.tipo === 'categorica' && s.valores && Object.keys(s.valores).length) {
      const e = ['match', ['to-string', ['coalesce', ['get', s.campo], '(sin dato)']]];
      Object.entries(s.valores).forEach(([k, c]) => e.push(k, c));
      e.push('#9aa59d');
      return e;
    }
    return s.color || '#295d3e';
  }
  function ids(cap) { return cap.geometria === 'poligono' ? [cap.id + ':fill', cap.id + ':line'] : cap.geometria === 'linea' ? [cap.id + ':line'] : [cap.id + ':circle']; }
  mapa.idsDe = ids;

  function paint(cap) {
    const s = cap.simbologia, o = mapa.opac[cap.id] ?? 1, sel = RAB.estado.v.zona;
    const c = colorExpr(s);
    const esZona = cap.id === 'ordenamiento_predial';
    if (cap.geometria === 'poligono') {
      const rel = s.tipo === 'categorica' ? 0.5 : (s.relleno ?? 0.35);
      const fillOp = esZona && sel !== 'toda' ? ['case', ['==', ['get', 'zona'], sel], 0.75 * o, 0.1 * o] : rel * o;
      const grosor = esZona && sel !== 'toda' ? ['case', ['==', ['get', 'zona'], sel], 3, 0.8] : (s.grosor ?? 1.2);
      return {
        fill: { 'fill-color': c, 'fill-opacity': fillOp },
        line: { 'line-color': s.tipo === 'simple' ? c : '#1d2a22', 'line-width': grosor, 'line-opacity': Math.min(1, 0.9 * o) },
      };
    }
    if (cap.geometria === 'linea') {
      return { line: { 'line-color': c, 'line-width': s.grosor ?? 1.5, 'line-opacity': 0.95 * o, ...(s.trazo ? { 'line-dasharray': [3, 2] } : {}) } };
    }
    return { circle: { 'circle-color': c, 'circle-radius': s.radio ?? 5, 'circle-stroke-color': s.borde || '#ffffff', 'circle-stroke-width': 1.5, 'circle-opacity': o, 'circle-stroke-opacity': o } };
  }

  let fallos = 0, actual = 'claro';
  const ETIQ = { tiles: esri('Reference/World_Boundaries_and_Places'), attr: ATR_ESRI, max: 19 };
  function aviso(txt) {
    const c = document.getElementById('map'); if (!c) return;
    let a = c.querySelector('.base-aviso');
    if (!txt) { if (a) a.remove(); return; }
    if (!a) { a = document.createElement('div'); a.className = 'base-aviso'; a.setAttribute('role', 'status'); c.appendChild(a); }
    a.textContent = txt;
  }
  // Primera capa de datos del visor: la base y las etiquetas se insertan por debajo / por encima de ella.
  const primeraDato = () => [...mapa.visibles].flatMap((id) => ids(RAB.datos.porId.get(id))).find((i) => mapa.map.getLayer(i));
  function quitarRaster(id) { const m = mapa.map; if (m.getLayer(id)) m.removeLayer(id); if (m.getSource(id)) m.removeSource(id); }
  function ponRaster(id, b, antes, opac) {
    const m = mapa.map;
    m.addSource(id, { type: 'raster', tiles: b.tiles, tileSize: 256, maxzoom: b.max || 19, attribution: b.attr });
    m.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': opac } }, antes);
  }
  function base(nombre) {
    const m = mapa.map, v = RAB.estado.v;
    actual = nombre === 'blanco' || BASES[nombre] ? nombre : 'claro'; fallos = 0; aviso('');
    quitarRaster('base'); quitarRaster('etq');
    m.setPaintProperty('fondo', 'background-color', actual === 'oscuro' ? '#111413' : '#ffffff');
    if (actual !== 'blanco') ponRaster('base', BASES[actual], primeraDato(), (v.bop ?? 100) / 100);
    if (v.etq && actual !== 'blanco') ponRaster('etq', ETIQ, undefined, 1);
  }
  mapa.setBase = function (n) { if (mapa.listo) base(n); };
  mapa.setOpacidadBase = function (pct) { if (mapa.listo && mapa.map.getLayer('base')) mapa.map.setPaintProperty('base', 'raster-opacity', pct / 100); };
  mapa.setEtiquetas = function () { if (mapa.listo) base(actual); };
  // Si el mapa base no carga (red bloqueada o servicio caído) se pasa a OpenStreetMap y se avisa.
  function vigilarBase() {
    mapa.map.on('error', (e) => {
      if (!e || !e.sourceId || (e.sourceId !== 'base')) return;
      if (++fallos === 4) {
        if (actual !== 'osm') {
          aviso('El mapa base no responde; se usa OpenStreetMap.'); fallos = 0; actual = 'osm';
          quitarRaster('base'); ponRaster('base', BASES.osm, primeraDato(), (RAB.estado.v.bop ?? 100) / 100);
        } else aviso('No se pudo cargar ningún mapa base. Revise la conexión; las capas del visor siguen disponibles.');
      }
    });
    mapa.map.on('data', (e) => { if (e.sourceId === 'base' && e.tile && fallos === 0) aviso(''); });
  }

  mapa.init = function () {
    const z = RAB.datos.zonas, v = RAB.estado.v.vista;
    const opciones = {
      container: 'map', style: { version: 8, sources: {}, layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': '#ffffff' } }] },
      attributionControl: { compact: true }, preserveDrawingBuffer: true, maxZoom: 19, dragRotate: false,
    };
    if (v) { opciones.center = [v[0], v[1]]; opciones.zoom = v[2]; } else { opciones.bounds = z.reserva.bbox; opciones.fitBoundsOptions = { padding: 36 }; }
    const m = mapa.map = new maplibregl.Map(opciones);
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    m.on('load', () => {
      mapa.listo = true; base(RAB.estado.v.base); vigilarBase(); mapa.sincronizar();
      if (!v && RAB.estado.v.zona !== 'toda') mapa.aZona(RAB.estado.v.zona);
    });
    m.on('moveend', () => { const c = m.getCenter(); RAB.estado.set({ vista: [+c.lng.toFixed(5), +c.lat.toFixed(5), +m.getZoom().toFixed(2)] }, { silencio: true }); });
    m.on('mousemove', (e) => {
      RAB.$('mapaCoord').textContent = `${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)} · WGS84`;
      if (RAB.herr && RAB.herr.midiendo()) return;
      const f = m.queryRenderedFeatures(e.point, { layers: interactivas() });
      m.getCanvas().style.cursor = f.length ? 'pointer' : '';
    });
    m.on('click', (e) => {
      if (RAB.herr && RAB.herr.midiendo()) return;
      const fs = m.queryRenderedFeatures(e.point, { layers: interactivas() });
      if (!fs.length) return;
      const f = fs[0], capId = f.layer.id.split(':')[0], cap = RAB.datos.porId.get(capId);
      if (capId === 'ordenamiento_predial' && f.properties.zona) RAB.estado.set({ zona: f.properties.zona });
      abrirPopup(cap, f.properties, e.lngLat);
    });
  };
  function interactivas() {
    return [...mapa.visibles].flatMap((id) => {
      const cap = RAB.datos.porId.get(id);
      return cap.geometria === 'poligono' ? [id + ':fill'] : cap.geometria === 'linea' ? [id + ':line'] : [id + ':circle'];
    }).filter((i) => mapa.map.getLayer(i));
  }

  function valorPopup(campo, v) {
    if (v === null || v === undefined || v === '' || v === 'null') return '—';
    if (campo.formato && campo.formato.startsWith('numero')) return RAB.fmt.n(Number(v), Number(campo.formato.split(':')[1] || 0));
    if (campo.formato === 'zona') return RAB.datos.nombreZona(v);
    return v;
  }
  function abrirPopup(cap, props, lngLat) {
    const filas = cap.campos_popup.map((c) => `<dt>${RAB.esc(c.etiqueta)}</dt><dd>${RAB.esc(valorPopup(c, props[c.campo]))}</dd>`).join('');
    const html = `<h3>${RAB.esc(cap.nombre)}</h3><dl>${filas || '<dt>Entidad</dt><dd>sin atributos publicados</dd>'}</dl><div class="pie">Fuente: ${RAB.esc(cap.metadatos.fuente || 'Por confirmar')}</div>`;
    new maplibregl.Popup({ maxWidth: '300px' }).setLngLat(lngLat).setHTML(html).addTo(mapa.map);
  }

  async function agregar(id) {
    const cap = RAB.datos.porId.get(id), m = mapa.map;
    if (m.getSource(id)) return;
    try {
      const data = await RAB.datos.capa(id);
      if (!mapa.visibles.has(id) || m.getSource(id)) return;
      m.addSource(id, { type: 'geojson', data });
      const p = paint(cap);
      if (p.fill) m.addLayer({ id: id + ':fill', type: 'fill', source: id, paint: p.fill });
      if (p.line) m.addLayer({ id: id + ':line', type: 'line', source: id, paint: p.line, layout: { 'line-join': 'round' } });
      if (p.circle) m.addLayer({ id: id + ':circle', type: 'circle', source: id, paint: p.circle });
      mapa.reordenar();
      mapa.onEstadoCapa && mapa.onEstadoCapa(id, null);
    } catch (e) {
      mapa.onEstadoCapa && mapa.onEstadoCapa(id, 'No se pudo cargar esta capa (' + e.message + '). El resto del tablero sigue funcionando.');
    }
    estado();
  }
  function quitar(id) {
    const m = mapa.map, cap = RAB.datos.porId.get(id);
    ids(cap).forEach((i) => m.getLayer(i) && m.removeLayer(i));
    if (m.getSource(id)) m.removeSource(id);
  }
  mapa.reordenar = function () {
    const orden = [...mapa.visibles].map((id) => RAB.datos.porId.get(id)).sort((a, b) => RANGO[a.geometria] - RANGO[b.geometria]);
    orden.forEach((cap) => ids(cap).forEach((i) => mapa.map.getLayer(i) && mapa.map.moveLayer(i)));
  };
  /* Alinea las capas del mapa con el estado (lista de ids visibles). */
  mapa.sincronizar = function () {
    if (!mapa.listo) return;
    const quiere = new Set(RAB.estado.v.capas);
    [...mapa.visibles].forEach((id) => { if (!quiere.has(id)) { mapa.visibles.delete(id); quitar(id); } });
    quiere.forEach((id) => { if (!mapa.visibles.has(id)) { mapa.visibles.add(id); agregar(id); } });
    estado(); RAB.herr && RAB.herr.leyenda();
    const modo = RAB.estado.cat.modos.find((x) => x.id === RAB.estado.v.modo);
    RAB.$('mapaTitulo').textContent = (modo ? modo.nombre : '').toUpperCase();
  };
  function estado() {
    const n = mapa.map.getStyle().layers.filter((l) => l.id.includes(':')).length;
    RAB.$('mapaEstado').textContent = mapa.visibles.size ? `${mapa.visibles.size} capa(s) activa(s)` : 'Sin capas activas — enciéndalas en el panel lateral';
    return n;
  }
  mapa.opacidad = function (id, o) {
    mapa.opac[id] = o;
    const cap = RAB.datos.porId.get(id), p = paint(cap), m = mapa.map;
    ['fill', 'line', 'circle'].forEach((t) => { if (p[t] && m.getLayer(id + ':' + t)) Object.entries(p[t]).forEach(([k, v]) => m.setPaintProperty(id + ':' + t, k, v)); });
  };
  mapa.aplicarZona = function () {
    if (!mapa.listo || !mapa.visibles.has('ordenamiento_predial')) return;
    mapa.opacidad('ordenamiento_predial', mapa.opac.ordenamiento_predial ?? 1);
  };
  mapa.aZona = function (zid) {
    const bb = zid === 'toda' ? RAB.datos.zonas.reserva.bbox : RAB.datos.zonaPorId.get(zid).bbox;
    mapa.map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 40, duration: 700, maxZoom: 17 });
  };
  mapa.volarA = function (lonlat, zoom = 16) {
    mapa.map.flyTo({ center: lonlat, zoom, duration: 800 });
    if (mapa.marcador) mapa.marcador.remove();
    const el = document.createElement('div');
    el.style.cssText = 'width:20px;height:20px;border-radius:50%;border:3px solid #f2c14e;background:rgba(242,193,78,.25);box-shadow:0 0 0 3px rgba(0,0,0,.4)';
    mapa.marcador = new maplibregl.Marker({ element: el }).setLngLat(lonlat).addTo(mapa.map);
    setTimeout(() => { if (mapa.marcador) { mapa.marcador.remove(); mapa.marcador = null; } }, 6000);
  };
  mapa.volarBbox = function (bb) { mapa.map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 40, duration: 700, maxZoom: 16 }); };
  mapa.abrirPopup = abrirPopup;
})();
