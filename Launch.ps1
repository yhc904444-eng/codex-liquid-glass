[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$exe = Join-Path $PSScriptRoot 'app\ChatGPT.exe'
$manifestPath = Join-Path $PSScriptRoot 'build-manifest.json'
if (-not (Test-Path -LiteralPath $exe) -or -not (Test-Path -LiteralPath $manifestPath)) { throw 'Liquid Glass installation is incomplete. Run the installer again.' }
$profile = Join-Path $env:APPDATA 'CodexLiquidGlass'
foreach ($name in @('CODEX_THREAD_ID','CODEX_SESSION_ID','CODEX_APP_TOOLS_PIPE_PATH','CODEX_TOOL_CALL_ID')) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe) -ArgumentList @('--user-data-dir="' + $profile + '"','--no-first-run')
