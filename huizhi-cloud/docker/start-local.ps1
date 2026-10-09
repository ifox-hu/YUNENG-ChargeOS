param(
    [switch]$Configure,
    [switch]$BuildImages,
    [switch]$AllModules,
    [string]$NodePath = 'D:\nvm\nvm\v16.20.2\node.exe'
)

$ErrorActionPreference = 'Stop'
if ($AllModules) { $env:COMPOSE_PROFILES = 'extras,simulator' }
Push-Location $PSScriptRoot
try {
    docker info --format '{{.ServerVersion}}'
    if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop, wait for the engine, then rerun this script.' }

    docker compose up -d hcp-mysql hcp-redis hcp-nacos
    if ($LASTEXITCODE -ne 0) { throw 'Infrastructure startup failed.' }
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try {
            $health = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8848/nacos/v1/console/health/readiness' -TimeoutSec 3
            if ($health.Content.Trim() -eq 'OK') { $ready = $true; break }
        } catch { }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) { throw 'Nacos is not ready. Check docker compose logs hcp-nacos.' }

    docker cp account-login.sql hcp-mysql:/tmp/account-login.sql
    if ($LASTEXITCODE -ne 0) { throw 'Failed to copy account schema.' }
    docker exec -e MYSQL_PWD=password hcp-mysql mysql -uroot vctgo_platform -e 'source /tmp/account-login.sql'
    if ($LASTEXITCODE -ne 0) { throw 'Account schema initialization failed.' }

    docker cp fault-work-order.sql hcp-mysql:/tmp/fault-work-order.sql
    if ($LASTEXITCODE -ne 0) { throw 'Failed to copy fault schema.' }
    docker exec -e MYSQL_PWD=password hcp-mysql mysql --default-character-set=utf8mb4 -uroot vctgo_platform -e 'source /tmp/fault-work-order.sql'
    if ($LASTEXITCODE -ne 0) { throw 'Fault schema initialization failed.' }

    if ($Configure) {
        docker cp nacos-compat.sql hcp-mysql:/tmp/nacos-compat.sql
        if ($LASTEXITCODE -ne 0) { throw 'Failed to copy Nacos compatibility SQL.' }
        docker exec -e MYSQL_PWD=password hcp-mysql mysql -uroot vctgo_platform -e 'source /tmp/nacos-compat.sql'
        if ($LASTEXITCODE -ne 0) { throw 'Nacos database compatibility update failed.' }
        if (-not (Test-Path -LiteralPath $NodePath)) { $NodePath = (Get-Command node).Source }
        & $NodePath configure-local.cjs
        if ($LASTEXITCODE -ne 0) { throw 'Nacos development configuration failed.' }
    }

    if ($BuildImages) {
        docker compose build hcp-gateway hcp-auth hcp-system hcp-file hcp-operator hcp-mp
        if ($LASTEXITCODE -ne 0) { throw 'Application image build failed.' }
        if ($AllModules) {
            docker compose build hcp-gen hcp-job hcp-monitor hcp-demo hcp-simulator
            if ($LASTEXITCODE -ne 0) { throw 'Additional module image build failed.' }
        }
    }
    docker compose up -d
    if ($LASTEXITCODE -ne 0) { throw 'Application startup failed.' }
    if ($Configure -or $BuildImages) {
        docker compose restart hcp-gateway hcp-auth hcp-system hcp-file hcp-operator hcp-mp
        if ($LASTEXITCODE -ne 0) { throw 'Application restart failed.' }
    }
    docker compose restart hcp-nginx
    if ($LASTEXITCODE -ne 0) { throw 'Nginx restart failed.' }

    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try {
            $captcha = Invoke-RestMethod 'http://127.0.0.1:8001/prod-api/code' -TimeoutSec 3
            if ($captcha.code -eq 200) { $ready = $true; break }
        } catch { }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) { throw 'Gateway is not ready. Check docker compose logs hcp-gateway.' }
    docker compose ps
    Write-Host 'Admin: http://127.0.0.1:8001'
    Write-Host 'Demo login: admin / admin123'
    Write-Host 'Use -AllModules to include generator, jobs, monitor, demo and simulator.'
} finally {
    Pop-Location
}
