/* ============================================================
   ⚙️ দোকানের সেটিংস এবং ফায়ারবেস কনফিগারেশন
   ============================================================ */

const STORE_CONFIG = {
  storeName: "শোভন স্টোর",
  whatsappNumber: "880 1779-088009", // আপনার হোয়াটসঅ্যাপ নম্বর দিন (দেশের কোড সহ, + ছাড়া)
  currency: "৳",
  adminUID: "h8Dz1CPX4ghH3VLSr7XWZU0lvJC2" // ফায়ারবেস Authentication থেকে আপনার UID কপি করে এখানে বসান
};

// আপনার দেওয়া ফায়ারবেস প্রজেক্ট সেটিংস
const firebaseConfig = {
  apiKey: "AIzaSyDtBBv3LV8bsRuFpTgUl3OwHpnw5_K5j7U",
  authDomain: "shovon-store.firebaseapp.com",
  projectId: "shovon-store",
  storageBucket: "shovon-store.firebasestorage.app",
  messagingSenderId: "762606693444",
  appId: "1:762606693444:web:dc45d67b674c235547e011"
};
