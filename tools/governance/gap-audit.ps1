$root = 'F:\Alsaada-Smart-Bot'
$list = Join-Path $root 'vitest-list-output.txt'

$files = Get-Content $list |
  Where-Object { $_ -match '\.(spec|test|e2e)\.(ts|tsx|mjs|js)' } |
  ForEach-Object { ($_ -split ' > ')[0] } |
  Sort-Object -Unique

Write-Output ("VITEST UNIQUE FILES: " + $files.Count)

$missing = @()
$v = @()
foreach ($f in $files) {
  $p = Join-Path $root $f
  if (Test-Path $p) {
    $v += $p.ToLower()
  } else {
    $missing += $f
  }
}

$s = Get-ChildItem -Recurse -Include *.spec.ts,*.spec.tsx,*.test.ts,*.test.tsx,*.e2e.ts,*.integration.ts,*.unit.ts -File |
  Where-Object { $_.FullName -notmatch 'node_modules|dist|\.git|coverage|build' } |
  ForEach-Object { $_.FullName.ToLower() }

Write-Output ("VITEST RESOLVED: " + $v.Count)
Write-Output ("SEARCH FILES: " + $s.Count)

Write-Output "=== LISTED BY VITEST BUT MISSING ON DISK ==="
$missing

Write-Output "=== IN VITEST BUT HIDDEN FROM SEARCH ==="
foreach ($x in $v) { if ($s -notcontains $x) { $x } }

Write-Output "=== EXISTS BUT NOT RUN BY VITEST ==="
foreach ($x in $s) { if ($v -notcontains $x) { $x } }

Write-Output "=== 15 WEAKEST FILES ==="
Get-Content $list |
  Where-Object { $_ -match '\.(spec|test|e2e)\.' } |
  ForEach-Object { ($_ -split ' > ')[0] } |
  Group-Object | Sort-Object Count |
  Select-Object -First 15 Count, Name
