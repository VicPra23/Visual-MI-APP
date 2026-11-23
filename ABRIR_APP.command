#!/bin/bash
# Script de inicio automático para macOS (equivalente a ABRIR_APP.bat)

# Situarse en la carpeta donde está este script
cd "$(dirname "$0")"

echo "================================================"
echo "🚀 INICIANDO SERVIDOR XIAOMI VISUAL EN MAC"
echo "================================================"

# Buscar puerto disponible empezando en 8080
PORT=8080
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; do
    PORT=$((PORT+1))
done

TARGET_URL="http://localhost:$PORT/index.html"

echo "✅ SERVIDOR ACTIVO EN EL PUERTO: $PORT"
echo "🌐 Abriendo aplicación en: $TARGET_URL"
echo "⛔ NO CIERRES ESTA VENTANA DE TERMINAL MIENTRAS USES LA APP"
echo "================================================"

# Abrir el navegador predeterminado de macOS en segundo plano
(sleep 1 && open "$TARGET_URL") &

# Iniciar servidor local con Python (nativo en macOS)
if command -v python3 >/dev/null 2>&1; then
    python3 -m http.server $PORT
elif command -v python >/dev/null 2>&1; then
    python -m SimpleHTTPServer $PORT
else
    echo "❌ No se encontró Python instalado en este Mac."
    echo "Por favor, instala Python o abre Terminal y ejecuta: xcode-select --install"
    read -p "Presiona Enter para salir..."
fi
