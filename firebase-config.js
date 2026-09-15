/* ============================================================
   ⚙️ এই একটি ফাইলেই সব সেটিংস — index.html ও admin.html
   দুটো পেজই এই ফাইল থেকে তথ্য নেয়। শুধু এই ফাইলটা এডিট করলেই হবে।
   ============================================================ */

// ১) দোকানের সাধারণ তথ্য
const STORE_CONFIG = {
  storeName: "শোভন স্টোর",
  whatsappNumber: "8801779088009", // শুধু সংখ্যা — + বা স্পেস বা ড্যাশ থাকলে হোয়াটসঅ্যাপ লিংক কাজ করবে না
  currency: "৳"
};

// ২) Firebase কনফিগারেশন (পণ্যের তথ্য সংরক্ষণ ও লগইনের জন্য)
const firebaseConfig = {
  apiKey: "AIzaSyDtBBv3LV8bsRuFpTgUl3OwHpnw5_K5j7U",
  authDomain: "shovon-store.firebaseapp.com",
  projectId: "shovon-store",
  storageBucket: "shovon-store.firebasestorage.app",
  messagingSenderId: "762606693444",
  appId: "1:762606693444:web:dc45d67b674c235547e011"
};

// ৩) ছবি আপলোডের জন্য imgbb.com এর ফ্রি API কী
const IMGBB_API_KEY = "ce3852b445148d1506426c2d7bda6e15";
