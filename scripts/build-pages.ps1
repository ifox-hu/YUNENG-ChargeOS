param([string]$NodeOptions='--openssl-legacy-provider')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$adminPath=Join-Path $projectRoot 'huizhi-admin'
$demoOutput=Join-Path $projectRoot 'site'
$env:NODE_OPTIONS=$NodeOptions
Push-Location $adminPath
try {
  & '.\node_modules\.bin\vue-cli-service.cmd' build --mode demo --dest $demoOutput
  if ($LASTEXITCODE -ne 0) { throw '演示构建失败' }
} finally { Pop-Location }
Write-Output "预览：http://127.0.0.1:8010/site/（在项目根目录启动 HTTP 服务）"
