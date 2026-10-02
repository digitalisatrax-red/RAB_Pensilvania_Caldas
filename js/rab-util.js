/* Utilidades compartidas. Todo el visor cuelga del espacio de nombres global RAB. */
window.RAB = window.RAB || {};
(function () {
  const nf = {};
  function nfmt(d) { return nf[d] || (nf[d] = new Intl.NumberFormat('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })); }
  RAB.fmt = {
    n(v, d = 0) { return v === null || v === undefined || isNaN(v) ? '—' : nfmt(d).format(v); },
    ha(v) { return RAB.fmt.n(v, v < 10 ? 2 : 1); },
  };
  RAB.esc = function (t) {
    return String(t === null || t === undefined ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };
  RAB.norm = function (t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  };
  RAB.$ = (id) => document.getElementById(id);
  RAB.debounce = function (fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  let avisoT;
  RAB.aviso = function (msg, ms = 3500) {
    const a = RAB.$('aviso'); a.textContent = msg; a.classList.add('on');
    clearTimeout(avisoT); avisoT = setTimeout(() => a.classList.remove('on'), ms);
  };

  RAB.descargar = function (nombre, contenido, mime) {
    const blob = new Blob([contenido], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  /* CSV con punto y coma y BOM: abre bien en Excel con configuración regional de Colombia. */
  RAB.csv = function (columnas, filas) {
    const cel = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '﻿' + [columnas.join(';')].concat(filas.map((f) => f.map(cel).join(';'))).join('\r\n');
  };

  /* Geodesia esférica para las herramientas de medición. */
  const R = 6378137, rad = Math.PI / 180;
  RAB.geo = {
    dist(a, b) {
      const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    },
    largo(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += RAB.geo.dist(pts[i - 1], pts[i]); return s; },
    area(pts) {
      if (pts.length < 3) return 0;
      let s = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        s += (q[0] - p[0]) * rad * (2 + Math.sin(p[1] * rad) + Math.sin(q[1] * rad));
      }
      return Math.abs(s * R * R / 2);
    },
  };
})();
