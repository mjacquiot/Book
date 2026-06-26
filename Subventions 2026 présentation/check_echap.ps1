$content = Get-Content -Path "data.js" -Raw
$jsonText = $content -replace "const SUBVENTIONS_DATA =", ""
$jsonText = $jsonText.Trim().TrimEnd(';')
$data = $jsonText | ConvertFrom-Json

$data | Where-Object { $_.name -like "*Echap*" } | Select-Object category, name, sub_2025_acted, sub_2025_requested_struct, sub_final_2026 | Format-Table -AutoSize
