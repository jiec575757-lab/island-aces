$ErrorActionPreference = 'Stop'
$gameRoot = Split-Path -Parent $PSScriptRoot
$gameUrl = 'http://127.0.0.1:4192/'
try {
  $existing = Invoke-WebRequest -UseBasicParsing -Uri $gameUrl -TimeoutSec 2
  if ($existing.StatusCode -eq 200 -and $existing.Content -match 'ISLAND ACES') {
    Start-Process $gameUrl
    exit 0
  }
} catch {}
try {
  $gameNode = (Get-Command node -ErrorAction Stop).Source
  $logDir = Join-Path $gameRoot 'artifacts'
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  Start-Process -FilePath $gameNode -ArgumentList 'server.cjs' -WorkingDirectory $gameRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'server.log') -RedirectStandardError (Join-Path $logDir 'server-error.log') | Out-Null
  for ($attempt=0; $attempt -lt 30; $attempt++) {
    try {
      $ready = Invoke-WebRequest -UseBasicParsing -Uri $gameUrl -TimeoutSec 1
      if ($ready.StatusCode -eq 200) { Start-Process $gameUrl; exit 0 }
    } catch {}
    Start-Sleep -Milliseconds 150
  }
  throw 'The game server did not start. Check artifacts/server-error.log.'
} catch {
  Write-Host $_.Exception.Message
  Read-Host 'Press Enter to close'
  exit 1
}
