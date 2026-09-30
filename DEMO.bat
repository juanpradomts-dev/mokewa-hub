@echo off
rem Abre la demo del Ajedrez Club Mokewa en el navegador (servidor local).
cd /d "%~dp0"
if not exist node_modules call npm install
rem El navegador se abre a los 6 segundos, cuando el servidor ya responde.
start "" /min cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:4321/"
call npx astro dev --port 4321
