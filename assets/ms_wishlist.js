/* ==========================================================================
   MS Wishlist — Sistema wishlist basato su localStorage
   ========================================================================== */

const MS_WISHLIST_KEY = 'ms_wishlist';
const MS_WISHLIST_EVENT = 'wishlist:change';

class WishlistManager {
  static _instance = null;

  static getInstance() {
    if (!WishlistManager._instance) {
      WishlistManager._instance = new WishlistManager();
    }
    return WishlistManager._instance;
  }

  getAll() {
    try {
      const raw = localStorage.getItem(MS_WISHLIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _save(items) {
    try {
      localStorage.setItem(MS_WISHLIST_KEY, JSON.stringify(items));
    } catch { /* quota exceeded — fail silently */ }
    document.dispatchEvent(new CustomEvent(MS_WISHLIST_EVENT, { detail: { items } }));
  }

  has(handle) {
    return this.getAll().some(item => item.handle === handle);
  }

  add(data) {
    const items = this.getAll();
    if (items.some(item => item.handle === data.handle)) return;
    items.push({
      handle: data.handle,
      product_id: data.product_id,
      title: data.title,
      image: data.image,
      price: data.price,
      url: data.url,
      added_at: Date.now()
    });
    this._save(items);
  }

  remove(handle) {
    const items = this.getAll().filter(item => item.handle !== handle);
    this._save(items);
  }

  toggle(data) {
    if (this.has(data.handle)) {
      this.remove(data.handle);
      return false;
    }
    this.add(data);
    return true;
  }

  clear() {
    this._save([]);
  }

  count() {
    return this.getAll().length;
  }
}

window.MSWishlist = WishlistManager.getInstance();

/* --------------------------------------------------------------------------
   Custom Element: <wishlist-button>
   -------------------------------------------------------------------------- */

class WishlistButton extends HTMLElement {
  constructor() {
    super();
    this._wm = WishlistManager.getInstance();
  }

  connectedCallback() {
    this.button = this.querySelector('.ms-wishlist-btn');
    if (!this.button) return;

    this.handle = this.dataset.productHandle;
    if (!this.handle) return;

    this._syncState();

    this.button.addEventListener('click', this._onClick.bind(this));
    this._onChange = () => this._syncState();
    document.addEventListener(MS_WISHLIST_EVENT, this._onChange);
  }

  disconnectedCallback() {
    if (this._onChange) {
      document.removeEventListener(MS_WISHLIST_EVENT, this._onChange);
    }
  }

  _onClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const added = this._wm.toggle({
      handle: this.handle,
      product_id: this.dataset.productId,
      title: this.dataset.productTitle,
      image: this.dataset.productImage,
      price: this.dataset.productPrice,
      url: this.dataset.productUrl
    });

    this.classList.toggle('is-wishlisted', added);
    this.button.setAttribute('aria-pressed', String(added));
    this.button.setAttribute('aria-label',
      added ? this.dataset.labelRemove : this.dataset.labelAdd
    );
  }

  _syncState() {
    const active = this._wm.has(this.handle);
    this.classList.toggle('is-wishlisted', active);
    if (this.button) {
      this.button.setAttribute('aria-pressed', String(active));
      this.button.setAttribute('aria-label',
        active ? this.dataset.labelRemove : this.dataset.labelAdd
      );
    }
  }
}

if (!customElements.get('wishlist-button')) {
  customElements.define('wishlist-button', WishlistButton);
}

/* --------------------------------------------------------------------------
   Contatore Wishlist nell'header
   -------------------------------------------------------------------------- */

function updateWishlistCounters() {
  const count = window.MSWishlist.count();
  document.querySelectorAll('.ms-wishlist-count-bubble').forEach(el => {
    el.textContent = count > 0 ? (count < 100 ? count : '99+') : '';
    el.dataset.count = count;
  });
}

document.addEventListener(MS_WISHLIST_EVENT, updateWishlistCounters);
document.addEventListener('DOMContentLoaded', updateWishlistCounters);

/* --------------------------------------------------------------------------
   Custom Element: <wishlist-page>
   -------------------------------------------------------------------------- */

class WishlistPage extends HTMLElement {
  constructor() {
    super();
    this._wm = WishlistManager.getInstance();
    this._cardCache = {};
  }

  connectedCallback() {
    this._render();
    this._onChange = () => this._render();
    document.addEventListener(MS_WISHLIST_EVENT, this._onChange);
  }

  disconnectedCallback() {
    if (this._onChange) {
      document.removeEventListener(MS_WISHLIST_EVENT, this._onChange);
    }
  }

  _render() {
    const items = this._wm.getAll();
    const grid = this.querySelector('.ms-wishlist-grid');
    const empty = this.querySelector('.ms-wishlist-empty');
    const header = this.querySelector('.ms-wishlist-header');
    const countEl = this.querySelector('.ms-wishlist-header__count');
    const clearBtn = this.querySelector('.ms-wishlist-clear-btn');

    if (!grid || !empty) return;

    if (items.length === 0) {
      grid.innerHTML = '';
      grid.style.display = 'none';
      empty.style.display = '';
      if (header) header.style.display = 'none';
      return;
    }

    empty.style.display = 'none';
    grid.style.display = '';
    if (header) header.style.display = '';
    if (countEl) {
      const label = items.length === 1
        ? (this.dataset.labelSingular || '1 prodotto')
        : (this.dataset.labelPlural || '{count} prodotti').replace('{count}', items.length);
      countEl.textContent = label;
    }

    if (clearBtn && !clearBtn._bound) {
      clearBtn._bound = true;
      clearBtn.addEventListener('click', () => {
        if (window.confirm(this.dataset.confirmClear || 'Rimuovere tutti i prodotti dalla wishlist?')) {
          this._wm.clear();
        }
      });
    }

    this._fetchAndRender(items, grid);
  }

  async _fetchAndRender(items, grid) {
    const removeLabel = this.dataset.removeLabel || 'Rimuovi dalla wishlist';
    const showVendor = this.dataset.showVendor === 'true';
    const showRating = this.dataset.showRating === 'true';
    const showMinOrder = this.dataset.showMinOrder === 'true';
    const quickAdd = this.dataset.quickAdd || 'none';
    const showSecondaryImage = this.dataset.showSecondaryImage === 'true';
    const imageRatio = this.dataset.imageRatio || 'adapt';

    const fetches = items.map(item => this._fetchCard(item.handle));
    const cards = await Promise.all(fetches);

    grid.innerHTML = '';
    cards.forEach((cardHTML, i) => {
      if (!cardHTML) return;
      const li = document.createElement('li');
      li.className = 'grid__item';

      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.innerHTML = cardHTML;

      this._applySettings(wrapper, { showVendor, showRating, showMinOrder, quickAdd, showSecondaryImage });
      this._applyImageRatio(wrapper, imageRatio);

      const removeOverlay = document.createElement('div');
      removeOverlay.className = 'ms-wishlist-card-item__remove';
      removeOverlay.innerHTML = `
        <button type="button" class="ms-wishlist-remove-btn" data-handle="${items[i].handle}" aria-label="${removeLabel}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      const cardInner = wrapper.querySelector('.card__inner');
      if (cardInner) {
        cardInner.style.position = 'relative';
        cardInner.appendChild(removeOverlay);
      } else {
        wrapper.appendChild(removeOverlay);
      }

      const existingWishlistBtn = wrapper.querySelector('wishlist-button');
      if (existingWishlistBtn) existingWishlistBtn.remove();

      li.appendChild(wrapper);
      grid.appendChild(li);
    });

    grid.querySelectorAll('.ms-wishlist-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._wm.remove(btn.dataset.handle);
      });
    });
  }

  _applyImageRatio(wrapper, ratio) {
    if (ratio === 'adapt') return;
    const percent = ratio === 'square' ? '100%' : '125%';
    const aspect = ratio === 'square' ? '1 / 1' : '4 / 5';

    wrapper.querySelectorAll('.card, .card__inner').forEach(el => {
      el.style.setProperty('--ratio-percent', percent);
    });
    wrapper.querySelectorAll('.card__media .media').forEach(media => {
      media.style.aspectRatio = aspect;
      media.style.overflow = 'hidden';
      media.querySelectorAll('img').forEach(img => {
        img.style.position = 'absolute';
        img.style.top = '0';
        img.style.left = '0';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
      });
    });
  }

  _applySettings(wrapper, opts) {
    if (!opts.showVendor) {
      wrapper.querySelectorAll('.caption-with-letter-spacing').forEach(el => el.remove());
    }
    if (!opts.showRating) {
      wrapper.querySelectorAll('.rating, .rating-text, .rating-count').forEach(el => el.remove());
    }
    if (!opts.showMinOrder) {
      wrapper.querySelectorAll('.ms-min-order-label').forEach(el => el.remove());
    }
    if (opts.quickAdd === 'none') {
      wrapper.querySelectorAll('.quick-add, .quick-add-bulk, quick-add-bulk').forEach(el => el.remove());
    }
    if (!opts.showSecondaryImage) {
      const media = wrapper.querySelector('.media--hover-effect');
      if (media) {
        const imgs = media.querySelectorAll('img');
        if (imgs.length > 1) imgs[1].remove();
      }
    }
  }

  async _fetchCard(handle) {
    if (this._cardCache[handle]) return this._cardCache[handle];
    try {
      const res = await fetch(`/products/${handle}?view=ms-wishlist-card`);
      if (!res.ok) return null;
      const html = await res.text();
      this._cardCache[handle] = html.trim();
      return this._cardCache[handle];
    } catch { return null; }
  }
}

if (!customElements.get('wishlist-page')) {
  customElements.define('wishlist-page', WishlistPage);
}
