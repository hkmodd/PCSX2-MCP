# PCSX2-MCP Release Packager
# Creates a clean zip with only release binaries + MCP server
# Usage: .\package-release.ps1 [-Version "1.0.0"]

param(
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$buildDir = Join-Path $scriptDir "pcsx2-src\build\pcsx2-qt"
$mcpDir = Join-Path $scriptDir "pcsx2-mcp-server"
$outName = "PCSX2-MCP-v${Version}-win64"
$outDir = Join-Path $scriptDir "release\$outName"
$zipPath = Join-Path $scriptDir "release\${outName}.zip"

# ── Validate ──────────────────────────────────────────────

if (-not (Test-Path "$buildDir\pcsx2-qt.exe")) {
    Write-Error "pcsx2-qt.exe not found at $buildDir. Build PCSX2 first."
    exit 1
}
if (-not (Test-Path "$mcpDir\dist\index.js")) {
    Write-Error "MCP server not built. Run 'npm run build' in $mcpDir first."
    exit 1
}

# ── Clean previous release ────────────────────────────────

if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
New-Item $outDir -ItemType Directory -Force | Out-Null

Write-Host "=== Packaging PCSX2-MCP v${Version} ===" -ForegroundColor Cyan

# ── 1. Copy PCSX2 release binaries ────────────────────────

Write-Host "`n[1/4] Copying PCSX2 binaries (release only)..." -ForegroundColor Yellow

# Copy exe + release DLLs (exclude debug DLLs, PDBs, build artifacts)
Get-ChildItem $buildDir -File | Where-Object {
    $_.Extension -in @('.exe', '.dll', '.qm') -and
    $_.Name -notmatch 'd\.(dll)$' -and       # skip *d.dll (debug)
    $_.Name -ne 'pcsx2-qt.exp' -and
    $_.Name -ne 'pcsx2-qt.lib'
} | ForEach-Object {
    Copy-Item $_.FullName $outDir
}

# ── 2. Copy Qt plugin subdirectories (release only) ────────

Write-Host "[2/4] Copying Qt plugins (release only)..." -ForegroundColor Yellow

$qtPluginDirs = @('platforms', 'imageformats', 'iconengines', 'styles', 'tls')
foreach ($dir in $qtPluginDirs) {
    $srcDir = Join-Path $buildDir $dir
    if (Test-Path $srcDir) {
        $destDir = Join-Path $outDir $dir
        New-Item $destDir -ItemType Directory -Force | Out-Null
        
        # Copy only release DLLs (no *d.dll, no *.pdb)
        Get-ChildItem $srcDir -File | Where-Object {
            $_.Extension -eq '.dll' -and
            $_.Name -notmatch 'd\.dll$'
        } | ForEach-Object {
            Copy-Item $_.FullName $destDir
        }
    }
}

# Copy resources directory (shaders, etc)
$resourcesDir = Join-Path $buildDir "resources"
if (Test-Path $resourcesDir) {
    Copy-Item $resourcesDir (Join-Path $outDir "resources") -Recurse
}

# ── 3. Copy MCP Server ────────────────────────────────────

Write-Host "[3/4] Copying MCP server..." -ForegroundColor Yellow

$mcpOut = Join-Path $outDir "pcsx2-mcp-server"
New-Item $mcpOut -ItemType Directory -Force | Out-Null

# Copy compiled JS
Copy-Item "$mcpDir\dist" "$mcpOut\dist" -Recurse
Copy-Item "$mcpDir\package.json" "$mcpOut\package.json"
Copy-Item "$mcpDir\package-lock.json" "$mcpOut\package-lock.json" -ErrorAction SilentlyContinue

# Copy node_modules (pre-installed so user doesn't need npm install)
if (Test-Path "$mcpDir\node_modules") {
    Copy-Item "$mcpDir\node_modules" "$mcpOut\node_modules" -Recurse
}

# ── 4. Copy docs + setup ──────────────────────────────────

Write-Host "[4/4] Copying docs and setup..." -ForegroundColor Yellow

Copy-Item (Join-Path $scriptDir "README.md") $outDir
Copy-Item (Join-Path $scriptDir "setup-mcp.bat") $outDir -ErrorAction SilentlyContinue

# Copy DebugServer source for reference/GPL compliance
$srcOut = Join-Path $outDir "source"
New-Item $srcOut -ItemType Directory -Force | Out-Null
Copy-Item (Join-Path $scriptDir "pcsx2-src\pcsx2\DebugTools\DebugServer.cpp") $srcOut
Copy-Item (Join-Path $scriptDir "pcsx2-src\pcsx2\DebugTools\DebugServer.h") $srcOut

# ── Create zip ────────────────────────────────────────────

Write-Host "`nCreating zip..." -ForegroundColor Yellow

$releaseDir = Join-Path $scriptDir "release"

# Try 7-Zip first (much better compression), fall back to Compress-Archive
$7z = "C:\Program Files\7-Zip\7z.exe"
if (Test-Path $7z) {
    Push-Location $releaseDir
    & $7z a -tzip -mx=9 "${outName}.zip" "$outName\*" | Out-Null
    Pop-Location
} else {
    Compress-Archive -Path "$outDir\*" -DestinationPath $zipPath -CompressionLevel Optimal
}

# ── Summary ───────────────────────────────────────────────

$fileCount = (Get-ChildItem $outDir -File -Recurse).Count
$sizeMB = [math]::Round((Get-ChildItem $outDir -File -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
$zipSize = if (Test-Path $zipPath) { [math]::Round((Get-Item $zipPath).Length / 1MB, 1) } else { "?" }

Write-Host "`n=== Done! ===" -ForegroundColor Green
Write-Host "  Files:      $fileCount"
Write-Host "  Unzipped:   ${sizeMB} MB"
Write-Host "  Zip:        ${zipSize} MB"
Write-Host "  Output:     $zipPath"
Write-Host ""
Write-Host "Upload this zip as a GitHub Release asset." -ForegroundColor Cyan
