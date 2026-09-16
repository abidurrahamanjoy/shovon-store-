rules_version = '2';

service cloud.firestore {

  match /databases/{database}/documents {

    /* ========================================================
       🔐 ADMIN AUTHORIZATION
       ======================================================== */

    function isAdmin() {
      return request.auth != null
        && request.auth.uid == "h8Dz1CPX4ghH3VLSr7XWZU0lvJC2";
    }


    /* ========================================================
       🔎 COMMON VALIDATION
       ======================================================== */

    function validProductData() {
      return request.resource.data.keys().hasOnly([
          "name",
          "category",
          "price",
          "stock",
          "image",
          "description",
          "createdAt",
          "updatedAt"
        ])

        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 120

        && request.resource.data.category is string
        && request.resource.data.category.size() > 0
        && request.resource.data.category.size() <= 60

        && request.resource.data.price is number
        && request.resource.data.price > 0
        && request.resource.data.price <= 10000000

        && request.resource.data.stock is string
        && request.resource.data.stock in [
          "স্টকে আছে",
          "সীমিত স্টক",
          "স্টক নেই"
        ]

        && request.resource.data.image is string
        && request.resource.data.image.size() <= 2048

        && request.resource.data.description is string
        && request.resource.data.description.size() <= 1000

        && request.resource.data.updatedAt is timestamp;
    }


    function validNewProductData() {
      return validProductData()
        && request.resource.data.createdAt is timestamp;
    }


    function validStoreSettings() {
      return request.resource.data.keys().hasOnly([
          "storeName",
          "whatsappNumber",
          "currency",
          "logoUrl",
          "heroImageUrl"
        ])

        && request.resource.data.storeName is string
        && request.resource.data.storeName.size() > 0
        && request.resource.data.storeName.size() <= 120

        && request.resource.data.whatsappNumber is string
        && request.resource.data.whatsappNumber.matches(
          '^8801[3-9][0-9]{8}$'
        )

        && request.resource.data.currency is string
        && request.resource.data.currency.size() > 0
        && request.resource.data.currency.size() <= 10

        && request.resource.data.logoUrl is string
        && request.resource.data.logoUrl.size() <= 2048

        && request.resource.data.heroImageUrl is string
        && request.resource.data.heroImageUrl.size() <= 2048;
    }


    /* ========================================================
       📦 PRODUCTS
       ======================================================== */

    match /products/{productId} {

      /*
       * দোকানের পণ্য public হওয়ায় সবাই read করতে পারবে।
       */
      allow read: if true;


      /*
       * নতুন পণ্য শুধুমাত্র Admin তৈরি করতে পারবে।
       */
      allow create: if isAdmin()
        && validNewProductData();


      /*
       * বিদ্যমান পণ্য শুধুমাত্র Admin update করতে পারবে।
       */
      allow update: if isAdmin()
        && validProductData();


      /*
       * পণ্য মুছে ফেলা শুধুমাত্র Admin করতে পারবে।
       */
      allow delete: if isAdmin();
    }


    /* ========================================================
       ⚙️ STORE SETTINGS
       ======================================================== */

    match /settings/{docId} {

      /*
       * Public storefront-এর জন্য settings read করা যাবে।
       */
      allow read: if true;


      /*
       * শুধুমাত্র store_info document Admin পরিবর্তন করতে পারবে।
       */
      allow create, update: if isAdmin()
        && docId == "store_info"
        && validStoreSettings();


      /*
       * Settings document delete করা যাবে না।
       */
      allow delete: if false;
    }


    /* ========================================================
       🚫 EVERYTHING ELSE DENIED
       ======================================================== */

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
