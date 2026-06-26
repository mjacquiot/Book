window.initAiWorker = () => {
    if (!window.Worker) {
        console.warn("Web Workers non supportés.");
        state.aiModelStatus = 'error';
        return;
    }

    state.workerCallbacks = {};

    try {
        state.aiWorker = new Worker('js/workers/ner_worker.js', { type: 'module' });
    } catch (e) {
        console.error("Erreur d'initialisation du Worker :", e);
        state.aiModelStatus = 'error';
        if (window.location.protocol === 'file:') {
            alert("Erreur de sécurité : L'application doit être lancée via un serveur local (ex: http://localhost:8000) et non en double-cliquant sur le fichier index.html, car le navigateur bloque les Web Workers pour des raisons de sécurité.");
        }
        return;
    }

    state.aiModelStatus = 'loading';
    state.aiModelProgress = 0;

    state.aiWorker.onmessage = (e) => {
        const msg = e.data;

        switch (msg.type) {
            case 'status':
                if (msg.status === 'ready') {
                    window.aiModelLoaded = true;
                    state.aiModelStatus = 'ready';
                    state.aiModelProgress = 100;
                    state.aiModelName = msg.modelName || 'Xenova/camembert-ner';
                    console.log(`[Worker NER] ✅ Modèle prêt (niveau: ${msg.level}) - ${state.aiModelName}`);
                    render(); // Re-render to update onboarding/options UI
                } else if (msg.status === 'loading') {
                    state.aiModelStatus = 'loading';
                    console.log(`[Worker NER] ⏳ Chargement (niveau: ${msg.level})...`);
                }
                break;

            case 'progress':
                // msg.data = objet Transformers.js progress_callback
                // Formats possibles :
                //   { status: "initiate", name: "...", file: "..." }
                //   { status: "download", name: "...", file: "..." }
                //   { status: "progress", name: "...", file: "...", progress: 45.2, loaded: 123, total: 456 }
                //   { status: "done", name: "...", file: "..." }
                if (msg.data) {
                    const info = msg.data;
                    
                    // Log tout pour debug
                    if (info.status === 'initiate') {
                        console.log(`[IA] 📦 Début du fichier: ${info.file}`);
                    } else if (info.status === 'done') {
                        console.log(`[IA] ✅ Fichier terminé: ${info.file}`);
                    }
                    
                    // Mise à jour de la barre uniquement quand on a un vrai pourcentage
                    if (info.status === 'progress' && info.progress !== undefined) {
                        const p = Math.round(info.progress);
                        state.aiModelProgress = p;
                        state.aiModelStatus = 'loading';

                        // Mise à jour DOM directe pour la fluidité (sans re-render)
                        // -- Onboarding --
                        const obBar = document.getElementById('ob-model-progress-bar');
                        const obText = document.getElementById('ob-model-progress-text');
                        const obStatus = document.getElementById('ob-model-status');
                        if (obBar) obBar.style.width = p + '%';
                        if (obText) obText.innerText = p + '%';
                        if (obStatus) {
                            const sizeMb = info.loaded ? (info.loaded / 1024 / 1024).toFixed(1) : '?';
                            const totalMb = info.total ? (info.total / 1024 / 1024).toFixed(0) : '?';
                            obStatus.innerText = `${info.file || 'Modèle'} — ${sizeMb} / ${totalMb} Mo`;
                        }

                        // -- Options --
                        const optBar = document.getElementById('opt-model-progress-bar');
                        const optText = document.getElementById('opt-model-progress-text');
                        if (optBar) optBar.style.width = p + '%';
                        if (optText) optText.innerText = p + '%';
                    }
                }
                break;

            case 'result':
                if (msg.id && state.workerCallbacks[msg.id]) {
                    state.workerCallbacks[msg.id].resolve(msg.entities);
                    delete state.workerCallbacks[msg.id];
                }
                break;

            case 'error':
                console.error("[Worker NER] ❌ Erreur :", msg.error);
                state.aiModelStatus = 'error';
                render();
                if (msg.id && state.workerCallbacks[msg.id]) {
                    state.workerCallbacks[msg.id].reject(msg.error);
                    delete state.workerCallbacks[msg.id];
                }
                break;
        }
    };

    state.aiWorker.onerror = (err) => {
        console.error("[Worker NER] ❌ Erreur critique du worker :", err);
        state.aiModelStatus = 'error';
        render();
    };

    // Initialiser le modèle immédiatement
    state.aiWorker.postMessage({ type: 'init' });
    console.log("[Worker NER] Worker initialisé, téléchargement du modèle IA lancé.");
};

window.analyzeTextWithVMBTask = (text) => {
    if (!state.aiWorker) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
        const id = Date.now() + Math.random().toString();
        state.workerCallbacks[id] = { resolve, reject };
        state.aiWorker.postMessage({ type: 'analyze', id: id, text: text });
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM LOADED FIRED, checking session...");
    
    // Si une session existe déjà (rafraîchissement de page)
    if (supabaseClient) {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) {
                console.log("Session active trouvée pour:", session.user.email);
                state.user = { id: session.user.id, email: session.user.email, username: session.user.email.split('@')[0], role: ROLES.ELU, attachedThemes: [] };
                await syncFromSupabase();
                
                // On lance l'IA puisque l'utilisateur est déjà là
                if (window.initAiWorker) window.initAiWorker();
                
                state.currentView = 'dashboard';
            }
        } catch (e) {
            console.warn("Erreur check session initiale:", e);
        }
    }
    
    setTimeout(render, 300);
});
// Failsafe if DOMContentLoaded already fired:
console.log("Current document.readyState: ", document.readyState);
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    console.log("Failsafe: scheduling render immediately");
    // window.initAiWorker() a été déplacé dans auth_actions.js
    setTimeout(render, 300);
}
console.log("=== APP.JS FULLY LOADED WITHOUT SYNTAX ERROR ===");
window.onerror = function (msg, url, lineNo, columnNo, error) {
    document.body.innerHTML = "<div style='padding:2rem;background:white;color:red;'><h2>Erreur Critique Globale</h2><p>" + msg + " (Ligne: " + lineNo + ")</p></div>";
    return false;
};

// --- PWA INSTALLATION ---
window.deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredInstallPrompt = e;
    state.canInstallPwa = true;
    render();
});

window.promptPwaInstall = async () => {
    if (window.deferredInstallPrompt) {
        window.deferredInstallPrompt.prompt();
        const { outcome } = await window.deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
            state.canInstallPwa = false;
        }
        window.deferredInstallPrompt = null;
        render();
    }
};
