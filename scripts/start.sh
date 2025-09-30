#!/bin/bash

echo "🚀 Iniciando Nutrition Tracker App..."

# Matar procesos previos en los puertos
echo "🔄 Limpiando puertos..."
fuser -k 3001/tcp 2>/dev/null || true
fuser -k 3002/tcp 2>/dev/null || true

# Esperar un momento
sleep 1

# Iniciar backend
echo "🔧 Iniciando backend..."
cd backend
node server.js &
BACKEND_PID=$!

# Esperar a que el backend se inicie
sleep 3

# Verificar que el backend está funcionando
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend funcionando correctamente"
else
    echo "❌ Error: Backend no responde"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Volver al directorio raíz
cd ..

# Iniciar frontend
echo "🖥️ Iniciando frontend..."
cd frontend
npm start &
FRONTEND_PID=$!

echo "✅ Aplicación iniciada!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "Para detener la aplicación:"
echo "kill $BACKEND_PID $FRONTEND_PID"

# Esperar a que el usuario presione Ctrl+C
trap "echo '🛑 Deteniendo aplicación...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT

# Mantener el script corriendo
wait