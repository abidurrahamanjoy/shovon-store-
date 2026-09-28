# Shovon Store — Sale / Handover Notes

## Included
- Responsive e-commerce storefront
- Firebase Authentication + Firestore
- Single-admin authorization via the configured admin UID
- Product/category/store-settings management
- Customer accounts, orders and customer/admin chat
- Cloudinary image hosting
- Manual bKash payment submission using TrxID + amount
- PWA manifest/service worker
- Sitemap/robots/structured-data SEO foundation

## Admin model
This build intentionally supports **one admin only**. The UID configured in `firebase-config.js` and `firestore.rules` is the only admin identity. Do not add a second admin unless the application is intentionally redesigned.

## Manual payment workflow
1. Customer submits a bKash TrxID and paid amount.
2. The order is created with `pending_payment`.
3. The admin manually checks the payment.
4. The admin changes the status to `confirmed`, `payment_mismatch`, `processing`, `shipped`, `delivered`, or `cancelled`.

A bKash API/PGW integration is intentionally not included. It can be added later for a client who provides the required merchant/API credentials.

## Image hosting
Product, logo and hero images are uploaded to Cloudinary through the configured unsigned upload preset. The client-side uploader now accepts image files up to 5 MB. For production, keep the Cloudinary unsigned preset restricted to images and a reasonable upload size.

## Important security changes in this version
- Customer order documents are no longer publicly readable by order ID.
- New customer orders must start as `pending_payment`; customers cannot mark their own order as confirmed.
- `grandTotal` must equal `itemsTotal + deliveryCharge`.
- Existing orders can only be changed by the admin, and only `status` and `trackingUrl` can be updated.
- The final catch-all Firestore rule remains deny-by-default.

## Future client-specific additions
- bKash Merchant/PGW API integration
- Google Analytics Measurement ID
- Custom domain
- Client-specific branding, delivery rules and payment methods
- Optional server-side order-price verification with a trusted backend/Cloud Function

## Before handover
- Replace demo products/settings.
- Verify the buyer's Firebase project and authentication account.
- Confirm the single admin UID is the intended owner.
- Confirm the Cloudinary cloud name and upload preset belong to the client.
- Deploy Firestore rules.
- Test customer signup, order creation, manual payment verification, admin status updates, chat and image upload.


## Technical hardening included
- Order documents are private: only the customer who owns the order or the configured single admin can read them.
- Order updates are admin-only and limited to status/tracking URL.
- Tracking URLs accept only http/https URLs.
- The customer order query has its required Firestore composite index included in `firestore.indexes.json`.
- GitHub Actions Firebase Hosting deployment is optional and runs only when `FIREBASE_SERVICE_ACCOUNT` is configured.
- Cloudinary uploads are limited to image files up to 5 MB and upload folders are sanitized.
- Manual bKash verification remains the default; no bKash secret/API credential is embedded.

## Important handover note
The buyer should move the project to their own Firebase project and Cloudinary account before production handover. Update `firebase-config.js`, `firestore.rules` (single admin UID), `scripts/generate-sitemap.js`/workflow site settings, and deploy the included Firestore indexes.


## Final build notes
- Hosting security headers from the hardened build are retained.
- Product canonical/OG URLs use the configured site URL, including future custom domains.
- Cloudinary uploads are restricted to JPG, PNG, WEBP and GIF images and HTTPS secure URLs.
- Order timestamps remain protected by the Firestore rules and are updated by the admin when order status changes.


## Product-link compatibility fix
- Product/share links now use a repository-safe query URL (`?p=PRODUCT_ID`) by default.
- This works when the store is hosted at a GitHub Pages subpath such as `/joy/`, where root-relative `/product/...` links would otherwise open GitHub Pages 404.
- The app also detects its current base path automatically.
- If a client later wants pretty `/product/id/slug` URLs on Firebase Hosting, the sitemap generator supports `PRODUCT_URL_STYLE=path`; Firebase Hosting's catch-all rewrite is already included.
