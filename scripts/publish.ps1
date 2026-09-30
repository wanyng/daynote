param(
  [string]$Repository = 'https://github.com/wanyng/daynote.git',
  [string]$AuthorName = 'wanyng',
  [string]$AuthorEmail = '2409719750@qq.com'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$resultDir = Join-Path $projectRoot 'test-results'
New-Item -ItemType Directory -Force -Path $resultDir | Out-Null
Start-Transcript -LiteralPath (Join-Path $resultDir 'publish.log') -Force | Out-Null
function Invoke-DaynoteGit {
  & git -c "safe.directory=$($projectRoot.Replace('\','/'))" @args
  if ($LASTEXITCODE -ne 0) { throw "Git failed: $($args[0]). Your local files are preserved." }
}
try {
  $branch = Invoke-DaynoteGit branch --show-current
  if ($branch -ne 'main') { throw 'Expected branch main. No branch was changed.' }
  $remoteNames = @(Invoke-DaynoteGit remote)
  if ($remoteNames -contains 'origin') {
    $existing = Invoke-DaynoteGit remote get-url origin
    if ($existing -ne $Repository) { throw 'origin points to a different repository. No remote was changed.' }
  } else { Invoke-DaynoteGit remote add origin $Repository }
  $staged = @(Invoke-DaynoteGit diff --cached --name-only)
  if ($staged.Count -gt 0) { throw 'There are already staged files. Review them before publishing.' }
  Invoke-DaynoteGit add -- .gitignore .github LICENSE PORTABLE.txt README.md package.json package-lock.json scripts src tests
  $staged = @(Invoke-DaynoteGit diff --cached --name-only)
  $unexpected = @($staged | Where-Object { $_ -notmatch '^(\.gitignore|LICENSE|PORTABLE\.txt|README\.md|package(-lock)?\.json|\.github/|scripts/|src/|tests/)' })
  if ($unexpected.Count -gt 0) { throw 'Unexpected staged files. Review git status before proceeding.' }
  Invoke-DaynoteGit diff --cached --stat
  if ($staged.Count -gt 0) {
    Invoke-DaynoteGit -c "user.name=$AuthorName" -c "user.email=$AuthorEmail" commit -m 'Initial Daynote desktop app with local storage and widget'
  }
  Invoke-DaynoteGit push -u origin main
  Write-Host 'Source published successfully. No personal data or build cache was included.' -ForegroundColor Green
} finally { Stop-Transcript | Out-Null }
