param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Arguments
)

$cli = Join-Path $PSScriptRoot '..\node_modules\.pnpm\@tauri-apps+cli@2.11.4\node_modules\@tauri-apps\cli\tauri.js'
& node $cli @Arguments
exit $LASTEXITCODE
