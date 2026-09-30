$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$node = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools') -Directory -Filter 'node-v*-win-x64' | Sort-Object Name -Descending | Select-Object -First 1
$nodeExe = if ($node) { Join-Path $node.FullName 'node.exe' } else { 'node' }
$env:TEMP = Join-Path $projectRoot '.cache\temp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP,(Join-Path $projectRoot 'test-results') | Out-Null
Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public static class DaynoteReleaseErrorMode { [DllImport("kernel32.dll")] public static extern uint SetErrorMode(uint mode); }'
$previousMode = [DaynoteReleaseErrorMode]::SetErrorMode(2)
try {
  $ErrorActionPreference = 'Continue'
  & $nodeExe tests/packaged-smoke.cjs 2>&1 | Tee-Object -FilePath 'test-results\packaged-test.log'
  $testExit = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($testExit -ne 0) { throw 'Packaged tests failed. Results are in test-results\packaged-test.log.' }
  & (Join-Path $PSScriptRoot 'publish.ps1')
} finally {
  [void][DaynoteReleaseErrorMode]::SetErrorMode($previousMode)
  # This is the interactive app requested by the user.
  Start-Process -FilePath (Join-Path $projectRoot 'app-portable\Daynote.exe') -WorkingDirectory (Join-Path $projectRoot 'app-portable')
}
