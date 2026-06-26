import fitz
import os
import re
import io
from PIL import Image

def clean_filename(name):
    # Remove characters that are invalid in Windows filenames
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    # Replace multiple spaces with a single space and strip
    name = re.sub(r'\s+', " ", name)
    return name.strip()

def main():
    pdf_path = "Trombinoscope élus - Conseil Communautaire 2026-2032 - compressé.pdf"
    if not os.path.exists(pdf_path):
        print(f"Error: PDF file '{pdf_path}' not found in the current directory.")
        return

    doc = fitz.open(pdf_path)
    page = doc[0]

    # 1. Extract all images and filter out the logo
    images = []
    for img_info in page.get_image_info(hashes=True):
        bbox = img_info['bbox']
        # Filter out the logo at the top
        if bbox[1] < 10 and bbox[0] < 300:
            continue
        images.append(img_info)

    print(f"Found {len(images)} portrait images.")

    # 2. Extract name spans and group them
    spans = []
    text_dict = page.get_text("dict")
    for block in text_dict['blocks']:
        if 'lines' in block:
            for line in block['lines']:
                for span in line['spans']:
                    text = span['text'].strip()
                    # Names are Calibri-Bold, size 12.0
                    if text and span['font'] == 'Calibri-Bold' and round(span['size'], 1) == 12.0:
                        spans.append(span)

    grouped_names = []
    used_indices = set()
    spans_sorted = sorted(spans, key=lambda s: s['bbox'][1])

    for i, s1 in enumerate(spans_sorted):
        if i in used_indices:
            continue
        name_text = s1['text']
        bbox = list(s1['bbox'])
        s1_cx = (bbox[0] + bbox[2]) / 2
        for j, s2 in enumerate(spans_sorted):
            if j <= i or j in used_indices:
                continue
            vert_gap = s2['bbox'][1] - bbox[3]
            s2_cx = (s2['bbox'][0] + s2['bbox'][2]) / 2
            if 0 <= vert_gap < 18 and abs(s1_cx - s2_cx) < 25:
                name_text += " " + s2['text']
                bbox[0] = min(bbox[0], s2['bbox'][0])
                bbox[1] = min(bbox[1], s2['bbox'][1])
                bbox[2] = max(bbox[2], s2['bbox'][2])
                bbox[3] = max(bbox[3], s2['bbox'][3])
                used_indices.add(j)
                break
                
        grouped_names.append({
            'text': name_text,
            'bbox': tuple(bbox),
            'center': ((bbox[0]+bbox[2])/2, (bbox[1]+bbox[3])/2)
        })
        used_indices.add(i)

    print(f"Extracted {len(grouped_names)} names.")

    # 3. Match each image to the closest name
    matches = []
    matched_names = set()

    for img in images:
        ib = img['bbox']
        icx = (ib[0] + ib[2]) / 2
        icy = (ib[1] + ib[3]) / 2
        
        best_name = None
        best_dist = float('inf')
        for name in grouped_names:
            if name['text'] in matched_names:
                continue
            ncx, ncy = name['center']
            dist = ((icx - ncx)**2 + (icy - ncy)**2)**0.5
            if dist < best_dist:
                best_dist = dist
                best_name = name
                
        if best_name:
            matches.append((img, best_name))
            matched_names.add(best_name['text'])
        else:
            matches.append((img, None))

    # 4. Extract raw image bytes and map xrefs
    # In PyMuPDF, page.get_images() lists the page's images.
    # We match them to their bboxes.
    image_list = page.get_images()
    
    # Create mapping from bbox to xref
    bbox_to_xref = {}
    for img_item in image_list:
        xref = img_item[0]
        rects = page.get_image_rects(xref)
        if rects:
            r = rects[0]
            # store by rounded coordinates to prevent floats mismatches
            key = (round(r.x0, 1), round(r.y0, 1))
            bbox_to_xref[key] = xref

    # Create output directory for photos
    out_dir = "Photos_Elus"
    os.makedirs(out_dir, exist_ok=True)
    print(f"Output directory '{out_dir}' created/verified.")

    # 5. Save images
    success_count = 0
    for idx, (img, name) in enumerate(matches):
        ib = img['bbox']
        key = (round(ib[0], 1), round(ib[1], 1))
        xref = bbox_to_xref.get(key)
        
        if not xref:
            # try fuzzy matching
            for b_key, b_xref in bbox_to_xref.items():
                if abs(b_key[0] - key[0]) < 2 and abs(b_key[1] - key[1]) < 2:
                    xref = b_xref
                    break
        
        if not xref:
            print(f"Warning: Could not find image xref for bbox {ib}")
            continue

        if not name:
            print(f"Warning: Could not find matching name for image at bbox {ib}")
            continue

        name_clean = clean_filename(name['text'])
        filename = f"photo_{idx+1}.jpg"
        filepath = os.path.join(out_dir, filename)

        try:
            img_data = doc.extract_image(xref)
            img_bytes = img_data['image']
            
            # Convert to standard JPEG using PIL
            with Image.open(io.BytesIO(img_bytes)) as pil_img:
                rgb_img = pil_img.convert('RGB')
                rgb_img.save(filepath, 'JPEG')
                
            print(f"[{idx+1:02d}/{len(matches)}] Saved: {filename} (from {name_clean})")
            success_count += 1
        except Exception as e:
            print(f"Error saving image for {name_clean} (xref={xref}): {e}")

    print(f"\nExtraction completed! Successfully extracted {success_count}/{len(matches)} photos to '{out_dir}'.")

if __name__ == "__main__":
    main()
