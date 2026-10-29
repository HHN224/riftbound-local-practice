param([string]$NodeVersion = '24.15.0', [string]$VcRedistDirectory)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskOutput = Join-Path $taskRoot 'dist'
$taskWork = Join-Path $taskOutput ('build-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $taskWork | Out-Null
$taskPayload = Join-Path $taskWork 'payload'
New-Item -ItemType Directory $taskPayload | Out-Null
$taskNode = (Get-Command node -ErrorAction Stop).Source
& $taskNode (Join-Path $taskRoot 'community/scripts/prepare-engine.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Engine preparation failed.' }

# Verify the bundled runtime against its official release checksum. Never rely
# on an arbitrary executable from PATH as the distributed runtime.
$taskChecksums = (Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/v$NodeVersion/SHASUMS256.txt").Content
$taskMatch = [regex]::Match($taskChecksums, '(?m)^([a-f0-9]{64})\s+win-x64/node.exe\s*$')
if (-not $taskMatch.Success) { throw 'Official Node checksum not found.' }
$taskRuntime = Join-Path $taskPayload 'node.exe'
if ((Get-FileHash -LiteralPath $taskNode -Algorithm SHA256).Hash.ToLowerInvariant() -eq $taskMatch.Groups[1].Value) {
    Copy-Item -LiteralPath $taskNode -Destination $taskRuntime
} else {
    Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/v$NodeVersion/win-x64/node.exe" -OutFile $taskRuntime
}
if ((Get-FileHash -LiteralPath $taskRuntime -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskMatch.Groups[1].Value) { throw 'Node checksum mismatch.' }
Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/nodejs/node/v$NodeVersion/LICENSE" -OutFile (Join-Path $taskPayload 'NODE-LICENSE.txt')

$taskGit = New-Object System.Diagnostics.ProcessStartInfo
$taskGit.FileName = (Get-Command git -ErrorAction Stop).Source
$taskGit.Arguments = '-c core.quotePath=false -C "' + $taskRoot + '" ls-files -- community/upstream community/public community/engine'
$taskGit.UseShellExecute = $false
$taskGit.CreateNoWindow = $true
$taskGit.RedirectStandardOutput = $true
$taskGit.StandardOutputEncoding = New-Object System.Text.UTF8Encoding
$taskGitProcess = [Diagnostics.Process]::Start($taskGit)
$taskFiles = @($taskGitProcess.StandardOutput.ReadToEnd() -split '\r?\n' | Where-Object { $_ })
$taskGitProcess.WaitForExit()
if ($taskGitProcess.ExitCode -ne 0) { throw 'Could not enumerate tracked runtime files.' }
$taskFiles = @($taskFiles | Where-Object {
    $_ -like 'community/upstream/*' -or $_ -like 'community/public/*' -or
    $_ -like 'community/engine/licenses/*' -or $_ -eq 'community/engine/bin/hermes-fuxuan.exe' -or
    $_ -eq 'community/engine/bootstrap.js' -or $_ -eq 'community/engine/session.js'
}) + @('community/scripts/server.mjs','community/mobile/app.manifest','community/generated/rules.hbc','START-HERE.md','README.md')
foreach ($taskFile in $taskFiles) {
    $taskTarget = Join-Path $taskPayload $taskFile
    New-Item -ItemType Directory -Force (Split-Path $taskTarget -Parent) | Out-Null
    Copy-Item -LiteralPath (Join-Path $taskRoot $taskFile) -Destination $taskTarget
}
# Hermes imports the release MSVC runtime. Use Visual Studio's designated
# redistributable folder, never DLLs copied from System32 or debug_nonredist.
if (-not $VcRedistDirectory) {
    $taskVsWhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
    $taskVsRoot = (& $taskVsWhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath).Trim()
    $taskRedistRoot = Join-Path $taskVsRoot 'VC/Redist/MSVC'
    $VcRedistDirectory = Get-ChildItem -LiteralPath $taskRedistRoot -Directory |
        Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'x64/Microsoft.VC143.CRT' } |
        Where-Object { Test-Path -LiteralPath (Join-Path $_ 'msvcp140.dll') } | Select-Object -First 1
}
if (-not $VcRedistDirectory) { throw 'Release x64 VC143 CRT redistributables are required.' }
foreach ($taskDll in @('msvcp140.dll','vcruntime140.dll','vcruntime140_1.dll')) {
    $taskDllPath = Join-Path $VcRedistDirectory $taskDll
    if ((Get-AuthenticodeSignature -LiteralPath $taskDllPath).Status -ne 'Valid') { throw "Invalid Microsoft runtime signature: $taskDll" }
}
Get-ChildItem -LiteralPath $VcRedistDirectory -Filter '*.dll' | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $taskPayload 'community/engine/bin')
}
@'
Microsoft Visual C++ Redistributable runtime files are distributed with this
application for application-local deployment. Copyright Microsoft Corporation.
Source: Visual Studio VC/Redist/MSVC/x64/Microsoft.VC143.CRT (release files).
Redistributable list: https://aka.ms/vs/17/redistribution
Terms: https://visualstudio.microsoft.com/license-terms/
'@ | Set-Content (Join-Path $taskPayload 'MICROSOFT-RUNTIME-NOTICE.txt') -Encoding UTF8
$taskRevision = (& git -C $taskRoot rev-parse HEAD).Trim()
@{ nodeVersion=$NodeVersion; sourceRevision=$taskRevision; builtAt=[DateTime]::UtcNow.ToString('o'); runtimeSha256=$taskMatch.Groups[1].Value } |
    ConvertTo-Json | Set-Content (Join-Path $taskPayload 'release.json') -Encoding UTF8
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskZip = Join-Path $taskWork 'payload.zip'
[IO.Compression.ZipFile]::CreateFromDirectory($taskPayload,$taskZip,[IO.Compression.CompressionLevel]::Optimal,$false)
$taskId = (Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash.ToLowerInvariant().Substring(0,16)
$taskSource = Join-Path $taskWork 'Launcher.cs'
$taskBanVersion=(Get-Content -LiteralPath (Join-Path $taskRoot 'community/public/local/banlist.json') -Raw -Encoding UTF8 | ConvertFrom-Json).checked
(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Launcher.cs') -Raw -Encoding UTF8).Replace('PAYLOAD_ID',$taskId).Replace('BANLIST_VERSION',$taskBanVersion) |
    Set-Content -LiteralPath $taskSource -Encoding UTF8
$taskCompiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$taskExe = Join-Path $taskOutput 'riftbound-local-practice-win-x64.exe'
& $taskCompiler /nologo /target:winexe /platform:x64 /optimize+ "/out:$taskExe" "/resource:$taskZip,payload.zip" /reference:System.Windows.Forms.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll $taskSource
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
$taskDigest = (Get-FileHash -LiteralPath $taskExe -Algorithm SHA256).Hash.ToLowerInvariant()
"$taskDigest  riftbound-local-practice-win-x64.exe" | Set-Content (Join-Path $taskOutput 'SHA256SUMS.txt') -Encoding ASCII
@{ executable=$taskExe; sha256=$taskDigest; extractionId=$taskId; bytes=(Get-Item -LiteralPath $taskExe).Length } |
    ConvertTo-Json | Set-Content (Join-Path $taskOutput 'build-result.json') -Encoding UTF8
Write-Output "Built $taskExe ($([Math]::Round((Get-Item -LiteralPath $taskExe).Length / 1MB,1)) MiB)"
