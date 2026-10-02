/* Buscador global: capas, especies, sitios de monitoreo y predios. */
(function () {
  const B = RAB.buscador = {};
  let indice = [], sitios = [];
  B.indexar = function () {
    const d = RAB.datos;
    indice = d.cat.capas.map((c) => ({ g: 'Capas', t: c.nombre, s: d.cat.temas.find((x) => x.id === c.tema).nombre, k: RAB.norm(c.nombre + ' ' + c.tema), a: () => abrirCapa(c.id) }));
    if (d.bio) {
      Object.entries(d.bio.especies).forEach(([sp, e]) => indice.push({ g: 'Especies', t: sp, s: [e.nc, d.bio.grupos[e.g]].filter(Boolean).join(' · '), k: RAB.norm(sp + ' ' + (e.nc || '')), a: () => verEspecie(sp) }));
      d.predios.predios.forEach((p) => indice.push({ g: 'Predios', t: p.nombre_predio, s: p.estado, k: RAB.norm(p.nombre_predio), a: () => { RAB.$('cardPredios').scrollIntoView({ behavior: 'smooth' }); RAB.aviso('Predio: ' + p.nombre_predio); } }));
    }
  };
  /* Los nombres de sitios se leen de las capas de monitoreo (se cargan una vez, en segundo plano). */
  B.cargarSitios = async function () {
    for (const id of ['parcelas', 'transectos']) {
      try {
        const g = await RAB.datos.capa(id);
        g.features.forEach((f) => {
          const n = f.properties.nombre; if (!n) return;
          const c = f.geometry.type === 'Point' ? f.geometry.coordinates : f.geometry.coordinates[0];
          sitios.push({ g: 'Sitios de monitoreo', t: (id === 'parcelas' ? 'Parcela ' : 'Transecto ') + n, s: f.properties.cobertura || '', k: RAB.norm(n + ' ' + id), a: () => abrirSitio(id, c) });
        });
      } catch (e) { /* la búsqueda sigue funcionando sin sitios */ }
    }
  };
  function encender(id) {
    const v = RAB.estado.v.capas;
    if (!v.includes(id)) RAB.estado.set({ capas: v.concat(id) });
  }
  function abrirCapa(id) {
    encender(id);
    RAB.mapa.volarBbox(RAB.datos.porId.get(id).bbox);
  }
  function abrirSitio(id, c) { encender(id); RAB.mapa.volarA(c, 17); }
  function verEspecie(sp) {
    RAB.$('espBuscar').value = sp; RAB.$('espCat').value = 'ALL'; RAB.tablas.pintarEspecies();
    RAB.$('cardEspecies').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  B.iniciar = function () {
    const inp = RAB.$('buscar'), lista = RAB.$('resultados');
    const cerrar = () => { lista.hidden = true; inp.setAttribute('aria-expanded', 'false'); };
    const buscar = () => {
      const q = RAB.norm(inp.value);
      if (q.length < 2) return cerrar();
      const todos = indice.concat(sitios), grupos = {};
      todos.filter((i) => i.k.includes(q)).slice(0, 80).forEach((i) => { (grupos[i.g] = grupos[i.g] || []).push(i); });
      const orden = ['Capas', 'Sitios de monitoreo', 'Especies', 'Predios'];
      let html = '', n = 0; const mapa = [];
      orden.forEach((g) => (grupos[g] || []).slice(0, 6).forEach((i, j) => {
        if (j === 0) html += `<li class="grp" role="presentation">${g}</li>`;
        html += `<li role="option"><button type="button" data-i="${mapa.length}">${RAB.esc(i.t)}<small>${RAB.esc(i.s)}</small></button></li>`; mapa.push(i); n++;
      }));
      lista.innerHTML = n ? html : '<li class="vacio">Sin resultados</li>';
      lista.hidden = false; inp.setAttribute('aria-expanded', 'true');
      lista.querySelectorAll('button').forEach((b) => { b.onclick = () => { mapa[+b.dataset.i].a(); cerrar(); inp.blur(); }; });
    };
    inp.addEventListener('input', RAB.debounce(buscar, 120));
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cerrar();
      if (e.key === 'ArrowDown') { const b = lista.querySelector('button'); if (b) { e.preventDefault(); b.focus(); } }
    });
    lista.addEventListener('keydown', (e) => {
      const bs = [...lista.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && i < bs.length - 1) { e.preventDefault(); bs[i + 1].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? bs[i - 1] : inp).focus(); }
      if (e.key === 'Escape') { cerrar(); inp.focus(); }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.buscador')) cerrar(); });
  };
})();
