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
        editingId: null
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
        const currentVersion = '2026-05-27';
        
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
            Solidarités: 0
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
    }

    // 11. Initial Run
    initServices();
    initMap();
    setupEvents();
    populateServiceSelect();
    render();
});
