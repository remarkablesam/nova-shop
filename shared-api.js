(function initNovaApi(globalScope) {
  (function initSkeletonLoader() {
    if (document.getElementById("skeleton-style")) return;
    const style = document.createElement("style");
    style.id = "skeleton-style";
    style.textContent = `
      @keyframes skeletonShimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .skeleton-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(4, 10, 22, 0.92);
        display: grid;
        place-items: center;
      }
      .skeleton-panel {
        width: min(920px, 92vw);
        display: grid;
        gap: 16px;
      }
      .skeleton-bar,
      .skeleton-card {
        border-radius: 14px;
        background: linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.22), rgba(255,255,255,0.08));
        background-size: 200% 100%;
        animation: skeletonShimmer 1.2s ease-in-out infinite;
      }
      .skeleton-bar { height: 18px; }
      .skeleton-bar.short { width: 40%; }
      .skeleton-bar.medium { width: 65%; }
      .skeleton-card { height: 140px; }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.className = "skeleton-overlay";
    overlay.innerHTML = `
      <div class="skeleton-panel" aria-hidden="true">
        <div class="skeleton-bar short"></div>
        <div class="skeleton-bar medium"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    `;
    document.addEventListener("DOMContentLoaded", () => {
      document.body.appendChild(overlay);
    });

    function removeOverlay() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    window.addEventListener("load", () => {
      window.setTimeout(removeOverlay, 200);
    });
    window.setTimeout(removeOverlay, 4000);
  })();

  async function request(path, options) {
    const headers = { "Content-Type": "application/json", ...(options && options.headers) };
    const response = await fetch(path, {
      credentials: "include",
      ...options,
      headers
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok) {
      const message = payload && payload.error ? payload.error : "Request failed.";
      throw new Error(message);
    }

    return payload;
  }

  globalScope.NovaApi = {
    health() {
      return request("/api/health");
    },
    auth: {
      me() {
        return request("/api/auth/me");
      },
      updateProfile(body) {
        return request("/api/auth/profile", { method: "PUT", body: JSON.stringify(body) });
      },
      signup(body) {
        return request("/api/auth/signup", { method: "POST", body: JSON.stringify(body) });
      },
      login(body) {
        return request("/api/auth/login", { method: "POST", body: JSON.stringify(body) });
      },
      logout() {
        return request("/api/auth/logout", { method: "POST" });
      },
      requestPasswordReset(email) {
        return request("/api/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) });
      },
      confirmPasswordReset(body) {
        return request("/api/auth/password-reset/confirm", { method: "POST", body: JSON.stringify(body) });
      },
      requestEmailVerification() {
        return request("/api/auth/email-verification/request", { method: "POST" });
      },
      verifyEmailToken(token) {
        return request("/api/auth/email-verification/verify", { method: "POST", body: JSON.stringify({ token }) });
      }
    },
    profile: {
      incomingTransactions(limit) {
        const query = Number.isFinite(limit) ? `?limit=${Math.max(1, Math.floor(limit))}` : "";
        return request(`/api/profile/incoming-transactions${query}`);
      }
    },
    cart: {
      get() {
        return request("/api/cart");
      },
      set(items) {
        return request("/api/cart", { method: "PUT", body: JSON.stringify({ items }) });
      }
    },
    wallets: {
      get() {
        return request("/api/wallets");
      },
      deposit(walletType, amount) {
        return request("/api/wallets/deposit", {
          method: "POST",
          body: JSON.stringify({ walletType, amount })
        });
      },
      pay(walletType, amount) {
        return request("/api/wallets/pay", {
          method: "POST",
          body: JSON.stringify({ walletType, amount })
        });
      },
      reset() {
        return request("/api/wallets/reset", { method: "POST" });
      }
    },
    checkout(walletType, options = {}) {
      const body = { walletType };
      if (options.buyerName != null) body.buyerName = options.buyerName;
      if (options.shippingAddress != null) body.shippingAddress = options.shippingAddress;
      if (options.shippingMethod != null) body.shippingMethod = options.shippingMethod;
      if (options.promoCode != null) body.promoCode = options.promoCode;
      return request("/api/checkout", { method: "POST", body: JSON.stringify(body) });
    },
    orders: {
      list(limit) {
        const query = Number.isFinite(limit) ? `?limit=${Math.max(1, Math.floor(limit))}` : "";
        return request(`/api/orders${query}`);
      },
      get(id) {
        return request(`/api/orders/${encodeURIComponent(id)}`);
      },
      tracking(id) {
        return request(`/api/orders/${encodeURIComponent(id)}/tracking`);
      },
      setStatus(id, body) {
        return request(`/api/orders/${encodeURIComponent(id)}/status`, {
          method: "POST",
          body: JSON.stringify(body || {})
        });
      },
      requestReturn(id, reason) {
        return request(`/api/orders/${encodeURIComponent(id)}/returns`, {
          method: "POST",
          body: JSON.stringify({ reason })
        });
      }
    },
    products: {
      list(params = {}) {
        const query = new URLSearchParams();
        if (params.q) query.set("q", String(params.q));
        if (params.category) query.set("category", String(params.category));
        if (params.sort) query.set("sort", String(params.sort));
        const suffix = query.toString() ? `?${query.toString()}` : "";
        return request(`/api/products${suffix}`);
      },
      get(productId) {
        return request(`/api/products/${encodeURIComponent(productId)}`);
      }
    },
    wishlist: {
      list() {
        return request("/api/wishlist");
      },
      add(productId) {
        return request(`/api/wishlist/${encodeURIComponent(productId)}`, { method: "POST" });
      },
      remove(productId) {
        return request(`/api/wishlist/${encodeURIComponent(productId)}`, { method: "DELETE" });
      }
    },
    addresses: {
      list() {
        return request("/api/addresses");
      },
      create(body) {
        return request("/api/addresses", { method: "POST", body: JSON.stringify(body || {}) });
      },
      delete(id) {
        return request(`/api/addresses/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
    },
    notifications: {
      list(limit) {
        const query = Number.isFinite(limit) ? `?limit=${Math.max(1, Math.floor(limit))}` : "";
        return request(`/api/notifications${query}`);
      },
      markRead(id) {
        return request(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
      }
    },
    returns: {
      list() {
        return request("/api/returns");
      }
    },
    productPosts: {
      create(body) {
        return request("/api/product-posts", { method: "POST", body: JSON.stringify(body) });
      },
      list(limit) {
        const query = Number.isFinite(limit) ? `?limit=${Math.max(1, Math.floor(limit))}` : "";
        return request(`/api/product-posts${query}`);
      },
      listMine(limit) {
        const query = Number.isFinite(limit) ? `?mine=1&limit=${Math.max(1, Math.floor(limit))}` : "?mine=1";
        return request(`/api/product-posts${query}`);
      }
    },
    adPosts: {
      create(body) {
        return request("/api/ad-posts", { method: "POST", body: JSON.stringify(body) });
      },
      list(limit) {
        const query = Number.isFinite(limit) ? `?limit=${Math.max(1, Math.floor(limit))}` : "";
        return request(`/api/ad-posts${query}`);
      },
      delete(id) {
        return request(`/api/ad-posts/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
    },
    catalog: {
      stats() {
        return request("/api/catalog/stats");
      }
    },
    serviceProviders: {
      list(activeOnly) {
        const query = activeOnly ? "?active=true" : "";
        return request(`/api/service-providers${query}`);
      },
      rate(id, stars) {
        return request(`/api/service-providers/${encodeURIComponent(id)}/rate`, {
          method: "POST",
          body: JSON.stringify({ stars })
        });
      }
    },
    admin: {
      overview(adminToken) {
        const headers = adminToken ? { "x-admin-token": adminToken } : {};
        return request("/api/admin/overview", { headers });
      },
      resetAllWallets(adminToken) {
        const headers = adminToken ? { "x-admin-token": adminToken } : {};
        return request("/api/admin/wallets/reset-all", { method: "POST", headers });
      },
      serviceProviders: {
        list(adminToken) {
          const headers = adminToken ? { "x-admin-token": adminToken } : {};
          return request("/api/admin/service-providers", { headers });
        },
        create(body, adminToken) {
          const headers = adminToken ? { "x-admin-token": adminToken } : {};
          return request("/api/admin/service-providers", { method: "POST", body: JSON.stringify(body), headers });
        }
      },
      productPosts(adminToken) {
        const headers = adminToken ? { "x-admin-token": adminToken } : {};
        return request("/api/admin/product-posts", { headers });
      },
      moderateProductPost(id, status, adminToken) {
        const headers = adminToken ? { "x-admin-token": adminToken } : {};
        return request(`/api/admin/product-posts/${encodeURIComponent(id)}/moderate`, {
          method: "POST",
          body: JSON.stringify({ status }),
          headers
        });
      },
      flagUser(id, reason, adminToken) {
        const headers = adminToken ? { "x-admin-token": adminToken } : {};
        return request(`/api/admin/users/${encodeURIComponent(id)}/flag`, {
          method: "POST",
          body: JSON.stringify({ reason }),
          headers
        });
      },
      userDetails(id, adminToken) {
        const headers = adminToken ? { "x-admin-token": adminToken } : {};
        return request(`/api/admin/users/${encodeURIComponent(id)}/details`, { headers });
      },
      orderDetails(id, adminToken) {
        const headers = adminToken ? { "x-admin-token": adminToken } : {};
        return request(`/api/admin/orders/${encodeURIComponent(id)}`, { headers });
      },
      analytics(adminToken) {
        const headers = adminToken ? { "x-admin-token": adminToken } : {};
        return request("/api/admin/analytics", { headers });
      }
    },
    seller: {
      dashboard() {
        return request("/api/seller/dashboard");
      },
      requestPayout(amount) {
        return request("/api/seller/payouts/request", {
          method: "POST",
          body: JSON.stringify({ amount })
        });
      },
      payouts() {
        return request("/api/seller/payouts");
      }
    },
    payments: {
      createIntent(amount) {
        return request("/api/payments/intent", { method: "POST", body: JSON.stringify({ amount }) });
      }
    },
    security: {
      csrf() {
        return request("/api/security/csrf");
      }
    },
    waitlist: {
      submit(body) {
        return request("/api/waitlist", { method: "POST", body: JSON.stringify(body) });
      }
    }
  };
})(window);
