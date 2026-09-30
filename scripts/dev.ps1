param([ValidateSet('install','start','test','pack','dist')][string]$Task = 'start')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$env:npm_config_cache = Join-Path $projectRoot '.cache\npm'
$env:ELECTRON_CACHE = Join-Path $projectRoot '.cache\electron'
$env:electron_config_cache = $env:ELECTRON_CACHE
$env:ELECTRON_BUILDER_CACHE = Join-Path $projectRoot '.cache\builder'
$env:TEMP = Join-Path $projectRoot '.cache\temp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP,$env:npm_config_cache,$env:ELECTRON_CACHE,$env:ELECTRON_BUILDER_CACHE | Out-Null
$portableNode = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools') -Directory -Filter 'node-v*-win-x64' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if ($portableNode) { $env:PATH = $portableNode.FullName + ';' + $env:PATH }
if ($Task -eq 'install') {
  if (Test-Path -LiteralPath 'package-lock.json') { npm ci --no-audit --no-fund }
  else { npm install --no-audit --no-fund }
} else { npm run $Task }
exit $LASTEXITCODE
