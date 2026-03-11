/**
 * MS Brand List — Custom Element
 * Gestisce filtro alfabetico, ricerca e cambio vista.
 */

if (!customElements.get('ms-brand-list')) {
  class MSBrandList extends HTMLElement {
    constructor() {
      super();
      this._debounceTimer = null;
      this._activeLetter = 'all';
      this._searchQuery = '';
      this._currentView = 'grid';
    }

    connectedCallback() {
      this.sectionId = this.dataset.sectionId;
      if (!this.sectionId) return;

      this._currentView = this.dataset.defaultView || 'grid';

      const saved = sessionStorage.getItem('ms-bl-view');
      if (saved && ['grid', 'list', 'logo'].includes(saved)) {
        this._currentView = saved;
      }

      this.#cacheElements();
      this.#disableUnusedLetters();
      this.#applyView(this._currentView);
      this.#bindEvents();
    }

    #cacheElements() {
      this.container = this.querySelector('[data-bl-container]');
      this.items = this.container ? [...this.container.querySelectorAll('.ms-bl__item')] : [];
      this.alphaButtons = [...this.querySelectorAll('.ms-bl__alpha-btn')];
      this.searchInput = this.querySelector('.ms-bl__search-input');
      this.searchClearBtn = this.querySelector('.ms-bl__search-clear');
      this.viewButtons = [...this.querySelectorAll('.ms-bl__view-btn')];
      this.countEl = this.querySelector('[data-bl-count]');
      this.countLabelEl = this.querySelector('[data-bl-count-label]');
      this.emptyEl = this.querySelector('.ms-bl__empty');
    }

    #bindEvents() {
      for (const btn of this.alphaButtons) {
        btn.addEventListener('click', () => this.#handleLetterClick(btn));
      }

      if (this.searchInput) {
        this.searchInput.addEventListener('input', () => {
          this.#debounceSearch();
        });
        this.searchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            this.searchInput.value = '';
            this.#handleSearch();
          }
        });
      }

      if (this.searchClearBtn) {
        this.searchClearBtn.addEventListener('click', () => {
          if (this.searchInput) this.searchInput.value = '';
          this.#handleSearch();
          this.searchInput?.focus();
        });
      }

      for (const btn of this.viewButtons) {
        btn.addEventListener('click', () => {
          const view = btn.dataset.view;
          if (view) this.#applyView(view);
        });
      }
    }

    /* ------------------------------------------------------------------
       Filtro Alfabetico
       ------------------------------------------------------------------ */

    #handleLetterClick(btn) {
      const letter = btn.dataset.letter;
      if (!letter) return;

      this._activeLetter = letter;

      for (const b of this.alphaButtons) {
        const isActive = b === btn;
        b.classList.toggle('ms-bl__alpha-btn--active', isActive);
        b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      }

      this.#filterItems();
    }

    #disableUnusedLetters() {
      const usedInitials = new Set();
      for (const item of this.items) {
        const initial = (item.dataset.brandInitial || '').toUpperCase();
        if (/^[A-Z]$/.test(initial)) {
          usedInitials.add(initial);
        } else if (initial) {
          usedInitials.add('#');
        }
      }

      for (const btn of this.alphaButtons) {
        const letter = btn.dataset.letter;
        if (letter === 'all') continue;
        if (!usedInitials.has(letter)) {
          btn.classList.add('ms-bl__alpha-btn--disabled');
        }
      }
    }

    /* ------------------------------------------------------------------
       Ricerca
       ------------------------------------------------------------------ */

    #debounceSearch() {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this.#handleSearch(), 300);
    }

    #handleSearch() {
      this._searchQuery = this.searchInput ? this.searchInput.value.trim().toLowerCase() : '';

      if (this.searchClearBtn) {
        this.searchClearBtn.hidden = !this._searchQuery;
      }

      this.#filterItems();
    }

    /* ------------------------------------------------------------------
       Filtraggio Combinato
       ------------------------------------------------------------------ */

    #filterItems() {
      let visibleCount = 0;

      for (const item of this.items) {
        const name = (item.dataset.brandName || '').toLowerCase();
        const initial = (item.dataset.brandInitial || '').toUpperCase();

        let matchesLetter = true;
        if (this._activeLetter !== 'all') {
          if (this._activeLetter === '#') {
            matchesLetter = !/^[A-Z]$/.test(initial);
          } else {
            matchesLetter = initial === this._activeLetter;
          }
        }

        let matchesSearch = true;
        if (this._searchQuery) {
          matchesSearch = name.includes(this._searchQuery);
        }

        const visible = matchesLetter && matchesSearch;
        item.hidden = !visible;

        if (visible) visibleCount++;
      }

      this.#updateCount(visibleCount);
      this.#updateEmpty(visibleCount === 0);
    }

    /* ------------------------------------------------------------------
       Contatore Risultati
       ------------------------------------------------------------------ */

    #updateCount(count) {
      if (this.countEl) {
        this.countEl.textContent = count;
      }
      if (this.countLabelEl) {
        this.countLabelEl.textContent = count === 1 ? 'brand trovato' : 'brand trovati';
      }
    }

    #updateEmpty(isEmpty) {
      if (this.emptyEl) {
        this.emptyEl.hidden = !isEmpty;
      }
      if (this.container) {
        this.container.hidden = isEmpty;
      }
    }

    /* ------------------------------------------------------------------
       Cambio Vista
       ------------------------------------------------------------------ */

    #applyView(view) {
      this._currentView = view;

      if (this.container) {
        this.container.classList.remove(
          'ms-bl__container--grid',
          'ms-bl__container--list',
          'ms-bl__container--logo'
        );
        this.container.classList.add(`ms-bl__container--${view}`);
      }

      for (const btn of this.viewButtons) {
        const isActive = btn.dataset.view === view;
        btn.classList.toggle('ms-bl__view-btn--active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      }

      try {
        sessionStorage.setItem('ms-bl-view', view);
      } catch (_) {
        /* sessionStorage non disponibile */
      }
    }
  }

  customElements.define('ms-brand-list', MSBrandList);
}
