param(
  [string]$ApiBase = "http://127.0.0.1:4000",
  [string]$User = "dev-user",
  [string]$Organization = "dev-organization",
  [string]$Name = $env:COMPUTERNAME
)

$deviceIdPath = Join-Path $env:ProgramData "TallyRemoteConnector\device-id.txt"
if (Test-Path $deviceIdPath) {
  $deviceId = (Get-Content $deviceIdPath -Raw).Trim()
} else {
  $deviceId = [guid]::NewGuid().ToString("N")
  New-Item -ItemType Directory -Force -Path (Split-Path $deviceIdPath) | Out-Null
  Set-Content -Path $deviceIdPath -Value $deviceId -NoNewline
}

$headers = @{
  "x-dev-user" = $User
  "x-dev-organization" = $Organization
}
$body = @{ deviceId = $deviceId; name = $Name } | ConvertTo-Json

Write-Host "Registering connector $Name ($deviceId)..."
$result = Invoke-RestMethod -Method Post -Uri "$ApiBase/api/connectors/register" -Headers $headers -ContentType "application/json" -Body $body

[Environment]::SetEnvironmentVariable("CONNECTOR_CREDENTIAL", $result.credential, "User")
[Environment]::SetEnvironmentVariable("CONNECTOR_NAME", $result.name, "User")
[Environment]::SetEnvironmentVariable("TALLY_API_WS", (($ApiBase -replace '^http:', 'ws:' -replace '^https:', 'wss:') + "/ws/connector"), "User")

Write-Host "Registered successfully."
Write-Host "Credential saved to the current Windows user environment."
Write-Host "Start a new terminal before running the connector."
