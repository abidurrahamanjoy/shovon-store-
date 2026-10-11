/* ============================================================
  Developer Joy — app.js
   Production build — no dummy data, all content from Firestore.
   ============================================================ */

/* ---------------- Image optimization ---------------- */
function optimizedImageUrl(url, width = 800) {
  const value = String(url || '').trim();
  if (!value) return value;
  try {
    const u = new URL(value);
    if (!u.hostname.includes('res.cloudinary.com')) return value;
    if (!u.pathname.includes('/image/upload/')) return value;
    const marker = '/image/upload/';
    const i = u.pathname.indexOf(marker);
    const prefix = u.pathname.slice(0, i + marker.length);
    const rest = u.pathname.slice(i + marker.length);
    const existing = rest.split('/');
    const hasTransform = existing[0] && /^(f_|q_|w_|h_|c_|dpr_|ar_|g_|b_|e_)/.test(existing[0]);
    if (hasTransform) return value;
    const safeWidth = Math.max(80, Math.min(1800, Math.round(Number(width) || 800)));
    u.pathname = prefix + `f_auto,q_auto:good,dpr_auto,w_${safeWidth}/` + rest;
    return u.toString();
  } catch (_) { return value; }
}

/* Inline SVG placeholder — no external dependency, no dummy image */
const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20200%20200%22%3E%3Crect%20fill%3D%22%23F7F4EF%22%20width%3D%22200%22%20height%3D%22200%22%2F%3E%3Cpath%20d%3D%22M55%20145%20L90%2095%20L115%20125%20L140%2090%20L160%20145%20Z%22%20fill%3D%22%23D6CFC2%22%2F%3E%3Ccircle%20cx%3D%2272%22%20cy%3D%2262%22%20r%3D%2213%22%20fill%3D%22%23D6CFC2%22%2F%3E%3C%2Fsvg%3E";

function imageAttrs(url, width = 800, eager = false) {
  const raw = String(url || '').trim();
  const src = raw ? optimizedImageUrl(raw, width) : PLACEHOLDER_IMG;
  return `src="${escapeHtml(src)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager ? ' fetchpriority="high"' : ''}`;
}

/* ---------------- Firebase init ---------------- */
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const CUSTOMER_EMAIL_DOMAIN = "@shuvon.customer";
const ADMIN_UID = String(STORE_CONFIG.adminUID || "").trim();

/* ---------------- Escaping & safety ---------------- */
function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function safeHttpUrl(value, fallback = '') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' ? u.href : fallback;
  } catch (_) { return fallback; }
}
function safeAttrUrl(value, fallback = '') {
  return escapeHtml(safeHttpUrl(value, fallback));
}
function safeParseJSON(str, fallback) {
  try {
    const v = JSON.parse(str);
    return (v === null || v === undefined) ? fallback : v;
  } catch (_) { return fallback; }
}

/* ---------------- Base URL helpers ---------------- */
function appBaseUrl() {
  const path = location.pathname || '/';
  const basePath = path.endsWith('/') ? path : path.slice(0, path.lastIndexOf('/') + 1);
  return `${location.origin}${basePath}`.replace(/\/+$/, '');
}
function siteUrl() {
  return String(STORE_CONFIG.siteUrl || appBaseUrl()).replace(/\/+$/, '');
}
function productAppUrl(id) {
  return `${siteUrl()}/?p=${encodeURIComponent(id)}`;
}

/* ---------------- UI helpers ---------------- */
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
function notifyBrowser(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      const opts = { body };
      if (SITE_SETTINGS.logoUrl) opts.icon = SITE_SETTINGS.logoUrl;
      new Notification(title, opts);
    } catch (_) {}
  }
  showToast(title);
}
function requestNotifPermission(btn) {
  if (!('Notification' in window)) { alert('আপনার ব্রাউজার নোটিফিকেশন সাপোর্ট করে না'); return; }
  Notification.requestPermission().then(p => {
    if (btn) btn.textContent = p === 'granted' ? 'চালু আছে ✓' : 'অনুমতি দিন';
  });
}

/* ---------------- State ---------------- */
let SITE_SETTINGS = {
  storeName: '',
  storeAddress: '',
  contactNumber: '',
  websiteUrl: '',
  whatsappNumber: '',
  currency: '৳',
  logoUrl: '',
  heroImages: [],
  heroTitle: '',
  heroSubtitle: '',
  heroBtnText: '',
  bgType: 'solid',
  bgColor: '#FFFFFF',
  ownerDistrict: '',
  deliveryChargeInside: 0,
  deliveryChargeOutside: 0,
  deliveryTimeText: '',
  termsText: '',
  bkashNumber: ''
};
let settingsLoaded = false;

let PRODUCTS = [];
let productsLoading = true;
let CATEGORY_IMAGES = {};
let isAdmin = false;
let isCustomer = false;
let customerProfile = null;
let activeCategory = "সব";
let activeView = "home";
let searchTerm = "";
let sortMode = "new";
let cart = safeParseJSON(localStorage.getItem('shuvon_cart'), {});
let wishlist = safeParseJSON(localStorage.getItem('shuvon_wishlist'), {});
let editingId = null;
let currentViewProductId = null;
let adminFirstLoad = { orders: true };
let myOrdersUnsub = null;
let chatUnsub = null;
let adminInboxUnsub = null;
let adminChatUnsub = null;
let customerInboxUnsub = null;
let openAdminChatUid = null;
let pendingAuthSuccessCallback = null;

let pendingProductImages = [];
let currentProductImageUrls = [];
let pendingLogoFile = null;
let currentLogoUrl = "";
let draftHeroImages = [];
let heroSlideIndex = 0;
let heroTimer = null;
let knownOrderStatuses = {};

const BD_DISTRICTS = ["ঢাকা","ফরিদপুর","গাজীপুর","গোপালগঞ্জ","কিশোরগঞ্জ","মাদারীপুর","মানিকগঞ্জ","মুন্সিগঞ্জ","নারায়ণগঞ্জ","নরসিংদী","রাজবাড়ী","শরীয়তপুর","টাঙ্গাইল","বাগেরহাট","চুয়াডাঙ্গা","যশোর","ঝিনাইদহ","খুলনা","কুষ্টিয়া","মাগুরা","মেহেরপুর","নড়াইল","সাতক্ষীরা","বরগুনা","বরিশাল","ভোলা","ঝালকাঠি","পটুয়াখালী","পিরোজপুর","বান্দরবান","ব্রাহ্মণবাড়িয়া","চাঁদপুর","চট্টগ্রাম","কুমিল্লা","কক্সবাজার","ফেনী","খাগড়াছড়ি","লক্ষ্মীপুর","নোয়াখালী","রাঙ্গামাটি","জামালপুর","ময়মনসিংহ","নেত্রকোণা","শেরপুর","বগুড়া","জয়পুরহাট","নওগাঁ","নাটোর","চাঁপাইনবাবগঞ্জ","পাবনা","রাজশাহী","সিরাজগঞ্জ","দিনাজপুর","গাইবান্ধা","কুড়িগ্রাম","লালমনিরহাট","নীলফামারী","পঞ্চগড়","রংপুর","ঠাকুরগাঁও","হবিগঞ্জ","মৌলভীবাজার","সুনামগঞ্জ","সিলেট"];

/* ---------------- SEO ---------------- */
function getStoreBrand() {
  const n = String(SITE_SETTINGS.storeName || '').trim();
  return n || 'স্টোর';
}
function getSeoTitle() {
  return getStoreBrand() + ' — অনলাইন স্টোর';
}

/* ---------------- Service worker ---------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', siteUrl() + '/').href).catch(() => {});
  });
}

/* ---------------- Google Analytics (optional) ---------------- */
if (STORE_CONFIG.googleAnalyticsId) {
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${STORE_CONFIG.googleAnalyticsId}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', STORE_CONFIG.googleAnalyticsId);
}

/* ---------------- Analytics helpers ---------------- */
function gaEvent(name, params = {}) {
  try { if (typeof gtag === 'function') gtag('event', name, params); } catch (_) {}
}
function analyticsDateId(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
async function incrementAnalyticsDoc(ref, initialData) {
  try {
    await ref.set({
      ...initialData,
      views: firebase.firestore.FieldValue.increment(1),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return true;
  } catch (e) { console.warn('Analytics counter failed:', e); return false; }
}
async function trackSiteVisit() {
  if (sessionStorage.getItem('shuvon_site_visit_tracked') === '1') return;
  sessionStorage.setItem('shuvon_site_visit_tracked', '1');
  gaEvent('store_visit');
  const today = analyticsDateId();
  await Promise.all([
    incrementAnalyticsDoc(db.collection('analytics').doc('site'), { views: 0 }),
    incrementAnalyticsDoc(db.collection('analyticsDaily').doc(today), { views: 0 })
  ]);
}
async function trackProductView(p) {
  if (!p || !p.id) return;
  const key = `shuvon_product_view_${p.id}`;
  if (sessionStorage.getItem(key) === '1') return;
  sessionStorage.setItem(key, '1');
  gaEvent('view_item', {
    currency: 'BDT',
    value: Number(p.price || 0),
    items: [{ item_id: String(p.id), item_name: p.name || '' }]
  });
  await incrementAnalyticsDoc(
    db.collection('analyticsProducts').doc(String(p.id)),
    { name: String(p.name || '').slice(0, 120), views: 0 }
  );
}
async function loadAdminAnalytics() {
  if (!isAdmin) return;
  const body = document.getElementById('analyticsBody');
  if (!body) return;
  body.innerHTML = '<p style="color:var(--ink-soft);">Analytics লোড হচ্ছে...</p>';
  try {
    const [siteSnap, dailySnap, productsSnap] = await Promise.all([
      db.collection('analytics').doc('site').get(),
      db.collection('analyticsDaily').orderBy('updatedAt', 'desc').limit(30).get(),
      db.collection('analyticsProducts').orderBy('views', 'desc').limit(10).get()
    ]);
    const total = siteSnap.exists ? Number(siteSnap.data().views || 0) : 0;
    const daily = dailySnap.docs.map(d => ({ id: d.id, views: Number(d.data().views || 0) }));
    const now = new Date();
    const dayOffset = (days) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
      return analyticsDateId(d);
    };
    const last7Start = dayOffset(6);
    const last30Start = dayOffset(29);
    const last7 = daily.filter(x => x.id >= last7Start).reduce((n, x) => n + x.views, 0);
    const last30 = daily.filter(x => x.id >= last30Start).reduce((n, x) => n + x.views, 0);
    const rows = productsSnap.docs.map((d, i) =>
      `<div style="display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #eee;"><b style="width:24px;">${i + 1}</b><span style="flex:1;">${escapeHtml(d.data().name || d.id)}</span><strong>${Number(d.data().views || 0).toLocaleString('en-US')}</strong></div>`
    ).join('') || '<p style="color:var(--ink-soft);">এখনো কোনো প্রোডাক্ট ভিউ নেই।</p>';
    body.innerHTML =
      `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:18px;">
        <div class="glass-card" style="padding:14px;"><small>মোট ভিজিট</small><div style="font-size:1.5rem;font-weight:800;">${total.toLocaleString('en-US')}</div></div>
        <div class="glass-card" style="padding:14px;"><small>আজ</small><div style="font-size:1.5rem;font-weight:800;">${(daily.find(x => x.id === analyticsDateId())?.views || 0).toLocaleString('en-US')}</div></div>
        <div class="glass-card" style="padding:14px;"><small>গত ৭ দিন</small><div style="font-size:1.5rem;font-weight:800;">${last7.toLocaleString('en-US')}</div></div>
        <div class="glass-card" style="padding:14px;"><small>গত ৩০ দিন</small><div style="font-size:1.5rem;font-weight:800;">${last30.toLocaleString('en-US')}</div></div>
      </div>
      <h3 style="margin:8px 0 4px;">সবচেয়ে বেশি দেখা পণ্য</h3>
      <div>${rows}</div>
      <p style="font-size:.75rem;color:var(--ink-soft);margin-top:14px;">Google Analytics-এ আরও বিস্তারিত audience, traffic source ও real-time data পাওয়া যাবে।</p>`;
  } catch (e) {
    console.error(e);
    body.innerHTML = '<p style="color:#C0392B;">Analytics লোড করা যায়নি। Firestore Rules ও Admin login পরীক্ষা করুন।</p>';
  }
}
window.loadAdminAnalytics = loadAdminAnalytics;

/* ---------------- Cloudinary upload ---------------- */
async function uploadToStorage(file, folder) {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  if (!file || !allowedTypes.has(file.type)) {
    throw new Error('শুধু JPG, PNG, WEBP বা GIF ছবি আপলোড করা যাবে।');
  }
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('ছবির সর্বোচ্চ সাইজ ৫ MB।');
  }
  const cloudName = String(STORE_CONFIG.cloudinaryCloudName || '').trim();
  const uploadPreset = String(STORE_CONFIG.cloudinaryUploadPreset || '').trim();
  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary সেটআপ নেই। firebase-config.js-এ cloudinaryCloudName এবং cloudinaryUploadPreset দিন।');
  }
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', uploadPreset);
  const safeFolder = String(folder || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  if (safeFolder) fd.append('folder', `shuvon-store-${safeFolder}`);

  let res, json;
  try {
    res = await fetch(endpoint, { method: 'POST', body: fd });
  } catch (_) {
    throw new Error('Cloudinary সার্ভারে পৌঁছানো যায়নি। Internet/CORS বা Cloudinary Cloud Name পরীক্ষা করুন।');
  }
  try { json = await res.json(); }
  catch (_) { throw new Error(`Cloudinary থেকে অপ্রত্যাশিত উত্তর (HTTP ${res.status})`); }
  if (!res.ok || !json.secure_url || json.resource_type !== 'image' || !String(json.secure_url).startsWith('https://')) {
    const msg = json && json.error ? json.error.message : `HTTP ${res.status}`;
    const lower = String(msg).toLowerCase();
    if (lower.includes('upload preset') || lower.includes('unsigned') || lower.includes('not found')) {
      throw new Error(`Cloudinary upload preset সমস্যা: "${uploadPreset}"। Cloudinary → Settings → Upload → Upload Presets-এ এই preset-টি অবশ্যই Unsigned হতে হবে।`);
    }
    throw new Error(`আপলোড ব্যর্থ (Cloudinary preset: "${uploadPreset}"): ${msg}`);
  }
  return json.secure_url;
}

/* ---------------- Drawer helpers ---------------- */
const overlay = document.getElementById('overlay');
function closeAllDrawers() {
  document.querySelectorAll('.drawer').forEach(d => d.classList.remove('open'));
  if (overlay) overlay.classList.remove('open');
}
function openDrawer(id) {
  closeAllDrawers();
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
  if (overlay) overlay.classList.add('open');
}
if (overlay) overlay.addEventListener('click', closeAllDrawers);

/* ---------------- Site settings snapshot ---------------- */
db.collection('settings').doc('store_info').onSnapshot(docSnap => {
  if (docSnap.exists) {
    SITE_SETTINGS = { ...SITE_SETTINGS, ...docSnap.data() };
  }
  settingsLoaded = true;
  if (isAdmin) fillSettingsForm();
  updateSiteInfoUI();
  updateCartUI();
  renderCategories();
  renderProducts();
}, err => {
  console.error('Settings load failed:', err);
  settingsLoaded = true;
  updateSiteInfoUI();
  renderProducts();
});

trackSiteVisit();

/* ---------------- Site UI update ---------------- */
function updateSeoSiteUrl() {
  const base = siteUrl();
  const canonical = document.getElementById('canonicalLink');
  const ogUrl = document.getElementById('ogUrlTag');
  const ogImage = document.getElementById('ogImageTag');
  if (canonical) canonical.href = base + '/';
  if (ogUrl) ogUrl.content = base + '/';
  if (ogImage) ogImage.content = SITE_SETTINGS.logoUrl || (base + '/icon-512.png');
  const ogSiteName = document.querySelector('meta[property="og:site_name"]');
  if (ogSiteName && SITE_SETTINGS.storeName) ogSiteName.setAttribute('content', SITE_SETTINGS.storeName);
  const storeLdScript = document.querySelector('script[type="application/ld+json"]:not(#productJsonLd)');
  if (storeLdScript && SITE_SETTINGS.storeName) {
    try {
      const parsed = JSON.parse(storeLdScript.textContent);
      parsed["@graph"].forEach(item => {
        if (item["@type"] === "WebSite" || item["@type"] === "OnlineStore") {
          item.name = SITE_SETTINGS.storeName;
          item.url = base + '/';
        }
        if (item["@type"] === "OnlineStore" && item.address && SITE_SETTINGS.ownerDistrict) {
          item.address.addressLocality = SITE_SETTINGS.ownerDistrict;
        }
      });
      storeLdScript.textContent = JSON.stringify(parsed);
    } catch (_) {}
  }
}

function updateHeroContent() {
  const h1 = document.querySelector('.hero-content h1');
  const p = document.querySelector('.hero-content p');
  const btn = document.querySelector('.hero-btn');
  if (h1 && String(SITE_SETTINGS.heroTitle || '').trim()) h1.textContent = SITE_SETTINGS.heroTitle;
  if (p && String(SITE_SETTINGS.heroSubtitle || '').trim()) p.textContent = SITE_SETTINGS.heroSubtitle;
  if (btn && String(SITE_SETTINGS.heroBtnText || '').trim()) btn.textContent = SITE_SETTINGS.heroBtnText;
}

function updateSiteInfoUI() {
  const storeNameEl = document.getElementById('siteStoreName');
  const logoEl = document.getElementById('siteLogoImg');
  const brand = getStoreBrand();
  if (storeNameEl) storeNameEl.textContent = SITE_SETTINGS.storeName || '';
  if (logoEl) {
    if (SITE_SETTINGS.logoUrl) { logoEl.src = SITE_SETTINGS.logoUrl; logoEl.style.display = 'block'; }
    else { logoEl.style.display = 'none'; }
  }
  if (!currentViewProductId) document.title = SITE_SETTINGS.storeName ? getSeoTitle() : '';

  const cleanWaNum = String(SITE_SETTINGS.whatsappNumber || '').replace(/[^0-9]/g, '');
  const waHref = cleanWaNum ? `https://wa.me/${cleanWaNum}?text=${encodeURIComponent('আসসালামু আলাইকুম')}` : '#';
  const floatWa = document.getElementById('floatWaBtn');
  const menuWa = document.getElementById('menuWaLink');
  if (floatWa) floatWa.href = waHref;
  if (menuWa) menuWa.href = waHref;

  renderHeroCarousel();
  applyBackground();
  updateSeoSiteUrl();
  updateHeroContent();

  const termsBody = document.getElementById('termsBody');
  if (termsBody) termsBody.textContent = SITE_SETTINGS.termsText || '';

  const payBkash = document.getElementById('payBkashNumber');
  if (payBkash) payBkash.textContent = SITE_SETTINGS.bkashNumber || '—';

  const payTime = document.getElementById('payDeliveryTime');
  if (payTime) payTime.textContent = SITE_SETTINGS.deliveryTimeText || '—';

  const custDistrict = document.getElementById('custDistrict');
  if (custDistrict && !custDistrict.value && SITE_SETTINGS.ownerDistrict) {
    custDistrict.value = SITE_SETTINGS.ownerDistrict;
  }
}

function applyBackground() {
  document.body.classList.remove('bg-gradient1', 'bg-gradient2', 'bg-pattern1');
  if (SITE_SETTINGS.bgType && SITE_SETTINGS.bgType !== 'solid') {
    document.body.classList.add('bg-' + SITE_SETTINGS.bgType);
    document.body.style.background = '';
  } else {
    document.body.style.background = SITE_SETTINGS.bgColor || '';
  }
}

function renderHeroCarousel() {
  const box = document.getElementById('heroBox');
  const slidesEl = document.getElementById('heroSlides');
  const dotsEl = document.getElementById('heroDots');
  const contentEl = document.querySelector('.hero-content');
  if (!box || !slidesEl || !dotsEl) return;

  const rawImages = (SITE_SETTINGS.heroImages || []).filter(Boolean);
  const safeImages = rawImages.map(u => safeHttpUrl(u)).filter(Boolean);
  const optimized = safeImages.map(u => optimizedImageUrl(u, 1400));

  const oldPreload = document.getElementById('heroImagePreload');
  if (oldPreload) oldPreload.remove();

  if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }

  if (!optimized.length) {
    slidesEl.innerHTML = '';
    dotsEl.innerHTML = '';
    if (contentEl) contentEl.style.background = 'rgba(20,17,12,0.35)';
    return;
  }

  if (contentEl) contentEl.style.background = '';

  const preload = document.createElement('link');
  preload.id = 'heroImagePreload';
  preload.rel = 'preload';
  preload.as = 'image';
  preload.href = optimized[0];
  document.head.appendChild(preload);

  slidesEl.innerHTML = optimized.map((url, i) =>
    `<div class="hero-slide ${i === 0 ? 'active' : ''}" style="background-image:url('${escapeHtml(url)}')"></div>`
  ).join('');
  dotsEl.innerHTML = optimized.length > 1
    ? optimized.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('')
    : '';

  heroSlideIndex = 0;
  if (optimized.length > 1) {
    heroTimer = setInterval(() => {
      const slides = document.querySelectorAll('.hero-slide');
      const dots = document.querySelectorAll('.hero-dots span');
      if (!slides.length) return;
      slides[heroSlideIndex].classList.remove('active');
      dots[heroSlideIndex] && dots[heroSlideIndex].classList.remove('active');
      heroSlideIndex = (heroSlideIndex + 1) % slides.length;
      slides[heroSlideIndex].classList.add('active');
      dots[heroSlideIndex] && dots[heroSlideIndex].classList.add('active');
    }, 4000);
  }
}

/* ---------------- District selects ---------------- */
function fillDistrictSelects() {
  const opts = BD_DISTRICTS.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  ['custDistrict', 'setOwnerDistrict', 'profDistrict'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}
fillDistrictSelects();

/* ---------------- Settings form fill ---------------- */
function fillSettingsForm() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('setStoreName', SITE_SETTINGS.storeName || '');
  set('setStoreAddress', SITE_SETTINGS.storeAddress || '');
  set('setContactNumber', SITE_SETTINGS.contactNumber || '');
  set('setWebsiteUrl', SITE_SETTINGS.websiteUrl || '');
  set('setWaNum', SITE_SETTINGS.whatsappNumber || '');
  set('setBkashNumber', SITE_SETTINGS.bkashNumber || '');
  set('setOwnerDistrict', SITE_SETTINGS.ownerDistrict || '');
  set('setDeliveryInside', SITE_SETTINGS.deliveryChargeInside || 0);
  set('setDeliveryOutside', SITE_SETTINGS.deliveryChargeOutside || 0);
  set('setDeliveryTime', SITE_SETTINGS.deliveryTimeText || '');
  set('setTerms', SITE_SETTINGS.termsText || '');
  set('setBgType', SITE_SETTINGS.bgType || 'solid');
  set('setBgColor', SITE_SETTINGS.bgColor || '#FFFFFF');

  const bgColorField = document.getElementById('setBgColorField');
  if (bgColorField) bgColorField.style.display = (SITE_SETTINGS.bgType || 'solid') === 'solid' ? 'block' : 'none';

  const logoPreview = document.getElementById('logoPreview');
  if (logoPreview) {
    if (SITE_SETTINGS.logoUrl) { logoPreview.src = SITE_SETTINGS.logoUrl; logoPreview.style.display = 'block'; }
    else { logoPreview.style.display = 'none'; logoPreview.removeAttribute('src'); }
  }
  currentLogoUrl = SITE_SETTINGS.logoUrl || '';

  draftHeroImages = [...(SITE_SETTINGS.heroImages || [])];
  renderHeroImagesList();
}

/* ---------------- Navigation / menu ---------------- */
const menuOpenBtn = document.getElementById('menuOpenBtn');
if (menuOpenBtn) menuOpenBtn.addEventListener('click', () => openDrawer('menuDrawer'));

const menuAccountLink = document.getElementById('menuAccountLink');
if (menuAccountLink) menuAccountLink.addEventListener('click', (e) => {
  e.preventDefault();
  if (isAdmin) openDrawer('adminLoginDrawer');
  else openDrawer('accountDrawer');
});

const enableNotifBtn = document.getElementById('enableNotifBtn');
if (enableNotifBtn) enableNotifBtn.addEventListener('click', (e) => requestNotifPermission(e.target));
const enableAdminNotifBtn = document.getElementById('enableAdminNotifBtn');
if (enableAdminNotifBtn) enableAdminNotifBtn.addEventListener('click', (e) => requestNotifPermission(e.target));

const forgotPassLink = document.getElementById('forgotPassLink');
if (forgotPassLink) forgotPassLink.addEventListener('click', () => {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) return alert('আগে ইমেইল লিখুন');
  auth.sendPasswordResetEmail(email)
    .then(() => showToast('রিসেট লিংক ইমেইলে পাঠানো হয়েছে'))
    .catch(e => alert(e.message));
});

/* ---------------- Auth modal ---------------- */
function openAuthModal(onSuccess) {
  pendingAuthSuccessCallback = onSuccess || null;
  const err = document.getElementById('modalAuthError');
  if (err) err.style.display = 'none';
  const phone = document.getElementById('modalAuthPhone');
  const pass = document.getElementById('modalAuthPassword');
  if (phone) phone.value = '';
  if (pass) pass.value = '';
  document.getElementById('authModalOverlay').classList.add('open');
}
function closeAuthModal() {
  const el = document.getElementById('authModalOverlay');
  if (el) el.classList.remove('open');
}
const authOverlay = document.getElementById('authModalOverlay');
if (authOverlay) authOverlay.addEventListener('click', (e) => {
  if (e.target.id === 'authModalOverlay') closeAuthModal();
});

const modalAuthSubmitBtn = document.getElementById('modalAuthSubmitBtn');
if (modalAuthSubmitBtn) modalAuthSubmitBtn.addEventListener('click', async () => {
  const btn = modalAuthSubmitBtn;
  btn.disabled = true;
  const ok = await customerAuthSubmit(
    document.getElementById('modalAuthPhone').value.trim(),
    document.getElementById('modalAuthPassword').value,
    document.getElementById('modalAuthError')
  );
  btn.disabled = false;
  if (ok) {
    showToast('লগইন সফল হয়েছে');
    closeAuthModal();
    if (pendingAuthSuccessCallback) {
      const cb = pendingAuthSuccessCallback;
      pendingAuthSuccessCallback = null;
      cb();
    }
  }
});

/* ---------------- Search ---------------- */
const searchBarEl = document.getElementById('searchBar');
const searchInputEl = document.getElementById('searchInput');
function toggleSearch() {
  if (!searchBarEl) return;
  searchBarEl.classList.toggle('open');
  if (searchBarEl.classList.contains('open')) {
    setTimeout(() => searchInputEl && searchInputEl.focus(), 200);
  } else {
    if (searchInputEl) searchInputEl.value = '';
    searchTerm = '';
    hideSuggest();
    renderProducts();
  }
}
const searchOpenBtn = document.getElementById('searchOpenBtn');
if (searchOpenBtn) searchOpenBtn.addEventListener('click', toggleSearch);

const suggestBoxEl = document.getElementById('suggestBox');
function hideSuggest() {
  if (!suggestBoxEl) return;
  suggestBoxEl.classList.remove('show');
  suggestBoxEl.innerHTML = '';
}
function updateSuggest() {
  if (!suggestBoxEl) return;
  const words = searchTerm.split(/\s+/).filter(Boolean);
  if (!words.length) { hideSuggest(); return; }
  const top = PRODUCTS.map(p => ({ p, s: scoreProduct(p, words) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 6)
    .map(x => x.p);
  if (!top.length) { hideSuggest(); return; }
  suggestBoxEl.innerHTML = top.map(p =>
    `<div class="suggest-item" data-id="${escapeHtml(p.id)}"><img ${imageAttrs(p.image, 180)} alt=""><b>${escapeHtml(p.name)}</b><span>৳${Number(p.price || 0)}</span></div>`
  ).join('');
  suggestBoxEl.classList.add('show');
}
if (suggestBoxEl) suggestBoxEl.addEventListener('click', (e) => {
  const it = e.target.closest('.suggest-item');
  if (!it) return;
  hideSuggest();
  openFullview(it.dataset.id);
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#suggestBox') && !e.target.closest('#searchBar')) hideSuggest();
});
if (searchInputEl) searchInputEl.addEventListener('input', (e) => {
  searchTerm = e.target.value.trim().toLowerCase();
  renderProducts();
  updateSuggest();
});
const sortSelect = document.getElementById('sortSelect');
if (sortSelect) sortSelect.addEventListener('change', (e) => {
  sortMode = e.target.value;
  renderProducts();
});

/* ---------------- Bottom nav ---------------- */
function setActiveNav(id) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}
const navHomeBtn = document.getElementById('navHomeBtn');
if (navHomeBtn) navHomeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  goHomeView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setActiveNav('navHomeBtn');
});
const navFavBtn = document.getElementById('navFavBtn');
if (navFavBtn) navFavBtn.addEventListener('click', (e) => {
  e.preventDefault();
  setActiveNav('navFavBtn');
  showFavorites();
});
const navInboxBtn = document.getElementById('navInboxBtn');
if (navInboxBtn) navInboxBtn.addEventListener('click', (e) => {
  e.preventDefault();
  setActiveNav('navInboxBtn');
  if (isAdmin) {
    openDrawer('adminInboxDrawer');
    loadAdminInbox();
  } else if (isCustomer && auth.currentUser) {
    openDrawer('chatDrawer');
    startChat();
  } else {
    openAuthModal(() => {
      openDrawer('chatDrawer');
      startChat();
    });
  }
});

function goHomeView() { activeView = 'home'; renderProducts(); }
function showFavorites() {
  activeView = 'favorites';
  const p = document.getElementById('products');
  if (p) p.scrollIntoView();
  renderProducts();
}

/* ---------------- Admin URL ---------------- */
function isAdminUrl() {
  return /\/admin\/?$/i.test(location.pathname) || location.hash.toLowerCase() === '#admin';
}
window.addEventListener('load', () => {
  if (isAdminUrl()) setTimeout(() => openDrawer('adminLoginDrawer'), 400);
});

/* ---------------- Auth state ---------------- */
auth.onAuthStateChanged(async user => {
  isAdmin = !!(user && ADMIN_UID && user.uid === ADMIN_UID);
  isCustomer = !!(user && !isAdmin);
  const adminFab = document.getElementById('adminFabBtn');
  if (adminFab) adminFab.classList.toggle('show', isAdmin);

  const adminDrawerTitle = document.getElementById('adminDrawerTitle');
  const adminLoginSection = document.getElementById('adminLoginFormSection');
  const adminMenuSection = document.getElementById('adminMenuSection');

  if (isAdmin) {
    if (adminDrawerTitle) adminDrawerTitle.textContent = "এডমিন ড্যাশবোর্ড";
    if (adminLoginSection) adminLoginSection.style.display = 'none';
    if (adminMenuSection) adminMenuSection.style.display = 'block';
    fillSettingsForm();
    startAdminNotificationListeners();
    db.collection('chats').onSnapshot(snap => {
      let unread = 0;
      snap.docs.forEach(d => { if (d.data().unreadByAdmin) unread++; });
      setInboxBadge(unread > 0);
    }, () => {});
  } else {
    if (adminDrawerTitle) adminDrawerTitle.textContent = "এডমিন লগইন";
    if (adminLoginSection) adminLoginSection.style.display = 'block';
    if (adminMenuSection) adminMenuSection.style.display = 'none';
  }

  const loggedOutSection = document.getElementById('accountLoggedOutSection');
  const loggedInSection = document.getElementById('accountLoggedInSection');

  if (isCustomer) {
    if (loggedOutSection) loggedOutSection.style.display = 'none';
    if (loggedInSection) loggedInSection.style.display = 'block';
    startCustomerInboxNotificationListener(user.uid);
    const phone = user.email.replace(CUSTOMER_EMAIL_DOMAIN, '');
    const custDoc = await db.collection('customers').doc(user.uid).get();
    customerProfile = custDoc.exists
      ? custDoc.data()
      : { phone, name: '', address: '', district: SITE_SETTINGS.ownerDistrict || '', upazila: '' };
    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setV('profName', customerProfile.name || '');
    setV('profPhone', customerProfile.phone || phone);
    setV('profDistrict', customerProfile.district || SITE_SETTINGS.ownerDistrict || '');
    setV('profUpazila', customerProfile.upazila || '');
    setV('profAddress', customerProfile.address || '');
    startMyOrdersListener(user.uid);
  } else {
    if (loggedOutSection) loggedOutSection.style.display = 'block';
    if (loggedInSection) loggedInSection.style.display = 'none';
    customerProfile = null;
    if (myOrdersUnsub) { myOrdersUnsub(); myOrdersUnsub = null; }
    if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  }

  updateCartUI();
  renderCategories();
  renderProducts();
});

const loginSubmitBtn = document.getElementById('loginSubmitBtn');
if (loginSubmitBtn) loginSubmitBtn.addEventListener('click', () => {
  const err = document.getElementById('loginError');
  if (err) err.style.display = 'none';
  auth.signInWithEmailAndPassword(
    document.getElementById('loginEmail').value,
    document.getElementById('loginPassword').value
  ).then(cred => {
    if (cred.user.uid !== ADMIN_UID) { auth.signOut(); alert("প্রবেশাধিকার সংরক্ষিত!"); }
    else { showToast("সফলভাবে লগইন হয়েছে"); closeAllDrawers(); }
  }).catch(() => {
    if (err) err.style.display = 'block';
  });
});

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', () => {
  auth.signOut();
  closeAllDrawers();
  showToast("লগআউট সফল হয়েছে");
});

async function customerAuthSubmit(phone, password, errorEl) {
  errorEl.style.display = 'none';
  if (!/^01[3-9][0-9]{8}$/.test(phone)) {
    errorEl.textContent = 'সঠিক মোবাইল নম্বর দিন';
    errorEl.style.display = 'block';
    return false;
  }
  if (!password || password.length < 6) {
    errorEl.textContent = 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে';
    errorEl.style.display = 'block';
    return false;
  }
  const email = phone + CUSTOMER_EMAIL_DOMAIN;
  try {
    await auth.signInWithEmailAndPassword(email, password);
    return true;
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('customers').doc(cred.user.uid).set({
          phone,
          name: '',
          address: '',
          district: SITE_SETTINGS.ownerDistrict || '',
          upazila: '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
      } catch (err2) {
        errorEl.textContent = 'একাউন্ট তৈরি করা যায়নি: ' + err2.message;
        errorEl.style.display = 'block';
        return false;
      }
    }
    errorEl.textContent = 'ভুল পাসওয়ার্ড অথবা তথ্য মিলছে না।';
    errorEl.style.display = 'block';
    return false;
  }
}

const custLogoutBtn = document.getElementById('custLogoutBtn');
if (custLogoutBtn) custLogoutBtn.addEventListener('click', () => {
  auth.signOut();
  closeAllDrawers();
  showToast('লগআউট হয়েছে');
});

const profSaveBtn = document.getElementById('profSaveBtn');
if (profSaveBtn) profSaveBtn.addEventListener('click', async () => {
  if (!auth.currentUser) return;
  const data = {
    name: document.getElementById('profName').value.trim(),
    address: document.getElementById('profAddress').value.trim(),
    district: document.getElementById('profDistrict').value,
    upazila: document.getElementById('profUpazila').value.trim()
  };
  try {
    await db.collection('customers').doc(auth.currentUser.uid).set(data, { merge: true });
    customerProfile = { ...customerProfile, ...data };
    showToast('প্রোফাইল সংরক্ষণ হয়েছে');
  } catch (e) {
    alert('সংরক্ষণে সমস্যা: ' + e.message);
  }
});

/* ---------------- Orders (customer side) ---------------- */
function orderStatusLabel(status) {
  return ({
    pending_payment: 'পেমেন্ট যাচাই বাকি',
    confirmed: 'অর্ডার নিশ্চিত',
    payment_mismatch: 'পেমেন্ট মিসম্যাচ',
    processing: 'প্রসেসিং',
    shipped: 'পাঠানো হয়েছে',
    delivered: 'ডেলিভারড',
    cancelled: 'বাতিল'
  })[status] || status;
}

function startMyOrdersListener(uid) {
  if (myOrdersUnsub) myOrdersUnsub();
  let first = true;
  myOrdersUnsub = db.collection('orders')
    .where('customerUid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(30)
    .onSnapshot(snap => {
      const list = document.getElementById('myOrdersList');
      if (!list) return;
      if (snap.empty) {
        list.innerHTML = '<p style="color:var(--ink-soft); font-size:0.85rem;">এখনো কোনো অর্ডার নেই।</p>';
        first = false;
        return;
      }
      list.innerHTML = snap.docs.map(d => {
        const o = d.data();
        if (!first && knownOrderStatuses[d.id] && knownOrderStatuses[d.id] !== o.status) {
          notifyBrowser('অর্ডার আপডেট হয়েছে', `#${d.id.slice(0, 6)} — স্ট্যাটাস: ${orderStatusLabel(o.status)}`);
        }
        knownOrderStatuses[d.id] = o.status;
        const trackLink = safeHttpUrl(o.trackingUrl)
          ? `<a href="${safeAttrUrl(o.trackingUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-dark); font-weight:600; font-size:0.85rem; display:block; margin-top:6px;">ডেলিভারি ট্র্যাক করুন →</a>`
          : '';
        return `<div class="order-card">
          <span class="status-badge ${escapeHtml(o.status)}">${escapeHtml(orderStatusLabel(o.status))}</span>
          <p style="margin-top:8px; font-size:0.85rem;">মোট: ৳${Number(o.grandTotal || 0)}</p>
          ${trackLink}
          <button class="btn-block btn-outline" style="margin-top:10px;" onclick="printOrderMemo('${escapeHtml(d.id)}','customer')">🖨 মেমো প্রিন্ট করুন</button>
        </div>`;
      }).join('');
      first = false;
    }, err => {
      console.error(err);
      const list = document.getElementById('myOrdersList');
      if (list) list.innerHTML = '<p style="color:var(--danger); font-size:0.85rem;">লোড করতে সমস্যা হয়েছে (Firestore index প্রয়োজন হতে পারে)।</p>';
    });
}

function startAdminNotificationListeners() {
  db.collection('orders').orderBy('createdAt', 'desc').limit(20).onSnapshot(snap => {
    if (adminFirstLoad.orders) { adminFirstLoad.orders = false; return; }
    snap.docChanges().forEach(ch => {
      if (ch.type === 'added') {
        const o = ch.doc.data();
        notifyBrowser('🛍 নতুন অর্ডার!', `${o.customerName || ''} — ৳${o.grandTotal || 0}`);
      }
    });
  }, () => {});
}

/* ---------------- Chat (customer side) ---------------- */
function linkifyChatText(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/(https?:\/\/[^\s]+)/g, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">🔗 লিংক দেখুন</a>`);
}
function chatBubbleHtml(m) {
  return `<div class="chat-bubble ${escapeHtml(m.sender)}">${linkifyChatText(m.text)}</div>`;
}
function setInboxBadge(show) {
  const el = document.getElementById('inboxBadge');
  if (el) el.style.display = show ? 'block' : 'none';
}
function startCustomerInboxNotificationListener(uid) {
  if (customerInboxUnsub) customerInboxUnsub();
  if (!uid || isAdmin) { setInboxBadge(false); return; }
  customerInboxUnsub = db.collection('chats').doc(uid).onSnapshot(docSnap => {
    setInboxBadge(!!(docSnap.exists && docSnap.data().unreadByCustomer));
  }, () => setInboxBadge(false));
}
function startChat() {
  if (!auth.currentUser || isAdmin) return;
  const uid = auth.currentUser.uid;
  if (chatUnsub) chatUnsub();
  chatUnsub = db.collection('chats').doc(uid).collection('messages')
    .orderBy('createdAt', 'asc').limit(200)
    .onSnapshot(snap => {
      const el = document.getElementById('chatMessages');
      if (!el) return;
      el.innerHTML = snap.docs.map(d => chatBubbleHtml(d.data())).join('') ||
        '<p style="color:var(--ink-soft); font-size:0.85rem; text-align:center;">মালিককে কিছু জিজ্ঞাসা করুন...</p>';
      el.scrollTop = el.scrollHeight;
    });
  setInboxBadge(false);
  db.collection('chats').doc(uid).set({ unreadByCustomer: false }, { merge: true }).catch(() => {});
}
async function sendChatMessage(text) {
  if (!auth.currentUser || !text.trim()) return;
  const uid = auth.currentUser.uid;
  const msg = { sender: 'customer', text: text.trim(), createdAt: firebase.firestore.FieldValue.serverTimestamp() };
  await db.collection('chats').doc(uid).collection('messages').add(msg);
  await db.collection('chats').doc(uid).set({
    customerName: customerProfile ? (customerProfile.name || customerProfile.phone || '') : '',
    customerPhone: customerProfile ? (customerProfile.phone || '') : '',
    lastMessage: text.trim(),
    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
    unreadByAdmin: true,
    unreadByCustomer: false
  }, { merge: true });
}
const chatSendBtn = document.getElementById('chatSendBtn');
if (chatSendBtn) chatSendBtn.addEventListener('click', () => {
  const i = document.getElementById('chatInput');
  sendChatMessage(i.value);
  i.value = '';
});
const chatInput = document.getElementById('chatInput');
if (chatInput) chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('chatSendBtn').click(); }
});

/* ---------------- Chat (admin side) ---------------- */
window.loadAdminInbox = () => {
  if (adminInboxUnsub) adminInboxUnsub();
  adminInboxUnsub = db.collection('chats').orderBy('lastMessageAt', 'desc').limit(100).onSnapshot(snap => {
    const body = document.getElementById('adminInboxList');
    if (!body) return;
    if (snap.empty) { body.innerHTML = '<p style="color:var(--ink-soft);">কোনো চ্যাট নেই।</p>'; return; }
    body.innerHTML = snap.docs.map(d => {
      const c = d.data();
      const displayName = c.customerName || c.customerPhone || 'কাস্টমার';
      return `<div class="chat-list-item" data-uid="${escapeHtml(d.id)}" data-name="${escapeHtml(displayName)}">
        <div>
          <p style="font-weight:600;">${escapeHtml(displayName)}</p>
          <p style="font-size:0.8rem; color:var(--ink-soft); max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c.lastMessage || '')}</p>
        </div>
        ${c.unreadByAdmin ? '<span class="unread-dot"></span>' : ''}
      </div>`;
    }).join('');
  });
};
const adminInboxList = document.getElementById('adminInboxList');
if (adminInboxList) {
  adminInboxList.addEventListener('click', (e) => {
    const item = e.target.closest('.chat-list-item');
    if (!item || !item.dataset.uid) return;
    openAdminChat(item.dataset.uid, item.dataset.name || '');
  });
}
window.openAdminChat = (uid, name) => {
  openAdminChatUid = uid;
  const titleEl = document.getElementById('adminChatTitle');
  if (titleEl) titleEl.textContent = name || 'চ্যাট';
  openDrawer('adminChatDrawer');
  db.collection('chats').doc(uid).set({ unreadByAdmin: false }, { merge: true }).catch(() => {});
  if (adminChatUnsub) adminChatUnsub();
  adminChatUnsub = db.collection('chats').doc(uid).collection('messages')
    .orderBy('createdAt', 'asc').limit(200)
    .onSnapshot(snap => {
      const el = document.getElementById('adminChatMessages');
      if (!el) return;
      el.innerHTML = snap.docs.map(d => chatBubbleHtml(d.data())).join('');
      el.scrollTop = el.scrollHeight;
    });
};
async function sendAdminChatMessage(text) {
  if (!openAdminChatUid || !text.trim()) return;
  const msg = { sender: 'admin', text: text.trim(), createdAt: firebase.firestore.FieldValue.serverTimestamp() };
  await db.collection('chats').doc(openAdminChatUid).collection('messages').add(msg);
  await db.collection('chats').doc(openAdminChatUid).set({
    lastMessage: text.trim(),
    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
    unreadByCustomer: true
  }, { merge: true });
}
const adminChatSendBtn = document.getElementById('adminChatSendBtn');
if (adminChatSendBtn) adminChatSendBtn.addEventListener('click', () => {
  const i = document.getElementById('adminChatInput');
  sendAdminChatMessage(i.value);
  i.value = '';
});
const adminChatInput = document.getElementById('adminChatInput');
if (adminChatInput) adminChatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('adminChatSendBtn').click(); }
});

/* ---------------- Products (live) ---------------- */
db.collection('products').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
  PRODUCTS = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  productsLoading = false;
  renderCategories();
  renderProducts();
  handleDeepLinkOnLoad();
}, err => {
  console.error(err);
  PRODUCTS = [];
  productsLoading = false;
  renderCategories();
  renderProducts();
});

db.collection('categories').onSnapshot(snapshot => {
  CATEGORY_IMAGES = {};
  snapshot.docs.forEach(doc => { CATEGORY_IMAGES[doc.id] = doc.data().image; });
  renderCategories();
}, err => console.error(err));

/* ---------------- Category rendering ---------------- */
function categoryImageFor(cat) {
  if (CATEGORY_IMAGES[cat]) return CATEGORY_IMAGES[cat];
  if (cat === 'সব') {
    const firstWithImg = PRODUCTS.find(p => p.image);
    if (firstWithImg) return firstWithImg.image;
  } else {
    const firstWithImg = PRODUCTS.find(p => p.category === cat && p.image);
    if (firstWithImg) return firstWithImg.image;
  }
  return PLACEHOLDER_IMG;
}

function renderCategories() {
  const row = document.getElementById('categoryRow');
  if (!row) return;
  if (productsLoading || !settingsLoaded) { row.innerHTML = ''; return; }
  const cats = ["সব", ...new Set(PRODUCTS.map(p => p.category).filter(Boolean))];
  const html = cats.map(c => {
    const safeCat = escapeHtml(c);
    return `<div class="cat-item ${c === activeCategory ? 'active' : ''}" data-cat="${safeCat}">
      <div class="cat-img-outer">
        <div class="cat-img"><img ${imageAttrs(categoryImageFor(c), 180)} alt="${safeCat}"></div>
        ${isAdmin ? `<label class="cat-edit-btn" onclick="event.stopPropagation()"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg><input type="file" accept="image/*" class="cat-file-input" style="display:none;"></label>` : ''}
        ${isAdmin && CATEGORY_IMAGES[c] ? `<button class="cat-del-btn" data-cat="${safeCat}" onclick="event.stopPropagation(); resetCategoryImage(this.dataset.cat)">×</button>` : ''}
      </div>
      <span>${safeCat}</span>
    </div>`;
  }).join('');
  row.innerHTML = html;
  row.querySelectorAll('.cat-item').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      activeView = 'home';
      renderCategories();
      renderProducts();
    });
  });
  row.querySelectorAll('.cat-file-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const catName = input.closest('.cat-item').dataset.cat;
      const file = e.target.files[0];
      if (file) uploadCategoryImage(catName, file);
    });
  });
}
window.resetCategoryImage = async (catName) => {
  if (!confirm('এই ক্যাটাগরির কাস্টম ছবি মুছে ডিফল্টে ফিরিয়ে দিতে চান?')) return;
  try {
    await db.collection('categories').doc(catName).delete();
    showToast('ডিফল্ট ছবিতে ফিরিয়ে দেওয়া হয়েছে');
  } catch (e) { alert('সমস্যা হয়েছে: ' + e.message); }
};
async function uploadCategoryImage(catName, file) {
  showToast("ছবি আপলোড হচ্ছে...");
  try {
    const url = await uploadToStorage(file, 'categories');
    await db.collection('categories').doc(catName).set({ image: url }, { merge: true });
    showToast("ক্যাটাগরির ছবি পরিবর্তন হয়েছে");
  } catch (e) {
    alert("ক্যাটাগরি ছবি সংরক্ষণে সমস্যা হয়েছে: " + e.message);
  }
}

/* ---------------- Products render ---------------- */
function skeletonGridHtml() {
  return Array.from({ length: 6 }).map(() =>
    `<div class="card"><div class="skeleton skeleton-img"></div><div class="skeleton skeleton-line" style="width:80%;"></div><div class="skeleton skeleton-line" style="width:40%;"></div><div class="skeleton skeleton-line" style="height:36px;"></div></div>`
  ).join('');
}

function scoreProduct(p, words) {
  const name = (p.name || '').toLowerCase();
  const cat = (p.category || '').toLowerCase();
  const desc = (p.description || '').toLowerCase();
  let score = 0;
  words.forEach(w => {
    if (!w) return;
    if (name.includes(w)) score += 3;
    if (cat.includes(w)) score += 2;
    if (desc.includes(w)) score += 1;
  });
  return score;
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  if (productsLoading || !settingsLoaded) {
    grid.innerHTML = skeletonGridHtml();
    return;
  }

  let list = PRODUCTS;
  if (activeView === 'favorites') {
    list = list.filter(p => wishlist[p.id]);
  } else if (activeCategory !== "সব") {
    list = list.filter(p => p.category === activeCategory);
  }

  if (searchTerm) {
    const words = searchTerm.split(/\s+/).filter(Boolean);
    list = list.map(p => ({ p, score: scoreProduct(p, words) }))
      .sort((a, b) => b.score - a.score)
      .map(x => x.p);
  } else if (sortMode === 'low') {
    list = [...list].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } else if (sortMode === 'high') {
    list = [...list].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  }

  if (!list.length) {
    let msg = 'এই মুহূর্তে কোনো পণ্য উপলব্ধ নেই।';
    if (activeView === 'favorites') msg = 'আপনার প্রিয় তালিকা খালি।';
    else if (searchTerm) msg = 'আপনার সার্চের সাথে মিলে এমন কোনো পণ্য পাওয়া যায়নি।';
    else if (activeCategory !== 'সব') msg = 'এই ক্যাটাগরিতে এখনো কোনো পণ্য যোগ করা হয়নি।';
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">${msg}</div>`;
    return;
  }

  grid.innerHTML = list.map((p, idx) => {
    const safeId = escapeHtml(p.id);
    const stockOut = p.stock === 'স্টক নেই';
    return `<a class="card" href="${escapeHtml(productAppUrl(p.id))}" data-id="${safeId}" onclick="event.preventDefault(); openFullview('${safeId}')">
      <div class="card-img-wrap">
        <button class="wish-btn ${wishlist[p.id] ? 'active' : ''}" onclick="event.stopPropagation(); event.preventDefault(); toggleWishlist('${safeId}')" aria-label="প্রিয়">
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        ${p.stock && p.stock !== 'স্টকে আছে' ? `<span class="stock-tag">${escapeHtml(p.stock)}</span>` : ''}
        <img ${imageAttrs(p.image, 520, idx < 4)} alt="${escapeHtml(p.name || '')}">
        <span class="zoom-hint"><svg viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M11 8v6M8 11h6"/></svg></span>
      </div>
      <div class="card-title">${escapeHtml(p.name || '')}</div>
      <div class="card-price">৳${Number(p.price || 0)}</div>
      <button class="add-cart-btn" onclick="event.stopPropagation(); event.preventDefault(); addToCart('${safeId}')" ${stockOut ? 'disabled' : ''}>${stockOut ? 'স্টক নেই' : 'কার্টে যোগ করুন'}</button>
      ${isAdmin ? `<div class="admin-actions">
        <button class="btn-admin" onclick="event.stopPropagation(); event.preventDefault(); openProductForm('${safeId}')">এডিট</button>
        <button class="btn-admin danger" onclick="event.stopPropagation(); event.preventDefault(); deleteProduct('${safeId}')">ডিলিট</button>
      </div>` : ''}
    </a>`;
  }).join('');
}

window.toggleWishlist = (id) => {
  if (wishlist[id]) delete wishlist[id]; else wishlist[id] = true;
  localStorage.setItem('shuvon_wishlist', JSON.stringify(wishlist));
  renderProducts();
  if (currentViewProductId === id) {
    const svg = document.getElementById('fvWishBtn').querySelector('svg');
    if (svg) svg.style.fill = wishlist[id] ? 'var(--danger)' : 'none';
  }
  showToast(wishlist[id] ? "প্রিয় তালিকায় যোগ হয়েছে" : "প্রিয় তালিকা থেকে সরানো হয়েছে");
};
window.updateFvDots = () => {
  const s = document.getElementById('fvSlider');
  if (!s) return;
  const i = Math.round(s.scrollLeft / (s.clientWidth || 1));
  document.querySelectorAll('#fvDots .dot').forEach((d, k) => d.classList.toggle('active', k === i));
};
window.toggleWishlistFromView = () => { if (currentViewProductId) toggleWishlist(currentViewProductId); };

/* ---------------- Fullview ---------------- */
window.openFullview = (id, skipHistory) => {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  currentViewProductId = id;
  trackProductView(p);

  document.getElementById('fvName').textContent = p.name || '';
  document.getElementById('fvPrice').textContent = `৳${Number(p.price || 0)}`;
  document.getElementById('fvDesc').textContent = p.description || 'এই পণ্যের বিস্তারিত বিবরণ এখনো যোগ করা হয়নি।';

  const stockTag = document.getElementById('fvStockTag');
  if (stockTag) {
    stockTag.textContent = p.stock || '';
    stockTag.style.background = p.stock === 'স্টকে আছে' ? 'var(--success-soft)' : (p.stock === 'স্টক নেই' ? 'var(--danger-soft)' : 'var(--accent-soft)');
    stockTag.style.color = p.stock === 'স্টকে আছে' ? 'var(--success)' : (p.stock === 'স্টক নেই' ? 'var(--danger)' : 'var(--accent-dark)');
  }

  const wishSvg = document.getElementById('fvWishBtn').querySelector('svg');
  if (wishSvg) wishSvg.style.fill = wishlist[id] ? 'var(--danger)' : 'none';

  const addBtn = document.getElementById('fvAddCartBtn');
  const stockOut = p.stock === 'স্টক নেই';
  addBtn.disabled = stockOut;
  addBtn.textContent = stockOut ? 'স্টক নেই' : 'কার্টে যোগ করুন';
  addBtn.onclick = () => addToCart(id);
  document.getElementById('fvMessageBtn').onclick = () => openChatAboutProduct(p);

  const fvImgs = [...new Set([p.image, ...(Array.isArray(p.images) ? p.images : [])].filter(Boolean))];
  const imgList = fvImgs.length ? fvImgs : [PLACEHOLDER_IMG];
  const slider = document.getElementById('fvSlider');
  slider.innerHTML = imgList.map(u =>
    `<div class="fullview-slide"><img ${imageAttrs(u, 1200)} alt="${escapeHtml(p.name || '')}"></div>`
  ).join('');
  slider.scrollLeft = 0;
  document.getElementById('fvDots').innerHTML = imgList.length > 1
    ? imgList.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('')
    : '';

  document.getElementById('productFullview').classList.add('open');
  document.getElementById('productFullview').scrollTop = 0;

  /* SEO meta updates */
  const brand = getStoreBrand();
  document.getElementById('pageTitle').textContent = `${p.name} | ${brand}`;
  const desc = (p.description || p.name || '').slice(0, 155);
  document.getElementById('metaDesc').setAttribute('content', desc);
  document.getElementById('ogTitleTag').setAttribute('content', p.name || '');
  document.getElementById('ogDescTag').setAttribute('content', desc);
  document.getElementById('ogImageTag').setAttribute('content', p.image || SITE_SETTINGS.logoUrl || (siteUrl() + '/icon-512.png'));
  const url = productAppUrl(id);
  document.getElementById('canonicalLink').setAttribute('href', url);
  document.getElementById('ogUrlTag').setAttribute('content', url);
  document.getElementById('productJsonLd').textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": p.name || '',
    "image": p.image || '',
    "description": p.description || p.name || '',
    "offers": {
      "@type": "Offer",
      "priceCurrency": "BDT",
      "price": Number(p.price || 0),
      "availability": stockOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock"
    }
  });

  if (!skipHistory) history.pushState({ productId: id }, '', `?p=${encodeURIComponent(id)}`);
};

window.closeFullview = () => {
  document.getElementById('productFullview').classList.remove('open');
  currentViewProductId = null;
  const brand = getStoreBrand();
  document.getElementById('pageTitle').textContent = brand ? `${brand} — অনলাইন স্টোর` : '';
  document.getElementById('metaDesc').setAttribute('content', SITE_SETTINGS.storeName ? `${SITE_SETTINGS.storeName} থেকে পণ্য অর্ডার করুন।` : '');
  document.getElementById('productJsonLd').textContent = '';
  document.getElementById('canonicalLink').setAttribute('href', siteUrl() + '/');
  document.getElementById('ogUrlTag').setAttribute('content', siteUrl() + '/');
  document.getElementById('ogImageTag').setAttribute('content', SITE_SETTINGS.logoUrl || (siteUrl() + '/icon-512.png'));
  if (getProductIdFromLocation()) history.pushState({}, '', location.pathname);
};

function getProductIdFromLocation() {
  const params = new URLSearchParams(location.search);
  if (params.get('p')) return params.get('p');
  const m = location.pathname.match(/(?:^|\/)product\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function handleDeepLinkOnLoad() {
  const pid = getProductIdFromLocation();
  if (pid && PRODUCTS.find(x => x.id === pid)) openFullview(pid, true);
}
window.addEventListener('popstate', () => {
  const pid = getProductIdFromLocation();
  if (pid) openFullview(pid, true); else closeFullview();
});

function openChatAboutProduct(p) {
  const url = productAppUrl(p.id);
  const prefillMsg = `"${p.name}" সম্পর্কে জানতে চাই — ${url}`;
  const goToChat = () => {
    closeFullview();
    openDrawer('chatDrawer');
    startChat();
    const input = document.getElementById('chatInput');
    input.value = prefillMsg;
    input.focus();
  };
  if (isCustomer && auth.currentUser) goToChat();
  else openAuthModal(goToChat);
}

/* ---------------- Cart ---------------- */
window.addToCart = (id) => {
  cart[id] = (cart[id] || 0) + 1;
  localStorage.setItem('shuvon_cart', JSON.stringify(cart));
  updateCartUI();
  showToast("কার্টে যোগ করা হয়েছে");
};
const cartOpenBtn = document.getElementById('cartOpenBtn');
if (cartOpenBtn) cartOpenBtn.addEventListener('click', () => {
  if (!(isCustomer && auth.currentUser)) {
    openAuthModal(() => { updateCartUI(); openDrawer('cartDrawer'); });
    return;
  }
  updateCartUI();
  openDrawer('cartDrawer');
});

function computeDeliveryCharge() {
  const distEl = document.getElementById('custDistrict');
  const dist = distEl ? distEl.value : '';
  if (!dist || !SITE_SETTINGS.ownerDistrict) return 0;
  return dist === SITE_SETTINGS.ownerDistrict
    ? Number(SITE_SETTINGS.deliveryChargeInside || 0)
    : Number(SITE_SETTINGS.deliveryChargeOutside || 0);
}

function updateCartUI() {
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const badge = document.getElementById('cartBadge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }

  if (isCustomer && auth.currentUser && customerProfile) {
    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setV('custName', customerProfile.name || '');
    setV('custPhone', customerProfile.phone || '');
    if (!document.getElementById('custDistrict').value && (customerProfile.district || SITE_SETTINGS.ownerDistrict)) {
      setV('custDistrict', customerProfile.district || SITE_SETTINGS.ownerDistrict);
    }
    setV('custUpazila', customerProfile.upazila || '');
    setV('custAddress', customerProfile.address || '');
  }

  const ids = Object.keys(cart);
  let itemsTotal = 0;
  const cartItemsEl = document.getElementById('cartItems');
  if (cartItemsEl) {
    if (!ids.length) {
      cartItemsEl.innerHTML = '<p style="color:var(--ink-soft); text-align:center; padding: 20px;">আপনার কার্ট খালি রয়েছে।</p>';
    } else {
      cartItemsEl.innerHTML = ids.map(id => {
        const p = PRODUCTS.find(x => x.id === id);
        if (!p) return '';
        itemsTotal += Number(p.price || 0) * cart[id];
        return `<div class="cart-item">
          <img ${imageAttrs(p.image, 240)} alt="">
          <div class="cart-info">
            <h4>${escapeHtml(p.name || '')}</h4>
            <div class="cart-price">৳${Number(p.price || 0)}</div>
            <div class="qty-controls">
              <button class="qty-btn" onclick="updateQty('${escapeHtml(id)}', -1)">-</button>
              <span>${cart[id]}</span>
              <button class="qty-btn" onclick="updateQty('${escapeHtml(id)}', 1)">+</button>
            </div>
          </div>
        </div>`;
      }).join('');
    }
  }

  const delivery = computeDeliveryCharge();
  const grand = itemsTotal + delivery;
  const sumItems = document.getElementById('sumItems');
  const sumDelivery = document.getElementById('sumDelivery');
  const cartTotal = document.getElementById('cartTotal');
  const payHint = document.getElementById('payAmountHint');
  if (sumItems) sumItems.textContent = `৳ ${itemsTotal}`;
  if (sumDelivery) sumDelivery.textContent = `৳ ${delivery}`;
  if (cartTotal) cartTotal.textContent = `৳ ${grand}`;
  if (payHint) payHint.textContent = `৳ ${grand}`;
  validateCheckoutForm();
}

const custDistrict = document.getElementById('custDistrict');
if (custDistrict) custDistrict.addEventListener('change', (e) => {
  if (customerProfile) customerProfile.district = e.target.value;
  updateCartUI();
});
const custUpazila = document.getElementById('custUpazila');
if (custUpazila) custUpazila.addEventListener('input', (e) => {
  if (customerProfile) customerProfile.upazila = e.target.value;
});
const custPhone = document.getElementById('custPhone');
if (custPhone) custPhone.addEventListener('input', (e) => {
  if (customerProfile) customerProfile.phone = e.target.value;
});
const custName = document.getElementById('custName');
if (custName) custName.addEventListener('input', (e) => {
  if (customerProfile) customerProfile.name = e.target.value;
});
const custAddress = document.getElementById('custAddress');
if (custAddress) custAddress.addEventListener('input', (e) => {
  if (customerProfile) customerProfile.address = e.target.value;
});

window.updateQty = (id, delta) => {
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
  localStorage.setItem('shuvon_cart', JSON.stringify(cart));
  updateCartUI();
};

function validateCheckoutForm() {
  const btn = document.getElementById('checkoutBtn');
  if (!btn) return;
  const hasItems = Object.keys(cart).length > 0;
  const loggedIn = !!(isCustomer && auth.currentUser);
  const n = (document.getElementById('custName')?.value || '').trim();
  const ph = (document.getElementById('custPhone')?.value || '').trim();
  const upz = (document.getElementById('custUpazila')?.value || '').trim();
  const ad = (document.getElementById('custAddress')?.value || '').trim();
  const trx = (document.getElementById('custTrxId')?.value || '').trim();
  const paid = Number(document.getElementById('custPaidAmount')?.value || 0);
  btn.disabled = !(hasItems && loggedIn && n && ph && upz && ad && trx && paid > 0 && paid <= 10000000);
}
['custName', 'custPhone', 'custUpazila', 'custAddress', 'custTrxId', 'custPaidAmount'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', validateCheckoutForm);
});

const checkoutBtn = document.getElementById('checkoutBtn');
if (checkoutBtn) checkoutBtn.addEventListener('click', async () => {
  if (!auth.currentUser) return;
  const btn = checkoutBtn;
  btn.disabled = true;
  btn.textContent = "প্রসেস হচ্ছে...";

  try {
    const ids = Object.keys(cart);
    const items = [];
    let itemsTotal = 0;

    for (const id of ids) {
      const p = PRODUCTS.find(x => x.id === id);
      if (p) {
        items.push({ productId: id, name: p.name, price: Number(p.price || 0), qty: cart[id] });
        itemsTotal += Number(p.price || 0) * cart[id];
      }
    }

    if (!items.length) {
      alert('আপনার কার্টে কোনো পণ্য নেই।');
      btn.disabled = false;
      btn.textContent = "অর্ডার নিশ্চিত করুন";
      validateCheckoutForm();
      return;
    }

    const deliveryCharge = computeDeliveryCharge();
    const grandTotal = itemsTotal + deliveryCharge;
    const paidAmount = Number(document.getElementById('custPaidAmount').value);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0 || paidAmount > grandTotal) {
      alert("পেমেন্টের পরিমাণ মোট বিলের চেয়ে বেশি হতে পারবে না।");
      btn.disabled = false;
      btn.textContent = "অর্ডার নিশ্চিত করুন";
      validateCheckoutForm();
      return;
    }

    const userPhone = document.getElementById('custPhone').value.trim() ||
      (customerProfile ? (customerProfile.phone || '') : (auth.currentUser.email ? auth.currentUser.email.replace(CUSTOMER_EMAIL_DOMAIN, '') : ''));

    const orderData = {
      customerUid: auth.currentUser.uid,
      customerName: document.getElementById('custName').value.trim(),
      customerPhone: userPhone,
      customerUpazila: document.getElementById('custUpazila').value.trim(),
      customerAddress: document.getElementById('custAddress').value.trim(),
      customerDistrict: document.getElementById('custDistrict').value,
      items, itemsTotal, deliveryCharge, grandTotal,
      paymentMethod: 'bKash',
      paymentTrxId: document.getElementById('custTrxId').value.trim(),
      paymentAmountEntered: paidAmount,
      storeSnapshot: {
        storeName: SITE_SETTINGS.storeName || '',
        storeAddress: SITE_SETTINGS.storeAddress || '',
        contactNumber: SITE_SETTINGS.contactNumber || SITE_SETTINGS.whatsappNumber || '',
        websiteUrl: SITE_SETTINGS.websiteUrl || siteUrl(),
        logoUrl: SITE_SETTINGS.logoUrl || '',
        currency: SITE_SETTINGS.currency || '৳'
      },
      status: 'pending_payment',
      trackingUrl: "",
      statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const counterRef = db.collection('settings').doc('order_counter');
    let orderNumber;
    await db.runTransaction(async tx => {
      const counterSnap = await tx.get(counterRef);
      const currentNumber = counterSnap.exists ? Number(counterSnap.data().currentNumber || 1000) : 1000
