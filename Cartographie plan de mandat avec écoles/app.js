/* ==========================================================================
   Interactive Map Logic - Cartographie des Services
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. App State
    const state = {
        activeCategory: 'all',
        activeService: 'all',
        searchQuery: '',
        theme: 'light',
        selectedStructureId: null,
        services: [],
        editingId: null,
        activeMode: 'services', // 'services' or 'mandate'
        mandatePoints: [],
        selectedMandatePointId: null,
        editingMandateId: null,
        mandateActiveOverlays: []
    };

    // 2. Leaflet Map Variables
    let map = null;
    let markersLayer = null;
    let tileLayer = null;
    let geojsonLayer = null;
    let tempMarker = null;
    
    // Map of structure IDs to marker objects for direct lookup
    const markersMap = {};

    // 2.5. Initialize Services from LocalStorage or Default
    function initServices() {
        const version = localStorage.getItem('services_data_version');
        const currentVersion = '2026-06-17';
        
        if (version !== currentVersion) {
            // First time load of the updated app: overwrite localStorage with updated coordinates
            state.services = JSON.parse(JSON.stringify(SERVICES_DATA));
            localStorage.setItem('services_data', JSON.stringify(state.services));
            localStorage.setItem('services_data_version', currentVersion);
            return;
        }

        const stored = localStorage.getItem('services_data');
        if (stored) {
            try {
                state.services = JSON.parse(stored);
            } catch (e) {
                console.error("Error parsing stored services:", e);
                state.services = JSON.parse(JSON.stringify(SERVICES_DATA));
                localStorage.setItem('services_data', JSON.stringify(state.services));
            }
        } else {
            state.services = JSON.parse(JSON.stringify(SERVICES_DATA));
            localStorage.setItem('services_data', JSON.stringify(state.services));
        }
    }

    // 3. Tile Layer Configurations (CartoDB)
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

    // 4. Initialize Lucide Icons
    lucide.createIcons();

    // 5. Initialize the Map
    function initMap() {
        // Center of the Communauté de Communes (Saint-Julien-sur-Loire)
        const center = [45.2934, 4.1716];
        const defaultZoom = 12;

        map = L.map('map', {
            zoomControl: false // Disable default zoom control to position it customly
        }).setView(center, defaultZoom);

        // Add custom positioned zoom controls (top-right)
        L.control.zoom({
            position: 'topright'
        }).addTo(map);

        // Load theme from localStorage or default to dark
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            state.theme = savedTheme;
            document.documentElement.setAttribute('data-theme', savedTheme);
        }
        
        updateThemeToggleUI();

        // Add Tile Layer
        const activeLayerConf = TILE_LAYERS[state.theme];
        tileLayer = L.tileLayer(activeLayerConf.url, activeLayerConf.options).addTo(map);

        // Create standard Feature Group to display every marker individually
        markersLayer = L.featureGroup().addTo(map);

        // Add GeoJSON commune boundaries layer
        if (typeof BOUNDARIES_DATA !== 'undefined') {
            geojsonLayer = L.geoJSON(BOUNDARIES_DATA, {
                style: function(feature) {
                    return {
                        color: 'var(--accent-color)',
                        weight: 2,
                        dashArray: '4, 6',
                        fillColor: 'var(--accent-color)',
                        fillOpacity: state.theme === 'dark' ? 0.04 : 0.02
                    };
                },
                onEachFeature: function(feature, layer) {
                    if (feature.properties && feature.properties.nom) {
                        if (feature.properties.nom === "Solignac-le-Château") {
                            layer.bindTooltip(feature.properties.nom, {
                                permanent: true,
                                direction: 'center',
                                className: 'permanent-commune-label'
                            });
                        } else {
                            layer.bindTooltip(feature.properties.nom, {
                                sticky: true,
                                className: 'commune-tooltip',
                                direction: 'top'
                            });
                        }
                    }
                    
                    // Highlight on hover
                    layer.on({
                        mouseover: function(e) {
                            const l = e.target;
                            l.setStyle({
                                weight: 3.5,
                                fillOpacity: state.theme === 'dark' ? 0.08 : 0.04
                            });
                        },
                        mouseout: function(e) {
                            geojsonLayer.resetStyle(e.target);
                        }
                    });
                }
            }).addTo(map);

            // Zoom map to fit the boundaries
            map.fitBounds(geojsonLayer.getBounds(), {
                padding: [20, 20]
            });
        }

        // Add major geographical features (Loire river, N88, and departmental roads)
        if (typeof GEOGRAPHICAL_FEATURES !== 'undefined') {
            L.geoJSON(GEOGRAPHICAL_FEATURES, {
                style: function(feature) {
                    if (feature.properties.type === 'la_loire') {
                        return {
                            color: '#0284c7', // Sky-blue/ocean ribbon
                            weight: 5,
                            opacity: 0.65,
                            lineCap: 'round',
                            lineJoin: 'round'
                        };
                    } else if (feature.properties.type === 'n88') {
                        return {
                            color: '#e04f10', // Deep red-orange highway
                            weight: 4,
                            opacity: 0.75,
                            lineCap: 'round',
                            lineJoin: 'round'
                        };
                    } else if (['d12', 'd24', 'd44'].includes(feature.properties.type)) {
                        return {
                            color: '#d97706', // Elegant gold/amber to highlight real departmental roads
                            weight: 1.8,
                            opacity: 0.65,
                            lineCap: 'round',
                            lineJoin: 'round'
                        };
                    }
                },
                onEachFeature: function(feature, layer) {
                    let label = '';
                    const isRoad = ['d12', 'd24', 'd44'].includes(feature.properties.type);
                    
                    if (feature.properties.type === 'la_loire') {
                        label = 'La Loire (Fleuve)';
                    } else if (feature.properties.type === 'n88') {
                        label = 'Route Nationale 88 (RN88)';
                    } else if (isRoad) {
                        label = feature.properties.name;
                    }
                    
                    if (label) {
                        layer.bindTooltip(label, {
                            sticky: true,
                            className: 'feature-tooltip',
                            direction: 'top'
                        });
                    }

                    if (isRoad) {
                        layer.on({
                            mouseover: function(e) {
                                const l = e.target;
                                l.setStyle({
                                    weight: 4,
                                    opacity: 1.0,
                                    color: '#f59e0b' // Brighter amber highlight on hover
                                });
                            },
                            mouseout: function(e) {
                                const l = e.target;
                                l.setStyle({
                                    weight: 1.8,
                                    opacity: 0.65,
                                    color: '#d97706'
                                });
                            }
                        });
                    }
                }
            }).addTo(map);
        }

        // Listen to popupclose to reset active markers and card highlighting when popup is closed
        map.on('popupclose', () => {
            setTimeout(() => {
                if (!document.querySelector('.leaflet-popup')) {
                    state.selectedStructureId = null;
                    document.querySelectorAll('.result-card').forEach(card => {
                        card.classList.remove('active');
                    });
                    document.querySelectorAll('.custom-map-marker-container').forEach(m => {
                        m.classList.remove('selected-marker');
                    });
                }
            }, 50);
        });

        // Click on map to add custom mandate points
        map.on('click', (e) => {
            if (state.activeMode === 'mandate') {
                // Ignore if clicked on a marker
                if (e.originalEvent.target.closest('.custom-map-marker-container')) return;
                openMandateModal(null, e.latlng);
            }
        });
    }

    // 6. Update Theme UI and Tiles
    function toggleTheme() {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        
        // Update document attribute
        document.documentElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('theme', state.theme);
        
        updateThemeToggleUI();

        // Swap map tile layer smoothly
        if (map && tileLayer) {
            map.removeLayer(tileLayer);
            const newLayerConf = TILE_LAYERS[state.theme];
            tileLayer = L.tileLayer(newLayerConf.url, newLayerConf.options).addTo(map);
        }

        // Update GeoJSON boundaries styling for theme opacity
        if (geojsonLayer) {
            geojsonLayer.setStyle({
                fillOpacity: state.theme === 'dark' ? 0.04 : 0.02
            });
        }
    }

    function updateThemeToggleUI() {
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            // Lucide handles visibility via css class toggles in .theme-toggle-btn
            // Just refresh lucide icons if needed
        }
    }

    // 7. Data Filtering & Searching Engine
    function getFilteredData() {
        return state.services.filter(item => {
            // Category filter
            const matchCategory = state.activeCategory === 'all' || item.category === state.activeCategory;
            
            // Service name filter
            const matchService = state.activeService === 'all' || item.service === state.activeService;
            
            // Search query filter (fuzzy search on structure, manager, address, and city)
            let matchSearch = true;
            if (state.searchQuery.trim() !== '') {
                const query = state.searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                
                const struct = (item.structure || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const service = (item.service || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const mgr = (item.manager || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const addr = (item.address || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const city = (item.cp_ville || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                
                matchSearch = struct.includes(query) || 
                              service.includes(query) || 
                              mgr.includes(query) || 
                              addr.includes(query) || 
                              city.includes(query);
            }

            return matchCategory && matchService && matchSearch;
        });
    }

    // 8. Render Results List and Pins
    function render() {
        const filtered = getFilteredData();
        renderList(filtered);
        renderMarkers(filtered);
        updateCounters();
    }

    // Render Sidebar List Cards
    function renderList(data) {
        const listContainer = document.getElementById('results-list');
        const countText = document.getElementById('results-count');
        
        if (!listContainer) return;
        
        listContainer.innerHTML = '';
        countText.textContent = `${data.length} structure(s) trouvée(s)`;

        if (data.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="map" class="empty-icon"></i>
                    <p>Aucun service ne correspond à vos critères de recherche.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        data.forEach(item => {
            const card = document.createElement('div');
            card.className = `result-card ${state.selectedStructureId === item.id ? 'active' : ''}`;
            card.setAttribute('data-id', item.id);
            card.setAttribute('data-category', item.category);

            // Clean Category class name for CSS class
            const badgeClass = getCategoryClassName(item.category);

            card.innerHTML = `
                <div class="card-header-row">
                    <span class="card-badge ${badgeClass}">${item.category}</span>
                    <div class="card-actions">
                        <button class="card-action-btn edit-btn" data-id="${item.id}" title="Modifier">
                            <i data-lucide="edit-3"></i>
                        </button>
                        <button class="card-action-btn delete-btn" data-id="${item.id}" title="Supprimer">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
                <h3 class="card-title">${item.structure}</h3>
                <p class="card-service">${item.service}</p>
                
                <div class="card-info-row">
                    <i data-lucide="map-pin" class="card-info-icon"></i>
                    <span>${item.address}, ${item.cp_ville}</span>
                </div>
                <div class="card-info-row">
                    <i data-lucide="briefcase" class="card-info-icon"></i>
                    <span>Gestion : ${item.manager}</span>
                </div>
            `;

            // Card click behavior
            card.addEventListener('click', (e) => {
                // Ignore clicks on action buttons
                if (e.target.closest('.card-action-btn')) return;
                selectStructure(item.id, true); // true to center map on card click
            });

            listContainer.appendChild(card);
        });

        // Initialize Lucide icons on newly created cards
        lucide.createIcons();
    }

    // Helper to map category to CSS classes
    function getCategoryClassName(category) {
        if (category === 'Ados') return 'ados';
        if (category.includes('Enfance (2-11 ans)')) return 'enfance';
        if (category.includes('Petite Enfance')) return 'petite-enfance';
        if (category === 'Solidarités') return 'solidarites';
        if (category === 'Écoles') return 'ecoles';
        if (category === 'Collèges') return 'colleges';
        if (category === 'Lycées') return 'lycees';
        return 'all';
    }

    // Render Markers on Map
    function renderMarkers(data) {
        if (!map || !markersLayer) return;

        // Clear existing markers and mapping
        markersLayer.clearLayers();
        Object.keys(markersMap).forEach(key => delete markersMap[key]);

        const bounds = [];
        const coordOccurrences = {};

        data.forEach(item => {
            let markerLat = item.lat;
            let markerLng = item.lng;

            // Jitter duplicate coordinates so they are all visible individually
            const coordKey = `${item.lat.toFixed(5)},${item.lng.toFixed(5)}`;
            if (coordOccurrences[coordKey] !== undefined) {
                const count = coordOccurrences[coordKey];
                coordOccurrences[coordKey] = count + 1;
                
                // Offset in a spiral pattern (approx 15-20 meters distance per step)
                const angle = count * 0.75;
                const distance = 0.00018 * Math.sqrt(count);
                markerLat += distance * Math.sin(angle);
                markerLng += distance * Math.cos(angle);
            } else {
                coordOccurrences[coordKey] = 1;
            }

            // Create custom Leaflet DivIcon colored by category
            const categoryClass = getCategoryClassName(item.category);
            const divIcon = L.divIcon({
                html: `<div class="marker-pin"><div class="marker-inner-dot ${categoryClass}"></div></div>`,
                className: `custom-map-marker-container category-${categoryClass.replace('-', '_')}`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            // Create Marker using the jittered coordinates
            const marker = L.marker([markerLat, markerLng], { icon: divIcon });
            
            // Build Popup HTML
            const popupContent = buildPopupHTML(item);
            marker.bindPopup(popupContent, {
                maxWidth: 320,
                closeButton: true,
                offset: L.point(0, -6)
            });

            // Sync card state when popup opens
            marker.on('popupopen', () => {
                selectStructure(item.id, false); // false, because map is already centered on marker
            });

            // Marker click
            marker.on('click', () => {
                // Focus marker
                highlightMarker(item.id);
            });

            markersLayer.addLayer(marker);
            markersMap[item.id] = marker;
            bounds.push([markerLat, markerLng]);
        });

        // Auto pan map to fit markers if there are results and filters are active
        if (bounds.length > 0 && (state.activeCategory !== 'all' || state.activeService !== 'all' || state.searchQuery.trim() !== '')) {
            map.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 14
            });
        } else if (geojsonLayer) {
            map.fitBounds(geojsonLayer.getBounds(), {
                padding: [30, 30]
            });
        }
    }

    // Custom Popup structure
    function buildPopupHTML(item) {
        const categoryClass = getCategoryClassName(item.category);
        const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address + ', ' + item.cp_ville)}`;

        // Handling custom text for itinerant MFS service
        const isItinerary = item.address.toLowerCase().includes("dans toutes les communes");
        const addressText = isItinerary ? "Itinérant (voir planning communal)" : item.address;
        const cpText = isItinerary ? "Marches du Velay-Rochebaron" : item.cp_ville;

        return `
            <div class="popup-container">
                <header class="popup-header-banner ${categoryClass}">
                    <span class="popup-category-label">${item.category}</span>
                    <h4 class="popup-title">${item.structure}</h4>
                </header>
                <div class="popup-body">
                    <p class="popup-service-title">${item.service}</p>
                    <div class="popup-info-list">
                        <div class="popup-info-item">
                            <i data-lucide="map-pin" class="popup-info-icon"></i>
                            <span>${addressText}<br><strong>${cpText}</strong></span>
                        </div>
                        <div class="popup-info-item">
                            <i data-lucide="briefcase" class="popup-info-icon"></i>
                            <span>Gestion : ${item.manager}</span>
                        </div>
                    </div>
                    <div class="popup-actions">
                        <a href="${mapUrl}" target="_blank" class="popup-directions-btn">
                            <i data-lucide="navigation" class="popup-directions-btn-icon"></i>
                            Itinéraire
                        </a>
                        <div class="popup-admin-actions">
                            <button class="popup-action-btn edit-btn" data-id="${item.id}" title="Modifier">
                                <i data-lucide="edit-3" class="popup-action-icon"></i>
                            </button>
                            <button class="popup-action-btn delete-btn" data-id="${item.id}" title="Supprimer">
                                <i data-lucide="trash-2" class="popup-action-icon"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Coordinate state update between list and marker click
    function selectStructure(id, flyToMarker = false) {
        state.selectedStructureId = id;

        // Highlight card in sidebar list
        document.querySelectorAll('.result-card').forEach(card => {
            if (parseInt(card.getAttribute('data-id')) === id) {
                card.classList.add('active');
                // Scroll card into view inside scroll container
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                card.classList.remove('active');
            }
        });

        // Highlight marker
        highlightMarker(id);

        // Fly to and open popup on click from list
        if (flyToMarker && markersMap[id]) {
            const marker = markersMap[id];
            map.flyTo(marker.getLatLng(), 15, { duration: 1.2 });
            setTimeout(() => {
                marker.openPopup();
            }, 400);
        }
    }

    // Highlight marker with select CSS styling
    function highlightMarker(id) {
        // Reset previously selected marker style
        document.querySelectorAll('.custom-map-marker-container').forEach(m => {
            m.classList.remove('selected-marker');
        });

        // Add style to selected marker
        if (markersMap[id]) {
            const element = markersMap[id].getElement();
            if (element) {
                element.classList.add('selected-marker');
            }
        }
    }

    // 9. Filters Population
    function populateServiceSelect() {
        const serviceSelect = document.getElementById('service-select');
        if (!serviceSelect) return;

        // Save current selection to restore if possible
        const prevValue = state.activeService;

        // Reset list, preserve first "All" option
        serviceSelect.innerHTML = '<option value="all">Tous les services</option>';

        // Extract services matching the current active category
        const uniqueServices = new Set();
        state.services.forEach(item => {
            if (state.activeCategory === 'all' || item.category === state.activeCategory) {
                uniqueServices.add(item.service);
            }
        });

        // Sort alphabetically
        const sortedServices = Array.from(uniqueServices).sort();

        sortedServices.forEach(service => {
            const option = document.createElement('option');
            option.value = service;
            option.textContent = service;
            serviceSelect.appendChild(option);
        });

        // Restore value if it is still valid
        if (uniqueServices.has(prevValue)) {
            state.activeService = prevValue;
            serviceSelect.value = prevValue;
        } else {
            state.activeService = 'all';
            serviceSelect.value = 'all';
        }
    }

    // Update Counter Badges on Category pills
    function updateCounters() {
        const counts = {
            all: 0,
            Ados: 0,
            'Enfance (2-11 ans)': 0,
            'Petite Enfance (0-6 ans)': 0,
            Solidarités: 0,
            'Écoles': 0,
            'Collèges': 0,
            'Lycées': 0
        };

        // We count elements matching the text search query (for cross-counters)
        state.services.forEach(item => {
            let matchSearch = true;
            if (state.searchQuery.trim() !== '') {
                const query = state.searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const struct = (item.structure || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const service = (item.service || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const mgr = (item.manager || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const addr = (item.address || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const city = (item.cp_ville || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                
                matchSearch = struct.includes(query) || 
                              service.includes(query) || 
                              mgr.includes(query) || 
                              addr.includes(query) || 
                              city.includes(query);
            }

            if (matchSearch) {
                counts.all++;
                if (counts[item.category] !== undefined) {
                    counts[item.category]++;
                }
            }
        });

        // Update counts in DOM
        document.getElementById('count-all').textContent = counts.all;
        document.getElementById('count-ados').textContent = counts['Ados'];
        document.getElementById('count-enfance').textContent = counts['Enfance (2-11 ans)'];
        document.getElementById('count-petite-enfance').textContent = counts['Petite Enfance (0-6 ans)'];
        document.getElementById('count-solidarites').textContent = counts['Solidarités'];
        document.getElementById('count-ecoles').textContent = counts['Écoles'];
        document.getElementById('count-colleges').textContent = counts['Collèges'];
        document.getElementById('count-lycees').textContent = counts['Lycées'];
    }

    // ==========================================================================
    // Mandate Planning (Carte Vierge) Logic & Calculations
    // ==========================================================================
    
    let mandateTempMarker = null;
    const mandateMarkersMap = {};

    function initMandatePoints() {
        const stored = localStorage.getItem('mandate_points');
        if (stored) {
            try {
                state.mandatePoints = JSON.parse(stored);
            } catch (e) {
                console.error("Error parsing stored mandate points:", e);
                state.mandatePoints = [];
            }
        } else {
            state.mandatePoints = [];
        }
    }

    function saveMandatePoints() {
        localStorage.setItem('mandate_points', JSON.stringify(state.mandatePoints));
    }

    function renderMandate() {
        if (state.activeMode !== 'mandate') return;
        renderMandateList();
        renderMandateMarkers();
        updateMandateCounters();
    }

    function updateMandateCounters() {
        const countText = document.getElementById('mandate-count');
        if (countText) {
            countText.textContent = `${state.mandatePoints.length} point(s) placé(s)`;
        }
    }

    function getMandateTypeClass(services) {
        if (!services || !Array.isArray(services) || services.length === 0) return 'autre';
        if (services.length > 1) return 'multi';
        const type = services[0];
        if (type === 'Péri matin') return 'péri_matin';
        if (type.includes('Midi')) return 'midi';
        if (type === 'Péri soir') return 'péri_soir';
        if (type === 'Mercredi') return 'mercredi';
        if (type === 'Extrascolaire') return 'extrascolaire';
        if (type.includes('Crèche')) return 'crèche';
        return 'autre';
    }

    function renderMandateList() {
        const listContainer = document.getElementById('mandate-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        if (state.mandatePoints.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="edit-3" class="empty-icon"></i>
                    <p>Aucun point placé. Cliquez sur la carte pour ajouter un service à réorganiser.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        const sorted = [...state.mandatePoints].sort((a, b) => b.id - a.id);

        sorted.forEach(item => {
            const card = document.createElement('div');
            const servicesList = item.services || [item.type || 'Autre'];
            const isMulti = servicesList.length > 1;
            
            card.className = `result-card ${state.selectedMandatePointId === item.id ? 'active' : ''}`;
            card.setAttribute('data-id', item.id);
            card.setAttribute('data-mandate-multi', isMulti ? 'true' : 'false');
            card.setAttribute('data-mandate-type', isMulti ? '' : servicesList[0]);

            let badgesHTML = '';
            servicesList.forEach(srv => {
                const typeClass = getMandateTypeClass([srv]).replace('_', '-');
                badgesHTML += `<span class="card-badge mandate-badge ${typeClass}" style="margin-right: 4px; margin-bottom: 4px; display: inline-block;">${srv}</span>`;
            });

            card.innerHTML = `
                <div class="card-header-row" style="flex-wrap: wrap; gap: 4px;">
                    <div style="flex-grow: 1; display: flex; flex-wrap: wrap;">
                        ${badgesHTML}
                    </div>
                    <div class="card-actions">
                        <button class="card-action-btn edit-mandate-btn" data-id="${item.id}" title="Modifier">
                            <i data-lucide="edit-3"></i>
                        </button>
                        <button class="card-action-btn delete-mandate-btn" data-id="${item.id}" title="Supprimer">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
                <h3 class="card-title" style="margin-top: 8px;">${item.name}</h3>
                
                <div class="card-info-row">
                    <i data-lucide="map-pin" class="card-info-icon"></i>
                    <span>GPS : ${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}</span>
                </div>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-action-btn')) return;
                selectMandatePoint(item.id, true);
            });

            listContainer.appendChild(card);
        });

        lucide.createIcons();
    }

    function renderMandateMarkers() {
        if (!map || !markersLayer) return;

        markersLayer.clearLayers();
        Object.keys(mandateMarkersMap).forEach(key => delete mandateMarkersMap[key]);

        // 1. Draw standard overlaid facilities (fixed reference anchors)
        state.services.forEach(item => {
            if (state.mandateActiveOverlays.includes(item.category)) {
                const categoryClass = getCategoryClassName(item.category);
                const divIcon = L.divIcon({
                    html: `<div class="marker-pin"><div class="marker-inner-dot ${categoryClass}"></div></div>`,
                    className: `custom-map-marker-container category-${categoryClass.replace('-', '_')} fixed-facility-marker`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });

                const marker = L.marker([item.lat, item.lng], { icon: divIcon });
                
                const popupContent = `
                    <div class="popup-container">
                        <header class="popup-header-banner ${categoryClass}">
                            <span class="popup-category-label">INFRASTRUCTURE FIXE</span>
                            <h4 class="popup-title">${item.structure}</h4>
                        </header>
                        <div class="popup-body">
                            <p class="popup-service-title" style="margin-bottom:8px;">${item.service}</p>
                            <div class="popup-info-list" style="gap:6px; display:flex; flex-direction:column;">
                                <div class="popup-info-item">
                                    <i data-lucide="map-pin" class="popup-info-icon"></i>
                                    <span>${item.address}<br><strong>${item.cp_ville}</strong></span>
                                </div>
                                <div class="popup-info-item">
                                    <i data-lucide="briefcase" class="popup-info-icon"></i>
                                    <span>Gestion : ${item.manager}</span>
                                </div>
                            </div>
                            <div style="margin-top:12px; padding:8px; background:rgba(0,0,0,0.04); border-radius:6px; font-size:0.72rem; font-weight:600; text-align:center; color:var(--text-muted); border: 1px dashed var(--border-color);">
                                <i data-lucide="lock" style="width:12px; height:12px; display:inline-block; vertical-align:text-bottom; margin-right:4px;"></i>
                                Élément existant non-déplaçable
                            </div>
                        </div>
                    </div>
                `;
                
                marker.bindPopup(popupContent, {
                    maxWidth: 320,
                    closeButton: true,
                    offset: L.point(0, -6)
                });
                
                markersLayer.addLayer(marker);
            }
        });

        // 2. Draw customizable mandate points (movable)
        state.mandatePoints.forEach(item => {
            const typeClass = getMandateTypeClass(item.services || [item.type || 'Autre']);
            const divIcon = L.divIcon({
                html: `<div class="marker-pin"><div class="marker-inner-dot"></div></div>`,
                className: `custom-map-marker-container mandate-marker-${typeClass} mandate-point-marker`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            const marker = L.marker([item.lat, item.lng], { icon: divIcon });
            
            const popupContent = buildMandatePopupHTML(item);
            marker.bindPopup(popupContent, {
                maxWidth: 320,
                closeButton: true,
                offset: L.point(0, -6)
            });

            marker.on('popupopen', () => {
                selectMandatePoint(item.id, false);
            });

            marker.on('click', () => {
                highlightMandateMarker(item.id);
            });

            markersLayer.addLayer(marker);
            mandateMarkersMap[item.id] = marker;
        });
        
        // Ensure Lucide icons render inside dynamically opened Leaflet popups
        map.on('popupopen', () => {
            lucide.createIcons();
        });
    }

    function buildMandatePopupHTML(item) {
        const servicesList = item.services || [item.type || 'Autre'];
        let badgesHTML = '';
        servicesList.forEach(srv => {
            const typeClass = getMandateTypeClass([srv]).replace('_', '-');
            badgesHTML += `<span class="card-badge mandate-badge ${typeClass}" style="margin-right: 4px; margin-bottom: 4px; display: inline-block;">${srv}</span>`;
        });

        return `
            <div class="popup-container">
                <header class="popup-header-banner" style="background-color: var(--accent-color); padding: 12px 16px;">
                    <span class="popup-category-label" style="background:rgba(255,255,255,0.25); color:white; border:none;">Point de services</span>
                    <h4 class="popup-title" style="margin-top:6px; color:white; font-size:1.05rem;">${item.name}</h4>
                </header>
                <div class="popup-body" style="padding: 16px;">
                    <div style="display:flex; flex-wrap:wrap; margin-bottom:10px;">
                        ${badgesHTML}
                    </div>
                    <div class="popup-info-list" style="gap:6px; display:flex; flex-direction:column;">
                        <div class="popup-info-item">
                            <i data-lucide="map-pin" class="popup-info-icon"></i>
                            <span>GPS : ${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}</span>
                        </div>
                    </div>
                    <div class="popup-actions" style="margin-top:12px; display:flex; justify-content:flex-end;">
                        <div class="popup-admin-actions" style="display:flex; gap:6px;">
                            <button class="popup-action-btn edit-mandate-btn" data-id="${item.id}" title="Modifier">
                                <i data-lucide="edit-3" class="popup-action-icon"></i>
                            </button>
                            <button class="popup-action-btn delete-mandate-btn" data-id="${item.id}" title="Supprimer">
                                <i data-lucide="trash-2" class="popup-action-icon"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function selectMandatePoint(id, flyToMarker = false) {
        state.selectedMandatePointId = id;

        document.querySelectorAll('#mandate-list .result-card').forEach(card => {
            if (parseInt(card.getAttribute('data-id')) === id) {
                card.classList.add('active');
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                card.classList.remove('active');
            }
        });

        highlightMandateMarker(id);

        if (flyToMarker && mandateMarkersMap[id]) {
            const marker = mandateMarkersMap[id];
            map.flyTo(marker.getLatLng(), 15, { duration: 1.2 });
            setTimeout(() => {
                marker.openPopup();
            }, 400);
        }
    }

    function highlightMandateMarker(id) {
        document.querySelectorAll('.custom-map-marker-container').forEach(m => {
            m.classList.remove('selected-marker');
        });

        if (mandateMarkersMap[id]) {
            const element = mandateMarkersMap[id].getElement();
            if (element) {
                element.classList.add('selected-marker');
            }
        }
    }

    function openMandateModal(id, latlng = null) {
        const modal = document.getElementById('mandate-modal');
        if (!modal) return;

        // Reset checkboxes first
        document.querySelectorAll('input[name="mandate-services"]').forEach(cb => cb.checked = false);

        if (id) {
            state.editingMandateId = parseInt(id);
            const item = state.mandatePoints.find(p => p.id === state.editingMandateId);
            if (!item) return;

            document.getElementById('mandate-modal-title').textContent = "Modifier le point de services";
            document.getElementById('form-mandate-id').value = item.id;
            document.getElementById('form-mandate-name').value = item.name;
            
            // Fill checkboxes based on services array
            if (item.services && Array.isArray(item.services)) {
                item.services.forEach(srv => {
                    const cb = document.querySelector(`input[name="mandate-services"][value="${srv}"]`);
                    if (cb) cb.checked = true;
                });
            } else if (item.type) {
                const cb = document.querySelector(`input[name="mandate-services"][value="${item.type}"]`);
                if (cb) cb.checked = true;
            }

            document.getElementById('form-mandate-lat').value = item.lat.toFixed(7);
            document.getElementById('form-mandate-lng').value = item.lng.toFixed(7);

            const marker = mandateMarkersMap[state.editingMandateId];
            if (marker) {
                marker.dragging.enable();
                marker.on('dragend', (e) => {
                    const position = marker.getLatLng();
                    document.getElementById('form-mandate-lat').value = position.lat.toFixed(7);
                    document.getElementById('form-mandate-lng').value = position.lng.toFixed(7);
                });
                map.panTo(marker.getLatLng());
            }
        } else {
            state.editingMandateId = null;
            document.getElementById('mandate-modal-title').textContent = "Nouveau point de services";
            document.getElementById('mandate-form').reset();
            document.getElementById('form-mandate-id').value = '';
            document.getElementById('form-mandate-lat').value = latlng.lat.toFixed(7);
            document.getElementById('form-mandate-lng').value = latlng.lng.toFixed(7);

            createMandateTempMarker(latlng);
            map.panTo(latlng);
        }

        modal.classList.add('active');
    }

    function closeMandateModal() {
        const modal = document.getElementById('mandate-modal');
        if (modal) modal.classList.remove('active');

        if (mandateTempMarker) {
            map.removeLayer(mandateTempMarker);
            mandateTempMarker = null;
        }

        if (state.editingMandateId && mandateMarkersMap[state.editingMandateId]) {
            mandateMarkersMap[state.editingMandateId].dragging.disable();
        }

        state.editingMandateId = null;
        document.getElementById('mandate-form').reset();
        renderMandate();
    }

    function createMandateTempMarker(latlng) {
        if (mandateTempMarker) map.removeLayer(mandateTempMarker);

        const checkedBoxes = document.querySelectorAll('input[name="mandate-services"]:checked');
        const services = Array.from(checkedBoxes).map(cb => cb.value);
        const typeClass = getMandateTypeClass(services);

        const divIcon = L.divIcon({
            html: `<div class="marker-pin"><div class="marker-inner-dot"></div></div>`,
            className: `custom-map-marker-container mandate-marker-${typeClass} temp-marker`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        mandateTempMarker = L.marker(latlng, { icon: divIcon, draggable: true }).addTo(map);

        mandateTempMarker.on('dragend', (e) => {
            const position = mandateTempMarker.getLatLng();
            document.getElementById('form-mandate-lat').value = position.lat.toFixed(7);
            document.getElementById('form-mandate-lng').value = position.lng.toFixed(7);
        });
    }

    function deleteMandatePoint(id) {
        const item = state.mandatePoints.find(p => p.id === id);
        if (!item) return;

        if (confirm(`Supprimer le point "${item.name}" ?`)) {
            state.mandatePoints = state.mandatePoints.filter(p => p.id !== id);
            saveMandatePoints();
            map.closePopup();
            renderMandate();
        }
    }

    function switchMode(mode) {
        state.activeMode = mode;

        const servicesBtn = document.getElementById('mode-services-btn');
        const mandateBtn = document.getElementById('mode-mandate-btn');
        const controlsSection = document.getElementById('controls-section');
        const resultsSection = document.querySelector('.results-section');
        const mandateSection = document.getElementById('mandate-section');

        if (mode === 'mandate') {
            if (servicesBtn) servicesBtn.classList.remove('active');
            if (mandateBtn) mandateBtn.classList.add('active');
            if (controlsSection) controlsSection.style.display = 'none';
            if (resultsSection) resultsSection.style.display = 'none';
            if (mandateSection) mandateSection.style.display = 'flex';

            if (markersLayer) markersLayer.clearLayers();
            renderMandate();
        } else {
            if (servicesBtn) servicesBtn.classList.add('active');
            if (mandateBtn) mandateBtn.classList.remove('active');
            if (controlsSection) controlsSection.style.display = 'flex';
            if (resultsSection) resultsSection.style.display = 'flex';
            if (mandateSection) mandateSection.style.display = 'none';

            render();
        }
        
        if (map) {
            map.closePopup();
            setTimeout(() => map.invalidateSize(), 100);
        }
    }

    // Geodesic Distance helper
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; 
        return parseFloat(d.toFixed(3)); // meters accuracy
    }

    function getNearestFacility(customLat, customLng, category, filterFn = null) {
        let minDistance = Infinity;
        let nearestFacility = null;
        
        state.services.forEach(facility => {
            if (facility.category === category && (!filterFn || filterFn(facility))) {
                const dist = calculateDistance(customLat, customLng, facility.lat, facility.lng);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestFacility = {
                        structure: facility.structure,
                        address: facility.address,
                        cp_ville: facility.cp_ville,
                        distanceKm: dist
                    };
                }
            }
        });
        
        return nearestFacility;
    }

    function getNearestFacilities(lat, lng) {
        return {
            nearestPublicSchool: getNearestFacility(lat, lng, 'Écoles', f => f.service === 'École Publique'),
            nearestPrivateSchool: getNearestFacility(lat, lng, 'Écoles', f => f.service === 'École Privée'),
            nearestCollege: getNearestFacility(lat, lng, 'Collèges'),
            nearestLycee: getNearestFacility(lat, lng, 'Lycées')
        };
    }

    function exportMandateDataForAI() {
        if (state.mandatePoints.length === 0) {
            alert("Aucun point à exporter. Veuillez placer au moins un point d'intérêt.");
            return;
        }

        const exportedData = state.mandatePoints.map(point => {
            const proximites = getNearestFacilities(point.lat, point.lng);
            return {
                id: point.id,
                nom: point.name,
                services: point.services || [],
                coordonnees: {
                    latitude: point.lat,
                    longitude: point.lng
                },
                proximites_km: {
                    ecole_publique_la_plus_proche: proximites.nearestPublicSchool ? {
                        nom: proximites.nearestPublicSchool.structure,
                        adresse: proximites.nearestPublicSchool.address + ", " + proximites.nearestPublicSchool.cp_ville,
                        distance_km: proximites.nearestPublicSchool.distanceKm
                    } : null,
                    ecole_privee_la_plus_proche: proximites.nearestPrivateSchool ? {
                        nom: proximites.nearestPrivateSchool.structure,
                        adresse: proximites.nearestPrivateSchool.address + ", " + proximites.nearestPrivateSchool.cp_ville,
                        distance_km: proximites.nearestPrivateSchool.distanceKm
                    } : null,
                    college_le_plus_proche: proximites.nearestCollege ? {
                        nom: proximites.nearestCollege.structure,
                        adresse: proximites.nearestCollege.address + ", " + proximites.nearestCollege.cp_ville,
                        distance_km: proximites.nearestCollege.distanceKm
                    } : null,
                    lycee_le_plus_proche: proximites.nearestLycee ? {
                        nom: proximites.nearestLycee.structure,
                        adresse: proximites.nearestLycee.address + ", " + proximites.nearestLycee.cp_ville,
                        distance_km: proximites.nearestLycee.distanceKm
                    } : null
                }
            };
        });

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportedData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "plan_mandat_ia_export.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    }

    // 10. Event Listeners Setup
    // Nominatim Geocoding API helper with Timeout
    // Geocoding API helper with Timeout and selectable Service
    async function geocodeAddress(address, cpVille, service = 'ban', timeoutSec = 3) {
        const query = `${address}, ${cpVille}`;
        let searchUrl = '';
        
        if (service === 'ban') {
            searchUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`;
        } else {
            searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        }
        
        const controller = new AbortController();
        const timeoutMs = timeoutSec * 1000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
            const fetchOptions = {
                signal: controller.signal
            };
            
            // Nominatim recommends User-Agent
            if (service === 'nominatim') {
                fetchOptions.headers = {
                    'User-Agent': 'VelayRochebaronMapCRUD/1.0'
                };
            }
            
            const response = await fetch(searchUrl, fetchOptions);
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            const data = await response.json();
            
            if (service === 'ban') {
                if (data && data.features && data.features.length > 0) {
                    const feature = data.features[0];
                    const coords = feature.geometry.coordinates; // [longitude, latitude] in GeoJSON!
                    return {
                        lat: parseFloat(coords[1]),
                        lon: parseFloat(coords[0]),
                        label: feature.properties.label
                    };
                } else {
                    throw new Error("Aucun résultat trouvé pour cette adresse sur la Base Adresse Nationale.");
                }
            } else {
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    return {
                        lat,
                        lon,
                        label: data[0].display_name
                    };
                } else {
                    throw new Error("Aucun résultat trouvé pour cette adresse sur Nominatim.");
                }
            }
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`La recherche API a expiré après ${timeoutSec} seconde(s).`);
            }
            throw error;
        }
    }

    const modal = document.getElementById('service-modal');
    const closeBtn = document.getElementById('close-modal');
    const cancelBtn = document.getElementById('cancel-modal');
    const serviceForm = document.getElementById('service-form');
    const addBtn = document.getElementById('add-service-btn');
    
    function closeModal() {
        if (!modal) return;
        modal.classList.remove('active');
        
        map.off('click', onMapClickForPosition);
        
        if (tempMarker) {
            map.removeLayer(tempMarker);
            tempMarker = null;
        }
        
        if (state.editingId && markersMap[state.editingId]) {
            markersMap[state.editingId].dragging.disable();
        }
        
        state.editingId = null;
        if (serviceForm) serviceForm.reset();
        
        // Reset API settings accordion
        const apiSettingsToggle = document.getElementById('api-settings-toggle');
        const apiSettingsContent = document.getElementById('api-settings-content');
        if (apiSettingsToggle && apiSettingsContent) {
            apiSettingsToggle.classList.remove('active');
            apiSettingsContent.classList.remove('active');
        }
        
        render();
    }
    
    function createTempMarker(latlng) {
        if (tempMarker) map.removeLayer(tempMarker);
        
        const categoryVal = document.getElementById('form-category').value;
        const categoryClass = getCategoryClassName(categoryVal);
        
        const divIcon = L.divIcon({
            html: `<div class="marker-pin"><div class="marker-inner-dot ${categoryClass}"></div></div>`,
            className: `custom-map-marker-container category-${categoryClass.replace('-', '_')} temp-marker`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
        
        tempMarker = L.marker(latlng, { icon: divIcon, draggable: true }).addTo(map);
        
        tempMarker.on('dragend', (e) => {
            const position = tempMarker.getLatLng();
            document.getElementById('form-lat').value = position.lat.toFixed(7);
            document.getElementById('form-lng').value = position.lng.toFixed(7);
        });
    }

    function onMapClickForPosition(e) {
        const newLatLng = e.latlng;
        if (tempMarker) {
            tempMarker.setLatLng(newLatLng);
            document.getElementById('form-lat').value = newLatLng.lat.toFixed(7);
            document.getElementById('form-lng').value = newLatLng.lng.toFixed(7);
        } else if (state.editingId && markersMap[state.editingId]) {
            markersMap[state.editingId].setLatLng(newLatLng);
            document.getElementById('form-lat').value = newLatLng.lat.toFixed(7);
            document.getElementById('form-lng').value = newLatLng.lng.toFixed(7);
        }
    }

    function openEditModal(id) {
        state.editingId = parseInt(id);
        const item = state.services.find(s => s.id === state.editingId);
        if (!item) return;
        
        document.getElementById('modal-title').textContent = "Modifier la structure";
        document.getElementById('form-id').value = item.id;
        document.getElementById('form-structure').value = item.structure;
        document.getElementById('form-category').value = item.category;
        document.getElementById('form-service').value = item.service;
        document.getElementById('form-address').value = item.address;
        document.getElementById('form-cp-ville').value = item.cp_ville;
        document.getElementById('form-manager').value = item.manager;
        document.getElementById('form-lat').value = item.lat.toFixed(7);
        document.getElementById('form-lng').value = item.lng.toFixed(7);
        
        const marker = markersMap[state.editingId];
        if (marker) {
            marker.dragging.enable();
            marker.on('dragend', (e) => {
                const position = marker.getLatLng();
                document.getElementById('form-lat').value = position.lat.toFixed(7);
                document.getElementById('form-lng').value = position.lng.toFixed(7);
            });
            map.panTo(marker.getLatLng());
        }
        
        map.on('click', onMapClickForPosition);
        
        if (modal) modal.classList.add('active');
    }

    function deleteStructure(id) {
        const item = state.services.find(s => s.id === id);
        if (!item) return;
        
        const confirmMsg = `Êtes-vous sûr de vouloir supprimer la structure "${item.structure}" ? Cette action est irréversible.`;
        if (confirm(confirmMsg)) {
            state.services = state.services.filter(s => s.id !== id);
            localStorage.setItem('services_data', JSON.stringify(state.services));
            map.closePopup();
            render();
            populateServiceSelect();
        }
    }

    function setupEvents() {
        // Theme switch
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', toggleTheme);
        }

        // Search Input
        const searchInput = document.getElementById('search-input');
        const clearBtn = document.getElementById('clear-search');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                state.searchQuery = e.target.value;
                if (state.searchQuery.trim() !== '') {
                    clearBtn.style.display = 'flex';
                } else {
                    clearBtn.style.display = 'none';
                }
                
                populateServiceSelect();
                render();
            });
        }

        // Clear Search Button
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                state.searchQuery = '';
                clearBtn.style.display = 'none';
                populateServiceSelect();
                render();
                searchInput.focus();
            });
        }

        // Category Pills Click
        const categoryPills = document.getElementById('category-pills');
        if (categoryPills) {
            categoryPills.addEventListener('click', (e) => {
                const pill = e.target.closest('.category-pill');
                if (!pill) return;

                document.querySelectorAll('.category-pill').forEach(btn => btn.classList.remove('active'));
                pill.classList.add('active');

                state.activeCategory = pill.getAttribute('data-category');
                state.activeService = 'all';
                populateServiceSelect();
                state.selectedStructureId = null;
                render();
            });
        }

        // Service Select Change
        const serviceSelect = document.getElementById('service-select');
        if (serviceSelect) {
            serviceSelect.addEventListener('change', (e) => {
                state.activeService = e.target.value;
                state.selectedStructureId = null;
                render();
            });
        }

        // Reset Filters Button
        const resetBtn = document.getElementById('reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (searchInput) {
                    searchInput.value = '';
                    state.searchQuery = '';
                    clearBtn.style.display = 'none';
                }

                document.querySelectorAll('.category-pill').forEach(btn => btn.classList.remove('active'));
                const allPill = document.querySelector('.category-pill[data-category="all"]');
                if (allPill) allPill.classList.add('active');
                state.activeCategory = 'all';

                state.activeService = 'all';
                populateServiceSelect();
                state.selectedStructureId = null;
                render();
            });
        }

        // Sidebar Collapsible Toggle (Drawer)
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebar-toggle-btn');
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                setTimeout(() => {
                    if (map) map.invalidateSize();
                }, 310);
            });
        }

        // Modal triggers and save logic
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        


        const formCategorySelect = document.getElementById('form-category');
        if (formCategorySelect) {
            formCategorySelect.addEventListener('change', () => {
                if (tempMarker) {
                    createTempMarker(tempMarker.getLatLng());
                }
            });
        }

        // Geocoder button
        const geocodeBtn = document.getElementById('search-address-api-btn');
        if (geocodeBtn) {
            geocodeBtn.addEventListener('click', async () => {
                const address = document.getElementById('form-address').value.trim();
                const cpVille = document.getElementById('form-cp-ville').value.trim();
                
                if (!address || !cpVille) {
                    alert("Veuillez remplir l'adresse et le code postal/ville avant de rechercher.");
                    return;
                }
                
                const service = document.getElementById('form-api-service').value;
                let timeoutVal = parseInt(document.getElementById('form-api-timeout').value);
                if (isNaN(timeoutVal) || timeoutVal < 1) timeoutVal = 3;
                
                geocodeBtn.disabled = true;
                const originalText = geocodeBtn.innerHTML;
                geocodeBtn.innerHTML = `<span>Recherche en cours...</span>`;
                
                try {
                    const coords = await geocodeAddress(address, cpVille, service, timeoutVal);
                    
                    document.getElementById('form-lat').value = coords.lat.toFixed(7);
                    document.getElementById('form-lng').value = coords.lon.toFixed(7);
                    
                    const newLatLng = L.latLng(coords.lat, coords.lon);
                    if (tempMarker) {
                        tempMarker.setLatLng(newLatLng);
                        map.panTo(newLatLng);
                    } else if (state.editingId && markersMap[state.editingId]) {
                        markersMap[state.editingId].setLatLng(newLatLng);
                        map.panTo(newLatLng);
                    }
                    
                    alert(`Adresse géocodée avec succès via ${service === 'ban' ? 'la Base Adresse Nationale' : 'Nominatim'} !`);
                } catch (error) {
                    console.error(error);
                    alert(`Erreur de géocodage : ${error.message}\n\nVous pouvez toujours placer le marqueur manuellement sur la carte ou le faire glisser.`);
                } finally {
                    geocodeBtn.disabled = false;
                    geocodeBtn.innerHTML = originalText;
                }
            });
        }

        // Toggle API settings accordion
        const apiSettingsToggle = document.getElementById('api-settings-toggle');
        const apiSettingsContent = document.getElementById('api-settings-content');
        if (apiSettingsToggle && apiSettingsContent) {
            apiSettingsToggle.addEventListener('click', () => {
                apiSettingsToggle.classList.toggle('active');
                apiSettingsContent.classList.toggle('active');
            });
        }

        if (serviceForm) {
            serviceForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const idVal = document.getElementById('form-id').value;
                const structure = document.getElementById('form-structure').value.trim();
                const category = document.getElementById('form-category').value;
                const service = document.getElementById('form-service').value.trim();
                const address = document.getElementById('form-address').value.trim();
                const cp_ville = document.getElementById('form-cp-ville').value.trim();
                const manager = document.getElementById('form-manager').value.trim();
                const lat = parseFloat(document.getElementById('form-lat').value);
                const lng = parseFloat(document.getElementById('form-lng').value);
                
                if (isNaN(lat) || isNaN(lng)) {
                    alert("Veuillez spécifier des coordonnées valides (latitude et longitude).");
                    return;
                }
                
                if (idVal) {
                    const id = parseInt(idVal);
                    const index = state.services.findIndex(s => s.id === id);
                    if (index !== -1) {
                        state.services[index] = {
                            id,
                            category,
                            service,
                            structure,
                            address,
                            cp_ville,
                            manager,
                            lat,
                            lng
                        };
                    }
                } else {
                    const nextId = state.services.reduce((max, s) => s.id > max ? s.id : max, 0) + 1;
                    state.services.push({
                        id: nextId,
                        category,
                        service,
                        structure,
                        address,
                        cp_ville,
                        manager,
                        lat,
                        lng
                    });
                }
                
                localStorage.setItem('services_data', JSON.stringify(state.services));
                closeModal();
                populateServiceSelect();
                render();
            });
        }

        // Document click delegation for Edit/Delete and Dropdown
        document.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            if (editBtn) {
                e.stopPropagation();
                e.preventDefault();
                const id = editBtn.getAttribute('data-id');
                openEditModal(id);
                return;
            }
            
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                e.preventDefault();
                const id = parseInt(deleteBtn.getAttribute('data-id'));
                deleteStructure(id);
                return;
            }
            
            const editMandateBtn = e.target.closest('.edit-mandate-btn');
            if (editMandateBtn) {
                e.stopPropagation();
                e.preventDefault();
                const id = editMandateBtn.getAttribute('data-id');
                openMandateModal(id);
                return;
            }
            
            const deleteMandateBtn = e.target.closest('.delete-mandate-btn');
            if (deleteMandateBtn) {
                e.stopPropagation();
                e.preventDefault();
                const id = parseInt(deleteMandateBtn.getAttribute('data-id'));
                deleteMandatePoint(id);
                return;
            }
            
            const dbBtn = e.target.closest('#data-manage-btn');
            if (dbBtn) {
                e.stopPropagation();
                const menu = document.getElementById('data-dropdown-menu');
                if (menu) menu.classList.toggle('active');
                return;
            }
            
            const menu = document.getElementById('data-dropdown-menu');
            if (menu && menu.classList.contains('active') && !e.target.closest('.data-dropdown-container')) {
                menu.classList.remove('active');
            }
        });

        // JSON Export
        const exportBtn = document.getElementById('export-json-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.services, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", "services_data.json");
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
            });
        }

        // JSON Import
        const importBtn = document.getElementById('import-json-btn');
        const importFileInput = document.getElementById('import-file-input');
        
        if (importBtn && importFileInput) {
            importBtn.addEventListener('click', () => {
                importFileInput.click();
            });
            
            importFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        const imported = JSON.parse(evt.target.result);
                        
                        if (!Array.isArray(imported)) {
                            throw new Error("Le fichier importé doit être une liste (tableau JSON).");
                        }
                        
                        imported.forEach((item, index) => {
                            const required = ['id', 'structure', 'category', 'service', 'address', 'cp_ville', 'manager', 'lat', 'lng'];
                            required.forEach(field => {
                                if (item[field] === undefined || item[field] === null) {
                                    throw new Error(`Élément à l'index ${index} manquant pour le champ obligatoire "${field}".`);
                                }
                            });
                            if (typeof item.lat !== 'number' || typeof item.lng !== 'number') {
                                    throw new Error(`Élément à l'index ${index} : la latitude et la longitude doivent être des nombres.`);
                            }
                        });
                        
                        if (confirm(`Êtes-vous sûr de vouloir importer ${imported.length} structures ? Vos structures actuelles seront écrasées.`)) {
                            state.services = imported;
                            localStorage.setItem('services_data', JSON.stringify(state.services));
                            render();
                            populateServiceSelect();
                            alert("Données importées avec succès !");
                        }
                    } catch (err) {
                        alert(`Erreur lors de la lecture du fichier : ${err.message}`);
                    } finally {
                        importFileInput.value = '';
                    }
                };
                reader.readAsText(file);
            });
        }

        // Reset all data to defaults
        const resetDataBtn = document.getElementById('reset-data-btn');
        if (resetDataBtn) {
            resetDataBtn.addEventListener('click', () => {
                if (confirm("Êtes-vous sûr de vouloir réinitialiser toutes les données ? Vos modifications seront définitivement supprimées.")) {
                    localStorage.removeItem('services_data');
                    location.reload();
                }
            });
        }

        // --- Mandate Mode Event Listeners ---
        const servicesBtn = document.getElementById('mode-services-btn');
        const mandateBtn = document.getElementById('mode-mandate-btn');
        if (servicesBtn) servicesBtn.addEventListener('click', () => switchMode('services'));
        if (mandateBtn) mandateBtn.addEventListener('click', () => switchMode('mandate'));

        const closeMandateBtn = document.getElementById('close-mandate-modal');
        const cancelMandateBtn = document.getElementById('cancel-mandate-modal');
        if (closeMandateBtn) closeMandateBtn.addEventListener('click', closeMandateModal);
        if (cancelMandateBtn) cancelMandateBtn.addEventListener('click', closeMandateModal);

        document.querySelectorAll('input[name="mandate-services"]').forEach(cb => {
            cb.addEventListener('change', () => {
                if (mandateTempMarker) {
                    createMandateTempMarker(mandateTempMarker.getLatLng());
                }
            });
        });

        const mandateForm = document.getElementById('mandate-form');
        if (mandateForm) {
            mandateForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const idVal = document.getElementById('form-mandate-id').value;
                let name = document.getElementById('form-mandate-name').value.trim();
                const lat = parseFloat(document.getElementById('form-mandate-lat').value);
                const lng = parseFloat(document.getElementById('form-mandate-lng').value);
                
                const checkedBoxes = document.querySelectorAll('input[name="mandate-services"]:checked');
                const services = Array.from(checkedBoxes).map(cb => cb.value);
                
                if (services.length === 0) {
                    alert("Veuillez cocher au moins un service.");
                    return;
                }
                
                if (!name) {
                    name = services.join(', ');
                }
                
                if (isNaN(lat) || isNaN(lng)) {
                    alert("Coordonnées de latitude ou longitude invalides.");
                    return;
                }
                
                if (idVal) {
                    const id = parseInt(idVal);
                    const index = state.mandatePoints.findIndex(p => p.id === id);
                    if (index !== -1) {
                        state.mandatePoints[index] = { id, name, services, lat, lng };
                    }
                } else {
                    const id = Date.now();
                    state.mandatePoints.push({ id, name, services, lat, lng });
                }
                
                saveMandatePoints();
                closeMandateModal();
            });
        }

        const mandateExportBtn = document.getElementById('mandate-export-btn');
        if (mandateExportBtn) {
            mandateExportBtn.addEventListener('click', exportMandateDataForAI);
        }

        const mandateClearBtn = document.getElementById('mandate-clear-btn');
        if (mandateClearBtn) {
            mandateClearBtn.addEventListener('click', () => {
                if (confirm("Êtes-vous sûr de vouloir vider le plan de mandat actuel ? Tous les points personnalisés seront supprimés.")) {
                    state.mandatePoints = [];
                    saveMandatePoints();
                    renderMandate();
                }
            });
        }

        const mandateImportBtn = document.getElementById('mandate-import-btn');
        const mandateImportFile = document.getElementById('mandate-import-file');
        if (mandateImportBtn && mandateImportFile) {
            mandateImportBtn.addEventListener('click', () => {
                mandateImportFile.click();
            });
            
            mandateImportFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        const imported = JSON.parse(evt.target.result);
                        if (!Array.isArray(imported)) {
                            throw new Error("Le fichier importé doit être une liste de points d'intérêt.");
                        }
                        
                        const mapped = imported.map((item, index) => {
                            const id = item.id || Date.now() + index;
                            
                            let services = [];
                            if (item.services && Array.isArray(item.services)) {
                                services = item.services;
                            } else if (item.type) {
                                services = [item.type];
                            } else if (item.services_assures && Array.isArray(item.services_assures)) {
                                services = item.services_assures;
                            } else {
                                services = ["Autre"];
                            }
                            
                            const name = item.name || item.nom || services.join(', ') || `Point ${index + 1}`;
                            
                            let lat, lng;
                            if (item.coordonnees && typeof item.coordonnees.latitude === 'number') {
                                lat = item.coordonnees.latitude;
                                lng = item.coordonnees.longitude;
                            } else {
                                lat = item.lat;
                                lng = item.lng;
                            }
                            
                            if (typeof lat !== 'number' || typeof lng !== 'number') {
                                throw new Error(`Coordonnées géographiques invalides pour l'élément à l'index ${index}`);
                            }
                            
                            return { id, name, services, lat, lng };
                        });
                        
                        if (confirm(`Êtes-vous sûr de vouloir importer ces ${mapped.length} points ? Vos points actuels seront écrasés.`)) {
                            state.mandatePoints = mapped;
                            saveMandatePoints();
                            renderMandate();
                            alert("Plan de mandat importé avec succès !");
                        }
                    } catch (err) {
                        alert(`Erreur lors de l'importation : ${err.message}`);
                    } finally {
                        mandateImportFile.value = '';
                    }
                };
            });
        }

        // Checkboxes to show existing facilities in mandate mode
        document.querySelectorAll('.mandate-overlay-chk').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const category = e.target.getAttribute('data-category');
                if (e.target.checked) {
                    if (!state.mandateActiveOverlays.includes(category)) {
                        state.mandateActiveOverlays.push(category);
                    }
                } else {
                    state.mandateActiveOverlays = state.mandateActiveOverlays.filter(c => c !== category);
                }
                renderMandateMarkers();
            });
        });
    }

    // 11. Initial Run
    initServices();
    initMandatePoints();
    initMap();
    setupEvents();
    populateServiceSelect();
    render();
});
