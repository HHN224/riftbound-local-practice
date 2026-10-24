param([string]$Console = 'D:\leidian\LDPlayer9\ldconsole.exe')
$ErrorActionPreference = 'Stop'
$taskName = 'Fuxuan-Local-Practice'
if (-not (Test-Path -LiteralPath $Console)) { throw "LDPlayer console not found: $Console" }
$taskInstances = & $Console list2
if (-not ($taskInstances | Where-Object { $_ -match ',Fuxuan-Local-Practice,' })) {
    throw 'The dedicated Fuxuan-Local-Practice instance is missing. See community/research/FINDINGS.md.'
}
Start-Process -FilePath $Console -ArgumentList @('launch','--name',$taskName) -WindowStyle Hidden -Wait
$taskReady = $false
for ($taskAttempt=0; $taskAttempt -lt 60; $taskAttempt++) {
    $taskRow = (& $Console list2) | Where-Object { $_ -match ',Fuxuan-Local-Practice,' }
    if ($taskRow -and ($taskRow -split ',')[4] -eq '1') { $taskReady=$true; break }
    Start-Sleep -Seconds 1
}
if (-not $taskReady) { throw 'Emulator startup timed out. Open the dedicated instance and retry.' }
Start-Process -FilePath $Console -ArgumentList @('runapp','--name',$taskName,'--packagename','com.senhe.riftboundmobile') -WindowStyle Hidden

