/**
 * MS Brand List — Custom Element
 * Gestisce filtro alfabetico e ricerca.
 * Supporta layout flat e grouped (raggruppato per iniziale).
 */

if (!customElements.get('ms-brand-list')) {
  class MSBrandList extends HTMLElement {
    constructor() {
      super();
      this._debounceTimer = null;
      this._activeLetter = 'all';
      this._searchQuery = '';
      this._isGrouped = false;
    }

    connectedCallback() {
      this.sectionId = this.dataset.sectionId;
      if (!this.sectionId) return;

      this._isGrouped = this.dataset.layoutMode === 'grouped';

      this.#cacheElements();
      this.#disableUnusedLetters();
      this.#bindEvents();
    }

    #cacheElements() {
      this.containerEl = this.querySelector('[data-bl-container]');
      this.items = [...this.querySelectorAll('.ms-bl__item')];
      this.groups = [...this.querySelectorAll('.ms-bl__group')];
      this.alphaButtons = [...this.querySelectorAll('.ms-bl__alpha-btn')];
      this.searchInput = this.querySelector('.ms-bl__search-input');
      this.searchClearBtn = this.querySelector('.ms-bl__search-clear');
      this.countEl = this.querySelector('[data-bl-count]');
      this.countLabelEl = this.querySelector('[data-bl-count-label]');
      this.emptyEl = this.querySelector('.ms-bl__empty');
    }

    #bindEvents() {
      for (const btn of this.alphaButtons) {
        btn.addEventListener('click', () => this.#handleLetterClick(btn));
      }

      if (this.searchInput) {
        this.searchInput.addEventListener('input', () => this.#debounceSearch());
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
    }

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

      if (this._isGrouped) {
        for (const group of this.groups) {
          const visibleItems = group.querySelectorAll('.ms-bl__item:not([hidden])');
          group.hidden = visibleItems.length === 0;
        }
      }

      this.#updateCount(visibleCount);
      this.#updateEmpty(visibleCount === 0);
    }

    #updateCount(count) {
      if (this.countEl) this.countEl.textContent = count;
      if (this.countLabelEl) {
        this.countLabelEl.textContent = count === 1 ? 'brand trovato' : 'brand trovati';
      }
    }

    #updateEmpty(isEmpty) {
      if (this.emptyEl) this.emptyEl.hidden = !isEmpty;
      if (this.containerEl) this.containerEl.hidden = isEmpty;
    }
  }

  customElements.define('ms-brand-list', MSBrandList);
}
