@echo off
echo 🚀 Iniciando Nutrition Tracker App...

REM Matar procesos previos en los puertos
echo 🔄 Limpiando puertos...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM Esperar un momento
timeout /t 2 /nobreak >nul

REM Iniciar backend
echo 🔧 Iniciando backend...
cd backend
start /b node server.js
timeout /t 3 /nobreak >nul

REM Volver al directorio raíz y iniciar frontend
cd ..
echo 🖥️ Iniciando frontend...
cd frontend
start npm start

echo ✅ Aplicación iniciada!
echo Backend: http://localhost:3001
echo Frontend: Electron app abierta

pause