@echo off
rem Descarga lo nuevo de Lichess y recalcula las cifras del club.
cd /d "%~dp0"
call npm run datos
pause
