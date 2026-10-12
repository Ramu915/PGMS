# PGMS Go Backend Development Script with Auto Reload
if (Get-Command air -ErrorAction SilentlyContinue) {
    Write-Host "🚀 Starting PGMS Backend with Air (Live Auto-Reload)..." -ForegroundColor Green
    air
} else {
    Write-Host "⚠️ Air CLI not found on PATH. Falling back to standard go run..." -ForegroundColor Yellow
    go run ./cmd/api
}
