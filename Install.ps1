[CmdletBinding()]
param(
    [string]$SourceAppPath,
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'Programs\CodexLiquidGlass'),
    [switch]$NoShortcut,
    [switch]$NoLaunch,
    [switch]$SkipPrerequisiteDownload
)
$ErrorActionPreference = 'Stop'
$env:PSModulePath = (Join-Path $PSHOME 'Modules') + ';' + $env:PSModulePath
$projectRoot = $PSScriptRoot
$installRootPath = [IO.Path]::GetFullPath($InstallRoot).TrimEnd('\')
$profileRoot = Join-Path $env:APPDATA 'CodexLiquidGlass'
$stageRoot = $null
$defaultRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs\CodexLiquidGlass')).TrimEnd('\')
$isDefaultInstall = $installRootPath -eq $defaultRoot
$windowsBuild = [int](Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion').CurrentBuildNumber
if ($windowsBuild -lt 22621) { throw 'Liquid Glass requires Windows 11 22H2 or newer (build 22621+).' }
if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64' -and $env:PROCESSOR_ARCHITEW6432 -ne 'AMD64') { throw 'This release supports Windows x64 only.' }
if (Test-Path -LiteralPath $installRootPath) { throw ('An installation already exists at ' + $installRootPath + '. Uninstall it first; your profile will be kept.') }
if (-not [IO.Path]::IsPathRooted($installRootPath) -or $installRootPath -eq [IO.Path]::GetPathRoot($installRootPath).TrimEnd('\')) { throw 'Choose a dedicated installation directory.' }
function Find-OfficialCodex {
    $candidates = New-Object System.Collections.Generic.List[string]
    try {
        foreach ($package in @(Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction Stop | Sort-Object Version -Descending)) {
            $candidates.Add((Join-Path $package.InstallLocation 'app'))
        }
    } catch { Write-Verbose 'Store registration was unavailable; trying read-only path detection.' }
    foreach ($root in @((Join-Path $env:ProgramFiles 'WindowsApps'), (Join-Path $env:LOCALAPPDATA 'Programs\Codex'))) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        if ($root.EndsWith('WindowsApps')) {
            try { foreach ($dir in @(Get-ChildItem -LiteralPath $root -Directory -Filter 'OpenAI.Codex_*_x64__2p2nqsd0c76g0' -ErrorAction Stop | Sort-Object Name -Descending)) { $candidates.Add((Join-Path $dir.FullName 'app')) } } catch {}
        } else { $candidates.Add($root); $candidates.Add((Join-Path $root 'app')) }
    }
    foreach ($candidate in $candidates) {
        if ((Test-Path -LiteralPath (Join-Path $candidate 'resources\app.asar')) -and (Test-Path -LiteralPath (Join-Path $candidate 'ChatGPT.exe'))) { return $candidate }
    }
    return $null
}
function Install-OfficialPrerequisite {
    Write-Host 'Downloading the official OpenAI Codex Windows installer...'
    $downloadRoot = Join-Path ([IO.Path]::GetTempPath()) ('CodexGlassPrerequisite-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $downloadRoot | Out-Null
    try {
        $packagePath = Join-Path $downloadRoot 'Codex-x64.msix'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri 'https://persistent.oaistatic.com/codex-app-prod/ChatGPT-x64.msix' -OutFile $packagePath -UseBasicParsing
        $signature = Get-AuthenticodeSignature -LiteralPath $packagePath
        if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'OpenAI') { throw 'The official installer signature could not be verified. No package was installed.' }
        Add-AppxPackage -Path $packagePath -ErrorAction Stop
    } finally {
        $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
        $resolvedDownload = [IO.Path]::GetFullPath($downloadRoot).TrimEnd('\')
        if ((Split-Path -Parent $resolvedDownload) -eq $resolvedTemp -and (Split-Path -Leaf $resolvedDownload).StartsWith('CodexGlassPrerequisite-') -and (Test-Path -LiteralPath $resolvedDownload)) { Remove-Item -LiteralPath $resolvedDownload -Recurse -Force }
    }
}
try {
    if ($SourceAppPath) { $sourceApp = [IO.Path]::GetFullPath($SourceAppPath) }
    else {
        $sourceApp = Find-OfficialCodex
        if (-not $sourceApp -and -not $SkipPrerequisiteDownload) {
            Install-OfficialPrerequisite
            $sourceApp = Find-OfficialCodex
        }
    }
    if (-not $sourceApp) { throw 'The official Codex desktop client was not found. Install it from https://chatgpt.com/codex and run this installer again.' }
    $signature = Get-AuthenticodeSignature -LiteralPath (Join-Path $sourceApp 'ChatGPT.exe')
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'OpenAI') { throw 'Choose an unmodified official OpenAI Codex installation. Its executable signature must be valid.' }
    $node = Join-Path $sourceApp 'resources\cua_node\bin\node.exe'
    if (-not (Test-Path -LiteralPath $node)) { throw 'This Codex version does not contain the required bundled runtime. No files were changed.' }
    Write-Host 'Checking the installed Codex version and patch compatibility...'
    & $node (Join-Path $projectRoot 'scripts\patch.cjs') --app $sourceApp --project $projectRoot --check
    if ($LASTEXITCODE -ne 0) { throw 'This version is incompatible. The original application and profile were not changed. Check the release page for a compatible update.' }
    $parent = Split-Path -Parent $installRootPath
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    $stageRoot = Join-Path $parent ('.CodexLiquidGlass-stage-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stageRoot | Out-Null
    Write-Host 'Preparing an isolated local copy. This may take a few minutes...'
    $stageApp = Join-Path $stageRoot 'app'
    & robocopy.exe $sourceApp $stageApp /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XJ /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw ('The application copy failed (robocopy ' + $LASTEXITCODE + '). Check free disk space and try again.') }
    & $node (Join-Path $projectRoot 'scripts\patch.cjs') --app $stageApp --project $projectRoot --output (Join-Path $stageRoot 'build-manifest.json')
    if ($LASTEXITCODE -ne 0) { throw 'The local customization could not be built. The original installation was not changed.' }
    foreach ($file in @('Launch.ps1','Uninstall.ps1','README.md','LICENSE','THIRD_PARTY_NOTICES.md','compatibility.json')) { Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination (Join-Path $stageRoot $file) }
    $shortcuts = @()
    if (-not $NoShortcut) {
        foreach ($folder in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
            $linkPath = Join-Path $folder 'Codex Liquid Glass.lnk'
            if (Test-Path -LiteralPath $linkPath) { throw ('A shortcut already exists: ' + $linkPath + '. Remove that shortcut or install with -NoShortcut.') }
            $shortcuts += $linkPath
        }
    }
    $record = [ordered]@{Project='CodexLiquidGlass';Version='1.0.0';InstalledAt=[DateTimeOffset]::UtcNow.ToString('o');InstallRoot=$installRootPath;ProfileRoot=$profileRoot;SourceAppPath=$sourceApp;OriginalInstallationModified=$false;ProfileCopied=$false;DebugPortEnabled=$false;Shortcuts=$shortcuts;RegisteredUninstaller=[bool]$isDefaultInstall}
    $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $stageRoot 'installation.json') -Encoding UTF8
    Move-Item -LiteralPath $stageRoot -Destination $installRootPath
    $stageRoot = $null
    $powershell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
    if ($shortcuts.Count) {
        $shell = New-Object -ComObject WScript.Shell
        foreach ($linkPath in $shortcuts) {
            $link = $shell.CreateShortcut($linkPath)
            $link.TargetPath = $powershell
            $link.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $installRootPath 'Launch.ps1') + '"'
            $link.WorkingDirectory = $installRootPath
            $link.IconLocation = (Join-Path $installRootPath 'app\ChatGPT.exe') + ',0'
            $link.Description = 'Codex with clear glass materials and adjustable transparency'
            $link.Save()
        }
    }
    if ($isDefaultInstall) {
        $registry = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CodexLiquidGlass'
        New-Item -Path $registry -Force | Out-Null
        $command = '"' + $powershell + '" -NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $installRootPath 'Uninstall.ps1') + '"'
        foreach ($pair in @{DisplayName='Codex Liquid Glass';DisplayVersion='1.0.0';Publisher='Codex Liquid Glass contributors';InstallLocation=$installRootPath;DisplayIcon=((Join-Path $installRootPath 'app\ChatGPT.exe')+',0');UninstallString=$command;QuietUninstallString=$command}.GetEnumerator()) { New-ItemProperty -Path $registry -Name $pair.Key -Value $pair.Value -PropertyType String -Force | Out-Null }
        foreach ($key in @('NoModify','NoRepair')) { New-ItemProperty -Path $registry -Name $key -Value 1 -PropertyType DWord -Force | Out-Null }
    }
    Write-Host ('Installed Codex Liquid Glass in ' + $installRootPath)
    if (-not $NoLaunch) { & (Join-Path $installRootPath 'Launch.ps1') }
} catch {
    if ($stageRoot -and (Test-Path -LiteralPath $stageRoot)) {
        $resolvedStage = [IO.Path]::GetFullPath($stageRoot)
        if ($resolvedStage.StartsWith(([IO.Path]::GetFullPath((Split-Path -Parent $installRootPath)).TrimEnd('\') + '\'), [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolvedStage).StartsWith('.CodexLiquidGlass-stage-')) { Remove-Item -LiteralPath $resolvedStage -Recurse -Force }
    }
    throw
}
