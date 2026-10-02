/* Carga de catálogo, zonas, tablas y capas (bajo demanda, con caché en memoria). */
(function () {
  const cache = new Map();
  RAB.datos = {
    cat: null, zonas: null, bio: null, predios: null, errores: {},
    async json(ruta) {
      const r = await fetch(ruta);
      if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + ruta);
      return r.json();
    },
    async inicial() {
      const [cat, zonas] = await Promise.all([this.json('data/catalogo.json'), this.json('data/zonas.json')]);
      this.cat = cat; this.zonas = zonas;
      this.porId = new Map(cat.capas.map((c) => [c.id, c]));
      this.zonaPorId = new Map(zonas.zonas.map((z) => [z.id, z]));
    },
    async tablas() {
      const [bio, pred] = await Promise.all([this.json('data/tablas/biodiversidad.json'), this.json('data/tablas/predios.json')]);
      this.bio = bio; this.predios = pred;
    },
    /* GeoJSON de una capa; la promesa se cachea para no repetir la petición. */
    capa(id) {
      if (cache.has(id)) return cache.get(id);
      const cap = this.porId.get(id);
      const p = this.json('data/' + cap.archivo).catch((e) => { cache.delete(id); this.errores[id] = e.message; throw e; });
      cache.set(id, p);
      return p;
    },
    nombreZona(id) {
      if (id === 'toda') return 'Toda la reserva';
      if (id === 'entorno' || id === 'fuera') return 'Entorno (fuera de la reserva)';
      if (id === 'sin_ubicacion') return 'Sin ubicación';
      const z = this.zonaPorId.get(id); return z ? z.nombre : id;
    },
    metricas(zona) { return this.zonas.metricas[zona || RAB.estado.v.zona]; },
  };
})();
