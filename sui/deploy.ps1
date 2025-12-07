# Sui Move Contract Deploy Script for Windows PowerShell
# Make sure Sui CLI is installed first

Write-Host "Building Move package..." -ForegroundColor Cyan
sui move build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deploying to Sui testnet..." -ForegroundColor Cyan
    $result = sui client publish --gas-budget 100000000 --json | ConvertFrom-Json
    
    if ($result.packageId) {
        Write-Host "`n✅ Deployment successful!" -ForegroundColor Green
        Write-Host "Package ID: $($result.packageId)" -ForegroundColor Yellow
        Write-Host "`nPlease update the PACKAGE_ID in lib/sui.ts with the above Package ID" -ForegroundColor Cyan
    } else {
        Write-Host "Deployment output:" -ForegroundColor Yellow
        $result | ConvertTo-Json -Depth 10
    }
} else {
    Write-Host "Build failed!" -ForegroundColor Red
}

