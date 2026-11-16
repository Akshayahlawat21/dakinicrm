@echo off
echo ============================================================
echo Starting Dakini CRM 5-tier architecture...
echo ============================================================

start "Dakini - Layer 3 Backend (Port 8000)" cmd /k "npm run backend"
start "Dakini - Layer 2 Gateway (Port 8080)" cmd /k "npm run gateway"
start "Dakini - Layer 5 AI Service (Port 8005)" cmd /k "npm run ai"
start "Dakini - Layer 9 Analytics (Port 8090)" cmd /k "npm run analytics"
start "Dakini - Frontend React Vite (Port 3000)" cmd /k "npm run dev"

echo.
echo [OK] All 5 services launched in separate windows!
echo [UI] Open http://localhost:3000 in your browser.
echo ============================================================
