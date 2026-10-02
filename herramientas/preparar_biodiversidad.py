"""Unifica aves, herpetos, mamíferos y mariposas en un esquema común (data/tablas/biodiversidad.json)."""
import os
import re
import datetime as dt
from collections import defaultdict
import openpyxl
from shapely.geometry import Point

AMENAZA = {"VU", "EN", "CR"}
RE_BINOMIAL = re.compile(r"^[A-ZÁÉÍÓÚÑ][a-zñ]+ [a-zñ][a-zñ\-]+( [a-zñ][a-zñ\-]+)?$")
RE_SITIO = re.compile(r"^(BA|BJ|BP|M|P)[1-5]$")
GRUPOS = {
    "aves": dict(nombre="Aves", archivo="BD Aves RAB 2025.xlsx", hoja="BD Aves", listado="Listado", uicn="UICN 2025-1"),
    "herpetos": dict(nombre="Herpetos", archivo="BD Herpetos RAB 2025.xlsx", hoja="BD Herps", listado="Listado", uicn="UICN 2025-1"),
    "mamiferos": dict(nombre="Mamíferos", archivo="BD Mamíferos RAB 2024.xlsx", hoja="BD Mamiferos", listado="Listado", uicn="UICN"),
    "mariposas": dict(nombre="Mariposas y polillas", archivo="BD Mariposas RAB 2024.xlsx", hoja="BD Mariposas-polillas",
                      listado="Listado Mariposas-polillas", uicn="UICN 2024-1"),
}


def limpio(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = v.replace("\xa0", " ").strip()
        return v or None
    return v


def hoja_filas(ruta, hoja):
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    it = wb[hoja].iter_rows(values_only=True)
    cab = [limpio(c) for c in next(it)]
    idx = {}
    for i, c in enumerate(cab):
        if c is not None and c not in idx:
            idx[c] = i
    filas = [r for r in it if any(limpio(x) is not None for x in r)]
    wb.close()
    return idx, filas


def val(idx, fila, *nombres, prefijo=False):
    for n in nombres:
        if prefijo:
            for k, i in idx.items():
                if k.startswith(n) and i < len(fila) and limpio(fila[i]) is not None:
                    return limpio(fila[i])
        elif n in idx and idx[n] < len(fila):
            v = limpio(fila[idx[n]])
            if v is not None:
                return v
    return None


def categoria(v):
    if not v:
        return None
    m = re.match(r"^(CR|EN|VU|NT|LC|DD|NE)\b", str(v).strip().upper())
    return m.group(1) if m else None


def coord(v, es_lat):
    """Corrige coordenadas escritas sin separador decimal (p. ej. 5440263551 → 5.440263551)."""
    if v is None:
        return None, False
    try:
        x = float(str(v).replace(",", "."))
    except ValueError:
        return None, False
    corregido = False
    limite = 15 if es_lat else 82
    while abs(x) > limite and abs(x) > 0:
        x /= 10
        corregido = True
    return x, corregido


def fecha_y_anio(v, anio_extra=None):
    if isinstance(v, (dt.datetime, dt.date)):
        return v.strftime("%Y-%m-%d"), v.year
    if isinstance(v, (int, float)) and 1900 < v < 2100:
        return None, int(v)
    if isinstance(v, str):
        m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", v.strip())
        if m:
            return (v.strip()[:10] if "/" not in v else None), int(m.group(1))
        m = re.match(r"^(\d{4})", v.strip())
        if m:
            return None, int(m.group(1))
    if anio_extra is not None:
        try:
            a = int(float(anio_extra))
            if 1900 < a < 2100:
                return None, a
        except (TypeError, ValueError):
            pass
    return None, None


def zona_de(lat, lon, zonas):
    if lat is None or lon is None:
        return "sin_ubicacion"
    p = Point(lon, lat)
    for zid, geom in zonas:
        if geom.covers(p):
            return zid
    return "fuera"


def preparar(origen, zonas, nombres_zona):
    """zonas: [(id, geom_wgs84)]. Devuelve (tabla, resumen, informe)."""
    base = os.path.join(origen, "BD_BIODIVERSIDAD")
    registros, especies, informe = [], {}, {}
    for gid, cfg in GRUPOS.items():
        ruta = os.path.join(base, cfg["archivo"])
        # Catálogo de especies (categorías) desde la hoja Listado
        lidx, lfilas = hoja_filas(ruta, cfg["listado"])
        cat = {}
        for f in lfilas:
            esp = val(lidx, f, "Especie")
            if not esp:
                continue
            cat[esp] = dict(
                uicn=categoria(val(lidx, f, cfg["uicn"], "UICN", "IUCN")),
                nac=categoria(val(lidx, f, "Categoría nacional", "Categoría naci", prefijo=True)),
                end=val(lidx, f, "Endemismo", "Endémica", "Endemismo (Est", prefijo=True),
            )
        idx, filas = hoja_filas(ruta, cfg["hoja"])
        n_entrada = len(filas)
        n_ok = n_excl = n_sinesp = n_fix = 0
        for f in filas:
            if gid == "mamiferos":
                clase = val(idx, f, "Clase")
                if clase != "Mammalia":
                    n_excl += 1
                    continue
            esp = val(idx, f, "Especie")
            if esp:
                esp = re.sub(r"\s+", " ", esp)
            if esp and "familiaris" in esp:
                n_excl += 1
                continue
            valida = bool(esp and RE_BINOMIAL.match(esp))
            if not valida:
                n_sinesp += 1
            fecha_raw = val(idx, f, "Fecha", "Fecha (D/M/A)", "Fecha registro")
            fecha, anio = fecha_y_anio(fecha_raw, val(idx, f, "Año"))
            lat, c1 = coord(val(idx, f, "Latitud"), True)
            lon, c2 = coord(val(idx, f, "Longitud"), False)
            if lat is not None and lon is not None and not (0 < lat < 13 and -80 < lon < -70):
                lat = lon = None
            n_fix += int(c1 or c2)
            cob = val(idx, f, "Cobertura")
            cob = cob.upper() if cob and cob.upper() in ("BA", "BJ", "BP", "M", "P") else (cob if cob in ("BA", "BJ", "BP", "M", "P") else None)
            sit = val(idx, f, "ID")
            sit = sit if sit and RE_SITIO.match(str(sit)) else None
            ab = val(idx, f, "N° de individuos", "Individuos", "Abundancia")
            try:
                ab = int(ab) if ab is not None else 1
            except (TypeError, ValueError):
                ab = 1
            z = zona_de(lat, lon, zonas)
            registros.append([gid, esp if valida else None, anio, fecha, cob, sit, ab,
                              None if lat is None else round(lat, 6), None if lon is None else round(lon, 6),
                              z, val(idx, f, "Fuente")])
            if valida:
                info = cat.get(esp, {})
                uicn = info.get("uicn") or categoria(val(idx, f, "UICN"))
                nac = info.get("nac") or categoria(val(idx, f, "Categoría nacional", "Categoría naci", prefijo=True))
                prev = especies.get(esp)
                if not prev:
                    especies[esp] = dict(g=gid, f=val(idx, f, "Familia"), nc=val(idx, f, "Nombre comun", "Nombre común"),
                                         u=uicn, n=nac, e=info.get("end"))
                else:
                    for k, v in (("f", val(idx, f, "Familia")), ("nc", val(idx, f, "Nombre comun", "Nombre común")), ("u", uicn), ("n", nac)):
                        if not prev.get(k) and v:
                            prev[k] = v
            n_ok += 1
        informe[gid] = dict(filas_entrada=n_entrada, registros_salida=n_ok, excluidos_no_aplican=n_excl,
                            sin_especie_valida=n_sinesp, coordenadas_corregidas=n_fix)
    for e in especies.values():
        e["a"] = bool((e.get("u") in AMENAZA) or (e.get("n") in AMENAZA))
    columnas = ["grupo", "especie", "anio", "fecha", "cobertura", "sitio", "abundancia", "lat", "lon", "zona", "fuente"]
    tabla = dict(version=1, columnas=columnas, registros=registros, especies=especies,
                 grupos={k: v["nombre"] for k, v in GRUPOS.items()},
                 leyenda_cobertura={"BA": "Bosque avanzado (>30 años)", "BJ": "Bosque joven (8–30 años)",
                                    "M": "Matorral / arbustivo (<8 años)", "BP": "Bosque de pino", "P": "Pastizal"})
    return tabla, resumen(registros, especies, nombres_zona), informe


def resumen(registros, especies, nombres_zona):
    """Cifras precalculadas por zona; 'toda' incluye registros sin ubicar o fuera de la zonificación."""
    out = {}
    claves = ["toda"] + list(nombres_zona)
    for k in claves:
        sel = registros if k == "toda" else [r for r in registros if r[9] == k]
        por_grupo = {}
        for g in GRUPOS:
            rg = [r for r in sel if r[0] == g]
            esps = {r[1] for r in rg if r[1]}
            por_grupo[g] = dict(registros=len(rg), especies=len(esps), amenazadas=sum(1 for e in esps if especies[e]["a"]))
        todas = {r[1] for r in sel if r[1]}
        out[k] = dict(registros=len(sel), especies=len(todas), amenazadas=sum(1 for e in todas if especies[e]["a"]), por_grupo=por_grupo)
    out["toda"]["fuera_zonificacion"] = sum(1 for r in registros if r[9] == "fuera")
    out["toda"]["sin_ubicacion"] = sum(1 for r in registros if r[9] == "sin_ubicacion")
    return out
