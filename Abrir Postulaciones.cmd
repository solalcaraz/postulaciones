@echo off
rem Doble clic para abrir la herramienta de postulaciones. Deja una ventana minimizada: si la cerras, la herramienta se apaga.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instalalo desde https://nodejs.org ^(version LTS^) y volve a hacer doble clic.
  pause
  exit /b 1
)
where claude >nul 2>nul
if errorlevel 1 (
  echo No se encontro Claude Code. Instalalo y abri una terminal con "claude" para iniciar sesion. Despues volve a hacer doble clic.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Falta instalar las dependencias. Corre "npm install" en esta carpeta y volve a hacer doble clic.
  pause
  exit /b 1
)
start "Postulaciones - no cierres esta ventana" /min node app\iniciar.mjs
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:4400
