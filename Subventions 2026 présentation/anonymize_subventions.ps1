# Find the directory dynamically using a wildcard search to avoid encoding issues with accents
$dir = Get-ChildItem -Directory "Source book" | Where-Object { $_.Name -like "*Subventions*" }
$dataFilePath = Join-Path $dir.FullName "data.js"

Write-Output "Found data file at: $dataFilePath"

# Parse existing data.js
$content = Get-Content $dataFilePath -Raw

# Extract JSON block between [ and ] strictly
$startIndex = $content.IndexOf('[')
$endIndex = $content.LastIndexOf(']')
if ($startIndex -eq -1 -or $endIndex -eq -1) {
    Write-Error "Could not locate JSON array inside data.js"
    exit 1
}
$jsonText = $content.Substring($startIndex, $endIndex - $startIndex + 1)
$data = ConvertFrom-Json $jsonText

# Unique mappings
$assoMap = @{}
$cityMap = @{
    'Beauzac' = 'Saint-Pierre-des-Monts';
    'Monistrol/Loire' = 'Saint-Julien-sur-Loire';
    'Monistrol-sur-Loire' = 'Saint-Julien-sur-Loire';
    'Bas-en-Basset' = 'Mireval-sur-Loire';
    'Sainte-Sigolène' = 'Sainte-Agathe';
    'Sainte-Sigolene' = 'Sainte-Agathe';
    'Saint-Pal-de-Mons' = 'Saint-Paul-en-Forez';
    'La Chapelle d''Aurec' = 'La Chapelle-Saint-Jean';
    'La Chapelle-d''Aurec' = 'La Chapelle-Saint-Jean';
    'Les Villettes' = 'Les Tilleuls';
    'Malvalette' = 'Val-Saint-Martin';
    'Tiranges' = 'Mont-Tiranges';
    'Saint-André-de-Chalencon' = 'Saint-Andre-les-Châteaux';
    'Solignac-sous-Roche' = 'Solignac-le-Château';
    'Boisset' = 'Boisset-le-Vert'
}

$adjectives = @('des Collines', 'du Val-Joli', 'du Forez', 'Municipal(e)', 'des Rives', 'de la Plaine', 'des Sablières', 'Scolaire', 'd''Animation', 'Laïque', 'Régional(e)', 'Intercommunal(e)')
$nounIndex = 0

function Get-AnonymizedName($oldName) {
    if ($assoMap.Contains($oldName)) {
        return $assoMap[$oldName]
    }
    
    $newName = ''
    $prefix = ''
    
    # Try to keep semantic prefixes
    if ($oldName -like '*Crèche*') { $prefix = 'Crèche Multi-Accueil' }
    elseif ($oldName -like '*Micro-crèche*') { $prefix = 'Micro-Crèche' }
    elseif ($oldName -like '*ALSH*' -or $oldName -like '*Périscolaire*') { $prefix = 'Accueil de Loisirs' }
    elseif ($oldName -like '*MJC*') { $prefix = 'Maison des Jeunes et de la Culture' }
    elseif ($oldName -like '*Foot*' -or $oldName -like '*Football*') { $prefix = 'Club de Football' }
    elseif ($oldName -like '*Tennis*') { $prefix = 'Tennis Club' }
    elseif ($oldName -like '*Basket*') { $prefix = 'Basket Club' }
    elseif ($oldName -like '*Judo*') { $prefix = 'Club de Judo' }
    elseif ($oldName -like '*Musique*' -or $oldName -like '*Harmonie*') { $prefix = 'Harmonie Musicale' }
    elseif ($oldName -like '*Chasse*') { $prefix = 'Société de Chasse' }
    elseif ($oldName -like '*Pompiers*' -or $oldName -like '*Sapeurs*') { $prefix = 'Amicale des Sapeurs-Pompiers' }
    elseif ($oldName -like '*Amicale*') { $prefix = 'Amicale Solidaire' }
    elseif ($oldName -like '*Familles Rurales*') { $prefix = 'Association Familles Actives' }
    else { $prefix = 'Association' }

    $newName = "$prefix $($adjectives[$nounIndex % $adjectives.Count]) (N°$($nounIndex + 1))"
    $nounIndex++
    
    $assoMap[$oldName] = $newName
    return $newName
}

$newData = @()
foreach ($item in $data) {
    # Anonymize City
    $city = $item.commune
    if ($cityMap.Contains($city)) {
        $item.commune = $cityMap[$city]
    }
    
    # Anonymize Association Name
    $name = $item.name
    $item.name = Get-AnonymizedName $name
    
    # Clean justifications if containing real names
    if ($item.justification) {
        $item.justification = ''
    }
    if ($item.commission_comment) {
        # Check comments and replace any city or real name references
        foreach ($key in $cityMap.Keys) {
            $item.commission_comment = $item.commission_comment -replace $key, $cityMap[$key]
        }
    }
    
    $newData += $item
}

# Generate new data.js content
$newJson = $newData | ConvertTo-Json -Depth 5
$newContent = 'const SUBVENTIONS_DATA = ' + $newJson + ';'
Set-Content -Path $dataFilePath -Value $newContent -Encoding UTF8
Write-Output 'Subventions Anonymisées avec Succès'
