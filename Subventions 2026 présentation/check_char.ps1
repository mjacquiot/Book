$bytes = [System.IO.File]::ReadAllBytes("data.js")
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$lines = $text -split "`r?`n" | Select-String -Pattern 'category.*RPE'
if ($lines) {
    Write-Output "Raw line: $($lines[0])"
    # Print character codes
    $chars = $lines[0].ToString().ToCharArray()
    $codes = foreach ($c in $chars) { "[char]$c -> $(([int]$c))" }
    Write-Output "Character Codes:"
    $codes | Select-Object -First 35
} else {
    Write-Output "No lines found"
}
