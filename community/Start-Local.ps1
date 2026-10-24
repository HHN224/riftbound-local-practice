param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$taskPort = if ($env:FUXUAN_PORT) { [int]$env:FUXUAN_PORT } else { 4174 }
$taskUrl = "http://127.0.0.1:$taskPort"
$taskNode = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'engine/bin/hermes-fuxuan.exe'))) {
    throw 'Local Hermes host missing. See community/engine/BUILD.md.'
}
& $taskNode (Join-Path $PSScriptRoot 'scripts/prepare-engine.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the original APK engine.' }
$taskRunning = $false
try {
    $taskHealth = Invoke-RestMethod -Uri "$taskUrl/local-api/status" -TimeoutSec 2
    $taskRunning = $taskHealth.source -eq 'Fuxuan APK local Hermes engine'
} catch { }
if (-not $taskRunning) {
    $taskStartup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
    $taskLaunch = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
        CommandLine = ('"{0}" "{1}"' -f $taskNode, (Join-Path $PSScriptRoot 'scripts/server.mjs'))
        CurrentDirectory = $PSScriptRoot
        ProcessStartupInformation = $taskStartup
    }
    if ($taskLaunch.ReturnValue -ne 0) { throw "Could not start local server: $($taskLaunch.ReturnValue)" }
    for ($taskAttempt = 0; $taskAttempt -lt 40; $taskAttempt++) {
        try {
            $taskHealth = Invoke-RestMethod -Uri "$taskUrl/local-api/status" -TimeoutSec 2
            if ($taskHealth.source -eq 'Fuxuan APK local Hermes engine') { $taskRunning = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 250
    }
    if (-not $taskRunning) { throw 'Local server startup failed. Run npm run community:start to see diagnostics.' }
}
if (-not $NoBrowser) { Start-Process "$taskUrl/fuxuan/" }
Write-Host "Fuxuan local practice: $taskUrl/fuxuan/"
