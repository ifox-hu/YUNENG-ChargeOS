param([string]$JdkPath='D:/jdk1.8')
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
Push-Location $repo
try {
    $out=Join-Path $repo 'outputs/resume-benchmarks/stop-fix-20261102'
    $lib=Join-Path $out 'lib'
    New-Item -ItemType Directory -Force $lib | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive=[IO.Compression.ZipFile]::OpenRead((Join-Path $repo 'yuneng-cloud/hcp-modules/hcp-operator/target/hcp-operator.jar'))
    try {
        foreach ($entry in $archive.Entries) {
            if ($entry.FullName.StartsWith('BOOT-INF/lib/') -and $entry.Name.EndsWith('.jar')) {
                [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,(Join-Path $lib $entry.Name),$true)
            }
        }
    } finally { $archive.Dispose() }
    $cp="yuneng-cloud/hcp-modules/hcp-operator/target/classes;yuneng-cloud/hcp-api/hcp-api-system/target/classes;$lib/*"
    & "$JdkPath/bin/javac.exe" -encoding UTF-8 -cp $cp -d $out scripts/ChargingStopContractProbe.java
    if ($LASTEXITCODE -ne 0) { throw 'Probe compilation failed' }
    foreach ($mode in @('fallback','stop','registration')) {
        & "$JdkPath/bin/java.exe" -cp "$out;$cp" ChargingStopContractProbe $mode
        if ($LASTEXITCODE -ne 0) { throw "Contract probe failed: $mode" }
    }
} finally { Pop-Location }
