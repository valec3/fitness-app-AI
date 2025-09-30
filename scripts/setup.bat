@echo off
REM Script de configuración para Windows
REM Automatiza la configuración del proyecto en sistemas Windows

echo ========================================
echo   Nutrition Tracker - Setup Script
echo ========================================
echo.

REM Verificar Node.js
echo [INFO] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no está instalado. Descárgalo desde https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1" %%i in ('node --version') do set NODE_VERSION=%%i
echo [SUCCESS] Node.js %NODE_VERSION% encontrado

REM Verificar npm
echo [INFO] Verificando npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm no está disponible
    pause
    exit /b 1
)

for /f "tokens=1" %%i in ('npm --version') do set NPM_VERSION=%%i
echo [SUCCESS] npm %NPM_VERSION% encontrado

REM Instalar dependencias principales
echo [INFO] Instalando dependencias principales...
npm install
if %errorlevel% neq 0 (
    echo [ERROR] Error instalando dependencias principales
    pause
    exit /b 1
)

REM Instalar dependencias del frontend
echo [INFO] Instalando dependencias del frontend...
cd frontend
npm install
if %errorlevel% neq 0 (
    echo [ERROR] Error instalando dependencias del frontend
    cd ..
    pause
    exit /b 1
)
cd ..

REM Instalar dependencias del backend
echo [INFO] Instalando dependencias del backend...
cd backend
npm install
if %errorlevel% neq 0 (
    echo [ERROR] Error instalando dependencias del backend
    cd ..
    pause
    exit /b 1
)
cd ..

echo [SUCCESS] Todas las dependencias instaladas

REM Configurar variables de entorno
echo [INFO] Configurando variables de entorno...
if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env" >nul
    echo [WARNING] Archivo .env creado desde .env.example
    echo [WARNING] IMPORTANTE: Edita backend\.env y agrega tu GEMINI_API_KEY
) else (
    echo [INFO] Archivo .env ya existe
)

REM Crear directorios necesarios
echo [INFO] Creando directorios necesarios...
if not exist "backend\data" mkdir "backend\data"
if not exist "backend\uploads" mkdir "backend\uploads"
if not exist "backend\logs" mkdir "backend\logs"
if not exist "frontend\dist" mkdir "frontend\dist"

echo [SUCCESS] Directorios creados

REM Verificar modelo Vosk
echo [INFO] Verificando modelo Vosk...
if not exist "backend\model" (
    echo [WARNING] Modelo Vosk no encontrado en backend\model\
    echo [WARNING] Descarga un modelo desde https://alphacephei.com/vosk/models
) else (
    echo [SUCCESS] Modelo Vosk encontrado
)

echo.
echo ===========================================
echo   ¡Configuración completada exitosamente!
echo ===========================================
echo.
echo Próximos pasos:
echo 1. Edita backend\.env y agrega tu GEMINI_API_KEY
echo 2. Si no tienes modelo Vosk, descárgalo y ponlo en backend\model\
echo 3. Ejecuta: npm run dev
echo.
echo URLs útiles:
echo - Backend API: http://localhost:3001/api/health
echo - Gemini API Key: https://makersuite.google.com/app/apikey
echo - Modelos Vosk: https://alphacephei.com/vosk/models
echo.

pause