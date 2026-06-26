const { createApp } = Vue;

const STORAGE_KEY = 'pilote_mandat_data';

// Helper for generating IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

const DEFAULT_DATA = {
    axes: [
        { id: 'axe-1', title: 'Transition Écologique', order: 1 },
        { id: 'axe-2', title: 'Citoyenneté & Solidarité', order: 2 }
    ],
    elus: [
        { id: 'elu-1', name: 'Mme Martin', role: 'Maire' },
        { id: 'elu-2', name: 'M. Dubois', role: 'VP Transition' }
    ],
    actions: []
};

createApp({
    data() {
        return {
            currentView: 'boussole',
            data: JSON.parse(JSON.stringify(DEFAULT_DATA)),

            // Paramétrage form state
            newAxisTitle: '',
            newEluName: '',
            newEluRole: '',

            // Modal state
            isModalOpen: false,
            editingAction: null,
            form: {
                id: null,
                axis_id: '',
                title: '',
                description: '',
                referent_id: '',
                target_year: '',
                status: 'reflexion' // reflexion, retenu, long_terme
            }
        };
    },
    computed: {
        stats() {
            const actions = this.data.actions;
            return {
                total: actions.length,
                reflexion: actions.filter(a => a.status === 'reflexion').length,
                retenu: actions.filter(a => a.status === 'retenu').length,
                long_terme: actions.filter(a => a.status === 'long_terme').length
            };
        },
        timelineMandat() {
            const actions = this.data.actions.filter(a => a.status === 'retenu');
            return this.groupActionsByYear(actions);
        },
        timelineTerritoire() {
            const actions = this.data.actions.filter(a => a.status === 'long_terme');
            return this.groupActionsByYear(actions);
        }
    },
    methods: {
        // --- TIMELINE HELPERS ---
        groupActionsByYear(actionsList) {
            const grouped = {};
            actionsList.forEach(a => {
                const year = a.target_year || 'Non défini';
                if (!grouped[year]) grouped[year] = [];
                grouped[year].push(a);
            });
            return Object.keys(grouped).sort((a, b) => {
                if (a === 'Non défini') return 1;
                if (b === 'Non défini') return -1;
                return parseInt(a) - parseInt(b);
            }).map(year => ({
                year,
                actions: grouped[year]
            }));
        },
        getAxisColorClass(action) {
            const axis = this.getAxisForAction(action);
            if (!axis) return 'gray';
            // Determine a pseudo-random color based on order to differentiate themes
            const colors = ['blue', 'green', 'purple', 'orange', 'red', 'teal'];
            return colors[(axis.order - 1) % colors.length];
        },
        getAxisForAction(action) {
            return this.data.axes.find(a => a.id === action.axis_id) || { title: 'Non défini', order: 1 };
        },

        // --- DATA MANAGEMENT ---
        loadData() {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (!parsed.elus) parsed.elus = [];
                    // Force migrate old actions to new statuses and objective->axis pattern
                    parsed.actions.forEach(a => {
                        if (a.status === 'etude') a.status = 'reflexion';
                        if (a.status === 'lance') a.status = 'retenu';
                        if (a.status === 'termine') a.status = 'long_terme';

                        // Migrate objective_id to axis_id directly
                        if (a.objective_id && !a.axis_id && parsed.objectives) {
                            const obj = parsed.objectives.find(o => o.id === a.objective_id);
                            if (obj) a.axis_id = obj.axis_id;
                        }
                    });

                    // Drop objectives
                    delete parsed.objectives;
                    this.data = parsed;
                } catch (e) {
                    console.error("Erreur lecture LocalStorage", e);
                    this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
                }
            } else {
                this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
            }
        },
        saveData() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
            this.$nextTick(() => {
                lucide.createIcons();
            });
        },

        // --- QUERIES ---
        getActionsForAxis(axisId) {
            return this.data.actions.filter(a => a.axis_id === axisId);
        },
        getAxisStat(axisId, status) {
            const actions = this.getActionsForAxis(axisId);
            const total = actions.length;
            if (total === 0) return { count: 0, percent: 0 };
            const count = actions.filter(a => a.status === status).length;
            return {
                count,
                percent: (count / total) * 100
            };
        },
        getEluName(eluId) {
            const elu = this.data.elus.find(e => e.id === eluId);
            return elu ? `${elu.name} (${elu.role})` : '';
        },

        // --- PARAMETRAGE ---
        addAxis() {
            if (!this.newAxisTitle.trim()) return;
            this.data.axes.push({
                id: generateId(),
                title: this.newAxisTitle.trim(),
                order: this.data.axes.length + 1
            });
            this.newAxisTitle = '';
            this.saveData();
        },
        removeAxis(id) {
            if (this.getActionsForAxis(id).length > 0) {
                alert("Impossible de supprimer cet axe car des idées y sont associées.");
                return;
            }
            this.data.axes = this.data.axes.filter(a => a.id !== id);
            this.saveData();
        },
        addElu() {
            if (!this.newEluName.trim()) return;
            this.data.elus.push({
                id: generateId(),
                name: this.newEluName.trim(),
                role: this.newEluRole.trim()
            });
            this.newEluName = '';
            this.newEluRole = '';
            this.saveData();
        },
        removeElu(id) {
            if (this.data.actions.some(a => a.referent_id === id)) {
                alert("Impossible de supprimer cet élu car il est référent d'une ou plusieurs idées.");
                return;
            }
            this.data.elus = this.data.elus.filter(e => e.id !== id);
            this.saveData();
        },

        // --- ACTIONS CRUD ---
        openActionModal(action = null) {
            this.isModalOpen = true;
            if (action) {
                this.editingAction = action;
                this.form = {
                    id: action.id,
                    axis_id: action.axis_id || '',
                    title: action.title,
                    description: action.description || '',
                    referent_id: action.referent_id || '',
                    target_year: action.target_year || '',
                    status: action.status || 'reflexion'
                };
            } else {
                this.editingAction = null;
                this.form = {
                    id: null,
                    axis_id: '',
                    title: '',
                    description: '',
                    referent_id: '',
                    target_year: '',
                    status: 'reflexion'
                };
            }
            this.$nextTick(() => lucide.createIcons());
        },
        closeModal() {
            this.isModalOpen = false;
        },
        saveAction() {
            if (!this.form.axis_id) {
                alert("Veuillez sélectionner un Axe Stratégique. S'il n'y en a pas, créez-le dans Paramétrage.");
                return;
            }

            // 3. Create or Edit Action
            if (this.editingAction) {
                const idx = this.data.actions.findIndex(a => a.id === this.editingAction.id);
                if (idx !== -1) {
                    this.data.actions[idx] = {
                        ...this.data.actions[idx],
                        axis_id: this.form.axis_id,
                        title: this.form.title,
                        description: this.form.description,
                        referent_id: this.form.referent_id,
                        target_year: this.form.target_year,
                        status: this.form.status
                    };
                }
            } else {
                this.data.actions.push({
                    id: generateId(),
                    axis_id: this.form.axis_id,
                    title: this.form.title,
                    description: this.form.description,
                    referent_id: this.form.referent_id,
                    target_year: this.form.target_year,
                    status: this.form.status,
                    order: this.getActionsForAxis(this.form.axis_id).length + 1
                });
            }

            this.saveData();
            this.closeModal();

            if (this.currentView !== 'arbitrage') {
                this.currentView = 'arbitrage';
            }
        },
        deleteAction(id) {
            if (confirm("Êtes-vous sûr de vouloir supprimer cette idée ?")) {
                this.data.actions = this.data.actions.filter(a => a.id !== id);
                this.saveData();
            }
        },

        // --- IMPORT / EXPORT ---
        exportData() {
            const dataStr = JSON.stringify(this.data, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = `plan_mandat_export_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
        },
        importData(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (imported.axes && imported.actions) {
                        this.data = imported;
                        this.saveData();
                        alert("Données importées avec succès !");
                        this.currentView = 'dashboard';
                    } else {
                        alert("Le format du fichier est invalide.");
                    }
                } catch (error) {
                    alert("Erreur lors de la lecture du fichier JSON.");
                    console.error(error);
                }
                event.target.value = '';
            };
            reader.readAsText(file);
        }
    },
    mounted() {
        this.loadData();
        this.$nextTick(() => {
            lucide.createIcons();
        });
    },
    watch: {
        currentView() {
            this.$nextTick(() => {
                lucide.createIcons();
            });
        }
    }
}).mount('#app');
