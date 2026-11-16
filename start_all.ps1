Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Starting Dakini CRM 5-tier architecture..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

Start-Process cmd -ArgumentList '/k', 'npm run backend'
Start-Process cmd -ArgumentList '/k', 'npm run gateway'
Start-Process cmd -ArgumentList '/k', 'npm run ai'
Start-Process cmd -ArgumentList '/k', 'npm run analytics'
Start-Process cmd -ArgumentList '/k', 'npm run dev'

Write-Host ""
Write-Host "[OK] All 5 services launched in separate windows!" -ForegroundColor Green
Write-Host "[UI] Open http://localhost:3000 in your browser." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
