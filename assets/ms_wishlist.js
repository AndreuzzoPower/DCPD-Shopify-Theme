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
    this._productCache = {};
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
    const imageRatio = this.dataset.imageRatio || 'adapt';
    const showVendor = this.dataset.showVendor === 'true';
    const removeLabel = this.dataset.removeLabel || 'Rimuovi dalla wishlist';

    const fetches = items.map(item => this._getProduct(item.handle));
    const products = await Promise.all(fetches);

    grid.innerHTML = '';
    products.forEach((product, i) => {
      if (!product) return;
      const li = document.createElement('li');
      li.className = 'grid__item';
      li.innerHTML = this._cardHTML(product, items[i], imageRatio, showVendor, removeLabel);
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

  async _getProduct(handle) {
    if (this._productCache[handle]) return this._productCache[handle];
    try {
      const res = await fetch(`/products/${handle}.json`);
      if (!res.ok) return null;
      const data = await res.json();
      this._productCache[handle] = data.product;
      return data.product;
    } catch { return null; }
  }

  _cardHTML(product, item, imageRatio, showVendor, removeLabel) {
    const url = item.url || `/products/${product.handle}`;
    const img = product.images && product.images[0] ? product.images[0].src : '';
    const imgSized = img ? img.replace(/(\.\w+)(\?|$)/, '_600x$1$2') : '';
    const title = this._esc(product.title);
    const vendor = showVendor && product.vendor ? this._esc(product.vendor) : '';
    const price = product.variants && product.variants[0] ? product.variants[0].price : '';
    const comparePrice = product.variants && product.variants[0] ? product.variants[0].compare_at_price : '';
    const available = product.variants ? product.variants.some(v => v.available) : true;
    const onSale = comparePrice && parseFloat(comparePrice) > parseFloat(price);

    const ratioClass = imageRatio === 'portrait' ? 'media--portrait'
      : imageRatio === 'square' ? 'media--square' : 'media--adapt';

    const formatMoney = (cents) => {
      if (!cents) return '';
      const val = parseFloat(cents);
      return new Intl.NumberFormat(Shopify.locale || 'it-IT', {
        style: 'currency',
        currency: Shopify.currency?.active || 'EUR'
      }).format(val);
    };

    return `
      <div class="card-wrapper">
        <div class="card card--standard card--media" style="--ratio-percent: 100%;">
          <div class="card__inner ratio" style="--ratio-percent: 100%;">
            <div class="card__media">
              <div class="media ${ratioClass}">
                ${imgSized ? `<img src="${imgSized}" alt="${title}" loading="lazy" width="600" class="motion-reduce">` : ''}
              </div>
            </div>
            <div class="ms-wishlist-card-item__remove">
              <button type="button" class="ms-wishlist-remove-btn" data-handle="${this._esc(product.handle)}" aria-label="${removeLabel}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div class="card__content">
            <div class="card__information">
              <div class="card__heading h5">
                <a href="${url}" class="full-unstyled-link">${title}</a>
              </div>
              ${vendor ? `<span class="visually-hidden">Vendor:</span><div class="caption-with-letter-spacing light">${vendor}</div>` : ''}
              <div class="price${onSale ? ' price--on-sale' : ''}${!available ? ' price--sold-out' : ''}">
                <div class="price__container">
                  ${onSale ? `<div class="price__sale"><span class="visually-hidden">Prezzo scontato</span><s class="price-item price-item--regular">${formatMoney(comparePrice)}</s>&nbsp;<span class="price-item price-item--sale">${formatMoney(price)}</span></div>` : `<div class="price__regular"><span class="price-item price-item--regular">${formatMoney(price)}</span></div>`}
                </div>
              </div>
              ${!available ? '<span class="badge badge--bottom-left color-inverse">Esaurito</span>' : ''}
            </div>
          </div>
        </div>
      </div>
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
