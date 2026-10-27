[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$env:PSModulePath = (Join-Path $PSHOME 'Modules') + ';' + $env:PSModulePath
$root = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
$recordPath = Join-Path $root 'installation.json'
if (-not (Test-Path -LiteralPath $recordPath)) { throw 'Installation record is missing; no files were removed.' }
$record = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
if ($record.Project -ne 'CodexLiquidGlass' -or [IO.Path]::GetFullPath($record.InstallRoot).TrimEnd('\') -ne $root -or $root -eq [IO.Path]::GetPathRoot($root).TrimEnd('\')) { throw 'Installation record does not match this directory; no files were removed.' }
$exe = Join-Path $root 'app\ChatGPT.exe'
$running = @(Get-Process ChatGPT -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -eq $exe } catch { $false } })
if ($running.Count) { throw 'Close Codex Liquid Glass before uninstalling. No running application will be stopped automatically.' }
$allowedShortcuts = @((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Codex Liquid Glass.lnk'),(Join-Path ([Environment]::GetFolderPath('Programs')) 'Codex Liquid Glass.lnk'))
foreach ($link in @($record.Shortcuts)) {
    if ($link -in $allowedShortcuts -and (Test-Path -LiteralPath $link)) {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($link)
        if ($shortcut.Arguments -like ('*' + (Join-Path $root 'Launch.ps1') + '*')) { Remove-Item -LiteralPath $link -Force }
    }
}
if ($record.RegisteredUninstaller) {
    $registry = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CodexLiquidGlass'
    if (Test-Path $registry) {
        $registered = Get-ItemProperty -Path $registry
        if ($registered.InstallLocation -eq $root) { Remove-Item -LiteralPath $registry -Recurse -Force }
    }
}
Remove-Item -LiteralPath $root -Recurse -Force
Write-Host ('Codex Liquid Glass was removed. Its profile was kept at ' + $record.ProfileRoot + '. The official Codex installation was not changed.')
