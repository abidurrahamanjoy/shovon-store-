/* ============================================================
   ⚙️ দোকানের সেটিংস এবং ফায়ারবেস কনফিগারেশন
   ============================================================ */

const STORE_CONFIG = {
  storeName: "শোভন স্টোর",
  whatsappNumber: "8801779088009",
  currency: "৳",
  adminUID: "h8Dz1CPX4ghH3VLSr7XWZU0lvJC2",

  /* ছবি হোস্টিং — Cloudinary (ফ্রি, কোনো কার্ড লাগে না, আনলিমিটেডের কাছাকাছি
     ফ্রি টায়ার: ২৫GB স্টোরেজ + ২৫GB ব্যান্ডউইথ/মাস, ফাস্ট CDN)।
     Firebase Storage এখন Blaze (billing card) ছাড়া ব্যবহার করা যায় না,
     তাই এটাই বদলে দেওয়া হলো।
     সেটআপ (৫ মিনিট, ফ্রি):
     ১) https://cloudinary.com -এ ফ্রি সাইনআপ করুন (কার্ড লাগবে না)।
     ২) Dashboard-এ আপনার "Cloud name" দেখতে পাবেন — নিচে বসান।
     ৩) Settings → Upload → "Upload presets" → Add upload preset →
        Signing mode: "Unsigned" করে সেভ করুন — সেই preset-এর নাম নিচে বসান।
     এই preset-টা ক্লায়েন্ট থেকে নিরাপদে আপলোডের জন্য ডিজাইন করা —
     কোনো গোপন key এখানে দরকার হয় না। */
  cloudinaryCloudName: "",
  cloudinaryUploadPreset: "",

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
