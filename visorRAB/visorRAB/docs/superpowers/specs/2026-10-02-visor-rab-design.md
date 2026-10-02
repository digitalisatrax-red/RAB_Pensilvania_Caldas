# visorRAB — Tablero de la Reserva Ambiental Bellavista

**Fecha:** 2026-10-02
**Estado:** aprobado para planificación
**Autora de la decisión:** Karen (FCV)

## 1. Propósito

Un tablero web que reúna toda la información territorial y de monitoreo de la
Reserva Ambiental Bellavista (RAB) en un solo instrumento, con dos usos
simultáneos:

- **Gestión interna y monitoreo.** El equipo técnico de la FCV consulta el
  estado de parcelas, transectos, riesgos activos y predios, y extrae los datos
  crudos sin depender de nadie.
- **Reporte a donantes y aliados.** Las mismas cifras se presentan como
  indicadores y gráficos listos para adjuntar a un informe.

No se construyen dos interfaces. Es una sola: los KPIs y gráficos sirven el
relato, y cada tabla lleva exportación a CSV para quien necesita el dato.

### Criterios de éxito

1. El tablero carga y muestra cifras en menos de 2 segundos con conexión normal.
2. Seleccionar una zona de manejo recalcula todos los indicadores sin pedir red.
3. Cualquier dato visible se puede exportar (CSV para tablas, GeoJSON para capas).
4. Ningún dato personal de propietarios de predios llega al repositorio público.
5. El sitio se despliega sin modificaciones en GitHub Pages, en un servidor
   propio o en Azure Static Web Apps.

### Fuera de alcance (v1)

- Clima, coberturas CLC, conectividad, ecosistemas, monitoreo con dron, flora,
  SIB Colombia, uso de suelo tabular y vértices. Son las bases `BD_*` restantes;
  entran en una versión posterior.
- Edición de datos desde el navegador. El tablero es de solo lectura.
- Autenticación o control de acceso por rol.
- Tiles vectoriales (PMTiles). El catálogo deja la puerta abierta sin rehacer nada.

## 2. Decisiones tomadas

| Decisión | Elección | Razón |
|---|---|---|
| Base visual | `Amenazas_Caldas` ("Caldas en cifras") | Patrón que la FCV ya aprobó, con el logo institucional |
| Arquitectura | Sitio estático modular con ETL en Python | Mantenible y versionable; el monolito de 16 MB no escala a 62 capas |
| Eje de filtro | Zona de manejo (`Zonificacion_RAB`, 5 zonas) | Análogo directo del selector "municipio"; ya existe como capa |
| Alcance de datos v1 | 62 capas GeoJSON + biodiversidad + predios | Cubre monitoreo interno y relato de donantes sin inflar el ETL |
| Visibilidad | Repo público, predios anonimizados | Permite GitHub Pages gratuito sin exponer datos personales |
| Despliegue activo | GitHub Pages | Decisión de la usuaria: "por ahora todo en GitHub" |
| Ubicación del repo | `C:\Users\Karen\Proyectos\visorRAB` | Fuera de Google Drive, cuya sincronización corrompe carpetas `.git` |

## 3. Datos de origen

Todo vive en `G:\Mi unidad\2026\FCV\RAB`. El ETL lee de ahí y nunca escribe ahí.

### 3.1 Capas espaciales

62 archivos en `GEOJSON/`, 17 MB, EPSG:4326, en 11 temas:

| Tema | Capas | Peso |
|---|---|---|
| Suelos | 6 | 11 MB |
| Hidrología | 16 | 2,0 MB |
| Riesgos | 23 | 1,8 MB |
| Geología | 3 | 821 KB |
| Rutas | 3 | 666 KB |
| Geomorfología | 2 | 525 KB |
| Zonificación | 2 | 301 KB |
| Zonas de vida | 2 | 118 KB |
| Sitios de monitoreo | 3 | 49 KB |
| KBA Selva de Florencia | 1 | 24 KB |
| Imagen satelital | 1 | 10 KB |

`RAB/RAB_datos.gpkg` contiene las mismas 62 capas. Se usa `GEOJSON/` como fuente
porque es texto versionable; el GeoPackage queda como respaldo de referencia.

### 3.2 Tablas

- `BD_BIODIVERSIDAD/` — aves (2.059 registros, 36 columnas), herpetos, mamíferos,
  mariposas. La hoja `BD Aves` trae `Fuente, ID, Fecha, Mes, Cobertura, Parcela,
  Quebrada, Transecto, Hora, Método`, que permite enlazar a geometría.
- `BD_PREDIOS/BD_PREDIOS/PREDIOS_ADQUIRIDOS_COBERTURAS.xlsx` — hoja `PREDIOS_RAB`,
  26 filas, 26 columnas.

### 3.3 Problemas detectados en el origen

Estos no son hipótesis; están verificados sobre los archivos.

1. **Encoding corrupto en 11 de 62 capas.** UTF-8 leído como latin-1 y guardado
   así: `"Línea 4"` aparece como `"LÃ­nea 4"`. Afecta a
   `Geologia/Fallas_Geologicas_Tenerife`, `Geologia/Geologia_Tenerife`,
   `Geomorfologia/Geomorfologia_RAB_2012`, `Geomorfologia/Geomorfologia_Tenerife_2012`,
   `Hidrologia/Rio_Tenerife`, `Riesgos/Perros`,
   `Sitios_de_Monitoreo/Transectos_de_Monitoreo`, `Suelos/Tipo_de_Suelo_RAB_IGAC`,
   `Suelos/Tipo_de_Suelo_Tenerife_IGAC`, `Suelos/Uso_del_Suelo_RAB`,
   `Suelos/Uso_del_Suelo_Tenerife`.
2. **Capas duplicadas.** `Red_Hidrica_Orden_3` y sus `copia_1/2/3` son
   funcionalmente idénticas: 676 entidades, mismos campos, mismo bbox
   (`-75,1446 / 5,3593 / -75,0090 / 5,5047`). Difieren solo en bytes. Se conserva
   una; se descartan tres (−1,2 MB).
3. **Una capa domina el peso.** `Suelos/Tipo_de_Suelo_Tenerife_Corpocaldas` pesa
   8,6 MB, la mitad del total.
4. **Campos técnicos heredados de ArcGIS** en casi todas las capas:
   `OBJECTID_1`, `Shape_Leng`, `Shape_Area`, `SymbolID`, `AltMode`, `FolderPath`,
   `HasLabel`, `LabelID`, `Base`, `Snippet`, `PopupInfo`.
5. **Datos personales.** `PREDIOS_RAB` contiene `PROPIETARIO`,
   `PROPIETARIO_ANTERIOR`, `NO. MATRICULA` y `COD_CATASTRAL`.
6. **Pares reserva/contexto.** Varias capas vienen duplicadas en versión `_RAB`
   (411 ha) y `_Tenerife` (municipal). Mezclarlas falsea cualquier cifra.

## 4. Estructura del repositorio

```
visorRAB/
├── README.md
├── index.html                      # cascarón del tablero, sin datos
├── .nojekyll
├── staticwebapp.config.json        # Azure: MIME de .geojson, caché
├── manifest.webmanifest
├── sw.js                           # service worker, cacheo para campo
├── assets/
│   ├── logo-fcv.png
│   └── icon-{192,512}.png
├── css/
│   ├── rab-tema.css                # tokens de marca FCV
│   ├── rab-tablero.css             # grilla y tarjetas
│   └── rab-impresion.css           # hoja de estilo de la ficha imprimible
├── js/
│   ├── rab-catalogo.js
│   ├── rab-mapa.js
│   ├── rab-kpis.js
│   ├── rab-graficos.js
│   ├── rab-tablas.js
│   ├── rab-herramientas.js         # medir, coordenadas, GPS, pantalla completa
│   ├── rab-buscador.js
│   └── rab-estado.js               # enlaces permanentes (URL ↔ estado)
├── vendor/
│   └── maplibre-gl.{js,css}
├── data/                           # generado por el ETL, versionado
│   ├── catalogo.json
│   ├── zonas.json
│   ├── _reporte_preparacion.json
│   ├── capas/<tema>/<capa>.geojson
│   └── tablas/{biodiversidad,predios}.json
├── herramientas/
│   ├── preparar_datos.py
│   ├── preparar_biodiversidad.py
│   ├── preparar_predios.py
│   ├── construir_catalogo.py
│   └── pruebas/                    # pruebas del ETL
├── docs/
│   ├── ORGANIZACION_DATOS.md
│   ├── DESPLIEGUE.md
│   └── superpowers/specs/
└── .github/workflows/
    ├── pages.yml
    └── azure-static-web-apps.yml
```

Ningún módulo JS supera las ~400 líneas. Cuando uno crece más, es señal de que
hace dos cosas y se parte.

## 5. El ETL

`herramientas/preparar_datos.py` es idempotente: se vuelve a correr cuando cambia
una fuente y regenera `data/` completo. La ruta de origen es un parámetro, con
`G:\Mi unidad\2026\FCV\RAB` por defecto.

### 5.1 Pasos para las capas espaciales

1. **Reparar encoding.** Sobre las 11 capas afectadas, `.encode('latin-1').decode('utf-8')`.
   Se verifica que la salida no contenga secuencias `Ã`/`Â` seguidas de byte alto.
2. **Deduplicar.** Se eliminan `Red_Hidrica_Orden_3_copia_{1,2,3}`. Los
   `Buffer_de_Riesgos_{completo,1_km,200_m,300_m,500_m}` son disoluciones de una
   entidad cada uno y se conservan como variantes de radio;
   `Buffer_de_Riesgos_general` (59 entidades) queda como capa de detalle.
3. **Normalizar campos.** Se descartan los técnicos de ArcGIS listados en §3.3.
   Se recalculan `area_ha` y `longitud_km` con cálculo geodésico sobre el
   elipsoide WGS84, en vez de arrastrar los valores heredados, que vienen en
   unidades inconsistentes.
4. **Simplificar geometría.** Douglas-Peucker con tolerancia por ámbito:
   capas de `contexto` más agresiva, capas de `reserva` conservadora, límites
   administrativos y zonificación sin simplificar. Meta:
   `Tipo_de_Suelo_Tenerife_Corpocaldas` por debajo de 2 MB y total de `data/capas/`
   por debajo de 8 MB.
5. **Clasificar ámbito.** Cada capa recibe `ambito: "reserva" | "contexto"` según
   su sufijo y su extensión real. El visor carga `reserva` por defecto.
6. **Precalcular por zona.** Se intersecta cada capa temática contra las 5 zonas
   de `Zonificacion_RAB` y se escribe `data/zonas.json` con las cifras resueltas:
   área por zona, conteos por tema, desglose de uso de suelo, riesgos por tipo y
   especies por grupo. El navegador nunca hace geometría.

### 5.2 Tablas

`preparar_biodiversidad.py` unifica aves, herpetos, mamíferos y mariposas en un
esquema común:

```
grupo, familia, genero, especie, nombre_comun, fecha, anio, mes,
cobertura, parcela, transecto, abundancia, categoria_amenaza, fuente
```

El enlace a geometría se hace por los códigos que ya traen los registros contra
`Puntos_de_Parcelas.Name` y `Transectos_de_Monitoreo.Name`. Los registros sin
correspondencia se conservan, marcados como `sin_ubicacion: true`, y el reporte
del ETL informa cuántos son. Descartarlos en silencio falsearía los conteos.

`preparar_predios.py` emite `nombre_predio`, `area_ha`, `estado`
(adquirido / por adquirir) y nada más. Los cuatro campos personales de §3.3 se
excluyen mediante una lista negra explícita en el código, verificada por prueba.

### 5.3 El catálogo

`data/catalogo.json` desacopla el visor de los datos. Una entrada por capa:

```json
{
  "id": "zonificacion_rab",
  "tema": "Zonificación",
  "nombre": "Zonificación de la RAB",
  "ambito": "reserva",
  "archivo": "capas/zonificacion/zonificacion_rab.geojson",
  "geometria": "Polygon",
  "simbologia": { "tipo": "categorica", "campo": "uso_suelo", "paleta": "verdes" },
  "campos_popup": [
    { "campo": "uso_suelo", "etiqueta": "Uso del suelo" },
    { "campo": "area_ha", "etiqueta": "Área (ha)", "formato": "numero:2" }
  ],
  "metadatos": {
    "fuente": "FCV",
    "anio": 2024,
    "escala": "1:10.000",
    "nota": "Zonificación de manejo vigente"
  }
}
```

El visor no conoce ninguna capa por nombre: recorre el catálogo. Agregar una capa
es correr el ETL.

## 6. El tablero

Hereda el esqueleto de "Caldas en cifras": marco negro redondeado
(`#050706`, radio 39 px), sidebar oscuro de 158 px, lienzo blanco redondeado,
tarjetas `#f7f8f7`. Paleta `--ink:#18201c`, `--green:#295d3e`, `--green2:#8fb78c`,
`--pale:#f4f5f3`, `--edge:#e8ebe7`. Título **RESERVA EN CIFRAS** con las letras
finales en cajas verdes.

### 6.1 Sidebar

- Logo FCV con el pie "Fundación para la Conservación de la Vida Silvestre en
  Colombia".
- **MODO DE VISTA**: `Zonificación` (por defecto), `Biodiversidad`, `Riesgos`,
  `Agua`, `Territorio físico`. Cambia las capas del mapa y qué tarjetas se destacan.
- **ZONA DE MANEJO**: "Toda la reserva" más las 5 zonas. Filtra todo el tablero.
- **MAPA BASE**: Claro / Color / Oscuro.
- **CAPAS Y TRANSPARENCIA**: agrupadas por tema desde el catálogo, con casilla,
  deslizador de opacidad, ícono de metadatos y descarga en GeoJSON. Las capas de
  ámbito `contexto` van en un grupo aparte, apagadas.
- Pie con las fuentes.

### 6.2 Franja de KPIs

Seis indicadores, recalculados al cambiar de zona: zona seleccionada · superficie
en ha · hectáreas bajo protección predial · especies registradas · especies
amenazadas (VU/EN/CR) · puntos de riesgo.

### 6.3 Grilla principal

- **Mapa MapLibre** (tarjeta grande). Clic en zona la selecciona; clic en entidad
  abre popup con los campos del catálogo.
- **Zonas de manejo**: lista pulsable con barra proporcional de superficie.
- **Alertas y verificación**: puntos de riesgo ordenados por proximidad a zona de
  conservación, con la nota "señalan dónde verificar; no prueban afectación".

### 6.4 Grilla inferior

- **Uso del suelo**: anillo con porcentaje de cobertura natural al centro.
- **Biodiversidad por grupo**: barras por grupo taxonómico más serie anual de
  esfuerzo de muestreo, con control `▶` y deslizador de año.
- **Riesgos por tipo**: barras (deslizamientos, incendios, minas, contaminación,
  extracción, ingresos no permitidos, perros, hongo, fumigación).
- **Especies registradas**: tabla con buscador, filtro de categoría de amenaza y
  columnas grupo · especie · nombre común · registros · zona.

### 6.5 Instrumento completo

- **Enlaces permanentes.** El estado vive en la URL
  (`?modo=biodiversidad&zona=conservacion&capas=parcelas,transectos&base=oscuro`).
  Quien abre el enlace ve la misma vista.
- **Ficha de zona imprimible.** `rab-impresion.css` produce con `Ctrl+P` un PDF
  paginado con cifras, mapa y tablas de la zona, sin sidebar ni controles.
- **Herramientas de mapa.** Medición de distancia y área, coordenadas bajo el
  cursor, "ubícame" por GPS, pantalla completa, leyenda dinámica de capas activas.
- **Descarga.** GeoJSON por capa desde el panel de capas; CSV por tabla con los
  filtros aplicados.
- **Buscador global.** Busca en capas, especies y sitios de monitoreo; al elegir
  un resultado enciende la capa y vuela a la entidad.
- **Metadatos por capa.** Fuente, año, escala y nota visibles con un ícono de
  información.
- **Funciona sin señal.** `manifest.webmanifest` + service worker que cachea el
  cascarón y las capas visitadas.
- **Accesibilidad.** Contraste WCAG 2.1 AA, navegación completa por teclado,
  roles ARIA en controles, alternancia claro/oscuro que respeta la preferencia
  del sistema.
- **Responsivo.** El diseño original es de ancho fijo (1510 px). Se agregan puntos
  de quiebre: tres columnas en escritorio, dos en tableta, una en móvil, porque el
  equipo de campo lo abre desde el celular.

## 7. Flujo de datos

Al cargar se piden solo `catalogo.json` y `zonas.json` (~80 KB juntos); con eso se
pintan KPIs, listas y gráficos. Los GeoJSON se piden al encender su capa, se
cachean en memoria y no se vuelven a pedir. Cambiar de zona no toca la red: relee
`zonas.json`, que ya trae todo precalculado.

## 8. Errores

| Fallo | Comportamiento |
|---|---|
| Una capa no carga | Su fila se marca con el motivo; el resto del tablero sigue funcionando. Nunca pantalla en blanco. |
| El catálogo apunta a un archivo inexistente | El ETL falla al generarlo, no el visor en producción. |
| Una zona no tiene datos de un tema | La tarjeta muestra "sin registros en esta zona", no un cero. Un cero y un vacío significan cosas distintas para quien decide. |
| El navegador no da permiso de GPS | La herramienta "ubícame" se deshabilita con aviso; nada más se ve afectado. |
| Falla la red con el service worker activo | Se sirve el cascarón y las capas ya visitadas desde caché, con un indicador de "sin conexión". |

## 9. Verificación

El ETL emite `data/_reporte_preparacion.json` con, por capa: entidades de entrada
y salida, bytes antes y después, tolerancia de simplificación aplicada y campos
descartados.

Las pruebas se escriben antes del código (TDD) y cubren lo que puede romperse en
silencio:

1. **Sin mojibake.** Ninguna capa de salida contiene secuencias `Ã`/`Â` seguidas
   de byte alto.
2. **Áreas coherentes.** La suma de áreas por zona cuadra con el área total de la
   reserva dentro del 1 %.
3. **Sin datos personales.** `predios.json` no contiene `PROPIETARIO`,
   `PROPIETARIO_ANTERIOR`, `NO. MATRICULA` ni `COD_CATASTRAL`, en ninguna
   variante de mayúsculas o acentos. Esta prueba impide que un cambio futuro los
   reintroduzca sin que nadie lo note.
4. **Catálogo íntegro.** Cada ruta declarada en `catalogo.json` existe en disco y
   cada capa en disco está declarada en el catálogo.
5. **Enlace de biodiversidad.** El total de registros tras el enlace a geometría
   es igual al total de entrada; los no ubicados quedan marcados, no perdidos.
6. **Presupuesto de peso.** `data/capas/` por debajo de 8 MB y ninguna capa
   individual por encima de 2 MB.

En el navegador se verifica a mano, antes de dar por terminada la implementación:
carga inicial bajo 2 s, cambio de zona sin petición de red, exportación de CSV y
GeoJSON funcionando, enlace permanente que restituye el estado, y la ficha
imprimible generando un PDF legible.

## 10. Despliegue

Todas las rutas son relativas (`./data/...`). El sitio funciona idéntico en los
tres destinos sin editar una línea.

| Destino | Mecanismo | Estado |
|---|---|---|
| GitHub Pages | `.github/workflows/pages.yml` publica en cada push a `main`. `.nojekyll` evita que Jekyll ignore archivos. | **Activo** |
| Servidor propio (Apache / Nginx / IIS) | Copiar la carpeta al docroot. Funciona en subruta (`/visores/rab/`). | Listo |
| Azure Static Web Apps | `.github/workflows/azure-static-web-apps.yml` despliega desde el repo. `staticwebapp.config.json` declara `application/geo+json` para `.geojson` (Azure no lo sirve bien por defecto) y cabeceras de caché. | Preparado, inerte |

La única dependencia externa (MapLibre) queda fijada en `vendor/`, así que el
visor no se rompe si un CDN cae ni si se despliega tras un firewall corporativo.

`docs/DESPLIEGUE.md` documenta los tres caminos paso a paso, incluido cómo activar
Azure cuando llegue el momento.

## 11. Prerequisito operativo

La máquina no tiene GitHub CLI ni credenciales de GitHub configuradas, y no tiene
Node ni npm. Node no hace falta: el sitio no se compila. Para publicar el repo se
necesita una de estas dos:

- `winget install GitHub.cli` seguido de `gh auth login`, o
- un Personal Access Token de GitHub con permiso `repo` y `workflow`.

Hasta entonces el trabajo avanza en el repositorio local y se publica después en
un solo paso.
