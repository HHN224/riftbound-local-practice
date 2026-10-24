param(
    [string]$SourcePath = (Join-Path $PSScriptRoot '../tools/hermes-40b4c8d4e22ed2b9af46aba81aec3ca8aa5e169c'),
    [string]$VcVars = 'C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat'
)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskSource = [IO.Path]::GetFullPath($SourcePath)
if (-not (Test-Path -LiteralPath $VcVars)) { throw 'Visual Studio 2022 C++ x64 tools required; specify -VcVars.' }
if (-not (Test-Path -LiteralPath (Join-Path $taskSource 'include/hermes/VM/static_h.h'))) { throw 'Download the pinned Hermes source described in engine/BUILD.md first.' }
$taskHeader = Join-Path $taskSource 'include/hermes/VM/static_h.h'
$taskText = [IO.File]::ReadAllText($taskHeader)
foreach ($taskWidth in @('i32','i64')) {
    $taskText = $taskText.Replace("__builtin_expect(sh_tryfast_f64_to_$taskWidth(d, fast), 1)", "sh_tryfast_f64_to_$taskWidth(d, fast)")
}
[IO.File]::WriteAllText($taskHeader,$taskText)
Copy-Item -LiteralPath (Join-Path $taskRoot 'engine/host.cpp') -Destination (Join-Path $taskSource 'tools/jsi/fuxuan.cpp')
$taskCmake = Join-Path $taskSource 'tools/jsi/CMakeLists.txt'
$taskText = [IO.File]::ReadAllText($taskCmake)
if (-not $taskText.Contains('add_hermes_tool(hermes-fuxuan')) {
    $taskText += "`nadd_hermes_tool(hermes-fuxuan fuxuan.cpp LINK_OBJLIBS hermesvm_a timerStats)`ntarget_link_libraries(hermes-fuxuan winmm)`n"
    [IO.File]::WriteAllText($taskCmake,$taskText)
}
$taskBuild = Join-Path $taskRoot 'tools/hermes-host'
$taskCommand = Join-Path $taskRoot 'tools/build-local-host.cmd'
$taskScript = @"
@echo off
call "$VcVars" >nul
set "PATH=$taskRoot\tools\venv\Scripts;%PATH%"
cmake -S "$taskSource" -B "$taskBuild" -G Ninja -DCMAKE_BUILD_TYPE=Release -DHERMES_ENABLE_DEBUGGER=OFF -DHERMES_ENABLE_INTL=OFF -DHERMES_ENABLE_TEST_SUITE=OFF -DHERMES_UNICODE_LITE=ON -DCMAKE_POLICY_VERSION_MINIMUM=3.5
if errorlevel 1 exit /b 1
cmake --build "$taskBuild" --target hermes-fuxuan -j 4
"@
[IO.File]::WriteAllText($taskCommand,$taskScript)
& $taskCommand
if ($LASTEXITCODE -ne 0) { throw 'Hermes compilation failed.' }
New-Item -ItemType Directory -Force (Join-Path $taskRoot 'engine/bin') | Out-Null
Copy-Item -LiteralPath (Join-Path $taskBuild 'bin/hermes-fuxuan.exe') -Destination (Join-Path $taskRoot 'engine/bin/hermes-fuxuan.exe')
