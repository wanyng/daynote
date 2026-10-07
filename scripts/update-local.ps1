param([switch]$Publish)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
$source = Join-Path $root 'dist\win-unpacked'
$target = Join-Path $root 'app-portable'
$env:TEMP = Join-Path $root '.cache\temp'
$env:TMP = $env:TEMP
$env:DAYNOTE_TEST_EXE = Join-Path $source 'Daynote.exe'
$nodeFolder = Get-ChildItem -LiteralPath (Join-Path $root '.tools') -Directory -Filter 'node-v*-win-x64' | Sort-Object Name -Descending | Select-Object -First 1
$node = if ($nodeFolder) { Join-Path $nodeFolder.FullName 'node.exe' } else { 'node' }
New-Item -ItemType Directory -Force -Path (Join-Path $root 'test-results'),$env:TEMP | Out-Null
Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public static class DaynoteUpdateErrorMode { [DllImport("kernel32.dll")] public static extern uint SetErrorMode(uint mode); }'
$oldMode = [DaynoteUpdateErrorMode]::SetErrorMode(2)
$updated = $false
try {
  if (-not (Test-Path -LiteralPath $env:DAYNOTE_TEST_EXE)) { throw 'Build the new application first.' }
  # Electron's child processes need read/execute access to their runtime files.
  & icacls $source /grant '*S-1-15-2-1:(OI)(CI)(RX)'
  if ($LASTEXITCODE -ne 0) { throw 'Unable to grant read access to the test runtime. No installed files were changed.' }
  $ErrorActionPreference = 'Continue'
  & $node tests/packaged-smoke.cjs 2>&1 | Tee-Object -FilePath 'test-results\packaged-test.log'
  $testExit = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($testExit -ne 0) { throw 'New application verification failed. Your installed app and data have not been changed.' }
  $running = @(Get-Process -Name Daynote -ErrorAction SilentlyContinue)
  if ($running.Count -gt 0) { throw 'Please exit Daynote using its tray menu, then run this script again. No running application was terminated.' }
  if ([IO.Path]::GetFullPath($target) -ne [IO.Path]::Combine([IO.Path]::GetFullPath($root),'app-portable')) { throw 'Unexpected application directory.' }
  $backup = Join-Path $root ('.cache\local-updates\before-0.2.0-' + [DateTime]::Now.ToString('yyyyMMdd-HHmmss'))
  New-Item -ItemType Directory -Force -Path $backup,$target | Out-Null
  $configFile = Join-Path $target 'daynote.config.json'
  if (Test-Path -LiteralPath $configFile) {
    Copy-Item -LiteralPath $configFile -Destination (Join-Path $backup 'daynote.config.json')
    $config = Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json
    $dataRoot = if ([IO.Path]::IsPathRooted($config.dataDir)) { $config.dataDir } else { Join-Path $target $config.dataDir }
    $dataBackup = Join-Path $backup 'saved-data'
    New-Item -ItemType Directory -Force -Path $dataBackup | Out-Null
    foreach ($name in @('state.json','state.backup.json')) {
      $dataFile = Join-Path $dataRoot $name
      if (Test-Path -LiteralPath $dataFile) { Copy-Item -LiteralPath $dataFile -Destination (Join-Path $dataBackup $name) }
    }
  }
  $changes = @()
  foreach ($file in Get-ChildItem -LiteralPath $source -File -Recurse) {
    $relative = $file.FullName.Substring($source.Length+1)
    if ($relative -match '^(data|runtime|backups)(\\|$)' -or $relative -eq 'daynote.config.json') { throw 'Personal data found in build output. Update stopped.' }
    $destination = Join-Path $target $relative
    $exists = Test-Path -LiteralPath $destination
    if ($exists -and ((Get-FileHash -LiteralPath $file.FullName).Hash -eq (Get-FileHash -LiteralPath $destination).Hash)) { continue }
    $saved = Join-Path (Join-Path $backup 'program') $relative
    if ($exists) {
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $saved) | Out-Null
      Copy-Item -LiteralPath $destination -Destination $saved
    }
    $changes += [pscustomobject]@{ Source=$file.FullName; Target=$destination; Saved=$saved; Existed=$exists }
  }
  try {
    foreach ($change in $changes) {
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $change.Target) | Out-Null
      Copy-Item -LiteralPath $change.Source -Destination $change.Target -Force
      if ((Get-FileHash -LiteralPath $change.Source).Hash -ne (Get-FileHash -LiteralPath $change.Target).Hash) { throw 'Updated file checksum mismatch.' }
    }
  } catch {
    foreach ($change in $changes) { if ($change.Existed) { Copy-Item -LiteralPath $change.Saved -Destination $change.Target -Force } }
    throw
  }
  $updated = $true
  [pscustomobject]@{ updated=$true; version='0.2.0'; backup=$backup; changedFiles=$changes.Count } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'test-results\update-status.json') -Encoding utf8
  Write-Host "Update complete. Existing data and settings preserved. Backup: $backup" -ForegroundColor Green
  if ($Publish) { & (Join-Path $PSScriptRoot 'publish.ps1') }
} finally {
  [void][DaynoteUpdateErrorMode]::SetErrorMode($oldMode)
  if ($updated) { Start-Process -FilePath (Join-Path $target 'Daynote.exe') -WorkingDirectory $target }
}
