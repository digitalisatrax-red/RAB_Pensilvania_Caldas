"""Definición declarativa de las capas de visorRAB (temas, símbolos, popups, metadatos).

El visor no conoce ninguna capa por nombre: recorre data/catalogo.json, que se genera aquí.
Agregar una capa = agregar una entrada en CAPAS y volver a correr preparar_datos.py.
Los metadatos que no se pudieron verificar en la fuente quedan en None y el visor los
muestra como "Por confirmar" (no se inventan).
"""

TEMAS = [
    ("zonificacion", "Zonificación"),
    ("territorio", "Territorio físico"),
    ("agua", "Agua"),
    ("riesgos", "Riesgos"),
    ("monitoreo", "Monitoreo y biodiversidad"),
    ("accesos", "Rutas y accesos"),
    ("regional", "Contexto regional"),
]

ZONAS = [  # id, nombre, color, categorías de origen (normalizadas a minúsculas sin tildes)
    ("conservacion", "Zona de conservación", "#295d3e", ["zona de conservacion"]),
    ("restauracion", "Zona de restauración", "#8fb78c", ["zonas de restauracion"]),
    ("amortiguacion", "Zona de amortiguación", "#d9a441", ["zona de amortiguacion"]),
    ("uso_intensivo", "Zona de uso intensivo e infraestructura", "#b5533c",
     ["zona de uso intensivo e infraestructura", "zonas usos intensivo e infraestructura"]),
]

COBERTURAS_MONITOREO = {
    "BA": "Bosque avanzado (>30 años)", "BJ": "Bosque joven (8–30 años)",
    "M": "Matorral / arbustivo (<8 años)", "BP": "Bosque de pino", "P": "Pastizal",
}

PALETAS = {
    "verdes": ["#1f4d33", "#295d3e", "#4f8a5b", "#8fb78c", "#b9d4b0", "#d9e8d0"],
    "tierra": ["#7a5230", "#b5833f", "#d9a441", "#e6c27a", "#a67c52", "#cdb89a"],
    "agua": ["#1f5f8b", "#3f87b5", "#7bb0d1", "#a9cde3", "#295d3e", "#8fb78c"],
    "mixta": ["#295d3e", "#8fb78c", "#d9a441", "#b5533c", "#3f87b5", "#7a5230",
              "#6a4c93", "#c97b9c", "#5f6b61", "#a9cde3", "#e6c27a", "#4f8a5b"],
}

RIESGO_COLOR = {
    "deslizamientos": "#7a5230", "incendios": "#c0392b", "minas": "#111111",
    "contaminacion": "#6a4c93", "extraccion": "#d9a441", "ingresos": "#b5533c",
    "perros": "#3f87b5", "hongo": "#5f6b61", "fumigacion": "#c97b9c",
}


def P(color, **kw):
    return dict(tipo="simple", color=color, **kw)


def C(campo, paleta="mixta", valores=None):
    d = {"tipo": "categorica", "campo": campo, "paleta": paleta}
    if valores:
        d["valores"] = valores
    return d


# (carpeta, archivo, id, tema, nombre, simbologia, campos, meta, extras)
# campos: lista (origen, destino, etiqueta, formato) ; None = conservar todos los no técnicos
FCV = "FCV"
CORP = "Corpocaldas"
CAPAS = [
    # ---------------- Zonificación ----------------
    ("Zonificacion", "Ordenamiento_Predial_RAB", "ordenamiento_predial", "zonificacion",
     "Zonas de manejo (ordenamiento predial)", None,
     [("CATEGORIA", "categoria_origen", "Categoría (origen)", None), ("NOMBRE", "nombre", "Nombre", None)],
     dict(fuente=FCV, anio=None, escala=None, nota="Eje del tablero. Las categorías de origen se normalizan a 4 zonas de manejo; la suma de sus áreas coincide con la suma SIG de los predios adquiridos (≈461,7 ha)."), {}),
    ("Zonificacion", "Zonificacion_RAB", "infraestructura", "zonificacion",
     "Infraestructura de uso intensivo", P("#b5533c"),
     [("USO_SUELO", "uso_suelo", "Uso del suelo", None)],
     dict(fuente=FCV, anio=None, escala=None, nota="Cinco polígonos pequeños (≈0,6 ha en total); no sirve como eje de zonas por su tamaño."), {}),
    # ---------------- Territorio físico ----------------
    ("Suelos", "Uso_del_Suelo_RAB", "uso_suelo_rab", "territorio", "Uso del suelo – RAB", C("uso_principal", "verdes"),
     [("Uso_Princi", "uso_principal", "Uso principal", None), ("Vocacion", "vocacion", "Vocación", None),
      ("Oferta_Amb", "oferta_ambiental", "Oferta ambiental", None)],
     dict(fuente="Por confirmar (capa de uso/vocación del suelo)", anio=None, escala=None, nota=None), {}),
    ("Suelos", "Uso_del_Suelo_Tenerife", "uso_suelo_tenerife", "territorio", "Uso del suelo – Tenerife", C("uso_principal", "mixta"),
     [("Uso_Princi", "uso_principal", "Uso principal", None), ("Vocacion", "vocacion", "Vocación", None),
      ("Oferta_Amb", "oferta_ambiental", "Oferta ambiental", None)],
     dict(fuente="Por confirmar (capa de uso/vocación del suelo)", anio=None, escala=None, nota="Contexto municipal."), {}),
    ("Suelos", "Tipo_de_Suelo_RAB_Corpocaldas", "cobertura_rab", "territorio", "Coberturas y suelos – RAB (Corpocaldas)",
     C("cobertura", "verdes"),
     [("COBERTURA", "cobertura", "Cobertura", None), ("BIOMA", "bioma", "Bioma", None), ("CLIMA", "clima", "Clima", None),
      ("PAISAJE", "paisaje", "Paisaje", None), ("SUELO", "suelo", "Suelo", None), ("ECOSISTEMA", "ecosistema", "Ecosistema", None)],
     dict(fuente=CORP, anio=None, escala=None, nota="Es la fuente de las cifras de cobertura del tablero."), {}),
    ("Suelos", "Tipo_de_Suelo_Tenerife_Corpocaldas", "cobertura_tenerife", "territorio", "Coberturas y suelos – Tenerife (Corpocaldas)",
     C("cobertura", "mixta"),
     [("COBERTURA", "cobertura", "Cobertura", None), ("BIOMA", "bioma", "Bioma", None), ("CLIMA", "clima", "Clima", None),
      ("SUELO", "suelo", "Suelo", None), ("ECOSISTEMA", "ecosistema", "Ecosistema", None)],
     dict(fuente=CORP, anio=None, escala=None, nota="Contexto municipal (geometría simplificada para el visor)."), {}),
    ("Suelos", "Tipo_de_Suelo_RAB_IGAC", "suelo_igac_rab", "territorio", "Tipo de suelo – RAB (IGAC)", C("unidad", "tierra"),
     [("UCS_F", "unidad", "Unidad cartográfica", None), ("PAISAJE", "paisaje", "Paisaje", None), ("CLIMA", "clima", "Clima", None),
      ("TIPO_RELIE", "relieve", "Tipo de relieve", None), ("COMPONENTE", "componente", "Componente", None)],
     dict(fuente="IGAC", anio=None, escala=None, nota=None), {}),
    ("Suelos", "Tipo_de_Suelo_Tenerife_IGAC", "suelo_igac_tenerife", "territorio", "Tipo de suelo – Tenerife (IGAC)", C("unidad", "tierra"),
     [("UCS_F", "unidad", "Unidad cartográfica", None), ("PAISAJE", "paisaje", "Paisaje", None), ("CLIMA", "clima", "Clima", None),
      ("TIPO_RELIE", "relieve", "Tipo de relieve", None), ("COMPONENTE", "componente", "Componente", None)],
     dict(fuente="IGAC", anio=None, escala=None, nota="Contexto municipal."), {}),
    ("Geologia", "Geologia_RAB", "geologia_rab", "territorio", "Geología – RAB", C("nombre", "tierra"),
     [("NOMBRE", "nombre", "Unidad geológica", None), ("CODIGO", "codigo", "Código", None), ("SIMBOLO_UC", "simbolo", "Símbolo", None)],
     dict(fuente="Por confirmar", anio=None, escala=None, nota=None), {}),
    ("Geologia", "Geologia_Tenerife", "geologia_tenerife", "territorio", "Geología – Tenerife", C("nombre", "tierra"),
     [("NOMBRE", "nombre", "Unidad geológica", None), ("CODIGO", "codigo", "Código", None), ("SIMBOLO_UC", "simbolo", "Símbolo", None)],
     dict(fuente="Por confirmar", anio=None, escala=None, nota="Contexto municipal."), {}),
    ("Geologia", "Fallas_Geologicas_Tenerife", "fallas_tenerife", "territorio", "Fallas geológicas – Tenerife", P("#7a2e1d", grosor=2, trazo=True),
     [("TIPO_FALLA", "tipo_falla", "Tipo de falla", None)],
     dict(fuente="Por confirmar", anio=None, escala=None, nota="Contexto municipal."), {}),
    ("Geomorfologia", "Geomorfologia_RAB_2012", "geomorfologia_rab", "territorio", "Geomorfología – RAB (2012)", C("unidad", "tierra"),
     [("Unidad", "unidad", "Unidad geomorfológica", None), ("Codigo", "codigo", "Código", None)],
     dict(fuente="Por confirmar", anio=2012, escala=None, nota=None), {}),
    ("Geomorfologia", "Geomorfologia_Tenerife_2012", "geomorfologia_tenerife", "territorio", "Geomorfología – Tenerife (2012)", C("unidad", "tierra"),
     [("Unidad", "unidad", "Unidad geomorfológica", None), ("Codigo", "codigo", "Código", None)],
     dict(fuente="Por confirmar", anio=2012, escala=None, nota="Contexto municipal."), {}),
    ("Zonas_de_Vida", "Zonas_de_Vida_RAB", "zonas_vida_rab", "territorio", "Zonas de vida (Holdridge) – RAB", C("zona_vida", "verdes"),
     [("ZON_HOLDRI", "zona_vida", "Zona de vida", None), ("SIMBOLO", "simbolo", "Símbolo", None), ("RANGO_PREC", "precipitacion_mm", "Precipitación (mm)", None),
      ("RANGO_TEMP", "temperatura_c", "Temperatura (°C)", None), ("ALTURA__40", "altitud_m", "Altitud (m)", None)],
     dict(fuente="Por confirmar (clasificación de Holdridge)", anio=None, escala=None, nota=None), {}),
    ("Zonas_de_Vida", "Zonas_de_Vida_Tenerife", "zonas_vida_tenerife", "territorio", "Zonas de vida (Holdridge) – Tenerife", C("zona_vida", "mixta"),
     [("ZON_HOLDRI", "zona_vida", "Zona de vida", None), ("SIMBOLO", "simbolo", "Símbolo", None), ("RANGO_PREC", "precipitacion_mm", "Precipitación (mm)", None),
      ("RANGO_TEMP", "temperatura_c", "Temperatura (°C)", None), ("ALTURA__40", "altitud_m", "Altitud (m)", None)],
     dict(fuente="Por confirmar (clasificación de Holdridge)", anio=None, escala=None, nota="Contexto municipal."), {}),
    # ---------------- Agua ----------------
    ("Hidrologia", "Red_Hidrica_Orden_3", "red_hidrica", "agua", "Red hídrica (orden 3)", P("#3f87b5", grosor=1),
     [], dict(fuente="Por confirmar", anio=None, escala=None, nota="Se conserva una sola copia: las tres 'copia' eran idénticas en entidades y extensión."), {}),
    ("Hidrologia", "Rio_Tenerife", "rio_tenerife", "agua", "Río Tenerife", P("#1f5f8b", grosor=3),
     [("NOMBRE_GEO", "nombre", "Nombre", None)], dict(fuente="Por confirmar", anio=None, escala=None, nota=None), {}),
    ("Hidrologia", "Subcuenca_Tenerife", "subcuenca_tenerife", "agua", "Subcuenca río Tenerife", P("#1f5f8b", relleno=0.08),
     [("NOMBRE", "nombre", "Nombre", None)], dict(fuente="Por confirmar", anio=None, escala=None, nota=None), {}),
    ("Hidrologia", "Area_de_Microcuencas", "microcuencas", "agua", "Microcuencas", C("nombre", "agua"),
     [("Nombre", "nombre", "Microcuenca", None)], dict(fuente="Por confirmar", anio=None, escala=None, nota="Cuatro microcuencas que incluyen a la reserva y la exceden."), {}),
    ("Hidrologia", "Area_de_Microcuencas_unificada", "microcuencas_unificada", "agua", "Microcuencas (unificada)", P("#3f87b5", relleno=0.1),
     [("Nombre", "nombre", "Nombre", None)], dict(fuente="Por confirmar", anio=None, escala=None, nota=None), {}),
] + [
    ("Hidrologia", f"Quebrada_{n}", f"quebrada_{s}", "agua", f"Quebrada {t}", P("#3f87b5", grosor=2), [],
     dict(fuente="Por confirmar", anio=None, escala=None, nota="Cauce completo (contexto regional)."), {"nombre_fijo": f"Quebrada {t}"})
    for n, s, t in [("Honda", "honda", "Honda"), ("La_Cristalina", "la_cristalina", "La Cristalina"),
                    ("Santa_Rosa", "santa_rosa", "Santa Rosa"), ("Santa_Teresa", "santa_teresa", "Santa Teresa")]
] + [
    ("Hidrologia", f"Quebrada_{n}_tramo_RAB", f"quebrada_{s}_tramo", "agua", f"Microcuenca Quebrada {t}", P("#3f87b5", relleno=0.12),
     [("Nombre", "nombre", "Nombre", None)], dict(fuente="Por confirmar", anio=None, escala=None, nota="Área de drenaje asociada a la reserva (excede sus límites)."), {})
    for n, s, t in [("Honda", "honda", "Honda"), ("La_Cristalina", "la_cristalina", "La Cristalina"),
                    ("Santa_Rosa", "santa_rosa", "Santa Rosa"), ("Santa_Teresa", "santa_teresa", "Santa Teresa")]
] + [
    # ---------------- Riesgos: puntos ----------------
    ("Riesgos", "Deslizamientos_RAB", "deslizamientos", "riesgos", "Deslizamientos", P(RIESGO_COLOR["deslizamientos"], radio=6),
     [("Name", "id_registro", "Registro", None)], dict(fuente=FCV, anio=None, escala=None, nota="Puntos de riesgo; no prueban afectación."), {"riesgo": "deslizamientos"}),
    ("Riesgos", "Deslizamientos_registro_Karen", "deslizamientos_gps", "riesgos", "Deslizamientos (waypoints GPS)", P(RIESGO_COLOR["deslizamientos"], radio=4),
     [("ident", "id_registro", "Registro", None), ("time_", "fecha", "Fecha/hora", None)], dict(fuente=FCV, anio=2023, escala=None, nota="Waypoints Garmin del 03-ago-2023. No se suman a los conteos para no duplicar."), {}),
    ("Riesgos", "Incendios", "incendios", "riesgos", "Incendios", P(RIESGO_COLOR["incendios"], radio=6), [], dict(fuente=FCV, anio=None, escala=None, nota="Puntos de riesgo; no prueban afectación."), {"riesgo": "incendios"}),
    ("Riesgos", "Minas", "minas", "riesgos", "Riesgo de minado", P(RIESGO_COLOR["minas"], radio=6), [("Name", "id_registro", "Registro", None)], dict(fuente="Por confirmar (kmz 'Riesgo_Minado')", anio=None, escala=None, nota="Puntos de riesgo; no prueban afectación."), {"riesgo": "minas"}),
    ("Riesgos", "Contaminacion", "contaminacion", "riesgos", "Contaminación", P(RIESGO_COLOR["contaminacion"], radio=6), [], dict(fuente=FCV, anio=None, escala=None, nota=None), {"riesgo": "contaminacion"}),
    ("Riesgos", "Extraccion", "extraccion", "riesgos", "Extracción", P(RIESGO_COLOR["extraccion"], radio=6), [], dict(fuente=FCV, anio=None, escala=None, nota=None), {"riesgo": "extraccion"}),
    ("Riesgos", "Ingresos_No_Permitidos", "ingresos", "riesgos", "Ingresos no permitidos", P(RIESGO_COLOR["ingresos"], radio=6), [("OBSER", "observacion", "Observación", None)], dict(fuente=FCV, anio=None, escala=None, nota=None), {"riesgo": "ingresos"}),
    ("Riesgos", "Perros", "perros", "riesgos", "Perros (cámaras trampa)", P(RIESGO_COLOR["perros"], radio=5),
     [("Fecha_regi", "fecha", "Fecha", None), ("Localidad_", "localidad", "Localidad", None), ("Cobertura", "cobertura", "Cobertura", None),
      ("Nombre_com", "nombre_comun", "Nombre común", None), ("Individuos", "individuos", "Individuos", None)],
     dict(fuente="FCV – cámaras trampa", anio=None, escala=None, nota="Cada punto es una detección fotográfica."), {"riesgo": "perros"}),
    ("Riesgos", "Hongo", "hongo", "riesgos", "Hongo", P(RIESGO_COLOR["hongo"], radio=6), [("OBSER", "observacion", "Observación", None)], dict(fuente=FCV, anio=None, escala=None, nota=None), {"riesgo": "hongo"}),
    ("Riesgos", "Fumigacion_con_Aerosoles", "fumigacion", "riesgos", "Fumigación con aerosoles", P(RIESGO_COLOR["fumigacion"], radio=6), [], dict(fuente=FCV, anio=None, escala=None, nota=None), {"riesgo": "fumigacion"}),
    ("Riesgos", "Puntos_de_Riesgo_combinados", "riesgos_combinados", "riesgos", "Puntos de riesgo combinados", P("#5f6b61", radio=4),
     [("OBSER", "observacion", "Observación", None)], dict(fuente=FCV, anio=None, escala=None, nota="Compilación de capas individuales; no se usa en conteos para no duplicar."), {}),
    # ---------------- Riesgos: buffers ----------------
] + [
    ("Riesgos", f"Buffer_de_{n}", f"buffer_{s}", "riesgos", f"Buffer {t} (100 m)", P(RIESGO_COLOR[k], relleno=0.18), [],
     dict(fuente=FCV, anio=None, escala=None, nota="Buffer de 100 m alrededor de cada punto."), {})
    for n, s, t, k in [("Deslizamientos", "deslizamientos", "deslizamientos", "deslizamientos"), ("Incendios", "incendios", "incendios", "incendios"),
                       ("Minas", "minas", "minas", "minas"), ("Contaminacion", "contaminacion", "contaminación", "contaminacion"),
                       ("Extraccion", "extraccion", "extracción", "extraccion"), ("Ingresos_No_Permitidos", "ingresos", "ingresos no permitidos", "ingresos")]
] + [
    ("Riesgos", f"Buffer_de_Riesgos_{n}", f"buffer_riesgos_{s}", "riesgos", f"Buffer de riesgos {t}", P("#b5533c", relleno=0.12), [],
     dict(fuente=FCV, anio=None, escala=None, nota="Disolución de buffers de todos los riesgos."), {})
    for n, s, t in [("completo", "completo", "(completo)"), ("200_m", "200m", "200 m"), ("300_m", "300m", "300 m"),
                    ("500_m", "500m", "500 m"), ("1_km", "1km", "1 km")]
] + [
    ("Riesgos", "Buffer_de_Riesgos_general", "buffer_riesgos_detalle", "riesgos", "Buffer de riesgos (detalle, 59 entidades)", P("#b5533c", relleno=0.12),
     [("OBSER", "observacion", "Observación", None)], dict(fuente=FCV, anio=None, escala=None, nota="Capa de detalle; se descartan las 30 columnas heredadas de uniones de ArcGIS."), {}),
    # ---------------- Monitoreo ----------------
    ("Sitios_de_Monitoreo", "Puntos_de_Parcelas", "parcelas", "monitoreo", "Parcelas de monitoreo", P("#295d3e", radio=7, borde="#ffffff"),
     [("Name", "nombre", "Parcela", None)], dict(fuente=FCV, anio=None, escala=None, nota="Códigos: BA, BJ, BP, M según cobertura."), {"sitio": True}),
    ("Sitios_de_Monitoreo", "Puntos_de_Transectos", "transectos_puntos", "monitoreo", "Puntos de transectos", P("#4f8a5b", radio=4, borde="#ffffff"),
     [("Name", "punto", "Punto", None), ("Cobertura", "cobertura", "Cobertura", None)], dict(fuente=FCV, anio=None, escala=None, nota=None), {}),
    ("Sitios_de_Monitoreo", "Transectos_de_Monitoreo", "transectos", "monitoreo", "Transectos de monitoreo", P("#295d3e", grosor=3),
     [("Name", "nombre", "Transecto", None), ("COBER", "cobertura", "Cobertura", None)], dict(fuente=FCV, anio=None, escala=None, nota=None), {"sitio": True}),
    # ---------------- Accesos ----------------
    ("Rutas", "Vias_y_Caminos_RAB", "vias_caminos", "accesos", "Vías y caminos", P("#7a5230", grosor=2),
     [("TIPO", "tipo", "Tipo", None), ("RUTA", "ruta", "Ruta", None), ("DESCRIP", "descripcion", "Descripción", None)], dict(fuente=FCV, anio=None, escala=None, nota=None), {}),
    ("Rutas", "Ruta_de_Educacion_Ambiental", "ruta_educacion", "accesos", "Ruta de educación ambiental", P("#d9a441", grosor=3),
     [("DESCRIP", "descripcion", "Descripción", None), ("NIVEL", "nivel", "Nivel", None)], dict(fuente=FCV, anio=None, escala=None, nota=None), {}),
    ("Rutas", "Rutas_Alejandro", "rutas_alejandro", "accesos", "Rutas (Alejandro)", P("#b5833f", grosor=2),
     [("RUTA", "ruta", "Ruta", None), ("DESCRIP", "descripcion", "Descripción", None)], dict(fuente=FCV, anio=None, escala=None, nota=None), {}),
    # ---------------- Regional ----------------
    ("KBA_Selva_de_Florencia", "KBA_Selva_de_Florencia", "kba_selva_florencia", "regional", "KBA Selva de Florencia", P("#6a4c93", relleno=0.08),
     [("NatName", "nombre", "Nombre", None), ("KbaStatus", "estado_kba", "Estado KBA", None), ("Criteria", "criterios", "Criterios", None), ("KBA_Qual", "cualificacion", "Cualificación", None)],
     dict(fuente="BirdLife / KBA (IBA Direct)", anio=None, escala=None, nota="Sitio confirmado; polígono refinado según el atributo DelGeom de la fuente."), {}),
    ("Imagen_Satelital", "Area_de_Imagen_Satelital_RAB", "imagen_satelital", "regional", "Cobertura de imagen satelital", P("#5f6b61", relleno=0.05),
     [("ImageSourc", "imagen", "Imagen", None)], dict(fuente="Jilin-1 (JL1KF01B)", anio=2023, escala=None, nota="Fecha inferida del identificador de la imagen: 23-jul-2023."), {}),
]

# Capas visibles por defecto en cada modo de vista (ids del catálogo)
MODOS = [
    ("zonificacion", "Zonificación", ["ordenamiento_predial", "limite_rab", "parcelas"]),
    ("biodiversidad", "Biodiversidad", ["limite_rab", "parcelas", "transectos", "ordenamiento_predial"]),
    ("riesgos", "Riesgos", ["limite_rab", "deslizamientos", "incendios", "minas", "contaminacion", "extraccion", "ingresos", "buffer_riesgos_completo"]),
    ("agua", "Agua", ["limite_rab", "microcuencas", "red_hidrica", "rio_tenerife"]),
    ("territorio", "Territorio físico", ["limite_rab", "cobertura_rab", "zonas_vida_rab"]),
]
