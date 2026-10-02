/* Arranque y cableado del tablero. */
(function () {
  const $ = RAB.$;

  function aplicarTema() {
    const t = RAB.estado.v.tema, r = document.documentElement;
    if (t) r.setAttribute('data-tema', t); else r.removeAttribute('data-tema');
  }
  function panelCapas() {
    const d = RAB.datos, cont = $('layerControls');
    const fila = (c) => `<div class="layer-row" data-id="${c.id}">
      <div class="layer-top"><input type="checkbox" id="chk-${c.id}"><label for="chk-${c.id}">${RAB.esc(c.nombre)}</label>
      <button type="button" class="mini" data-info="${c.id}" aria-label="Metadatos de ${RAB.esc(c.nombre)}">i</button>
      <button type="button" class="mini" data-dl="${c.id}" aria-label="Descargar ${RAB.esc(c.nombre)} en GeoJSON" title="Descargar GeoJSON">⬇</button></div>
      <input type="range" min="0" max="100" value="100" aria-label="Transparencia de ${RAB.esc(c.nombre)}" hidden>
      <div class="layer-err" role="alert" hidden></div></div>`;
    const grupo = (titulo, caps, abierto) => caps.length ? `<details class="layer-group"${abierto ? ' open' : ''}><summary>${RAB.esc(titulo)} (${caps.length})</summary>${caps.map(fila).join('')}</details>` : '';
    const reserva = d.cat.capas.filter((c) => c.ambito === 'reserva'), ctx = d.cat.capas.filter((c) => c.ambito === 'contexto');
    cont.innerHTML = d.cat.temas.map((t) => grupo(t.nombre, reserva.filter((c) => c.tema === t.id), t.id === 'zonificacion')).join('')
      + grupo('Contexto (fuera de la reserva)', ctx, false);
    cont.querySelectorAll('.layer-row').forEach((row) => {
      const id = row.dataset.id, chk = row.querySelector('input[type=checkbox]'), rng = row.querySelector('input[type=range]');
      chk.onchange = () => {
        const s = new Set(RAB.estado.v.capas); chk.checked ? s.add(id) : s.delete(id);
        RAB.estado.set({ capas: [...s] });
      };
      rng.oninput = () => RAB.mapa.opacidad(id, rng.value / 100);
    });
    cont.querySelectorAll('[data-info]').forEach((b) => { b.onclick = () => meta(b.dataset.info); });
    cont.querySelectorAll('[data-dl]').forEach((b) => {
      b.onclick = async () => {
        try { const g = await d.capa(b.dataset.dl); RAB.descargar(b.dataset.dl + '.geojson', JSON.stringify(g), 'application/geo+json'); }
        catch (e) { RAB.aviso('No se pudo descargar la capa: ' + e.message); }
      };
    });
    RAB.mapa.onEstadoCapa = (id, err) => {
      const e = cont.querySelector(`.layer-row[data-id="${id}"] .layer-err`); if (!e) return;
      e.hidden = !err; e.textContent = err || '';
    };
  }
  function sincronizarPanel() {
    const s = new Set(RAB.estado.v.capas);
    $('layerControls').querySelectorAll('.layer-row').forEach((row) => {
      const on = s.has(row.dataset.id);
      row.querySelector('input[type=checkbox]').checked = on;
      row.querySelector('input[type=range]').hidden = !on;
    });
    $('layerControls').querySelectorAll('details').forEach((dt) => { if (dt.querySelector('input:checked')) dt.open = true; });
  }
  function meta(id) {
    const c = RAB.datos.porId.get(id), m = c.metadatos, pc = (v) => (v === null || v === undefined || v === '' ? 'Por confirmar' : v);
    $('dlgTitulo').textContent = c.nombre;
    const filas = [['Tema', RAB.datos.cat.temas.find((t) => t.id === c.tema).nombre], ['Ámbito', c.ambito === 'reserva' ? 'Reserva' : 'Contexto'],
      ['Fuente', pc(m.fuente)], ['Año', pc(m.anio)], ['Escala', pc(m.escala)], ['Nota metodológica', m.nota || '—'],
      ['Dentro de la RAB', RAB.fmt.n(m.pct_en_reserva, 1) + ' % de la capa'], ['Entidades', RAB.fmt.n(c.n)], ['Tamaño publicado', RAB.fmt.n(c.bytes / 1024, 0) + ' KB'], ['Archivo de origen', m.origen_archivo || '—']];
    $('dlgCuerpo').innerHTML = filas.map(([k, v]) => `<dt>${RAB.esc(k)}</dt><dd>${RAB.esc(v)}</dd>`).join('');
    $('dlgMeta').showModal();
  }
  function modos() {
    const cont = $('viewModes');
    cont.innerHTML = RAB.datos.cat.modos.map((m) => `<button type="button" data-modo="${m.id}" aria-pressed="false">${RAB.esc(m.nombre)}</button>`).join('');
    cont.querySelectorAll('button').forEach((b) => { b.onclick = () => RAB.estado.set({ modo: b.dataset.modo, capas: RAB.estado.capasDelModo(RAB.datos.cat, b.dataset.modo) }); });
  }
  function pintarModo() {
    const m = RAB.estado.v.modo;
    $('viewModes').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === m)));
    document.querySelectorAll('[data-modos]').forEach((c) => c.classList.toggle('destacada', c.dataset.modos.split(' ').includes(m)));
  }
  function zonaSelect() {
    const s = $('zonaSelect');
    s.innerHTML = '<option value="toda">Toda la reserva</option>' + RAB.datos.zonas.zonas.map((z) => `<option value="${z.id}">${RAB.esc(z.nombre)}</option>`).join('');
    s.onchange = () => RAB.estado.set({ zona: s.value });
  }
  function porZona() {
    RAB.kpis.todo(); RAB.graficos.cobertura();
    if (RAB.datos.bio) { RAB.graficos.bio(); RAB.tablas.especies(); }
    $('zonaSelect').value = RAB.estado.v.zona;
    $('mapaSub').textContent = RAB.estado.v.zona === 'toda' ? 'Clic en una zona para filtrar todo el tablero' : 'Zona: ' + RAB.datos.nombreZona(RAB.estado.v.zona) + ' · clic en otra zona o elija «Toda la reserva»';
  }

  async function arrancar() {
    try { await RAB.datos.inicial(); }
    catch (e) { $('kpis').innerHTML = `<div class="vacio" role="alert">No se pudieron cargar los datos del tablero (${RAB.esc(e.message)}). Si abrió el archivo con doble clic, sírvalo con un servidor HTTP: <code>python -m http.server</code>.</div>`; return; }
    RAB.estado.init(RAB.datos.cat, RAB.datos.zonas);
    aplicarTema(); modos(); zonaSelect(); panelCapas();
    $('baseSelect').value = RAB.estado.v.base;
    $('baseSelect').onchange = (e) => RAB.estado.set({ base: e.target.value });
    $('btnTema').onclick = () => {
      const oscuro = RAB.estado.v.tema ? RAB.estado.v.tema === 'oscuro' : matchMedia('(prefers-color-scheme: dark)').matches;
      RAB.estado.set({ tema: oscuro ? 'claro' : 'oscuro' });
    };
    $('btnEnlace').onclick = async () => {
      const u = RAB.estado.enlace();
      try { await navigator.clipboard.writeText(u); RAB.aviso('Enlace copiado: reproduce esta vista exacta.'); } catch (e) { prompt('Copie el enlace:', u); }
    };
    $('btnMenu').onclick = (e) => { const s = $('sidebar'), on = !s.classList.contains('abierto'); s.classList.toggle('abierto', on); e.currentTarget.setAttribute('aria-expanded', String(on)); };
    $('cobFcv').onclick = () => RAB.estado.set({ cob: 'fcv' });
    $('cobCorp').onclick = () => RAB.estado.set({ cob: 'corp' });

    RAB.estado.on((p) => {
      if ('tema' in p) aplicarTema();
      if ('modo' in p) pintarModo();
      if ('capas' in p) { sincronizarPanel(); RAB.mapa.sincronizar(); }
      if ('zona' in p) { porZona(); RAB.mapa.aplicarZona(); RAB.mapa.aZona(RAB.estado.v.zona); }
      if ('base' in p) { RAB.mapa.setBase(p.base); $('baseSelect').value = p.base; }
      if ('cob' in p) RAB.graficos.cobertura();
    });

    pintarModo(); sincronizarPanel(); porZona();
    RAB.mapa.init(); RAB.herr.iniciar(); RAB.ficha.iniciar(); RAB.tablas.iniciar(); RAB.graficos.iniciarBio(); RAB.buscador.iniciar();

    // Tablas pesadas en segundo plano: el primer pintado solo necesita catálogo y zonas.
    try {
      await RAB.datos.tablas();
      RAB.graficos.bio(); RAB.tablas.especies(); RAB.tablas.predios(); RAB.buscador.indexar();
    } catch (e) {
      ['bioGrupos', 'espCuerpo', 'predCuerpo'].forEach((i) => { const el = $(i); el.innerHTML = `<tr><td class="vacio" colspan="6">No se pudieron cargar las tablas (${RAB.esc(e.message)}).</td></tr>`; });
      RAB.buscador.indexar();
    }
    RAB.buscador.cargarSitios();
    redes(); registrarSW();
  }
  function redes() {
    const s = $('estadoRed'), f = () => { s.textContent = navigator.onLine ? '' : ' · sin conexión: datos guardados'; };
    addEventListener('online', f); addEventListener('offline', f); f();
  }
  function registrarSW() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline, el visor sigue igual */ });
    }
  }
  document.addEventListener('DOMContentLoaded', arrancar);
})();
