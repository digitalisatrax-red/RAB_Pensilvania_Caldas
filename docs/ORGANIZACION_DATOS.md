# Organización de los datos

- `data/capas/<tema>/<id>.geojson`: una capa por archivo, WGS84, simplificada según su ámbito (reserva o contexto). Temas: zonificación, territorio físico, riesgos, monitoreo y biodiversidad, rutas y accesos, contexto.
- `data/catalogo.json`: lista de capas con nombre, tema, simbología, campos, fuente, año, escala y notas. Es lo que lee el visor; agregar una capa = agregar archivo + entrada en `herramientas/construir_catalogo.py`.
- `data/zonas.json`: métricas por zona de manejo (conservación, restauración, amortiguación, uso intensivo e infraestructura) y «toda la reserva»; alertas ordenadas por distancia a la zona de conservación.
- `data/tablas/`: `biodiversidad.json` (registros unificados), `predios.json` (anonimizado).
- `data/_reporte_preparacion.json`: resumen de la última ejecución del ETL.

Las áreas y distancias se calculan en EPSG:9377 (MAGNA-SIRGAS origen nacional); el mapa usa EPSG:4326. Las capas fuera de la reserva se tratan como contexto.
