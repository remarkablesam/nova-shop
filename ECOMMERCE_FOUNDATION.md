# Nova Market E-commerce Foundation

This implementation adds a broad baseline across standard e-commerce areas:

1. Product detail page (`shopping-website/product.html`) and `/api/products`.
2. Checkout extensions: shipping method, tax, promo code support.
3. Payment integration stubs: `/api/payments/intent` and `/api/payments/webhook`.
4. Order status + tracking APIs.
5. Seller dashboard + payout requests (`/api/seller/*`, `shopping-website/seller.html`).
6. Admin moderation/flagging APIs for product posts and users.
7. Customer address book + wishlist + notifications APIs and profile wiring.
8. Product search/sort/filter server endpoint (`/api/products` query params).
9. Returns/refunds request flow (`/api/orders/:id/returns`, `/api/returns`).
10. Notification system (`/api/notifications`).
11. Security baseline: rate limiting, header hardening, CSRF token endpoint.
12. Analytics endpoint (`/api/admin/analytics`).
13. SEO metadata on index + product page.
14. Legal pages: privacy, terms, refund policy, cookies.
15. Reliability additions: backup endpoint + syntax test script.

Notes:
- Payment, email, and SMS integrations are implemented as local mock/stub flows.
- For production, replace stubs with real providers and webhook signature verification.
