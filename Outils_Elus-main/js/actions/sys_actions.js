// --- SYSTEM OPTIONS & RBAC ---
window.renderOptionsView = () => {
    const isAdmin = state.user.role === ROLES.ADMIN || state.user.role === ROLES.MAIRE || state.user.role === ROLES.SUPERADMIN;
    
    return `
      <div class="view-header">
        <h2 style="display:flex; align-items:center; gap:0.5rem;"><span class="material-icons-round" style="color:#64748b; font-size:2.5rem; filter:drop-shadow(0 4px 3px rgb(0 0 0 / 0.07));">settings</span> Paramètres du Système</h2>
        <p style="color:var(--text-muted); font-size:1.05rem;">Gérez la sécurité, les utilisateurs et la configuration de l'IA.</p>
      </div>
      
      <div style="display:flex; flex-direction:column; gap:2rem; max-width:1000px;">
          
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem;">
              
              <!-- SÉCURITÉ & MFA -->
              <div class="card" style="border:1px solid #e2e8f0; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                  <h3 style="margin:0 0 1.5rem 0; font-size:1.15rem; display:flex; align-items:center; gap:0.5rem; color:var(--text-main);"><span class="material-icons-round" style="color:#10b981;">verified_user</span> Sécurité du compte</h3>
                  
                  <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:1.2rem; border-radius:10px; margin-bottom:1.5rem;">
                      <div style="display:flex; align-items:flex-start; gap:1rem;">
                          <span class="material-icons-round" style="color:#166534; font-size:2rem;">security</span>
                          <div>
                              <div style="font-weight:700; color:#166534; font-size:1rem; margin-bottom:0.2rem;">Double Authentification (MFA)</div>
                              <p style="font-size:0.85rem; color:#15803d; margin:0;">Renforcez l'accès à votre compte avec une application TOTP (Google Authenticator, Authy...).</p>
                          </div>
                      </div>
                      <div style="margin-top:1rem;">
                          ${state.mfaEnrollData ? `
                              <div style="background:white; padding:1rem; border-radius:8px; border:1px solid #86efac; text-align:center;">
                                  <p style="font-size:0.85rem; font-weight:600; margin-bottom:0.8rem; color:#1e293b;">Scannez ce QR Code avec votre application :</p>
                                  <img src="${state.mfaEnrollData.totp.qr_code}" style="width:180px; height:180px; border:1px solid #e2e8f0; padding:0.5rem; background:white; margin-bottom:0.8rem;">
                                  <div style="font-size:0.75rem; color:#64748b; margin-bottom:1rem;">Ou clé : <code style="background:#f1f5f9; padding:0.2rem 0.4rem; border-radius:4px;">${state.mfaEnrollData.totp.secret}</code></div>
                                  <input type="text" id="mfa_code" placeholder="Entrez le code à 6 chiffres" style="width:100%; padding:0.6rem; text-align:center; border:1px solid #cbd5e1; border-radius:6px; font-size:1.1rem; letter-spacing:0.2rem;">
                                  <button class="btn btn-primary" onclick="verifyAndEnableMfa()" style="width:100%; margin-top:0.8rem; justify-content:center;">Activer définitivement</button>
                              </div>
                          ` : `
                              <button class="btn btn-outline" style="width:100%; justify-content:center; border-color:#10b981; color:#059669;" onclick="startMfaEnrollment()"><span class="material-icons-round">qr_code_scanner</span> Configurer le MFA</button>
                          `}
                      </div>
                  </div>
                  
                  <div style="margin-top:1.5rem;">
                      <h4 style="font-size:0.95rem; margin-bottom:0.8rem; color:#475569;">Actions avancées</h4>
                      <button class="btn btn-outline btn-sm" onclick="promptPasswordReset()" style="width:100%; justify-content:center;"><span class="material-icons-round" style="font-size:1.1rem; margin-right:0.4rem;">lock_reset</span> Changer mon mot de passe</button>
                  </div>
              </div>

              <!-- GESTION UTILISATEURS (SI ADMIN) -->
              ${isAdmin ? `
              <div class="card" style="border:1px solid #e2e8f0; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                  <h3 style="margin:0 0 1.5rem 0; font-size:1.15rem; display:flex; align-items:center; gap:0.5rem; color:var(--text-main);"><span class="material-icons-round" style="color:#6366f1;">people</span> Administration</h3>
                  
                  <div style="display:flex; flex-direction:column; gap:1rem;">
                      <button class="btn btn-primary" onclick="promptPreAuthorize()" style="width:100%; justify-content:center; background:linear-gradient(to right, #6366f1, #4f46e5);"><span class="material-icons-round">person_add</span> Pré-autoriser un utilisateur</button>
                      
                      <label class="btn btn-outline" style="width:100%; justify-content:center; cursor:pointer;">
                          <input type="file" accept=".csv" style="display:none" onchange="importMassUsers(event)">
                          <span class="material-icons-round">group_add</span> Import massif (CSV)
                      </label>
                      
                      <div style="margin-top:1.5rem; padding-top:1.5rem; border-top:1px solid #f1f5f9;">
                         <h4 style="font-size:0.95rem; margin-bottom:0.8rem; color:#475569; display:flex; align-items:center; gap:0.4rem;"><span class="material-icons-round" style="font-size:1rem; color:#ef4444;">key</span> Contrôle Cryptographique</h4>
                         <p style="font-size:0.8rem; color:#64748b; line-height:1.4;">Pour supprimer un membre et révoquer ses accès, utilisez la liste des utilisateurs sur le Tableau de Bord.</p>
                      </div>
                  </div>
              </div>
              ` : ''}

          </div>

          <!-- CONFIG IA LOCALE (CAMEMBERT-NER) -->
          <div class="card" style="border:1px solid #e2e8f0; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
               <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                   <h3 style="margin:0; font-size:1.15rem; display:flex; align-items:center; gap:0.5rem; color:var(--text-main);"><span class="material-icons-round" style="color:#8b5cf6;">memory</span> IA d'Anonymisation Locale</h3>
                   <div style="background:#f5f3ff; color:#7c3aed; padding:0.3rem 0.6rem; border-radius:6px; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Transformers.js</div>
               </div>

               <div style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem;">
                  <div>
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                         <span style="font-size:0.9rem; font-weight:600; color:#475569;">État du modèle :</span>
                         <span id="opt-model-status-chip" style="font-size:0.85rem; font-weight:700; color:${state.aiModelStatus === 'ready' ? '#10b981' : (state.aiModelStatus === 'loading' ? '#f59e0b' : '#ef4444')}">
                            ${state.aiModelStatus === 'ready' ? '✅ OPÉRATIONNEL' : (state.aiModelStatus === 'loading' ? '⏳ CHARGEMENT...' : '❌ ERREUR')}
                         </span>
                      </div>
                      <p style="font-size:0.85rem; color:#64748b; margin-bottom:1rem; line-height:1.5;">Modèle actuel : <b>${state.aiModelName || 'Xenova/camembert-ner'}</b>. Ce modèle tourne à 100% dans votre navigateur sans jamais envoyer de données au serveur.</p>
                      
                      ${state.aiModelStatus === 'loading' ? `
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:1rem; border-radius:8px;">
                            <div style="height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden; margin-bottom:0.5rem;">
                               <div id="opt-model-progress-bar" style="height:100%; width:${state.aiModelProgress}%; background:linear-gradient(to right, #8b5cf6, #6366f1); transition:width 0.3s;"></div>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#64748b;">
                                <span>Téléchargement des poids...</span>
                                <span id="opt-model-progress-text">${state.aiModelProgress}%</span>
                            </div>
                        </div>
                      ` : ''}
                      
                      <button class="btn btn-outline btn-sm" onclick="resetAiCache()" style="margin-top:1.5rem; color:#dc2626; border-color:#fecaca;"><span class="material-icons-round" style="font-size:1.1rem; margin-right:0.4rem;">delete_sweep</span> Vider le cache et re-télécharger</button>
                  </div>
                  
                  <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:1.2rem; border-radius:10px;">
                      <h4 style="font-size:0.95rem; margin-bottom:0.8rem; color:#475569; display:flex; align-items:center; gap:0.4rem;"><span class="material-icons-round" style="font-size:1.1rem; color:#8b5cf6;">info</span> Aide au diagnostic</h4>
                      <ul style="font-size:0.85rem; color:#64748b; padding-left:1.2rem; margin:0; line-height:1.6;">
                          <li>L'extraction NER détecte les <b>Noms</b>, <b>Lieux</b> et <b>Organisations</b>.</li>
                          <li>Si l'IA ne semble pas réagir, vérifiez votre connexion (modèle d'env. 300 Mo).</li>
                          <li>Une fois téléchargé, le modèle est stocké dans le cache IndexDB de votre navigateur.</li>
                      </ul>
                  </div>
               </div>
          </div>

          <!-- CONFIG CLÉS API LLM -->
          <div class="card" style="border:1px solid #e2e8f0; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
             <h3 style="margin:0 0 1rem 0; font-size:1.15rem; display:flex; align-items:center; gap:0.5rem; color:var(--text-main);"><span class="material-icons-round" style="color:#0ea5e9;">key</span> Configuration des Clés API (Mode Auto)</h3>
             <p style="font-size:0.85rem; color:#64748b; margin-bottom:1.5rem;">Ces clés sont stockées <b>localement dans votre navigateur</b> (LocalStorage). Elles ne sont jamais transmises à nos serveurs.</p>
             
             <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:1.5rem;">
                <div>
                   <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:0.4rem; color:#475569;">Mammouth.ai (Recommandé)</label>
                   <input type="password" id="api_key_mamouth" value="${state.apiConfig.keys.mamouth}" style="width:100%; padding:0.6rem; border-radius:6px; border:1px solid #cbd5e1; font-size:0.9rem;" placeholder="sk-...">
                </div>
                <div>
                   <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:0.4rem; color:#475569;">OpenAI (GPT-4o)</label>
                   <input type="password" id="api_key_pro" value="${state.apiConfig.keys.pro}" style="width:100%; padding:0.6rem; border-radius:6px; border:1px solid #cbd5e1; font-size:0.9rem;" placeholder="sk-...">
                </div>
                <div>
                   <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:0.4rem; color:#475569;">Gemini API (Google)</label>
                   <input type="password" id="api_key_free" value="${state.apiConfig.keys.free}" style="width:100%; padding:0.6rem; border-radius:6px; border:1px solid #cbd5e1; font-size:0.9rem;" placeholder="API Key">
                </div>
             </div>
             <div style="text-align:right; margin-top:1.5rem;">
                <button class="btn btn-primary" onclick="saveApiKeys()"><span class="material-icons-round">vpn_key</span> Enregistrer les clés</button>
             </div>
          </div>

          <!-- WHITELIST ANONYMISATION (SI ADMIN) -->
          ${isAdmin ? `
          <div class="card" style="border:1px solid #e2e8f0; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
             <h3 style="margin:0 0 1rem 0; font-size:1.15rem; display:flex; align-items:center; gap:0.5rem; color:var(--text-main);"><span class="material-icons-round" style="color:#f43f5e;">gpp_good</span> Whitelist de la Collectivité</h3>
             <p style="font-size:0.85rem; color:#64748b; margin-bottom:1.5rem;">Définissez les termes qui ne doivent <b>jamais</b> être pseudonymisés (ex: Nom de la ville, services municipaux...).</p>
             
             <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem;">
                <div>
                   <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:0.4rem; color:#475569;">Termes autorisés (Whitelist)</label>
                   <textarea id="sys_rag_whitelist" style="width:100%; height:120px; padding:0.8rem; border-radius:8px; border:1px solid #cbd5e1; font-family:inherit; font-size:0.9rem;" placeholder="Ex: Dunières, CCAS, Sapeurs-Pompiers">${sanitizeHTML(state.user.rag_whitelist || '')}</textarea>
                </div>
                <div>
                   <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:0.4rem; color:#475569;">Entités Masquées Forcées (MC)</label>
                   <textarea id="sys_rag_mc" style="width:100%; height:120px; padding:0.8rem; border-radius:8px; border:1px solid #cbd5e1; font-family:inherit; font-size:0.9rem;" placeholder="Ex: Jean Martin, Sophie Durand">${sanitizeHTML(localStorage.getItem('rag_mc') || '')}</textarea>
                </div>
             </div>
             <div style="text-align:right; margin-top:1.5rem;">
                <button class="btn btn-primary" onclick="saveSysRagSettings()" style="background:#f43f5e; border-color:#e11d48;"><span class="material-icons-round">save</span> Sauvegarder la Whitelist</button>
             </div>
          </div>
          ` : ''}

      </div>
    `;
};

window.resetAiCache = async () => {
  if (confirm("Voulez-vous vraiment vider le cache du modèle IA ? Il devra être re-téléchargé lors du prochain chargement.")) {
      try {
          const dbs = await indexedDB.databases();
          const transformersDb = dbs.find(db => db.name === 'transformers-cache');
          if (transformersDb) {
              await new Promise((resolve, reject) => {
                  const req = indexedDB.deleteDatabase('transformers-cache');
                  req.onsuccess = resolve;
                  req.onerror = reject;
              });
              alert("Cache Transformers.js vidé avec succès. L'application va redémarrer.");
              window.location.reload();
          } else {
              alert("Aucun cache Transformers.js trouvé.");
          }
      } catch (e) {
          console.error("Erreur cache reset:", e);
          alert("Erreur lors du nettoyage du cache : " + e.message);
      }
  }
};

window.promptPreAuthorize = async () => {
  const email = prompt("Email de l'utilisateur à pré-autoriser :");
  if (!email || !email.includes('@')) return;
  const role = prompt(`Rôle à attribuer (${Object.values(ROLES).join(', ')}) :`, ROLES.ELU);
  if (!role) return;
  const tempPwd = prompt("Mot de passe ou Code de sécurité provisoire (l'utilisateur devra le saisir lors de son inscription) :");
  if (!tempPwd) return;
  
  let colId = state.user.collectivite_id;
  if (!colId) {
      colId = prompt("Veuillez saisir l'ID de la collectivité (ex: 'demo_col' ou laissez vide pour 'default') :", "default");
      if (!colId) return;
  }

  let demoExpiresAt = state.user.demo_expires_at || null;
  // Si le superadmin attribue le rôle DEMO, on lui demande combien de jours
  if (!demoExpiresAt && role.toUpperCase() === 'DEMO') {
      const days = prompt("Durée de la démo en jours (ex: 14) :");
      if (days && !isNaN(days)) {
          const d = new Date();
          d.setDate(d.getDate() + parseInt(days));
          demoExpiresAt = d.toISOString();
      }
  }

  try {
    const { error } = await supabaseClient.from('allowed_registrations').insert({
      email: email.toLowerCase(),
      role: role.toLowerCase(),
      collectivite_id: colId,
      temp_pwd: tempPwd,
      demo_expires_at: demoExpiresAt
    });
    
    if (error) {
        if (error.message.includes('temp_pwd')) {
            alert("Erreur: La base de données doit être mise à jour pour supporter les mots de passe temporaires. Exécutez le script SQL fourni.");
        } else {
            throw error;
        }
    } else {
        alert(`Invitation créée avec succès pour ${email}.\nLe code provisoire est: ${tempPwd}`);
        await syncFromSupabase();
        render();
    }
  } catch (err) {
    console.error(err);
    alert("Erreur lors de la pré-autorisation : " + err.message);
  }
};

window.importMassUsers = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  let colId = state.user.collectivite_id;
  if (!colId) {
      colId = prompt("Veuillez saisir l'ID de la collectivité pour cet import massif (ex: 'demo_col' ou 'default') :", "default");
      if (!colId) return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    const lines = text.split('\\n');
    let successCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length >= 3) {
            const email = parts[0].trim();
            const role = (parts[1] || '').trim();
            const tempPwd = parts[2].trim();
            if (email && tempPwd) {
                let demoExpiresAt = state.user.demo_expires_at || null;
                if (!demoExpiresAt && role.toUpperCase() === 'DEMO') {
                    const d = new Date();
                    d.setDate(d.getDate() + 14); // 14 jours par défaut pour le mass-import
                    demoExpiresAt = d.toISOString();
                }

                const { error } = await supabaseClient.from('allowed_registrations').insert({
                    email: email.toLowerCase(),
                    role: role.toLowerCase() || ROLES.ELU,
                    collectivite_id: colId,
                    temp_pwd: tempPwd,
                    demo_expires_at: demoExpiresAt
                });
                if (!error) successCount++;
            }
        }
    }
    alert(`Import terminé. ${successCount} utilisateurs pré-autorisés.`);
    await syncFromSupabase();
    render();
  };
  reader.readAsText(file);
};

window.loadPendingRegistrations = async () => {
    if (!supabaseClient) return;
    try {
        let query = supabaseClient.from('allowed_registrations').select('*').is('used_at', null);
        if (state.user && state.user.role !== ROLES.SUPERADMIN && state.user.collectivite_id) {
            query = query.eq('collectivite_id', state.user.collectivite_id);
        }
        const { data, error } = await query;
        if (error) throw error;
        
        // Sécurité supplémentaire : On filtre ceux dont l'email existe déjà dans la table des profils
        const existingEmails = (state.users || []).map(u => u.email?.toLowerCase());
        state.pendingRegistrations = (data || []).filter(reg => !existingEmails.includes(reg.email?.toLowerCase()));
        
        // Et on nettoie la base de données en arrière-plan pour ceux-là !
        const usedIds = (data || []).filter(reg => existingEmails.includes(reg.email?.toLowerCase())).map(r => r.id);
        if (usedIds.length > 0) {
            supabaseClient.from('allowed_registrations').update({ used_at: new Date().toISOString() }).in('id', usedIds).then();
        }
        
    } catch(err) {
        console.error("Erreur loadPendingRegistrations:", err);
        state.pendingRegistrations = [];
    }
};

window.revokePreAuth = async (id) => {
    if (!confirm("Voulez-vous révoquer cette invitation en attente ?")) return;
    try {
        const { error } = await supabaseClient.from('allowed_registrations').delete().eq('id', id);
        if (error) throw error;
        await window.loadPendingRegistrations();
        render();
    } catch(err) {
        console.error(err);
        alert("Erreur lors de la révocation.");
    }
};

window.deleteUser = async (uid) => {
    if (!confirm("Voulez-vous vraiment supprimer cet utilisateur ? Cette action est irréversible !")) return;
    try {
        const { error } = await supabaseClient.rpc('delete_user', { target_user_id: uid });
        if (error) {
            console.warn("RPC delete_user en échec, tentative via delete profile...", error.message);
            const { error: fallbackErr } = await supabaseClient.from('profiles').delete().eq('id', uid);
            if (fallbackErr) throw fallbackErr;
        }
        await syncFromSupabase();
        render();
    } catch(e) {
        console.error(e);
        alert("Erreur lors de la suppression : " + e.message);
    }
};
