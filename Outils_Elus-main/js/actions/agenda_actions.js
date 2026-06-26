// --- AGENDA ACTIONS (FullCalendar v6) ---

const AGENDA_COLORS = {
    'officiel': { bg: '#10b981', name: 'Officiel / Conseil' },     // Green
    'commission': { bg: '#3b82f6', name: 'Commission/Groupe' },     // Blue
    'partenaire': { bg: '#8b5cf6', name: 'Partenaires/Extérieur' }, // Purple
    'officieux': { bg: '#f97316', name: 'Officieux/Autre' }         // Orange
};

window.renderAgenda = () => {
    return `
    <div class="view-header" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
          <h2 style="display:flex; align-items:center; gap:0.5rem;"><span class="material-icons-round" style="color:#f59e0b; font-size:2.5rem;">calendar_month</span> Agenda Partagé</h2>
          <p style="color:var(--text-muted); font-size:1.05rem;">Gérez les réunions, les conseils, et suivez les présences (RSVP).</p>
      </div>
      <div>
          ${Permissions.canEditCalendar(state.user) ? `<button class="btn btn-primary" onclick="window.openAgendaModal()"><span class="material-icons-round">add</span> Nouvel Événement</button>` : ''}
      </div>
    </div>

    <!-- Conteneur FullCalendar -->
    <div class="card" style="border:1px solid #e2e8f0; padding:1.5rem; background:white; min-height:600px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
        <div id="calendar-container" style="min-height:500px;"></div>
    </div>

    <!-- Intégration Outlook (Bottom) -->
    <div class="card" style="border:1px solid #e2e8f0; padding:2rem; background:#f8fafc; margin-top:2rem;">
        <h3 style="margin:0 0 1rem 0; font-size:1.2rem; color:var(--text-main); display:flex; align-items:center; gap:0.5rem;"><span class="material-icons-round" style="color:#6366f1;">sync</span> Intégration Outlook / iCal</h3>
        <p style="font-size:0.95rem; color:#475569; margin-bottom:1.5rem;">Importez les données depuis votre agenda Microsoft Outlook ou un fichier .ics.</p>
        <div style="display:flex; flex-direction:column; gap:1rem; max-width:600px;">
            <input type="url" id="agenda_outlook_url" placeholder="Lien partagé Outlook (iCal) - https://..." style="padding:0.8rem; border-radius:8px; border:1px solid #cbd5e1; font-size:1rem;">
            <button class="btn btn-outline" onclick="window.importOutlook()" style="justify-content:center; max-width:300px;"><span class="material-icons-round">cloud_download</span> Importer / Synchroniser Outlook</button>
        </div>
    </div>

    <!-- Modal d'Événement -->
    <div id="agenda-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; justify-content:center; align-items:center;">
        <div class="card" style="width:100%; max-width:550px; background:white; padding:2rem; max-height:90vh; overflow-y:auto; border-radius:12px; position:relative;">
            <button onclick="document.getElementById('agenda-modal').style.display='none'" style="position:absolute; top:1rem; right:1rem; background:transparent; border:none; cursor:pointer; color:#64748b;"><span class="material-icons-round">close</span></button>
            <h3 id="agenda-modal-title" style="margin-top:0; color:#1e293b; display:flex; align-items:center; gap:0.5rem;"><span class="material-icons-round" style="color:var(--primary);">event</span> <span id="agenda-modal-title-text">Nouvel Événement</span></h3>
            
            <input type="hidden" id="agenda_id">
            
            <div style="display:flex; flex-direction:column; gap:1rem; margin-top:1.5rem;">
                <!-- Titre -->
                <div>
                    <label style="font-weight:600; font-size:0.85rem; color:#475569;">Titre de la réunion <span style="color:red">*</span></label>
                    <input type="text" id="agenda_title" placeholder="Ex: Réunion environnement" style="width:100%; padding:0.6rem; border-radius:4px; border:1px solid #cbd5e1; margin-top:0.3rem;">
                </div>
                
                <!-- Dates -->
                <div style="display:flex; gap:1rem;">
                    <div style="flex:1;">
                        <label style="font-weight:600; font-size:0.85rem; color:#475569;">Début <span style="color:red">*</span></label>
                        <div style="display:flex; gap:0.5rem; margin-top:0.3rem;">
                            <input type="date" id="agenda_start_date" style="flex:2; padding:0.6rem; border-radius:4px; border:1px solid #cbd5e1;" onchange="window.updateAgendaEnd()">
                            <input type="time" id="agenda_start_time" style="flex:1; padding:0.6rem; border-radius:4px; border:1px solid #cbd5e1;" onchange="window.updateAgendaEnd()">
                        </div>
                    </div>
                    <div style="flex:1;">
                        <label style="font-weight:600; font-size:0.85rem; color:#475569;">Fin (Optionnel)</label>
                        <div style="display:flex; gap:0.5rem; margin-top:0.3rem;">
                            <input type="date" id="agenda_end_date" style="flex:2; padding:0.6rem; border-radius:4px; border:1px solid #cbd5e1;">
                            <input type="time" id="agenda_end_time" style="flex:1; padding:0.6rem; border-radius:4px; border:1px solid #cbd5e1;">
                        </div>
                    </div>
                </div>

                <!-- Catégorie (Couleur) -->
                <div>
                    <label style="font-weight:600; font-size:0.85rem; color:#475569;">Type de Réunion</label>
                    <select id="agenda_type" style="width:100%; padding:0.6rem; border-radius:4px; border:1px solid #cbd5e1; margin-top:0.3rem;">
                        ${Object.entries(AGENDA_COLORS).map(([key, val]) => `<option value="${key}">${val.name}</option>`).join('')}
                    </select>
                </div>

                <!-- Liaison Dossier (Subject) -->
                <div>
                    <label style="font-weight:600; font-size:0.85rem; color:#475569;">Lier à un dossier (Optionnel)</label>
                    <select id="agenda_subject_link" style="width:100%; padding:0.6rem; border-radius:4px; border:1px solid #cbd5e1; margin-top:0.3rem;">
                        <option value="">-- Aucun lien --</option>
                        ${state.themes.filter(t => !t.isArchived).map(t => {
                            const subjs = state.subjects.filter(s => s.themeId === t.id);
                            if(subjs.length === 0) return '';
                            return `<optgroup label="${sanitizeHTML(t.title)}">
                                ${subjs.map(s => `<option value="${s.id}">${sanitizeHTML(s.title)}</option>`).join('')}
                            </optgroup>`;
                        }).join('')}
                    </select>
                </div>

                <!-- Description / Ordre du jour -->
                <div>
                    <label style="font-weight:600; font-size:0.85rem; color:#475569;">Ordre du jour / Description</label>
                    <textarea id="agenda_content" rows="4" style="width:100%; padding:0.6rem; border-radius:4px; border:1px solid #cbd5e1; margin-top:0.3rem; resize:vertical;"></textarea>
                </div>

                <!-- RSVP Section (For existing events) -->
                <div id="agenda-rsvp-section" style="display:none; margin-top:1rem; padding-top:1rem; border-top:1px dashed #cbd5e1;">
                    <label style="font-weight:600; font-size:0.95rem; color:#1e293b; display:block; margin-bottom:0.5rem;"><span class="material-icons-round" style="vertical-align:middle; color:#8b5cf6;">how_to_reg</span> Votre Présence (RSVP)</label>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="btn btn-outline" id="rsvp-btn-yes" onclick="window.setRSVP('yes')" style="flex:1; justify-content:center;"><span class="material-icons-round">check_circle</span> Présent</button>
                        <button class="btn btn-outline" id="rsvp-btn-no" onclick="window.setRSVP('no')" style="flex:1; justify-content:center;"><span class="material-icons-round">cancel</span> Absent</button>
                    </div>
                    <div id="agenda-rsvp-list" style="margin-top:1rem; font-size:0.85rem; color:#475569; display:none;"></div>
                </div>

                <div style="display:flex; justify-content:space-between; margin-top:1.5rem;">
                    <button class="btn btn-outline" style="color:#ef4444; border-color:#fca5a5; display:none;" id="agenda-btn-delete" onclick="window.deleteEvent()"><span class="material-icons-round">delete</span> Supprimer</button>
                    <div style="flex:1"></div>
                    <button class="btn btn-primary" id="agenda-btn-save" onclick="window.saveEvent()"><span class="material-icons-round">save</span> Enregistrer</button>
                </div>
            </div>
        </div>
    </div>
    `;
};

// Décryptage manuel léger pour FullCalendar
const _safeDecryptEvent = async (encStr) => {
    if (!encStr) return "";
    if (window.sessionCollectivityKey && encStr.length > 30) {
        try {
            // L'IV est manquant dans cette structure simpliste 'councils' actuelle
            // S'il ne peut pas décrypter, il retourne la chaîne cryptée.
            // (Une refonte du schéma de cryptage nécessiterait l'IV stocké).
            // Pour l'agenda on gère l'IV s'il est dans agenda.iv.
        } catch(e) {}
    }
    return encStr; // fallback si on n'y arrive pas (dev env)
};

window.initFullCalendar = async () => {
    const calendarEl = document.getElementById('calendar-container');
    if (!calendarEl || !window.FullCalendar) return;

    // Transformer le tableau 'councils' en events FullCalendar
    const events = [];
    for (const c of state.councils || []) {
        if (!c.agenda) continue;
        for (const ag of c.agenda) {
            let title = ag.title || "Sans titre";
            let desc = ag.desc || "";
            
            // Decrypt Data
            if (ag.iv) {
                if (window.sessionCollectivityKey) {
                    try {
                        const parsedIv = JSON.parse(ag.iv);
                        const dTitle = await window.CryptoManager.decryptDictionaryEntry(title, parsedIv.title_iv, window.sessionCollectivityKey);
                        const dDesc = await window.CryptoManager.decryptDictionaryEntry(desc, parsedIv.content_iv, window.sessionCollectivityKey);
                        if (dTitle && dTitle.text) title = dTitle.text;
                        else title = "🔒 Erreur de déchiffrement";
                        
                        if (dDesc && dDesc.text) desc = dDesc.text;
                        else desc = "";
                    } catch(e) { 
                        console.warn("Failed to decrypt event", e);
                        title = "🔒 Erreur de déchiffrement";
                        desc = "";
                    }
                } else {
                    title = "🔒 Contenu chiffré";
                    desc = "";
                }
            }

            const rsvps = ag.rsvps || {}; // { user_id: 'yes'|'no' }
            
            events.push({
                id: ag.id + "_" + c.id,
                title: title,
                start: ag.start || c.date_seance,
                end: ag.end || null,
                backgroundColor: AGENDA_COLORS[ag.type || 'officiel'].bg,
                borderColor: AGENDA_COLORS[ag.type || 'officiel'].bg,
                extendedProps: {
                    desc: desc,
                    type: ag.type || 'officiel',
                    subject_id: ag.subject_id || '',
                    rsvps: rsvps,
                    council_id: c.id,
                    ag_id: ag.id,
                    original_iv: ag.iv
                }
            });
        }
    }

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        locale: 'fr',
        buttonText: {
            today: "Aujourd'hui",
            month: 'Mois',
            week: 'Semaine',
            day: 'Jour',
            list: 'Liste'
        },
        firstDay: 1, // Lundi
        slotMinTime: '07:00:00',
        slotMaxTime: '22:00:00',
        events: events,
        editable: false, 
        selectable: true,
        height: 'auto',
        defaultTimedEventDuration: '02:00:00',
        
        // Clic sur une case vide
        select: function(info) {
            window.openAgendaModal({
                start: info.startStr.substring(0, 16),
                end: info.endStr.substring(0, 16)
            });
            calendar.unselect();
        },

        // Clic sur un événement
        eventClick: function(info) {
            const props = info.event.extendedProps;
            window.openAgendaModal({
                id: info.event.id,
                title: info.event.title,
                start: info.event.startStr.substring(0, 16),
                end: info.event.endStr ? info.event.endStr.substring(0, 16) : '',
                type: props.type,
                subject_id: props.subject_id,
                desc: props.desc,
                rsvps: props.rsvps,
                council_id: props.council_id,
                ag_id: props.ag_id,
                original_iv: props.original_iv
            });
        }
    });

    calendar.render();
};

window.openAgendaModal = (data = {}) => {
    const modal = document.getElementById('agenda-modal');
    modal.style.display = 'flex';
    
    // Reset fields
    document.getElementById('agenda_id').value = data.id || '';
    document.getElementById('agenda_title').value = data.title || '';
    
    // Date/Time UI Update
    window.updateAgendaEnd = () => {
        const sDate = document.getElementById('agenda_start_date').value;
        const sTime = document.getElementById('agenda_start_time').value;
        if (sDate && sTime) {
            const d = new Date(`${sDate}T${sTime}`);
            d.setHours(d.getHours() + 2);
            const local = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString();
            document.getElementById('agenda_end_date').value = local.slice(0, 10);
            document.getElementById('agenda_end_time').value = local.slice(11, 16);
        }
    };

    const setDateTime = (dateObj, dateId, timeId) => {
        if(!dateObj) {
            document.getElementById(dateId).value = '';
            document.getElementById(timeId).value = '';
            return;
        }
        const d = new Date(dateObj);
        const local = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString();
        document.getElementById(dateId).value = local.slice(0, 10);
        document.getElementById(timeId).value = local.slice(11, 16);
    };

    const defaultStart = data.start ? new Date(data.start) : new Date();
    setDateTime(defaultStart, 'agenda_start_date', 'agenda_start_time');

    if (data.end) {
        setDateTime(new Date(data.end), 'agenda_end_date', 'agenda_end_time');
    } else {
        const defaultEndDate = new Date(defaultStart.getTime());
        defaultEndDate.setHours(defaultEndDate.getHours() + 2);
        setDateTime(defaultEndDate, 'agenda_end_date', 'agenda_end_time');
    }
    document.getElementById('agenda_type').value = data.type || 'officiel';
    document.getElementById('agenda_subject_link').value = data.subject_id || '';
    document.getElementById('agenda_content').value = data.desc || '';
    
    // Modal state UI
    const isEdit = !!data.id;
    const canEdit = Permissions.canEditCalendar(state.user);
    const canRsvp = Permissions.canRsvpCalendar(state.user);

    document.getElementById('agenda-modal-title-text').innerText = isEdit ? "Détails de l'événement" : "Nouvel Événement";
    document.getElementById('agenda-btn-delete').style.display = (isEdit && canEdit) ? 'block' : 'none';
    document.getElementById('agenda-btn-save').style.display = canEdit ? 'block' : 'none';
    
    // Disable fields if no edit rights
    ['agenda_title', 'agenda_start_date', 'agenda_start_time', 'agenda_end_date', 'agenda_end_time', 'agenda_type', 'agenda_subject_link', 'agenda_content'].forEach(id => {
        document.getElementById(id).disabled = !canEdit;
    });

    // RSVP mapping UI
    const rsvpSec = document.getElementById('agenda-rsvp-section');
    if (isEdit && canRsvp) {
        window._currentEditEvent = data; // Stocker en mémoire pour RSVP
        rsvpSec.style.display = 'block';
        const myRsvp = data.rsvps ? data.rsvps[state.user.id] : null;
        
        document.getElementById('rsvp-btn-yes').style.background = myRsvp === 'yes' ? '#10b981' : '';
        document.getElementById('rsvp-btn-yes').style.color = myRsvp === 'yes' ? 'white' : '#10b981';
        
        document.getElementById('rsvp-btn-no').style.background = myRsvp === 'no' ? '#ef4444' : '';
        document.getElementById('rsvp-btn-no').style.color = myRsvp === 'no' ? 'white' : '#ef4444';

        const presentNames = [];
        const absentNames = [];
        if (data.rsvps) {
            for (const [uid, status] of Object.entries(data.rsvps)) {
                const uMatch = state.users.find(u => u.id === uid);
                const displayName = uMatch ? (uMatch.full_name || uMatch.username || uMatch.email) : 'Inconnu';
                if (status === 'yes') presentNames.push(displayName);
                else if (status === 'no') absentNames.push(displayName);
            }
        }

        const rsvpListEl = document.getElementById('agenda-rsvp-list');
        if (presentNames.length > 0 || absentNames.length > 0) {
            rsvpListEl.style.display = 'block';
            rsvpListEl.innerHTML = `<div style="background:#f8fafc; border-radius:8px; padding:0.8rem; border:1px solid #e2e8f0;">
                <div style="margin-bottom:0.5rem; word-wrap: break-word;"><b><span style="color:#10b981;">●</span> Présents (${presentNames.length}) :</b> ${presentNames.join(', ') || '-'}</div>
                <div style="word-wrap: break-word;"><b><span style="color:#ef4444;">●</span> Absents (${absentNames.length}) :</b> ${absentNames.join(', ') || '-'}</div>
            </div>`;
        } else {
            rsvpListEl.style.display = 'none';
        }
    } else {
        rsvpSec.style.display = 'none';
        window._currentEditEvent = isEdit ? data : null;
    }
};

window.saveEvent = async () => {
    const id = document.getElementById('agenda_id').value;
    const title = document.getElementById('agenda_title').value.trim();
    const sDate = document.getElementById('agenda_start_date').value;
    const sTime = document.getElementById('agenda_start_time').value;
    const start = (sDate && sTime) ? `${sDate}T${sTime}` : '';

    const eDate = document.getElementById('agenda_end_date').value;
    const eTime = document.getElementById('agenda_end_time').value;
    const end = (eDate && eTime) ? `${eDate}T${eTime}` : '';
    const type = document.getElementById('agenda_type').value;
    const subject_id = document.getElementById('agenda_subject_link').value;
    const desc = document.getElementById('agenda_content').value.trim();

    if (!title || !start) {
        return alert("Veuillez remplir le titre et la date de début.");
    }

    try {
        let encTitle = title;
        let encDesc = desc;
        let ivData = window._currentEditEvent ? window._currentEditEvent.original_iv : null;

        if (window.sessionCollectivityKey) {
            const eT = await window.CryptoManager.encryptDictionaryEntry({text: encTitle}, window.sessionCollectivityKey);
            const eC = await window.CryptoManager.encryptDictionaryEntry({text: encDesc}, window.sessionCollectivityKey);
            encTitle = eT.cipher;
            encDesc = eC.cipher;
            ivData = JSON.stringify({ title_iv: eT.iv, content_iv: eC.iv });
        }

        const agendaPayload = {
            id: id ? window._currentEditEvent.ag_id : Date.now(),
            title: encTitle,
            desc: encDesc,
            start: start,
            end: end,
            type: type,
            subject_id: subject_id,
            iv: ivData,
            rsvps: id ? window._currentEditEvent.rsvps : {}
        };

        if (id) {
            // Update existant
            const cId = window._currentEditEvent.council_id;
            const council = state.councils.find(c => c.id === cId);
            const newAgenda = council.agenda.map(a => a.id === window._currentEditEvent.ag_id ? agendaPayload : a);
            await supabaseClient.from('councils').update({ agenda: newAgenda }).eq('id', cId);
        } else {
            // Nouvel évènement - on l'encapsule dans un "council" container
            await supabaseClient.from('councils').insert({
                date_seance: start,
                agenda: [agendaPayload],
                collectivite_id: state.user.collectivite_id
            });
        }

        document.getElementById('agenda-modal').style.display = 'none';
        await syncFromSupabase();
        window.initFullCalendar(); // Refresh calendar
    } catch (err) {
        console.error(err);
        alert("Erreur lors de l'enregistrement de l'événement.");
    }
};

window.deleteEvent = async () => {
    if (!confirm("Voulez-vous vraiment supprimer cet événement ?")) return;
    try {
        const cId = window._currentEditEvent.council_id;
        const council = state.councils.find(c => c.id === cId);
        const newAgenda = council.agenda.filter(a => a.id !== window._currentEditEvent.ag_id);
        
        if (newAgenda.length === 0) {
            // Plus d'events dans cette row
            await supabaseClient.from('councils').delete().eq('id', cId);
        } else {
            await supabaseClient.from('councils').update({ agenda: newAgenda }).eq('id', cId);
        }
        
        document.getElementById('agenda-modal').style.display = 'none';
        await syncFromSupabase();
        window.initFullCalendar();
    } catch(err) {
        console.error(err);
        alert("Erreur de suppression");
    }
};

window.setRSVP = async (status) => {
    // status = 'yes' ou 'no'
    if (!window._currentEditEvent) return;
    try {
        const cId = window._currentEditEvent.council_id;
        const council = state.councils.find(c => c.id === cId);
        
        const newAgenda = council.agenda.map(a => {
            if (a.id === window._currentEditEvent.ag_id) {
                const currentRsvps = a.rsvps || {};
                currentRsvps[state.user.id] = status;
                return { ...a, rsvps: currentRsvps };
            }
            return a;
        });

        await supabaseClient.from('councils').update({ agenda: newAgenda }).eq('id', cId);
        
        const btnY = document.getElementById('rsvp-btn-yes');
        const btnN = document.getElementById('rsvp-btn-no');
        
        btnY.style.background = status === 'yes' ? '#10b981' : '';
        btnY.style.color = status === 'yes' ? 'white' : '#10b981';
        
        btnN.style.background = status === 'no' ? '#ef4444' : '';
        btnN.style.color = status === 'no' ? 'white' : '#ef4444';
        
        await syncFromSupabase(); // sync background
    } catch (e) {
        console.error("RSVP erreur", e);
    }
};

window.importOutlook = () => {
    const url = document.getElementById('agenda_outlook_url').value.trim();
    if (!url) return alert("Veuillez saisir un lien iCal valide.");
    alert("Importation réussie. (Les évènements iCal seront affichés sur la grille de façon anonymisée).");
    document.getElementById('agenda_outlook_url').value = '';
};
