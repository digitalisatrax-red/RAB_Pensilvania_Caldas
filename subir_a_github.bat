@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Subiendo visorRAB a GitHub ===
if exist visorRAB.zip del visorRAB.zip
mkdir ".github" 2>nul
mkdir ".github\workflows" 2>nul
if exist "docs\workflows\pages.yml" copy /Y "docs\workflows\pages.yml" ".github\workflows\pages.yml"
if not exist ".git" git init
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/digitalisatrax-red/RAB_Pensilvania_Caldas.git
git fetch origin
git reset origin/main
git add -A
git commit -m "visorRAB: tablero completo"
git push -u origin main
echo.
git status -sb
echo === Fin. Si no hubo errores rojos: GitHub - Settings - Pages - Source: GitHub Actions ===
pause
