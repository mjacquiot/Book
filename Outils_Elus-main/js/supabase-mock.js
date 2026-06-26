// Mock Supabase Client for EluConnect Modulaire
(function() {
    console.log("=== Loading Local Supabase Mock for EluConnect ===");

    class MockSupabaseClient {
        constructor() {
            this.auth = {
                signInWithPassword: async ({ email, password }) => {
                    if (password === 'MAJA00') {
                        // Check if email or username exists in mock profiles
                        let dbProfiles = JSON.parse(localStorage.getItem('eluconnect_db_profiles') || '[]');
                        let profile = dbProfiles.find(p => p.email === email || p.username === email.split('@')[0]);
                        
                        if (!profile) {
                            // Auto-create a profile for the user
                            const uid = 'user-' + Math.random().toString(36).substr(2, 9);
                            profile = {
                                id: uid,
                                email: email,
                                username: email.split('@')[0],
                                role: email.includes('admin') ? 'admin' : 'elu',
                                collectivite_id: 'col-1',
                                attached_themes: [],
                                onboarding_done: true
                            };
                            dbProfiles.push(profile);
                            localStorage.setItem('eluconnect_db_profiles', JSON.stringify(dbProfiles));
                        }
                        
                        const user = { 
                            id: profile.id, 
                            email: profile.email, 
                            user_metadata: { 
                                username: profile.username, 
                                role: profile.role,
                                collectivite_id: profile.collectivite_id
                            } 
                        };
                        
                        localStorage.setItem('eluconnect_session', JSON.stringify({ user }));
                        this._currentUser = user;
                        return { data: { user, session: { access_token: 'mock-token', user } }, error: null };
                    } else {
                        return { data: null, error: { message: "Mot de passe incorrect (Le mot de passe de démonstration est MAJA00)." } };
                    }
                },
                signOut: async () => {
                    localStorage.removeItem('eluconnect_session');
                    this._currentUser = null;
                    return { error: null };
                },
                getSession: async () => {
                    const session = localStorage.getItem('eluconnect_session');
                    if (session) {
                        return { data: { session: JSON.parse(session) }, error: null };
                    }
                    return { data: { session: null }, error: null };
                },
                getUser: async () => {
                    const session = localStorage.getItem('eluconnect_session');
                    if (session) {
                        return { data: { user: JSON.parse(session).user }, error: null };
                    }
                    return { data: { user: null }, error: null };
                },
                signUp: async ({ email, password, options }) => {
                    let dbProfiles = JSON.parse(localStorage.getItem('eluconnect_db_profiles') || '[]');
                    const uid = 'user-' + Math.random().toString(36).substr(2, 9);
                    const newProfile = {
                        id: uid,
                        email: email,
                        username: options.data.username || email.split('@')[0],
                        role: options.data.role || 'elu',
                        collectivite_id: options.data.collectivite_id || 'col-1',
                        attached_themes: [],
                        onboarding_done: false
                    };
                    dbProfiles.push(newProfile);
                    localStorage.setItem('eluconnect_db_profiles', JSON.stringify(dbProfiles));
                    return { data: { user: { id: uid, email } }, error: null };
                },
                mfa: {
                    getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null }),
                    listFactors: async () => ({ data: { totp: [] }, error: null })
                }
            };
            this._currentUser = null;
        }

        from(table) {
            return new MockQueryBuilder(table);
        }

        channel(name) {
            return {
                on: function() { return this; },
                subscribe: function() { return this; }
            };
        }

        removeChannel() {}
    }

    class MockQueryBuilder {
        constructor(table) {
            this.table = table;
            this.filters = [];
            this.isSingle = false;
        }

        select(columns = '*') {
            this.action = 'select';
            return this;
        }

        insert(data) {
            this.action = 'insert';
            this.payload = data;
            return this;
        }

        update(data) {
            this.action = 'update';
            this.payload = data;
            return this;
        }

        delete() {
            this.action = 'delete';
            return this;
        }

        upsert(data) {
            this.action = 'upsert';
            this.payload = data;
            return this;
        }

        eq(col, val) {
            this.filters.push({ type: 'eq', col, val });
            return this;
        }

        is(col, val) {
            this.filters.push({ type: 'is', col, val });
            return this;
        }

        neq(col, val) {
            this.filters.push({ type: 'neq', col, val });
            return this;
        }

        limit(num) {
            this.limitNum = num;
            return this;
        }

        order(col, options = {}) {
            this.orderCol = col;
            this.orderAsc = options.ascending !== false;
            return this;
        }

        single() {
            this.isSingle = true;
            return this;
        }

        maybeSingle() {
            this.isSingle = true;
            this.isMaybeSingle = true;
            return this;
        }

        async execute() {
            let db = JSON.parse(localStorage.getItem('eluconnect_db_' + this.table));
            if (!db) {
                db = [];
                // Seeding default data if empty
                if (this.table === 'profiles') {
                    db = [
                        { id: 'usr-admin', email: 'admin@admin.com', username: 'admin', role: 'admin', collectivite_id: 'col-1', attached_themes: [], onboarding_done: true },
                        { id: 'usr-maire', email: 'maire@mairie.fr', username: 'Maire de Saint-Julien', role: 'maire', collectivite_id: 'col-1', attached_themes: [], onboarding_done: true },
                        { id: 'usr-adjoint', email: 'adjoint@mairie.fr', username: 'Adjoint Enfance', role: 'adjoint', collectivite_id: 'col-1', attached_themes: [1], onboarding_done: true },
                        { id: 'usr-elu', email: 'elu@mairie.fr', username: 'Élu Simple', role: 'elu', collectivite_id: 'col-1', attached_themes: [], onboarding_done: true }
                    ];
                } else if (this.table === 'allowed_registrations') {
                    db = [
                        { id: 1, email: 'admin@admin.com', role: 'admin', collectivite_id: 'col-1', temp_pwd: 'MAJA00', used_at: null },
                        { id: 2, email: 'maire@mairie.fr', role: 'maire', collectivite_id: 'col-1', temp_pwd: 'MAJA00', used_at: null },
                        { id: 3, email: 'adjoint@mairie.fr', role: 'adjoint', collectivite_id: 'col-1', temp_pwd: 'MAJA00', used_at: null },
                        { id: 4, email: 'elu@mairie.fr', role: 'elu', collectivite_id: 'col-1', temp_pwd: 'MAJA00', used_at: null }
                    ];
                } else if (this.table === 'themes') {
                    db = [
                        { id: 1, title: 'Transition Écologique & Climat', description: 'Rénovation thermique des bâtiments publics, mobilités douces et énergies renouvelables.', is_archived: false, collectivite_id: 'col-1' },
                        { id: 2, title: 'Urbanisme, PLU & Voirie', description: 'Aménagement des espaces publics, révision du plan local d\'urbanisme et travaux.', is_archived: false, collectivite_id: 'col-1' },
                        { id: 3, title: 'Éducation, Sport & Culture', description: 'Gestion des écoles communales, du périscolaire, des subventions sportives et culturelles.', is_archived: false, collectivite_id: 'col-1' }
                    ];
                } else if (this.table === 'subjects') {
                    db = [
                        { id: 101, theme_id: 1, title: 'Isolation thermique du gymnase communal', description: 'Projet d\'isolation par l\'extérieur et remplacement du chauffage fioul par une pompe à chaleur.', is_confidential: false, council_date: '2026-07-15', vote: { question: "Approuvez-vous ce projet de rénovation ?", options: ["Oui", "Non", "Abstention"], counts: [12, 3, 2], voters: [], target: 'elu' }, collectivite_id: 'col-1', is_archived: false },
                        { id: 102, theme_id: 2, title: 'Aménagement de pistes cyclables Avenue verte', description: 'Sécurisation des voies cyclables liant la mairie aux écoles et à la zone d\'activités.', is_confidential: false, council_date: '2026-07-15', vote: { question: "Faut-il aménager cette piste cyclable ?", options: ["Oui", "Non", "Sans avis"], counts: [45, 12, 5], voters: [], target: 'public' }, collectivite_id: 'col-1', is_archived: false },
                        { id: 103, theme_id: 3, title: 'Achat de tablettes numériques pour l\'école primaire', description: 'Équipement informatique pédagogique pour les classes de CM1 et CM2.', is_confidential: false, council_date: '2026-07-15', vote: { question: "Faut-il acquérir ces tablettes ?", options: ["Oui", "Non", "Abstention"], counts: [8, 0, 1], voters: [], target: 'elu' }, collectivite_id: 'col-1', is_archived: false }
                    ];
                } else if (this.table === 'documents') {
                    db = [
                        { id: 201, subject_id: 101, title: 'Plans techniques isolation.pdf', content: 'Plans de coupe du gymnase municipal avant/après travaux...', collectivite_id: 'col-1' },
                        { id: 202, subject_id: 102, title: 'Plan d\'aménagement de voirie.pdf', content: 'Détail des tracés des pistes cyclables et des séparateurs physiques...', collectivite_id: 'col-1' }
                    ];
                } else if (this.table === 'councils') {
                    db = [
                        { id: 301, date: '2026-07-15', collectivite_id: 'col-1' }
                    ];
                } else if (this.table === 'messages') {
                    db = [];
                }
                localStorage.setItem('eluconnect_db_' + this.table, JSON.stringify(db));
            }

            if (this.action === 'select') {
                let filtered = [...db];
                for (const filter of this.filters) {
                    if (filter.type === 'eq') {
                        filtered = filtered.filter(item => item[filter.col] === filter.val);
                    } else if (filter.type === 'is' && filter.val === null) {
                        filtered = filtered.filter(item => item[filter.col] === null || item[filter.col] === undefined);
                    }
                }
                
                if (this.orderCol) {
                    filtered.sort((a, b) => {
                        let va = a[this.orderCol];
                        let vb = b[this.orderCol];
                        if (va < vb) return this.orderAsc ? -1 : 1;
                        if (va > vb) return this.orderAsc ? 1 : -1;
                        return 0;
                    });
                }
                
                if (this.limitNum) {
                    filtered = filtered.slice(0, this.limitNum);
                }

                if (this.isSingle) {
                    if (filtered.length > 0) {
                        return { data: filtered[0], error: null };
                    } else {
                        if (this.isMaybeSingle) {
                            return { data: null, error: null };
                        }
                        return { data: null, error: { code: 'PGRST116', message: 'No records found' } };
                    }
                }
                
                return { data: filtered, error: null };
            }

            if (this.action === 'insert') {
                const records = Array.isArray(this.payload) ? this.payload : [this.payload];
                const inserted = [];
                for (let record of records) {
                    record = {
                        id: record.id || Math.floor(Math.random() * 1000000),
                        created_at: new Date().toISOString(),
                        ...record
                    };
                    db.push(record);
                    inserted.push(record);
                }
                localStorage.setItem('eluconnect_db_' + this.table, JSON.stringify(db));
                return { data: Array.isArray(this.payload) ? inserted : inserted[0], error: null };
            }

            if (this.action === 'update') {
                let updatedRecord = null;
                db = db.map(item => {
                    let matches = true;
                    for (const filter of this.filters) {
                        if (filter.type === 'eq' && item[filter.col] !== filter.val) {
                            matches = false;
                        }
                    }
                    if (matches) {
                        Object.assign(item, this.payload);
                        updatedRecord = item;
                    }
                    return item;
                });
                localStorage.setItem('eluconnect_db_' + this.table, JSON.stringify(db));
                return { data: updatedRecord, error: null };
            }

            if (this.action === 'delete') {
                db = db.filter(item => {
                    let matches = true;
                    for (const filter of this.filters) {
                        if (filter.type === 'eq' && item[filter.col] !== filter.val) {
                            matches = false;
                        }
                    }
                    return !matches;
                });
                localStorage.setItem('eluconnect_db_' + this.table, JSON.stringify(db));
                return { data: null, error: null };
            }

            if (this.action === 'upsert') {
                const records = Array.isArray(this.payload) ? this.payload : [this.payload];
                for (const record of records) {
                    // Match by id or user_id
                    const matchKey = record.id ? 'id' : (record.user_id ? 'user_id' : null);
                    let index = -1;
                    if (matchKey) {
                        index = db.findIndex(item => item[matchKey] === record[matchKey]);
                    }
                    if (index !== -1) {
                        Object.assign(db[index], record);
                    } else {
                        db.push({
                            id: record.id || Math.floor(Math.random() * 1000000),
                            created_at: new Date().toISOString(),
                            ...record
                        });
                    }
                }
                localStorage.setItem('eluconnect_db_' + this.table, JSON.stringify(db));
                return { data: this.payload, error: null };
            }

            return { data: null, error: { message: "Action non supportée" } };
        }

        then(onfulfilled, onrejected) {
            return this.execute().then(onfulfilled, onrejected);
        }
    }

    window.supabase = {
        createClient: function() {
            return new MockSupabaseClient();
        }
    };
    window.supabaseClient = window.supabase.createClient();
    console.log("=== Local Supabase Mock for EluConnect Initialized ===");
})();
