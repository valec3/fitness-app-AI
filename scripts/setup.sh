#!/bin/bash

# Script de configuración inicial del proyecto
# Este script automatiza la configuración completa del entorno

set -e  # Salir si hay errores

echo "🚀 Configurando Nutrition Tracker App..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar mensajes de estado
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar requisitos del sistema
check_requirements() {
    print_status "Verificando requisitos del sistema..."

    # Verificar Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js no está instalado. Por favor instala Node.js 16+ desde https://nodejs.org/"
        exit 1
    fi

    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_VERSION="16.0.0"
    
    if ! node -e "process.exit(require('semver').gte('$NODE_VERSION', '$REQUIRED_VERSION') ? 0 : 1)" 2>/dev/null; then
        print_error "Node.js versión $NODE_VERSION encontrada. Se requiere versión $REQUIRED_VERSION o superior."
        exit 1
    fi

    print_success "Node.js $NODE_VERSION ✓"

    # Verificar npm
    if ! command -v npm &> /dev/null; then
        print_error "npm no está instalado."
        exit 1
    fi

    print_success "npm $(npm --version) ✓"
}

# Instalar dependencias
install_dependencies() {
    print_status "Instalando dependencias..."

    # Instalar dependencias raíz
    print_status "Instalando dependencias principales..."
    npm install

    # Instalar dependencias del frontend
    print_status "Instalando dependencias del frontend..."
    cd frontend
    npm install
    cd ..

    # Instalar dependencias del backend
    print_status "Instalando dependencias del backend..."
    cd backend
    npm install
    cd ..

    print_success "Todas las dependencias instaladas ✓"
}

# Configurar variables de entorno
setup_environment() {
    print_status "Configurando variables de entorno..."

    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
        print_warning "Archivo .env creado desde .env.example"
        print_warning "IMPORTANTE: Edita backend/.env y agrega tu GEMINI_API_KEY"
        print_warning "Obtén tu API key en: https://makersuite.google.com/app/apikey"
    else
        print_status "Archivo .env ya existe ✓"
    fi

    # Verificar que existe el modelo Vosk
    if [ ! -d "backend/model" ]; then
        print_warning "Modelo Vosk no encontrado en backend/model/"
        print_warning "Asegúrate de descargar un modelo de https://alphacephei.com/vosk/models"
    else
        print_success "Modelo Vosk encontrado ✓"
    fi
}

# Crear directorios necesarios
create_directories() {
    print_status "Creando directorios necesarios..."

    mkdir -p backend/data
    mkdir -p backend/uploads
    mkdir -p backend/logs
    mkdir -p frontend/dist

    print_success "Directorios creados ✓"
}

# Verificar configuración
verify_setup() {
    print_status "Verificando configuración..."

    # Verificar que el backend puede iniciarse
    print_status "Verificando backend..."
    cd backend
    timeout 10s npm start &
    BACKEND_PID=$!
    sleep 5

    if kill -0 $BACKEND_PID 2>/dev/null; then
        print_success "Backend se inicia correctamente ✓"
        kill $BACKEND_PID
    else
        print_warning "El backend podría tener problemas. Verifica la configuración."
    fi
    cd ..

    # Verificar estructura de archivos
    REQUIRED_FILES=(
        "package.json"
        "frontend/package.json"
        "backend/package.json"
        "backend/.env"
        "frontend/main.js"
        "backend/server.js"
    )

    for file in "${REQUIRED_FILES[@]}"; do
        if [ -f "$file" ]; then
            print_success "$file ✓"
        else
            print_error "$file no encontrado"
        fi
    done
}

# Mostrar próximos pasos
show_next_steps() {
    echo ""
    echo "🎉 ¡Configuración completada!"
    echo ""
    echo "Próximos pasos:"
    echo "1. Edita backend/.env y agrega tu GEMINI_API_KEY"
    echo "2. Si no tienes el modelo Vosk, descárgalo y ponlo en backend/model/"
    echo "3. Ejecuta: npm run dev"
    echo ""
    echo "URLs útiles:"
    echo "- Aplicación: Se abrirá automáticamente"
    echo "- Backend API: http://localhost:3001/api/health"
    echo "- Gemini API Key: https://makersuite.google.com/app/apikey"
    echo "- Modelos Vosk: https://alphacephei.com/vosk/models"
    echo ""
}

# Función principal
main() {
    echo "=========================================="
    echo "  Nutrition Tracker - Setup Script"
    echo "=========================================="
    echo ""

    check_requirements
    install_dependencies
    setup_environment
    create_directories
    verify_setup
    show_next_steps

    print_success "¡Setup completado exitosamente! 🎉"
}

# Ejecutar si es llamado directamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi