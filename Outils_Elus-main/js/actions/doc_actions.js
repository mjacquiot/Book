// --- DOCUMENT UPLOAD & PARSING ---
window.handleDocUpload = async (e, sid) => {
  const files = e.target.files;
  if (!files.length) return;

  const s = state.subjects.find(x => x.id === sid);
  if (!s.docs) s.docs = [];

  const loader = document.getElementById('ocr-loader');
  const textInfo = document.getElementById('ocr-progress');
  if (loader) loader.style.display = 'block';

  // Dynamically load Tesseract if needed and not present
  const needsTesseract = Array.from(files).some(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    return ['png', 'jpg', 'jpeg'].includes(ext) || f.type.startsWith('image/') || ext === 'pdf';
  });
  if (needsTesseract && typeof Tesseract === 'undefined') {
    if (textInfo) textInfo.innerText = "Téléchargement du moteur d'OCR (Tesseract)...";
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/tesseract.js@v4.1.1/dist/tesseract.min.js";
        script.onload = resolve;
        script.onerror = () => reject(new Error("Impossible de charger le moteur OCR. Vérifiez votre connexion internet."));
        document.head.appendChild(script);
      });
    } catch (err) {
      if (loader) loader.style.display = 'none';
      alert(err.message);
      return;
    }
  }

  for (let f of files) {
    textInfo.innerText = "Analyse de " + f.name + "...";
    try {
      let textContent = "";
      const ext = f.name.split('.').pop().toLowerCase();

      if (['png', 'jpg', 'jpeg'].includes(ext) || f.type.startsWith('image/')) {
        if (typeof Tesseract === 'undefined') throw new Error("Tesseract non chargé");
        const result = await Tesseract.recognize(f, 'fra', {
          logger: m => { if (m.status === "recognizing text") textInfo.innerText = "Extraction Image OCR : " + Math.round(m.progress * 100) + "%"; }
        });
        textContent = result.data.text;
      } else if (ext === 'txt' || ext === 'csv') {
        textContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = ev => resolve(ev.target.result);
          reader.onerror = reject;
          reader.readAsText(f);
        });
      } else if (ext === 'pdf') {
        if (typeof pdfjsLib === 'undefined') throw new Error("PDF.js non chargé");
        const arrayBuffer = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          textInfo.innerText = `Extraction PDF : Page ${i}/${pdf.numPages}`;
          await new Promise(r => setTimeout(r, 10)); // YIELD TO UI THREAD

          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(" ");

          if (pageText.trim().length < 20) {
            textInfo.innerText = `OCR de secours (Scan PDF) : Page ${i}/${pdf.numPages} en cours...`;
            await new Promise(r => setTimeout(r, 10)); // YIELD TO UI THREAD
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const renderContext = { canvasContext: canvas.getContext("2d"), viewport: viewport };
            await page.render(renderContext).promise;
            const imgData = canvas.toDataURL("image/jpeg");
            if (typeof Tesseract !== 'undefined') {
              const result = await Tesseract.recognize(imgData, 'fra', {
                logger: m => { if (m.status === "recognizing text") textInfo.innerText = `OCR Page ${i} : ${Math.round(m.progress * 100)}%`; }
              });
              fullText += result.data.text + "\n";
            }
          } else {
            fullText += pageText + "\n";
          }
        }
        textContent = fullText;
      } else if (['xls', 'xlsx'].includes(ext)) {
        if (typeof XLSX === 'undefined') throw new Error("SheetJS non chargé");
        const arrayBuffer = await f.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        let fullText = "";
        workbook.SheetNames.forEach(sheetName => {
          fullText += `--- FEUILLE : ${sheetName} ---\n`;
          const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
          fullText += csv + "\n\n";
        });
        textContent = fullText;
      } else {
        throw new Error("Format non supporté : " + ext);
      }

      // Supabase Storage upload (Origin File <= 5MB)
      let fileUrl = null;
      if (f.size <= 5 * 1024 * 1024) {
        try {
          const uniquePath = `docs/${Date.now()}_${Math.random().toString(36).substring(7)}_${f.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const { data: uploadData, error: uploadErr } = await supabaseClient.storage.from('documents_files').upload(uniquePath, f);
          if (!uploadErr && uploadData) {
            const { data: urlData } = supabaseClient.storage.from('documents_files').getPublicUrl(uploadData.path);
            fileUrl = urlData.publicUrl;
          } else {
            console.warn("Upload Storage échoué", uploadErr);
          }
        } catch (err) {
          console.warn("Erreur Storage upload:", err);
        }
      } else {
        console.warn("Le fichier " + f.name + " (" + (f.size / 1024 / 1024).toFixed(1) + "Mo) dépasse 5Mo, il ne sera uploadé que sous forme de texte.");
      }

      let docTitle = "[Importé] " + f.name;
      let docContent = textContent || "Aucun texte identifié.";
      let ivData = null;
      if (window.sessionCollectivityKey) {
          const encTitle = await window.CryptoManager.encryptDictionaryEntry({text: docTitle}, window.sessionCollectivityKey);
          const encContent = await window.CryptoManager.encryptDictionaryEntry({text: docContent}, window.sessionCollectivityKey);
          docTitle = encTitle.cipher;
          docContent = encContent.cipher;
          ivData = JSON.stringify({ title_iv: encTitle.iv, content_iv: encContent.iv });
      }
      await supabaseClient.from('documents').insert({ subject_id: sid, title: docTitle, content: docContent, file_url: fileUrl, iv: ivData });
      logHistory(s.themeId, 'AJOUT_DOCUMENT', `Document importé et transcrit : ${f.name}`);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la lecture du fichier " + f.name + " : " + err.message);
    }
  }
  loader.style.display = 'none';
  await syncFromSupabase();
  render();
};

window.deleteDocument = async (sid, did) => {
  if (confirm("Supprimer ce document définitivement ?")) {
    await supabaseClient.from('documents').delete().eq('id', did);
    await syncFromSupabase();
    render();
  }
}

// --- SCRAPER DOCUMENTAIRE ---
window.renderScraperView = () => {
  return `
    <div class="view-header">
      <h2 style="display:flex; align-items:center; gap:0.5rem;"><span class="material-icons-round" style="color:#0ea5e9; font-size:2.5rem; filter:drop-shadow(0 4px 3px rgb(0 0 0 / 0.07));">cloud_download</span>Scraping & Fonds Documentaire</h2>
      <p style="color:var(--text-muted); font-size:1.05rem;">Récupérez les documents PDF publics (PV de conseils, délibérations...) depuis le site internet d'une commune.</p>
    </div>
    
    <div style="display:flex; flex-direction:column; gap:2rem; max-width:800px;">
        <div class="card" style="border:1px solid #e2e8f0; padding:2rem; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
            <h3 style="margin:0 0 1.5rem 0; font-size:1.2rem; color:var(--text-main); display:flex; align-items:center; gap:0.5rem;"><span class="material-icons-round" style="color:#8b5cf6;">search</span> Cibler une source</h3>
            
            <div style="display:flex; flex-direction:column; gap:1.5rem;">
               <div>
                  <label style="font-weight:600; font-size:0.95rem; margin-bottom:0.5rem; display:block; color:#334155;">URL du site internet (ex: https://www.dunieres.fr)</label>
                  <input type="url" id="scrap_url" placeholder="https://" style="width:100%; padding:0.8rem; border-radius:8px; border:1px solid #cbd5e1; font-size:1rem;">
               </div>
               <div>
                  <label style="font-weight:600; font-size:0.95rem; margin-bottom:0.5rem; display:block; color:#334155;">Nom du dossier à créer (ex: Dunières 43220)</label>
                  <input type="text" id="scrap_city" placeholder="Nom de la commune" style="width:100%; padding:0.8rem; border-radius:8px; border:1px solid #cbd5e1; font-size:1rem;">
               </div>
               <div style="display:flex; gap:1rem; align-items:center;">
                  <label style="font-size:0.9rem; color:#475569; display:flex; align-items:center; gap:0.5rem;">
                    <input type="number" id="scrap_depth" value="2" min="1" max="4" style="width:60px; padding:0.5rem; border-radius:6px; border:1px solid #cbd5e1; text-align:center;">
                    Profondeur d'exploration (niveaux de sous-pages)
                  </label>
                  <label style="font-size:0.9rem; color:#475569; display:flex; align-items:center; gap:0.5rem;">
                    <input type="number" id="scrap_max" value="50" min="5" max="200" style="width:70px; padding:0.5rem; border-radius:6px; border:1px solid #cbd5e1; text-align:center;">
                    Max pages explorées
                  </label>
               </div>
            </div>
            
            <div style="margin-top:2rem;">
               <button class="btn btn-primary" onclick="startScraping()" style="width:100%; justify-content:center; padding:1rem; font-size:1.1rem; background:linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);"><span class="material-icons-round" style="margin-right:0.5rem;">find_replace</span> Lancer l'exploration récursive</button>
            </div>
            
            <div id="scrap_loader" style="display:none; text-align:center; margin-top:2rem; padding:1.5rem; background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px;">
               <div class="spinner" style="width:30px;height:30px;border-top-color:#0284c7; border-width:3px; margin:0 auto 1rem auto;"></div>
               <div id="scrap_status" style="font-weight:600; color:#0369a1;">Connexion en cours...</div>
               <div id="scrap_details" style="font-size:0.85rem; color:#0284c7; margin-top:0.5rem;"></div>
               <div id="scrap_progress_bar" style="height:6px; background:#e0f2fe; border-radius:3px; overflow:hidden; margin-top:1rem; width:100%;">
                   <div style="height:100%; width:0%; background:#0284c7; transition:width 0.3s;" id="scrap_progress_fill"></div>
               </div>
               <div id="scrap_found_list" style="text-align:left; margin-top:1rem; max-height:200px; overflow-y:auto; font-size:0.8rem; color:#475569;"></div>
            </div>

            <div id="scrap_selection" style="display:none; margin-top:2rem; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                <div style="background:linear-gradient(135deg, #f0f9ff, #e0f2fe); padding:1rem 1.5rem; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #bae6fd; flex-wrap:wrap; gap:0.5rem;">
                   <div>
                      <h4 style="margin:0; color:#0369a1; display:flex; align-items:center; gap:0.5rem;"><span class="material-icons-round">checklist</span> Documents trouvés — Sélectionnez ceux à importer</h4>
                      <div id="scrap_sel_count" style="font-size:0.8rem; color:#0284c7; margin-top:0.3rem;"></div>
                   </div>
                   <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                      <button class="btn btn-outline btn-sm" onclick="toggleVisibleScrapPdfs(true)" style="font-size:0.8rem; padding:0.3rem 0.8rem; border-color:#0ea5e9; color:#0369a1;"><span class="material-icons-round" style="font-size:0.9rem; margin-right:0.2rem;">check_box</span>Cocher visibles</button>
                      <button class="btn btn-outline btn-sm" onclick="toggleAllScrapPdfs(false)" style="font-size:0.8rem; padding:0.3rem 0.8rem; border-color:#94a3b8; color:#64748b;"><span class="material-icons-round" style="font-size:0.9rem; margin-right:0.2rem;">check_box_outline_blank</span>Tout décocher</button>
                   </div>
                </div>
                <div style="padding:0.8rem 1rem; border-bottom:1px solid #e2e8f0; background:white;">
                   <div style="position:relative;">
                      <span class="material-icons-round" style="position:absolute; left:0.7rem; top:50%; transform:translateY(-50%); color:#94a3b8; font-size:1.2rem;">search</span>
                      <input type="text" id="scrap_search" placeholder="Filtrer par nom... (ex: PV, budget, escalade)" oninput="filterScrapPdfs()" style="width:100%; padding:0.6rem 0.6rem 0.6rem 2.5rem; border-radius:8px; border:1px solid #cbd5e1; font-size:0.9rem; background:#f8fafc; transition:border-color 0.2s;" onfocus="this.style.borderColor='#0ea5e9'" onblur="this.style.borderColor='#cbd5e1'">
                   </div>
                   <div id="scrap_filter_info" style="font-size:0.75rem; color:#64748b; margin-top:0.4rem;"></div>
                </div>
                <div id="scrap_pdf_list" style="max-height:400px; overflow-y:auto; padding:0.5rem 1rem;"></div>
                <div style="padding:1rem 1.5rem; border-top:1px solid #e2e8f0; background:#f8fafc;">
                   <div id="scrap_limit_warn" style="display:none; font-size:0.8rem; color:#dc2626; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.3rem;"><span class="material-icons-round" style="font-size:1rem;">warning</span> Maximum 100 documents cochés pour l'import.</div>
                   <button class="btn btn-primary" id="scrap_import_btn" onclick="importSelectedPdfs()" style="width:100%; justify-content:center; padding:0.8rem; font-size:1rem; background:linear-gradient(135deg, #16a34a 0%, #15803d 100%);"><span class="material-icons-round" style="margin-right:0.5rem;">download</span> Importer les documents sélectionnés</button>
                </div>
             </div>

             <div id="scrap_results" style="display:none; margin-top:2rem; padding:1.5rem; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;">
               <h4 style="margin:0 0 1rem 0; color:#166534; display:flex; align-items:center; gap:0.5rem;"><span class="material-icons-round">check_circle</span> Extraction terminée</h4>
               <p style="font-size:0.9rem; color:#15803d; margin-bottom:1rem;" id="scrap_results_text"></p>
               <button class="btn btn-primary" onclick="navigate('dashboard')" style="background:#16a34a; border-color:#15803d;">Aller voir le nouveau Thème créé</button>
            </div>
        </div>
    </div>
  `;
};

// Utilitaire proxy CORS - Approche multi-couches
window._fetchViaProxy = async (url, isBinary = false) => {
  // Couche 1: Essai direct
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000), mode: 'cors' });
    if (resp.ok) return isBinary ? await resp.arrayBuffer() : await resp.text();
  } catch(e) { /* CORS bloqué */ }

  // Couche 2: Supabase Edge Function (La plus fiable)
  if (typeof supabaseClient !== 'undefined') {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const supaUrl = state?.supabaseUrl;
      if (supaUrl) {
        const resp = await fetch(supaUrl + '/functions/v1/cors-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (session?.access_token || ''),
          },
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(60000) // 60s pour les gros PDF
        });
        if (resp.ok) return isBinary ? await resp.arrayBuffer() : await resp.text();
      }
    } catch(e) { console.warn("Edge Function proxy failed:", e.message); }
  }

  // Couche 3: Fallbacks publics
  const proxies = [
    (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    (u) => 'https://corsproxy.io/?' + encodeURIComponent(u),
  ];
  for (const proxyFn of proxies) {
    try {
      const resp = await fetch(proxyFn(url), { signal: AbortSignal.timeout(30000) });
      if (resp.ok) return isBinary ? await resp.arrayBuffer() : await resp.text();
    } catch(e) { continue; }
  }
  throw new Error("Échec de connexion (Proxy) pour: " + url);
};

window.startScraping = async () => {
  const urlInput = document.getElementById('scrap_url').value.trim();
  const cityInput = document.getElementById('scrap_city').value.trim();
  const maxDepth = parseInt(document.getElementById('scrap_depth').value) || 2;
  const maxPages = parseInt(document.getElementById('scrap_max').value) || 50;

  if (!urlInput) return alert("Veuillez remplir l'URL du site.");
  if (!cityInput) return alert("Veuillez donner un nom pour le dossier de la commune.");

  let baseUrl;
  try { baseUrl = new URL(urlInput); } catch(e) { return alert("URL invalide."); }
  const origin = baseUrl.origin;

  document.getElementById('scrap_loader').style.display = 'block';
  document.getElementById('scrap_results').style.display = 'none';
  document.getElementById('scrap_selection').style.display = 'none';
  const fill = document.getElementById('scrap_progress_fill');
  const status = document.getElementById('scrap_status');
  const details = document.getElementById('scrap_details');
  const foundList = document.getElementById('scrap_found_list');
  foundList.innerHTML = '';

  const visited = new Set();
  const pdfLinks = new Set();
  const queue = [{ url: urlInput, depth: 0 }];
  // Keywords that signal council-related pages
  const keywords = ['conseil', 'municipal', 'deliber', 'proces-verbal', 'compte-rendu', 'seance', 'pv', 'communaute', 'assembl', 'budget', 'finance', 'rapport', 'urbanisme'];

  try {
    // Phase 1: Recursive crawl
    while (queue.length > 0 && visited.size < maxPages) {
      const { url: currentUrl, depth } = queue.shift();
      const normalizedUrl = currentUrl.split('#')[0].split('?')[0];
      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);

      const progress = Math.min(70, (visited.size / maxPages) * 70);
      fill.style.width = progress + '%';
      status.innerText = `Exploration page ${visited.size}/${maxPages} (profondeur ${depth}/${maxDepth})`;
      details.innerText = currentUrl.substring(0, 80) + (currentUrl.length > 80 ? '...' : '');

      try {
        const html = await window._fetchViaProxy(currentUrl);

        // Extract all href links
        const hrefRegex = /href=["']([^"'#]+)["']/gi;
        let match;
        while ((match = hrefRegex.exec(html)) !== null) {
          let link = match[1].replace(/&amp;/g, '&').trim();
          
          // Resolve relative URLs
          if (link.startsWith('//')) link = baseUrl.protocol + link;
          else if (link.startsWith('/')) link = origin + link;
          else if (!link.startsWith('http')) link = currentUrl.replace(/[^/]*$/, '') + link;

          // Is it a PDF?
          if (link.toLowerCase().match(/\.pdf(\?.*)?$/)) {
            if (!pdfLinks.has(link)) {
              pdfLinks.add(link);
              foundList.innerHTML += `<div style="padding:0.2rem 0; border-bottom:1px solid #f1f5f9;">📄 ${link.split('/').pop().substring(0,50)}</div>`;
            }
            continue;
          }

          // Queue internal pages for deeper crawl
          if (depth < maxDepth && link.startsWith(origin) && !visited.has(link.split('#')[0].split('?')[0])) {
            const linkLower = link.toLowerCase();
            // Prioritize pages likely to contain council documents
            const isPriority = keywords.some(kw => linkLower.includes(kw));
            if (isPriority) {
              queue.unshift({ url: link, depth: depth + 1 }); // Priority: front of queue
            } else {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      } catch(e) {
        console.warn("Échec exploration page:", currentUrl, e.message);
      }
    }

    const absPdfs = [...pdfLinks]; // Aucune limite sur la découverte

    // Store found PDFs for later import
    window._scrapFoundPdfs = absPdfs;
    window._scrapCityInput = cityInput;
    window._scrapUrlInput = urlInput;
    window._scrapPagesVisited = visited.size;

    fill.style.width = '100%';
    document.getElementById('scrap_loader').style.display = 'none';

    if (absPdfs.length === 0) {
      document.getElementById('scrap_results').style.display = 'block';
      document.getElementById('scrap_results_text').innerText = `Aucun PDF trouvé sur ${visited.size} pages explorées. Vérifiez l'URL ou essayez une profondeur plus grande.`;
      return;
    }

    // Populate the selection panel with checkboxes (all unchecked by default)
    const pdfListEl = document.getElementById('scrap_pdf_list');
    pdfListEl.innerHTML = absPdfs.map((url, i) => {
      const fileName = decodeURIComponent(url.split('/').pop().split('?')[0]).substring(0, 80);
      return `
        <label class="scrap-pdf-item" data-filename="${sanitizeHTML(fileName.toLowerCase())}" style="display:flex; align-items:center; gap:0.8rem; padding:0.6rem 0.8rem; cursor:pointer; border-radius:8px; transition:background 0.15s; border-bottom:1px solid #f1f5f9;" onmouseenter="this.style.background='#f0f9ff'" onmouseleave="this.style.background='transparent'">
          <input type="checkbox" class="scrap-pdf-cb" value="${i}" onchange="updateScrapSelCount()" style="width:18px; height:18px; cursor:pointer; accent-color:#0ea5e9;">
          <div style="flex:1; min-width:0;">
            <div style="font-size:0.9rem; font-weight:500; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📄 ${sanitizeHTML(fileName)}</div>
            <div style="font-size:0.72rem; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${sanitizeHTML(url)}">${sanitizeHTML(url)}</div>
          </div>
        </label>
      `;
    }).join('');

    document.getElementById('scrap_selection').style.display = 'block';
    document.getElementById('scrap_search').value = '';
    updateScrapSelCount();
    filterScrapPdfs();

  } catch (err) {
    console.error(err);
    alert("Erreur lors du scraping : " + err.message);
    document.getElementById('scrap_loader').style.display = 'none';
  }
};

window.toggleAllScrapPdfs = (checked) => {
  document.querySelectorAll('.scrap-pdf-cb').forEach(cb => {
    if (!checked) { cb.checked = false; }
  });
  updateScrapSelCount();
};

// Cocher uniquement les éléments visibles (filtrés)
window.toggleVisibleScrapPdfs = (checked) => {
  const MAX_CHECKED = 100;
  const currentChecked = document.querySelectorAll('.scrap-pdf-cb:checked').length;
  let added = 0;
  document.querySelectorAll('.scrap-pdf-item').forEach(item => {
    if (item.style.display === 'none') return;
    const cb = item.querySelector('.scrap-pdf-cb');
    if (!cb) return;
    if (checked && !cb.checked) {
      if (currentChecked + added >= MAX_CHECKED) return;
      cb.checked = true;
      added++;
    } else if (!checked) {
      cb.checked = false;
    }
  });
  updateScrapSelCount();
};

window.filterScrapPdfs = () => {
  const query = (document.getElementById('scrap_search')?.value || '').toLowerCase().trim();
  const items = document.querySelectorAll('.scrap-pdf-item');
  let visible = 0;
  items.forEach(item => {
    const fn = item.getAttribute('data-filename') || '';
    const match = !query || fn.includes(query);
    item.style.display = match ? 'flex' : 'none';
    if (match) visible++;
  });
  const infoEl = document.getElementById('scrap_filter_info');
  if (infoEl) {
    if (query) {
      infoEl.innerText = `${visible} document(s) correspondent à "${query}" sur ${items.length} total`;
    } else {
      infoEl.innerText = `${items.length} document(s) trouvés au total`;
    }
  }
};

window.updateScrapSelCount = () => {
  const MAX_CHECKED = 100;
  const all = document.querySelectorAll('.scrap-pdf-cb');
  const checked = document.querySelectorAll('.scrap-pdf-cb:checked');
  const countEl = document.getElementById('scrap_sel_count');
  if (countEl) {
    const color = checked.length > MAX_CHECKED ? '#dc2626' : '#0284c7';
    countEl.innerHTML = `<span style="color:${color}; font-weight:600;">${checked.length}</span> / ${all.length} sélectionnés (max ${MAX_CHECKED} pour l'import)`;
  }
  const btn = document.getElementById('scrap_import_btn');
  if (btn) btn.disabled = checked.length === 0 || checked.length > MAX_CHECKED;
  const warn = document.getElementById('scrap_limit_warn');
  if (warn) warn.style.display = checked.length > MAX_CHECKED ? 'flex' : 'none';
};

window.importSelectedPdfs = async () => {
  const pdfs = window._scrapFoundPdfs || [];
  const cityInput = window._scrapCityInput || 'Import';
  const urlInput = window._scrapUrlInput || '';
  const pagesVisited = window._scrapPagesVisited || 0;

  const selectedIndices = [...document.querySelectorAll('.scrap-pdf-cb:checked')].map(cb => parseInt(cb.value));
  if (selectedIndices.length === 0) return alert("Veuillez sélectionner au moins un document à importer.");

  const selectedPdfs = selectedIndices.map(i => pdfs[i]);

  document.getElementById('scrap_selection').style.display = 'none';
  document.getElementById('scrap_results').style.display = 'block';
  document.getElementById('scrap_results_text').innerText = `L'importation et l'analyse de ${selectedPdfs.length} document(s) ont démarré en arrière-plan.\nVous pouvez naviguer librement, une pastille rouge en haut de l'écran indiquera que le processus est actif.`;

  state.bgScraping = (state.bgScraping || 0) + selectedPdfs.length;
  render();

  // Traitement asynchrone en arrière-plan
  setTimeout(async () => {
    try {
      const themeTitle = "Fonds Documentaire - " + cityInput;
      let encThemeTitle = themeTitle;
      let encThemeDesc = "Scraping automatisé. Source: " + urlInput + " (" + pagesVisited + " pages explorées)";
      let themeIvData = null;
      let encSubjTitle = "Archive Web - " + cityInput;
      let encSubjDesc = selectedPdfs.length + " documents PDF aspirés";
      let subjIvData = null;

      if (window.sessionCollectivityKey) {
          const eTT = await window.CryptoManager.encryptDictionaryEntry({text: encThemeTitle}, window.sessionCollectivityKey);
          const eTD = await window.CryptoManager.encryptDictionaryEntry({text: encThemeDesc}, window.sessionCollectivityKey);
          encThemeTitle = eTT.cipher;
          encThemeDesc = eTD.cipher;
          themeIvData = JSON.stringify({ title_iv: eTT.iv, desc_iv: eTD.iv });

          const eST = await window.CryptoManager.encryptDictionaryEntry({text: encSubjTitle}, window.sessionCollectivityKey);
          const eSD = await window.CryptoManager.encryptDictionaryEntry({text: encSubjDesc}, window.sessionCollectivityKey);
          encSubjTitle = eST.cipher;
          encSubjDesc = eSD.cipher;
          subjIvData = JSON.stringify({ title_iv: eST.iv, desc_iv: eSD.iv });
      }

      const { data: themeData } = await supabaseClient.from('themes').insert({ title: encThemeTitle, description: encThemeDesc, collectivite_id: state.user.collectivite_id, iv: themeIvData }).select();
      const themeId = themeData?.[0]?.id || Date.now();

      const { data: subjData } = await supabaseClient.from('subjects').insert({ theme_id: themeId, title: encSubjTitle, description: encSubjDesc, is_confidential: false, collectivite_id: state.user.collectivite_id, iv: subjIvData }).select();
      const subjId = subjData?.[0]?.id || Date.now();

      for (let i = 0; i < selectedPdfs.length; i++) {
        const pdfUrl = selectedPdfs[i];
        const pdfName = decodeURIComponent(pdfUrl.split('/').pop().split('?')[0]).substring(0, 60);

        let textContent = "";
        try {
          const buf = await window._fetchViaProxy(pdfUrl, true);

          const headerBytes = new Uint8Array(buf.slice(0, 5));
          const header = String.fromCharCode(...headerBytes);
          if (!header.startsWith('%PDF')) throw new Error("Format PDF invalide");

          const pdf = await pdfjsLib.getDocument({ data: buf, disableAutoFetch: true, disableStream: true }).promise;

          for (let p = 1; p <= Math.min(pdf.numPages, 15); p++) {
            await new Promise(r => setTimeout(r, 10)); // Yield
            const page = await pdf.getPage(p);
            const t = await page.getTextContent();
            const pageText = t.items.map(it => it.str).join(" ");

            if (pageText.trim().length < 20 && typeof Tesseract !== 'undefined') {
              try {
                await new Promise(r => setTimeout(r, 10)); // Yield
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement("canvas");
                canvas.width = viewport.width; canvas.height = viewport.height;
                await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
                const result = await Tesseract.recognize(canvas.toDataURL("image/jpeg"), 'fra');
                textContent += result.data.text + "\\n";
              } catch(ocrErr) {
                textContent += pageText + "\\n";
              }
            } else {
              textContent += pageText + "\\n";
            }
          }
          if (!textContent.trim()) textContent = "[PDF scanné sans texte extractible]";
        } catch(e) {
          textContent = `[Échec aspiration] Source : ${pdfUrl}\\nRaison : ${e.message}`;
        }

        let docTitle = "[Scrap] " + pdfName;
        let docContent = textContent;
        let ivData = null;
        if (window.sessionCollectivityKey) {
            const encTitle = await window.CryptoManager.encryptDictionaryEntry({text: docTitle}, window.sessionCollectivityKey);
            const encContent = await window.CryptoManager.encryptDictionaryEntry({text: docContent}, window.sessionCollectivityKey);
            docTitle = encTitle.cipher;
            docContent = encContent.cipher;
            ivData = JSON.stringify({ title_iv: encTitle.iv, content_iv: encContent.iv });
        }
        await supabaseClient.from('documents').insert({ subject_id: subjId, title: docTitle, content: docContent, iv: ivData });
        
        state.bgScraping = Math.max(0, state.bgScraping - 1);
        if (state.bgScraping === 0) {
            await syncFromSupabase();
            render();
        } else {
            render();
        }
      }
    } catch(err) {
      console.error("Erreur background import:", err);
      state.bgScraping = 0;
      render();
    }
  }, 100);
};


window.importRagMcCsvOnboarding = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => resolve(ev.target.result);
      reader.readAsText(file, 'windows-1252');
    });
    const lines = text.split('\n').filter(l => l.trim() !== '');
    const entities = new Set();
    for(let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(/[,;]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
        cells.forEach(c => {
            if(c.length > 2 && !c.match(/^[0-9]+$/)) entities.add(c);
        });
    }
    const currentMcBox = document.getElementById('ob_mc');
    const existing = currentMcBox.value.split(',').map(x => x.trim()).filter(Boolean);
    currentMcBox.value = Array.from(new Set([...existing, ...entities])).join(', ');
    alert(`Succès ! ${entities.size} entités ajoutées.`);
  } catch (err) { alert("Erreur CSV : " + err.message); }
  finally { e.target.value = ''; }
};

