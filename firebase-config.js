/* ============================================================
   ⚙️ দোকানের সেটিংস এবং ফায়ারবেস কনফিগারেশন
   ============================================================ */

// ১) দোকানের সাধারণ তথ্য
const STORE_CONFIG = {
  storeName: "শোভন স্টোর",
  whatsappNumber: "880 1779-088009", // আপনার হোয়াটসঅ্যাপ নম্বর দিন (দেশের কোড সহ, + ছাড়া)
  currency: "৳",
  adminUID: "h8Dz1CPX4ghH3VLSr7XWZU0lvJC2", // আপনার দেওয়া এডমিন UID
  imgbbApiKey: "YOUR_IMGBB_API_KEY" // imgbb.com থেকে ফ্রি API Key নিয়ে এখানে বসান
};

// ২) Firebase কনফিগারেশন
const firebaseConfig = {
  apiKey: "AIzaSyDtBBv3LV8bsRuFpTgUl3OwHpnw5_K5j7U",
  authDomain: "shovon-store.firebaseapp.com",
  projectId: "shovon-store",
  storageBucket: "shovon-store.firebasestorage.app",
  messagingSenderId: "762606693444",
  appId: "1:762606693444:web:dc45d67b674c235547e011"
};

// ৩) ছবি আপলোডের জন্য (যদি প্রয়োজন হয়)[cite: 4]
const IMGBB_API_KEY = "ce3852b445148d1506426c2d7bda6e15";
