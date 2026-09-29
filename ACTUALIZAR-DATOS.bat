@echo off
rem Descarga lo nuevo de Lichess y recalcula el Salon de la Fama.
cd /d "%~dp0"
call npm run datos
pause
