# Convert the legacy v1 data.js into a Supabase seed.sql.
# Pure-ASCII script: all Hebrew comes from the data.js bytes (read as UTF-8),
# never from this file, so PowerShell 5.1 parses it correctly.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\gen-seed.ps1

$ErrorActionPreference = 'Stop'

# Paths arrive as UTF-8 base64 (ASCII-safe) so no Hebrew literal lives in this
# file — PowerShell 5.1 would otherwise mangle it when reading the script.
$dataJsB64  = $args[0]
$outFileB64 = $args[1]
$dataJs  = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($dataJsB64))
$outFile = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($outFileB64))

$lines = [System.IO.File]::ReadAllLines($dataJs, [System.Text.Encoding]::UTF8)

# ---- helpers ---------------------------------------------------------------
$unescapeEval = [System.Text.RegularExpressions.MatchEvaluator]{
  param($m)
  switch ($m.Groups[1].Value) {
    'n' { "`n" }
    't' { "`t" }
    'r' { '' }
    default { $m.Groups[1].Value }   # \' -> '   \\ -> \   \" -> "
  }
}
function UnescapeJs([string]$s) {
  if ($null -eq $s) { return '' }
  return [regex]::Replace($s, '\\(.)', $unescapeEval)
}
function SqlStr([string]$s) {
  if ($null -eq $s) { return "''" }
  return "'" + ($s -replace "'", "''") + "'"
}
function GetStr([string]$obj, [string]$field) {
  $m = [regex]::Match($obj, "(?:^|[,{])\s*$field\s*:\s*'((?:[^'\\]|\\.)*)'")
  if ($m.Success) { return UnescapeJs $m.Groups[1].Value }
  return ''
}
function GetNum([string]$obj, [string]$field) {
  $m = [regex]::Match($obj, "(?:^|[,{])\s*$field\s*:\s*([0-9.]+)")
  if ($m.Success) { return $m.Groups[1].Value }
  return '0'
}
function GetProducers([string]$obj) {
  $m = [regex]::Match($obj, "producers\s*:\s*\[([^\]]*)\]")
  if (-not $m.Success) { return @() }
  $ids = @()
  foreach ($mm in [regex]::Matches($m.Groups[1].Value, "'([^']*)'")) { $ids += $mm.Groups[1].Value }
  return $ids
}
function SqlArr($ids) {
  if ($null -eq $ids -or $ids.Count -eq 0) { return 'ARRAY[]::text[]' }
  $parts = @()
  foreach ($id in $ids) { $parts += SqlStr $id }
  return 'ARRAY[' + ($parts -join ',') + ']::text[]'
}

# ---- split into sections by marker -> closing "];" ------------------------
$section = ''
$producers = @(); $clients = @(); $projects = @(); $history = @()
foreach ($line in $lines) {
  $t = $line.Trim()
  if     ($t.StartsWith('window.PRODUCERS')) { $section = 'producers'; continue }
  elseif ($t.StartsWith('window.CLIENTS'))   { $section = 'clients';   continue }
  elseif ($t.StartsWith('window.PROJECTS'))  { $section = 'projects';  continue }
  elseif ($t.StartsWith('window.HISTORY'))   { $section = 'history';   continue }
  elseif ($t.StartsWith('window.'))          { $section = '';          continue }
  if ($t -eq '];') { $section = ''; continue }
  if ($section -eq '' -or -not $t.StartsWith('{')) { continue }
  switch ($section) {
    'producers' { $producers += $t }
    'clients'   { $clients   += $t }
    'projects'  { $projects  += $t }
    'history'   { $history   += $t }
  }
}

# ---- build SQL -------------------------------------------------------------
$sb = New-Object System.Text.StringBuilder
$nl = "`r`n"
[void]$sb.Append('-- Auto-generated seed from v1 data.js. Run AFTER schema.sql.' + $nl)
[void]$sb.Append('-- Safe to re-run: truncates data tables (NOT allowed_emails) first.' + $nl + $nl)
[void]$sb.Append('truncate table public.assignments cascade;' + $nl)
[void]$sb.Append('truncate table public.projects    cascade;' + $nl)
[void]$sb.Append('truncate table public.history     cascade;' + $nl)
[void]$sb.Append('truncate table public.producers   cascade;' + $nl)
[void]$sb.Append('truncate table public.teams       cascade;' + $nl)
[void]$sb.Append('truncate table public.clients     cascade;' + $nl + $nl)

# producers
[void]$sb.Append('insert into public.producers (id,name,color,capacity,hours_week,position_pct,sort_index) values' + $nl)
$rows = @()
$i = 0
foreach ($o in $producers) {
  $rows += '  (' + (SqlStr (GetStr $o 'id')) + ',' + (SqlStr (GetStr $o 'name')) + ',' +
           (SqlStr (GetStr $o 'color')) + ',' + (GetNum $o 'capacity') + ',' +
           (GetNum $o 'hoursWeek') + ',1.0,' + $i + ')'
  $i++
}
[void]$sb.Append(($rows -join (',' + $nl)))
[void]$sb.Append(';' + $nl + $nl)

# clients
if ($clients.Count -gt 0) {
  [void]$sb.Append('insert into public.clients (id,name,short) values' + $nl)
  $rows = @()
  foreach ($o in $clients) {
    $rows += '  (' + (SqlStr (GetStr $o 'id')) + ',' + (SqlStr (GetStr $o 'name')) + ',' + (SqlStr (GetStr $o 'short')) + ')'
  }
  [void]$sb.Append(($rows -join (',' + $nl)))
  [void]$sb.Append(';' + $nl + $nl)
}

# projects
[void]$sb.Append('insert into public.projects (id,name,type,status,client,pm,start_date,due_date,hours,producers,notes,complexity,urgency,sort_index) values' + $nl)
$rows = @()
$i = 0
foreach ($o in $projects) {
  $urg = GetStr $o 'urgency'; if ($urg -eq '') { $urg = 'normal' }
  $st  = GetStr $o 'status';  if ($st  -eq '') { $st  = 'planning' }
  $rows += '  (' + (SqlStr (GetStr $o 'id')) + ',' + (SqlStr (GetStr $o 'name')) + ',' +
           (SqlStr (GetStr $o 'type')) + ',' + (SqlStr $st) + ',' +
           (SqlStr (GetStr $o 'client')) + ',' + (SqlStr (GetStr $o 'pm')) + ',' +
           (SqlStr (GetStr $o 'start')) + ',' + (SqlStr (GetStr $o 'due')) + ',' +
           (GetNum $o 'hours') + ',' + (SqlArr (GetProducers $o)) + ',' +
           (SqlStr (GetStr $o 'notes')) + ',' + (SqlStr (GetStr $o 'complexity')) + ',' +
           (SqlStr $urg) + ',' + $i + ')'
  $i++
}
[void]$sb.Append(($rows -join (',' + $nl)))
[void]$sb.Append(';' + $nl + $nl)

# history
[void]$sb.Append('insert into public.history (id,name,type,client,pm,completed_date,hours,producers) values' + $nl)
$rows = @()
foreach ($o in $history) {
  $rows += '  (' + (SqlStr (GetStr $o 'id')) + ',' + (SqlStr (GetStr $o 'name')) + ',' +
           (SqlStr (GetStr $o 'type')) + ',' + (SqlStr (GetStr $o 'client')) + ',' +
           (SqlStr (GetStr $o 'pm')) + ',' + (SqlStr (GetStr $o 'completed')) + ',' +
           (GetNum $o 'hours') + ',' + (SqlArr (GetProducers $o)) + ')'
}
[void]$sb.Append(($rows -join (',' + $nl)))
[void]$sb.Append(';' + $nl)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outFile, $sb.ToString(), $utf8NoBom)
Write-Output ("producers=" + $producers.Count + " clients=" + $clients.Count + " projects=" + $projects.Count + " history=" + $history.Count)
