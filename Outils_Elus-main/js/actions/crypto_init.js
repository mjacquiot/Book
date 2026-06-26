// --- INITIALISATION CRYPTO & ONBOARDING ---

window.initCryptoSession = async (password) => {
    // 1. Dérivation de la VaultKey depuis le mot de passe
    // S'il n'y a pas de sel enregistré pour l'utilisateur, ce sera créé plus tard.
    const user = state.user;
    if (!user) return;

    try {
        const { data: keyData, error: keyErr } = await supabaseClient
            .from('user_crypto_keys')
            .select('*')
            .eq('user_id', user.id)
            .single();

        let privateKey;
        let publicKey;

        if (keyErr || !keyData) {
            // -- PREMIÈRE CONNEXION DE L'UTILISATEUR --
            console.log("Aucune paire de clés trouvée, génération du Cloud Wallet...");
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const saltStr = btoa(String.fromCharCode(...salt));
            
            const vaultKey = await window.CryptoManager.deriveVaultKey(password, salt);
            const keyPair = await window.CryptoManager.generateUserKeyPair();
            
            privateKey = keyPair.privateKey;
            publicKey = keyPair.publicKey;

            const pubJwk = await window.CryptoManager.exportKeyObj(publicKey);
            const encPriv = await window.CryptoManager.encryptPrivateKey(privateKey, vaultKey);

            // Sauvegarde dans Supabase
            await supabaseClient.from('user_crypto_keys').insert({
                user_id: user.id,
                public_key: pubJwk,
                encrypted_private_key: JSON.stringify(encPriv),
                salt: saltStr
            });
            console.log("Cloud Wallet créé avec succès.");
        } else {
            // -- CONNEXION EXISTANTE (ou retour après cache vidé) --
            console.log("Cloud Wallet trouvé, déchiffrement...");
            const salt = new Uint8Array(atob(keyData.salt).split("").map(c => c.charCodeAt(0)));
            const vaultKey = await window.CryptoManager.deriveVaultKey(password, salt);
            
            const encPriv = JSON.parse(keyData.encrypted_private_key);
            privateKey = await window.CryptoManager.decryptPrivateKey(encPriv.cipher, encPriv.iv, vaultKey);
            publicKey = await window.CryptoManager.importPublicKey(keyData.public_key);
            console.log("Clé privée récupérée localement !");
        }

        // On garde la clé privée temporairement en mémoire pour la session actuelle
        window.sessionPrivateKey = privateKey;
        window.sessionPublicKey = publicKey;

        // 2. Gestion de la Clé de Collectivité
        // On récupère le profile complet pour avoir la collectivité
        const { data: profile } = await supabaseClient.from('profiles').select('collectivite_id').eq('id', user.id).single();
        if (profile && profile.collectivite_id) {
            const collId = profile.collectivite_id;
            
            const { data: collKeyData, error: collKeyErr } = await supabaseClient
                .from('collectivity_shared_keys')
                .select('*')
                .eq('collectivite_id', collId)
                .eq('user_id', user.id)
                .single();

            if (collKeyErr && collKeyErr.code !== 'PGRST116') {
                console.error("Erreur réseau lors du chargement de la clé partagée:", collKeyErr);
                throw new Error("Erreur réseau (Crypto)");
            }

            if (!collKeyData) {
                // Pas de clé partagée pour NOUS.
                // Est-ce qu'elle existe déjà pour la collectivité ?
                const { data: existingCollKeys, error: existErr } = await supabaseClient
                    .from('collectivity_shared_keys')
                    .select('id')
                    .eq('collectivite_id', collId)
                    .limit(1);

                if (existErr) {
                    console.error("Erreur réseau vérification clés globales:", existErr);
                    throw new Error("Erreur réseau (Crypto)");
                }

                if (!existingCollKeys || existingCollKeys.length === 0) {
                    console.log("Première init de la collectivité, création de la clé partagée...");
                    // On est le premier, on crée la clé
                    const aesKey = await window.CryptoManager.generateCollectivityKey();
                    const encryptedAes = await window.CryptoManager.encryptCollectivityKeyForUser(aesKey, publicKey);
                    
                    await supabaseClient.from('collectivity_shared_keys').insert({
                        collectivite_id: collId,
                        user_id: user.id,
                        encrypted_shared_key: encryptedAes
                    });
                    window.sessionCollectivityKey = aesKey;
                } else {
                    console.error("La clé de collectivité existe mais ne vous a pas été partagée. Demandez à un admin de vous la partager.");
                    // TODO: UI pour informer l'utilisateur
                }
            } else {
                console.log("Clé de collectivité trouvée, déchiffrement...");
                const aesKey = await window.CryptoManager.decryptCollectivityKey(collKeyData.encrypted_shared_key, privateKey);
                window.sessionCollectivityKey = aesKey;
            }
        }

    } catch (e) {
        console.error("Erreur critique lors de l'initialisation crypto:", e);
    }
};

window.checkAndLaunchOnboarding = () => {
    // Vérification du cache local (LocalStorage)
    const localContext = localStorage.getItem('eluConnect_localContext');
    if (localContext) {
        // Init cache into state.localDict
        state.localDict = JSON.parse(localContext);
    }
    // L'onboarding est désormais géré via la vue `onboarding` dans render()
    // Pas de modal ici, le redirect est automatique.
};
