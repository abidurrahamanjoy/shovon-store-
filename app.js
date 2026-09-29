
/* Performance-safe image optimization: preserves original image quality while
   asking Cloudinary for modern format and only the size actually needed. */
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

function imageAttrs(url, width = 800, eager = false) {
  const src = optimizedImageUrl(url, width);
  return `src="${escapeHtml(src)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager ? ' fetchpriority="high"' : ''}`;
}

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const CUSTOMER_EMAIL_DOMAIN = "@shuvon.customer";
const SITE_URL = siteUrl();

if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{})); }

if (STORE_CONFIG.googleAnalyticsId) {
  const s = document.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${STORE_CONFIG.googleAnalyticsId}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date()); gtag('config', STORE_CONFIG.googleAnalyticsId);
}

const BD_DISTRICTS = ["ঢাকা","ফরিদপুর","গাজীপুর","গোপালগঞ্জ","কিশোরগঞ্জ","মাদারীপুর","মানিকগঞ্জ","মুন্সিগঞ্জ","নারায়ণগঞ্জ","নরসিংদী","রাজবাড়ী","শরীয়তপুর","টাঙ্গাইল","বাগেরহাট","চুয়াডাঙ্গা","যশোর","ঝিনাইদহ","খুলনা","কুষ্টিয়া","মাগুরা","মেহেরপুর","নড়াইল","সাতক্ষীরা","বরগুনা","বরিশাল","ভোলা","ঝালকাঠি","পটুয়াখালী","পিরোজপুর","বান্দরবান","ব্রাহ্মণবাড়িয়া","চাঁদপুর","চট্টগ্রাম","কুমিল্লা","কক্সবাজার","ফেনী","খাগড়াছড়ি","লক্ষ্মীপুর","নোয়াখালী","রাঙ্গামাটি","জামালপুর","ময়মনসিংহ","নেত্রকোণা","শেরপুর","বগুড়া","জয়পুরহাট","নওগাঁ","নাটোর","চাঁপাইনবাবগঞ্জ","পাবনা","রাজশাহী","সিরাজগঞ্জ","দিনাজপুর","গাইবান্ধা","কুড়িগ্রাম","লালমনিরহাট","নীলফামারী","পঞ্চগড়","রংপুর","ঠাকুরগাঁও","হবিগঞ্জ","মৌলভীবাজার","সুনামগঞ্জ","সিলেট"];

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
let cart = JSON.parse(localStorage.getItem('shuvon_cart')) || {};
let wishlist = JSON.parse(localStorage.getItem('shuvon_wishlist')) || {};
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

let pendingProductImages = [], currentProductImageUrls = [];
let pendingLogoFile = null, currentLogoUrl = "";
let draftHeroImages = [];

let SITE_SETTINGS = {
    storeName: STORE_CONFIG.storeName || "শোভন স্টোর",
    storeAddress: STORE_CONFIG.storeAddress || "",
    contactNumber: STORE_CONFIG.contactNumber || "",
    websiteUrl: STORE_CONFIG.siteUrl || "https://abidurrahamanjoy.github.io/shovon-store-/",
    whatsappNumber: STORE_CONFIG.whatsappNumber || "8801779088009",
    currency: STORE_CONFIG.currency || "৳",
    logoUrl: "", heroImageUrl: "",
    ownerDistrict: "হবিগঞ্জ",
    deliveryChargeInside: 60,
    deliveryChargeOutside: 120,
    deliveryTimeText: "২-৩ কার্যদিবস",
    termsText: "১. অর্ডার করার আগে পণ্যের বিবরণ ভালোভাবে দেখে নিন।\n২. পেমেন্ট নিশ্চিত হওয়ার পরই অর্ডার প্রসেস করা হয়।\n৩. ভুল/কম তথ্য দিয়ে পেমেন্ট করলে অর্ডার পেন্ডিং থাকবে।\n৪. ডেলিভারির পর পণ্য ফেরত নেওয়া হয় না, ত্রুটিপূর্ণ পণ্য ছাড়া।",
    bkashNumber: "01779088009",
    heroImages: ["https://images.unsplash.com/photo-1522836924445-4478bdeb828e?q=80&w=900&auto=format&fit=crop"],
    bgType: "solid",
    bgColor: "#FFFFFF"
};
let heroSlideIndex = 0, heroTimer = null;

const DUMMY_STATIONERY = [
  { id: 'd1', name: 'প্রিমিয়াম স্পাইরাল খাতা', price: 250, category: 'খাতা', image: 'https://images.unsplash.com/photo-1531346878377-a541e4a11f26?q=80&w=800&auto=format&fit=crop', description: 'উন্নত মানের কাগজ দিয়ে তৈরি স্পাইরাল খাতা, লেখাপড়া ও অফিসের কাজে উপযোগী।', stock: 'স্টকে আছে' },
  { id: 'd2', name: 'মিনিমালিস্ট জেল পেন সেট', price: 120, category: 'কলম', image: 'https://images.unsplash.com/photo-1585336261022-680e295ce3fe?q=80&w=800&auto=format&fit=crop', description: 'মসৃণ লেখার জন্য ৫টি রঙের জেল পেনের সেট।', stock: 'স্টকে আছে' },
  { id: 'd3', name: 'ক্যানভাস পেন্সিল পাউচ', price: 180, category: 'ব্যাগ', image: 'https://images.unsplash.com/photo-1583485088034-607b3dd3308a?q=80&w=800&auto=format&fit=crop', description: 'টেকসই ক্যানভাস কাপড়ে তৈরি, প্রচুর জায়গা সম্বলিত পেন্সিল পাউচ।', stock: 'সীমিত স্টক' },
  { id: 'd4', name: 'উডেন ডেস্ক অর্গানাইজার', price: 450, category: 'অফিস', image: 'https://images.unsplash.com/photo-1592312040171-267aa90d4783?q=80&w=800&auto=format&fit=crop', description: 'কাঠের তৈরি ডেস্ক অর্গানাইজার, আপনার টেবিল গুছিয়ে রাখতে সাহায্য করবে।', stock: 'স্টকে আছে' }
];

function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }
function notifyBrowser(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') { try { new Notification(title, { body, icon: SITE_SETTINGS.logoUrl || undefined }); } catch(e) {} }
  showToast(title);
}
function requestNotifPermission(btn) {
  if (!('Notification' in window)) { alert('আপনার ব্রাউজার নোটিফিকেশন সাপোর্ট করে সাপোর্ট করে না'); return; }
  Notification.requestPermission().then(p => { if (btn) btn.textContent = p === 'granted' ? 'চালু আছে ✓' : 'অনুমতি দিন'; });
}
async function uploadToStorage(file, folder) {
  const allowedTypes = new Set(['image/jpeg','image/png','image/webp','image/gif']);
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
  const makeForm = (includeFolder) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', uploadPreset);
    // Some unsigned presets reject a client-supplied folder. Therefore the first
    // request uses the preset's own folder setting; no folder is forced here.
    if (includeFolder === true) {
      const safeFolder = String(folder || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
      if (safeFolder) fd.append('folder', `shuvon-store-${safeFolder}`);
    }
    return fd;
  };

  let res, json;
  try {
    // Primary upload: do not force a folder, so Cloudinary preset folder rules are respected.
    res = await fetch(endpoint, { method: 'POST', body: makeForm(false) });
  } catch (netErr) {
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
function escapeHtml(str) { return String(str == null ? '' : str).replace(/[&<>\"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;' }[c])); }
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
function appBaseUrl() {
  // Works on GitHub Pages subpaths (e.g. /joy/), Firebase Hosting root,
  // and custom domains without assuming the site is hosted at '/'.
  const path = location.pathname || '/';
  const basePath = path.endsWith('/') ? path : path.slice(0, path.lastIndexOf('/') + 1);
  return `${location.origin}${basePath}`.replace(/\/+$/, '');
}
function siteUrl() {
  // Used for SEO/canonical URLs when a production URL is configured.
  // If left empty, automatically use the current hosting location.
  return String(STORE_CONFIG.siteUrl || appBaseUrl()).replace(/\/+$/, '');
}
function productAppUrl(id) {
  // Use the configured site URL so Inbox/product links keep the GitHub Pages /joy/ path.
  return `${siteUrl()}/?p=${encodeURIComponent(id)}`;
}
function productSeoUrl(id, name) {
  // Keep canonical/share URLs on the same configured base path.
  return `${siteUrl()}/?p=${encodeURIComponent(id)}`;
}


const overlay = document.getElementById('overlay');
function closeAllDrawers() { document.querySelectorAll('.drawer').forEach(d => d.classList.remove('open')); overlay.classList.remove('open'); }
function openDrawer(id) { closeAllDrawers(); document.getElementById(id).classList.add('open'); overlay.classList.add('open'); }
overlay.addEventListener('click', closeAllDrawers);

document.getElementById('menuOpenBtn').addEventListener('click', () => openDrawer('menuDrawer'));

// এডমিন একাউন্ট ও সাধারন একাউন্ট এর মেনু লিংক লজিক
document.getElementById('menuAccountLink').addEventListener('click', (e) => {
  e.preventDefault();
  if (isAdmin) {
    openDrawer('adminLoginDrawer');
  } else {
    openDrawer('accountDrawer');
  }
});

document.getElementById('enableNotifBtn').addEventListener('click', (e) => requestNotifPermission(e.target));
document.getElementById('enableAdminNotifBtn').addEventListener('click', (e) => requestNotifPermission(e.target));
document.getElementById('forgotPassLink').addEventListener('click', () => {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) return alert('আগে ইমেইল লিখুন');
  auth.sendPasswordResetEmail(email).then(()=> showToast('রিসেট লিংক ইমেইলে পাঠানো হয়েছে')).catch(e=> alert(e.message));
});

/* ---------------- গ্লাস অথ পপআপ ---------------- */
function openAuthModal(onSuccess) {
  pendingAuthSuccessCallback = onSuccess || null;
  document.getElementById('modalAuthError').style.display = 'none';
  document.getElementById('modalAuthPhone').value = '';
  document.getElementById('modalAuthPassword').value = '';
  document.getElementById('authModalOverlay').classList.add('open');
}
function closeAuthModal() { document.getElementById('authModalOverlay').classList.remove('open'); }
document.getElementById('authModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'authModalOverlay') closeAuthModal(); });
document.getElementById('modalAuthSubmitBtn').addEventListener('click', async () => {
  const btn = document.getElementById('modalAuthSubmitBtn'); btn.disabled = true;
  const ok = await customerAuthSubmit(document.getElementById('modalAuthPhone').value.trim(), document.getElementById('modalAuthPassword').value, document.getElementById('modalAuthError'));
  btn.disabled = false;
  if (ok) { showToast('লগইন সফল হয়েছে'); closeAuthModal(); if (pendingAuthSuccessCallback) { const cb = pendingAuthSuccessCallback; pendingAuthSuccessCallback = null; cb(); } }
});

/* ---------------- সার্চ (কখনো "not found" না — বেস্ট-ম্যাচ সবসময় দেখাবে) ---------------- */
const searchBarEl = document.getElementById('searchBar');
const searchInputEl = document.getElementById('searchInput');
function toggleSearch() {
  searchBarEl.classList.toggle('open');
  if (searchBarEl.classList.contains('open')) setTimeout(() => searchInputEl.focus(), 200);
  else { searchInputEl.value = ''; searchTerm = ''; hideSuggest(); renderProducts(); }
}
document.getElementById('searchOpenBtn').addEventListener('click', toggleSearch);
const suggestBoxEl = document.getElementById('suggestBox');
function hideSuggest() { suggestBoxEl.classList.remove('show'); suggestBoxEl.innerHTML = ''; }
function updateSuggest() {
  const words = searchTerm.split(/\s+/).filter(Boolean);
  if (!words.length) { hideSuggest(); return; }
  const top = PRODUCTS.map(p => ({ p, s: scoreProduct(p, words) })).filter(x => x.s > 0).sort((a,b) => b.s - a.s).slice(0, 6).map(x => x.p);
  if (!top.length) { hideSuggest(); return; }
  suggestBoxEl.innerHTML = top.map(p => `<div class="suggest-item" data-id="${p.id}"><img ${imageAttrs(p.image, 180)} alt=""><b>${escapeHtml(p.name)}</b><span>৳${p.price}</span></div>`).join('');
  suggestBoxEl.classList.add('show');
}
suggestBoxEl.addEventListener('click', (e) => { const it = e.target.closest('.suggest-item'); if (!it) return; hideSuggest(); openFullview(it.dataset.id); });
document.addEventListener('click', (e) => { if (!e.target.closest('#suggestBox') && !e.target.closest('#searchBar')) hideSuggest(); });
searchInputEl.addEventListener('input', (e) => { searchTerm = e.target.value.trim().toLowerCase(); renderProducts(); updateSuggest(); });
document.getElementById('sortSelect').addEventListener('change', (e) => { sortMode = e.target.value; renderProducts(); });

function setActiveNav(id) { document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); document.getElementById(id).classList.add('active'); }
document.getElementById('navHomeBtn').addEventListener('click', (e) => { e.preventDefault(); goHomeView(); window.scrollTo({top:0, behavior:'smooth'}); setActiveNav('navHomeBtn'); });
document.getElementById('navFavBtn').addEventListener('click', (e) => { e.preventDefault(); setActiveNav('navFavBtn'); showFavorites(); });

// Inbox বাটন লজিক (নতুন)
document.getElementById('navInboxBtn').addEventListener('click', (e) => {
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
function showFavorites() { activeView = 'favorites'; document.getElementById('products').scrollIntoView(); renderProducts(); }

function fillDistrictSelects() {
  const opts = BD_DISTRICTS.map(d => `<option value="${d}">${d}</option>`).join('');
  document.getElementById('custDistrict').innerHTML = opts;
  document.getElementById('setOwnerDistrict').innerHTML = opts;
  document.getElementById('profDistrict').innerHTML = opts;
}
fillDistrictSelects();

db.collection('settings').doc('store_info').onSnapshot(doc => {
    if(doc.exists) SITE_SETTINGS = { ...SITE_SETTINGS, ...doc.data() };
    updateSiteInfoUI();
    updateCartUI();
});

function updateSeoSiteUrl() {
    const base = siteUrl();
    const canonical = document.getElementById('canonicalLink');
    const ogUrl = document.getElementById('ogUrlTag');
    const ogImage = document.getElementById('ogImageTag');
    if (canonical) canonical.href = base + '/';
    if (ogUrl) ogUrl.content = base + '/';
    if (ogImage && !SITE_SETTINGS.logoUrl) ogImage.content = base + '/icon-512.png';
}

function updateSiteInfoUI() {
    updateSeoSiteUrl();
    document.getElementById('siteStoreName').textContent = SITE_SETTINGS.storeName;
    if (!currentViewProductId) document.title = SITE_SETTINGS.storeName + " | স্টোর";
    const cleanWaNum = SITE_SETTINGS.whatsappNumber.replace(/[^0-9]/g, '');
    document.getElementById('floatWaBtn').href = `https://wa.me/${cleanWaNum}?text=আসসালামু আলাইকুম`;
    document.getElementById('menuWaLink').href = `https://wa.me/${cleanWaNum}?text=আসসালামু আলাইকুম`;
    const logoEl = document.getElementById('siteLogoImg');
    if(SITE_SETTINGS.logoUrl) { logoEl.src = SITE_SETTINGS.logoUrl; logoEl.style.display = 'block'; }
    else { logoEl.style.display = 'none'; }
    document.getElementById('siteStoreName').style.display = 'block';
    renderHeroCarousel();
    applyBackground();
    document.getElementById('termsBody').textContent = SITE_SETTINGS.termsText || '';
    document.getElementById('payBkashNumber').textContent = SITE_SETTINGS.bkashNumber || '-';
    document.getElementById('payDeliveryTime').textContent = SITE_SETTINGS.deliveryTimeText || '-';
    if (!document.getElementById('custDistrict').value) document.getElementById('custDistrict').value = SITE_SETTINGS.ownerDistrict;
}

function applyBackground() {
  document.body.classList.remove('bg-gradient1','bg-gradient2','bg-pattern1');
  if (SITE_SETTINGS.bgType && SITE_SETTINGS.bgType !== 'solid') document.body.classList.add('bg-' + SITE_SETTINGS.bgType);
  else document.body.style.background = SITE_SETTINGS.bgColor || '#FFFFFF';
  if (SITE_SETTINGS.bgType !== 'solid') document.body.style.background = '';
}

function renderHeroCarousel() {
  const validImages = (SITE_SETTINGS.heroImages || []).filter(Boolean);
  const images = (validImages.length ? validImages : ['https://images.unsplash.com/photo-1522836924445-4478bdeb828e?q=80&w=900&auto=format&fit=crop']).map(u => safeHttpUrl(u)).filter(Boolean);
  const optimizedHeroImages = images.map(u => optimizedImageUrl(u, 1400));

  // Give the first hero image high priority without changing the visual design.
  const oldPreload = document.getElementById('heroImagePreload');
  if (oldPreload) oldPreload.remove();
  if (optimizedHeroImages[0]) {
    const preload = document.createElement('link');
    preload.id = 'heroImagePreload';
    preload.rel = 'preload';
    preload.as = 'image';
    preload.href = optimizedHeroImages[0];
    document.head.appendChild(preload);
  }

  document.getElementById('heroSlides').innerHTML = optimizedHeroImages.map((url,i) => `<div class="hero-slide ${i===0?'active':''}" style="background-image:url('${escapeHtml(url)}')"></div>`).join('');
  document.getElementById('heroDots').innerHTML = images.length > 1 ? images.map((_,i)=>`<span class="${i===0?'active':''}"></span>`).join('') : '';
  heroSlideIndex = 0;
  if (heroTimer) clearInterval(heroTimer);
  if (images.length > 1) heroTimer = setInterval(() => {
    const slides = document.querySelectorAll('.hero-slide'), dots = document.querySelectorAll('.hero-dots span');
    slides[heroSlideIndex].classList.remove('active'); dots[heroSlideIndex] && dots[heroSlideIndex].classList.remove('active');
    heroSlideIndex = (heroSlideIndex + 1) % slides.length;
    slides[heroSlideIndex].classList.add('active'); dots[heroSlideIndex] && dots[heroSlideIndex].classList.add('active');
  }, 4000);
}
function hexToRgba(hex, alpha) {
  hex = hex.replace('#','');
  const r = parseInt(hex.substring(0,2),16), g = parseInt(hex.substring(2,4),16), b = parseInt(hex.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ---------------- পপআপ এবং ড্যাশবোর্ড লজিক ---------------- */
window.addEventListener('load', () => { 
  if (isAdminUrl()) setTimeout(() => openDrawer('adminLoginDrawer'), 400); 

  // Welcome Popup Logic (দিনে একবার)
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem('shuvon_welcome_shown') !== today) {
    setTimeout(() => {
      document.getElementById('welcomeModalOverlay').classList.add('open');
      localStorage.setItem('shuvon_welcome_shown', today);
    }, 1000); // পেজ লোড হওয়ার ১ সেকেন্ড পর আসবে
  }
});

// ওয়েলকাম পপ-আপের বাইরে ক্লিক করলে বন্ধ হওয়ার লজিক
document.getElementById('welcomeModalOverlay').addEventListener('click', (e) => { 
  if (e.target.id === 'welcomeModalOverlay') e.target.classList.remove('open'); 
});

function isAdminUrl() { return /\/admin\/?$/i.test(location.pathname) || location.hash.toLowerCase() === '#admin'; }

/* ---------------- Auth ---------------- */
auth.onAuthStateChanged(async user => {
  isAdmin = !!(user && user.uid === STORE_CONFIG.adminUID);
  isCustomer = !!(user && !isAdmin);
  document.getElementById('adminFabBtn').classList.toggle('show', isAdmin);
  
  if(isAdmin) {
      document.getElementById('adminDrawerTitle').textContent = "এডমিন ড্যাশবোর্ড";
      document.getElementById('adminLoginFormSection').style.display = 'none';
      document.getElementById('adminMenuSection').style.display = 'block';
      document.getElementById('setStoreName').value = SITE_SETTINGS.storeName;
      document.getElementById('setStoreAddress').value = SITE_SETTINGS.storeAddress || '';
      document.getElementById('setContactNumber').value = SITE_SETTINGS.contactNumber || '';
      document.getElementById('setWebsiteUrl').value = SITE_SETTINGS.websiteUrl || '';
      document.getElementById('setWaNum').value = SITE_SETTINGS.whatsappNumber;
      document.getElementById('setBkashNumber').value = SITE_SETTINGS.bkashNumber;
      document.getElementById('setOwnerDistrict').value = SITE_SETTINGS.ownerDistrict;
      document.getElementById('setDeliveryInside').value = SITE_SETTINGS.deliveryChargeInside;
      document.getElementById('setDeliveryOutside').value = SITE_SETTINGS.deliveryChargeOutside;
      document.getElementById('setDeliveryTime').value = SITE_SETTINGS.deliveryTimeText;
      document.getElementById('setTerms').value = SITE_SETTINGS.termsText;
      if(SITE_SETTINGS.logoUrl) { document.getElementById('logoPreview').src = SITE_SETTINGS.logoUrl; document.getElementById('logoPreview').style.display = 'block'; currentLogoUrl = SITE_SETTINGS.logoUrl; }
      draftHeroImages = [...(SITE_SETTINGS.heroImages || [])];
      renderHeroImagesList();
      document.getElementById('setBgType').value = SITE_SETTINGS.bgType || 'solid';
      document.getElementById('setBgColor').value = SITE_SETTINGS.bgColor || '#FFFFFF';
      document.getElementById('setBgColorField').style.display = (SITE_SETTINGS.bgType||'solid') === 'solid' ? 'block' : 'none';
      startAdminNotificationListeners();
      db.collection('chats').onSnapshot(snap => {
        let unread = 0; snap.docs.forEach(d => { if (d.data().unreadByAdmin) unread++; });
        setInboxBadge(unread > 0);
      });
  } else {
      document.getElementById('adminDrawerTitle').textContent = "এডমিন লগইন";
      document.getElementById('adminLoginFormSection').style.display = 'block';
      document.getElementById('adminMenuSection').style.display = 'none';
  }

  if (isCustomer) {
      document.getElementById('accountLoggedOutSection').style.display = 'none';
      startCustomerInboxNotificationListener(user.uid);
      document.getElementById('accountLoggedInSection').style.display = 'block';
      const phone = user.email.replace(CUSTOMER_EMAIL_DOMAIN, '');
      const custDoc = await db.collection('customers').doc(user.uid).get();
      customerProfile = custDoc.exists ? custDoc.data() : { phone, name: '', address: '', district: SITE_SETTINGS.ownerDistrict, upazila: '' };
      document.getElementById('profName').value = customerProfile.name || '';
      document.getElementById('profPhone').value = customerProfile.phone || phone;
      document.getElementById('profDistrict').value = customerProfile.district || SITE_SETTINGS.ownerDistrict;
      document.getElementById('profUpazila').value = customerProfile.upazila || '';
      document.getElementById('profAddress').value = customerProfile.address || '';
      startMyOrdersListener(user.uid);
  } else {
      document.getElementById('accountLoggedOutSection').style.display = 'block';
      document.getElementById('accountLoggedInSection').style.display = 'none';
      customerProfile = null;
      if (myOrdersUnsub) { myOrdersUnsub(); myOrdersUnsub = null; }
      if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  }

  updateCartUI();
  renderCategories();
  renderProducts();
});

document.getElementById('loginSubmitBtn').addEventListener('click', () => {
  document.getElementById('loginError').style.display = 'none';
  auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value)
      .then(cred => {
          if(cred.user.uid !== STORE_CONFIG.adminUID) { auth.signOut(); alert("প্রবেশাধিকার সংরক্ষিত!"); }
          else { showToast("সফলভাবে লগইন হয়েছে"); closeAllDrawers(); }
      }).catch(() => document.getElementById('loginError').style.display='block');
});
document.getElementById('logoutBtn').addEventListener('click', () => { auth.signOut(); closeAllDrawers(); showToast("লগআউট সফল হয়েছে"); });

async function customerAuthSubmit(phone, password, errorEl) {
  errorEl.style.display = 'none';
  if (!/^01[3-9][0-9]{8}$/.test(phone)) { errorEl.textContent = 'সঠিক মোবাইল নম্বর দিন'; errorEl.style.display = 'block'; return false; }
  if (!password || password.length < 6) { errorEl.textContent = 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'; errorEl.style.display = 'block'; return false; }
  const email = phone + CUSTOMER_EMAIL_DOMAIN;
  try { await auth.signInWithEmailAndPassword(email, password); return true; }
  catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('customers').doc(cred.user.uid).set({ phone, name: '', address: '', district: SITE_SETTINGS.ownerDistrict, upazila: '', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        return true;
      } catch (err2) { errorEl.textContent = 'একাউন্ট তৈরি করা যায়নি: ' + err2.message; errorEl.style.display = 'block'; return false; }
    }
    errorEl.textContent = 'ভুল পাসওয়ার্ড অথবা তথ্য মিলছে না।'; errorEl.style.display = 'block'; return false;
  }
}
document.getElementById('custLogoutBtn').addEventListener('click', () => { auth.signOut(); closeAllDrawers(); showToast('লগআউট হয়েছে'); });
document.getElementById('profSaveBtn').addEventListener('click', async () => {
  if (!auth.currentUser) return;
  const data = { name: document.getElementById('profName').value.trim(), address: document.getElementById('profAddress').value.trim(), district: document.getElementById('profDistrict').value, upazila: document.getElementById('profUpazila').value.trim() };
  try { await db.collection('customers').doc(auth.currentUser.uid).set(data, { merge: true }); customerProfile = { ...customerProfile, ...data }; showToast('প্রোফাইল সংরক্ষণ হয়েছে'); }
  catch(e) { alert('সংরক্ষণে সমস্যা: ' + e.message); }
});

let knownOrderStatuses = {};
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
  myOrdersUnsub = db.collection('orders').where('customerUid','==',uid).orderBy('createdAt','desc').limit(30)
    .onSnapshot(snap => {
      const list = document.getElementById('myOrdersList');
      if (snap.empty) { list.innerHTML = '<p style="color:var(--ink-soft); font-size:0.85rem;">এখনো কোনো অর্ডার নেই।</p>'; first = false; return; }
      list.innerHTML = snap.docs.map(d => {
        const o = d.data();
        if (!first && knownOrderStatuses[d.id] && knownOrderStatuses[d.id] !== o.status) notifyBrowser('অর্ডার আপডেট হয়েছে', `#${d.id.slice(0,6)} — স্ট্যাটাস: ${o.status}`);
        knownOrderStatuses[d.id] = o.status;
        return `<div class="order-card"><span class="status-badge ${o.status}">${orderStatusLabel(o.status)}</span><p style="margin-top:8px; font-size:0.85rem;">মোট: ৳${o.grandTotal}</p>${safeHttpUrl(o.trackingUrl) ? `<a href="${safeAttrUrl(o.trackingUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-dark); font-weight:600; font-size:0.85rem; display:block; margin-top:6px;">ডেলিভারি ট্র্যাক করুন →</a>` : ''}<button class="btn-block btn-outline" style="margin-top:10px;" onclick="printOrderMemo('${d.id}','customer')">🖨 মেমো প্রিন্ট করুন</button></div>`;
      }).join('');
      first = false;
    }, err => { console.error(err); document.getElementById('myOrdersList').innerHTML = '<p style="color:var(--danger); font-size:0.85rem;">লোড করতে সমস্যা হয়েছে (Firestore index প্রয়োজন হতে পারে, কনসোলে লিংক দেখুন)।</p>'; });
}

function startAdminNotificationListeners() {
  db.collection('orders').orderBy('createdAt','desc').limit(20).onSnapshot(snap => {
    if (adminFirstLoad.orders) { adminFirstLoad.orders = false; return; }
    snap.docChanges().forEach(ch => { if (ch.type === 'added') notifyBrowser('🛍 নতুন অর্ডার!', `${ch.doc.data().customerName} — ৳${ch.doc.data().grandTotal}`); });
  });
}

/* ---------------- চ্যাট: কাস্টমার সাইড ---------------- */
function linkifyChatText(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/(https?:\/\/[^\s]+)/g, (url) => `<a href="${url}" target="_blank">🔗 প্রোডাক্টটি দেখুন</a>`);
}
function chatBubbleHtml(m) { return `<div class="chat-bubble ${m.sender}">${linkifyChatText(m.text)}</div>`; }

function setInboxBadge(show) {
  const el = document.getElementById('inboxBadge');
  if (el) el.style.display = show ? 'block' : 'none';
}
function startCustomerInboxNotificationListener(uid) {
  if (customerInboxUnsub) customerInboxUnsub();
  if (!uid || isAdmin) { setInboxBadge(false); return; }
  customerInboxUnsub = db.collection('chats').doc(uid).onSnapshot(doc => {
    setInboxBadge(!!(doc.exists && doc.data().unreadByCustomer));
  }, () => setInboxBadge(false));
}

function startChat() {
  if (!auth.currentUser || isAdmin) return;
  const uid = auth.currentUser.uid;
  if (chatUnsub) chatUnsub();
  chatUnsub = db.collection('chats').doc(uid).collection('messages').orderBy('createdAt','asc').limit(200)
    .onSnapshot(snap => {
      document.getElementById('chatMessages').innerHTML = snap.docs.map(d => chatBubbleHtml(d.data())).join('') || '<p style="color:var(--ink-soft); font-size:0.85rem; text-align:center;">মালিককে কিছু জিজ্ঞাসা করুন...</p>';
      document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
    });
  setInboxBadge(false);
  db.collection('chats').doc(uid).set({ unreadByCustomer: false }, { merge: true }).catch(()=>{});
}

async function sendChatMessage(text) {
  if (!auth.currentUser || !text.trim()) return;
  const uid = auth.currentUser.uid;
  const msg = { sender: 'customer', text: text.trim(), createdAt: firebase.firestore.FieldValue.serverTimestamp() };
  await db.collection('chats').doc(uid).collection('messages').add(msg);
  await db.collection('chats').doc(uid).set({
    customerName: customerProfile ? (customerProfile.name || customerProfile.phone) : '',
    customerPhone: customerProfile ? customerProfile.phone : '',
    lastMessage: text.trim(), lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
    unreadByAdmin: true, unreadByCustomer: false
  }, { merge: true });
}
document.getElementById('chatSendBtn').addEventListener('click', () => { const i = document.getElementById('chatInput'); sendChatMessage(i.value); i.value = ''; });
document.getElementById('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('chatSendBtn').click(); });

/* ---------------- চ্যাট: এডমিন সাইড (Inbox) ---------------- */
window.loadAdminInbox = () => {
  if (adminInboxUnsub) adminInboxUnsub();
  adminInboxUnsub = db.collection('chats').orderBy('lastMessageAt','desc').limit(100).onSnapshot(snap => {
    const body = document.getElementById('adminInboxList');
    if (snap.empty) { body.innerHTML = '<p style="color:var(--ink-soft);">কোনো চ্যাট নেই।</p>'; return; }
    body.innerHTML = snap.docs.map(d => {
      const c = d.data();
      return `<div class="chat-list-item" onclick="openAdminChat('${d.id}','${escapeHtml(c.customerName||c.customerPhone||'')}')">
        <div><p style="font-weight:600;">${escapeHtml(c.customerName || c.customerPhone || 'কাস্টমার')}</p><p style="font-size:0.8rem; color:var(--ink-soft); max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c.lastMessage||'')}</p></div>
        ${c.unreadByAdmin ? '<span class="unread-dot"></span>' : ''}
      </div>`;
    }).join('');
  });
};
window.openAdminChat = (uid, name) => {
  openAdminChatUid = uid;
  document.getElementById('adminChatTitle').textContent = name || 'চ্যাট';
  openDrawer('adminChatDrawer');
  db.collection('chats').doc(uid).set({ unreadByAdmin: false }, { merge: true }).catch(()=>{});
  if (adminChatUnsub) adminChatUnsub();
  adminChatUnsub = db.collection('chats').doc(uid).collection('messages').orderBy('createdAt','asc').limit(200).onSnapshot(snap => {
    document.getElementById('adminChatMessages').innerHTML = snap.docs.map(d => chatBubbleHtml(d.data())).join('');
    document.getElementById('adminChatMessages').scrollTop = document.getElementById('adminChatMessages').scrollHeight;
  });
};
async function sendAdminChatMessage(text) {
  if (!openAdminChatUid || !text.trim()) return;
  const msg = { sender: 'admin', text: text.trim(), createdAt: firebase.firestore.FieldValue.serverTimestamp() };
  await db.collection('chats').doc(openAdminChatUid).collection('messages').add(msg);
  await db.collection('chats').doc(openAdminChatUid).set({ lastMessage: text.trim(), lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(), unreadByCustomer: true }, { merge: true });
}
document.getElementById('adminChatSendBtn').addEventListener('click', () => { const i = document.getElementById('adminChatInput'); sendAdminChatMessage(i.value); i.value=''; });
document.getElementById('adminChatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('adminChatSendBtn').click(); });

/* ---------------- Products (live) ---------------- */
db.collection('products').orderBy('createdAt','desc').onSnapshot(snapshot => {
  if (snapshot.empty) PRODUCTS = DUMMY_STATIONERY;
  else PRODUCTS = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  productsLoading = false;
  renderCategories(); renderProducts();
  handleDeepLinkOnLoad();
}, err => { console.error(err); PRODUCTS = DUMMY_STATIONERY; productsLoading = false; renderCategories(); renderProducts(); });

const catImages = {
  "সব": "https://images.unsplash.com/photo-1518600506278-4e8ef466b810?q=80&w=150&auto=format&fit=crop",
  "খাতা": "https://images.unsplash.com/photo-1531346878377-a541e4a11f26?q=80&w=150&auto=format&fit=crop",
  "কলম": "https://images.unsplash.com/photo-1585336261022-680e295ce3fe?q=80&w=150&auto=format&fit=crop",
  "অফিস": "https://images.unsplash.com/photo-1592312040171-267aa90d4783?q=80&w=150&auto=format&fit=crop",
  "ব্যাগ": "https://images.unsplash.com/photo-1583485088034-607b3dd3308a?q=80&w=150&auto=format&fit=crop"
};

db.collection('categories').onSnapshot(snapshot => {
  CATEGORY_IMAGES = {};
  snapshot.docs.forEach(doc => { CATEGORY_IMAGES[doc.id] = doc.data().image; });
  renderCategories();
}, err => console.error(err));

function renderCategories() {
  const cats = ["সব", ...new Set(PRODUCTS.map(p => p.category))];
  const html = cats.map(c => `
    <div class="cat-item ${c === activeCategory ? 'active' : ''}" data-cat="${c}">
      <div class="cat-img-outer">
        <div class="cat-img"><img ${imageAttrs(CATEGORY_IMAGES[c] || catImages[c] || 'https://images.unsplash.com/photo-1518600506278-4e8ef466b810?w=150', 180)} alt="${c}"></div>
        ${isAdmin ? `<label class="cat-edit-btn" onclick="event.stopPropagation()"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg><input type="file" accept="image/*" class="cat-file-input" style="display:none;"></label>` : ''}
        ${isAdmin && CATEGORY_IMAGES[c] ? `<button class="cat-del-btn" onclick="event.stopPropagation(); resetCategoryImage('${c}')">×</button>` : ''}
      </div>
      <span>${c}</span>
    </div>`).join('');
  document.getElementById('categoryRow').innerHTML = html;
  document.querySelectorAll('.cat-item').forEach(btn => { btn.addEventListener('click', () => { activeCategory = btn.dataset.cat; activeView = 'home'; renderCategories(); renderProducts(); }); });
  document.querySelectorAll('.cat-file-input').forEach(input => { input.addEventListener('change', (e) => { const catName = input.closest('.cat-item').dataset.cat; const file = e.target.files[0]; if (file) uploadCategoryImage(catName, file); }); });
}
window.resetCategoryImage = async (catName) => {
  if (!confirm('এই ক্যাটাগরির কাস্টম ছবি মুছে ডিফল্টে ফিরিয়ে দিতে চান?')) return;
  try { await db.collection('categories').doc(catName).delete(); showToast('ডিফল্ট ছবিতে ফিরিয়ে দেওয়া হয়েছে'); } catch(e) { alert('সমস্যা হয়েছে: ' + e.message); }
};
async function uploadCategoryImage(catName, file) {
  showToast("ছবি আপলোড হচ্ছে...");
  try { const url = await uploadToStorage(file, 'categories'); await db.collection('categories').doc(catName).set({ image: url }, { merge: true }); showToast("ক্যাটাগরির ছবি পরিবর্তন হয়েছে"); }
  catch(e) { alert("ক্যাটাগরি ছবি সংরক্ষণে সমস্যা হয়েছে: " + e.message); }
}

function skeletonGridHtml() { return Array.from({length:6}).map(()=>`<div class="card"><div class="skeleton skeleton-img"></div><div class="skeleton skeleton-line" style="width:80%;"></div><div class="skeleton skeleton-line" style="width:40%;"></div><div class="skeleton skeleton-line" style="height:36px;"></div></div>`).join(''); }

/* রিলেভেন্স স্কোর: প্রতিটা শব্দ কতটা মিলল তার ভিত্তিতে — কখনো "খালি" রেজাল্ট না */
function scoreProduct(p, words) {
  const name = (p.name||'').toLowerCase(), cat = (p.category||'').toLowerCase(), desc = (p.description||'').toLowerCase();
  let score = 0;
  words.forEach(w => { if (!w) return; if (name.includes(w)) score += 3; if (cat.includes(w)) score += 2; if (desc.includes(w)) score += 1; });
  return score;
}

function renderProducts() {
  if (productsLoading) { document.getElementById('productGrid').innerHTML = skeletonGridHtml(); return; }

  let list = PRODUCTS;
  if (activeView === 'favorites') list = list.filter(p => wishlist[p.id]);
  else if (activeCategory !== "সব") list = list.filter(p => p.category === activeCategory);

  if (searchTerm) {
    const words = searchTerm.split(/\s+/).filter(Boolean);
    list = list.map(p => ({ p, score: scoreProduct(p, words) })).sort((a,b) => b.score - a.score).map(x => x.p);
  } else if (sortMode === 'low') list = [...list].sort((a,b) => a.price - b.price);
  else if (sortMode === 'high') list = [...list].sort((a,b) => b.price - a.price);

  if (!list.length) {
    document.getElementById('productGrid').innerHTML = `<div class="empty-state" style="grid-column:1/-1;">আপাতত কোনো পণ্য যোগ করা হয়নি।</div>`;
    return;
  }

  document.getElementById('productGrid').innerHTML = list.map((p, idx) => `
    <a class="card" href="${productAppUrl(p.id)}" onclick="event.preventDefault(); openFullview('${p.id}')">
      <div class="card-img-wrap">
        <button class="wish-btn ${wishlist[p.id] ? 'active' : ''}" onclick="event.stopPropagation(); event.preventDefault(); toggleWishlist('${p.id}')" aria-label="প্রিয়">
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        ${p.stock !== 'স্টকে আছে' ? `<span class="stock-tag">${escapeHtml(p.stock)}</span>` : ''}
        <img ${imageAttrs(p.image, 520, idx < 4)} alt="${escapeHtml(p.name)}">
        <span class="zoom-hint"><svg viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M11 8v6M8 11h6"/></svg></span>
      </div>
      <div class="card-title">${escapeHtml(p.name)}</div>
      <div class="card-price">৳${p.price}</div>
      <button class="add-cart-btn" onclick="event.stopPropagation(); event.preventDefault(); addToCart('${p.id}')" ${p.stock === 'স্টক নেই' ? 'disabled' : ''}>${p.stock === 'স্টক নেই' ? 'স্টক নেই' : 'কার্টে যোগ করুন'}</button>
      ${isAdmin ? `<div class="admin-actions"><button class="btn-admin" onclick="event.stopPropagation(); event.preventDefault(); openProductForm('${p.id}')">এডিট</button><button class="btn-admin danger" onclick="event.stopPropagation(); event.preventDefault(); deleteProduct('${p.id}')">ডিলিট</button></div>` : ''}
    </a>`).join('');
}

window.toggleWishlist = (id) => {
  if (wishlist[id]) delete wishlist[id]; else wishlist[id] = true;
  localStorage.setItem('shuvon_wishlist', JSON.stringify(wishlist));
  renderProducts();
  if (currentViewProductId === id) document.getElementById('fvWishBtn').querySelector('svg').style.fill = wishlist[id] ? 'var(--danger)' : 'none';
  showToast(wishlist[id] ? "প্রিয় তালিকায় যোগ হয়েছে" : "প্রিয় তালিকা থেকে সরানো হয়েছে");
};
window.updateFvDots = () => { const s = document.getElementById('fvSlider'); const i = Math.round(s.scrollLeft / (s.clientWidth || 1)); document.querySelectorAll('#fvDots .dot').forEach((d,k) => d.classList.toggle('active', k === i)); };
window.toggleWishlistFromView = () => { if (currentViewProductId) toggleWishlist(currentViewProductId); };

/* ---------------- ফুল-স্ক্রিন প্রোডাক্ট ভিউ + SEO ডিপ-লিংক ---------------- */
window.openFullview = (id, skipHistory) => {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  currentViewProductId = id;
  document.getElementById('fvName').textContent = p.name;
  document.getElementById('fvPrice').textContent = `৳${p.price}`;
  document.getElementById('fvDesc').textContent = p.description || 'এই পণ্যের বিস্তারিত বিবরণ এখনো যোগ করা হয়নি।';
  const stockTag = document.getElementById('fvStockTag');
  stockTag.textContent = p.stock; stockTag.style.background = p.stock === 'স্টকে আছে' ? 'var(--success-soft)' : (p.stock === 'স্টক নেই' ? 'var(--danger-soft)' : 'var(--accent-soft)');
  stockTag.style.color = p.stock === 'স্টকে আছে' ? 'var(--success)' : (p.stock === 'স্টক নেই' ? 'var(--danger)' : 'var(--accent-dark)');
  document.getElementById('fvWishBtn').querySelector('svg').style.fill = wishlist[id] ? 'var(--danger)' : 'none';
  const addBtn = document.getElementById('fvAddCartBtn');
  addBtn.disabled = p.stock === 'স্টক নেই'; addBtn.textContent = p.stock === 'স্টক নেই' ? 'স্টক নেই' : 'কার্টে যোগ করুন';
  addBtn.onclick = () => addToCart(id);
  document.getElementById('fvMessageBtn').onclick = () => openChatAboutProduct(p);

  const fvImgs = [...new Set([p.image, ...(Array.isArray(p.images) ? p.images : [])].filter(Boolean))];
  document.getElementById('fvSlider').innerHTML = fvImgs.map(u => `<div class="fullview-slide"><img ${imageAttrs(u, 1200)} alt="${escapeHtml(p.name)}"></div>`).join('');
  document.getElementById('fvSlider').scrollLeft = 0;
  document.getElementById('fvDots').innerHTML = fvImgs.length > 1 ? fvImgs.map((_,i) => `<span class="dot ${i===0?'active':''}"></span>`).join('') : '';
  document.getElementById('productFullview').classList.add('open');
  document.getElementById('productFullview').scrollTop = 0;

  // SEO: টাইটেল/মেটা/JSON-LD প্রোডাক্ট-নির্দিষ্ট করে দেওয়া + শেয়ারযোগ্য URL
  document.getElementById('pageTitle').textContent = `${p.name} | ${SITE_SETTINGS.storeName}`;
  document.getElementById('metaDesc').setAttribute('content', (p.description || p.name).slice(0,155));
  document.getElementById('ogTitleTag').setAttribute('content', p.name);
  document.getElementById('ogDescTag').setAttribute('content', (p.description || p.name).slice(0,155));
  document.getElementById('ogImageTag').setAttribute('content', p.image);
  const productUrlForMeta = productSeoUrl(id, p.name);
  document.getElementById('canonicalLink').setAttribute('href', productUrlForMeta);
  document.getElementById('ogUrlTag').setAttribute('content', productUrlForMeta);
  document.getElementById('productJsonLd').textContent = JSON.stringify({
    "@context":"https://schema.org","@type":"Product","name":p.name,"image":p.image,
    "description":p.description || p.name,
    "offers":{"@type":"Offer","priceCurrency":"BDT","price":p.price,"availability": p.stock==='স্টক নেই' ? "https://schema.org/OutOfStock" : "https://schema.org/InStock"}
  });
  if (!skipHistory) history.pushState({productId:id}, '', `?p=${encodeURIComponent(id)}`);
};
function slugify(s) { return encodeURIComponent(String(s||'').trim().replace(/\s+/g,'-')).slice(0,60); }
window.closeFullview = () => {
  document.getElementById('productFullview').classList.remove('open');
  currentViewProductId = null;
  document.getElementById('pageTitle').textContent = SITE_SETTINGS.storeName + " | স্টোর";
  document.getElementById('metaDesc').setAttribute('content', "শোভন স্টোর থেকে সেরা মানের স্টেশনারী ও নিত্যপ্রয়োজনীয় পণ্য অর্ডার করুন — bKash পেমেন্ট, দ্রুত ডেলিভারি, সারাদেশে।");
  document.getElementById('productJsonLd').textContent = '';
  document.getElementById('canonicalLink').setAttribute('href', siteUrl() + '/');
  document.getElementById('ogUrlTag').setAttribute('content', siteUrl() + '/');
  document.getElementById('ogImageTag').setAttribute('content', siteUrl() + '/icon-512.png');
  if (getProductIdFromLocation()) history.pushState({}, '', `${appBaseUrl()}/`);
};
// পুরনো শেয়ার-লিংক (?p=id) এবং নতুন পাথ-স্টাইল লিংক (/product/id/slug) — দুটোই সাপোর্ট করে
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
window.addEventListener('popstate', () => { const pid = getProductIdFromLocation(); if (pid) openFullview(pid, true); else closeFullview(); });

function openChatAboutProduct(p) {
  const productUrl = productAppUrl(p.id);
  const prefillMsg = `"${p.name}" সম্পর্কে জানতে চাই — ${productUrl}`;
  const goToChat = () => { closeFullview(); openDrawer('chatDrawer'); startChat(); document.getElementById('chatInput').value = prefillMsg; document.getElementById('chatInput').focus(); };
  if (isCustomer && auth.currentUser) goToChat();
  else openAuthModal(goToChat);
}

/* ---------------- Cart & Checkout ---------------- */
window.addToCart = (id) => { cart[id] = (cart[id] || 0) + 1; localStorage.setItem('shuvon_cart', JSON.stringify(cart)); updateCartUI(); showToast("কার্টে যোগ করা হয়েছে"); }
document.getElementById('cartOpenBtn').addEventListener('click', () => {
  if (!(isCustomer && auth.currentUser)) { openAuthModal(() => { updateCartUI(); openDrawer('cartDrawer'); }); return; }
  updateCartUI(); openDrawer('cartDrawer');
});

function computeDeliveryCharge() {
  const dist = document.getElementById('custDistrict').value;
  return dist === SITE_SETTINGS.ownerDistrict ? Number(SITE_SETTINGS.deliveryChargeInside||0) : Number(SITE_SETTINGS.deliveryChargeOutside||0);
}

function updateCartUI() {
  const count = Object.values(cart).reduce((a,b)=>a+b, 0);
  document.getElementById('cartBadge').textContent = count;
  document.getElementById('cartBadge').style.display = count > 0 ? 'flex' : 'none';

  if (isCustomer && auth.currentUser && customerProfile) {
    document.getElementById('custName').value = customerProfile.name || '';
    document.getElementById('custPhone').value = customerProfile.phone || '';
    document.getElementById('custDistrict').value = customerProfile.district || SITE_SETTINGS.ownerDistrict;
    document.getElementById('custUpazila').value = customerProfile.upazila || '';
    document.getElementById('custAddress').value = customerProfile.address || '';
  }

  const ids = Object.keys(cart);
  let itemsTotal = 0;
  if(!ids.length) {
    document.getElementById('cartItems').innerHTML = '<p style="color:var(--ink-soft); text-align:center; padding: 20px;">আপনার কার্ট খালি রয়েছে।</p>';
  } else {
    document.getElementById('cartItems').innerHTML = ids.map(id => {
      const p = PRODUCTS.find(x => x.id === id);
      if(!p) return '';
      itemsTotal += (p.price * cart[id]);
      return `<div class="cart-item"><img ${imageAttrs(p.image, 240)}><div class="cart-info"><h4>${escapeHtml(p.name)}</h4><div class="cart-price">৳${p.price}</div><div class="qty-controls"><button class="qty-btn" onclick="updateQty('${id}', -1)">-</button><span>${cart[id]}</span><button class="qty-btn" onclick="updateQty('${id}', 1)">+</button></div></div></div>`;
    }).join('');
  }

  const delivery = computeDeliveryCharge();
  const grand = itemsTotal + delivery;
  document.getElementById('sumItems').textContent = `৳ ${itemsTotal}`;
  document.getElementById('sumDelivery').textContent = `৳ ${delivery}`;
  document.getElementById('cartTotal').textContent = `৳ ${grand}`;
  document.getElementById('payAmountHint').textContent = `৳ ${grand}`;
  validateCheckoutForm();
}
document.getElementById('custDistrict').addEventListener('change', (e) => { 
  if (customerProfile) customerProfile.district = e.target.value; 
  updateCartUI(); 
});
document.getElementById('custUpazila').addEventListener('input', (e) => { 
  if (customerProfile) customerProfile.upazila = e.target.value; 
});
document.getElementById('custPhone').addEventListener('input', (e) => { 
  if (customerProfile) customerProfile.phone = e.target.value; 
});
document.getElementById('custName').addEventListener('input', (e) => { 
  if (customerProfile) customerProfile.name = e.target.value; 
});
document.getElementById('custAddress').addEventListener('input', (e) => { 
  if (customerProfile) customerProfile.address = e.target.value; 
});
window.updateQty = (id, delta) => { cart[id] += delta; if (cart[id] <= 0) delete cart[id]; localStorage.setItem('shuvon_cart', JSON.stringify(cart)); updateCartUI(); }

function validateCheckoutForm() {
  const hasItems = Object.keys(cart).length > 0;
  const loggedIn = isCustomer && auth.currentUser;
  const n = document.getElementById('custName').value.trim();
  const ph = document.getElementById('custPhone').value.trim();
  const upz = document.getElementById('custUpazila').value.trim();
  const ad = document.getElementById('custAddress').value.trim();
  const trx = document.getElementById('custTrxId').value.trim();
  const paid = Number(document.getElementById('custPaidAmount').value);
  document.getElementById('checkoutBtn').disabled = !(hasItems && loggedIn && n && ph && upz && ad && trx && paid > 0 && paid <= 10000000);
}
['custName','custPhone','custUpazila','custAddress','custTrxId','custPaidAmount'].forEach(id => { document.getElementById(id).addEventListener('input', validateCheckoutForm); });

document.getElementById('checkoutBtn').addEventListener('click', async () => {
  if (!auth.currentUser) return;
  const btn = document.getElementById('checkoutBtn');
  btn.disabled = true; btn.textContent = "প্রসেস হচ্ছে...";
  
  try {
    const ids = Object.keys(cart);
    const items = [];
    let itemsTotal = 0;
    
    // কার্ট থেকে আইটেম নিরাপদে বের করা
    for (const id of ids) {
       const p = PRODUCTS.find(x => x.id === id);
       if (p) {
           items.push({ productId: id, name: p.name, price: p.price, qty: cart[id] });
           itemsTotal += (p.price * cart[id]);
       }
    }
    
    const deliveryCharge = computeDeliveryCharge();
    const grandTotal = itemsTotal + deliveryCharge;
    const paidAmount = Number(document.getElementById('custPaidAmount').value);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0 || paidAmount > grandTotal) {
      alert("পেমেন্টের পরিমাণ মোট বিলের চেয়ে বেশি হতে পারবে না।");
      btn.disabled = false; btn.textContent = "অর্ডার নিশ্চিত করুন";
      validateCheckoutForm();
      return;
    }
    const status = 'pending_payment';

    // ফোন নম্বর নিরাপদভাবে নেওয়া
    const userPhone = document.getElementById('custPhone').value.trim() || (customerProfile ? customerProfile.phone : (auth.currentUser.email ? auth.currentUser.email.replace('@shuvon.customer', '') : ''));

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
      storeSnapshot: { storeName: SITE_SETTINGS.storeName || 'শোভন স্টোর', storeAddress: SITE_SETTINGS.storeAddress || '', contactNumber: SITE_SETTINGS.contactNumber || SITE_SETTINGS.whatsappNumber || '', websiteUrl: SITE_SETTINGS.websiteUrl || siteUrl(), logoUrl: SITE_SETTINGS.logoUrl || '', currency: SITE_SETTINGS.currency || '৳' },
      status, trackingUrl: "", statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const ref = await db.collection('orders').add(orderData);
    await db.collection('customers').doc(auth.currentUser.uid).set({ 
        name: orderData.customerName, 
        upazila: orderData.customerUpazila, 
        address: orderData.customerAddress, 
        district: orderData.customerDistrict 
    }, { merge: true });
    
    cart = {}; localStorage.setItem('shuvon_cart', JSON.stringify(cart)); updateCartUI();
    ['custTrxId','custPaidAmount'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('orderResultBody').innerHTML =
      `<div class="order-card"><span class="status-badge pending_payment">পেমেন্ট যাচাই হচ্ছে</span><p style="margin-top:12px;">আপনার অর্ডার আইডি: <b>${ref.id}</b></p><p style="margin-top:6px; font-size:0.85rem; color:var(--ink-soft);">TrxID ও পেমেন্টের পরিমাণ মালিক যাচাই করার পর অর্ডার নিশ্চিত হবে। "অ্যাকাউন্ট" থেকে স্ট্যাটাস দেখতে পারবেন। ডেলিভারি সময়: ${SITE_SETTINGS.deliveryTimeText}</p></div>`;
    openDrawer('orderResultDrawer');
  } catch(e) { 
    console.error(e);
    alert("অর্ডার সম্পন্ন করতে সমস্যা হয়েছে: " + e.message); 
  }
  btn.textContent = "অর্ডার নিশ্চিত করুন"; validateCheckoutForm();
});


function paymentSummary(o) {
  const total=Number(o.grandTotal||0), paid=Number(o.paymentAmountEntered||0), due=Math.max(0,total-paid);
  let label='পেমেন্ট যাচাই বাকি';
  if(o.status==='cancelled') label='অর্ডার বাতিল';
  else if(o.status==='payment_mismatch') label='পেমেন্টে সমস্যা / তথ্য মিলছে না';
  else if(paid>=total) label='সম্পূর্ণ পরিশোধিত';
  else if(paid>0) label='আংশিক পরিশোধিত';
  return {total,paid,due,label};
}
window.printOrderMemo=async function(orderId,viewer){
  try{
    const snap=await db.collection('orders').doc(orderId).get(); if(!snap.exists)return alert('অর্ডারটি পাওয়া যায়নি।');
    const o=snap.data(); if(viewer==='customer' && (!auth.currentUser||o.customerUid!==auth.currentUser.uid))return alert('এই অর্ডারটি দেখার অনুমতি নেই।'); if(viewer==='admin'&&!isAdmin)return alert('শুধু মালিক মেমো প্রিন্ট করতে পারবেন।');
    const ss=o.storeSnapshot||SITE_SETTINGS, cur=ss.currency||'৳', pay=paymentSummary(o);
    const date=o.createdAt&&o.createdAt.toDate?o.createdAt.toDate().toLocaleString('bn-BD'):new Date().toLocaleString('bn-BD');
    const logo=ss.logoUrl?`<img class="logo" src="${safeAttrUrl(ss.logoUrl)}">`:'';
    const rows=(o.items||[]).map(it=>`<tr><td>${escapeHtml(it.name)}</td><td>${Number(it.qty||0)}</td><td>${cur}${Number(it.price||0).toLocaleString('en-US')}</td><td>${cur}${(Number(it.price||0)*Number(it.qty||0)).toLocaleString('en-US')}</td></tr>`).join('');
    const w=window.open('','_blank','width=900,height=900'); if(!w)return alert('Print window খুলতে browser popup permission দিন।');
    w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>Order Memo</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f3f3f3;margin:0;padding:25px;color:#222}.memo{max-width:820px;margin:auto;background:#fff;padding:32px;border-radius:16px}.head{display:flex;gap:16px;align-items:center;border-bottom:2px solid #222;padding-bottom:16px}.logo{width:70px;height:70px;object-fit:contain;border-radius:10px}.store h1{margin:0 0 5px}.store p{margin:3px 0;font-size:13px;color:#555}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;padding:16px 0;font-size:13px}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left;font-size:13px}th{background:#f6f6f6}.totals{margin:15px 0 0 auto;width:320px}.row{display:flex;justify-content:space-between;padding:6px 0}.grand{border-top:2px solid #222;font-size:17px;font-weight:800;padding-top:9px}.payment{margin-top:18px;border:1px solid #ddd;border-radius:10px;padding:14px}.due{color:#c62828;font-weight:800}.paid{color:#2e7d32;font-weight:800}.foot{margin-top:22px;text-align:center;border-top:1px solid #ddd;padding-top:12px;font-size:12px;color:#666}.actions{text-align:center;margin:18px}.actions button{padding:10px 18px;border:0;border-radius:8px}@media print{body{background:#fff;padding:0}.memo{max-width:none;border-radius:0}.actions{display:none}}</style></head><body><div class="memo"><div class="head">${logo}<div class="store"><h1>${escapeHtml(ss.storeName||'শোভন স্টোর')}</h1><p>${escapeHtml(ss.storeAddress||'')}</p><p>কন্টাক্ট: ${escapeHtml(ss.contactNumber||ss.whatsappNumber||'')}</p><p>${escapeHtml(ss.websiteUrl||siteUrl())}</p></div></div><div class="meta"><div><b>অর্ডার:</b> ${escapeHtml(orderId)}</div><div><b>তারিখ:</b> ${escapeHtml(date)}</div><div><b>কাস্টমার:</b> ${escapeHtml(o.customerName||'')}</div><div><b>ফোন:</b> ${escapeHtml(o.customerPhone||'')}</div><div><b>জেলা:</b> ${escapeHtml(o.customerDistrict||'')}</div><div><b>উপজেলা:</b> ${escapeHtml(o.customerUpazila||'')}</div><div style="grid-column:1/-1"><b>ঠিকানা:</b> ${escapeHtml(o.customerAddress||'')}</div></div><table><thead><tr><th>পণ্য</th><th>পরিমাণ</th><th>দাম</th><th>মোট</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div class="row"><span>পণ্যের মোট</span><b>${cur}${Number(o.itemsTotal||0).toLocaleString('en-US')}</b></div><div class="row"><span>ডেলিভারি</span><b>${cur}${Number(o.deliveryCharge||0).toLocaleString('en-US')}</b></div><div class="row grand"><span>সর্বমোট</span><b>${cur}${pay.total.toLocaleString('en-US')}</b></div></div><div class="payment"><b>পেমেন্ট তথ্য</b><div class="row"><span>পদ্ধতি</span><b>${escapeHtml(o.paymentMethod||'-')}</b></div><div class="row"><span>স্ট্যাটাস</span><b>${escapeHtml(pay.label)}</b></div><div class="row"><span>Transaction ID</span><b>${escapeHtml(o.paymentTrxId||'-')}</b></div><div class="row"><span>পরিশোধিত</span><b class="paid">${cur}${pay.paid.toLocaleString('en-US')}</b></div><div class="row"><span>বাকি</span><b class="due">${cur}${pay.due.toLocaleString('en-US')}</b></div></div><div class="foot">অর্ডার স্ট্যাটাস: ${escapeHtml(orderStatusLabel(o.status))}<br>ধন্যবাদ।</div></div><div class="actions"><button onclick="window.print()">🖨 Print Memo</button></div><script>window.addEventListener('load',function(){setTimeout(function(){window.print()},150)})<\\/script></body></html>`); w.document.close();
    w.onload = () => setTimeout(() => w.print(), 300);
  }catch(e){alert('মেমো খুলতে সমস্যা হয়েছে: '+e.message)}
};

/* ---------------- Admin: orders ---------------- */
window.openOrdersAdmin = async () => {
  openDrawer('ordersAdminDrawer');
  const body = document.getElementById('ordersAdminBody');
  body.innerHTML = '<p style="color:var(--ink-soft);">লোড হচ্ছে...</p>';
  try {
    const snap = await db.collection('orders').orderBy('createdAt','desc').limit(50).get();
    if (snap.empty) { body.innerHTML = '<p style="color:var(--ink-soft);">কোনো অর্ডার নেই।</p>'; return; }
    body.innerHTML = snap.docs.map(d => {
      const o = d.data();
      return `<div class="order-card">
        <span class="status-badge ${o.status}">${orderStatusLabel(o.status)}</span>
        <p style="margin-top:8px; font-weight:600;">${escapeHtml(o.customerName)} — ${escapeHtml(o.customerPhone)}</p>
        <p style="font-size:0.85rem; color:var(--ink-soft);">${escapeHtml(o.customerAddress)}, ${escapeHtml(o.customerUpazila || '')}, ${escapeHtml(o.customerDistrict)}</p>
        <p style="font-size:0.85rem; margin-top:4px;">মোট: ৳${o.grandTotal} | TrxID: ${escapeHtml(o.paymentTrxId)} | পাঠিয়েছে: ৳${o.paymentAmountEntered}</p>
        <button class="btn-block btn-outline" style="margin-top:10px;" onclick="printOrderMemo('${d.id}','admin')">🖨 মালিকের মেমো প্রিন্ট</button>
        <div class="field" style="margin-top:10px;"><label>ট্র্যাকিং লিংক</label><input type="url" value="${escapeHtml(o.trackingUrl||'')}" id="track_${d.id}" placeholder="https://..."></div>
        <div class="field"><label>স্ট্যাটাস</label>
          <select id="status_${d.id}">
            <option value="pending_payment" ${o.status==='pending_payment'?'selected':''}>পেমেন্ট যাচাই বাকি</option>
            <option value="confirmed" ${o.status==='confirmed'?'selected':''}>পেমেন্ট নিশ্চিত / অর্ডার কনফার্ম</option>
            <option value="payment_mismatch" ${o.status==='payment_mismatch'?'selected':''}>পেমেন্ট মিসম্যাচ</option>
            <option value="processing" ${o.status==='processing'?'selected':''}>প্রসেসিং</option>
            <option value="shipped" ${o.status==='shipped'?'selected':''}>পাঠানো হয়েছে</option>
            <option value="delivered" ${o.status==='delivered'?'selected':''}>ডেলিভারড</option>
            <option value="cancelled" ${o.status==='cancelled'?'selected':''}>বাতিল</option>
          </select>
        </div>
        <button class="btn-admin" style="width:100%;" onclick="saveOrderAdmin('${d.id}')">সংরক্ষণ করুন</button>
      </div>`;
    }).join('');
  } catch(e) { body.innerHTML = '<p style="color:var(--danger);">লোড করতে সমস্যা হয়েছে।</p>'; }
};
window.saveOrderAdmin = async (id) => {
  const trackingUrl = document.getElementById(`track_${id}`).value.trim();
  const status = document.getElementById(`status_${id}`).value;
  if (trackingUrl && !safeHttpUrl(trackingUrl)) { alert('ট্র্যাকিং লিংক অবশ্যই https:// দিয়ে শুরু হতে হবে।'); return; }
  try { await db.collection('orders').doc(id).update({ trackingUrl, status, statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp() }); showToast("অর্ডার আপডেট হয়েছে"); }
  catch(e) { alert("আপডেট ব্যর্থ: " + e.message); }
};

/* ---------------- Admin: product form ---------------- */
document.getElementById('adminFabBtn').addEventListener('click', () => openProductForm(null));
function renderImgPreviewContainer(urls) {
  document.getElementById('imgPreviewContainer').innerHTML = urls.map(u => `<img ${imageAttrs(u, 180)} style="height:64px; width:64px; object-fit:cover; border-radius:8px; flex-shrink:0;">`).join('');
}
document.getElementById('imgInput').addEventListener('change', (e) => {
  pendingProductImages = Array.from(e.target.files);
  if (!pendingProductImages.length) return;
  const previews = new Array(pendingProductImages.length);
  let loaded = 0;
  pendingProductImages.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = ev => { previews[i] = ev.target.result; loaded++; if (loaded === pendingProductImages.length) renderImgPreviewContainer(previews); };
    reader.readAsDataURL(file);
  });
});
window.openProductForm = (id) => {
  editingId = id; pendingProductImages = [];
  const p = id ? PRODUCTS.find(x => x.id === id) : null;
  document.getElementById('formTitle').textContent = p ? 'পণ্য এডিট করুন' : 'পণ্য যোগ করুন';
  document.getElementById('pName').value = p ? p.name : '';
  document.getElementById('pCategory').value = p ? p.category : '';
  document.getElementById('pPrice').value = p ? p.price : '';
  document.getElementById('pDesc').value = p ? (p.description || '') : '';
  document.getElementById('pStock').value = p ? p.stock : 'স্টকে আছে';
  currentProductImageUrls = p ? (p.images && p.images.length ? p.images : (p.image ? [p.image] : [])) : [];
  renderImgPreviewContainer(currentProductImageUrls);
  openDrawer('formDrawer');
}
document.getElementById('logoInput').addEventListener('change', (e) => {
  const file = e.target.files[0]; if(!file) return; pendingLogoFile = file;
  const reader = new FileReader();
  reader.onload = ev => { document.getElementById('logoPreview').src = ev.target.result; document.getElementById('logoPreview').style.display = 'block'; };
  reader.readAsDataURL(file);
});
function renderHeroImagesList() {
  document.getElementById('heroImagesList').innerHTML = draftHeroImages.map((url,i) => `
    <div style="position:relative; width:70px; height:70px;">
      <img ${imageAttrs(url, 600)} style="width:100%; height:100%; object-fit:cover; border-radius:10px;">
      <button onclick="removeDraftHeroImage(${i})" style="position:absolute; top:-6px; right:-6px; width:20px; height:20px; border-radius:50%; background:var(--danger); color:#fff; font-size:11px;">×</button>
    </div>`).join('');
}
window.removeDraftHeroImage = (i) => { draftHeroImages.splice(i,1); renderHeroImagesList(); };
document.getElementById('heroInput').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if(!file) return;
  showToast('ছবি আপলোড হচ্ছে...');
  try { const url = await uploadToStorage(file, 'hero'); draftHeroImages.push(url); renderHeroImagesList(); showToast('যোগ হয়েছে — সেভ করতে ভুলবেন ঘন'); }
  catch(err) { alert('আপলোড ব্যর্থ: ' + err.message); }
  e.target.value = '';
});
document.getElementById('setBgType').addEventListener('change', (e) => {
  document.getElementById('setBgColorField').style.display = e.target.value === 'solid' ? 'block' : 'none';
});

// সেটিংস সেভ করার লজিক (বিকাশ নম্বর ভ্যালিডেশন সহ)
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const btn = document.getElementById('saveSettingsBtn');
  btn.disabled = true; btn.textContent = "সংরক্ষণ হচ্ছে...";
  try {
    let waNumClean = document.getElementById('setWaNum').value.replace(/[^0-9]/g,'');
    if (/^01[3-9][0-9]{8}$/.test(waNumClean)) waNumClean = '88' + waNumClean; // 01XXXXXXXXX -> 8801XXXXXXXXX
    
    const bkashClean = document.getElementById('setBkashNumber').value.replace(/[^0-9]/g,'');
    if(!/^01[3-9][0-9]{8}$/.test(bkashClean)) {
       alert("bKash নম্বর সঠিক নয়! (যেমন: 017XXXXXXXX)");
       btn.disabled = false; btn.textContent = "সেটিংস সংরক্ষণ করুন";
       return;
    }

    let logoUrlToSave = currentLogoUrl;
    if(pendingLogoFile) logoUrlToSave = await uploadToStorage(pendingLogoFile, 'store');
    
    const heroImagesClean = (draftHeroImages.length ? draftHeroImages : (SITE_SETTINGS.heroImages || [])).filter(Boolean);
    
    const contactClean = document.getElementById('setContactNumber').value.trim();
    const websiteClean = safeHttpUrl(document.getElementById('setWebsiteUrl').value.trim(), SITE_SETTINGS.websiteUrl || siteUrl());
    await db.collection('settings').doc('store_info').set({
        storeName: document.getElementById('setStoreName').value.trim(),
        storeAddress: document.getElementById('setStoreAddress').value.trim(),
        contactNumber: contactClean,
        websiteUrl: websiteClean,
        whatsappNumber: waNumClean,
        currency: SITE_SETTINGS.currency || STORE_CONFIG.currency, logoUrl: logoUrlToSave,
        heroImages: heroImagesClean,
        heroOverlayColor: firebase.firestore.FieldValue.delete(),
        heroOverlayOpacity: firebase.firestore.FieldValue.delete(),
        bgType: document.getElementById('setBgType').value,
        bgColor: document.getElementById('setBgColor').value,
        ownerDistrict: document.getElementById('setOwnerDistrict').value,
        deliveryChargeInside: Number(document.getElementById('setDeliveryInside').value) || 0,
        deliveryChargeOutside: Number(document.getElementById('setDeliveryOutside').value) || 0,
        deliveryTimeText: document.getElementById('setDeliveryTime').value,
        termsText: document.getElementById('setTerms').value, bkashNumber: bkashClean
    }, {merge: true});
    
    closeAllDrawers(); showToast("সেটিংস আপডেট করা হয়েছে");
  } catch(e) { alert("সংরক্ষণে ত্রুটি হয়েছে: " + e.message); }
  btn.disabled = false; btn.textContent = "সেটিংস সংরক্ষণ করুন";
});

document.getElementById('saveProductBtn').addEventListener('click', async () => {
  const btn = document.getElementById('saveProductBtn');
  const data = {
    name: document.getElementById('pName').value, category: document.getElementById('pCategory').value || 'অন্যান্য',
    price: Number(document.getElementById('pPrice').value), stock: document.getElementById('pStock').value,
    description: document.getElementById('pDesc').value || '', updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if(!data.name || !data.price) return alert("দয়া করে নাম ও দাম পূরণ করুন");
  btn.disabled = true; btn.textContent = "সংরক্ষণ হচ্ছে...";
  try {
    let imageUrls = currentProductImageUrls;
    if (pendingProductImages.length) {
      imageUrls = [];
      for (const file of pendingProductImages) imageUrls.push(await uploadToStorage(file, 'products'));
    }
    data.images = imageUrls.slice(0, 6);
    data.image = imageUrls[0] || 'https://via.placeholder.com/300';
    if(editingId) await db.collection('products').doc(editingId).set(data, { merge: true });
    else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('products').add(data); }
    closeAllDrawers(); showToast("সফলভাবে সংরক্ষিত হয়েছে!");
  } catch(e) { console.error(e); alert("সংরক্ষণে সমস্যা হয়েছে: " + e.message); }
  btn.disabled = false; btn.textContent = "পণ্য সংরক্ষণ করুন";
});
window.deleteProduct = async (id) => {
  if(confirm("আপনি কি নিশ্চিতভাবে এই পণ্যটি মুছে ফেলতে চান?")) {
    try { await db.collection('products').doc(id).delete(); showToast("পণ্য মুছে ফেলা হয়েছে"); }
    catch(e) { alert("মুছে ফেলতে সমস্যা হয়েছে: " + e.message); }
  }
}

updateCartUI();
