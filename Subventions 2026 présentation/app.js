/**
 * app.js
 * Logic for the Commission Enfance Jeunesse Solidarité Dashboard (Subventions 2026)
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial State
    let savedHelp = {};
    let savedRemarks = {};
    let savedStatus = {};
    let savedCommissionComments = {};
    let savedJustifications = {};
    let savedFormulaNotes = {};
    let savedPrintSelected = [];
    let savedPrintSettings = {};

    try { savedHelp = JSON.parse(localStorage.getItem('exceptional_help') || '{}') || {}; } catch(e) { console.warn("Failed to load exceptional_help:", e); }
    try { savedRemarks = JSON.parse(localStorage.getItem('user_remarks') || '{}') || {}; } catch(e) { console.warn("Failed to load user_remarks:", e); }
    try { savedStatus = JSON.parse(localStorage.getItem('association_status') || '{}') || {}; } catch(e) { console.warn("Failed to load association_status:", e); }
    try { savedCommissionComments = JSON.parse(localStorage.getItem('commission_comments') || '{}') || {}; } catch(e) { console.warn("Failed to load commission_comments:", e); }
    try { savedJustifications = JSON.parse(localStorage.getItem('justifications') || '{}') || {}; } catch(e) { console.warn("Failed to load justifications:", e); }
    try { savedFormulaNotes = JSON.parse(localStorage.getItem('formula_notes') || '{}') || {}; } catch(e) { console.warn("Failed to load formula_notes:", e); }
    try { savedPrintSelected = JSON.parse(localStorage.getItem('print_selected_structures') || '[]') || []; } catch(e) { console.warn("Failed to load print_selected_structures:", e); }
    try { savedPrintSettings = JSON.parse(localStorage.getItem('print_structure_settings') || '{}') || {}; } catch(e) { console.warn("Failed to load print_structure_settings:", e); }
    let savedGlobalTechnicalComments = {};
    try { savedGlobalTechnicalComments = JSON.parse(localStorage.getItem('global_technical_comments') || '{}') || {}; } catch(e) { console.warn("Failed to load global_technical_comments:", e); }
    let savedHelpReasons = {};
    try { savedHelpReasons = JSON.parse(localStorage.getItem('exceptional_help_reasons') || '{}') || {}; } catch(e) { console.warn("Failed to load exceptional_help_reasons:", e); }

    const savedEnvelope = parseFloat(localStorage.getItem('envelope_target'));
    
    // Print Manager Selection Set (declared at top to avoid temporal dead zone)
    let pmSelectedStructures = null; // will be initialized in initPrintAll or top level
    
    const state = {
        data: SUBVENTIONS_DATA.map(item => {
            const key = `${item.name}||${item.commune}||${item.category}`;
            const structKey = `${getStructureName(item.name)}||${item.commune}`;
            
            // Absorb raw exceptional help into proposal_maxime baseline
            const rawHelp = item.exceptional_help || 0;
            const baselineProposal = (item.proposal_maxime || 0) + rawHelp;
            
            // Initialize exceptional help to 0 unless overridden by saved simulation
            const help = savedHelp[key] !== undefined ? savedHelp[key] : 0;
            const helpReason = savedHelpReasons[key] !== undefined ? savedHelpReasons[key] : (item.exceptional_help_reason || '');
            const remarks = savedRemarks[structKey] !== undefined ? savedRemarks[structKey] : (item.user_remarks || '');
            const status = savedStatus[key] !== undefined ? savedStatus[key] : 'debat';
            
            // Load custom comments, justifications and formula notes if edited
            const commComment = savedCommissionComments[key] !== undefined ? savedCommissionComments[key] : (item.commission_comment || '');
            const just = savedJustifications[key] !== undefined ? savedJustifications[key] : (item.justification || '');
            const formulaNote = savedFormulaNotes[key] !== undefined ? savedFormulaNotes[key] : '';
            const globalTechComment = savedGlobalTechnicalComments[structKey] !== undefined ? savedGlobalTechnicalComments[structKey] : (item.global_technical_comment || '');
            
            // Load custom print visibility settings per structure
            const structSettings = savedPrintSettings[structKey] || {
                show_budget: true,
                show_finance: true,
                show_operating: true,
                show_formula: true,
                show_comments: true,
                hide_kpi_acted: false,
                hide_kpi_requested: false,
                hide_hours: false,
                hide_treasury_net: false,
                hide_treasury_global: false,
                hide_result: false
            };
            
            return {
                ...item,
                proposal_maxime: baselineProposal,
                exceptional_help: help,
                exceptional_help_reason: helpReason,
                user_remarks: remarks,
                global_technical_comment: globalTechComment,
                status: status,
                commission_comment: commComment,
                justification: just,
                custom_formula_note: formulaNote,
                sub_final_2026: Math.max(0, baselineProposal + help),
                print_show_budget: structSettings.show_budget !== undefined ? structSettings.show_budget : true,
                print_show_finance: structSettings.show_finance !== undefined ? structSettings.show_finance : true,
                print_show_operating: structSettings.show_operating !== undefined ? structSettings.show_operating : true,
                print_show_formula: structSettings.show_formula !== undefined ? structSettings.show_formula : true,
                print_show_comments: structSettings.show_comments !== undefined ? structSettings.show_comments : true,
                print_hide_kpi_acted: structSettings.hide_kpi_acted !== undefined ? structSettings.hide_kpi_acted : false,
                print_hide_kpi_requested: structSettings.hide_kpi_requested !== undefined ? structSettings.hide_kpi_requested : false,
                print_hide_hours: structSettings.hide_hours !== undefined ? structSettings.hide_hours : false,
                print_hide_treasury_net: structSettings.hide_treasury_net !== undefined ? structSettings.hide_treasury_net : false,
                print_hide_treasury_global: structSettings.hide_treasury_global !== undefined ? structSettings.hide_treasury_global : false,
                print_hide_result: structSettings.hide_result !== undefined ? structSettings.hide_result : false
            };
        }),
        envelopeTarget: isNaN(savedEnvelope) ? 1922061 : savedEnvelope,
        activeTab: 'tab-dashboard',
        theme: 'light',
        searchQuery: '',
        filterCity: 'all',
        filterCat: 'all',
        filterStatus: 'all',
        themFilterCity: 'all',
        themFilterCat: 'all'
    };

    // Initialize print structures set from saved state or default to all unique keys
    const uniqueKeysList = [...new Set(state.data.map(item => `${getStructureName(item.name)}||${item.commune}`))];
    pmSelectedStructures = new Set(savedPrintSelected.length > 0 ? savedPrintSelected : uniqueKeysList);

    function saveToLocalStorage() {
        const helpObj = {};
        const remarksObj = {};
        const globalTechnicalCommentsObj = {};
        const helpReasonsObj = {};
        const statusObj = {};
        const commCommentsObj = {};
        const justificationsObj = {};
        const formulaNotesObj = {};
        const printSettingsObj = {};
        
        state.data.forEach(item => {
            const key = `${item.name}||${item.commune}||${item.category}`;
            const structKey = `${getStructureName(item.name)}||${item.commune}`;
            helpObj[key] = item.exceptional_help;
            remarksObj[structKey] = item.user_remarks || '';
            helpReasonsObj[key] = item.exceptional_help_reason || '';
            globalTechnicalCommentsObj[structKey] = item.global_technical_comment || '';
            statusObj[key] = item.status || 'debat';
            commCommentsObj[key] = item.commission_comment || '';
            justificationsObj[key] = item.justification || '';
            formulaNotesObj[key] = item.custom_formula_note || '';
            
            printSettingsObj[structKey] = {
                show_budget: item.print_show_budget,
                show_finance: item.print_show_finance,
                show_operating: item.print_show_operating,
                show_formula: item.print_show_formula,
                show_comments: item.print_show_comments,
                hide_kpi_acted: item.print_hide_kpi_acted,
                hide_kpi_requested: item.print_hide_kpi_requested,
                hide_hours: item.print_hide_hours,
                hide_treasury_net: item.print_hide_treasury_net,
                hide_treasury_global: item.print_hide_treasury_global,
                hide_result: item.print_hide_result
            };
        });
        
        localStorage.setItem('exceptional_help', JSON.stringify(helpObj));
        localStorage.setItem('exceptional_help_reasons', JSON.stringify(helpReasonsObj));
        localStorage.setItem('user_remarks', JSON.stringify(remarksObj));
        localStorage.setItem('global_technical_comments', JSON.stringify(globalTechnicalCommentsObj));
        localStorage.setItem('association_status', JSON.stringify(statusObj));
        localStorage.setItem('commission_comments', JSON.stringify(commCommentsObj));
        localStorage.setItem('justifications', JSON.stringify(justificationsObj));
        localStorage.setItem('formula_notes', JSON.stringify(formulaNotesObj));
        localStorage.setItem('print_structure_settings', JSON.stringify(printSettingsObj));
        localStorage.setItem('print_selected_structures', JSON.stringify([...pmSelectedStructures]));
        localStorage.setItem('envelope_target', state.envelopeTarget);
    }

    // Population constants for each commune (INSEE 2023)
    const CITY_POPULATIONS = {
        'Saint-Julien-sur-Loire': 8823,
        'Sainte-Agathe': 6097,
        'Mireval-sur-Loire': 4638,
        'Saint-Pierre-des-Monts': 2954,
        'Saint-Paul-en-Forez': 2358,
        'Les Tilleuls': 1450,
        "La Chapelle-Saint-Jean": 1115,
        'Chalencon-les-Pins': 1038
    };

    function getStructureName(name) {
        if (!name) return '';
        if (name === 'ACIJA' || name.startsWith('ACIJA /')) return 'ACIJA';
        return name;
    }

    function getMatchingServices(name, commune) {
        const targetGroup = getStructureName(name);
        return state.data.filter(s => {
            return getStructureName(s.name) === targetGroup && s.commune === commune;
        });
    }

    function getActivityDisplayName(service) {
        const name = service.name;
        if (name === 'ACIJA / CLAS') return 'ACIJA - CLAS';
        if (name === 'ACIJA / PAEJ') return 'ACIJA - PAEJ';
        if (name === 'ACIJA / PIJ, Eurodesk et Guid\'assos') return 'ACIJA - PIJ';
        return getShortCategory(service.category);
    }

    // Global Chart Instances
    let historicalChart = null;
    let categoriesChart = null;
    let communesChart = null;

    // 2. Formatting Helpers
    function formatCurrency(val, hideZero = false) {
        if (val === undefined || val === null || isNaN(val) || val === '') return '';
        if (hideZero && parseFloat(val) === 0) return '';
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
    }

    function formatHours(val, hideZero = false) {
        if (val === undefined || val === null || isNaN(val) || val === '') return '';
        if (hideZero && parseFloat(val) === 0) return '';
        return new Intl.NumberFormat('fr-FR').format(val) + ' h';
    }

    function formatPercent(val) {
        if (val === undefined || val === null || isNaN(val) || val === '') return '0,00%';
        const floatVal = parseFloat(val);
        return (floatVal >= 0 ? '+' : '') + floatVal.toFixed(2).replace('.', ',') + '%';
    }

    function getShortCategory(cat) {
        if (cat === 'CRÈCHES ET MICRO-CRÈCHES') return 'Crèches';
        if (cat === 'ALSH (PÉRISCOLAIRE MATIN MIDI ET SOIR)') return 'Péri classique';
        if (cat === 'ALSH (PÉRISCOLAIRE MERCREDI)') return 'Péri Mercredi';
        if (cat === 'ALSH (EXTRASCOLAIRE)') return 'Extrascolaire';
        if (cat === 'ACCUEIL AL ADOS (JEUNESSE)' || cat === 'ACCUEIL ADOS (JEUNESSE)') return 'Ados / Jeunesse';
        if (cat === 'RPE, LUDOTHÈQUE, SOLIDARITÉS & AUTRES') return 'RPE / Ludo / Solidarités';
        return cat;
    }

    function generateFormulaExplanation(item) {
        const cat = item.category;
        const name = item.name;
        const base = item.valorisation_service || 0;
        const rate = item.valorisation_hour || 0;
        const hours = item.hours_2025 || 0;
        const neutral = item.sub_neutral || 0;
        const requested = item.sub_2026_requested_activity || 0;
        const proposal = item.proposal_maxime || 0;

        let html = '';

        if (cat === 'CRÈCHES ET MICRO-CRÈCHES') {
            const isChapelle = name.toLowerCase().includes("echap") || item.commune === "La Chapelle-Saint-Jean";
            html = `
                <div class="formula-block" style="color: var(--text-color);">
                    <p style="margin-bottom: 10px;"><strong>Formule appliquée :</strong> <code style="background: rgba(var(--primary-rgb), 0.1); padding: 2px 6px; border-radius: 4px; font-weight: 500;">Base Fixe + (Heures d'activité 2025 × Taux horaire)</code> (plafonné à la demande).</p>
                    <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.5;">
                        <li><strong>Base Fixe :</strong> ${formatCurrency(34467)} (correspond au coût de 2 agents travaillant 50h/semaine pendant 47 semaines à 22 €/h, pris en charge à 1/3 par la collectivité).</li>
                        <li><strong>Taux Horaire :</strong> ${isChapelle ? "Minoré entre 1,00 € et 2,00 € (liberté de la structure de fixer ses tarifs)" : "Dégressif de 2,40 € (grandes structures) à 2,70 € (petites structures) pour valoriser les économies d'échelle"}.</li>
                    </ul>
                    <div style="background: rgba(var(--primary-rgb), 0.05); padding: 15px; border-radius: 6px; border-left: 4px solid var(--primary); margin-top: 15px; line-height: 1.6;">
                        <strong style="color: var(--primary);">Calcul détaillé pour cette structure :</strong><br>
                        • Base fixe appliquée : <code>${formatCurrency(base)}</code><br>
                        • Taux horaire appliqué : <code>${rate.toFixed(2).replace('.', ',')} €/h</code><br>
                        • Volume d'heures d'activité 2025 : <code>${formatHours(hours)}</code><br>
                        • Calcul théorique : <code>${formatCurrency(base)} + (${formatHours(hours)} × ${rate.toFixed(2).replace('.', ',')} €) = ${formatCurrency(neutral)}</code><br>
                        • Demande de l'association : <code>${formatCurrency(requested)}</code><br>
                        • <strong>Proposition Technicien : ${formatCurrency(proposal)}</strong> ${proposal < neutral ? "<span style='color: var(--warning); font-style: italic;'>(Plafonné à la demande)</span>" : ""}
                    </div>
                </div>
            `;
        } else if (cat === 'ALSH (PÉRISCOLAIRE MATIN MIDI ET SOIR)') {
            let configText = "Autre configuration";
            if (base === 12672) configText = "Matin, Midi et Soir (3 créneaux : base 4 224 € × 3)";
            else if (base === 8448) configText = "Matin et Soir (2 créneaux : base 4 224 € × 2)";
            else if (base === 4224) configText = "Un seul créneau (base 4 224 € × 1)";
            else if (base <= 1100) configText = "Activité ponctuelle (Friday evening uniquement, base divisée par 4)";

            html = `
                <div class="formula-block" style="color: var(--text-color);">
                    <p style="margin-bottom: 10px;"><strong>Formule appliquée :</strong> <code style="background: rgba(var(--primary-rgb), 0.1); padding: 2px 6px; border-radius: 4px; font-weight: 500;">(Base par créneau × Créneaux) + (Heures d'activité 2025 × Taux horaire)</code> (plafonné à la demande).</p>
                    <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.5;">
                        <li><strong>Base par créneau :</strong> ${formatCurrency(4224)} (créneau Matin, Midi ou Soir, correspond à 1 agent pour 8h/semaine pendant 36 semaines à 22 €/h, minimum de 2 agents requis, pris en charge à 1/3).</li>
                        <li><strong>Taux Horaire :</strong> Situé entre 1,05 €/h (grandes structures) et 2,00 €/h (petites structures) selon le volume d'activité.</li>
                    </ul>
                    <div style="background: rgba(var(--primary-rgb), 0.05); padding: 15px; border-radius: 6px; border-left: 4px solid var(--primary); margin-top: 15px; line-height: 1.6;">
                        <strong style="color: var(--primary);">Calcul détaillé pour cette structure :</strong><br>
                        • Configuration des créneaux : <code>${configText}</code><br>
                        • Base appliquée : <code>${formatCurrency(base)}</code><br>
                        • Taux horaire appliqué : <code>${rate.toFixed(2).replace('.', ',')} €/h</code><br>
                        • Volume d'heures d'activité 2025 : <code>${formatHours(hours)}</code><br>
                        • Calcul théorique : <code>${formatCurrency(base)} + (${formatHours(hours)} × ${rate.toFixed(2).replace('.', ',')} €) = ${formatCurrency(neutral)}</code><br>
                        • Demande de l'association : <code>${formatCurrency(requested)}</code><br>
                        • <strong>Proposition Technicien : ${formatCurrency(proposal)}</strong> ${proposal < neutral ? "<span style='color: var(--warning); font-style: italic;'>(Plafonné à la demande)</span>" : ""}
                    </div>
                </div>
            `;
        } else if (cat === 'ALSH (PÉRISCOLAIRE MERCREDI)') {
            html = `
                <div class="formula-block" style="color: var(--text-color);">
                    <p style="margin-bottom: 10px;"><strong>Formule appliquée :</strong> <code style="background: rgba(var(--primary-rgb), 0.1); padding: 2px 6px; border-radius: 4px; font-weight: 500;">Base Fixe + (Heures d'activité 2025 × Taux horaire)</code> (plafonné à la demande).</p>
                    <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.5;">
                        <li><strong>Base Fixe :</strong> ${formatCurrency(5280)} (correspond au coût de 2 agents travaillant 10h/semaine pendant 36 semaines à 22 €/h, pris en charge à 1/3 par la collectivité).</li>
                        <li><strong>Taux Horaire :</strong> Situé entre 1,10 €/h (grandes structures) et 2,10 €/h (petites structures) selon le volume d'activité.</li>
                    </ul>
                    <div style="background: rgba(var(--primary-rgb), 0.05); padding: 15px; border-radius: 6px; border-left: 4px solid var(--primary); margin-top: 15px; line-height: 1.6;">
                        <strong style="color: var(--primary);">Calcul détaillé pour cette structure :</strong><br>
                        • Base fixe appliquée : <code>${formatCurrency(base)}</code><br>
                        • Taux horaire appliqué : <code>${rate.toFixed(2).replace('.', ',')} €/h</code><br>
                        • Volume d'heures d'activité 2025 : <code>${formatHours(hours)}</code><br>
                        • Calcul théorique : <code>${formatCurrency(base)} + (${formatHours(hours)} × ${rate.toFixed(2).replace('.', ',')} €) = ${formatCurrency(neutral)}</code><br>
                        • Demande de l'association : <code>${formatCurrency(requested)}</code><br>
                        • <strong>Proposition Technicien : ${formatCurrency(proposal)}</strong> ${proposal < neutral ? "<span style='color: var(--warning); font-style: italic;'>(Plafonné à la demande)</span>" : ""}
                    </div>
                </div>
            `;
        } else if (cat === 'ALSH (EXTRASCOLAIRE)') {
            html = `
                <div class="formula-block" style="color: var(--text-color);">
                    <p style="margin-bottom: 10px;"><strong>Formule appliquée :</strong> <code style="background: rgba(var(--primary-rgb), 0.1); padding: 2px 6px; border-radius: 4px; font-weight: 500;">Base Fixe + (Heures d'activité 2025 × Taux horaire)</code> (plafonné à la demande).</p>
                    <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.5;">
                        <li><strong>Base Fixe :</strong> ${formatCurrency(9533)} (correspond au coût de 2 agents travaillant 50h/semaine pendant 13 semaines à 22 €/h, pris en charge à 1/3 par la collectivité).</li>
                        <li><strong>Taux Horaire :</strong> Plus élevé (inclut coûts des sorties et des animations), situé entre 1,42 €/h (grandes structures) et 2,40 €/h (petites structures).</li>
                    </ul>
                    <div style="background: rgba(var(--primary-rgb), 0.05); padding: 15px; border-radius: 6px; border-left: 4px solid var(--primary); margin-top: 15px; line-height: 1.6;">
                        <strong style="color: var(--primary);">Calcul détaillé pour cette structure :</strong><br>
                        • Base fixe appliquée : <code>${formatCurrency(base)}</code><br>
                        • Taux horaire appliqué : <code>${rate.toFixed(2).replace('.', ',')} €/h</code><br>
                        • Volume d'heures d'activité 2025 : <code>${formatHours(hours)}</code><br>
                        • Calcul théorique : <code>${formatCurrency(base)} + (${formatHours(hours)} × ${rate.toFixed(2).replace('.', ',')} €) = ${formatCurrency(neutral)}</code><br>
                        • Demande de l'association : <code>${formatCurrency(requested)}</code><br>
                        • <strong>Proposition Technicien : ${formatCurrency(proposal)}</strong> ${proposal < neutral ? "<span style='color: var(--warning); font-style: italic;'>(Plafonné à la demande)</span>" : ""}
                    </div>
                </div>
            `;
        } else if (cat.includes('ADOS') || cat.includes('JEUNESSE')) {
            const isMGC = name.toLowerCase().includes("mgc");
            html = `
                <div class="formula-block" style="color: var(--text-color);">
                    <p style="margin-bottom: 10px;"><strong>Formule appliquée :</strong> <code style="background: rgba(var(--primary-rgb), 0.1); padding: 2px 6px; border-radius: 4px; font-weight: 500;">Base Fixe + (Heures d'activité 2025 × Taux horaire)</code> (plafonné à la demande).</p>
                    <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.5;">
                        <li><strong>Base Fixe :</strong> Ajustée spécifiquement selon le temps d'ouverture (heures de personnel pour 2 agents minimum, financées à 1/3 par la collectivité).</li>
                        <li><strong>Taux Horaire :</strong> Valorisé plus fortement en raison de la consommation de sorties (de 3,00 €/h pour les gros clubs à 5,00 €/h pour les petits). ${isMGC ? "Bénéficie d'un bonus (taux de 4,00 €/h à 6,00 €/h) car la MGC assure du périscolaire ados." : ""}</li>
                    </ul>
                    <div style="background: rgba(var(--primary-rgb), 0.05); padding: 15px; border-radius: 6px; border-left: 4px solid var(--primary); margin-top: 15px; line-height: 1.6;">
                        <strong style="color: var(--primary);">Calcul détaillé pour cette structure :</strong><br>
                        • Base fixe appliquée : <code>${formatCurrency(base)}</code><br>
                        • Taux horaire appliqué : <code>${rate.toFixed(2).replace('.', ',')} €/h</code><br>
                        • Volume d'heures d'activité 2025 : <code>${formatHours(hours)}</code><br>
                        • Calcul théorique : <code>${formatCurrency(base)} + (${formatHours(hours)} × ${rate.toFixed(2).replace('.', ',')} €) = ${formatCurrency(neutral)}</code><br>
                        • Demande de l'association : <code>${formatCurrency(requested)}</code><br>
                        • <strong>Proposition Technicien : ${formatCurrency(proposal)}</strong> ${proposal < neutral ? "<span style='color: var(--warning); font-style: italic;'>(Plafonné à la demande)</span>" : ""}
                    </div>
                </div>
            `;
        } else if (name.toLowerCase().includes("ricochet") || name.toLowerCase().includes("farandole") || name.toLowerCase().includes("silopio")) {
            html = `
                <div class="formula-block" style="color: var(--text-color);">
                    <p style="margin-bottom: 10px;"><strong>Principe appliqué :</strong> <code style="background: rgba(var(--primary-rgb), 0.1); padding: 2px 6px; border-radius: 4px; font-weight: 500;">Parité Recettes d'Activité / Co-financement CAF</code>.</p>
                    <p>La collectivité s'aligne exactement sur les recettes d'activité perçues par la structure (financements CAF et cotisations/participations des familles).</p>
                    <div style="background: rgba(var(--primary-rgb), 0.05); padding: 15px; border-radius: 6px; border-left: 4px solid var(--primary); margin-top: 15px; line-height: 1.6;">
                        <strong style="color: var(--primary);">Calcul détaillé :</strong><br>
                        • Recettes CAF et activité de référence : <code>${formatCurrency(base)}</code><br>
                        • Taux de cofinancement (100%) : <code>${formatCurrency(neutral)}</code><br>
                        • Demande de l'association : <code>${formatCurrency(requested)}</code><br>
                        • <strong>Proposition Technicien : ${formatCurrency(proposal)}</strong> ${proposal < neutral ? "<span style='color: var(--warning); font-style: italic;'>(Plafonné à la demande)</span>" : ""}
                    </div>
                </div>
            `;
        } else {
            html = `
                <div class="formula-block" style="color: var(--text-color);">
                    <p style="margin-bottom: 10px;"><strong>Principe d'instruction :</strong> <code style="background: rgba(var(--primary-rgb), 0.1); padding: 2px 6px; border-radius: 4px; font-weight: 500;">Instruction au cas par cas (Demande faible)</code>.</p>
                    <p>Cette structure présente des demandes financières modérées ne nécessitant pas de modélisation mathématique approfondie. L'analyse est effectuée de manière qualitative.</p>
                    <div style="background: rgba(var(--primary-rgb), 0.05); padding: 15px; border-radius: 6px; border-left: 4px solid var(--primary); margin-top: 15px; line-height: 1.6;">
                        <strong style="color: var(--primary);">Détails :</strong><br>
                        • Demande de l'association : <code>${formatCurrency(requested)}</code><br>
                        • <strong>Proposition Technicien : ${formatCurrency(proposal)}</strong>
                    </div>
                </div>
            `;
        }
        return html;
    }

    function getShortFormulaText(item) {
        const cat = item.category;
        const name = item.name;
        const base = item.valorisation_service || 0;
        const rate = item.valorisation_hour || 0;
        const hours = item.hours_2025 || 0;
        const neutral = item.sub_neutral || 0;
        const requested = item.sub_2026_requested_activity || 0;
        const proposal = item.proposal_maxime || 0;

        if (cat === 'CRÈCHES ET MICRO-CRÈCHES') {
            const isChapelle = name.toLowerCase().includes("echap") || item.commune === "La Chapelle-Saint-Jean";
            const rateExplanation = isChapelle 
                ? `un taux minoré à ${rate.toFixed(2).replace('.', ',')} €/h (la structure conservant la liberté de fixer ses tarifs)`
                : `un taux horaire dégressif de ${rate.toFixed(2).replace('.', ',')} €/h (établi entre 2,40 €/h pour les plus grandes structures et 2,70 €/h pour les plus petites, afin de valoriser les économies d'échelle)`;
            
            return `Cette proposition est calculée à partir d'une base de cofinancement fixe de ${formatCurrency(base)} (qui correspond au cofinancement à 1/3 par la collectivité de 2 agents travaillant 50 heures par semaine durant 47 semaines d'ouverture annuelle). S'y ajoute une valorisation de l'activité réelle de 2025 sur la base de ${formatHours(hours)} avec ${rateExplanation}. Le montant théorique calculé s'élève ainsi à ${formatCurrency(neutral)}, qui est plafonné au montant demandé par la structure soit ${formatCurrency(requested)} pour aboutir à une proposition finale de ${formatCurrency(proposal)}.`;
            
        } else if (cat === 'ALSH (PÉRISCOLAIRE MATIN MIDI ET SOIR)') {
            let configText = "d'un créneau d'activité";
            if (base === 12672) configText = "de 3 créneaux d'activité (Matin, Midi et Soir)";
            else if (base === 8448) configText = "de 2 créneaux d'activité (Matin et Soir)";
            else if (base === 4224) configText = "d'un unique créneau d'activité";
            else if (base <= 1100) configText = "d'une activité ponctuelle (soirée du vendredi)";

            return `Le calcul repose sur un cofinancement de créneaux à hauteur de 4 224 € par créneau (base correspondant au cofinancement à 1/3 par la collectivité d'un agent travaillant 8 heures par semaine sur 36 semaines scolaires, avec un minimum requis de 2 agents). Pour cette structure, la base appliquée est de ${formatCurrency(base)} en raison ${configText}. À cela s'ajoute une valorisation de ${rate.toFixed(2).replace('.', ',')} €/h pour les ${formatHours(hours)} d'activité réelle. Le total théorique obtenu est de ${formatCurrency(neutral)}, qui est plafonné à la demande de l'association (${formatCurrency(requested)}), donnant une proposition de ${formatCurrency(proposal)}.`;
            
        } else if (cat === 'ALSH (PÉRISCOLAIRE MERCREDI)') {
            return `Cette proposition comprend une base fixe de cofinancement de ${formatCurrency(base)} (représentant le cofinancement à 1/3 par la collectivité de 2 agents travaillant 10 heures par mercredi durant les 36 semaines scolaires). À cette base s'ajoute une valorisation horaire de ${rate.toFixed(2).replace('.', ',')} €/h pour les ${formatHours(hours)} d'activité réelle (taux ajusté entre 1,10 €/h et 2,10 €/h selon la taille de la structure). Le total théorique s'élève à ${formatCurrency(neutral)}, plafonné au montant demandé par l'association (${formatCurrency(requested)}) pour une proposition de ${formatCurrency(proposal)}.`;
            
        } else if (cat === 'ALSH (EXTRASCOLAIRE)') {
            return `Le calcul est constitué d'une base de cofinancement fixe de ${formatCurrency(base)} (correspondant au cofinancement à 1/3 par la collectivité de 2 agents travaillant 50 heures par semaine durant les 13 semaines de vacances scolaires). S'y ajoute une valorisation horaire de ${rate.toFixed(2).replace('.', ',')} €/h pour les ${formatHours(hours)} d'activité (taux situé entre 1,42 €/h et 2,40 €/h qui intègre le coût spécifique des sorties et du transport). Le montant théorique s'élève à ${formatCurrency(neutral)}, plafonné à la demande de l'association (${formatCurrency(requested)}) pour une proposition finale de ${formatCurrency(proposal)}.`;
            
        } else if (cat.includes('ADOS') || cat.includes('JEUNESSE')) {
            const isMGC = name.toLowerCase().includes("mgc");
            const mgcBonus = isMGC ? " (incluant un bonus spécifique car la MGC assure également l'accueil périscolaire des ados)" : "";
            return `Cette proposition s'appuie sur une base de cofinancement de ${formatCurrency(base)} (ajustée selon le temps d'ouverture pour couvrir le personnel nécessaire, sur la base de 2 agents minimum financés à 1/3 par la collectivité). On y ajoute une valorisation de ${rate.toFixed(2).replace('.', ',')} €/h pour les ${formatHours(hours)} d'activité réelle, reflétant un taux horaire rehaussé pour couvrir les frais de sorties${mgcBonus}. Le total théorique calculé est de ${formatCurrency(neutral)}, plafonné au montant demandé par la structure de ${formatCurrency(requested)} pour une proposition de ${formatCurrency(proposal)}.`;
            
        } else if (name.toLowerCase().includes("ricochet") || name.toLowerCase().includes("farandole") || name.toLowerCase().includes("silopio")) {
            return `Cette proposition applique un principe de parité stricte (cofinancement à 100%) aligné sur les recettes d'activité réelles de la structure (financements CAF et participations des familles de référence à hauteur de ${formatCurrency(base)}). Le total théorique est de ${formatCurrency(neutral)}, plafonné à la demande de l'association (${formatCurrency(requested)}) pour une proposition finale de ${formatCurrency(proposal)}.`;
            
        } else {
            return `Instruction spécifique et sur mesure pour cette structure. La subvention proposée est établie à ${formatCurrency(proposal)} en cohérence avec la demande initiale de ${formatCurrency(requested)}.`;
        }
    }

    // 3. Populate Filter Dropdowns dynamically
    function populateDropdowns() {
        const communes = [...new Set(state.data.map(item => item.commune).filter(Boolean))].sort();
        const categories = [...new Set(state.data.map(item => item.category).filter(Boolean))].sort();

        const simCitySelect = document.getElementById('sim-filter-city');
        const simCatSelect = document.getElementById('sim-filter-cat');
        const themCitySelect = document.getElementById('them-city-select');
        const themCatSelect = document.getElementById('them-cat-select');

        function addOptions(selectElement, items) {
            // Keep first option "All"
            selectElement.innerHTML = selectElement.options[0].outerHTML;
            items.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item;
                opt.textContent = item;
                selectElement.appendChild(opt);
            });
        }

        addOptions(simCitySelect, communes);
        addOptions(simCatSelect, categories);
        addOptions(themCitySelect, communes);
        addOptions(themCatSelect, categories);
    }

    // 4. Recalculate and Update KPIs
    function updateKPIs() {
        let totalProposed = 0;
        let totalRequested = 0;
        state.data.forEach(item => {
            totalProposed += item.sub_final_2026;
            totalRequested += item.sub_2026_requested_activity || 0;
        });

        const totalSaving = totalRequested - totalProposed;
        const envelopeDelta = state.envelopeTarget - totalProposed;
        const totalEvolution = ((totalProposed - state.envelopeTarget) / state.envelopeTarget) * 100;

        // KPI values
        document.getElementById('val-total-proposed').textContent = formatCurrency(totalProposed);
        document.getElementById('sim-total-general').textContent = formatCurrency(totalProposed);
        document.getElementById('val-total-requested').textContent = formatCurrency(totalRequested);
        document.getElementById('val-saving').textContent = formatCurrency(Math.max(0, totalSaving));

        // Update envelope input values to keep them in sync
        document.getElementById('input-envelope-target').value = state.envelopeTarget;
        document.getElementById('sim-envelope-target').value = state.envelopeTarget;

        // Update simulator label with dynamic envelope target
        document.getElementById('sim-envelope-label').textContent = `ÉCART ENVELOPPE (${(state.envelopeTarget / 1000000).toFixed(2)}M€)`;

        // Evolution Indicator
        const evoEl = document.getElementById('val-total-evolution');
        evoEl.textContent = (totalEvolution >= 0 ? '+' : '') + totalEvolution.toFixed(2).replace('.', ',') + '%';
        if (totalEvolution > 0) {
            evoEl.className = 'trend-indicator positive'; // Red (spending increase is danger for intercommunal budget)
        } else {
            evoEl.className = 'trend-indicator negative'; // Green (savings)
        }

        // Envelope Delta
        const deltaEl = document.getElementById('val-envelope-delta');
        const deltaLabelEl = document.getElementById('val-envelope-delta-label');
        const simDeltaEl = document.getElementById('sim-envelope-delta-real');

        deltaEl.textContent = formatCurrency(Math.abs(envelopeDelta));
        if (envelopeDelta >= 0) {
            deltaLabelEl.textContent = "sous l'enveloppe de référence";
            deltaEl.className = 'trend-indicator negative'; // Green
            simDeltaEl.textContent = '+' + formatCurrency(envelopeDelta);
            simDeltaEl.className = 'sim-kpi-val safe'; // Green
        } else {
            deltaLabelEl.textContent = "au-dessus de l'enveloppe de référence";
            deltaEl.className = 'trend-indicator positive'; // Red
            simDeltaEl.textContent = '-' + formatCurrency(Math.abs(envelopeDelta));
            simDeltaEl.className = 'sim-kpi-val danger'; // Red
        }

        // Header Envelope Status Badge
        const badgeEl = document.getElementById('global-envelope-status');
        const badgeTextEl = badgeEl.querySelector('.badge-text');
        if (envelopeDelta >= 0) {
            badgeEl.classList.remove('over-budget');
            badgeTextEl.textContent = 'Budget sous contrôle';
        } else {
            badgeEl.classList.add('over-budget');
            badgeTextEl.textContent = `Dépassement: ${formatCurrency(Math.abs(envelopeDelta))}`;
        }

        // Structures count
        document.getElementById('val-structures-count').textContent = state.data.length;
        const uniqueCities = [...new Set(state.data.map(item => item.commune).filter(Boolean))].length;
        document.getElementById('val-cities-count').textContent = `${uniqueCities} communes`;
    }

    // Helper function for hourly cost
    function formatHourlyCost(sub, hours) {
        if (!hours || isNaN(hours) || hours <= 0) return '<span class="text-muted">-</span>';
        const cost = sub / hours;
        return cost.toFixed(2).replace('.', ',') + ' €/h';
    }

    // 5. Render Simulator Table
    function renderSimulatorTable() {
        const tbody = document.getElementById('subventions-table-body');
        tbody.innerHTML = '';

        // Create a copy of the state data preserving original index
        const indexedItems = state.data.map((item, index) => ({ item, index }));

        // Sort items by structure name and commune, then category to group them nicely
        indexedItems.sort((a, b) => {
            const structA = getStructureName(a.item.name).toLowerCase();
            const structB = getStructureName(b.item.name).toLowerCase();
            if (structA !== structB) {
                return structA.localeCompare(structB, 'fr');
            }
            const commA = (a.item.commune || '').toLowerCase();
            const commB = (b.item.commune || '').toLowerCase();
            if (commA !== commB) {
                return commA.localeCompare(commB, 'fr');
            }
            const catA = (a.item.category || '').toLowerCase();
            const catB = (b.item.category || '').toLowerCase();
            return catA.localeCompare(catB, 'fr');
        });

        indexedItems.forEach(({ item, index }) => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-commune', item.commune);
            tr.setAttribute('data-category', item.category);
            tr.setAttribute('data-name', item.name);
            tr.setAttribute('data-comment', (item.commission_comment || '') + ' ' + (item.justification || ''));
            tr.setAttribute('data-status', item.status || 'debat');

            const acted = formatCurrency(item.sub_2025_acted);
            const requested = formatCurrency(item.sub_2026_requested_activity);
            const neutral = formatCurrency(item.sub_neutral);
            const proposal = formatCurrency(item.proposal_maxime);
            const finalVal = formatCurrency(item.sub_final_2026);

            let helpClass = 'sim-input-help';
            if (item.exceptional_help > 0) helpClass += ' value-positive';
            else if (item.exceptional_help < 0) helpClass += ' value-negative';

            const statusSelect = `
                <select class="status-select select-status-${item.status || 'debat'}" data-index="${index}">
                    <option value="debat" ${(!item.status || item.status === 'debat') ? 'selected' : ''}>🟡 En débat</option>
                    <option value="valide" ${(item.status === 'valide') ? 'selected' : ''}>🟢 Validé</option>
                    <option value="bloque" ${(item.status === 'bloque') ? 'selected' : ''}>🔴 Bloqué</option>
                </select>
            `;

            tr.innerHTML = `
                <td>${item.commune}</td>
                <td><strong>${item.name}</strong></td>
                <td><span class="cell-sub-cat">${getShortCategory(item.category)}</span></td>
                <td class="num-col">${acted}</td>
                <td class="num-col">${requested}</td>
                <td class="num-col">${neutral}</td>
                <td class="num-col">${proposal}</td>
                <td class="num-col" style="background: rgba(var(--primary-rgb), 0.03);">
                    <input type="number" 
                           class="${helpClass}" 
                           value="${item.exceptional_help === 0 ? '' : item.exceptional_help}" 
                           placeholder="0"
                           data-index="${index}">
                </td>
                <td style="background: rgba(var(--primary-rgb), 0.01);">
                    <input type="text" 
                           class="sim-input-help-reason" 
                           value="${item.exceptional_help_reason || ''}" 
                           placeholder="Motif..."
                           style="width: 100%; border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 8px; font-size: 0.85rem; background: var(--bg-card); color: var(--text-main);"
                           data-index="${index}">
                </td>
                <td class="num-col final-sub-cell" style="font-weight: 700;">${finalVal}</td>
                <td style="text-align: center;">${statusSelect}</td>
                <td>
                    <button class="details-btn" data-index="${index}" title="Fiche détaillée">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12.01" y1="8" y2="12"/><line x1="12" x2="12" y1="16" y2="16"/></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Event listener for inputs (live recalculation)
        tbody.querySelectorAll('.sim-input-help').forEach(input => {
            input.addEventListener('input', handleHelpInputChange);
        });

        // Event listener for motif inputs
        tbody.querySelectorAll('.sim-input-help-reason').forEach(input => {
            input.addEventListener('input', handleHelpReasonInputChange);
        });

        // Event listener for status selects
        tbody.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', handleStatusChange);
        });

        // Event listener for detail buttons
        tbody.querySelectorAll('.details-btn').forEach(btn => {
            btn.addEventListener('click', handleDetailClick);
        });
    }

    function handleHelpReasonInputChange(e) {
        const index = parseInt(e.target.getAttribute('data-index'));
        const val = e.target.value;
        state.data[index].exceptional_help_reason = val;
        saveToLocalStorage();
    }

    // 6. Handle input change in simulator
    function handleHelpInputChange(e) {
        const index = parseInt(e.target.getAttribute('data-index'));
        let val = parseInt(e.target.value);
        if (isNaN(val)) val = 0;

        // Update state
        state.data[index].exceptional_help = val;
        state.data[index].sub_final_2026 = Math.max(0, state.data[index].proposal_maxime + val);

        // Update row visual
        const row = e.target.closest('tr');
        const finalCell = row.querySelector('.final-sub-cell');
        finalCell.textContent = formatCurrency(state.data[index].sub_final_2026);

        // Update hourly cost cell visual
        const hourlyCostCell = row.querySelector('.hourly-cost-cell');
        if (hourlyCostCell) {
            hourlyCostCell.innerHTML = formatHourlyCost(state.data[index].sub_final_2026, state.data[index].hours_2025);
        }

        // Update input styling class
        e.target.className = 'sim-input-help';
        if (val > 0) {
            e.target.classList.add('value-positive');
        } else if (val < 0) {
            e.target.classList.add('value-negative');
        }

        // Trigger updates
        updateKPIs();
        updateAllVisualizations();
        saveToLocalStorage();
    }

    // Handle status change
    function handleStatusChange(e) {
        const index = parseInt(e.target.getAttribute('data-index'));
        const newStatus = e.target.value;

        // Update state
        state.data[index].status = newStatus;

        // Update styling classes
        e.target.className = `status-select select-status-${newStatus}`;

        // Update tr attribute so filter works
        const row = e.target.closest('tr');
        if (row) {
            row.setAttribute('data-status', newStatus);
        }

        saveToLocalStorage();
        filterSimulatorTable();
    }

    // 7. Filter simulator table
    function filterSimulatorTable() {
        const tbody = document.getElementById('subventions-table-body');
        const rows = tbody.getElementsByTagName('tr');
        const query = state.searchQuery.toLowerCase().trim();
        const city = state.filterCity;
        const cat = state.filterCat;
        const status = state.filterStatus;

        for (let row of rows) {
            const rCity = row.getAttribute('data-commune');
            const rCat = row.getAttribute('data-category');
            const rName = row.getAttribute('data-name').toLowerCase();
            const rComment = row.getAttribute('data-comment').toLowerCase();
            const rStatus = row.getAttribute('data-status') || 'debat';

            const matchesCity = (city === 'all' || rCity === city);
            const matchesCat = (cat === 'all' || rCat === cat);
            const matchesStatus = (status === 'all' || rStatus === status);
            const matchesSearch = (!query || rName.includes(query) || rCity.toLowerCase().includes(query) || rComment.includes(query));

            if (matchesCity && matchesCat && matchesStatus && matchesSearch) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    }

    // 8. Render Thematics Tab
    function renderThematicsTab() {
        const city = state.themFilterCity;
        const cat = state.themFilterCat;

        // Calculate and Render City Rankings
        const citySums = {};
        const citySumsN1 = {};
        state.data.forEach(item => {
            if (!item.commune) return;
            // Respect the category filter for rankings
            if (cat === 'all' || item.category === cat) {
                citySums[item.commune] = (citySums[item.commune] || 0) + item.sub_final_2026;
                citySumsN1[item.commune] = (citySumsN1[item.commune] || 0) + item.sub_2025_acted;
            }
        });

        const rankingListEl = document.getElementById('city-ranking-list');
        rankingListEl.innerHTML = '';

        const cityArray = Object.keys(citySums).map(cityName => ({
            name: cityName,
            val: citySums[cityName],
            valN1: citySumsN1[cityName] || 0
        })).sort((a, b) => b.val - a.val);

        cityArray.forEach(cityObj => {
            const rankingItem = document.createElement('div');
            rankingItem.className = 'ranking-item';

            let evoText = '';
            if (cityObj.valN1 > 0) {
                const evo = ((cityObj.val - cityObj.valN1) / cityObj.valN1) * 100;
                evoText = ` <span class="trend-indicator ${evo > 0 ? 'positive' : 'negative'}" style="font-size: 0.7rem; padding: 1px 4px; margin-left: 6px;">${evo >= 0 ? '+' : ''}${evo.toFixed(1).replace('.', ',')}%</span>`;
            }

            rankingItem.innerHTML = `
                <span class="ranking-city">${cityObj.name}</span>
                <div>
                    <span class="ranking-val">${formatCurrency(cityObj.val)}</span>
                    ${evoText}
                </div>
            `;
            rankingListEl.appendChild(rankingItem);
        });

        // Calculate and Render City Rankings per Inhabitant
        const inhabitantRankingListEl = document.getElementById('city-inhabitant-ranking-list');
        if (inhabitantRankingListEl) {
            inhabitantRankingListEl.innerHTML = '';
            
            const inhabitantArray = Object.keys(citySums)
                .filter(cityName => CITY_POPULATIONS[cityName])
                .map(cityName => {
                    const pop = CITY_POPULATIONS[cityName];
                    const val = citySums[cityName];
                    const valN1 = citySumsN1[cityName] || 0;
                    return {
                        name: cityName,
                        pop: pop,
                        valPerHab: val / pop,
                        valPerHabN1: valN1 / pop
                    };
                })
                .sort((a, b) => b.valPerHab - a.valPerHab);

            inhabitantArray.forEach(cityObj => {
                const rankingItem = document.createElement('div');
                rankingItem.className = 'ranking-item';

                let evoText = '';
                if (cityObj.valPerHabN1 > 0) {
                    const evo = ((cityObj.valPerHab - cityObj.valPerHabN1) / cityObj.valPerHabN1) * 100;
                    evoText = ` <span class="trend-indicator ${evo > 0 ? 'positive' : 'negative'}" style="font-size: 0.7rem; padding: 1px 4px; margin-left: 6px;">${evo >= 0 ? '+' : ''}${evo.toFixed(1).replace('.', ',')}%</span>`;
                }

                rankingItem.innerHTML = `
                    <span class="ranking-city">${cityObj.name} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(${new Intl.NumberFormat('fr-FR').format(cityObj.pop)} hab.)</span></span>
                    <div>
                        <span class="ranking-val">${cityObj.valPerHab.toFixed(2).replace('.', ',')} €/hab</span>
                        ${evoText}
                    </div>
                `;
                inhabitantRankingListEl.appendChild(rankingItem);
            });
        }

        // Calculate and Render Poles Cards
        const poleSums = {};
        const poleSumsN1 = {};
        const poleRequested = {};
        const poleCounts = {};

        state.data.forEach(item => {
            const p = item.category;
            // Respect city filter for pole summary cards
            if (city === 'all' || item.commune === city) {
                poleSums[p] = (poleSums[p] || 0) + item.sub_final_2026;
                poleSumsN1[p] = (poleSumsN1[p] || 0) + item.sub_2025_acted;
                poleRequested[p] = (poleRequested[p] || 0) + (item.sub_2026_requested_activity || 0);
                poleCounts[p] = (poleCounts[p] || 0) + 1;
            }
        });

        const polesCardsGrid = document.getElementById('poles-cards-grid');
        polesCardsGrid.innerHTML = '';

        // Standard list of categories
        const categories = [...new Set(state.data.map(item => item.category))].sort();

        categories.forEach(category => {
            const sum = poleSums[category] || 0;
            const sumN1 = poleSumsN1[category] || 0;
            const req = poleRequested[category] || 0;
            const count = poleCounts[category] || 0;

            if (city !== 'all' && count === 0) return; // Skip poles with no structure for this commune

            const evo = sumN1 > 0 ? ((sum - sumN1) / sumN1) * 100 : 0;
            const evoClass = evo > 0 ? 'positive' : 'negative';
            const evoPrefix = evo > 0 ? '+' : '';

            const card = document.createElement('div');
            card.className = 'pole-card';
            card.innerHTML = `
                <h4>${category}</h4>
                <div class="pole-metric">
                    <span>Demandé 2026</span>
                    <span>${formatCurrency(req)}</span>
                </div>
                <div class="pole-metric">
                    <span>Proposition 2026</span>
                    <span>${formatCurrency(sum)}</span>
                </div>
                <div class="pole-metric">
                    <span>Écart (Demandé vs Prop.)</span>
                    <span style="font-weight: 600; color: var(--warning);">${formatCurrency(Math.max(0, req - sum))}</span>
                </div>
                <div class="pole-metric">
                    <span>Structures</span>
                    <span>${count}</span>
                </div>
            `;
            polesCardsGrid.appendChild(card);
        });
    }

    // 9. Detailed Modal Handler
    function handleDetailClick(e) {
        const btn = e.currentTarget;
        const index = parseInt(btn.getAttribute('data-index'));
        const item = state.data[index];

        if (!item) return;

        // Basic Info
        document.getElementById('m-name').textContent = getStructureName(item.name);
        document.getElementById('m-commune').textContent = item.commune || 'Intercommunal';
        document.getElementById('m-category').textContent = item.category;

        // Subvention History
        document.getElementById('m-sub-2023').textContent = formatCurrency(item.sub_2023, true);
        document.getElementById('m-sub-2024').textContent = formatCurrency(item.sub_2024, true);
        document.getElementById('m-sub-2025-acted').textContent = formatCurrency(item.sub_2025_acted, true);

        // 2026 Instruction
        document.getElementById('m-requested-2026').textContent = formatCurrency(item.sub_2026_requested_activity, true);
        document.getElementById('m-neutral-sub').textContent = formatCurrency(item.sub_neutral, true);
        document.getElementById('m-proposal-maxime').textContent = formatCurrency(item.proposal_maxime, true);

        // Comments
        const commComm = item.commission_comment || '';
        const mCommBlock = document.getElementById('m-commission-comment-block');
        mCommBlock.style.display = commComm ? '' : 'none';
        if (commComm) document.getElementById('m-commission-comment').textContent = commComm;

        const justComm = item.justification || '';
        const mJustBlock = document.getElementById('m-justification-block');
        mJustBlock.style.display = justComm ? '' : 'none';
        if (justComm) document.getElementById('m-justification').textContent = justComm;

        // User Remarks 2026
        document.getElementById('m-user-remarks').value = item.user_remarks || '';
        document.getElementById('m-global-technical-comment').value = item.global_technical_comment || '';

        // Activity Hours
        document.getElementById('m-hours-2024').textContent = formatHours(item.hours_2024, true);
        document.getElementById('m-hours-2025').textContent = formatHours(item.hours_2025, true);

        // Hours Evolution
        const hoursEvo = item.evolution_hours_24_25;
        const hoursEvoEl = document.getElementById('m-hours-evolution');
        const hoursEvoContainer = document.getElementById('m-hours-evo-container');
        if (hoursEvo !== undefined && hoursEvo !== null && hoursEvo !== '') {
            const evoVal = parseFloat(hoursEvo);
            hoursEvoEl.textContent = (evoVal >= 0 ? '+' : '') + evoVal.toFixed(2).replace('.', ',') + '%';
            hoursEvoEl.className = 'hour-val trend-indicator ' + (evoVal >= 0 ? 'positive' : 'negative');
            hoursEvoContainer.style.display = '';
        } else {
            hoursEvoContainer.style.display = 'none';
        }

        // Cost per hour collectivité (2026)
        const costVal = item.hours_2025 > 0 ? (item.sub_final_2026 / item.hours_2025) : 0;
        const mHourlyCost = document.getElementById('m-hourly-cost');
        if (item.hours_2025 > 0) {
            mHourlyCost.textContent = costVal.toFixed(2).replace('.', ',') + ' €/h';
            document.getElementById('m-hourly-cost-container').style.display = '';
        } else {
            document.getElementById('m-hourly-cost-container').style.display = 'none';
        }


        // Financial Health: Treasury
        const treasuryDays = parseInt(item.treasury_days);
        const treasuryDaysAll = parseInt(item.treasury_days_all_assets);

        document.getElementById('m-treasury-days').textContent = isNaN(treasuryDays) ? 'N/A' : `${treasuryDays} jours`;
        document.getElementById('m-treasury-assets').textContent = isNaN(treasuryDaysAll) ? 'N/A' : `${treasuryDaysAll} jours`;

        // Treasury Bar Fill - Basé uniquement sur la trésorerie avec tous les actifs circulants
        const barEl = document.getElementById('m-treasury-bar');
        if (!isNaN(treasuryDaysAll)) {
            const percentage = Math.min(100, Math.max(0, (treasuryDaysAll / 240) * 100)); // Échelle sur 240 jours
            barEl.style.width = percentage + '%';

            if (treasuryDaysAll < 60) {
                barEl.style.background = 'var(--danger)';
            } else if (treasuryDaysAll < 90) {
                barEl.style.background = 'var(--warning)';
            } else {
                barEl.style.background = 'var(--success)';
            }
        } else {
            barEl.style.width = '0%';
        }

        // Finance Table Bindings with Cost/Product conditional colors
        document.getElementById('m-charges-2025').textContent = formatCurrency(item.total_charges_2025, true);
        document.getElementById('m-charges-2026').textContent = formatCurrency(item.total_charges_2026, true);
        formatEvoCell('m-charges-evo', item.evolution_charges, true); // Cost

        document.getElementById('m-products-2025').textContent = formatCurrency(item.total_products_2025, true);
        document.getElementById('m-products-2026').textContent = formatCurrency(item.total_products_2026, true);
        formatEvoCell('m-products-evo', item.evolution_products, false); // Revenue/Product

        document.getElementById('m-staff-charges-2025').textContent = formatCurrency(item.staff_charges_2025, true);
        document.getElementById('m-staff-charges-2026').textContent = formatCurrency(item.staff_charges_2026, true);
        formatEvoCell('m-staff-charges-evo', item.evolution_staff_charges, true); // Cost

        // Net Result
        const netResult = item.result_2025;
        const resultEl = document.getElementById('m-result-2025');
        resultEl.textContent = formatCurrency(netResult, true);
        if (netResult < 0) {
            resultEl.style.color = 'var(--danger)';
        } else {
            resultEl.style.color = 'var(--success)';
        }

        // Check for multi-service structure and show cumul card
        const structureName = item.name;
        const structureCommune = item.commune;
        const matchingServices = getMatchingServices(structureName, structureCommune);

        const cumulCard = document.getElementById('m-cumul-asso-card');
        if (matchingServices.length > 1) {
            const totalCumul = matchingServices.reduce((sum, s) => sum + s.sub_final_2026, 0);
            document.getElementById('m-cumul-total-val').textContent = formatCurrency(totalCumul);
            
            const listEl = document.getElementById('m-cumul-services-list');
            listEl.innerHTML = '';
            matchingServices.forEach(s => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${getActivityDisplayName(s)} :</span> <strong>${formatCurrency(s.sub_final_2026)}</strong>`;
                listEl.appendChild(li);
            });
            cumulCard.style.display = 'block';
        } else {
            cumulCard.style.display = 'none';
        }

        // Populate Formula Note
        const formulaContentEl = document.getElementById('m-formula-content');
        if (formulaContentEl) {
            formulaContentEl.innerHTML = generateFormulaExplanation(item);
        }

        // Save current modal index for printing
        state.currentModalIndex = index;

        // Select first modal sub-tab
        const modalTabButtons = document.querySelectorAll('.modal-tab-btn');
        const modalTabContents = document.querySelectorAll('.modal-tab-content');
        modalTabButtons.forEach(b => b.classList.remove('active'));
        modalTabContents.forEach(c => c.classList.remove('active'));

        modalTabButtons[0].classList.add('active');
        document.getElementById('m-tab-budget').classList.add('active');

        // Open
        document.getElementById('detail-modal').classList.add('active');
    }

    // Helper for formatting evolution cells with colored trend indicator style
    function formatEvoCell(elementId, value, isCost = true) {
        const el = document.getElementById(elementId);
        if (value === undefined || value === null || isNaN(value) || value === '') {
            el.textContent = '0,00%';
            el.style.color = 'inherit';
            return;
        }
        const val = parseFloat(value);
        el.textContent = (val >= 0 ? '+' : '') + val.toFixed(2).replace('.', ',') + '%';

        if (val === 0) {
            el.style.color = 'inherit';
        } else if (isCost) {
            // Costs: increase is bad (red), decrease is good (green)
            el.style.color = val > 0 ? 'var(--danger)' : 'var(--success)';
        } else {
            // Revenues: increase is good (green), decrease is bad (red)
            el.style.color = val > 0 ? 'var(--success)' : 'var(--danger)';
        }
    }

    // 10. Chart.js Management

    function getThemeColors() {
        const isDark = state.theme === 'dark';
        return {
            ticks: isDark ? '#8d9bb8' : '#64748b',
            grid: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            tooltipBg: isDark ? 'rgba(13, 22, 47, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            tooltipText: isDark ? '#f1f3f9' : '#1e293b',
            primary: '#4a90e2',
            primaryStart: 'rgba(74, 144, 226, 0.8)',
            primaryEnd: 'rgba(74, 144, 226, 0.1)',
            historical: isDark ? 'rgba(74, 144, 226, 0.55)' : 'rgba(74, 144, 226, 0.6)',
            requested: '#ff9f43',
            proposed: isDark ? '#4a90e2' : '#2b7cd3'
        };
    }

    function createGradient(ctx, startColor, endColor) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, startColor);
        gradient.addColorStop(1, endColor);
        return gradient;
    }

    function initCharts() {
        const ctxHist = document.getElementById('chart-historical').getContext('2d');
        const ctxCat = document.getElementById('chart-categories').getContext('2d');
        const ctxCom = document.getElementById('chart-communes').getContext('2d');

        const colors = getThemeColors();

        // Historical Chart
        historicalChart = new Chart(ctxHist, {
            type: 'bar',
            data: {
                labels: ['2023', '2024', '2025 Acté', '2026 Proposé'],
                datasets: [
                    {
                        label: 'Proposé / Acté',
                        data: [0, 0, 0, 0],
                        backgroundColor: [
                            colors.historical,
                            colors.historical,
                            colors.historical,
                            colors.proposed
                        ],
                        borderColor: [
                            colors.primary,
                            colors.primary,
                            colors.primary,
                            colors.primary
                        ],
                        borderWidth: 1,
                        borderRadius: 6,
                        barThickness: 45
                    },
                    {
                        label: 'Demande supplémentaire',
                        data: [0, 0, 0, 0],
                        backgroundColor: colors.requested,
                        borderColor: '#ff9f43',
                        borderWidth: 1,
                        borderRadius: 6,
                        barThickness: 45
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        mode: 'index',
                        intersect: false,
                        filter: function(tooltipItem) {
                            if (tooltipItem.datasetIndex === 1 && tooltipItem.raw === 0) {
                                return false;
                            }
                            return true;
                        },
                        callbacks: {
                            label: function(context) {
                                const datasetIndex = context.datasetIndex;
                                const index = context.dataIndex;
                                const val = context.parsed.y;
                                if (index < 3) {
                                    if (datasetIndex === 0) {
                                        return ' Subvention Actée : ' + formatCurrency(val);
                                    }
                                    return null;
                                } else {
                                    if (datasetIndex === 0) {
                                        return ' Subvention Proposée : ' + formatCurrency(val);
                                    } else {
                                        const proposed = context.chart.data.datasets[0].data[3] || 0;
                                        const totalRequested = proposed + val;
                                        return [
                                            ' Demande Supplémentaire : ' + formatCurrency(val),
                                            ' Total Demandé : ' + formatCurrency(totalRequested)
                                        ];
                                    }
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { color: colors.grid },
                        ticks: { color: colors.ticks, font: { family: 'Inter' } }
                    },
                    y: {
                        stacked: true,
                        grid: { color: colors.grid },
                        ticks: {
                            color: colors.ticks,
                            font: { family: 'Inter' },
                            callback: function(value) {
                                return (value / 1000) + ' k€';
                            }
                        }
                    }
                }
            }
        });

        // Categories Doughnut Chart
        categoriesChart = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#4a90e2', // blue
                        '#00bfa5', // success teal
                        '#ff9f43', // warning orange
                        '#ff6b6b', // danger red
                        '#00bcd4', // cyan info
                        '#9c27b0'  // purple
                    ],
                    borderWidth: state.theme === 'dark' ? 2 : 1,
                    borderColor: state.theme === 'dark' ? '#172549' : '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: colors.ticks,
                            boxWidth: 12,
                            padding: 15,
                            font: { family: 'Inter', size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        callbacks: {
                            label: function(context) {
                                const sum = context.dataset.data.reduce((a, b) => a + b, 0);
                                const val = context.parsed;
                                const pct = sum > 0 ? ((val / sum) * 100).toFixed(1) : 0;
                                return ' ' + formatCurrency(val) + ' (' + pct.replace('.', ',') + '%)';
                            }
                        }
                    }
                },
                cutout: '65%',
                onClick: (e, elements) => {
                    if (elements && elements.length > 0) {
                        const elementIndex = elements[0].index;
                        const shortLabel = categoriesChart.data.labels[elementIndex];
                        const fullCat = [...new Set(state.data.map(item => item.category))].find(c => getShortCategory(c) === shortLabel);
                        if (fullCat) {
                            state.filterCat = fullCat;
                            document.getElementById('sim-filter-cat').value = fullCat;
                            filterSimulatorTable();
                            switchToSimulatorTab();
                        }
                    }
                }
            }
        });

        // Communes Chart (Horizontal Bar Chart)
        communesChart = new Chart(ctxCom, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Subvention totale (k€)',
                        data: [],
                        backgroundColor: colors.proposed,
                        borderColor: colors.proposed,
                        borderWidth: 1,
                        borderRadius: 4,
                        xAxisID: 'x'
                    },
                    {
                        label: 'Par habitant (€/hab)',
                        data: [],
                        backgroundColor: '#ff9f43',
                        borderColor: '#ff9f43',
                        borderWidth: 1,
                        borderRadius: 4,
                        xAxisID: 'x1'
                    },
                    {
                        type: 'line',
                        label: 'Moyenne (€/hab)',
                        data: [],
                        borderColor: '#ff6b6b',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        xAxisID: 'x1',
                        pointRadius: 0,
                        pointHoverRadius: 0
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: colors.ticks,
                            font: { family: 'Inter', size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        callbacks: {
                            label: function(context) {
                                const datasetIndex = context.datasetIndex;
                                const val = context.parsed.x;
                                if (datasetIndex === 0) {
                                    return ' Subvention totale : ' + formatCurrency(val);
                                } else if (datasetIndex === 1) {
                                    return ' Par habitant : ' + formatCurrency(val) + '/hab';
                                } else {
                                    return ' Moyenne territoriale : ' + val.toFixed(2).replace('.', ',') + ' €/hab';
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        position: 'bottom',
                        grid: { color: colors.grid },
                        ticks: {
                            color: colors.ticks,
                            font: { family: 'Inter' },
                            callback: function(value) {
                                return (value / 1000) + ' k€';
                            }
                        },
                        title: {
                            display: true,
                            text: 'Subvention Totale (k€)',
                            color: colors.ticks,
                            font: { family: 'Inter', weight: 'bold', size: 11 }
                        }
                    },
                    x1: {
                        position: 'top',
                        grid: { display: false },
                        ticks: {
                            color: colors.ticks,
                            font: { family: 'Inter' },
                            callback: function(value) {
                                return value + ' €/hab';
                            }
                        },
                        title: {
                            display: true,
                            text: 'Par habitant (€/hab)',
                            color: colors.ticks,
                            font: { family: 'Inter', weight: 'bold', size: 11 }
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: colors.ticks, font: { family: 'Inter', weight: 'bold' } }
                    }
                },
                onClick: (e, elements) => {
                    if (elements && elements.length > 0) {
                        const elementIndex = elements[0].index;
                        const cityName = communesChart.data.labels[elementIndex];
                        if (cityName) {
                            state.filterCity = cityName;
                            document.getElementById('sim-filter-city').value = cityName;
                            filterSimulatorTable();
                            switchToSimulatorTab();
                        }
                    }
                }
            }
        });

        // Populate initially
        updateHistoricalChart();
        updateCategoriesChart();
        updateCommunesChart();
    }

    function updateHistoricalChart() {
        if (!historicalChart) return;
        let total2023 = 0;
        let total2024 = 0;
        let total2025 = 0;
        let total2026_proposed = 0;
        let total2026_requested = 0;

        // Group to get unique historical service-level entries (prevent double-counting)
        const seen = new Set();
        state.data.forEach(item => {
            let catGroup = item.category || '';
            if (catGroup.startsWith('ALSH')) {
                catGroup = 'ALSH';
            } else if (catGroup.includes('CRÈCHE') || catGroup.includes('CRÈCHES')) {
                catGroup = 'CRECHE';
            } else if (catGroup.includes('ADOS') || catGroup.includes('JEUNESSE')) {
                catGroup = 'ADOS';
            } else if (catGroup.includes('RPE') || catGroup.includes('LUDOTHÈQUE')) {
                catGroup = 'RPE';
            }
            
            const key = `${item.name}||${item.commune}||${catGroup}`;
            if (!seen.has(key)) {
                seen.add(key);
                total2023 += item.sub_2023 || 0;
                total2024 += item.sub_2024 || 0;
                total2025 += item.sub_2025_acted || 0;
            }
            
            total2026_proposed += item.sub_final_2026 || 0;
            total2026_requested += item.sub_2026_requested_activity || 0;
        });

        const colors = getThemeColors();
        
        // Dataset 0: Proposé / Acté
        historicalChart.data.datasets[0].data = [total2023, total2024, total2025, total2026_proposed];
        historicalChart.data.datasets[0].backgroundColor = [
            colors.historical,
            colors.historical,
            colors.historical,
            colors.proposed
        ];
        historicalChart.data.datasets[0].borderColor = [
            colors.primary,
            colors.primary,
            colors.primary,
            colors.primary
        ];

        // Dataset 1: Demande supplémentaire
        const additionalDemand = Math.max(0, total2026_requested - total2026_proposed);
        historicalChart.data.datasets[1].data = [0, 0, 0, additionalDemand];
        historicalChart.data.datasets[1].backgroundColor = colors.requested;
        historicalChart.data.datasets[1].borderColor = '#ff9f43';

        historicalChart.update();
    }

    function updateCategoriesChart() {
        if (!categoriesChart) return;
        const catSums = {};
        state.data.forEach(item => {
            catSums[item.category] = (catSums[item.category] || 0) + item.sub_final_2026;
        });

        const labels = Object.keys(catSums);
        const data = labels.map(l => catSums[l]);
        const shortLabels = labels.map(getShortCategory);

        categoriesChart.data.labels = shortLabels;
        categoriesChart.data.datasets[0].data = data;
        categoriesChart.update();
    }

    function updateCommunesChart() {
        if (!communesChart) return;

        // Respect Thematic tab filter options
        const city = state.themFilterCity;
        const cat = state.themFilterCat;

        const comSums = {};
        state.data.forEach(item => {
            const matchesCity = (city === 'all' || item.commune === city);
            const matchesCat = (cat === 'all' || item.category === cat);

            if (matchesCity && matchesCat && item.commune) {
                comSums[item.commune] = (comSums[item.commune] || 0) + item.sub_final_2026;
            }
        });

        const sortedCommunes = Object.keys(comSums).sort((a, b) => comSums[b] - comSums[a]);
        const data = sortedCommunes.map(c => comSums[c]);
        
        let totalSub = 0;
        let totalPop = 0;
        const dataPerHab = sortedCommunes.map(c => {
            const pop = CITY_POPULATIONS[c];
            if (pop) {
                totalSub += comSums[c];
                totalPop += pop;
                return comSums[c] / pop;
            }
            return 0;
        });

        const avgPerHab = totalPop > 0 ? totalSub / totalPop : 0;

        // Update the average badge text
        const badgeEl = document.getElementById('communes-average-badge');
        if (badgeEl) {
            badgeEl.textContent = 'Moyenne : ' + avgPerHab.toFixed(2).replace('.', ',') + ' €/hab';
        }

        // Fill the line dataset with average values
        const avgData = Array(sortedCommunes.length).fill(avgPerHab);

        communesChart.data.labels = sortedCommunes;
        communesChart.data.datasets[0].data = data;
        communesChart.data.datasets[1].data = dataPerHab;
        communesChart.data.datasets[2].data = avgData;
        communesChart.update();
    }

    function updateAllVisualizations() {
        updateHistoricalChart();
        updateCategoriesChart();
        updateCommunesChart();
        renderThematicsTab();
    }

    // Helper to switch active tab to simulator
    function switchToSimulatorTab() {
        state.activeTab = 'tab-simulator';
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');
        
        tabButtons.forEach(b => {
            if (b.getAttribute('data-tab') === 'tab-simulator') {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
        
        tabPanels.forEach(p => {
            if (p.id === 'tab-simulator') {
                p.classList.add('active');
            } else {
                p.classList.remove('active');
            }
        });
        
        if (historicalChart) historicalChart.resize();
        if (categoriesChart) categoriesChart.resize();
        if (communesChart) communesChart.resize();
    }

    // Generate custom PDF Procès-Verbal
    function handleGeneratePV() {
        const totalProposed = state.data.reduce((sum, item) => sum + item.sub_final_2026, 0);
        const totalRequested = state.data.reduce((sum, item) => sum + (item.sub_2026_requested_activity || 0), 0);
        const total2025 = state.data.reduce((sum, item) => sum + (item.sub_2025_acted || 0), 0);
        const envelopeDelta = totalProposed - state.envelopeTarget;
        const totalSaving = totalRequested - totalProposed;

        // Get Chart images
        let histImg = '';
        let catImg = '';
        try {
            histImg = historicalChart.toDataURL('image/png');
            catImg = categoriesChart.toDataURL('image/png');
        } catch (e) {
            console.error('Error generating chart images for PV:', e);
        }

        const dateStr = new Date().toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Group data by Category/Pole
        const grouped = {};
        state.data.forEach(item => {
            if (!grouped[item.category]) {
                grouped[item.category] = [];
            }
            grouped[item.category].push(item);
        });

        let tableRowsHTML = '';
        for (const [catName, items] of Object.entries(grouped)) {
            tableRowsHTML += `
                <tr class="cat-header-row">
                    <td colspan="7" style="background: #f8fafc; font-weight: bold; color: #1e3a8a; font-size: 10pt; padding: 10px; border-top: 2px solid #cbd5e1;">
                        ${catName}
                    </td>
                </tr>
            `;
            items.forEach(item => {
                let statusBadge = '';
                if (item.status === 'valide') {
                    statusBadge = '<span class="badge badge-valide">🟢 Validé</span>';
                } else if (item.status === 'bloque') {
                    statusBadge = '<span class="badge badge-bloque">🔴 Bloqué</span>';
                } else {
                    statusBadge = '<span class="badge badge-debat">🟡 En débat</span>';
                }

                const hourlyCost = item.hours_2025 > 0 ? (item.sub_final_2026 / item.hours_2025).toFixed(2).replace('.', ',') + ' €/h' : '-';

                tableRowsHTML += `
                    <tr>
                        <td>
                            <strong>${item.name}</strong><br>
                            <span style="font-size: 8pt; color: #64748b;">${item.commune}</span>
                        </td>
                        <td style="text-align: right;">${formatCurrency(item.sub_2025_acted)}</td>
                        <td style="text-align: right;">${formatCurrency(item.sub_2026_requested_activity)}</td>
                        <td style="text-align: right; font-weight: bold; color: #1e3a8a;">${formatCurrency(item.sub_final_2026)}</td>
                        <td style="text-align: right; font-weight: 500;">${hourlyCost}</td>
                        <td style="text-align: center;">${statusBadge}</td>
                        <td>
                            <div style="font-size: 8pt; color: #475569;">
                                ${item.commission_comment || item.justification || '<span style="color: #94a3b8; font-style: italic;">Aucun commentaire</span>'}
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Le bloqueur de fenêtres pop-up empêche l\'affichage du PV. Veuillez l\'autoriser pour ce site.');
            return;
        }

        printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Procès-Verbal - Commission Subventions 2026</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap');
        body {
            font-family: 'Inter', sans-serif;
            color: #1e293b;
            margin: 40px;
            line-height: 1.5;
            background: #ffffff;
        }
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .header-logo-img {
            height: 55px;
            width: auto;
        }
        .header-title h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 16pt;
            margin: 0;
            color: #1e3a8a;
            text-transform: uppercase;
        }
        .header-title p {
            font-size: 9pt;
            color: #64748b;
            margin: 4px 0 0 0;
            font-weight: 500;
        }
        .meta-info {
            text-align: right;
            font-size: 9pt;
            color: #475569;
        }
        .meta-info strong {
            color: #1e293b;
        }
        .section-title {
            font-family: 'Outfit', sans-serif;
            font-size: 12pt;
            color: #1e3a8a;
            border-left: 4px solid #2563eb;
            padding-left: 10px;
            margin-top: 30px;
            margin-bottom: 15px;
            text-transform: uppercase;
            page-break-after: avoid;
        }
        .kpi-container {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 25px;
        }
        .kpi-card {
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
        }
        .kpi-val {
            font-family: 'Outfit', sans-serif;
            font-size: 13pt;
            font-weight: 700;
            color: #2563eb;
        }
        .kpi-val.negative {
            color: #0d9488;
        }
        .kpi-val.positive {
            color: #e11d48;
        }
        .kpi-lbl {
            font-size: 7.5pt;
            color: #64748b;
            text-transform: uppercase;
            margin-top: 4px;
            font-weight: 600;
        }
        .charts-row {
            display: grid;
            grid-template-columns: 1.2fr 0.8fr;
            gap: 20px;
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .chart-box {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 15px;
            background: #ffffff;
            text-align: center;
        }
        .chart-box h3 {
            font-size: 9pt;
            margin: 0 0 10px 0;
            color: #475569;
            text-transform: uppercase;
        }
        .chart-box img {
            max-width: 100%;
            height: auto;
            max-height: 180px;
            object-fit: contain;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5pt;
            margin-bottom: 30px;
        }
        th {
            background: #f1f5f9;
            color: #475569;
            border: 1px solid #e2e8f0;
            padding: 8px 10px;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 7.5pt;
        }
        td {
            border: 1px solid #e2e8f0;
            padding: 8px 10px;
            color: #334155;
        }
        .badge {
            font-size: 7.5pt;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 20px;
            display: inline-block;
            white-space: nowrap;
        }
        .badge-valide { background: #ccfbf1; color: #0f766e; border: 1px solid #99f6e4; }
        .badge-debat { background: #fef9c3; color: #a16207; border: 1px solid #fef08a; }
        .badge-bloque { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
        .signatures {
            margin-top: 50px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            page-break-inside: avoid;
        }
        .sig-box {
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            min-height: 140px;
            font-size: 9.5pt;
        }
        .sig-line {
            margin-top: 60px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 8px;
            font-size: 8pt;
            color: #64748b;
        }
        @media print {
            body {
                margin: 20px;
            }
            .kpi-card {
                background: #f8fafc !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .badge-valide {
                background: #ccfbf1 !important;
                color: #0f766e !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .badge-debat {
                background: #fef9c3 !important;
                color: #a16207 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .badge-bloque {
                background: #fee2e2 !important;
                color: #b91c1c !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-left">
            <img src="logo.png" class="header-logo-img" alt="Logo">
            <div class="header-title">
                <h1>Procès-Verbal d'Arbitrage</h1>
                <p>Commission Enfance Jeunesse Solidarité</p>
            </div>
        </div>
        <div class="meta-info">
            Date d'édition : <strong>${dateStr}</strong><br>
            Budget : <strong>Exercice 2026</strong>
        </div>
    </div>

    <div class="section-title">Synthèse Financière Globale</div>
    <div class="kpi-container">
        <div class="kpi-card">
            <div class="kpi-val">${formatCurrency(state.envelopeTarget)}</div>
            <div class="kpi-lbl">Enveloppe de Réf.</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-val">${formatCurrency(totalProposed)}</div>
            <div class="kpi-lbl">Total Proposé 2026</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-val ${envelopeDelta > 0 ? 'positive' : 'negative'}">
                ${envelopeDelta === 0 ? '0 €' : (envelopeDelta > 0 ? '+' : '') + formatCurrency(envelopeDelta)}
            </div>
            <div class="kpi-lbl">Écart Enveloppe</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-val">${formatCurrency(totalSaving)}</div>
            <div class="kpi-lbl">Économie Réalisée</div>
        </div>
    </div>

    <div class="charts-row">
        <div class="chart-box">
            <h3>Historique & Proposition</h3>
            ${histImg ? `<img src="${histImg}" alt="Historique">` : '<div style="height: 150px; display: flex; align-items: center; justify-content: center; color: #999;">Graphique non disponible</div>'}
        </div>
        <div class="chart-box">
            <h3>Répartition 2026 par Pôle</h3>
            ${catImg ? `<img src="${catImg}" alt="Répartition">` : '<div style="height: 150px; display: flex; align-items: center; justify-content: center; color: #999;">Graphique non disponible</div>'}
        </div>
    </div>

    <div class="section-title">Détail des Arbitrages par Pôle d'Activité</div>
    <table>
        <thead>
            <tr>
                <th>Structure / Association</th>
                <th style="width: 80px; text-align: right;">2025 Acté</th>
                <th style="width: 85px; text-align: right;">2026 Demandé</th>
                <th style="width: 85px; text-align: right;">Prop. Finale</th>
                <th style="width: 75px; text-align: right;">Coût Hor.</th>
                <th style="width: 90px; text-align: center;">Statut</th>
                <th>Justifications & Notes</th>
            </tr>
        </thead>
        <tbody>
            ${tableRowsHTML}
        </tbody>
    </table>

    <div class="signatures">
        <div class="sig-box">
            <strong>Pour la Commission d'Arbitrage</strong><br>
            <span style="font-size: 8pt; color: #64748b;">Le Président de Séance</span>
            <div class="sig-line">Signature précédée de la mention "Lu et approuvé"</div>
        </div>
        <div class="sig-box">
            <strong>Pour l'Administration / Secrétariat</strong><br>
            <span style="font-size: 8pt; color: #64748b;">Le Secrétaire de Séance</span>
            <div class="sig-line">Signature de validation des arbitrages</div>
        </div>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 300);
        }
    </script>
</body>
</html>
        `);
        printWindow.document.close();
    }

    function handleExportJSON() {
        const payload = {
            version: '2026-v4',
            timestamp: new Date().toISOString(),
            envelopeTarget: state.envelopeTarget,
            exceptionalHelp: {},
            exceptionalHelpReasons: {},
            userRemarks: {},
            globalTechnicalComments: {},
            associationStatus: {},
            commissionComments: {},
            justifications: {},
            customFormulaNotes: {},
            printSelectedStructures: [...pmSelectedStructures],
            printStructureSettings: {}
        };

        state.data.forEach(item => {
            const key = `${item.name}||${item.commune}||${item.category}`;
            const structKey = `${item.name}||${item.commune}`;
            const structNameKey = `${getStructureName(item.name)}||${item.commune}`;
            payload.exceptionalHelp[key] = item.exceptional_help;
            payload.exceptionalHelpReasons[key] = item.exceptional_help_reason || '';
            payload.userRemarks[structKey] = item.user_remarks || '';
            payload.globalTechnicalComments[structNameKey] = item.global_technical_comment || '';
            payload.associationStatus[key] = item.status || 'debat';
            payload.commissionComments[key] = item.commission_comment || '';
            payload.justifications[key] = item.justification || '';
            payload.customFormulaNotes[key] = item.custom_formula_note || '';
            
            payload.printStructureSettings[structKey] = {
                show_budget: item.print_show_budget,
                show_finance: item.print_show_finance,
                show_operating: item.print_show_operating,
                show_formula: item.print_show_formula,
                show_comments: item.print_show_comments,
                hide_kpi_acted: item.print_hide_kpi_acted,
                hide_kpi_requested: item.print_hide_kpi_requested,
                hide_hours: item.print_hide_hours,
                hide_treasury_net: item.print_hide_treasury_net,
                hide_treasury_global: item.print_hide_treasury_global,
                hide_result: item.print_hide_result
            };
        });

        const jsonString = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `simulation_subventions_2026_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function handleImportJSON(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const payload = JSON.parse(evt.target.result);
                
                if (!payload || typeof payload !== 'object') {
                    throw new Error("Format JSON invalide");
                }
                
                if (payload.envelopeTarget !== undefined) {
                    state.envelopeTarget = parseFloat(payload.envelopeTarget) || 1922061;
                }

                if (payload.printSelectedStructures) {
                    pmSelectedStructures = new Set(payload.printSelectedStructures);
                } else {
                    const uniqueKeys = [...new Set(state.data.map(item => `${item.name}||${item.commune}`))];
                    pmSelectedStructures = new Set(uniqueKeys);
                }

                state.data.forEach(item => {
                    const key = `${item.name}||${item.commune}||${item.category}`;
                    const structKey = `${item.name}||${item.commune}`;
                    
                    if (payload.exceptionalHelp && payload.exceptionalHelp[key] !== undefined) {
                        item.exceptional_help = parseFloat(payload.exceptionalHelp[key]) || 0;
                    }
                    if (payload.exceptionalHelpReasons && payload.exceptionalHelpReasons[key] !== undefined) {
                        item.exceptional_help_reason = payload.exceptionalHelpReasons[key];
                    } else {
                        item.exceptional_help_reason = '';
                    }
                    if (payload.userRemarks && payload.userRemarks[structKey] !== undefined) {
                        item.user_remarks = payload.userRemarks[structKey];
                    }
                    const structNameKey = `${getStructureName(item.name)}||${item.commune}`;
                    if (payload.globalTechnicalComments && payload.globalTechnicalComments[structNameKey] !== undefined) {
                        item.global_technical_comment = payload.globalTechnicalComments[structNameKey];
                    } else {
                        item.global_technical_comment = '';
                    }
                    if (payload.associationStatus && payload.associationStatus[key] !== undefined) {
                        item.status = payload.associationStatus[key];
                    }
                    if (payload.commissionComments && payload.commissionComments[key] !== undefined) {
                        item.commission_comment = payload.commissionComments[key];
                    }
                    if (payload.justifications && payload.justifications[key] !== undefined) {
                        item.justification = payload.justifications[key];
                    }
                    if (payload.customFormulaNotes && payload.customFormulaNotes[key] !== undefined) {
                        item.custom_formula_note = payload.customFormulaNotes[key];
                    }
                    
                    if (payload.printStructureSettings && payload.printStructureSettings[structKey]) {
                        const s = payload.printStructureSettings[structKey];
                        item.print_show_budget = s.show_budget !== undefined ? s.show_budget : true;
                        item.print_show_finance = s.show_finance !== undefined ? s.show_finance : true;
                        item.print_show_operating = s.show_operating !== undefined ? s.show_operating : true;
                        item.print_show_formula = s.show_formula !== undefined ? s.show_formula : true;
                        item.print_show_comments = s.show_comments !== undefined ? s.show_comments : true;
                        item.print_hide_kpi_acted = s.hide_kpi_acted !== undefined ? s.hide_kpi_acted : false;
                        item.print_hide_kpi_requested = s.hide_kpi_requested !== undefined ? s.hide_kpi_requested : false;
                        item.print_hide_hours = s.hide_hours !== undefined ? s.hide_hours : false;
                        item.print_hide_treasury_net = s.hide_treasury_net !== undefined ? s.hide_treasury_net : false;
                        item.print_hide_treasury_global = s.hide_treasury_global !== undefined ? s.hide_treasury_global : false;
                        item.print_hide_result = s.hide_result !== undefined ? s.hide_result : false;
                    } else {
                        item.print_show_budget = true;
                        item.print_show_finance = true;
                        item.print_show_operating = true;
                        item.print_show_formula = true;
                        item.print_show_comments = true;
                        item.print_hide_kpi_acted = false;
                        item.print_hide_kpi_requested = false;
                        item.print_hide_hours = false;
                        item.print_hide_treasury_net = false;
                        item.print_hide_treasury_global = false;
                        item.print_hide_result = false;
                    }
                    
                    item.sub_final_2026 = Math.max(0, (item.proposal_maxime || 0) + item.exceptional_help);
                });

                saveToLocalStorage();
                
                updateKPIs();
                renderSimulatorTable();
                updateAllVisualizations();
                
                alert("Simulation chargée avec succès !");
            } catch (err) {
                alert("Erreur lors de la lecture du fichier JSON : " + err.message);
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    }

    // 11. Event Listeners for Filters, Tabs & Themes
    function initSimulatorFilters() {
        const searchInput = document.getElementById('sim-search-input');
        const filterCity = document.getElementById('sim-filter-city');
        const filterCat = document.getElementById('sim-filter-cat');
        const filterStatus = document.getElementById('sim-filter-status');
        const resetBtn = document.getElementById('sim-reset-btn');
        const generatePvBtn = document.getElementById('sim-generate-pv-btn');

        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            filterSimulatorTable();
        });

        filterCity.addEventListener('change', (e) => {
            state.filterCity = e.target.value;
            filterSimulatorTable();
        });

        filterCat.addEventListener('change', (e) => {
            state.filterCat = e.target.value;
            filterSimulatorTable();
        });

        if (filterStatus) {
            filterStatus.addEventListener('change', (e) => {
                state.filterStatus = e.target.value;
                filterSimulatorTable();
            });
        }

        if (generatePvBtn) {
            generatePvBtn.addEventListener('click', handleGeneratePV);
        }

        const exportJsonBtn = document.getElementById('sim-export-json-btn');
        const triggerImportBtn = document.getElementById('sim-trigger-import-btn');
        const importFileInput = document.getElementById('sim-import-file');

        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', handleExportJSON);
        }
        if (triggerImportBtn && importFileInput) {
            triggerImportBtn.addEventListener('click', () => {
                importFileInput.click();
            });
            importFileInput.addEventListener('change', handleImportJSON);
        }

        resetBtn.addEventListener('click', () => {
            state.data.forEach(item => {
                item.exceptional_help = 0;
                item.user_remarks = '';
                item.status = 'debat';
                item.sub_final_2026 = item.proposal_maxime;
            });
            state.envelopeTarget = 1922061;
            
            // Clear localStorage
            localStorage.removeItem('exceptional_help');
            localStorage.removeItem('user_remarks');
            localStorage.removeItem('association_status');
            localStorage.removeItem('envelope_target');

            // Reset UI inputs
            document.querySelectorAll('.sim-input-help').forEach(input => {
                input.value = '';
                input.className = 'sim-input-help';
            });

            // Reset inputs
            searchInput.value = '';
            filterCity.value = 'all';
            filterCat.value = 'all';
            if (filterStatus) filterStatus.value = 'all';
            
            state.searchQuery = '';
            state.filterCity = 'all';
            state.filterCat = 'all';
            state.filterStatus = 'all';

            filterSimulatorTable();
            renderSimulatorTable(); // Re-render to clear row displays & inputs properly
            updateKPIs();
            updateAllVisualizations();
        });
    }

    function initThematicFilters() {
        const filterCity = document.getElementById('them-city-select');
        const filterCat = document.getElementById('them-cat-select');

        filterCity.addEventListener('change', (e) => {
            state.themFilterCity = e.target.value;
            renderThematicsTab();
            updateCommunesChart();
        });

        filterCat.addEventListener('change', (e) => {
            state.themFilterCat = e.target.value;
            renderThematicsTab();
            updateCommunesChart();
        });
    }

    function initTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTabId = btn.getAttribute('data-tab');
                state.activeTab = targetTabId;

                tabButtons.forEach(b => b.classList.remove('active'));
                tabPanels.forEach(p => p.classList.remove('active'));

                btn.classList.add('active');
                document.getElementById(targetTabId).classList.add('active');

                // Force layout refits for Charts when tabs switch
                if (historicalChart) historicalChart.resize();
                if (categoriesChart) categoriesChart.resize();
                if (communesChart) communesChart.resize();
            });
        });
    }

    function initModalTabs() {
        const modalTabButtons = document.querySelectorAll('.modal-tab-btn');
        const modalTabContents = document.querySelectorAll('.modal-tab-content');

        modalTabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetContentId = btn.getAttribute('data-modtab');

                modalTabButtons.forEach(b => b.classList.remove('active'));
                modalTabContents.forEach(c => c.classList.remove('active'));

                btn.classList.add('active');
                document.getElementById(targetContentId).classList.add('active');
            });
        });
    }

    function initModalClose() {
        const modal = document.getElementById('detail-modal');
        const closeBtn = document.getElementById('modal-close-btn');

        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                modal.classList.remove('active');
            }
        });
    }

    function initThemeToggle() {
        const toggleBtn = document.getElementById('theme-toggle');
        toggleBtn.addEventListener('click', () => {
            state.theme = state.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', state.theme);

            // Re-bind chart colors on theme switch
            const colors = getThemeColors();

            if (historicalChart && categoriesChart && communesChart) {
                historicalChart.options.scales.x.grid.color = colors.grid;
                historicalChart.options.scales.x.ticks.color = colors.ticks;
                historicalChart.options.scales.y.grid.color = colors.grid;
                historicalChart.options.scales.y.ticks.color = colors.ticks;
                historicalChart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
                historicalChart.options.plugins.tooltip.borderColor = colors.tooltipBorder;
                historicalChart.options.plugins.tooltip.titleColor = colors.tooltipText;
                historicalChart.options.plugins.tooltip.bodyColor = colors.tooltipText;

                categoriesChart.options.plugins.legend.labels.color = colors.ticks;
                categoriesChart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
                categoriesChart.options.plugins.tooltip.borderColor = colors.tooltipBorder;
                categoriesChart.options.plugins.tooltip.titleColor = colors.tooltipText;
                categoriesChart.options.plugins.tooltip.bodyColor = colors.tooltipText;
                categoriesChart.data.datasets[0].borderColor = state.theme === 'dark' ? '#172549' : '#ffffff';
                categoriesChart.data.datasets[0].borderWidth = state.theme === 'dark' ? 2 : 1;

                communesChart.options.scales.x.grid.color = colors.grid;
                communesChart.options.scales.x.ticks.color = colors.ticks;
                if (communesChart.options.scales.x.title) communesChart.options.scales.x.title.color = colors.ticks;
                if (communesChart.options.scales.x1) {
                    communesChart.options.scales.x1.ticks.color = colors.ticks;
                    if (communesChart.options.scales.x1.title) communesChart.options.scales.x1.title.color = colors.ticks;
                }
                communesChart.options.scales.y.ticks.color = colors.ticks;
                communesChart.options.plugins.legend.labels.color = colors.ticks;
                communesChart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
                communesChart.options.plugins.tooltip.borderColor = colors.tooltipBorder;
                communesChart.options.plugins.tooltip.titleColor = colors.tooltipText;
                communesChart.options.plugins.tooltip.bodyColor = colors.tooltipText;
                communesChart.data.datasets[0].backgroundColor = colors.proposed;
                communesChart.data.datasets[0].borderColor = colors.proposed;



                historicalChart.data.datasets[0].backgroundColor = [
                    colors.historical,
                    colors.historical,
                    colors.historical,
                    colors.proposed
                ];
                historicalChart.data.datasets[0].borderColor = [
                    colors.primary,
                    colors.primary,
                    colors.primary,
                    colors.primary
                ];
                historicalChart.data.datasets[1].backgroundColor = colors.requested;
                historicalChart.data.datasets[1].borderColor = '#ff9f43';
                historicalChart.update();
                categoriesChart.update();
                communesChart.update();
            }
        });
    }

    // 12. Print Generation and Handlers
    function generatePrintPageHTML(name, commune) {
        const services = getMatchingServices(name, commune);
        if (services.length === 0) return '';
        
        const first = services[0];
        
        // Sums
        let total2023 = 0;
        let total2024 = 0;
        let total2025 = 0;
        let totalRequested = 0;
        let totalNeutral = 0;
        let totalProposal = 0;
        let totalExceptional = 0;
        let totalFinal = 0;
        
        services.forEach(s => {
            total2023 += s.sub_2023 || 0;
            total2024 += s.sub_2024 || 0;
            total2025 += s.sub_2025_acted || 0;
            totalRequested += s.sub_2026_requested_activity || 0;
            totalNeutral += s.sub_neutral || 0;
            totalProposal += s.proposal_maxime || 0;
            totalExceptional += s.exceptional_help || 0;
            totalFinal += s.sub_final_2026 || 0;
        });
        
        const treasuryDays = first.treasury_days;
        const treasuryDaysAll = first.treasury_days_all_assets;
        const result2025 = first.result_2025;
        
        // Group distinct budgets to sum charges and products without double counting shared ALSH budgets
        const uniqueBudgets = [];
        const seenGroupKeys = new Set();
        services.forEach(s => {
            const cat = s.category;
            let key = cat;
            if (cat.startsWith('ALSH')) key = 'ALSH';
            else if (cat.includes('CRÈCHE')) key = 'CRÈCHE';
            else if (cat.includes('ADOS') || cat.includes('JEUNESSE')) key = 'JEUNESSE';
            
            if (!seenGroupKeys.has(key)) {
                seenGroupKeys.add(key);
                uniqueBudgets.push(s);
            }
        });
        
        let charges2025 = 0;
        let charges2026 = 0;
        let products2025 = 0;
        let products2026 = 0;
        let staffCharges2025 = 0;
        let staffCharges2026 = 0;
        
        uniqueBudgets.forEach(b => {
            charges2025 += b.total_charges_2025 || 0;
            charges2026 += b.total_charges_2026 || 0;
            products2025 += b.total_products_2025 || 0;
            products2026 += b.total_products_2026 || 0;
            staffCharges2025 += b.staff_charges_2025 || 0;
            staffCharges2026 += b.staff_charges_2026 || 0;
        });
        
        const evolutionCharges = charges2025 > 0 ? ((charges2026 - charges2025) / charges2025) * 100 : 0;
        const evolutionProducts = products2025 > 0 ? ((products2026 - products2025) / products2025) * 100 : 0;
        const evolutionStaff = staffCharges2025 > 0 ? ((staffCharges2026 - staffCharges2025) / staffCharges2025) * 100 : 0;
        
        const hideKpiActed = first.print_hide_kpi_acted;
        const hideKpiRequested = first.print_hide_kpi_requested;
        const hideHours = first.print_hide_hours;
        const hideTreasuryNet = first.print_hide_treasury_net;
        const hideTreasuryGlobal = first.print_hide_treasury_global;
        const hideResult = first.print_hide_result;

        let servicesRowsHTML = '';
        services.forEach(s => {
            servicesRowsHTML += `
                <tr>
                    <td><strong>${getActivityDisplayName(s)}</strong></td>
                    ${!hideHours ? `
                    <td class="num-col">${formatHours(s.hours_2024, true)}</td>
                    <td class="num-col">${formatHours(s.hours_2025, true)}</td>
                    ` : ''}
                    ${!hideKpiActed ? `<td class="num-col">${formatCurrency(s.sub_2025_acted, true)}</td>` : ''}
                    ${!hideKpiRequested ? `<td class="num-col">${formatCurrency(s.sub_2026_requested_activity, true)}</td>` : ''}
                    <td class="num-col">${formatCurrency(s.proposal_maxime, true)}</td>
                    <td class="num-col">${s.exceptional_help === 0 ? '' : formatCurrency(s.exceptional_help, true)}</td>
                    <td class="num-col" style="font-weight: bold;">${formatCurrency(s.sub_final_2026, true)}</td>
                </tr>
            `;
        });
        
        if (services.length > 1) {
            servicesRowsHTML += `
                <tr class="total-row">
                    <td><strong>TOTAL STRUCTURE</strong></td>
                    ${!hideHours ? `
                    <td class="num-col">-</td>
                    <td class="num-col">-</td>
                    ` : ''}
                    ${!hideKpiActed ? `<td class="num-col">${formatCurrency(total2025, true)}</td>` : ''}
                    ${!hideKpiRequested ? `<td class="num-col">${formatCurrency(totalRequested, true)}</td>` : ''}
                    <td class="num-col">${formatCurrency(totalProposal, true)}</td>
                    <td class="num-col">${formatCurrency(totalExceptional, true)}</td>
                    <td class="num-col">${formatCurrency(totalFinal, true)}</td>
                </tr>
            `;
        }
        
        let commentsHTML = '';
        services.forEach(s => {
            if (s.commission_comment || s.justification) {
                commentsHTML += `
                    <div class="print-comment-item">
                        <strong>Service : ${getActivityDisplayName(s)}</strong>
                        ${s.commission_comment ? `<div><strong>Commentaire Commission (Ancien Mandat) :</strong> ${s.commission_comment}</div>` : ''}
                        ${s.justification ? `<div><strong>Justification Technique :</strong> ${s.justification}</div>` : ''}
                    </div>
                `;
            }
        });

        // Add 2026 remarks to comments if present
        const userRemarks = first.user_remarks || '';
        let userRemarksHTML = '';
        if (userRemarks) {
            userRemarksHTML = `
                <div class="print-comment-item" style="margin-top: 15px; border-top: 1px dashed var(--border-card, #dddddd); padding-top: 15px;">
                    <strong>Remarques de la Commission (Mandat 2026) :</strong>
                    <p style="white-space: pre-line; margin-top: 5px; font-style: italic; color: var(--primary, #4a90e2);">${userRemarks}</p>
                </div>
            `;
        }
        
        const globalTechComment = first.global_technical_comment || '';
        let globalTechCommentHTML = '';
        if (globalTechComment) {
            globalTechCommentHTML = `
                <div class="print-comment-item" style="margin-top: 15px; border-top: 1px dashed var(--border-card, #dddddd); padding-top: 15px;">
                    <strong>Commentaire Technique Global (Instructeur) :</strong>
                    <p style="white-space: pre-line; margin-top: 5px; font-style: italic; color: #10b981;">${globalTechComment}</p>
                </div>
            `;
        }
        
        if (!commentsHTML && !userRemarksHTML && !globalTechCommentHTML) {
            commentsHTML = '<p style="color: #666; font-style: italic;">Aucun commentaire disponible.</p>';
        }
        
        const catLabel = services.length === 1 ? first.category : 'MULTI-ACTIVITÉS';
        
        const showBudget = first.print_show_budget;
        const showFinance = first.print_show_finance;
        const showOperating = first.print_show_operating;
        const showFormula = first.print_show_formula;
        const showComments = first.print_show_comments;

        const budgetSection = showBudget ? `
            <div class="print-section">
                <div class="print-kpis">
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Subvention Finale 2026</span>
                        <span class="print-kpi-value">${formatCurrency(totalFinal, true)}</span>
                    </div>
                    ${!hideKpiRequested ? `
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Demandé 2026</span>
                        <span class="print-kpi-value">${formatCurrency(totalRequested, true)}</span>
                    </div>
                    ` : ''}
                    ${!hideKpiActed ? `
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Acté 2025</span>
                        <span class="print-kpi-value">${formatCurrency(total2025, true)}</span>
                    </div>
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Évolution vs 2025</span>
                        <span class="print-kpi-value">${total2025 > 0 ? ((totalFinal - total2025) / total2025 * 100).toFixed(1).replace('.', ',') + '%' : 'N/A'}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="print-section">
                <table class="print-table">
                    <thead>
                        <tr>
                            <th>Activité / Service</th>
                            ${!hideHours ? `
                            <th class="num-col">Heures 24</th>
                            <th class="num-col">Heures 25</th>
                            ` : ''}
                            ${!hideKpiActed ? `<th class="num-col">Acté 2025</th>` : ''}
                            ${!hideKpiRequested ? `<th class="num-col">Demandé 26</th>` : ''}
                            <th class="num-col">Prop. Tech.</th>
                            <th class="num-col">Aide Excep.</th>
                            <th class="num-col">Prop. Finale</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${servicesRowsHTML}
                    </tbody>
                </table>
            </div>
        ` : '';

        const showNet = !hideTreasuryNet;
        const showGlobal = !hideTreasuryGlobal;
        const showRes = !hideResult;

        const financeSection = (showFinance && (showNet || showGlobal || showRes)) ? `
            <div class="print-section" style="page-break-inside: avoid;">
                <div class="print-card-sub" style="width: 100%;">
                    <h3>Santé Financière</h3>
                    ${showGlobal ? `<p><strong>Trésorerie globale (avec actifs circulants) :</strong> ${isNaN(treasuryDaysAll) ? 'N/A' : `${treasuryDaysAll} jours de charges`}</p>` : ''}
                    ${showNet ? `<p><strong>Trésorerie nette immédiate :</strong> ${isNaN(treasuryDays) ? 'N/A' : `${treasuryDays} jours`}</p>` : ''}
                    ${showRes ? `<p><strong>Résultat net 2025 :</strong> <span style="font-weight: bold; color: ${result2025 < 0 ? '#d32f2f' : '#00796b'}">${formatCurrency(result2025, true)}</span></p>` : ''}
                    <p class="print-disclaimer">Une trésorerie saine (avec actifs circulants) se situe entre 90 et 150 jours de charges.</p>
                </div>
            </div>
        ` : '';

        const operatingSection = showOperating ? `
            <div class="print-section" style="page-break-inside: avoid; margin-top: 10px;">
                <div class="print-card-sub" style="width: 100%;">
                    <h3>Budget de Fonctionnement (Cumulé)</h3>
                    <p><strong>Charges 2025 :</strong> ${formatCurrency(charges2025, true)} | <strong>2026 :</strong> ${formatCurrency(charges2026, true)} (${(evolutionCharges >= 0 ? '+' : '') + evolutionCharges.toFixed(1).replace('.', ',') + '%'})</p>
                    <p><strong>Recettes 2025 :</strong> ${formatCurrency(products2025, true)} | <strong>2026 :</strong> ${formatCurrency(products2026, true)} (${(evolutionProducts >= 0 ? '+' : '') + evolutionProducts.toFixed(1).replace('.', ',') + '%'})</p>
                    <p><strong>Personnel 2025 :</strong> ${formatCurrency(staffCharges2025, true)} | <strong>2026 :</strong> ${formatCurrency(staffCharges2026, true)} (${(evolutionStaff >= 0 ? '+' : '') + evolutionStaff.toFixed(1).replace('.', ',') + '%'})</p>
                </div>
            </div>
        ` : '';

        const formulaSection = showFormula ? `
            <div class="print-section" style="page-break-inside: avoid; margin-top: 10px;">
                <div class="print-card-sub" style="width: 100%;">
                    <h3>Note Explicative de Calcul (Proposition Technicien)</h3>
                    <div style="font-size: 8.5pt; line-height: 1.4; color: #334155; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 15px;">
                        ${services.map(s => `<strong>${getActivityDisplayName(s)} :</strong> ${s.custom_formula_note || getShortFormulaText(s)}`).join('<br><br>')}
                    </div>
                </div>
            </div>
        ` : '';

        const commentsSection = showComments ? `
            <div class="print-section print-comments" style="page-break-inside: avoid; margin-top: 10px;">
                <h3>Commentaires et Justifications</h3>
                ${commentsHTML}
                ${globalTechCommentHTML}
                ${userRemarksHTML}
            </div>
        ` : '';

        return `
            <div class="print-page">
                <div class="print-section">
                    <div class="print-header">
                        <div class="print-title-block">
                           <h2>Fiche Synthèse : ${name}</h2>
                           <p>Commune : ${commune || 'Intercommunal'}</p>
                        </div>
                        <div class="print-meta-right">
                           <span>Pôle : ${catLabel}</span>
                        </div>
                    </div>
                </div>
                ${budgetSection}
                <div class="print-details-grid" style="display: block;">
                    ${financeSection}
                    ${operatingSection}
                </div>
                ${formulaSection}
                ${commentsSection}
            </div>
        `;
    }

    function initPrintIndividual() {
        const printBtn = document.getElementById('modal-print-btn');
        printBtn.addEventListener('click', () => {
            const index = state.currentModalIndex;
            if (index === undefined) return;
            const item = state.data[index];
            const printContainer = document.getElementById('print-container');
            printContainer.innerHTML = generatePrintPageHTML(item.name, item.commune);
            window.print();
        });
    }

    const pmToggledSections = {
        budget: true,
        finance: true,
        operating: true,
        formula: true,
        comments: true
    };

    function openPrintManager() {
        const modal = document.getElementById('print-manager-modal');
        if (modal) {
            modal.classList.add('active');
            initPrintManagerData();
        }
    }

    function initPrintManagerData() {
        // Collect unique structures
        const uniqueKeys = new Set();
        const uniqueStructures = [];
        state.data.forEach(item => {
            const structName = getStructureName(item.name);
            const key = structName + '||' + item.commune;
            if (!uniqueKeys.has(key)) {
                uniqueKeys.add(key);
                uniqueStructures.push({ name: structName, commune: item.commune });
            }
        });
        
        uniqueStructures.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

        // Initialize pmSelectedStructures if empty (select all by default)
        if (pmSelectedStructures.size === 0) {
            uniqueStructures.forEach(s => {
                pmSelectedStructures.add(s.name + '||' + s.commune);
            });
        }

        // Render structures list in sidebar
        const listEl = document.getElementById('pm-structures-list');
        if (listEl) {
            listEl.innerHTML = '';
            
            uniqueStructures.forEach(struct => {
                const key = struct.name + '||' + struct.commune;
                const isChecked = pmSelectedStructures.has(key);
                
                const div = document.createElement('div');
                div.className = 'pm-struct-item';
                div.innerHTML = `
                    <input type="checkbox" id="pm-chk-${key.replace(/[^a-zA-Z0-9]/g, '-')}" data-key="${key}" ${isChecked ? 'checked' : ''}>
                    <label for="pm-chk-${key.replace(/[^a-zA-Z0-9]/g, '-')}" style="cursor:pointer; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${struct.name}">
                        <strong>${struct.name}</strong><br>
                        <span style="font-size:0.75rem; color:var(--text-muted);">${struct.commune || 'Intercommunal'}</span>
                    </label>
                `;
                listEl.appendChild(div);
                
                // Listen to check change
                div.querySelector('input').addEventListener('change', (e) => {
                    const structKey = e.target.getAttribute('data-key');
                    if (e.target.checked) {
                        pmSelectedStructures.add(structKey);
                    } else {
                        pmSelectedStructures.delete(structKey);
                    }
                    renderPrintManagerPreview();
                });
            });
        }

        renderPrintManagerPreview();
    }

    function renderPrintManagerPreview() {
        const previewPane = document.getElementById('pm-live-preview-content');
        if (!previewPane) return;
        previewPane.innerHTML = '';

        // Get all unique structures (selected or not)
        const uniqueKeys = new Set();
        const allStructuresList = [];
        state.data.forEach(item => {
            const structName = getStructureName(item.name);
            const key = structName + '||' + item.commune;
            if (!uniqueKeys.has(key)) {
                uniqueKeys.add(key);
                allStructuresList.push({ name: structName, commune: item.commune });
            }
        });
        allStructuresList.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

        if (allStructuresList.length === 0) {
            previewPane.innerHTML = '<div style="text-align:center; padding:50px; color:var(--text-muted); font-style:italic;">Aucune structure disponible pour la prévisualisation.</div>';
            return;
        }

        allStructuresList.forEach(struct => {
            const structKey = struct.name + '||' + struct.commune;
            const isSelected = pmSelectedStructures.has(structKey);
            const services = getMatchingServices(struct.name, struct.commune);
            const first = services[0];

            // Per-structure visibilities
            const showBudget = first.print_show_budget;
            const showFinance = first.print_show_finance;
            const showOperating = first.print_show_operating;
            const showFormula = first.print_show_formula;
            const showComments = first.print_show_comments;
            const hideKpiActed = first.print_hide_kpi_acted;
            const hideKpiRequested = first.print_hide_kpi_requested;
            const hideHours = first.print_hide_hours;
            const hideTreasuryNet = first.print_hide_treasury_net;
            const hideTreasuryGlobal = first.print_hide_treasury_global;
            const hideResult = first.print_hide_result;

            // Generate calculations
            let total2025 = 0;
            let totalRequested = 0;
            let totalProposal = 0;
            let totalExceptional = 0;
            let totalFinal = 0;
            
            services.forEach(s => {
                total2025 += s.sub_2025_acted || 0;
                totalRequested += s.sub_2026_requested_activity || 0;
                totalProposal += s.proposal_maxime || 0;
                totalExceptional += s.exceptional_help || 0;
                totalFinal += s.sub_final_2026 || 0;
            });
            
            const treasuryDays = first.treasury_days;
            const treasuryDaysAll = first.treasury_days_all_assets;
            const result2025 = first.result_2025;

            // Operating budgets
            const uniqueBudgets = [];
            const seenGroupKeys = new Set();
            services.forEach(s => {
                const cat = s.category;
                let k = cat;
                if (cat.startsWith('ALSH')) k = 'ALSH';
                else if (cat.includes('CRÈCHE')) k = 'CRÈCHE';
                else if (cat.includes('ADOS') || cat.includes('JEUNESSE')) k = 'JEUNESSE';
                if (!seenGroupKeys.has(k)) {
                    seenGroupKeys.add(k);
                    uniqueBudgets.push(s);
                }
            });
            
            let charges2025 = 0;
            let charges2026 = 0;
            let products2025 = 0;
            let products2026 = 0;
            let staffCharges2025 = 0;
            let staffCharges2026 = 0;
            
            uniqueBudgets.forEach(b => {
                charges2025 += b.total_charges_2025 || 0;
                charges2026 += b.total_charges_2026 || 0;
                products2025 += b.total_products_2025 || 0;
                products2026 += b.total_products_2026 || 0;
                staffCharges2025 += b.staff_charges_2025 || 0;
                staffCharges2026 += b.staff_charges_2026 || 0;
            });
            
            const evolutionCharges = charges2025 > 0 ? ((charges2026 - charges2025) / charges2025) * 100 : 0;
            const evolutionProducts = products2025 > 0 ? ((products2026 - products2025) / products2025) * 100 : 0;
            const evolutionStaff = staffCharges2025 > 0 ? ((staffCharges2026 - staffCharges2025) / staffCharges2025) * 100 : 0;

            // Create container for structure fiche
            const wrapper = document.createElement('div');
            wrapper.className = 'pm-fiche-preview-wrapper' + (isSelected ? '' : ' pm-disabled');
            
            // Inline controls toolbar
            const structKeyClean = structKey.replace(/[^a-zA-Z0-9]/g, '-');
            const inlineControlsHTML = `
                <div class="pm-fiche-inline-controls" style="margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="pm-inline-chk-${structKeyClean}" class="pm-inline-struct-toggle" data-key="${structKey}" ${isSelected ? 'checked' : ''}>
                        <label for="pm-inline-chk-${structKeyClean}" style="font-weight: 600; font-size: 0.85rem; cursor: pointer; color: var(--text-main);">Imprimer cette fiche</label>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                        <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Sections à inclure :</span>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; cursor: pointer; color: var(--text-main);">
                            <input type="checkbox" class="pm-inline-section-toggle" data-key="${structKey}" data-section="budget" ${showBudget ? 'checked' : ''}>
                            <span>Tableau Budget</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; cursor: pointer; color: var(--text-main);">
                            <input type="checkbox" class="pm-inline-section-toggle" data-key="${structKey}" data-section="finance" ${showFinance ? 'checked' : ''}>
                            <span>Santé Fin.</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; cursor: pointer; color: var(--text-main);">
                            <input type="checkbox" class="pm-inline-section-toggle" data-key="${structKey}" data-section="operating" ${showOperating ? 'checked' : ''}>
                            <span>Fonct.</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; cursor: pointer; color: var(--text-main);">
                            <input type="checkbox" class="pm-inline-section-toggle" data-key="${structKey}" data-section="formula" ${showFormula ? 'checked' : ''}>
                            <span>Calcul</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; cursor: pointer; color: var(--text-main);">
                            <input type="checkbox" class="pm-inline-section-toggle" data-key="${structKey}" data-section="comments" ${showComments ? 'checked' : ''}>
                            <span>Commentaires</span>
                        </label>
                    </div>
                </div>
            `;

            const subControlsHTML = `
                <div class="pm-fiche-inline-controls sub-controls" style="margin-top: -3px; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                        <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Masquer éléments :</span>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; cursor: pointer; color: var(--text-main);">
                            <input type="checkbox" class="pm-inline-hide-toggle" data-key="${structKey}" data-hide="kpi_acted" ${hideKpiActed ? 'checked' : ''}>
                            <span>Acté 2025</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; cursor: pointer; color: var(--text-main);">
                            <input type="checkbox" class="pm-inline-hide-toggle" data-key="${structKey}" data-hide="kpi_requested" ${hideKpiRequested ? 'checked' : ''}>
                            <span>Demandé 2026</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; cursor: pointer; color: var(--text-main);">
                            <input type="checkbox" class="pm-inline-hide-toggle" data-key="${structKey}" data-hide="hours" ${hideHours ? 'checked' : ''}>
                            <span>Heures d'activité</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; cursor: pointer; color: var(--text-main);">
                            <input type="checkbox" class="pm-inline-hide-toggle" data-key="${structKey}" data-hide="treasury_net" ${hideTreasuryNet ? 'checked' : ''}>
                            <span>Trésorerie nette</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; cursor: pointer; color: var(--text-main);">
                            <input type="checkbox" class="pm-inline-hide-toggle" data-key="${structKey}" data-hide="treasury_global" ${hideTreasuryGlobal ? 'checked' : ''}>
                            <span>Trésorerie globale</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; cursor: pointer; color: var(--text-main);">
                            <input type="checkbox" class="pm-inline-hide-toggle" data-key="${structKey}" data-hide="result" ${hideResult ? 'checked' : ''}>
                            <span>Résultat net</span>
                        </label>
                    </div>
                </div>
            `;

            // 1. Header
            let headerHTML = `
                <div class="pm-fiche-header">
                    <div class="pm-fiche-title">
                        <h3>Fiche Synthèse : ${struct.name}</h3>
                        <p>Commune : ${struct.commune || 'Intercommunal'}</p>
                    </div>
                    <span style="font-size:0.75rem; text-transform:uppercase; background:rgba(var(--primary-rgb),0.15); color:var(--primary); padding:3px 8px; border-radius:4px; font-weight:700;">
                        ${services.length === 1 ? getShortCategory(first.category) : 'Multi-activités'}
                    </span>
                </div>
            `;

            // 2. KPIs
            let kpisHTML = '';
            if (showBudget) {
                kpisHTML = `
                    <div class="pm-fiche-kpis">
                        <div class="pm-fiche-kpi-card">
                            <span class="pm-fiche-kpi-label">Proposé 2026</span>
                            <span class="pm-fiche-kpi-value">${formatCurrency(totalFinal)}</span>
                        </div>
                        ${!hideKpiRequested ? `
                        <div class="pm-fiche-kpi-card">
                            <span class="pm-fiche-kpi-label">Demandé 2026</span>
                            <span class="pm-fiche-kpi-value">${formatCurrency(totalRequested)}</span>
                        </div>
                        ` : ''}
                        ${!hideKpiActed ? `
                        <div class="pm-fiche-kpi-card">
                            <span class="pm-fiche-kpi-label">Acté 2025</span>
                            <span class="pm-fiche-kpi-value">${formatCurrency(total2025)}</span>
                        </div>
                        <div class="pm-fiche-kpi-card">
                            <span class="pm-fiche-kpi-label">Évolution vs 2025</span>
                            <span class="pm-fiche-kpi-value">${total2025 > 0 ? ((totalFinal - total2025) / total2025 * 100).toFixed(1).replace('.', ',') + '%' : 'N/A'}</span>
                        </div>
                        ` : ''}
                    </div>
                `;
            }

            // 3. Table
            let tableHTML = '';
            if (showBudget) {
                let rows = '';
                services.forEach(s => {
                    rows += `
                        <tr>
                            <td><strong>${getActivityDisplayName(s)}</strong></td>
                            ${!hideHours ? `
                            <td class="num-col">${formatHours(s.hours_2024, true)}</td>
                            <td class="num-col">${formatHours(s.hours_2025, true)}</td>
                            ` : ''}
                            ${!hideKpiActed ? `<td class="num-col">${formatCurrency(s.sub_2025_acted, true)}</td>` : ''}
                            ${!hideKpiRequested ? `<td class="num-col">${formatCurrency(s.sub_2026_requested_activity, true)}</td>` : ''}
                            <td class="num-col">${formatCurrency(s.proposal_maxime, true)}</td>
                            <td class="num-col">${s.exceptional_help === 0 ? '' : formatCurrency(s.exceptional_help, true)}</td>
                            <td class="num-col" style="font-weight:bold;">${formatCurrency(s.sub_final_2026, true)}</td>
                        </tr>
                    `;
                });
                
                if (services.length > 1) {
                    rows += `
                        <tr class="total-row">
                            <td><strong>TOTAL STRUCTURE</strong></td>
                            ${!hideHours ? `
                            <td class="num-col">-</td>
                            <td class="num-col">-</td>
                            ` : ''}
                            ${!hideKpiActed ? `<td class="num-col">${formatCurrency(total2025, true)}</td>` : ''}
                            ${!hideKpiRequested ? `<td class="num-col">${formatCurrency(totalRequested, true)}</td>` : ''}
                            <td class="num-col">${formatCurrency(totalProposal, true)}</td>
                            <td class="num-col">${formatCurrency(totalExceptional, true)}</td>
                            <td class="num-col">${formatCurrency(totalFinal, true)}</td>
                        </tr>
                    `;
                }

                tableHTML = `
                    <table class="pm-fiche-table">
                        <thead>
                            <tr>
                                <th>Service</th>
                                ${!hideHours ? `
                                <th class="num-col">Heures 24</th>
                                <th class="num-col">Heures 25</th>
                                ` : ''}
                                ${!hideKpiActed ? `<th class="num-col">Acté 2025</th>` : ''}
                                ${!hideKpiRequested ? `<th class="num-col">Demandé 26</th>` : ''}
                                <th class="num-col">Prop. Tech.</th>
                                <th class="num-col">Aide Excep.</th>
                                <th class="num-col">Prop. Finale</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                `;
            }

            // 4. Financial Health
            let financeHTML = '';
            if (showFinance) {
                const showNet = !hideTreasuryNet;
                const showGlobal = !hideTreasuryGlobal;
                const showRes = !hideResult;
                
                if (showNet || showGlobal || showRes) {
                    financeHTML = `
                        <div class="pm-fiche-section-card">
                            <h4>Santé Financière</h4>
                            <div style="display:flex; justify-content:space-between; gap:20px; font-size:0.85rem; color:var(--text-main); flex-wrap: wrap;">
                                ${showGlobal ? `<div><strong>Trésorerie globale (actifs circulants) :</strong> ${isNaN(treasuryDaysAll) ? 'N/A' : `${treasuryDaysAll} jours`}</div>` : ''}
                                ${showNet ? `<div><strong>Trésorerie nette immédiate :</strong> ${isNaN(treasuryDays) ? 'N/A' : `${treasuryDays} jours`}</div>` : ''}
                                ${showRes ? `<div><strong>Résultat net 2025 :</strong> <span style="font-weight:bold; color:${result2025 < 0 ? 'var(--danger)' : 'var(--success)'};">${formatCurrency(result2025)}</span></div>` : ''}
                            </div>
                        </div>
                    `;
                }
            }

            // 5. Operating budget
            let operatingHTML = '';
            if (showOperating) {
                operatingHTML = `
                    <div class="pm-fiche-section-card">
                        <h4>Budget de Fonctionnement (Cumulé)</h4>
                        <div style="display:flex; flex-direction:column; gap:4px; font-size:0.82rem; color:var(--text-main);">
                            <div>• <strong>Charges 2025 :</strong> ${formatCurrency(charges2025)} | <strong>2026 :</strong> ${formatCurrency(charges2026)} (${formatPercent(evolutionCharges)})</div>
                            <div>• <strong>Recettes 2025 :</strong> ${formatCurrency(products2025)} | <strong>2026 :</strong> ${formatCurrency(products2026)} (${formatPercent(evolutionProducts)})</div>
                            <div>• <strong>Personnel 2025 :</strong> ${formatCurrency(staffCharges2025)} | <strong>2026 :</strong> ${formatCurrency(staffCharges2026)} (${formatPercent(evolutionStaff)})</div>
                        </div>
                    </div>
                `;
            }

            // 6. Formula Explications (EDITABLE)
            let formulaHTML = '';
            if (showFormula) {
                const innerNotes = services.map(s => {
                    const savedText = s.custom_formula_note || getShortFormulaText(s);
                    return `
                        <div style="margin-bottom:8px;">
                            <strong>${getActivityDisplayName(s)} :</strong>
                            <textarea class="pm-editable-text" 
                                      data-name="${s.name}" 
                                      data-commune="${s.commune}" 
                                      data-category="${s.category}"
                                      data-field="custom_formula_note"
                                      rows="3">${savedText}</textarea>
                        </div>
                    `;
                }).join('');

                formulaHTML = `
                    <div class="pm-fiche-section-card">
                        <h4>Note de Calcul de la Proposition (Modifiable)</h4>
                        ${innerNotes}
                    </div>
                `;
            }

            // 7. Comments & Remarks (EDITABLE)
            let commentsHTML = '';
            if (showComments) {
                const remarksText = first.user_remarks || '';
                const globalTechCommentText = first.global_technical_comment || '';
                
                const commentsRows = services.map(s => {
                    return `
                        <div style="margin-bottom:12px; display:grid; grid-template-columns:1fr 1fr; gap:15px; color:var(--text-main);">
                            <div>
                                <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted);">Commentaire Mandat Précédent (2025) - ${getActivityDisplayName(s)}</span>
                                <textarea class="pm-editable-text" 
                                          data-name="${s.name}" 
                                          data-commune="${s.commune}" 
                                          data-category="${s.category}"
                                          data-field="commission_comment"
                                          rows="2">${s.commission_comment || ''}</textarea>
                            </div>
                            <div>
                                <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted);">Justification Technique - ${getActivityDisplayName(s)}</span>
                                <textarea class="pm-editable-text" 
                                          data-name="${s.name}" 
                                          data-commune="${s.commune}" 
                                          data-category="${s.category}"
                                          data-field="justification"
                                          rows="2">${s.justification || ''}</textarea>
                            </div>
                        </div>
                    `;
                }).join('');

                commentsHTML = `
                    <div class="pm-fiche-section-card">
                        <h4>Commentaires, Justifications & Notes de Séance</h4>
                        ${commentsRows}
                        <div style="margin-top:10px;">
                            <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Commentaire Technique Global (Instructeur - Commun pour la structure)</span>
                            <textarea class="pm-editable-text" 
                                      data-name="${struct.name}" 
                                      data-commune="${struct.commune}" 
                                      data-field="global_technical_comment"
                                      rows="3"
                                      placeholder="Saisir l'analyse technique globale de la structure...">${globalTechCommentText}</textarea>
                        </div>
                        <div style="margin-top:10px;">
                            <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Remarques de la Commission (Mandat 2026 - Commun pour la structure)</span>
                            <textarea class="pm-editable-text" 
                                      data-name="${struct.name}" 
                                      data-commune="${struct.commune}" 
                                      data-field="user_remarks"
                                      rows="3"
                                      placeholder="Saisir vos remarques ou notes pour ce mandat...">${remarksText}</textarea>
                        </div>
                    </div>
                `;
            }

            wrapper.innerHTML = `
                ${inlineControlsHTML}
                ${subControlsHTML}
                ${headerHTML}
                ${kpisHTML}
                ${tableHTML}
                ${financeHTML}
                ${operatingHTML}
                ${formulaHTML}
                ${commentsHTML}
            `;
            
            previewPane.appendChild(wrapper);
        });

        // Register edit handlers for textareas
        previewPane.querySelectorAll('.pm-editable-text').forEach(textarea => {
            textarea.addEventListener('input', handlePreviewFieldChange);
        });

        // Register structure select toggles
        previewPane.querySelectorAll('.pm-inline-struct-toggle').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const key = e.target.getAttribute('data-key');
                const checked = e.target.checked;
                
                if (checked) {
                    pmSelectedStructures.add(key);
                } else {
                    pmSelectedStructures.delete(key);
                }
                
                // Save to localStorage
                saveToLocalStorage();
                
                // Sync the sidebar checkbox
                const sidebarChk = document.getElementById(`pm-chk-${key.replace(/[^a-zA-Z0-9]/g, '-')}`);
                if (sidebarChk) sidebarChk.checked = checked;
                
                // Toggle pm-disabled class on wrapper
                const card = e.target.closest('.pm-fiche-preview-wrapper');
                if (card) {
                    if (checked) {
                        card.classList.remove('pm-disabled');
                    } else {
                        card.classList.add('pm-disabled');
                    }
                }
            });
        });

        // Register section visibility toggles
        previewPane.querySelectorAll('.pm-inline-section-toggle').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const key = e.target.getAttribute('data-key');
                const section = e.target.getAttribute('data-section');
                const checked = e.target.checked;
                
                state.data.forEach(item => {
                    const itemKey = `${getStructureName(item.name)}||${item.commune}`;
                    if (itemKey === key) {
                        if (section === 'budget') item.print_show_budget = checked;
                        else if (section === 'finance') item.print_show_finance = checked;
                        else if (section === 'operating') item.print_show_operating = checked;
                        else if (section === 'formula') item.print_show_formula = checked;
                        else if (section === 'comments') item.print_show_comments = checked;
                    }
                });
                
                saveToLocalStorage();
                renderPrintManagerPreview();
            });
        });

        // Register hide element toggles
        previewPane.querySelectorAll('.pm-inline-hide-toggle').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const key = e.target.getAttribute('data-key');
                const hideField = e.target.getAttribute('data-hide');
                const checked = e.target.checked;
                
                state.data.forEach(item => {
                    const itemKey = `${getStructureName(item.name)}||${item.commune}`;
                    if (itemKey === key) {
                        if (hideField === 'kpi_acted') item.print_hide_kpi_acted = checked;
                        else if (hideField === 'kpi_requested') item.print_hide_kpi_requested = checked;
                        else if (hideField === 'hours') item.print_hide_hours = checked;
                        else if (hideField === 'treasury_net') item.print_hide_treasury_net = checked;
                        else if (hideField === 'treasury_global') item.print_hide_treasury_global = checked;
                        else if (hideField === 'result') item.print_hide_result = checked;
                    }
                });
                
                saveToLocalStorage();
                renderPrintManagerPreview();
            });
        });
    }


    function handlePreviewFieldChange(e) {
        const name = e.target.getAttribute('data-name');
        const commune = e.target.getAttribute('data-commune');
        const cat = e.target.getAttribute('data-category');
        const field = e.target.getAttribute('data-field');
        const val = e.target.value;

        state.data.forEach(item => {
            if (field === 'user_remarks') {
                if (getStructureName(item.name) === getStructureName(name) && item.commune === commune) {
                    item.user_remarks = val;
                }
            } else if (field === 'global_technical_comment') {
                if (getStructureName(item.name) === getStructureName(name) && item.commune === commune) {
                    item.global_technical_comment = val;
                }
            } else {
                if (item.name === name && item.commune === commune && item.category === cat) {
                    item[field] = val;
                }
            }
        });

        saveToLocalStorage();
        
        // Synchronize table
        renderSimulatorTable();
    }

    function generatePrintContainerFromManager() {
        const printContainer = document.getElementById('print-container');
        if (!printContainer) return;
        printContainer.innerHTML = '';

        const uniqueKeys = new Set();
        const selectedList = [];
        state.data.forEach(item => {
            const structName = getStructureName(item.name);
            const key = structName + '||' + item.commune;
            if (pmSelectedStructures.has(key) && !uniqueKeys.has(key)) {
                uniqueKeys.add(key);
                selectedList.push({ name: structName, commune: item.commune });
            }
        });
        selectedList.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

        let combinedHTML = '';
        selectedList.forEach(struct => {
            combinedHTML += generatePrintFicheHTMLForPrintJob(struct.name, struct.commune);
        });

        printContainer.innerHTML = combinedHTML;
    }

    function generatePrintFicheHTMLForPrintJob(name, commune) {
        const services = getMatchingServices(name, commune);
        if (services.length === 0) return '';
        
        const first = services[0];
        
        // Sums
        let total2025 = 0;
        let totalRequested = 0;
        let totalProposal = 0;
        let totalExceptional = 0;
        let totalFinal = 0;
        
        services.forEach(s => {
            total2025 += s.sub_2025_acted || 0;
            totalRequested += s.sub_2026_requested_activity || 0;
            totalProposal += s.proposal_maxime || 0;
            totalExceptional += s.exceptional_help || 0;
            totalFinal += s.sub_final_2026 || 0;
        });
        
        const treasuryDays = first.treasury_days;
        const treasuryDaysAll = first.treasury_days_all_assets;
        const result2025 = first.result_2025;
        
        const uniqueBudgets = [];
        const seenGroupKeys = new Set();
        services.forEach(s => {
            const cat = s.category;
            let key = cat;
            if (cat.startsWith('ALSH')) key = 'ALSH';
            else if (cat.includes('CRÈCHE')) key = 'CRÈCHE';
            else if (cat.includes('ADOS') || cat.includes('JEUNESSE')) key = 'JEUNESSE';
            
            if (!seenGroupKeys.has(key)) {
                seenGroupKeys.add(key);
                uniqueBudgets.push(s);
            }
        });
        
        let charges2025 = 0;
        let charges2026 = 0;
        let products2025 = 0;
        let products2026 = 0;
        let staffCharges2025 = 0;
        let staffCharges2026 = 0;
        
        uniqueBudgets.forEach(b => {
            charges2025 += b.total_charges_2025 || 0;
            charges2026 += b.total_charges_2026 || 0;
            products2025 += b.total_products_2025 || 0;
            products2026 += b.total_products_2026 || 0;
            staffCharges2025 += b.staff_charges_2025 || 0;
            staffCharges2026 += b.staff_charges_2026 || 0;
        });
        
        const evolutionCharges = charges2025 > 0 ? ((charges2026 - charges2025) / charges2025) * 100 : 0;
        const evolutionProducts = products2025 > 0 ? ((products2026 - products2025) / products2025) * 100 : 0;
        const evolutionStaff = staffCharges2025 > 0 ? ((staffCharges2026 - staffCharges2025) / staffCharges2025) * 100 : 0;
        
        const hideKpiActed = first.print_hide_kpi_acted;
        const hideKpiRequested = first.print_hide_kpi_requested;
        const hideHours = first.print_hide_hours;
        const hideTreasuryNet = first.print_hide_treasury_net;
        const hideTreasuryGlobal = first.print_hide_treasury_global;
        const hideResult = first.print_hide_result;

        let servicesRowsHTML = '';
        services.forEach(s => {
            servicesRowsHTML += `
                <tr>
                    <td><strong>${getActivityDisplayName(s)}</strong></td>
                    ${!hideHours ? `
                    <td class="num-col">${formatHours(s.hours_2024, true)}</td>
                    <td class="num-col">${formatHours(s.hours_2025, true)}</td>
                    ` : ''}
                    ${!hideKpiActed ? `<td class="num-col">${formatCurrency(s.sub_2025_acted, true)}</td>` : ''}
                    ${!hideKpiRequested ? `<td class="num-col">${formatCurrency(s.sub_2026_requested_activity, true)}</td>` : ''}
                    <td class="num-col">${formatCurrency(s.proposal_maxime, true)}</td>
                    <td class="num-col">${s.exceptional_help === 0 ? '' : formatCurrency(s.exceptional_help, true)}</td>
                    <td class="num-col" style="font-weight: bold;">${formatCurrency(s.sub_final_2026, true)}</td>
                </tr>
            `;
        });
        
        if (services.length > 1) {
            servicesRowsHTML += `
                <tr class="total-row">
                    <td><strong>TOTAL STRUCTURE</strong></td>
                    ${!hideHours ? `
                    <td class="num-col">-</td>
                    <td class="num-col">-</td>
                    ` : ''}
                    ${!hideKpiActed ? `<td class="num-col">${formatCurrency(total2025, true)}</td>` : ''}
                    ${!hideKpiRequested ? `<td class="num-col">${formatCurrency(totalRequested, true)}</td>` : ''}
                    <td class="num-col">${formatCurrency(totalProposal, true)}</td>
                    <td class="num-col">${formatCurrency(totalExceptional, true)}</td>
                    <td class="num-col">${formatCurrency(totalFinal, true)}</td>
                </tr>
            `;
        }
        
        let commentsHTML = '';
        services.forEach(s => {
            if (s.commission_comment || s.justification) {
                commentsHTML += `
                    <div class="print-comment-item">
                        <strong>Service : ${getActivityDisplayName(s)}</strong>
                        ${s.commission_comment ? `<div><strong>Commentaire Mandat Précédent (2025) :</strong> ${s.commission_comment}</div>` : ''}
                        ${s.justification ? `<div><strong>Justification Technique :</strong> ${s.justification}</div>` : ''}
                    </div>
                `;
            }
        });

        const userRemarks = first.user_remarks || '';
        let userRemarksHTML = '';
        if (userRemarks) {
            userRemarksHTML = `
                <div class="print-comment-item" style="margin-top: 15px; border-top: 1px dashed #dddddd; padding-top: 15px;">
                    <strong>Remarques de la Commission (Mandat 2026) :</strong>
                    <p style="white-space: pre-line; margin-top: 5px; font-style: italic; color: #1e3a8a;">${userRemarks}</p>
                </div>
            `;
        }
        
        const globalTechComment = first.global_technical_comment || '';
        let globalTechCommentHTML = '';
        if (globalTechComment) {
            globalTechCommentHTML = `
                <div class="print-comment-item" style="margin-top: 15px; border-top: 1px dashed #dddddd; padding-top: 15px;">
                    <strong>Commentaire Technique Global (Instructeur) :</strong>
                    <p style="white-space: pre-line; margin-top: 5px; font-style: italic; color: #10b981;">${globalTechComment}</p>
                </div>
            `;
        }
        
        if (!commentsHTML && !userRemarksHTML && !globalTechCommentHTML) {
            commentsHTML = '<p style="color: #666; font-style: italic;">Aucun commentaire disponible.</p>';
        }
        
        const catLabel = services.length === 1 ? first.category : 'MULTI-ACTIVITÉS';
        
        const budgetSection = first.print_show_budget ? `
            <div class="print-section">
                <div class="print-kpis">
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Subvention Finale 2026</span>
                        <span class="print-kpi-value">${formatCurrency(totalFinal, true)}</span>
                    </div>
                    ${!hideKpiRequested ? `
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Demandé 2026</span>
                        <span class="print-kpi-value">${formatCurrency(totalRequested, true)}</span>
                    </div>
                    ` : ''}
                    ${!hideKpiActed ? `
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Acté 2025</span>
                        <span class="print-kpi-value">${formatCurrency(total2025, true)}</span>
                    </div>
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Évolution vs 2025</span>
                        <span class="print-kpi-value">${total2025 > 0 ? ((totalFinal - total2025) / total2025 * 100).toFixed(1).replace('.', ',') + '%' : 'N/A'}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="print-section">
                <table class="print-table">
                    <thead>
                        <tr>
                            <th>Activité / Service</th>
                            ${!hideHours ? `
                            <th class="num-col">Heures 24</th>
                            <th class="num-col">Heures 25</th>
                            ` : ''}
                            ${!hideKpiActed ? `<th class="num-col">Acté 2025</th>` : ''}
                            ${!hideKpiRequested ? `<th class="num-col">Demandé 26</th>` : ''}
                            <th class="num-col">Prop. Tech.</th>
                            <th class="num-col">Aide Excep.</th>
                            <th class="num-col">Prop. Finale</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${servicesRowsHTML}
                    </tbody>
                </table>
            </div>
        ` : '';

        const showNet = !hideTreasuryNet;
        const showGlobal = !hideTreasuryGlobal;
        const showRes = !hideResult;

        const financeSection = (first.print_show_finance && (showNet || showGlobal || showRes)) ? `
            <div class="print-section" style="page-break-inside: avoid;">
                <div class="print-card-sub" style="width: 100%;">
                    <h3>Santé Financière</h3>
                    ${showGlobal ? `<p><strong>Trésorerie globale (avec actifs circulants) :</strong> ${isNaN(treasuryDaysAll) ? 'N/A' : `${treasuryDaysAll} jours de charges`}</p>` : ''}
                    ${showNet ? `<p><strong>Trésorerie nette immédiate :</strong> ${isNaN(treasuryDays) ? 'N/A' : `${treasuryDays} jours`}</p>` : ''}
                    ${showRes ? `<p><strong>Résultat net 2025 :</strong> <span style="font-weight: bold; color: ${result2025 < 0 ? '#d32f2f' : '#00796b'}">${formatCurrency(result2025, true)}</span></p>` : ''}
                    <p class="print-disclaimer">Une trésorerie saine (avec actifs circulants) se situe entre 90 et 150 jours de charges.</p>
                </div>
            </div>
        ` : '';

        const operatingSection = first.print_show_operating ? `
            <div class="print-section" style="page-break-inside: avoid; margin-top: 10px;">
                <div class="print-card-sub" style="width: 100%;">
                    <h3>Budget de Fonctionnement (Cumulé)</h3>
                    <p><strong>Charges 2025 :</strong> ${formatCurrency(charges2025, true)} | <strong>2026 :</strong> ${formatCurrency(charges2026, true)} (${(evolutionCharges >= 0 ? '+' : '') + evolutionCharges.toFixed(1).replace('.', ',') + '%'})</p>
                    <p><strong>Recettes 2025 :</strong> ${formatCurrency(products2025, true)} | <strong>2026 :</strong> ${formatCurrency(products2026, true)} (${(evolutionProducts >= 0 ? '+' : '') + evolutionProducts.toFixed(1).replace('.', ',') + '%'})</p>
                    <p><strong>Personnel 2025 :</strong> ${formatCurrency(staffCharges2025, true)} | <strong>2026 :</strong> ${formatCurrency(staffCharges2026, true)} (${(evolutionStaff >= 0 ? '+' : '') + evolutionStaff.toFixed(1).replace('.', ',') + '%'})</p>
                </div>
            </div>
        ` : '';

        const formulaSection = first.print_show_formula ? `
            <div class="print-section" style="page-break-inside: avoid; margin-top: 10px;">
                <div class="print-card-sub" style="width: 100%;">
                    <h3>Note Explicative de Calcul (Proposition Technicien)</h3>
                    <div style="font-size: 8.5pt; line-height: 1.4; color: #334155;">
                        ${services.map(s => `<strong>${getActivityDisplayName(s)} :</strong> ${s.custom_formula_note || getShortFormulaText(s)}`).join('<br><br>')}
                    </div>
                </div>
            </div>
        ` : '';

        const commentsSection = first.print_show_comments ? `
            <div class="print-section print-comments" style="page-break-inside: avoid; margin-top: 10px;">
                <h3>Commentaires et Justifications</h3>
                ${commentsHTML}
                ${globalTechCommentHTML}
                ${userRemarksHTML}
            </div>
        ` : '';

        return `
            <div class="print-page">
                <div class="print-section">
                    <div class="print-header">
                        <div class="print-title-block">
                           <h2>Fiche Synthèse : ${name}</h2>
                           <p>Commune : ${commune || 'Intercommunal'}</p>
                        </div>
                        <div class="print-meta-right">
                           <span>Pôle : ${catLabel}</span>
                        </div>
                    </div>
                </div>
                ${budgetSection}
                <div class="print-details-grid" style="display: block;">
                    ${financeSection}
                    ${operatingSection}
                </div>
                ${formulaSection}
                ${commentsSection}
            </div>
        `;
    }

    function initPrintManagerControls() {
        // Section checkmarks (bulk updates for all fiches)
        document.getElementById('pm-toggle-budget').addEventListener('change', (e) => {
            state.data.forEach(item => {
                item.print_show_budget = e.target.checked;
            });
            saveToLocalStorage();
            renderPrintManagerPreview();
        });
        document.getElementById('pm-toggle-finance').addEventListener('change', (e) => {
            state.data.forEach(item => {
                item.print_show_finance = e.target.checked;
            });
            saveToLocalStorage();
            renderPrintManagerPreview();
        });
        document.getElementById('pm-toggle-operating').addEventListener('change', (e) => {
            state.data.forEach(item => {
                item.print_show_operating = e.target.checked;
            });
            saveToLocalStorage();
            renderPrintManagerPreview();
        });
        document.getElementById('pm-toggle-formula').addEventListener('change', (e) => {
            state.data.forEach(item => {
                item.print_show_formula = e.target.checked;
            });
            saveToLocalStorage();
            renderPrintManagerPreview();
        });
        document.getElementById('pm-toggle-comments').addEventListener('change', (e) => {
            state.data.forEach(item => {
                item.print_show_comments = e.target.checked;
            });
            saveToLocalStorage();
            renderPrintManagerPreview();
        });

        // Global select/deselect buttons
        document.getElementById('pm-select-all-btn').addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#pm-structures-list input');
            checkboxes.forEach(chk => {
                chk.checked = true;
                pmSelectedStructures.add(chk.getAttribute('data-key'));
            });
            renderPrintManagerPreview();
        });

        document.getElementById('pm-deselect-all-btn').addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#pm-structures-list input');
            checkboxes.forEach(chk => {
                chk.checked = false;
                pmSelectedStructures.delete(chk.getAttribute('data-key'));
            });
            renderPrintManagerPreview();
        });

        // Print trigger
        document.getElementById('pm-print-now-btn').addEventListener('click', () => {
            generatePrintContainerFromManager();
            window.print();
        });
    }

    function initPrintAll() {
        const printAllBtn = document.getElementById('sim-print-all-btn');
        if (printAllBtn) {
            printAllBtn.addEventListener('click', openPrintManager);
        }
        
        // Print manager close button
        const closeBtn = document.getElementById('print-manager-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('print-manager-modal').classList.remove('active');
            });
        }
        
        // Register other print manager controls
        initPrintManagerControls();
    }
    function initEnvelopeInputs() {
        const dashboardInput = document.getElementById('input-envelope-target');
        const simulatorInput = document.getElementById('sim-envelope-target');

        function handleEnvelopeChange(val) {
            let target = parseFloat(val);
            if (isNaN(target) || target < 0) target = 0;
            state.envelopeTarget = target;
            
            saveToLocalStorage();
            updateKPIs();
            updateAllVisualizations();
        }

        dashboardInput.addEventListener('input', (e) => {
            handleEnvelopeChange(e.target.value);
        });
        simulatorInput.addEventListener('input', (e) => {
            handleEnvelopeChange(e.target.value);
        });
    }

    function initModalRemarks() {
        const textarea = document.getElementById('m-user-remarks');
        textarea.addEventListener('input', (e) => {
            const index = state.currentModalIndex;
            if (index === undefined) return;
            const currentItem = state.data[index];
            const text = e.target.value;
            
            // Update remarks for all rows of the same structure
            state.data.forEach(item => {
                if (getStructureName(item.name) === getStructureName(currentItem.name) && item.commune === currentItem.commune) {
                    item.user_remarks = text;
                }
            });
            
            saveToLocalStorage();
        });

        const globalTechTextarea = document.getElementById('m-global-technical-comment');
        if (globalTechTextarea) {
            globalTechTextarea.addEventListener('input', (e) => {
                const index = state.currentModalIndex;
                if (index === undefined) return;
                const currentItem = state.data[index];
                const text = e.target.value;
                
                // Update global technical comments for all rows of the same structure
                state.data.forEach(item => {
                    if (getStructureName(item.name) === getStructureName(currentItem.name) && item.commune === currentItem.commune) {
                        item.global_technical_comment = text;
                    }
                });
                
                saveToLocalStorage();
            });
        }
    }

    function initCommunesChartToggle() {
        const toggleCheckbox = document.getElementById('toggle-communes-chart');
        const chartContainer = document.getElementById('communes-chart-container');
        
        if (toggleCheckbox && chartContainer) {
            toggleCheckbox.addEventListener('change', function() {
                if (this.checked) {
                    chartContainer.style.display = 'block';
                    if (communesChart) {
                        communesChart.resize();
                    }
                } else {
                    chartContainer.style.display = 'none';
                }
            });
        }
    }

    // 13. Run Initialization
    populateDropdowns();
    updateKPIs();
    renderSimulatorTable();
    renderThematicsTab();
    initCharts();
    initTabs();
    initModalTabs();
    initModalClose();
    initSimulatorFilters();
    initThematicFilters();
    initThemeToggle();
    initPrintIndividual();
    initPrintAll();
    initEnvelopeInputs();
    initModalRemarks();
    initCommunesChartToggle();
});

