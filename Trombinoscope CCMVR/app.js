/* ==========================================================================
   Application Logic - Trombinoscope & Carte Interactive
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. App State
    const state = {
        currentView: 'trombi',    // 'trombi' | 'map' | 'detail'
        sortBy: 'role',           // 'role' | 'commune'
        selectedEluId: null,
        theme: 'light',
        prevView: 'trombi',       // Keep track of where to return on back click
        searchQuery: '',          // Fuzzy text filter on home grid
        detailMarker: null,       // Marker indicating commune centroid on detail view
        zoomTimeout: null         // Handle to zoom timeout
    };

    // 2. Leaflet Map Instances
    let mainMap = null;
    let mainMapGeojson = null;
    
    let detailMap = null;
    let detailMapGeojson = null;
    
    // Map tile layers URL & options
    const TILE_LAYERS = {
        dark: {
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            options: {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            }
        },
        light: {
            url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            options: {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            }
        }
    };

    // Center coordinates for Marches du Velay-Rochebaron CC
    const MAP_CENTER = [45.2934, 4.1716];
    const MAP_DEFAULT_ZOOM = 11.5;

    // Initialize Lucide Icons
    lucide.createIcons();

    // 3. Initialize Theme
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        state.theme = savedTheme;
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
    initTheme();

    // Toggle Theme
    document.getElementById('theme-toggle').addEventListener('click', () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('theme', state.theme);
        
        // Update tiles on active maps
        if (mainMap) {
            mainMap.eachLayer(layer => {
                if (layer instanceof L.TileLayer) {
                    mainMap.removeLayer(layer);
                }
            });
            const conf = TILE_LAYERS[state.theme];
            L.tileLayer(conf.url, conf.options).addTo(mainMap);
        }
        if (detailMap) {
            detailMap.eachLayer(layer => {
                if (layer instanceof L.TileLayer) {
                    detailMap.removeLayer(layer);
                }
            });
            const conf = TILE_LAYERS[state.theme];
            L.tileLayer(conf.url, conf.options).addTo(detailMap);
        }
    });

    // 4. View Router
    const VIEWS = ['trombi', 'map', 'detail'];

    function switchView(viewName) {
        const fromView = state.currentView;
        const toView = viewName;
        
        if (fromView === toView) return;
        
        state.prevView = fromView;
        state.currentView = toView;

        const fromEl = document.getElementById(`view-${fromView}`);
        const toEl = document.getElementById(`view-${toView}`);
        
        if (!fromEl || !toEl) return;
        
        const fromIdx = VIEWS.indexOf(fromView);
        const toIdx = VIEWS.indexOf(toView);
        const isForward = toIdx > fromIdx;

        // Reset transition classes on target view
        toEl.classList.remove('exit-left', 'exit-right', 'enter-left', 'enter-right');
        
        if (isForward) {
            // Target starts from the right
            toEl.classList.add('enter-right');
            // Force layout reflow
            void toEl.offsetWidth;
            
            fromEl.classList.remove('active');
            fromEl.classList.add('exit-left');
            
            toEl.classList.remove('enter-right');
            toEl.classList.add('active');
        } else {
            // Target starts from the left
            toEl.classList.add('enter-left');
            // Force layout reflow
            void toEl.offsetWidth;
            
            fromEl.classList.remove('active');
            fromEl.classList.add('exit-right');
            
            toEl.classList.remove('enter-left');
            toEl.classList.add('active');
        }

        // Clean up old view transition classes after animation finishes (500ms)
        setTimeout(() => {
            fromEl.classList.remove('exit-left', 'exit-right');
        }, 500);

        // Update Navigation Menu active buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            if (btn.getAttribute('data-view') === toView) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Trigger Leaflet redraw size validation
        if (toView === 'map') {
            initMainMap();
            setTimeout(() => {
                if (mainMap) {
                    mainMap.invalidateSize();
                    if (mainMapGeojson) {
                        mainMap.fitBounds(mainMapGeojson.getBounds(), { padding: [30, 30] });
                    }
                }
            }, 100);
        } else if (toView === 'detail') {
            initDetailMap();
            setTimeout(() => {
                if (detailMap) {
                    detailMap.invalidateSize();
                    focusDetailMapCommune();
                }
            }, 100);
        }
    }

    // Nav Click handlers
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.getAttribute('data-view');
            switchView(targetView);
        });
    });

    // 5. Main Map Logic (Carte Interactive Direct Access)
    function initMainMap() {
        if (mainMap) return; // already initialized

        mainMap = L.map('leaflet-map-full', {
            zoomControl: false
        }).setView(MAP_CENTER, MAP_DEFAULT_ZOOM);

        L.control.zoom({ position: 'topright' }).addTo(mainMap);

        const tileConf = TILE_LAYERS[state.theme];
        L.tileLayer(tileConf.url, tileConf.options).addTo(mainMap);

        // Add Boundaries layer
        if (typeof BOUNDARIES_DATA !== 'undefined') {
            mainMapGeojson = L.geoJSON(BOUNDARIES_DATA, {
                style: function(feature) {
                    return {
                        color: 'var(--accent-color)',
                        weight: 2,
                        dashArray: '3, 5',
                        fillColor: 'var(--accent-color)',
                        fillOpacity: 0.05
                    };
                },
                onEachFeature: function(feature, layer) {
                    // Hover tooltips
                    if (feature.properties && feature.properties.nom) {
                        layer.bindTooltip(feature.properties.nom, {
                            sticky: true,
                            className: 'commune-tooltip',
                            direction: 'top'
                        });
                    }

                    // Hover effects and clicks
                    layer.on({
                        mouseover: function(e) {
                            const l = e.target;
                            l.setStyle({
                                weight: 4,
                                fillOpacity: 0.15
                            });
                        },
                        mouseout: function(e) {
                            if (mainMapGeojson) {
                                mainMapGeojson.resetStyle(e.target);
                            }
                        },
                        click: function(e) {
                            const communeName = feature.properties.nom;
                            showTownSidePanel(communeName);
                            // Highlight polygon
                            mainMapGeojson.eachLayer(l => {
                                mainMapGeojson.resetStyle(l);
                            });
                            e.target.setStyle({
                                weight: 4,
                                color: '#f59e0b', // Gold highlight
                                fillColor: '#f59e0b',
                                fillOpacity: 0.2
                            });
                            // Fly to boundaries
                            mainMap.flyToBounds(e.target.getBounds(), { padding: [40, 40], duration: 1 });
                        }
                    });
                }
            }).addTo(mainMap);

            // Fit boundaries
            mainMap.fitBounds(mainMapGeojson.getBounds(), { padding: [20, 20] });
        }

        // Add Rivers and Roads
        if (typeof GEOGRAPHICAL_FEATURES !== 'undefined') {
            L.geoJSON(GEOGRAPHICAL_FEATURES, {
                style: function(feature) {
                    if (feature.properties.type === 'la_loire') {
                        return {
                            color: '#0284c7',
                            weight: 5,
                            opacity: 0.5,
                            lineCap: 'round',
                            lineJoin: 'round'
                        };
                    } else if (feature.properties.type === 'n88') {
                        return {
                            color: '#e04f10',
                            weight: 3.5,
                            opacity: 0.65,
                            lineCap: 'round',
                            lineJoin: 'round'
                        };
                    } else if (['d12', 'd24', 'd44'].includes(feature.properties.type)) {
                        return {
                            color: '#d97706',
                            weight: 1.5,
                            opacity: 0.5,
                            lineCap: 'round',
                            lineJoin: 'round'
                        };
                    }
                },
                onEachFeature: function(feature, layer) {
                    let label = '';
                    if (feature.properties.type === 'la_loire') label = 'La Loire (Fleuve)';
                    else if (feature.properties.type === 'n88') label = 'Route Nationale 88 (RN88)';
                    else if (['d12', 'd24', 'd44'].includes(feature.properties.type)) label = feature.properties.name;

                    if (label) {
                        layer.bindTooltip(label, {
                            sticky: true,
                            className: 'feature-tooltip',
                            direction: 'top'
                        });
                    }
                }
            }).addTo(mainMap);
        }
    }

    // Show panel listing town officials on map click
    function showTownSidePanel(communeName) {
        const panel = document.getElementById('town-side-panel');
        const townTitle = document.getElementById('panel-town-name');
        const townCount = document.getElementById('panel-town-count');
        const townList = document.getElementById('town-elus-list');

        if (!panel) return;

        townTitle.textContent = communeName;

        // Filter officials representing this town
        const townElus = ELUS_DATA.filter(elu => elu.commune.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === communeName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
        
        townCount.textContent = `${townElus.length} élu(s) communautaire(s)`;
        townList.innerHTML = '';

        if (townElus.length === 0) {
            townList.innerHTML = '<p class="text-muted">Aucun élu communautaire pour cette commune.</p>';
        } else {
            // Sort by importance
            townElus.sort((a, b) => a.importance - b.importance);
            townElus.forEach((elu, index) => {
                const card = document.createElement('div');
                card.className = 'town-elu-row-card';
                card.style.setProperty('--delay', `${index * 0.05}s`);
                card.innerHTML = `
                    <img src="${elu.photo}" alt="${elu.prenom} ${elu.nom}" class="row-avatar">
                    <div class="row-bio">
                        <div class="row-name">${elu.prenom} ${elu.nom}</div>
                        <div class="row-role">${elu.role}</div>
                    </div>
                    <i data-lucide="chevron-right" style="width: 16px; height: 16px; color: var(--text-muted);"></i>
                `;
                card.addEventListener('click', () => {
                    openDetailView(elu.id);
                });
                townList.appendChild(card);
            });
            lucide.createIcons();
        }

        panel.classList.add('active');
    }

    // Close panel btn handler
    document.getElementById('close-town-panel').addEventListener('click', () => {
        const panel = document.getElementById('town-side-panel');
        if (panel) panel.classList.remove('active');
        
        // Reset Map GeoJSON styling
        if (mainMapGeojson) {
            mainMapGeojson.eachLayer(layer => {
                mainMapGeojson.resetStyle(layer);
            });
        }
    });

    // 6. Trombinoscope Rendering & Search logic
    function getFilteredElus() {
        if (!state.searchQuery.trim()) {
            return ELUS_DATA;
        }
        const query = strip_accents_str(state.searchQuery);
        return ELUS_DATA.filter(elu => {
            const fullName = strip_accents_str(elu.prenom + " " + elu.nom);
            const role = strip_accents_str(elu.role);
            const attributions = strip_accents_str(elu.attributions || "");
            const commune = strip_accents_str(elu.commune);
            return fullName.includes(query) || role.includes(query) || attributions.includes(query) || commune.includes(query);
        });
    }

    function renderTrombinoscope() {
        const container = document.getElementById('trombi-groups');
        if (!container) return;
        container.innerHTML = '';

        const filteredElus = getFilteredElus();

        if (filteredElus.length === 0) {
            container.innerHTML = `
                <div class="empty-state-search">
                    <i data-lucide="search-x" class="empty-icon"></i>
                    <h3>Aucun résultat trouvé</h3>
                    <p>Aucun élu ne correspond à votre recherche "<strong>${state.searchQuery}</strong>".</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        let globalCardIndex = 0; // Staggered animations across all groups

        if (state.sortBy === 'role') {
            // 4 main categories
            const groups = [
                { title: "Présidence", importance: [1], icon: "crown" },
                { title: "Vice-Présidences", importance: [2], icon: "award" },
                { title: "Conseillers Délégués", importance: [3], icon: "star" },
                { title: "Conseillers Communautaires", importance: [4], icon: "users" }
            ];

            groups.forEach(g => {
                const elus = filteredElus.filter(elu => g.importance.includes(elu.importance));
                
                // Sort alphabetically inside category
                elus.sort((a, b) => {
                    if (a.nom !== b.nom) return a.nom.localeCompare(b.nom);
                    return a.prenom.localeCompare(b.prenom);
                });

                if (elus.length > 0) {
                    globalCardIndex = renderGroupSection(container, g.title, g.icon, elus, globalCardIndex);
                }
            });
        } else {
            // Sort by commune
            const uniqueCommunes = [...new Set(filteredElus.map(elu => elu.commune))].sort();
            uniqueCommunes.forEach(c => {
                const elus = filteredElus.filter(elu => elu.commune === c);
                // Sort by importance
                elus.sort((a, b) => a.importance - b.importance);
                globalCardIndex = renderGroupSection(container, c, "map-pin", elus, globalCardIndex);
            });
        }

        lucide.createIcons();
    }

    function renderGroupSection(container, title, iconName, elusList, startCardIndex) {
        const section = document.createElement('section');
        section.className = 'group-section';

        section.innerHTML = `
            <div class="group-title-banner">
                <i data-lucide="${iconName}"></i>
                <h3>${title}</h3>
                <span class="count-badge">${elusList.length}</span>
            </div>
            <div class="trombi-grid"></div>
        `;

        const grid = section.querySelector('.trombi-grid');
        elusList.forEach((elu, i) => {
            const card = document.createElement('div');
            card.className = `elu-card importance-${elu.importance}`;
            card.setAttribute('data-id', elu.id);
            // Injected stagger delay
            card.style.setProperty('--delay', `${(startCardIndex + i) * 0.02}s`);
            card.innerHTML = `
                <div class="card-img-wrapper">
                    <img src="${elu.photo}" alt="${elu.prenom} ${elu.nom}" class="card-img" loading="lazy">
                </div>
                <div class="card-info">
                    <h4 class="card-name">${elu.prenom} ${elu.nom}</h4>
                    <div class="card-role">${elu.role}</div>
                    <div class="card-attributions">${elu.attributions || '&nbsp;'}</div>
                </div>
            `;
            card.addEventListener('click', () => {
                openDetailView(elu.id);
            });
            grid.appendChild(card);
        });

        container.appendChild(section);
        return startCardIndex + elusList.length;
    }

    // Initialize Search Event Listeners
    function initSearch() {
        const searchInput = document.getElementById('search-elu');
        const clearBtn = document.getElementById('clear-search');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            if (state.searchQuery.trim().length > 0) {
                clearBtn.classList.add('active');
            } else {
                clearBtn.classList.remove('active');
            }
            renderTrombinoscope();
        });

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            state.searchQuery = '';
            clearBtn.classList.remove('active');
            renderTrombinoscope();
            searchInput.focus();
        });
    }
    initSearch();

    // Toggle Sorting buttons
    document.getElementById('sort-role').addEventListener('click', (e) => {
        document.getElementById('sort-role').classList.add('active');
        document.getElementById('sort-commune').classList.remove('active');
        state.sortBy = 'role';
        renderTrombinoscope();
    });

    document.getElementById('sort-commune').addEventListener('click', (e) => {
        document.getElementById('sort-commune').classList.add('active');
        document.getElementById('sort-role').classList.remove('active');
        state.sortBy = 'commune';
        renderTrombinoscope();
    });

    // 7. Elected Official Detail Page View
    function openDetailView(eluId) {
        state.selectedEluId = eluId;
        switchView('detail');
        renderDetailContent();
    }

    function renderDetailContent() {
        const elu = ELUS_DATA.find(e => e.id === state.selectedEluId);
        if (!elu) return;

        // Reset detail element animation states by cloning or classes triggers
        const cardGlass = document.querySelector('.detail-card-glass');
        const mapCard = document.querySelector('.detail-map-card');
        const colleaguesHeader = document.querySelector('.colleagues-title');
        
        cardGlass.style.animation = 'none';
        mapCard.style.animation = 'none';
        colleaguesHeader.style.animation = 'none';
        
        // Force reflow
        void cardGlass.offsetWidth;
        
        cardGlass.style.animation = 'slideFromLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        mapCard.style.animation = 'scaleFadeIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        colleaguesHeader.style.animation = 'fadeIn 0.4s ease forwards';

        // Render basic bio
        document.getElementById('detail-photo').src = elu.photo;
        document.getElementById('detail-photo').alt = `${elu.prenom} ${elu.nom}`;
        document.getElementById('detail-fullname').textContent = `${elu.prenom} ${elu.nom}`;
        document.getElementById('detail-role').textContent = elu.role;
        document.getElementById('detail-attributions').textContent = elu.attributions || "";
        document.getElementById('detail-commune').textContent = elu.commune;

        // Set role theme class for details
        const roleBadge = document.getElementById('detail-role');
        roleBadge.className = 'detail-role-badge';
        roleBadge.classList.add(`role-${elu.importance}`);

        // Highlight mini map label
        document.getElementById('detail-map-commune-label').textContent = elu.commune;

        // Render same town colleagues (excluding the currently active official)
        const colleagues = ELUS_DATA.filter(e => e.commune === elu.commune && e.id !== elu.id);
        const colleaguesList = document.getElementById('colleagues-list');
        colleaguesList.innerHTML = '';

        if (colleagues.length === 0) {
            colleaguesList.innerHTML = '<p class="no-colleagues-msg">Seul représentant communautaire de cette commune.</p>';
        } else {
            colleagues.forEach((col, index) => {
                const btn = document.createElement('button');
                btn.className = 'colleague-item-btn';
                btn.style.setProperty('--delay', `${index * 0.05}s`);
                btn.title = `${col.prenom} ${col.nom}`;
                btn.innerHTML = `<img src="${col.photo}" alt="${col.prenom} ${col.nom}" class="colleague-thumb">`;
                btn.addEventListener('click', () => {
                    openDetailView(col.id);
                });
                colleaguesList.appendChild(btn);
            });
        }

        // Setup detail map highlighted boundaries
        focusDetailMapCommune();
    }

    // Mini map details setup & highlighting
    function initDetailMap() {
        if (detailMap) return;

        detailMap = L.map('leaflet-map-detail', {
            zoomControl: false,
            scrollWheelZoom: true,
            dragging: true,
            touchZoom: true,
            doubleClickZoom: true
        }).setView(MAP_CENTER, MAP_DEFAULT_ZOOM);

        // Add small positioned zoom control (bottom-right)
        L.control.zoom({ position: 'bottomright' }).addTo(detailMap);

        const tileConf = TILE_LAYERS[state.theme];
        L.tileLayer(tileConf.url, tileConf.options).addTo(detailMap);

        // Bind geographical features (Loire river, RN88, and departmental roads)
        if (typeof GEOGRAPHICAL_FEATURES !== 'undefined') {
            L.geoJSON(GEOGRAPHICAL_FEATURES, {
                style: function(feature) {
                    if (feature.properties.type === 'la_loire') {
                        return { color: '#0284c7', weight: 3.5, opacity: 0.4, lineCap: 'round', lineJoin: 'round' };
                    }
                    if (feature.properties.type === 'n88') {
                        return { color: '#e04f10', weight: 2.8, opacity: 0.5, lineCap: 'round', lineJoin: 'round' };
                    }
                    return { color: '#d97706', weight: 1.2, opacity: 0.3, lineCap: 'round', lineJoin: 'round' };
                }
            }).addTo(detailMap);
        }

        // Bind manual zoom controls
        const btnCommune = document.getElementById('btn-zoom-commune');
        const btnGlobal = document.getElementById('btn-zoom-global');

        if (btnCommune && btnGlobal) {
            btnCommune.addEventListener('click', () => {
                if (state.zoomTimeout) clearTimeout(state.zoomTimeout);
                
                const elu = ELUS_DATA.find(e => e.id === state.selectedEluId);
                if (!elu || !detailMapGeojson) return;
                
                let targetLayer = null;
                detailMapGeojson.eachLayer(layer => {
                    const isSelected = strip_accents_str(layer.feature.properties.nom) === strip_accents_str(elu.commune);
                    if (isSelected) targetLayer = layer;
                });
                
                if (targetLayer) {
                    detailMap.flyToBounds(targetLayer.getBounds(), { padding: [30, 30], duration: 1.2 });
                    btnCommune.classList.add('active');
                    btnGlobal.classList.remove('active');
                }
            });

            btnGlobal.addEventListener('click', () => {
                if (state.zoomTimeout) clearTimeout(state.zoomTimeout);
                
                if (detailMapGeojson) {
                    detailMap.flyToBounds(detailMapGeojson.getBounds(), { padding: [15, 15], duration: 1.2 });
                    btnCommune.classList.remove('active');
                    btnGlobal.classList.add('active');
                }
            });
        }
    }

    // Highlight the selected official's commune and show within collectivity
    function focusDetailMapCommune() {
        if (!detailMap) return;

        const elu = ELUS_DATA.find(e => e.id === state.selectedEluId);
        if (!elu) return;

        // Clear existing boundaries layer
        if (detailMapGeojson) {
            detailMap.removeLayer(detailMapGeojson);
        }

        // Clear existing markers and zoom timeouts
        if (state.detailMarker) {
            detailMap.removeLayer(state.detailMarker);
            state.detailMarker = null;
        }
        if (state.zoomTimeout) {
            clearTimeout(state.zoomTimeout);
            state.zoomTimeout = null;
        }

        // Reset buttons to Commune active, Global inactive
        const btnCommune = document.getElementById('btn-zoom-commune');
        const btnGlobal = document.getElementById('btn-zoom-global');
        if (btnCommune && btnGlobal) {
            btnCommune.classList.add('active');
            btnGlobal.classList.remove('active');
        }

        // Add Boundaries layer with highlighting
        if (typeof BOUNDARIES_DATA !== 'undefined') {
            detailMapGeojson = L.geoJSON(BOUNDARIES_DATA, {
                style: function(feature) {
                    // Match commune names ignoring accents/case
                    const isSelected = strip_accents_str(feature.properties.nom) === strip_accents_str(elu.commune);
                    return {
                        className: isSelected ? 'selected-commune-path' : '',
                        color: isSelected ? '#f59e0b' : (state.theme === 'dark' ? '#1e293b' : '#cbd5e1'), // Gold for selection, muted grey for rest
                        weight: isSelected ? 4 : 1.2,
                        fillColor: isSelected ? '#f59e0b' : '#334155',
                        fillOpacity: isSelected ? 0.35 : 0.04, // High focus fill opacity on target town, very muted on others
                        dashArray: isSelected ? '' : '3, 5'
                    };
                },
                onEachFeature: function(feature, layer) {
                    const isSelected = strip_accents_str(feature.properties.nom) === strip_accents_str(elu.commune);
                    if (feature.properties && feature.properties.nom) {
                        layer.bindTooltip(feature.properties.nom + (isSelected ? " (Commune de l'élu)" : ""), {
                            sticky: true,
                            className: isSelected ? 'commune-tooltip target-commune-tooltip' : 'commune-tooltip',
                            direction: 'top'
                        });
                    }
                    
                    // Allow hover highlight on detail map too
                    layer.on({
                        mouseover: function(e) {
                            if (!isSelected) {
                                e.target.setStyle({
                                    weight: 2,
                                    fillOpacity: 0.1
                                });
                            }
                        },
                        mouseout: function(e) {
                            if (!isSelected) {
                                e.target.setStyle({
                                    weight: 1.2,
                                    fillOpacity: 0.04
                                });
                            }
                        }
                    });
                }
            }).addTo(detailMap);

            // Locate target commune layer to center/zoom and place pulsing marker
            let targetLayer = null;
            detailMapGeojson.eachLayer(layer => {
                const isSelected = strip_accents_str(layer.feature.properties.nom) === strip_accents_str(elu.commune);
                if (isSelected) {
                    targetLayer = layer;
                }
            });

            if (targetLayer) {
                // Place pulsing marker in the center of the commune polygon
                const center = targetLayer.getBounds().getCenter();
                const pulseIcon = L.divIcon({
                    className: 'map-pulse-marker',
                    html: '<div class="pulse-dot"></div><div class="pulse-ring"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });
                state.detailMarker = L.marker(center, { icon: pulseIcon }).addTo(detailMap);

                // Initial Zoom: focus closely on the commune
                detailMap.fitBounds(targetLayer.getBounds(), { padding: [30, 30] });

                // Automatic Sequence: zoom out to display the commune within the whole collectivity after 1.3s
                state.zoomTimeout = setTimeout(() => {
                    if (state.currentView === 'detail' && detailMap && detailMapGeojson) {
                        detailMap.flyToBounds(detailMapGeojson.getBounds(), {
                            padding: [15, 15],
                            duration: 1.8,
                            easeLinearity: 0.25
                        });
                        
                        // Switch active control button class to global
                        if (btnCommune && btnGlobal) {
                            btnCommune.classList.remove('active');
                            btnGlobal.classList.add('active');
                        }
                    }
                }, 1300);
            } else {
                // Fallback if commune is not found
                detailMap.fitBounds(detailMapGeojson.getBounds(), { padding: [15, 15] });
                if (btnCommune && btnGlobal) {
                    btnCommune.classList.remove('active');
                    btnGlobal.classList.add('active');
                }
            }
            
            setTimeout(() => {
                detailMap.invalidateSize();
            }, 50);
        }
    }

    // Helper strings normalizer for matching communes
    function strip_accents_str(text) {
        text = text.toLowerCase().replace(/-/g, " ").strip_accents_poly();
        return text;
    }

    // Extend String prototype to remove accents (elegant helper)
    String.prototype.strip_accents_poly = function() {
        return this.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    // Detail Back Button action handler
    document.getElementById('back-btn').addEventListener('click', () => {
        // Return to whichever view we came from
        switchView(state.prevView);
    });

    // 8. Start App
    renderTrombinoscope();
});
