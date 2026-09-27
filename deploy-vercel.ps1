# Half Zipper — zero-touch Vercel deploy.
# Prerequisite (one time, in browser): `vercel login`
# Then just run: .\deploy-vercel.ps1
# It links the project, pushes ALL env vars, deploys --prod,
# sets NEXTAUTH_URL from the live URL, and redeploys once.

$ErrorActionPreference = "Stop"

Write-Host "== 0. checking login ==" -ForegroundColor Cyan
vercel whoami
if ($LASTEXITCODE -ne 0) {
  Write-Host "Not logged in. Run: vercel login (browser, one click), then re-run this script." -ForegroundColor Red
  exit 1
}

Write-Host "== 1. link project ==" -ForegroundColor Cyan
vercel link --yes

Write-Host "== 2. pushing env vars (production) ==" -ForegroundColor Cyan
$envFile = Join-Path $PSScriptRoot ".env.production.ready"
Get-Content -LiteralPath $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) { return }
  $i = $line.IndexOf("=")
  if ($i -lt 1) { return }
  $key = $line.Substring(0, $i).Trim()
  $val = $line.Substring($i + 1).Trim().Trim('"')
  if ($key -eq "" -or $val -eq "") { return }
  Write-Host "  env: $key"
  vercel env rm $key production --yes 2>$null | Out-Null
  # pipe value via stdin (non-interactive)
  $val | vercel env add $key production | Out-Null
}

Write-Host "== 3. deploy --prod ==" -ForegroundColor Cyan
$deployOut = vercel --prod --yes 2>&1 | Out-String
Write-Host $deployOut
$url = ([regex]::Matches($deployOut, "https://[a-zA-Z0-9\-.]+\.vercel\.app") | Select-Object -Last 1).Value
if (-not $url) {
  Write-Host "Could not detect deployment URL. Set NEXTAUTH_URL manually in Vercel dashboard." -ForegroundColor Yellow
  exit 0
}
Write-Host "Live URL: $url" -ForegroundColor Green

Write-Host "== 4. set NEXTAUTH_URL + redeploy ==" -ForegroundColor Cyan
vercel env rm NEXTAUTH_URL production --yes 2>$null | Out-Null
$url | vercel env add NEXTAUTH_URL production | Out-Null
vercel --prod --yes | Select-Object -Last 3

Write-Host "DONE ✅ $url" -ForegroundColor Green
Write-Host "Admin: $url/admin/login  (admin@halfzipper.local)"
