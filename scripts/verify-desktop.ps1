$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$env:TEMP = Join-Path $projectRoot '.cache\temp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP,(Join-Path $projectRoot 'test-results') | Out-Null
# Suppress Windows' JIT debugger dialog for this test process tree only.
Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public static class DaynoteTestErrorMode { [DllImport("kernel32.dll")] public static extern uint SetErrorMode(uint mode); }'
$previousMode = [DaynoteTestErrorMode]::SetErrorMode(2)
$log = Join-Path $projectRoot 'test-results\desktop-test.log'
$electron = Join-Path $projectRoot 'node_modules\electron\dist\electron.exe'
try {
  $ErrorActionPreference = 'Continue'
  & $electron tests/desktop-smoke.cjs 2>&1 | Tee-Object -FilePath $log
  if ($LASTEXITCODE -ne 0 -or -not (Select-String -LiteralPath $log -Pattern 'PASS empty start' -Quiet)) { throw 'Desktop test failed. See test-results\desktop-test.log.' }
  & $electron tests/desktop-smoke.cjs --verify-restart 2>&1 | Tee-Object -FilePath $log -Append
  if ($LASTEXITCODE -ne 0 -or -not (Select-String -LiteralPath $log -Pattern 'PASS actual process restart' -Quiet)) { throw 'Restart test failed. See test-results\desktop-test.log.' }
  Write-Host 'PASS: Desktop and restart tests completed.' -ForegroundColor Green
} finally { [void][DaynoteTestErrorMode]::SetErrorMode($previousMode) }
