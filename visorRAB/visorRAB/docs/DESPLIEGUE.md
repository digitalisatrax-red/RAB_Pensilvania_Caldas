# Despliegue

## GitHub Pages (actual)
1. Crear el repositorio `visorRAB` y subir el contenido.
2. Settings → Pages → Source: GitHub Actions. El flujo `.github/workflows/pages.yml` prueba y publica en cada push a `main`.

## Azure Static Web Apps (preparado)
1. Crear el recurso Static Web App (plan gratuito) sin build; copiar el token de despliegue.
2. Guardarlo como secreto `AZURE_STATIC_WEB_APPS_API_TOKEN`.
3. Renombrar `azure-static-web-apps.yml.disabled` a `.yml`. `staticwebapp.config.json` ya define tipos MIME y caché.

## Servidor propio
Copiar la carpeta completa a cualquier servidor web (nginx, Apache, IIS). Servir `.geojson` como `application/geo+json`. Todas las rutas son relativas, por lo que funciona en subcarpetas.
