/* ============================================================
   ⚙️ দোকানের সেটিংস এবং ফায়ারবেস কনফিগারেশন
   ============================================================ */

const STORE_CONFIG = {
  storeName: "শোভন স্টোর",
  whatsappNumber: "8801779088009",
  currency: "৳",
  adminUID: "h8Dz1CPX4ghH3VLSr7XWZU0lvJC2",

  /* bKash Merchant API (ঐচ্ছিক) — খালি রাখলে সাইট manual TrxID-verification
     মোডে চলবে (এটাই এখন বেস্ট ফ্রি অপশন)। বিজনেস bKash Merchant/PGW
     credentials পেলে জানাবেন, তখন live checkout-এর জন্য Cloud Function
     বানিয়ে জুড়ে দেব। */
  bkashMerchantApiKey: "",

  /* Google Analytics (ঐচ্ছিক, ফ্রি) — analytics.google.com থেকে
     Measurement ID (G-XXXXXXX ফরম্যাট) নিয়ে বসালে ভিজিটর ট্র্যাকিং চালু হবে। */
  googleAnalyticsId: ""
};

const firebaseConfig = {
  apiKey: "AIzaSyDtBBv3LV8bsRuFpTgUl3OwHpnw5_K5j7U",
  authDomain: "shovon-store.firebaseapp.com",
  projectId: "shovon-store",
  storageBucket: "shovon-store.firebasestorage.app",
  messagingSenderId: "762606693444",
  appId: "1:762606693444:web:dc45d67b674c235547e011"
};
