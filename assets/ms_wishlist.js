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

    if (clearBtn) {
      clearBtn.onclick = () => {
        if (window.confirm(this.dataset.confirmClear || 'Rimuovere tutti i prodotti dalla wishlist?')) {
          this._wm.clear();
        }
      };
    }

    grid.innerHTML = items.map(item => this._cardHTML(item)).join('');

    grid.querySelectorAll('.ms-wishlist-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._wm.remove(btn.dataset.handle);
      });
    });
  }

  _cardHTML(item) {
    const imgSrc = item.image
      ? item.image.replace(/(\.\w+)(\?|$)/, '_400x$1$2')
      : '';
    const removeLabel = this.dataset.removeLabel || 'Rimuovi dalla wishlist';

    return `
      <article class="ms-wishlist-card-item">
        <div class="ms-wishlist-card-item__media">
          <a href="${item.url}" aria-label="${this._esc(item.title)}">
            ${imgSrc ? `<img src="${imgSrc}" alt="${this._esc(item.title)}" loading="lazy" width="400" height="400">` : ''}
          </a>
          <div class="ms-wishlist-card-item__remove">
            <button type="button" class="ms-wishlist-btn ms-wishlist-remove-btn" data-handle="${this._esc(item.handle)}" aria-label="${removeLabel}">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="ms-wishlist-card-item__info">
          <div class="ms-wishlist-card-item__title">
            <a href="${item.url}">${this._esc(item.title)}</a>
          </div>
          ${item.price ? `<div class="ms-wishlist-card-item__price">${item.price}</div>` : ''}
        </div>
      </article>
    `;
  }

  _esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
}

if (!customElements.get('wishlist-page')) {
  customElements.define('wishlist-page', WishlistPage);
}
