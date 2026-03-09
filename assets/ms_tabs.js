/**
 * MS Tabs — Custom Element
 * Handles tab switching, keyboard navigation (arrow keys, Home, End),
 * and optional accordion fallback on mobile.
 */
if (!customElements.get('ms-tabs')) {
  class MsTabs extends HTMLElement {
    constructor() {
      super();
      this.tabs = [];
      this.panels = [];
      this.boundKeyDown = this.#handleKeyDown.bind(this);
    }

    connectedCallback() {
      this.tabs = Array.from(this.querySelectorAll('[role="tab"]'));
      this.panels = Array.from(this.querySelectorAll('[role="tabpanel"]'));

      for (const tab of this.tabs) {
        tab.addEventListener('click', (e) => {
          e.preventDefault();
          this.#selectTab(tab);
        });
      }

      const tablist = this.querySelector('[role="tablist"]');
      if (tablist) {
        tablist.addEventListener('keydown', this.boundKeyDown);
      }
    }

    disconnectedCallback() {
      const tablist = this.querySelector('[role="tablist"]');
      if (tablist) {
        tablist.removeEventListener('keydown', this.boundKeyDown);
      }
    }

    #selectTab(selectedTab) {
      const index = selectedTab.getAttribute('data-tab-index');

      for (const tab of this.tabs) {
        const isSelected = tab.getAttribute('data-tab-index') === index;
        tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        tab.setAttribute('tabindex', isSelected ? '0' : '-1');
      }

      for (const panel of this.panels) {
        const isActive = panel.getAttribute('data-panel-index') === index;
        panel.hidden = !isActive;
      }

      selectedTab.focus();
    }

    #handleKeyDown(e) {
      const currentIndex = this.tabs.indexOf(document.activeElement);
      if (currentIndex === -1) return;

      let nextIndex;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          nextIndex = (currentIndex + 1) % this.tabs.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          nextIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = this.tabs.length - 1;
          break;
        default:
          return;
      }

      this.#selectTab(this.tabs[nextIndex]);
    }
  }

  customElements.define('ms-tabs', MsTabs);
}
