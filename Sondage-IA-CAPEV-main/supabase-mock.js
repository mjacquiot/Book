// Mock Supabase Client for Sondage IA CNFPT
(function() {
    console.log("=== Loading Local Supabase Mock ===");

    class MockSupabaseClient {
        constructor() {
            this.auth = {
                signInWithPassword: async ({ email, password }) => {
                    if (password === 'MAJA00') {
                        const user = { id: 'admin-uuid', email: 'admin@admin.fr', role: 'authenticated' };
                        localStorage.setItem('sondage_session', JSON.stringify({ user }));
                        return { data: { user }, error: null };
                    } else {
                        return { data: null, error: { message: "Mot de passe de démonstration incorrect. Utilisez MAJA00." } };
                    }
                },
                signOut: async () => {
                    localStorage.removeItem('sondage_session');
                    return { error: null };
                },
                getSession: async () => {
                    const session = localStorage.getItem('sondage_session');
                    if (session) {
                        return { data: { session: JSON.parse(session) }, error: null };
                    }
                    return { data: { session: null }, error: null };
                }
            };
        }

        from(table) {
            return new MockQueryBuilder(table);
        }

        channel(name) {
            return {
                on: function(event, filter, callback) {
                    window.addEventListener('supabase_realtime_event', (e) => {
                        const { table, record } = e.detail;
                        if (table === filter.table) {
                            callback({ new: record });
                        }
                    });
                    return this;
                },
                subscribe: function() {
                    return this;
                }
            };
        }

        removeChannel() {}
    }

    class MockQueryBuilder {
        constructor(table) {
            this.table = table;
            this.filters = [];
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

        eq(col, val) {
            this.filters.push({ type: 'eq', col, val });
            return this;
        }

        order(col, options = {}) {
            this.orderCol = col;
            this.orderAsc = options.ascending !== false;
            return this;
        }

        limit(num) {
            this.limitNum = num;
            return this;
        }

        async execute() {
            let db = JSON.parse(localStorage.getItem('sondage_db_' + this.table));
            if (!db) {
                db = [];
                // Initial seeding for word_cloud_inputs if empty
                if (this.table === 'word_cloud_inputs') {
                    const defaultUsages = [
                        "Rédaction de courriers & rapports", "Synthèse de documents & notes",
                        "Recherche d'informations & veille", "Analyse de données & chiffres",
                        "Création de visuels & diaporamas", "Aide au codage & automatisation",
                        "Brainstorming & idées de projets"
                    ].map(word => ({ id: Math.random().toString(36).substr(2, 9), question_id: 'usages', word, votes: 0 }));
                    
                    const defaultAttentes = [
                        "Pratique & cas concrets", "Gagner du temps", "Comprendre les limites",
                        "Sécurité & RGPD", "Rédiger de bons prompts", "Découvrir de nouveaux outils"
                    ].map(word => ({ id: Math.random().toString(36).substr(2, 9), question_id: 'attentes', word, votes: 0 }));

                    const defaultOutils = [
                        "ChatGPT", "Copilot", "Gemini", "Claude", "Midjourney", "Canva"
                    ].map(word => ({ id: Math.random().toString(36).substr(2, 9), question_id: 'outils', word, votes: 0 }));

                    db = [...defaultUsages, ...defaultAttentes, ...defaultOutils];
                    localStorage.setItem('sondage_db_' + this.table, JSON.stringify(db));
                }
            }

            if (this.action === 'select') {
                let filtered = [...db];
                for (const filter of this.filters) {
                    if (filter.type === 'eq') {
                        filtered = filtered.filter(item => item[filter.col] === filter.val);
                    }
                }
                if (this.orderCol) {
                    filtered.sort((a, b) => {
                        let va = a[this.orderCol];
                        let vb = b[this.orderCol];
                        if (va instanceof Date || this.orderCol === 'created_at' || this.orderCol === 'date') {
                            va = new Date(va);
                            vb = new Date(vb);
                        }
                        if (va < vb) return this.orderAsc ? -1 : 1;
                        if (va > vb) return this.orderAsc ? 1 : -1;
                        return 0;
                    });
                }
                if (this.limitNum) {
                    filtered = filtered.slice(0, this.limitNum);
                }
                return { data: filtered, error: null };
            }

            if (this.action === 'insert') {
                const records = Array.isArray(this.payload) ? this.payload : [this.payload];
                const inserted = [];
                for (let record of records) {
                    record = {
                        id: Math.random().toString(36).substr(2, 9),
                        created_at: new Date().toISOString(),
                        ...record
                    };
                    db.push(record);
                    inserted.push(record);

                    // Dispatch event for Realtime simulation
                    setTimeout(() => {
                        const event = new CustomEvent('supabase_realtime_event', { detail: { table: this.table, record } });
                        window.dispatchEvent(event);
                        if (window.parent && window.parent !== window) {
                            window.parent.dispatchEvent(event);
                        }
                    }, 50);
                }
                localStorage.setItem('sondage_db_' + this.table, JSON.stringify(db));
                return { data: Array.isArray(this.payload) ? inserted : inserted[0], error: null };
            }

            if (this.action === 'update') {
                let updatedCount = 0;
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
                        updatedCount++;
                        updatedRecord = item;

                        // Dispatch event for Realtime simulation
                        setTimeout(() => {
                            const event = new CustomEvent('supabase_realtime_event', { detail: { table: this.table, record: item } });
                            window.dispatchEvent(event);
                            if (window.parent && window.parent !== window) {
                                window.parent.dispatchEvent(event);
                            }
                        }, 50);
                    }
                    return item;
                });
                localStorage.setItem('sondage_db_' + this.table, JSON.stringify(db));
                return { data: updatedRecord, error: null };
            }

            if (this.action === 'delete') {
                let deletedCount = 0;
                const newDb = db.filter(item => {
                    let matches = true;
                    for (const filter of this.filters) {
                        if (filter.type === 'eq' && item[filter.col] !== filter.val) {
                            matches = false;
                        }
                    }
                    if (matches) deletedCount++;
                    return !matches;
                });
                localStorage.setItem('sondage_db_' + this.table, JSON.stringify(newDb));
                return { data: null, error: null };
            }

            return { data: null, error: { message: "Action non supportée dans le mock." } };
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
    console.log("=== Local Supabase Mock Initialized ===");
})();
