/**
 * MS Store Locator — Custom Element
 * Supporta Leaflet (OpenStreetMap) e Google Maps.
 * Gestisce ricerca, filtri tag, geolocalizzazione, clustering, popup.
 */

if (!customElements.get('ms-store-locator')) {
  class MSStoreLocator extends HTMLElement {
    constructor() {
      super();
      this.map = null;
      this.markers = [];
      this.markerLayer = null;
      this.clusterGroup = null;
      this.stores = [];
      this.tagDefs = [];
      this.config = {};
      this.activeFilters = new Set();
      this.userPosition = null;
      this.searchPosition = null;
      this.activeCardId = null;
    }

    connectedCallback() {
      this.sectionId = this.dataset.sectionId;
      if (!this.sectionId) return;

      this.#parseData();
      this.#cacheElements();
      this.#bindEvents();
      this.#waitForLibAndInit();
    }

    /* ------------------------------------------------------------------
       Data Parsing
       ------------------------------------------------------------------ */

    #parseData() {
      const storesEl = this.querySelector('[data-ms-sl-stores]');
      const tagsEl = this.querySelector('[data-ms-sl-tags]');
      const configEl = this.querySelector('[data-ms-sl-config]');

      try {
        this.stores = storesEl ? JSON.parse(storesEl.textContent) : [];
      } catch { this.stores = []; }

      try {
        this.tagDefs = tagsEl ? JSON.parse(tagsEl.textContent) : [];
      } catch { this.tagDefs = []; }

      try {
        this.config = configEl ? JSON.parse(configEl.textContent) : {};
      } catch { this.config = {}; }

      for (const store of this.stores) {
        store._lat = parseFloat(store.lat) || 0;
        store._lng = parseFloat(store.lng) || 0;
      }
    }

    #cacheElements() {
      this.mapEl = this.querySelector(`#ms-sl-map-${this.sectionId}`);
      this.listEl = this.querySelector('.ms-sl__list');
      this.listWrapper = this.querySelector('.ms-sl__list-wrapper');
      this.searchInput = this.querySelector('.ms-sl__search-input');
      this.searchBtn = this.querySelector('.ms-sl__search-btn');
      this.geoBtn = this.querySelector('.ms-sl__geo-btn');
      this.filterBtns = this.querySelectorAll('.ms-sl__filter-btn');
      this.filterReset = this.querySelector('.ms-sl__filter-reset');
      this.countEl = this.querySelector('[data-ms-sl-count]');
      this.emptyEl = this.querySelector('.ms-sl__empty');
      this.cards = this.querySelectorAll('.ms-sl__card');
    }

    #bindEvents() {
      if (this.searchBtn) {
        this.searchBtn.addEventListener('click', () => this.#handleSearch());
      }
      if (this.searchInput) {
        this.searchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); this.#handleSearch(); }
        });
      }
      if (this.geoBtn) {
        this.geoBtn.addEventListener('click', () => this.#handleGeolocation());
      }

      for (const btn of this.filterBtns) {
        btn.addEventListener('click', () => this.#toggleFilter(btn));
      }

      if (this.filterReset) {
        this.filterReset.addEventListener('click', () => this.#resetFilters());
      }

      for (const card of this.cards) {
        card.addEventListener('click', () => {
          const storeId = card.dataset.storeId;
          this.#focusStore(storeId);
        });
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const storeId = card.dataset.storeId;
            this.#focusStore(storeId);
          }
        });
      }
    }

    /* ------------------------------------------------------------------
       Library loading & Map initialization
       ------------------------------------------------------------------ */

    #waitForLibAndInit() {
      if (this.config.layout === 'cards_only' || !this.mapEl) {
        return;
      }

      const provider = this.config.provider || 'openstreetmap';
      let attempts = 0;
      const maxAttempts = 80;

      const check = () => {
        attempts++;
        if (provider === 'openstreetmap' && typeof L !== 'undefined') {
          this.#initLeaflet();
        } else if (provider === 'google_maps' && typeof google !== 'undefined' && google.maps) {
          this.#initGoogleMaps();
        } else if (attempts < maxAttempts) {
          setTimeout(check, 150);
        }
      };

      if (document.readyState === 'complete') {
        check();
      } else {
        window.addEventListener('load', check, { once: true });
      }
    }

    /* ------------------------------------------------------------------
       Leaflet (OpenStreetMap)
       ------------------------------------------------------------------ */

    #initLeaflet() {
      const tileUrl = this.#getLeafletTileUrl();
      const style = this.config.style || 'standard';
      const osmAttrib = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
      const cartoAttrib = osmAttrib + ' &copy; <a href="https://carto.com/attributions">CARTO</a>';
      const tileAttrib = (style === 'grayscale' || style === 'dark') ? cartoAttrib : osmAttrib;

      this.map = L.map(this.mapEl, {
        center: [this.config.lat, this.config.lng],
        zoom: this.config.zoom || 6,
        scrollWheelZoom: false
      });

      L.tileLayer(tileUrl, { attribution: tileAttrib, maxZoom: 19 }).addTo(this.map);

      if (this.config.fullscreen && L.Control.Fullscreen) {
        this.map.addControl(new L.Control.Fullscreen());
      }

      if (this.config.clustering && typeof L.markerClusterGroup === 'function') {
        this.clusterGroup = L.markerClusterGroup({
          maxClusterRadius: 50,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false
        });
        this.map.addLayer(this.clusterGroup);
      }

      this.#createLeafletMarkers();
      this.#fitBounds();
    }

    #getLeafletTileUrl() {
      const style = this.config.style || 'standard';
      switch (style) {
        case 'grayscale':
          return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        case 'dark':
          return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        default:
          return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      }
    }

    #createLeafletMarkers() {
      this.markers = [];

      for (const store of this.stores) {
        if (!store._lat && !store._lng) continue;

        const markerDef = this.#getMarkerDef(store);

        let divIcon;
        if (markerDef.image) {
          divIcon = L.icon({
            iconUrl: markerDef.image,
            iconSize: [36, 45],
            iconAnchor: [18, 45],
            popupAnchor: [0, -45],
            className: 'ms-sl__marker ms-sl__marker--image'
          });
        } else {
          const iconHtml = markerDef.icon
            ? `<span class="ms-sl__marker-glyph">${this.#renderIconHtml(markerDef.icon)}</span>`
            : '';
          divIcon = L.divIcon({
            className: 'ms-sl__marker',
            html: `<div class="ms-sl__marker-pin" style="background-color:${markerDef.color}">${iconHtml}</div>`,
            iconSize: [36, 45],
            iconAnchor: [18, 45],
            popupAnchor: [0, -45]
          });
        }

        const marker = L.marker([store._lat, store._lng], { icon: divIcon });
        marker._storeId = store.id;
        marker._storeTags = store.tags || [];

        const popupContent = this.#buildPopupHtml(store);
        marker.bindPopup(popupContent, { maxWidth: 300, className: 'ms-sl__popup-wrapper' });

        marker.on('click', () => {
          this.#setActiveCard(store.id);
        });

        if (this.clusterGroup) {
          this.clusterGroup.addLayer(marker);
        } else {
          marker.addTo(this.map);
        }

        this.markers.push(marker);
      }
    }

    /* ------------------------------------------------------------------
       Google Maps
       ------------------------------------------------------------------ */

    #initGoogleMaps() {
      const mapStyles = this.#getGoogleMapStyles();

      this.map = new google.maps.Map(this.mapEl, {
        center: { lat: this.config.lat, lng: this.config.lng },
        zoom: this.config.zoom || 6,
        styles: mapStyles,
        fullscreenControl: !!this.config.fullscreen,
        mapTypeControl: false,
        streetViewControl: false,
        gestureHandling: 'cooperative'
      });

      this.infoWindow = new google.maps.InfoWindow();
      this.#createGoogleMarkers();
      this.#fitBounds();
    }

    #getGoogleMapStyles() {
      const style = this.config.style || 'standard';
      if (style === 'grayscale') {
        return [{ stylers: [{ saturation: -100 }] }];
      }
      if (style === 'dark') {
        return [
          { elementType: 'geometry', stylers: [{ color: '#212121' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#383838' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] }
        ];
      }
      return [];
    }

    #createGoogleMarkers() {
      this.markers = [];

      for (const store of this.stores) {
        if (!store._lat && !store._lng) continue;

        const markerDef = this.#getMarkerDef(store);

        let markerIcon;
        if (markerDef.image) {
          markerIcon = {
            url: markerDef.image,
            scaledSize: new google.maps.Size(36, 45),
            anchor: new google.maps.Point(18, 45)
          };
        } else {
          const svgPin = this.#buildGooglePinSvg(markerDef.color);
          markerIcon = {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgPin),
            scaledSize: new google.maps.Size(36, 45),
            anchor: new google.maps.Point(18, 45)
          };
        }

        const marker = new google.maps.Marker({
          position: { lat: store._lat, lng: store._lng },
          map: this.map,
          icon: markerIcon,
          title: store.nome
        });

        marker._storeId = store.id;
        marker._storeTags = store.tags || [];

        const popupContent = this.#buildPopupHtml(store);

        marker.addListener('click', () => {
          this.infoWindow.setContent(popupContent);
          this.infoWindow.open(this.map, marker);
          this.#setActiveCard(store.id);
        });

        this.markers.push(marker);
      }
    }

    #buildGooglePinSvg(color) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="45" viewBox="0 0 36 45">
        <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 27 18 27s18-13.5 18-27C36 8.06 27.94 0 18 0z" fill="${color}"/>
        <circle cx="18" cy="18" r="6" fill="rgba(255,255,255,0.4)"/>
      </svg>`;
    }

    /* ------------------------------------------------------------------
       Shared map utilities
       ------------------------------------------------------------------ */

    #fitBounds() {
      const visibleMarkers = this.markers.filter(m => this.#isMarkerVisible(m));
      if (visibleMarkers.length === 0) return;

      const provider = this.config.provider || 'openstreetmap';

      if (provider === 'openstreetmap') {
        const group = L.featureGroup(visibleMarkers);
        this.map.fitBounds(group.getBounds().pad(0.1));
      } else if (provider === 'google_maps') {
        const bounds = new google.maps.LatLngBounds();
        for (const m of visibleMarkers) {
          bounds.extend(m.getPosition());
        }
        this.map.fitBounds(bounds);
      }
    }

    #isMarkerVisible(marker) {
      const provider = this.config.provider || 'openstreetmap';
      if (provider === 'openstreetmap') {
        if (this.clusterGroup) return this.clusterGroup.hasLayer(marker);
        return this.map.hasLayer(marker);
      }
      return marker.getMap() !== null;
    }

    #openMarkerPopup(storeId) {
      const provider = this.config.provider || 'openstreetmap';
      const marker = this.markers.find(m => m._storeId === storeId);
      if (!marker) return;

      if (provider === 'openstreetmap') {
        if (this.clusterGroup) {
          this.clusterGroup.zoomToShowLayer(marker, () => {
            marker.openPopup();
          });
        } else {
          this.map.setView(marker.getLatLng(), Math.max(this.map.getZoom(), 13));
          marker.openPopup();
        }
      } else if (provider === 'google_maps') {
        const store = this.stores.find(s => s.id === storeId);
        if (store) {
          this.infoWindow.setContent(this.#buildPopupHtml(store));
          this.infoWindow.open(this.map, marker);
          this.map.setCenter(marker.getPosition());
          if (this.map.getZoom() < 13) this.map.setZoom(13);
        }
      }
    }

    #getTagMatch(store) {
      if (!store.tags || store.tags.length === 0) return null;
      for (const tag of store.tags) {
        const def = this.tagDefs.find(d => d.tag && d.tag.toLowerCase() === tag.toLowerCase());
        if (def) return def;
      }
      return null;
    }

    #getMarkerDef(store) {
      const tagMatch = this.#getTagMatch(store);
      if (tagMatch) {
        return {
          color: tagMatch.color || '#6b7280',
          icon: tagMatch.icon || '',
          image: tagMatch.image || ''
        };
      }
      return {
        color: this.config.defaultMarkerColor || '#6b7280',
        icon: this.config.defaultMarkerIcon || '',
        image: this.config.defaultMarkerImage || ''
      };
    }

    #renderIconHtml(iconName) {
      if (!iconName) return '';
      if (iconName.includes('.svg')) {
        return `<span class="svg-wrapper" aria-hidden="true"></span>`;
      }
      return `<span class="icon-lib-wrapper" aria-hidden="true"><i class="${iconName}"></i></span>`;
    }

    #buildPopupHtml(store) {
      let html = '<div class="ms-sl__popup">';

      if (store.foto) {
        html += `<img class="ms-sl__popup-image" src="${store.foto}" alt="${this.#esc(store.nome) || 'Punto vendita'}" loading="lazy" />`;
      }

      html += `<p class="ms-sl__popup-name">${this.#esc(store.nome)}</p>`;

      if (store.ragione_sociale) {
        html += `<p class="ms-sl__popup-company">${this.#esc(store.ragione_sociale)}</p>`;
      }

      if (store.indirizzo) {
        html += `<p class="ms-sl__popup-address">${this.#esc(store.indirizzo)}</p>`;
      }

      html += '<div class="ms-sl__popup-links">';
      if (store.telefono) {
        html += `<a class="ms-sl__popup-link" href="tel:${store.telefono}">${this.#esc(store.telefono)}</a>`;
      }
      if (store.email) {
        html += `<a class="ms-sl__popup-link" href="mailto:${store.email}">${this.#esc(store.email)}</a>`;
      }
      if (this.config.showDirections) {
        html += `<a class="ms-sl__popup-link" href="https://www.google.com/maps/dir/?api=1&destination=${store._lat},${store._lng}" target="_blank" rel="noopener noreferrer" aria-label="Ottieni indicazioni per ${this.#esc(store.nome) || 'questo punto vendita'}">Indicazioni</a>`;
      }
      html += '</div></div>';

      return html;
    }

    #esc(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    /* ------------------------------------------------------------------
       Search (geocoding)
       ------------------------------------------------------------------ */

    #handleSearch() {
      const query = this.searchInput ? this.searchInput.value.trim() : '';
      if (!query) {
        this.#clearSearch();
        return;
      }

      const provider = this.config.provider || 'openstreetmap';
      if (provider === 'openstreetmap') {
        this.#geocodeNominatim(query);
      } else {
        this.#geocodeGoogle(query);
      }
    }

    #geocodeNominatim(query) {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

      fetch(url, { headers: { 'Accept-Language': 'it' } })
        .then(r => r.json())
        .then(results => {
          if (results && results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lng = parseFloat(results[0].lon);
            this.#applySearchPosition(lat, lng);
          }
        })
        .catch(() => {});
    }

    #geocodeGoogle(query) {
      if (!google.maps.Geocoder) return;
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: query }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const loc = results[0].geometry.location;
          this.#applySearchPosition(loc.lat(), loc.lng());
        }
      });
    }

    #applySearchPosition(lat, lng) {
      this.searchPosition = { lat, lng };
      this.#computeDistances(lat, lng);
      this.#filterAndUpdate();

      const provider = this.config.provider || 'openstreetmap';
      if (provider === 'openstreetmap' && this.map) {
        this.map.setView([lat, lng], Math.max(this.map.getZoom(), 10));
      } else if (provider === 'google_maps' && this.map) {
        this.map.setCenter({ lat, lng });
        if (this.map.getZoom() < 10) this.map.setZoom(10);
      }
    }

    #clearSearch() {
      this.searchPosition = null;
      for (const store of this.stores) {
        delete store._distance;
      }
      this.#filterAndUpdate();
      this.#hideDistances();
      this.#fitBounds();
    }

    /* ------------------------------------------------------------------
       Geolocation
       ------------------------------------------------------------------ */

    #handleGeolocation() {
      if (!navigator.geolocation) return;

      if (this.geoBtn) this.geoBtn.classList.add('ms-sl__geo-btn--loading');

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (this.geoBtn) this.geoBtn.classList.remove('ms-sl__geo-btn--loading');
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          this.userPosition = { lat, lng };

          if (this.searchInput) this.searchInput.value = '';
          this.#applySearchPosition(lat, lng);
          this.#addUserMarker(lat, lng);
        },
        () => {
          if (this.geoBtn) this.geoBtn.classList.remove('ms-sl__geo-btn--loading');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    #addUserMarker(lat, lng) {
      const provider = this.config.provider || 'openstreetmap';

      if (this._userMarker) {
        if (provider === 'openstreetmap') this.map.removeLayer(this._userMarker);
        else this._userMarker.setMap(null);
      }

      if (provider === 'openstreetmap') {
        const icon = L.divIcon({
          className: 'ms-sl__marker',
          html: '<div class="ms-sl__marker-user"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        this._userMarker = L.marker([lat, lng], { icon, interactive: false }).addTo(this.map);
      } else if (provider === 'google_maps') {
        this._userMarker = new google.maps.Marker({
          position: { lat, lng },
          map: this.map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 3
          },
          clickable: false,
          zIndex: 999
        });
      }
    }

    /* ------------------------------------------------------------------
       Distance calculation (Haversine)
       ------------------------------------------------------------------ */

    #computeDistances(fromLat, fromLng) {
      for (const store of this.stores) {
        store._distance = this.#haversine(fromLat, fromLng, store._lat, store._lng);
      }
    }

    #haversine(lat1, lng1, lat2, lng2) {
      const R = 6371;
      const dLat = this.#toRad(lat2 - lat1);
      const dLng = this.#toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(this.#toRad(lat1)) * Math.cos(this.#toRad(lat2)) *
                Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    #toRad(deg) { return deg * (Math.PI / 180); }

    /* ------------------------------------------------------------------
       Filters
       ------------------------------------------------------------------ */

    #toggleFilter(btn) {
      const tag = btn.dataset.tag;
      const isActive = btn.getAttribute('aria-pressed') === 'true';

      if (isActive) {
        this.activeFilters.delete(tag);
        btn.setAttribute('aria-pressed', 'false');
      } else {
        this.activeFilters.add(tag);
        btn.setAttribute('aria-pressed', 'true');
      }

      if (this.filterReset) {
        this.filterReset.hidden = this.activeFilters.size === 0;
      }

      this.#filterAndUpdate();
    }

    #resetFilters() {
      this.activeFilters.clear();
      for (const btn of this.filterBtns) {
        btn.setAttribute('aria-pressed', 'false');
      }
      if (this.filterReset) this.filterReset.hidden = true;
      this.#filterAndUpdate();
    }

    /* ------------------------------------------------------------------
       Filter + Update (orchestrator)
       ------------------------------------------------------------------ */

    #filterAndUpdate() {
      const radius = this.config.searchRadius || 50;
      const hasSearch = this.searchPosition !== null;
      let visibleCount = 0;
      const visibleStoreIds = new Set();

      const sortedStores = [...this.stores];
      if (hasSearch) {
        sortedStores.sort((a, b) => (a._distance || Infinity) - (b._distance || Infinity));
      }

      for (const store of sortedStores) {
        let visible = true;

        if (hasSearch && store._distance !== undefined && store._distance > radius) {
          visible = false;
        }

        if (visible && this.activeFilters.size > 0) {
          const storeTags = (store.tags || []).map(t => t.toLowerCase());
          let matchesFilter = false;
          for (const f of this.activeFilters) {
            if (storeTags.includes(f.toLowerCase())) {
              matchesFilter = true;
              break;
            }
          }
          if (!matchesFilter) visible = false;
        }

        if (visible) {
          visibleCount++;
          visibleStoreIds.add(store.id);
        }
      }

      this.#updateCards(visibleStoreIds, sortedStores, hasSearch);
      this.#updateMarkers(visibleStoreIds);
      this.#updateCount(visibleCount);
      this.#updateEmpty(visibleCount);

      if (!hasSearch && this.activeFilters.size > 0) {
        this.#fitBounds();
      }
    }

    #updateCards(visibleIds, sortedStores, showDistance) {
      if (!this.listEl) return;

      for (const card of this.cards) {
        const storeId = card.dataset.storeId;
        card.hidden = !visibleIds.has(storeId);

        const store = this.stores.find(s => s.id === storeId);
        const distEl = card.querySelector('[data-ms-sl-distance]');
        if (distEl && store && store._distance !== undefined && showDistance && this.config.showDistance) {
          const dist = store._distance < 1
            ? `${Math.round(store._distance * 1000)} m`
            : `${store._distance.toFixed(1)} km`;
          distEl.textContent = dist;
          distEl.classList.add('ms-sl__card-distance--visible');
        } else if (distEl) {
          distEl.textContent = '';
          distEl.classList.remove('ms-sl__card-distance--visible');
        }

        const tagDots = card.querySelectorAll('.ms-sl__card-tag-dot');
        for (const dot of tagDots) {
          const tagSpan = dot.closest('.ms-sl__card-tag');
          if (tagSpan) {
            const tagText = tagSpan.textContent.trim();
            const def = this.tagDefs.find(d => d.label && d.label.toLowerCase() === tagText.toLowerCase())
                     || this.tagDefs.find(d => d.tag && d.tag.toLowerCase() === tagText.toLowerCase());
            if (def) dot.style.backgroundColor = def.color;
          }
        }
      }

      if (sortedStores && showDistance) {
        for (const store of sortedStores) {
          const card = this.listEl.querySelector(`[data-store-id="${store.id}"]`);
          if (card) this.listEl.appendChild(card);
        }
      }
    }

    #updateMarkers(visibleIds) {
      const provider = this.config.provider || 'openstreetmap';

      for (const marker of this.markers) {
        const isVisible = visibleIds.has(marker._storeId);

        if (provider === 'openstreetmap') {
          if (this.clusterGroup) {
            if (isVisible && !this.clusterGroup.hasLayer(marker)) {
              this.clusterGroup.addLayer(marker);
            } else if (!isVisible && this.clusterGroup.hasLayer(marker)) {
              this.clusterGroup.removeLayer(marker);
            }
          } else {
            if (isVisible && !this.map.hasLayer(marker)) {
              marker.addTo(this.map);
            } else if (!isVisible && this.map.hasLayer(marker)) {
              this.map.removeLayer(marker);
            }
          }
        } else if (provider === 'google_maps') {
          marker.setMap(isVisible ? this.map : null);
        }
      }
    }

    #updateCount(count) {
      if (this.countEl) this.countEl.textContent = count;
    }

    #updateEmpty(count) {
      if (this.emptyEl) this.emptyEl.hidden = count > 0;
      if (this.listEl) this.listEl.hidden = count === 0;
    }

    #hideDistances() {
      const distEls = this.querySelectorAll('[data-ms-sl-distance]');
      for (const el of distEls) {
        el.textContent = '';
        el.classList.remove('ms-sl__card-distance--visible');
      }
    }

    /* ------------------------------------------------------------------
       Card / Marker interaction
       ------------------------------------------------------------------ */

    #focusStore(storeId) {
      this.#setActiveCard(storeId);
      if (this.mapEl) {
        this.#openMarkerPopup(storeId);
      }
    }

    #setActiveCard(storeId) {
      for (const card of this.cards) {
        card.classList.toggle('ms-sl__card--active', card.dataset.storeId === storeId);
      }

      const activeCard = this.listEl
        ? this.listEl.querySelector(`[data-store-id="${storeId}"]`)
        : null;

      if (activeCard && this.listWrapper) {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        activeCard.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest' });
      }

      this.activeCardId = storeId;
    }
  }

  customElements.define('ms-store-locator', MSStoreLocator);
}
