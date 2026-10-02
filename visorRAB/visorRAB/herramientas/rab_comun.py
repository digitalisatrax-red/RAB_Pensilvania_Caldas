"""Utilidades compartidas del ETL de visorRAB."""
import json
import re
from pyproj import Transformer
from shapely.geometry import shape, mapping
from shapely.ops import transform as shp_transform

# Proyección plana oficial de Colombia (MAGNA-SIRGAS / Origen Nacional) para áreas y distancias
_A_PLANO = Transformer.from_crs(4326, 9377, always_xy=True)
_A_GEO = Transformer.from_crs(9377, 4326, always_xy=True)

# Campos técnicos heredados de ArcGIS / KML que nunca se publican
CAMPOS_TECNICOS = {
    "OBJECTID", "OBJECTID_1", "Shape_Leng", "SHAPE_Leng", "Shape_Area", "SHAPE_Area",
    "Shape_Le_1", "SymbolID", "AltMode", "FolderPath", "Base", "Snippet", "PopupInfo",
    "HasLabel", "LabelID", "OID_", "ORIG_FID", "X", "Y", "GLOBALID", "FID_Area_m",
}

_RE_MOJIBAKE = re.compile("[ÃÂâ][\u0080-ÿŒœŠšŸŽžƒˆ˜–-›€™�]")


def hay_mojibake(texto):
    return isinstance(texto, str) and bool(_RE_MOJIBAKE.search(texto))


def reparar_texto(s):
    """Repara UTF-8 leído como cp1252/latin-1. Devuelve (texto, reparado)."""
    if not hay_mojibake(s):
        return s, False
    try:
        return s.encode("cp1252").decode("utf-8"), True
    except (UnicodeEncodeError, UnicodeDecodeError):
        pass
    # Caso con bytes perdidos ("Ã" seguido de U+FFFD): Á al inicio de "ÁREA/Áreas"; Í en el resto.
    t = re.sub("Ã\ufffd(?=rea|REA|Rea)", "\ue000", s)
    t = t.replace("Ã\ufffd", "\ue001")
    salida = bytearray()
    for ch in t:
        if ch == "\ue000":
            salida += b"\xc3\x81"
        elif ch == "\ue001":
            salida += b"\xc3\x8d"
        else:
            try:
                salida += ch.encode("cp1252")
            except UnicodeEncodeError:
                salida += ch.encode("utf-8")
    return salida.decode("utf-8", errors="replace"), True


def reparar_objeto(o):
    """Aplica reparar_texto a claves y valores (recursivo). Devuelve (obj, n_reparados)."""
    n = 0
    if isinstance(o, dict):
        out = {}
        for k, v in o.items():
            k2, r1 = reparar_texto(k)
            v2, r2 = reparar_objeto(v)
            n += int(r1) + r2
            out[k2] = v2
        return out, n
    if isinstance(o, list):
        res = [reparar_objeto(x) for x in o]
        return [r[0] for r in res], sum(r[1] for r in res)
    if isinstance(o, str):
        t, r = reparar_texto(o)
        return t, int(r)
    return o, 0


def a_plano(geom):
    return shp_transform(_A_PLANO.transform, geom)


def a_geo(geom):
    return shp_transform(_A_GEO.transform, geom)


def area_ha(geom_geo):
    return a_plano(geom_geo).area / 1e4


def longitud_km(geom_geo):
    return a_plano(geom_geo).length / 1e3


def quitar_z(geom):
    """Elimina la dimensión Z para reducir peso."""
    from shapely import wkb
    return wkb.loads(wkb.dumps(geom, output_dimension=2))


def redondear_coords(obj, nd):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], nd), round(obj[1], nd)]
        return [redondear_coords(x, nd) for x in obj]
    return obj


def geom_a_dict(geom, nd):
    d = mapping(geom)
    return {"type": d["type"], "coordinates": redondear_coords(d["coordinates"], nd)}


def cargar_geojson(ruta):
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh)


def escribir_json(ruta, obj, indent=None):
    import os
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":") if indent is None else None, indent=indent)
    return os.path.getsize(ruta)


def slug(texto):
    import unicodedata
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", t.lower()).strip("_")
