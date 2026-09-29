@echo off
rem Abre la demo del Ajedrez Club Mokewa en el navegador (servidor local).
cd /d "%~dp0"
if not exist node_modules call npm install
start "" http://localhost:4321/
call npx astro dev --port 4321
