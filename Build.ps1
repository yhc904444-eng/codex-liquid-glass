[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$env:PSModulePath = (Join-Path $PSHOME 'Modules') + ';' + $env:PSModulePath
$root = $PSScriptRoot
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Path $dist -Force | Out-Null
$version = (Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$files = @('Install.cmd','Install.ps1','Launch.ps1','Uninstall.ps1','README.md','LICENSE','THIRD_PARTY_NOTICES.md','compatibility.json','scripts\patch.cjs','src\glass-main.cjs','src\glass-preload.cjs','src\glass-renderer.js','src\glass.css')
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$payload = Join-Path $dist 'payload.zip'
if (Test-Path -LiteralPath $payload) { Remove-Item -LiteralPath $payload -Force }
$zip = [IO.Compression.ZipFile]::Open($payload, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) {
        $inputPath = Join-Path $root $file
        if (-not (Test-Path -LiteralPath $inputPath)) { throw ('Missing release file: ' + $file) }
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $inputPath, $file.Replace('\','/'), [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $zip.Dispose() }
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw '.NET Framework 4.x compiler was not found.' }
$setup = Join-Path $dist ('Codex-Liquid-Glass-' + $version + '-Setup.exe')
& $compiler /nologo /target:winexe /platform:x64 /optimize+ /r:System.Windows.Forms.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll ('/resource:' + $payload + ',payload.zip') ('/out:' + $setup) (Join-Path $root 'scripts\Setup.cs')
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
$portable = Join-Path $dist ('Codex-Liquid-Glass-' + $version + '-Installer.zip')
Copy-Item -LiteralPath $payload -Destination $portable -Force
Remove-Item -LiteralPath $payload -Force
$sums = foreach ($artifact in @($setup,$portable)) {
    $stream=[IO.File]::OpenRead($artifact); $algorithm=[Security.Cryptography.SHA256]::Create()
    try { $hash=[BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant() } finally { $stream.Dispose(); $algorithm.Dispose() }
    $hash + '  ' + (Split-Path -Leaf $artifact)
}
[IO.File]::WriteAllLines((Join-Path $dist 'SHA256SUMS.txt'), $sums, [Text.UTF8Encoding]::new($false))
Write-Host ('Built ' + $setup)
Write-Host ('Built ' + $portable)
