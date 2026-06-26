import os
import re
import json
import random

# Base paths
base_dir = "Source book"

# --- 1. EXHAUSTIVE CITY REPLACEMENT MAP ---
city_map = {
    'Beauzac': 'Saint-Pierre-des-Monts',
    'Monistrol/Loire': 'Saint-Julien-sur-Loire',
    'Monistrol-sur-Loire': 'Saint-Julien-sur-Loire',
    'Monistrol sur Loire': 'Saint-Julien-sur-Loire',
    'Bas-en-Basset': 'Mireval-sur-Loire',
    'Sainte-Sigolène': 'Sainte-Agathe',
    'Sainte-Sigolene': 'Sainte-Agathe',
    'Sainte Sigolene': 'Sainte-Agathe',
    'Ste Sigolene': 'Sainte-Agathe',
    'Ste Sigolène': 'Sainte-Agathe',
    'Saint-Pal-de-Mons': 'Saint-Paul-en-Forez',
    'Saint Pal de Mons': 'Saint-Paul-en-Forez',
    'St Pal de Mons': 'Saint-Paul-en-Forez',
    'La Chapelle d\'Aurec': 'La Chapelle-Saint-Jean',
    'La Chapelle-d\'Aurec': 'La Chapelle-Saint-Jean',
    'La Chapelle d’Aurec': 'La Chapelle-Saint-Jean',
    'Les Villettes': 'Les Tilleuls',
    'Malvalette': 'Val-Saint-Martin',
    'Tiranges': 'Mont-Tiranges',
    'Saint-André-de-Chalencon': 'Saint-Andre-les-Châteaux',
    'Solignac-sous-Roche': 'Solignac-le-Château',
    'Boisset': 'Boisset-le-Vert',
    'St Pal de Chalencon': 'Chalencon-les-Pins',
    'St-Pal-de-Chalencon': 'Chalencon-les-Pins',
    'Saint-Pal-de-Chalencon': 'Chalencon-les-Pins',
    'Saint Pal de Chalencon': 'Chalencon-les-Pins'
}

def clean_double_encoding(text):
    # Fix double-encoded UTF-8 characters cleanly
    replacements = {
        'Ã©': 'é',
        'Ã¨': 'è',
        'Ã ': 'à',
        'Ã¹': 'ù',
        'Ã»': 'û',
        'Ã´': 'ô',
        'Ã®': 'î',
        'Ã«': 'ë',
        'Ã§': 'ç',
        'Ãª': 'ê',
        'Ã¢': 'â',
        'Ã‰': 'É',
        'Ãˆ': 'È',
        'Ã€': 'À',
        'Ã‡': 'Ç',
        'Ã¯': 'ï',
        'Ã¶': 'ö',
        'Ã¤': 'ä',
        'Ã¦': 'æ',
        'Å“': 'œ',
        'Ã': 'à', # fallback for single Ã
    }
    # Sort by key length descending to prevent partial matching corruption
    for k in sorted(replacements.keys(), key=len, reverse=True):
        text = text.replace(k, replacements[k])
    return text

# --- 2. REPAIR & ANONYMIZE TROMBINOSCOPE ---
print("--- Process Trombinoscope ---")
data_filePath = os.path.join(base_dir, "Trombinoscope CCMVR", "elus_data.js")
photos_dir = os.path.join(base_dir, "Trombinoscope CCMVR", "Photos_Elus")

# Read file
with open(data_filePath, "r", encoding="utf-8") as f:
    raw_content = f.read()

# Fix encoding
raw_content = clean_double_encoding(raw_content)

# Extract JSON
json_match = re.search(r'\[.*\]', raw_content, re.DOTALL)
if json_match:
    elus = json.loads(json_match.group(0))
    
    last_names = ['DUPONT', 'MARTIN', 'LEROY', 'BERNARD', 'PETIT', 'ROUX', 'SIMON', 'LAURENT', 'LEFEBVRE', 'MICHEL', 'GARCIA', 'DAVID', 'BERTRAND', 'ROUBY', 'BARBIER', 'VINCENT', 'MOREAU', 'FOURNIER', 'GIRARD', 'BONNET', 'DUBOIS', 'MOREL', 'GUERIN', 'ANDRE', 'RICHARD', 'ROCHETTE', 'FAURE', 'BLANCHARD', 'BRUN', 'GERARD', 'MERCIER', 'MARIE', 'DUVAL', 'SCHMITT', 'LEROUX', 'ROY', 'ROUSSEAU', 'CLERC', 'BONNARD']
    first_names = ['Julie', 'Thomas', 'Sophie', 'Pierre', 'Marie', 'Nicolas', 'Catherine', 'Jean', 'Audrey', 'Michel', 'Nathalie', 'Francois', 'Isabelle', 'Lucas', 'Sylvie', 'Guillaume', 'Valerie', 'Christophe', 'Sandrine', 'Julien', 'Cecile', 'Antoine', 'Laurence', 'Sebastien', 'Elisabeth', 'Mathieu', 'Francoise', 'Alexandre', 'Patricia', 'Stephane', 'Emilie', 'Jerome', 'Monique', 'Olivier', 'Chantal', 'Laurent', 'Christine', 'Didier', 'Sarah']
    
    # Anonymize
    for i, elu in enumerate(elus):
        # Find and rename photo
        old_photo_file = elu["photo"].split('/')[-1]
        new_photo_file = f"photo_{elu['id']}.jpg"
        
        # Rename if old photo exists and is different from new photo
        old_photo_path = os.path.normpath(os.path.join(photos_dir, old_photo_file))
        new_photo_path = os.path.normpath(os.path.join(photos_dir, new_photo_file))
        
        if old_photo_path != new_photo_path:
            if os.path.exists(old_photo_path):
                if os.path.exists(new_photo_path):
                    os.remove(new_photo_path)
                os.rename(old_photo_path, new_photo_path)
            else:
                # Check case insensitively
                for f_name in os.listdir(photos_dir):
                    if elu["nom"].lower() in f_name.lower() or old_photo_file.lower() == f_name.lower():
                        f_path = os.path.normpath(os.path.join(photos_dir, f_name))
                        if f_path != new_photo_path:
                            if os.path.exists(new_photo_path):
                                os.remove(new_photo_path)
                            os.rename(f_path, new_photo_path)
                        break
        
        # Replace info
        elu["nom"] = last_names[i % len(last_names)]
        elu["prenom"] = first_names[i % len(first_names)]
        elu["photo"] = f"Photos_Elus/{new_photo_file}"
        
        # Fix commune accents if corrupted
        elu["commune"] = clean_double_encoding(elu["commune"])
        elu["role"] = clean_double_encoding(elu["role"])
        elu["attributions"] = clean_double_encoding(elu["attributions"])

    # Write back clean file
    with open(data_filePath, "w", encoding="utf-8") as f:
        f.write(f"const ELUS_DATA = {json.dumps(elus, indent=4, ensure_ascii=False)};")
    print("Trombinoscope OK")


# --- 3. RESTORE & ANONYMIZE SUBVENTIONS 2026 ---
print("--- Process Subventions ---")
sub_dir = None
for name in os.listdir(base_dir):
    if "Subventions" in name:
        sub_dir = os.path.join(base_dir, name)
        break

if sub_dir:
    data_js_path = os.path.join(sub_dir, "data.js")
    backup_js_path = os.path.join(sub_dir, "data_backup.js")
    
    # Restore from backup
    with open(backup_js_path, "r", encoding="utf-8") as f:
        sub_raw = f.read()
        
    sub_raw = clean_double_encoding(sub_raw)
    json_match = re.search(r'\[.*\]', sub_raw, re.DOTALL)
    
    if json_match:
        subs = json.loads(json_match.group(0))
        
        adjectives = ['des Collines', 'du Val-Joli', 'du Forez', 'Municipal(e)', 'des Rives', 'de la Plaine', 'des Sablières', 'Scolaire', 'd\'Animation', 'Laïque', 'Régional(e)', 'Intercommunal(e)']
        asso_map = {}
        
        # Single global random factor to preserve math totals coherence
        factor = random.uniform(0.65, 1.45)
        print(f"Using global scaling factor for subventions: {factor:.4f}")
        
        for i, item in enumerate(subs):
            # Anonymize Commune (will be replaced globally too, but good to do here)
            comm = item.get("commune")
            if comm in city_map:
                item["commune"] = city_map[comm]
            else:
                for k, v in city_map.items():
                    if comm.lower().strip() == k.lower().strip():
                        item["commune"] = v
            
            # Anonymize Name
            old_name = item.get("name")
            if old_name not in asso_map:
                prefix = 'Association'
                if 'Crèche' in old_name: prefix = 'Crèche Multi-Accueil'
                elif 'Micro-crèche' in old_name: prefix = 'Micro-Crèche'
                elif 'ALSH' in old_name or 'Périscolaire' in old_name: prefix = 'Accueil de Loisirs'
                elif 'MJC' in old_name: prefix = 'Maison des Jeunes'
                elif 'Foot' in old_name: prefix = 'Club de Football'
                elif 'Tennis' in old_name: prefix = 'Tennis Club'
                elif 'Basket' in old_name: prefix = 'Basket Club'
                elif 'Judo' in old_name: prefix = 'Club de Judo'
                elif 'Musique' in old_name or 'Harmonie' in old_name: prefix = 'Harmonie Musicale'
                
                asso_map[old_name] = f"{prefix} {adjectives[len(asso_map) % len(adjectives)]} (N°{len(asso_map)+1})"
                
            item["name"] = asso_map[old_name]
            
            # Clean comments and justifications
            item["justification"] = ""
            if item.get("commission_comment"):
                item["commission_comment"] = "Commentaire commission"
            
            # Currency keys to anonymize
            currency_keys = [
                "sub_2023", "sub_2024", "sub_2025_acted", "sub_2026_requested_asso", 
                "sub_2025_requested_struct", "sub_2026_requested_activity", "sub_neutral",
                "proposal_maxime", "exceptional_help", "sub_final_2026", "sub_final_2026_cumulated_asso",
                "cumulated_asso", "cumulated_by_city", "cumulated_by_city_n_1",
                "total_charges_2025", "total_charges_2026", "total_products_2025", "total_products_2026",
                "staff_charges_2025", "staff_charges_2026", "total_product_without_ccmvr_2025",
                "total_product_without_ccmvr_2026", "result_2025"
            ]
            
            for key in currency_keys:
                if key in item and item[key] is not None:
                    try:
                        val = float(item[key])
                        # Apply scale factor and round to nearest 100€
                        new_val = round((val * factor) / 100.0) * 100
                        if new_val == 0 and val > 0:
                            new_val = 100
                        item[key] = int(new_val)
                    except ValueError:
                        pass
                        
        # Save back clean data.js
        with open(data_js_path, "w", encoding="utf-8") as f:
            f.write(f"const SUBVENTIONS_DATA = {json.dumps(subs, indent=4, ensure_ascii=False)};")
        print("Subventions OK")


# --- 4. ANONYMIZE MAP DATA ---
print("--- Process Map ---")
map_dir = None
for name in os.listdir(base_dir):
    if "Cartographie" in name:
        map_dir = os.path.join(base_dir, name)
        break

if map_dir:
    map_js_path = os.path.join(map_dir, "data.js")
    with open(map_js_path, "r", encoding="utf-8") as f:
        map_raw = f.read()
        
    map_raw = clean_double_encoding(map_raw)
    json_match = re.search(r'\[.*\]', map_raw, re.DOTALL)
    
    if json_match:
        services = json.loads(json_match.group(0))
        
        struct_map = {}
        for i, item in enumerate(services):
            # Structure mapping
            st = item.get("structure")
            if st not in struct_map:
                struct_map[st] = f"Structure Publique N°{len(struct_map)+1}"
            item["structure"] = struct_map[st]
            
            # Manager mapping
            item["manager"] = f"Gestionnaire Communal N°{i+1}"
            
            # Address mapping
            addr = item.get("address", "")
            if "Stade" in addr or "Sport" in addr:
                item["address"] = "Avenue du Stade"
            elif "Ferry" in addr or "Mairie" in addr:
                item["address"] = "Rue des Écoles"
            else:
                item["address"] = "Route de la Plaine"
                
        with open(map_js_path, "w", encoding="utf-8") as f:
            f.write(f"const SERVICES_DATA = {json.dumps(services, indent=4, ensure_ascii=False)};")
        print("Map OK")


# --- 5. GLOBAL CITY NAME & ENCODING REPLACEMENT ---
print("--- Process Global City Name & Encoding Replacements ---")
sorted_keys = sorted(city_map.keys(), key=len, reverse=True)

for root, dirs, files in os.walk(base_dir):
    # Skip Photos_Elus binary files
    if "Photos_Elus" in root:
        continue
    for file in files:
        # Skip subventions backup to preserve raw source
        if file == "data_backup.js":
            continue
            
        if file.endswith(('.js', '.html', '.css', '.json', '.txt')):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Fix double encoding first
                content = clean_double_encoding(content)
                
                # Apply replacements
                modified = False
                old_content = content
                for key in sorted_keys:
                    if key in content:
                        content = content.replace(key, city_map[key])
                        modified = True
                
                if content != old_content or modified:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Cleaned & Anonymized cities in: {filepath}")
            except Exception as e:
                print(f"Error processing {filepath}: {e}")


# --- 6. CLEAN PORTAL INDEX.HTML (REMOVE SCRAPER) ---
print("--- Process Main Portal ---")
portal_html_path = "index.html"
with open(portal_html_path, "r", encoding="utf-8") as f:
    html_content = f.read()

# Remove Scraping & OCR Python list item from index.html
list_item_pattern = r'\s*<li class="app-item"\s+onclick="selectApp\(this\)"\s+data-src="Source book/Scrap CCMVR/index.html".*?</li>'
html_content = re.sub(list_item_pattern, "", html_content, flags=re.DOTALL)

# Update credentials text for Réservation Matériel
html_content = html_content.replace(
    'data-login="Code d\'entrée global : CCMVR2026 | Administration : admin / MAJA00"',
    'data-login="Accès Global et Administration : MAJA00"'
)

with open(portal_html_path, "w", encoding="utf-8") as f:
    f.write(html_content)
print("Portal HTML OK")

print("--- FINISHED ALL FIXES ---")
