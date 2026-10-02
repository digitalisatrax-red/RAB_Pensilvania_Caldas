#!/usr/bin/env python3
"""ETL de visorRAB: regenera todo data/ desde las fuentes originales (idempotente).

Uso:
    python herramientas/preparar_datos.py [--origen "G:\\Mi unidad\\2026\\FCV\\RAB"] [--salida data]
"""
import argparse
import os
import shutil
import sys
import unicodedata
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import shape, Point
from shapely.ops import unary_union

import rab_comun as C
import construir_catalogo as K
import preparar_biodiversidad as BIO
import preparar_predios as PRE

ORIGEN_DEFECTO = r"G:\Mi unidad\2026\FCV\RAB"
COBERTURA_CLASE = {  # clasificación usada por el tablero para el anillo de "cobertura natural"
    "Bosque denso alto de tierra firme": "natural",
    "Arbustal denso": "natural",
    "Vegetacion secundaria o en transicion": "natural",
    "Bosque fragmentado con pastos y cultivos": "mixta",
    "Mosaico de pastos con espacios naturales": "mixta",
    "Pastos limpios": "transformada",
    "Pastos enmalezados": "transformada",
}
TOLERANCIA_M = {"reserva": 1.5, "contexto": 12.0}
TOL_ESPECIAL = {"cobertura_tenerife": 30.0, "uso_suelo_tenerife": 20.0}
SIN_SIMPLIFICAR = {"ordenamiento_predial", "infraestructura", "limite_rab"}


def norm(t):
    return unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().strip().lower()


def cargar_capa(origen, carpeta, archivo):
    ruta = os.path.join(origen, "GEOJSON", carpeta, archivo + ".geojson")
    d = C.cargar_geojson(ruta)
    d, n_rep = C.reparar_objeto(d)
    return d, n_rep, os.path.getsize(ruta)


def asignar_paleta(valores_pesos, paleta):
    cols = K.PALETAS[paleta]
    orden = sorted(valores_pesos, key=lambda v: -valores_pesos[v])
    res = {}
    for i, v in enumerate(orden):
        res[str(v) if v not in (None, "") else "(sin dato)"] = cols[i % len(cols)] if len(orden) <= len(cols) or i < len(cols) else "#9aa59d"
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--origen", default=ORIGEN_DEFECTO)
    ap.add_argument("--salida", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data"))
    a = ap.parse_args()
    origen, salida = a.origen, a.salida
    if os.path.isdir(os.path.join(salida, "capas")):
        shutil.rmtree(os.path.join(salida, "capas"))

    # ---------- 1. Zonas de manejo (eje del tablero) ----------
    zdat, _, _ = cargar_capa(origen, "Zonificacion", "Ordenamiento_Predial_RAB")
    cat2zona = {norm(c): z for z in K.ZONAS for c in z[3]}
    geoms_zona = defaultdict(list)
    for f in zdat["features"]:
        z = cat2zona[norm(f["properties"]["CATEGORIA"])]
        geoms_zona[z[0]].append(shape(f["geometry"]).buffer(0))
    zonas = [(z[0], unary_union(geoms_zona[z[0]])) for z in K.ZONAS]
    reserva = unary_union([g for _, g in zonas])
    reserva_p = C.a_plano(reserva)
    zonas_p = {zid: C.a_plano(g) for zid, g in zonas}
    zona_meta = {z[0]: dict(nombre=z[1], color=z[2]) for z in K.ZONAS}

    def zona_punto(pt):
        for zid, g in zonas:
            if g.covers(pt):
                return zid
        return "entorno"

    # ---------- 2. Capas ----------
    catalogo, informe, memoria = [], [], {}
    for carpeta, archivo, cid, tema, nombre, simb, campos, meta, extras in K.CAPAS:
        d, n_rep, bytes_in = cargar_capa(origen, carpeta, archivo)
        campos_def = campos if campos is not None else []
        feats_out, pesos = [], defaultdict(float)
        geoms_orig = []
        tol_m = 0 if cid in SIN_SIMPLIFICAR else TOL_ESPECIAL.get(cid, None)
        ambito_prev = None
        tipo_geom = d["features"][0]["geometry"]["type"]
        es_poly, es_line, es_punto = "Polygon" in tipo_geom, "Line" in tipo_geom, "Point" in tipo_geom
        for i, f in enumerate(d["features"]):
            g = C.quitar_z(shape(f["geometry"]))
            if es_poly:
                g = g.buffer(0) if not g.is_valid else g
            props_in = f["properties"]
            props = {}
            for src, dst, _et, _fm in campos_def:
                v = props_in.get(src)
                props[dst] = None if v in ("", " ") else v
            if extras.get("nombre_fijo"):
                props["nombre"] = extras["nombre_fijo"]
            if cid == "ordenamiento_predial":
                z = cat2zona[norm(props_in["CATEGORIA"])]
                props = dict(zona=z[0], zona_nombre=z[1], categoria_origen=props_in["CATEGORIA"], nombre=props_in.get("NOMBRE") or None)
            if es_poly:
                props["area_ha"] = round(C.area_ha(g), 4)
            elif es_line:
                props["longitud_km"] = round(C.longitud_km(g), 4)
            if es_punto:
                props["zona"] = zona_punto(g) if g.geom_type == "Point" else None
            geoms_orig.append(g)
            feats_out.append((g, props))
            if simb and simb.get("tipo") == "categorica" and simb["campo"] in props:
                pesos[props[simb["campo"]]] += props.get("area_ha", 1)
        memoria[cid] = [(C.a_plano(g), p) for g, p in feats_out]
        # Ámbito: proporción de la capa que cae dentro de la reserva
        if es_poly:
            tot = sum(p.area for p, _ in memoria[cid]) or 1
            dentro = sum(p.intersection(reserva_p).area for p, _ in memoria[cid])
        elif es_line:
            tot = sum(p.length for p, _ in memoria[cid]) or 1
            dentro = sum(p.intersection(reserva_p).length for p, _ in memoria[cid])
        else:
            tot = len(memoria[cid]) or 1
            dentro = sum(1 for p, _ in memoria[cid] if reserva_p.covers(p))
        pct = round(100 * dentro / tot, 1)
        ambito = "reserva" if (tema in ("riesgos", "monitoreo", "accesos", "zonificacion") or pct >= 50) else "contexto"
        tol = tol_m if tol_m is not None else TOLERANCIA_M[ambito]
        nd = 6 if tol <= 2 else 5
        salida_feats = []
        for i, (g, props) in enumerate(feats_out):
            if tol and not es_punto:
                gs = C.a_geo(C.a_plano(g).simplify(tol, preserve_topology=True))
                if gs.is_empty:
                    gs = g
            else:
                gs = g
            salida_feats.append({"type": "Feature", "id": i, "geometry": C.geom_a_dict(gs, nd), "properties": props})
        # Simbología con colores resueltos
        s = dict(simb) if simb else None
        if cid == "ordenamiento_predial":
            s = dict(tipo="categorica", campo="zona_nombre", valores={v["nombre"]: v["color"] for v in zona_meta.values()})
        elif s and s["tipo"] == "categorica":
            s["valores"] = asignar_paleta(pesos, s["paleta"])
            s.pop("paleta", None)
        popup = [dict(campo=dst, etiqueta=et, **({"formato": fm} if fm else {})) for _s, dst, et, fm in campos_def]
        if cid == "ordenamiento_predial":
            popup = [dict(campo="zona_nombre", etiqueta="Zona de manejo"), dict(campo="nombre", etiqueta="Nombre")]
        if es_poly:
            popup.append(dict(campo="area_ha", etiqueta="Área (ha)", formato="numero:2"))
        if es_line:
            popup.append(dict(campo="longitud_km", etiqueta="Longitud (km)", formato="numero:2"))
        if es_punto and cid in ("parcelas", "transectos_puntos") or extras.get("riesgo"):
            popup.append(dict(campo="zona", etiqueta="Zona", formato="zona"))
        ruta_rel = f"capas/{tema}/{cid}.geojson"
        n_bytes = C.escribir_json(os.path.join(salida, ruta_rel), {"type": "FeatureCollection", "features": salida_feats})
        xs = [c for f in salida_feats for c in _coords(f["geometry"]["coordinates"])]
        bbox = [min(x for x, _ in xs), min(y for _, y in xs), max(x for x, _ in xs), max(y for _, y in xs)]
        entrada = dict(id=cid, tema=tema, nombre=nombre, ambito=ambito, archivo=ruta_rel,
                       geometria=("poligono" if es_poly else "linea" if es_line else "punto"), n=len(salida_feats), bytes=n_bytes,
                       simbologia=s or {}, campos_popup=popup, bbox=[round(v, 5) for v in bbox],
                       metadatos=dict(meta, pct_en_reserva=pct, origen_archivo=f"{carpeta}/{archivo}.geojson"))
        if extras.get("riesgo"):
            entrada["riesgo"] = extras["riesgo"]
        catalogo.append(entrada)
        informe.append(dict(capa=cid, origen=f"{carpeta}/{archivo}.geojson", entidades_entrada=len(d["features"]),
                            entidades_salida=len(salida_feats), bytes_antes=bytes_in, bytes_despues=n_bytes,
                            tolerancia_m=tol, textos_reparados=n_rep, pct_en_reserva=pct, ambito=ambito,
                            campos_descartados=sorted(k for k in d["features"][0]["properties"] if k not in {c[0] for c in campos_def})))

    # Capa derivada: límite de la reserva
    lim = [{"type": "Feature", "id": 0, "geometry": C.geom_a_dict(reserva, 6),
            "properties": dict(nombre="Límite de la RAB", area_ha=round(reserva_p.area / 1e4, 4))}]
    n_bytes = C.escribir_json(os.path.join(salida, "capas/zonificacion/limite_rab.geojson"), {"type": "FeatureCollection", "features": lim})
    catalogo.insert(2, dict(id="limite_rab", tema="zonificacion", nombre="Límite de la RAB", ambito="reserva",
                            archivo="capas/zonificacion/limite_rab.geojson", geometria="poligono", n=1, bytes=n_bytes,
                            simbologia=dict(tipo="simple", color="#111111", relleno=0, grosor=2.5),
                            campos_popup=[dict(campo="nombre", etiqueta="Nombre"), dict(campo="area_ha", etiqueta="Área (ha)", formato="numero:2")],
                            bbox=[round(v, 5) for v in reserva.bounds],
                            metadatos=dict(fuente="Derivado: disolución de las zonas de manejo", anio=None, escala=None,
                                           nota="Límite calculado, no digitalizado.", pct_en_reserva=100.0)))

    # ---------- 3. Biodiversidad y predios ----------
    tabla, res_bio, inf_bio = BIO.preparar(origen, zonas, [z[0] for z in K.ZONAS])
    C.escribir_json(os.path.join(salida, "tablas/biodiversidad.json"), tabla)
    predios, aviso_pred = PRE.preparar(origen)
    C.escribir_json(os.path.join(salida, "tablas/predios.json"), predios, indent=1)
    cob_fcv = cobertura_fcv(predios)

    # ---------- 4. Métricas por zona (zonas.json) ----------
    def sup_por(cid, campo, zona_p):
        out = defaultdict(float)
        for g, p in memoria[cid]:
            ha = g.intersection(zona_p).area / 1e4
            if ha > 0:
                out[p.get(campo) or "(sin dato)"] += ha
        return [dict(nombre=k, ha=round(v, 2)) for k, v in sorted(out.items(), key=lambda kv: -kv[1])]

    def largo_km(cid, zona_p):
        return round(sum(g.intersection(zona_p).length for g, _ in memoria[cid]) / 1e3, 2)

    def metricas(zona_p):
        cob = sup_por("cobertura_rab", "cobertura", zona_p)
        for c in cob:
            c["clase"] = COBERTURA_CLASE.get(c["nombre"], "otra")
        tot = sum(c["ha"] for c in cob) or 1
        nat = sum(c["ha"] for c in cob if c["clase"] == "natural")
        mix = sum(c["ha"] for c in cob if c["clase"] == "mixta")
        riesgos = {}
        for cap in catalogo:
            if cap.get("riesgo"):
                pts = [g for g, _ in memoria[cap["id"]]]
                riesgos[cap["riesgo"]] = sum(1 for p in pts if zona_p.covers(p))
        return dict(area_ha=round(zona_p.area / 1e4, 2), cobertura=cob, cobertura_natural_pct=round(100 * nat / tot, 1),
                    cobertura_natural_mixta_pct=round(100 * (nat + mix) / tot, 1), uso_suelo=sup_por("uso_suelo_rab", "uso_principal", zona_p),
                    geomorfologia=sup_por("geomorfologia_rab", "unidad", zona_p), zonas_vida=sup_por("zonas_vida_rab", "zona_vida", zona_p),
                    microcuencas=sup_por("microcuencas", "nombre", zona_p), red_hidrica_km=largo_km("red_hidrica", zona_p),
                    vias_km=largo_km("vias_caminos", zona_p), riesgos=riesgos, riesgos_total=sum(riesgos.values()))

    metr = {"toda": metricas(reserva_p)}
    for zid, gp in zonas_p.items():
        metr[zid] = metricas(gp)
    # Riesgos en toda = dentro + entorno (todos los puntos registrados)
    todos = {}
    for cap in catalogo:
        if cap.get("riesgo"):
            todos[cap["riesgo"]] = cap["n"]
    metr["toda"]["riesgos_entorno"] = {k: todos[k] - metr["toda"]["riesgos"][k] for k in todos}
    metr["toda"]["riesgos"] = todos
    metr["toda"]["riesgos_total"] = sum(todos.values())
    for k in metr:
        metr[k]["biodiversidad"] = res_bio[k]

    # Alertas: puntos de riesgo ordenados por cercanía a la zona de conservación
    cons = zonas_p["conservacion"]
    etiquetas = {"deslizamientos": "Deslizamiento", "incendios": "Incendio", "minas": "Riesgo de minado", "contaminacion": "Contaminación",
                 "extraccion": "Extracción", "ingresos": "Ingreso no permitido", "perros": "Perros (cámara trampa)", "hongo": "Hongo",
                 "fumigacion": "Fumigación con aerosoles"}
    alertas, vistos = [], {}
    for cap in catalogo:
        r = cap.get("riesgo")
        if not r:
            continue
        for g, p in memoria[cap["id"]]:
            geo = C.a_geo(g)
            llave = (r, round(geo.x, 5), round(geo.y, 5))
            if llave in vistos:
                vistos[llave]["n"] += 1
                continue
            item = dict(tipo=r, etiqueta=etiquetas[r], lat=round(geo.y, 6), lon=round(geo.x, 6), zona=p.get("zona"),
                        dist_conservacion_m=round(g.distance(cons)), n=1)
            vistos[llave] = item
            alertas.append(item)
    alertas.sort(key=lambda a: (a["dist_conservacion_m"], a["tipo"]))

    zonas_json = dict(
        version=1,
        reserva=dict(area_ha=metr["toda"]["area_ha"], bbox=[round(v, 5) for v in reserva.bounds],
                     centro=[round(reserva.centroid.x, 5), round(reserva.centroid.y, 5)]),
        zonas=[dict(id=z[0], nombre=z[1], color=z[2], area_ha=metr[z[0]]["area_ha"],
                    bbox=[round(v, 5) for v in zonas[i][1].bounds]) for i, z in enumerate(K.ZONAS)],
        metricas=metr, alertas=alertas,
        predios=predios["resumen"], cobertura_fcv=cob_fcv,
        etiquetas_riesgo=etiquetas,
        notas=dict(
            cobertura="Clasificación del tablero sobre la capa de coberturas de Corpocaldas: natural = bosque denso alto, arbustal denso y vegetación secundaria; mixta = bosque fragmentado con pastos y cultivos y mosaico de pastos con espacios naturales; transformada = pastos.",
            area="Áreas calculadas en EPSG:9377 (MAGNA-SIRGAS / Origen Nacional).",
            biodiversidad="En 'Toda la reserva' se cuentan todos los registros; al elegir una zona solo los georreferenciados dentro de ella.",
            predios="La suma SIG de predios adquiridos se compara con el área de la reserva; la base predial no tiene geometría, por eso no se filtra por zona."))
    C.escribir_json(os.path.join(salida, "zonas.json"), zonas_json)

    # ---------- 5. Catálogo e informe ----------
    cat_json = dict(version=1, temas=[dict(id=i, nombre=n) for i, n in K.TEMAS],
                    modos=[dict(id=i, nombre=n, capas=c) for i, n, c in K.MODOS],
                    leyenda_cobertura_monitoreo=K.COBERTURAS_MONITOREO, capas=catalogo)
    C.escribir_json(os.path.join(salida, "catalogo.json"), cat_json)
    rep = dict(capas=informe, biodiversidad=inf_bio, predios=dict(resumen=predios["resumen"], avisos=aviso_pred),
               total_bytes_capas=sum(c["bytes"] for c in catalogo),
               capa_mas_pesada=max(catalogo, key=lambda c: c["bytes"])["id"])
    C.escribir_json(os.path.join(salida, "_reporte_preparacion.json"), rep, indent=1)
    print(f"Capas: {len(catalogo)} | peso total capas: {rep['total_bytes_capas']/1e6:.2f} MB | más pesada: {rep['capa_mas_pesada']}")
    print("Informe en", os.path.join(salida, "_reporte_preparacion.json"))


CLASE_FCV = {"bosque_avanzado": "natural", "bosque_joven": "natural", "matorral": "natural",
             "plantacion_pino": "plantacion", "pastizal": "transformada", "cultivos": "transformada",
             "sin_vegetacion": "otra", "vias": "otra", "drenajes": "otra"}
ETIQ_FCV = {"bosque_avanzado": "Bosque avanzado", "bosque_joven": "Bosque joven", "matorral": "Matorral", "plantacion_pino": "Bosque de pino",
            "pastizal": "Pastizal", "cultivos": "Cultivos", "sin_vegetacion": "Zonas sin vegetación", "vias": "Vías", "drenajes": "Drenajes"}


def cobertura_fcv(predios):
    """Cobertura declarada por FCV en la base predial (solo predios adquiridos con dato)."""
    ad = [p for p in predios["predios"] if p["estado"] == "Adquirido"]
    con = [p for p in ad if p["cobertura_ha"]]
    ha = defaultdict(float)
    for p in con:
        for k, v in p["cobertura_ha"].items():
            ha[k] += v
    tot = sum(ha.values()) or 1
    nat = sum(v for k, v in ha.items() if CLASE_FCV.get(k) == "natural")
    return dict(
        clases=[dict(nombre=ETIQ_FCV[k], ha=round(v, 2), clase=CLASE_FCV[k]) for k, v in sorted(ha.items(), key=lambda kv: -kv[1])],
        ha_total=round(tot, 2), natural_pct=round(100 * nat / tot, 1), predios_con_dato=len(con), predios_adquiridos=len(ad),
        nota="Declarada por FCV por predio (no por zona). Natural = bosque avanzado + bosque joven + matorral.")


def _coords(c):
    if c and isinstance(c[0], (int, float)):
        yield (c[0], c[1])
    else:
        for x in c:
            yield from _coords(x)


if __name__ == "__main__":
    main()
