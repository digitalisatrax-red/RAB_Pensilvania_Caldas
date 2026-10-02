# visorRAB — Reserva en cifras

Tablero geográfico de la Reserva Ambiental de Pensilvania (RAB), Caldas. Fundación para la Conservación de la Vida Silvestre en Colombia (FCV).

Sitio estático (HTML + JS + GeoJSON), sin proceso de compilación. Funciona en GitHub Pages, Azure Static Web Apps o cualquier servidor web.

## Probar en local
```
python -m http.server 8000
```
Abrir http://localhost:8000

## Actualizar los datos
```
pip install shapely pyproj openpyxl pandas
python herramientas/preparar_datos.py --origen <carpeta RAB>
python herramientas/preparar_biodiversidad.py --origen <carpeta RAB>
python herramientas/preparar_predios.py --origen <carpeta RAB>
python -m unittest discover -s herramientas/pruebas
```
Estructura y reglas: `docs/ORGANIZACION_DATOS.md`. Publicación: `docs/DESPLIEGUE.md`.

## Privacidad
Los predios se publican anonimizados (nombre, áreas y coberturas declaradas). Nunca propietarios, matrículas ni códigos catastrales; una prueba automática lo verifica.

## Fuentes y advertencias
Las cifras de cobertura provienen de FCV (por predio) y de Corpocaldas (por zona); no coinciden porque son fuentes y escalas distintas. Metadatos sin confirmar aparecen como «Por confirmar».
