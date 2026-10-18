<#
.SYNOPSIS
  Downloads a static FFmpeg build for Windows x64 and places ffmpeg.exe + ffprobe.exe
  into resources/bin, verifying the published SHA-256 checksum.

.DESCRIPTION
  Source: https://www.gyan.dev/ffmpeg/builds/ (release "essentials" build: libx264, libx265,
  libmp3lame, libvpx, aac ...). The essentials build is GPLv3 – see README "Licensing".

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/bundle-ffmpeg.ps1
  powershell -ExecutionPolicy Bypass -File scripts/bundle-ffmpeg.ps1 -Force
#>
param(
  [string]$Url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # makes Invoke-WebRequest ~10x faster

$root   = Split-Path -Parent $PSScriptRoot
$binDir = Join-Path $root 'resources\bin'
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

if (-not $Force -and (Test-Path (Join-Path $binDir 'ffmpeg.exe')) -and (Test-Path (Join-Path $binDir 'ffprobe.exe'))) {
  Write-Host 'FFmpeg already bundled (use -Force to refresh).' -ForegroundColor Green
  exit 0
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("tangerine-ffmpeg-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  $zip = Join-Path $tmp 'ffmpeg.zip'
  Write-Host "Downloading $Url"
  Invoke-WebRequest -Uri $Url -OutFile $zip -UseBasicParsing

  try {
    $expected = (Invoke-WebRequest -Uri "$Url.sha256" -UseBasicParsing).Content.Trim().Split(' ')[0].ToLower()
    $actual   = (Get-FileHash -Algorithm SHA256 $zip).Hash.ToLower()
    if ($expected -ne $actual) { throw "Checksum mismatch: expected $expected, got $actual" }
    Write-Host 'Checksum OK' -ForegroundColor Green
  } catch [System.Net.WebException] {
    Write-Warning 'Checksum file unavailable; continuing without verification.'
  }

  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  foreach ($exe in 'ffmpeg.exe', 'ffprobe.exe') {
    $found = Get-ChildItem -Path $tmp -Recurse -Filter $exe | Select-Object -First 1
    if (-not $found) { throw "$exe not found in archive" }
    Copy-Item $found.FullName (Join-Path $binDir $exe) -Force
  }
  $license = Get-ChildItem -Path $tmp -Recurse -Filter 'LICENSE*' | Select-Object -First 1
  if ($license) { Copy-Item $license.FullName (Join-Path $binDir 'FFMPEG-LICENSE.txt') -Force }

  & (Join-Path $binDir 'ffmpeg.exe') -hide_banner -version | Select-Object -First 1
  Write-Host "FFmpeg bundled into $binDir" -ForegroundColor Green
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
