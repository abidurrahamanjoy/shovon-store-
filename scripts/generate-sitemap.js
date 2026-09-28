#!/usr/bin/env node
/**
 * generate-sitemap.js
 * -----------------------------------------------------------
 * "আমার শপ"-এর প্রতিটা প্রোডাক্টের URL সহ sitemap.xml অটো-জেনারেট করে,
 * যাতে Google প্রতিটা প্রোডাক্ট পেজ আলাদা করে খুঁজে পায় ও ইনডেক্স করে।
 *
 * কেন দরকার:
 *  - এতদিন sitemap.xml-এ শুধু হোমপেজ ছিল, তাই কেউ প্রোডাক্টের নাম দিয়ে
 *    সার্চ করলে Google-এর কাছে সেই পেজটা "খুঁজে বের করার" কোনো রাস্তাই
 *    ছিল না।
 *  - প্রোডাক্ট ডেটা Firestore-এ, sitemap.xml একটা স্ট্যাটিক ফাইল —
 *    তাই এই স্ক্রিপ্টটা রান করলে বর্তমান সব প্রোডাক্ট থেকে টাটকা
 *    sitemap.xml তৈরি হবে।
 *
 * Product URL style defaults to query URLs for GitHub Pages compatibility.
 * For Firebase Hosting/custom domains you may use PRODUCT_URL_STYLE=path.
 * চালানোর নিয়ম (প্রজেক্ট ফোল্ডারে গিয়ে):
 *    node scripts/generate-sitemap.js
 * (Node.js 18+ দরকার — বিল্ট-ইন fetch ব্যবহার করে, কোনো npm install লাগে না)
 *
 * কখন চালাবেন:
 *  - নতুন প্রোডাক্ট যোগ/মুছে ফেলার পর, ডিপ্লয় করার আগে।
 *  - চাইলে GitHub Actions বা অন্য কোনো cron দিয়ে প্রতিদিন/সপ্তাহে
 *    অটোমেটিক চালিয়ে "firebase deploy --only hosting" করাও সম্ভব।
 * -----------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');

// ---- এই দুইটা প্রয়োজনে বদলে নিন ----
const SITE_URL = (process.env.SITE_URL || 'https://shovon-store.web.app').replace(/\/$/, '');
const PRODUCT_URL_STYLE = process.env.PRODUCT_URL_STYLE || 'query';
const PROJECT_ID = process.env.PROJECT_ID || 'shovon-store';
// -------------------------------------

const OUTPUT_FILE = path.join(__dirname, '..', 'sitemap.xml');

function slugify(s) {
  return encodeURIComponent(String(s || '').trim().replace(/\s+/g, '-')).slice(0, 60);
}

// Firestore REST API থেকে পাবলিকভাবে প্রোডাক্ট পড়া (rules-এ products-এর read: if true,
// তাই কোনো auth/API-key ছাড়াই কাজ করবে)
async function fetchAllProducts() {
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products?pageSize=300`;
  const products = [];
  let pageToken = null;

  do {
    const url = pageToken ? `${base}&pageToken=${encodeURIComponent(pageToken)}` : base;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Firestore থেকে প্রোডাক্ট আনতে ব্যর্থ হয়েছে: HTTP ${res.status}`);
    }
    const data = await res.json();
    (data.documents || []).forEach(doc => {
      const id = doc.name.split('/').pop();
      const name = doc.fields && doc.fields.name && doc.fields.name.stringValue;
      products.push({ id, name, updateTime: doc.updateTime });
    });
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return products;
}

function buildSitemapXml(products) {
  const today = new Date().toISOString().slice(0, 10);

  const urlEntries = [
    `  <url>\n    <loc>${SITE_URL}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n    <lastmod>${today}</lastmod>\n  </url>`
  ];

  products.forEach(p => {
    if (!p.name) return; // নাম না থাকলে বাদ (এমন হওয়ার কথা না, তবু নিরাপত্তার জন্য)
    const loc = PRODUCT_URL_STYLE === 'path'
      ? `${SITE_URL}/product/${p.id}/${slugify(p.name)}`
      : `${SITE_URL}/?p=${encodeURIComponent(p.id)}`;
    const lastmod = p.updateTime ? String(p.updateTime).slice(0, 10) : today;
    urlEntries.push(
      `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
    );
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries.join('\n')}\n</urlset>\n`;
}

(async () => {
  try {
    console.log('আমার শপ — প্রোডাক্ট তালিকা আনা হচ্ছে...');
    const products = await fetchAllProducts();
    console.log(`মোট ${products.length}টা প্রোডাক্ট পাওয়া গেছে।`);

    const xml = buildSitemapXml(products);
    fs.writeFileSync(OUTPUT_FILE, xml, 'utf8');

    console.log(`✅ sitemap.xml আপডেট হয়েছে: ${OUTPUT_FILE}`);
    console.log('এখন "firebase deploy --only hosting" চালিয়ে সাইটে পাবলিশ করুন।');
  } catch (err) {
    console.error('❌ sitemap.xml তৈরি করতে সমস্যা হয়েছে:', err.message);
    process.exit(1);
  }
})();
