param([string]$CliPath = $env:HX_CLI_PATH)
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($CliPath)) { throw '请通过 -CliPath 指定 HBuilderX cli.exe，或先设置 HX_CLI_PATH 环境变量。' }
$projectPath = Split-Path -Parent $PSScriptRoot
$hbuilderRoot = Split-Path -Parent $CliPath
$env:HX_APP_ROOT = $hbuilderRoot
$env:UNI_HBUILDERX_PLUGINS = Join-Path $hbuilderRoot 'plugins'
$env:UNI_INPUT_DIR = $projectPath
$env:UNI_OUTPUT_DIR = Join-Path $projectPath 'unpackage\dist\dev\mp-weixin'
if (Test-Path $env:UNI_OUTPUT_DIR) { Remove-Item -LiteralPath $env:UNI_OUTPUT_DIR -Recurse -Force }
$nodePath = Join-Path $hbuilderRoot 'plugins\node\node.exe'
$compilerPath = Join-Path $hbuilderRoot 'plugins\uniapp-cli-vite\node_modules\@dcloudio\vite-plugin-uni\bin\uni.js'
& $nodePath $compilerPath build -p mp-weixin --outDir $env:UNI_OUTPUT_DIR
if ($LASTEXITCODE -ne 0) { throw 'Mini program compilation failed.' }
$outputPath = Join-Path $projectPath 'unpackage\dist\dev\mp-weixin'
if (-not (Test-Path (Join-Path $outputPath 'app.json'))) { throw 'app.json was not generated.' }
$configPath = Join-Path $outputPath 'project.config.json'
$config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
$config.miniprogramRoot = './'
[System.IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Depth 30), (New-Object System.Text.UTF8Encoding($false)))
Write-Output "Open in WeChat DevTools: $outputPath"
