const api = window.NovaApi;
const drawer = document.getElementById("drawer");
const cartBtn = document.getElementById("cartBtn");
const cartCount = document.getElementById("cartCount");
const cartList = document.getElementById("cartList");
const cartTotal = document.getElementById("cartTotal");
const cartMessage = document.getElementById("cartMessage");
const checkoutBtn = document.getElementById("checkoutBtn");
const clearCartBtn = document.getElementById("clearCartBtn");
const checkoutWalletBalance = document.getElementById("checkoutWalletBalance");
const checkoutWalletInputs = document.querySelectorAll("input[name=\"checkoutWallet\"]");
const productSearch = document.getElementById("productSearch");
const filterButtons = document.querySelectorAll(".filter");
const productGrid = document.getElementById("productGrid") || document.querySelector(".product-grid:not(.service-providers-grid)");
const emptyResults = document.getElementById("emptyResults");
const idWarning = document.getElementById("idWarning");
const isolationPanel = document.getElementById("isolationPanel");
const isolationTitle = document.getElementById("isolationTitle");
const isolationMeta = document.getElementById("isolationMeta");
const isolationDescription = document.getElementById("isolationDescription");
const isolationSellerName = document.getElementById("isolationSellerName");
const isolationSellerImage = document.getElementById("isolationSellerImage");
const clearIsolationBtn = document.getElementById("clearIsolationBtn");
const assetsNavLink = document.getElementById("assetsNavLink");
const assetsQuickLink = document.getElementById("assetsQuickLink");
const embeddedAssets = document.getElementById("embeddedAssets");
const closeEmbeddedAssets = document.getElementById("closeEmbeddedAssets");
const storyCards = document.querySelectorAll(".story-card");
const isWholesaleMode = new URLSearchParams(window.location.search).get("mode") === "wholesale";
const navLinks = Array.from(document.querySelectorAll("[data-nav]"));
const accountWidget = document.getElementById("accountWidget");

let activeFilter = "all";
let cart = [];
let walletState = { local: 0, crypto: 0 };
let audioContext;

function normalizeRole(role) {
  if (role === "admin") return "admin";
  if (role === "advertiser") return "advertiser";
  if (role === "seller") return "seller";
  return "buyer";
}

function applyNavVisibility(role) {
  if (!navLinks.length) return;
  if (accountWidget) accountWidget.hidden = normalizeRole(role) === "advertiser";
  const allowedByRole = {
    buyer: ["home", "assets", "profile"],
    seller: ["home", "assets", "profile", "post"],
    advertiser: ["home", "ads"],
    admin: ["home", "assets", "profile", "post", "ads", "admin"]
  };
  const allowed = new Set(allowedByRole[normalizeRole(role)] || []);
  navLinks.forEach((link) => {
    const key = link.dataset.nav || "";
    link.hidden = !allowed.has(key);
  });
}

if (isWholesaleMode) {
  document.body.classList.add("wholesale-mode");
  if (cartBtn) cartBtn.style.display = "none";
  if (drawer) drawer.style.display = "none";
}

function formatMoney(value) {
  return `#${Number(value || 0).toFixed(2)}`;
}

function formatWalletMoney(value, walletType) {
  const symbol = walletType === "crypto" ? "$" : "#";
  return `${symbol}${Number(value || 0).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getProducts() {
  return Array.from(document.querySelectorAll(".product"));
}

function normalizeProductId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/\s+/g, "");
}

function getSellerAvatarUrl(sellerName) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(sellerName)}&background=0f172a&color=ffffff&size=96`;
}

function playCheckoutSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  const now = audioContext.currentTime;
  const sequence = [
    { time: 0, frequency: 880, duration: 0.05, gain: 0.08 },
    { time: 0.06, frequency: 1046.5, duration: 0.08, gain: 0.09 },
    { time: 0.15, frequency: 1318.5, duration: 0.14, gain: 0.1 }
  ];

  sequence.forEach((tone) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const startAt = now + tone.time;
    const endAt = startAt + tone.duration;

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(tone.frequency, startAt);

    gainNode.gain.setValueAtTime(0.001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(tone.gain, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, endAt);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt);
  });
}

function getSelectedWalletType() {
  const selected = document.querySelector("input[name=\"checkoutWallet\"]:checked");
  return selected ? selected.value : "local";
}

function showCartMessage(message, isError = false) {
  cartMessage.textContent = message;
  cartMessage.style.color = isError ? "#af2d2d" : "#0a8f74";
}

function getCartTotals() {
  let count = 0;
  let amount = 0;
  cart.forEach((item) => {
    count += item.quantity;
    amount += item.price * item.quantity;
  });
  return { count, amount };
}

async function refreshCartFromServer() {
  if (!api || isWholesaleMode) return;
  const result = await api.cart.get();
  cart = Array.isArray(result.items) ? result.items : [];
}

async function syncCartToServer() {
  if (!api || isWholesaleMode) return;
  await api.cart.set(cart);
}

async function refreshWalletFromServer() {
  if (!api) return;
  walletState = await api.wallets.get();
}

function renderCheckoutWalletBalance() {
  const walletType = getSelectedWalletType();
  checkoutWalletBalance.textContent = formatWalletMoney(walletState[walletType], walletType);
}

function renderCart() {
  if (isWholesaleMode) return;
  const { count, amount } = getCartTotals();
  cartCount.textContent = count.toString();
  cartTotal.textContent = formatMoney(amount);
  cartList.innerHTML = "";

  if (cart.length === 0) {
    cartList.innerHTML = "<li>Your cart is empty.</li>";
    return;
  }

  cart.forEach((item, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="cart-item-head">
        <span>${item.name}</span>
        <span>x${item.quantity}</span>
      </div>
      <div class="cart-item-price">${formatMoney(item.price)} each</div>
      <div class="cart-item-actions">
        <button class="qty-btn" data-action="decrease" data-index="${index}" type="button">-1</button>
        <button class="qty-btn" data-action="increase" data-index="${index}" type="button">+1</button>
        <button class="remove-btn" data-action="remove" data-index="${index}" type="button">Remove</button>
      </div>
    `;
    cartList.appendChild(li);
  });
}

function clearIsolationState() {
  getProducts().forEach((product) => product.classList.remove("isolated"));
  if (idWarning) idWarning.hidden = true;
  if (!isolationPanel) return;
  isolationPanel.hidden = true;
}

function showIsolationDetails(product) {
  if (!(product instanceof HTMLElement)) return;

  const title = product.querySelector("h3")?.textContent?.trim() || "Product";
  const type = product.querySelector(".type")?.textContent?.trim() || "Item";
  const price = product.querySelector(".add")?.getAttribute("data-price") || "0";
  const productId = product.dataset.productId || "-";
  const sold = product.dataset.sold || "0";
  const remaining = product.dataset.remaining || "0";
  const description = product.dataset.description || product.querySelector(".product-note")?.textContent?.trim() || "No extra description.";
  const seller = product.dataset.seller || "Unknown Seller";
  const sellerImage = product.dataset.sellerImage || getSellerAvatarUrl(seller);

  if (isolationTitle) isolationTitle.textContent = title;
  if (isolationMeta) isolationMeta.textContent = `${productId} • ${type} • ${formatMoney(price)} • Sold ${sold} • Remaining ${remaining}`;
  if (isolationDescription) isolationDescription.textContent = description;
  if (isolationSellerName) isolationSellerName.textContent = seller;
  if (isolationSellerImage) {
    isolationSellerImage.src = sellerImage;
    isolationSellerImage.alt = `Seller ${seller}`;
  }
  if (isolationPanel) isolationPanel.hidden = false;
}

function applyProductFilters() {
  const query = productSearch.value.trim().toLowerCase();
  const normalizedQuery = normalizeProductId(query);
  const hasQuery = Boolean(normalizedQuery);
  const exactIdMatches = hasQuery
    ? getProducts().filter((product) => normalizeProductId(product.dataset.productId) === normalizedQuery)
    : [];
  const hasExactIdMatch = exactIdMatches.length > 0;
  let visibleCount = 0;
  clearIsolationState();

  getProducts().forEach((product) => {
    const tags = (product.dataset.tags || "").toLowerCase();
    const category = product.dataset.category || "";
    const productId = String(product.dataset.productId || "").toLowerCase();
    const idMatch = normalizeProductId(productId) === normalizedQuery;

    const isAd = category === "ad";
    const filterMatch =
      isAd
        ? activeFilter === "all"
        : (activeFilter === "all" ||
          (["clothing", "service"].includes(activeFilter) && category === activeFilter) ||
          tags.split(",").map((tag) => tag.trim()).includes(activeFilter));

    const visible = hasQuery
      ? (hasExactIdMatch && idMatch)
      : filterMatch;
    product.classList.toggle("hidden", !visible);
    if (visible) visibleCount += 1;
  });

  if (hasExactIdMatch) {
    exactIdMatches[0].classList.add("isolated");
    showIsolationDetails(exactIdMatches[0]);
  }

  if (hasQuery && !hasExactIdMatch) {
    emptyResults.textContent = "No matching items found.";
    if (idWarning) idWarning.hidden = false;
  } else {
    emptyResults.textContent = "No matching items found.";
    if (idWarning) idWarning.hidden = true;
  }
  emptyResults.classList.toggle("show", visibleCount === 0);

  const serviceSection = document.getElementById("serviceProvidersSection");
  if (serviceSection) {
    if (activeFilter === "service") {
      serviceSection.hidden = false;
      loadServiceProviderCards();
    } else {
      serviceSection.hidden = true;
    }
  }
}

async function loadServiceProviderCards() {
  const grid = document.getElementById("serviceProvidersGrid");
  if (!grid || !api?.serviceProviders) return;
  try {
    const res = await api.serviceProviders.list(false);
    const items = Array.isArray(res.items) ? res.items : [];
    grid.innerHTML = "";
    const me = await api.auth.me().catch(() => ({ user: null }));
    const isLoggedIn = !!(me && me.user);
    items.forEach((p) => {
      const card = renderServiceProviderCard(p, isLoggedIn);
      grid.appendChild(card);
    });
    if (items.length > 0) {
      grid.querySelectorAll(".service-provider-rate-star").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const providerId = btn.dataset.providerId;
          const stars = Number(btn.dataset.stars);
          if (!providerId || !api.serviceProviders.rate || !me?.user) {
            showCartMessage("Log in to rate.", true);
            return;
          }
          api.serviceProviders.rate(providerId, stars).then((r) => {
            const card = btn.closest(".service-provider-card");
            if (card) {
              const avgEl = card.querySelector(".service-provider-rating-avg");
              const countEl = card.querySelector(".service-provider-rating-count");
              if (avgEl) avgEl.textContent = Number(r.ratingAverage).toFixed(1);
              if (countEl) countEl.textContent = `(${r.ratingCount})`;
            }
            showCartMessage("Thanks for your rating!");
          }).catch((err) => showCartMessage(err.message || "Could not submit rating.", true));
        });
      });
    }
  } catch (_e) {
    grid.innerHTML = '<p class="empty-results">Could not load service providers.</p>';
  }
}

function renderServiceProviderCard(p, isLoggedIn) {
  const article = document.createElement("article");
  article.className = "product service-provider-card";
  const avg = Number(p.ratingAverage) || 0;
  const count = Number(p.ratingCount) || 0;
  const thumbContent = p.imageData
    ? `<img src="${escapeHtml(p.imageData)}" alt="" />`
    : "";
  const activeClass = p.isActive !== false ? "sp-active" : "sp-inactive";
  const activeText = p.isActive !== false ? "Active" : "Inactive";
  const starsHtml = [1, 2, 3, 4, 5]
    .map(
      (s) =>
        `<button type="button" class="service-provider-rate-star" data-provider-id="${escapeHtml(p.id)}" data-stars="${s}" aria-label="Rate ${s} star${s > 1 ? "s" : ""}">★</button>`
    )
    .join("");
  article.innerHTML = `
    <div class="service-provider-thumb">${thumbContent}</div>
    <div class="service-provider-info">
      <h3>${escapeHtml(p.name || "Provider")}</h3>
      <p class="service-provider-meta ${activeClass}">${escapeHtml(activeText)}</p>
      ${p.phone ? `<p class="service-provider-phone">${escapeHtml(p.phone)}</p>` : ""}
      ${p.address ? `<p class="service-provider-address">${escapeHtml(p.address)}</p>` : ""}
      <div class="service-provider-rating">
        <span class="service-provider-rating-avg">${avg.toFixed(1)}</span>
        <span class="service-provider-rating-count">(${count})</span>
        <div class="service-provider-stars" aria-label="Rate this provider">
          ${starsHtml}
        </div>
        ${!isLoggedIn ? "<p class=\"service-provider-login-hint\">Log in to rate</p>" : ""}
      </div>
    </div>
  `;
  article.dataset.category = "service";
  article.dataset.tags = "service-provider";
  return article;
}

function applyCatalogStats(items) {
  const stats = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const productId = String(item.productId || "").trim();
    if (!productId) return;
    stats.set(productId, {
      sold: Number(item.sold) || 0,
      remaining: Math.max(0, Number(item.remaining) || 0)
    });
  });

  getProducts().forEach((product) => {
    const productId = String(product.dataset.productId || "");
    const entry = stats.get(productId);
    if (!entry) return;
    product.dataset.sold = String(entry.sold);
    product.dataset.remaining = String(entry.remaining);
    const stockLine = product.querySelector(".stock");
    if (stockLine) stockLine.textContent = `Sold ${entry.sold} • Remaining ${entry.remaining}`;
  });
}

async function loadCatalogStats() {
  if (!api?.catalog?.stats) return;
  try {
    const result = await api.catalog.stats();
    applyCatalogStats(result.items);
  } catch (_error) {
    showCartMessage("Could not refresh product stats.", true);
  }
}

const productObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  },
  { threshold: 0.15 }
);

let productAnimationIndex = 0;
function animateProductCard(product) {
  product.style.opacity = "0";
  product.style.transform = "translateY(20px)";
  product.style.transition = `all 0.5s ease ${Math.min(productAnimationIndex * 0.05, 0.28)}s`;
  productObserver.observe(product);
  productAnimationIndex += 1;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "readonly");
  helper.style.position = "absolute";
  helper.style.left = "-9999px";
  document.body.appendChild(helper);
  helper.select();
  document.execCommand("copy");
  document.body.removeChild(helper);
}

function renderCommunityPostCard(post) {
  if (!productGrid) return;
  const article = document.createElement("article");
  const category = ["clothing", "service"].includes(post.category) ? post.category : "other";
  const image = String(post.imageData || "").trim();
  const productId = String(post.productId || "").trim();
  const sold = Math.max(0, Number(post.soldCount) || 0);
  const remaining = Math.max(0, Number(post.remaining) || 0);
  const sellerName = String(post.userEmail || post.contact || "Community Seller").split("@")[0].replace(/[._-]+/g, " ");
  const sellerLabel = sellerName
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Community Seller";
  const sellerImage = getSellerAvatarUrl(sellerLabel);
  const title = escapeHtml(post.title || "Community Item");
  const description = escapeHtml(String(post.description || "Posted by community seller").slice(0, 78));
  const price = Number(post.price) || 0;

  article.className = "product user-post";
  article.dataset.category = category;
  article.dataset.tags = "community-post";
  article.dataset.productId = productId;
  article.dataset.sold = String(sold);
  article.dataset.remaining = String(remaining);
  article.dataset.seller = sellerLabel;
  article.dataset.sellerImage = sellerImage;
  article.dataset.description = String(post.description || "Community seller listing");
  article.innerHTML = `
    <div class="thumb user-thumb"></div>
    <div class="info">
      <div class="title-row">
        <h3>${title}</h3>
        <button class="copy-id" data-product-id="${escapeHtml(productId)}" type="button" aria-label="Copy product ID ${escapeHtml(productId)}" title="Copy product ID">
          <span class="copy-icon" aria-hidden="true">⧉</span>
        </button>
      </div>
      <p class="type">${category === "service" ? "Service" : category === "clothing" ? "Clothing" : "Other"}</p>
      <p class="product-note">${description}</p>
      <p class="stock">Sold ${sold} • Remaining ${remaining}</p>
      <div class="seller-chip">
        <img src="${escapeHtml(sellerImage)}" alt="Seller ${escapeHtml(sellerLabel)}" />
        <span>${escapeHtml(sellerLabel)}</span>
      </div>
      <div class="meta">
        <button class="add" data-name="${title}" data-price="${price}" data-product-id="${escapeHtml(productId)}" type="button">Add</button>
      </div>
    </div>
  `;

  const thumb = article.querySelector(".user-thumb");
  if (thumb instanceof HTMLDivElement && image) {
    thumb.style.backgroundImage = `linear-gradient(125deg, rgba(16, 14, 11, 0.22), rgba(21, 42, 60, 0.2)), url("${escapeHtml(image)}")`;
  }

  productGrid.appendChild(article);
  animateProductCard(article);
}

async function loadCommunityPosts() {
  if (!api || !productGrid) return;
  try {
    const result = await api.productPosts.list(50);
    const posts = Array.isArray(result.items) ? result.items : [];
    productGrid.querySelectorAll(".user-post").forEach((item) => item.remove());
    posts.forEach((post) => renderCommunityPostCard(post));
  } catch (error) {
    showCartMessage("Could not load community posts.", true);
  }
}

function renderAdCard(ad, isOwner) {
  if (!productGrid) return;
  const fullText = String(ad.text || "").trim();
  const text2 = String(ad.text2 || "").trim();
  const imageData = String(ad.imageData || "").trim();
  const imagePosition = String(ad.imagePosition || "none").toLowerCase();
  const hasImage = Boolean(imageData && imagePosition !== "none");

  var leadText, bodyText;
  if (text2.length > 0) {
    leadText = fullText;
    bodyText = text2;
  } else {
    var lines = fullText.split("\n").filter(Boolean);
    if (lines.length <= 2) {
      leadText = fullText;
      bodyText = "";
    } else {
      leadText = lines.slice(0, 2).join("\n");
      bodyText = lines.slice(2).join("\n");
    }
    if (!leadText && fullText.length > 0) {
      var cut = Math.min(180, fullText.length);
      leadText = fullText.slice(0, cut);
      bodyText = fullText.slice(cut);
    }
  }

  const article = document.createElement("article");
  article.className = "product ad-card ad-newspaper " + (hasImage ? "ad-has-image" : "ad-text-only");
  article.dataset.category = "ad";
  article.dataset.tags = "ad";
  article.dataset.productId = `ad-${ad.id}`;
  article.dataset.adId = ad.id;

  const deleteBtn = isOwner
    ? `<button type="button" class="ad-delete" data-ad-id="${escapeHtml(ad.id)}" aria-label="Delete ad">×</button>`
    : "";
  const imageBlock = hasImage
    ? `<div class="ad-image" style="background-image: url('${escapeHtml(imageData)}');"></div>`
    : "";
  const leadBlock = `<div class="ad-lead">${escapeHtml(leadText)}</div>`;
  const bodyBlock = bodyText ? `<div class="ad-body">${escapeHtml(bodyText)}</div>` : "";

  if (hasImage) {
    article.innerHTML = `
      <div class="ad-inner ad-newspaper-inner">
        ${deleteBtn}
        ${imageBlock}
        ${leadBlock}
        ${bodyBlock}
      </div>`;
  } else {
    article.innerHTML = `
      <div class="ad-inner ad-newspaper-inner ad-no-image">
        ${deleteBtn}
        ${leadBlock}
        ${bodyBlock}
      </div>`;
  }

  productGrid.appendChild(article);
  animateProductCard(article);
}

async function loadAdPosts() {
  if (!api?.adPosts || !productGrid) return;
  try {
    const [listRes, meRes] = await Promise.all([api.adPosts.list(50), api.auth.me()]);
    const items = Array.isArray(listRes.items) ? listRes.items : [];
    const me = meRes.user;
    const isAdvertiser = me && me.role === "advertiser";
    productGrid.querySelectorAll(".ad-card").forEach((el) => el.remove());
    items.forEach((ad) => {
      const isOwner = isAdvertiser && me.email === ad.userEmail;
      renderAdCard(ad, isOwner);
    });
  } catch (_error) {
    // Ads optional
  }
}

function addToCart(name, price, productId = "") {
  if (isWholesaleMode) return;
  const existing = cart.find((item) => item.name === name && item.price === price && (item.productId || "") === (productId || ""));
  if (existing) existing.quantity += 1;
  else cart.push({ name, price, quantity: 1, productId: String(productId || "") });
  renderCart();
  void syncCartToServer();
}

function changeItemQuantity(index, delta) {
  const item = cart[index];
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart.splice(index, 1);
  renderCart();
  void syncCartToServer();
}

function removeItem(index) {
  if (!cart[index]) return;
  cart.splice(index, 1);
  renderCart();
  void syncCartToServer();
}

function clearCart() {
  cart = [];
  renderCart();
  void syncCartToServer();
}

async function checkoutCart() {
  const { count } = getCartTotals();
  if (count === 0) return showCartMessage("Add items before checkout.", true);
  if (!api) return showCartMessage("API unavailable.", true);

  try {
    const result = await api.checkout(getSelectedWalletType());
    cart = result.cart || [];
    walletState = result.wallets || walletState;
    renderCart();
    renderCheckoutWalletBalance();
    await loadCatalogStats();
    playCheckoutSound();
    showCartMessage(`Checkout complete: ${formatWalletMoney(result.order.total, result.order.wallet)} paid from ${result.order.wallet} wallet.`);
  } catch (error) {
    showCartMessage(error.message || "Checkout failed.", true);
    await refreshWalletFromServer();
    renderCheckoutWalletBalance();
  }
}

function openEmbeddedAssets(event) {
  event.preventDefault();
  embeddedAssets.classList.add("open");
  embeddedAssets.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeEmbeddedPanel() {
  embeddedAssets.classList.remove("open");
  embeddedAssets.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

if (!isWholesaleMode && cartBtn) {
  cartBtn.addEventListener("click", async () => {
    drawer.classList.toggle("open");
    await refreshWalletFromServer();
    renderCheckoutWalletBalance();
  });
}

if (assetsNavLink) assetsNavLink.addEventListener("click", openEmbeddedAssets);
if (assetsQuickLink) assetsQuickLink.addEventListener("click", openEmbeddedAssets);
if (closeEmbeddedAssets) closeEmbeddedAssets.addEventListener("click", closeEmbeddedPanel);
if (clearIsolationBtn) {
  clearIsolationBtn.addEventListener("click", () => {
    if (productSearch) productSearch.value = "";
    applyProductFilters();
  });
}
if (embeddedAssets) {
  embeddedAssets.addEventListener("click", (event) => {
    if (event.target === embeddedAssets) closeEmbeddedPanel();
  });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter || "all";
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    applyProductFilters();
  });
});

productSearch.addEventListener("input", applyProductFilters);

if (productGrid) {
  productGrid.addEventListener("click", (event) => {
    const target = event.target;
    const adDeleteBtn = target instanceof Element ? target.closest(".ad-delete") : null;
    if (adDeleteBtn instanceof HTMLButtonElement) {
      const adId = adDeleteBtn.dataset.adId;
      if (adId && api?.adPosts?.delete) {
        event.preventDefault();
        event.stopPropagation();
        api.adPosts.delete(adId).then(() => {
          const card = adDeleteBtn.closest(".ad-card");
          if (card) card.remove();
          showCartMessage("Ad deleted.");
        }).catch((err) => {
          showCartMessage(err.message || "Could not delete ad.", true);
        });
      }
      return;
    }

    const copyButton = target instanceof Element ? target.closest(".copy-id") : null;
    if (copyButton instanceof HTMLButtonElement) {
      const productId = copyButton.dataset.productId || copyButton.closest(".product")?.dataset.productId || "";
      if (!productId) return;
      void copyText(productId)
        .then(() => {
          copyButton.classList.remove("copied");
          void copyButton.offsetWidth;
          copyButton.classList.add("copied");
          showCartMessage(`Copied Product ID: ${productId}`);
          if (productSearch) {
            productSearch.value = productId;
            productSearch.placeholder = `Copied ${productId} - paste to isolate`;
            applyProductFilters();
          }
        })
        .catch(() => showCartMessage("Could not copy product ID.", true));
      return;
    }

    const clickedProduct = target instanceof Element ? target.closest(".product") : null;
    if (clickedProduct instanceof HTMLElement) {
      const clickedAction = target instanceof Element ? target.closest("button, a, input, select, textarea") : null;
      if (!clickedAction && clickedProduct.dataset.productId) {
        window.location.href = `product.html?id=${encodeURIComponent(clickedProduct.dataset.productId)}`;
        return;
      }
    }

    const button = target instanceof Element ? target.closest(".add") : null;
    if (!(button instanceof HTMLButtonElement)) return;

    const name = button.dataset.name || "Item";
    const price = Number(button.dataset.price || "0");
    const productId = button.dataset.productId || "";
    addToCart(name, price, productId);
    showCartMessage(`${name} added to cart.`);

    const originalLabel = button.textContent || "Add";
    button.textContent = "Added";
    setTimeout(() => {
      button.textContent = originalLabel === "Added" ? "Add" : originalLabel;
    }, 700);
  });
}

if (!isWholesaleMode && cartList) {
  cartList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const index = Number(target.dataset.index);
    if (!Number.isInteger(index) || index < 0) return;

    if (target.dataset.action === "increase") changeItemQuantity(index, 1);
    if (target.dataset.action === "decrease") changeItemQuantity(index, -1);
    if (target.dataset.action === "remove") removeItem(index);
  });
}

if (!isWholesaleMode && checkoutBtn) checkoutBtn.addEventListener("click", checkoutCart);
if (!isWholesaleMode && clearCartBtn) {
  clearCartBtn.addEventListener("click", () => {
    clearCart();
    showCartMessage("Cart cleared.");
  });
}

if (!isWholesaleMode) {
  checkoutWalletInputs.forEach((input) => {
    input.addEventListener("change", () => {
      renderCheckoutWalletBalance();
    });
  });
}

getProducts().forEach((product) => {
  animateProductCard(product);
});

if (storyCards.length > 0) {
  let activeStory = 0;
  let storyTimer;
  let imageStep = 0;
  const storyImages = [
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=500&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80",
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=500&q=80",
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=500&q=80",
    "https://images.unsplash.com/photo-1557862921-37829c790f19?auto=format&fit=crop&w=500&q=80",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=500&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=500&q=80",
    "https://images.unsplash.com/photo-1503342452485-86ff0a2f4ff8?auto=format&fit=crop&w=500&q=80",
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=500&q=80",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=500&q=80"
  ];

  function setActiveStory(index) {
    storyCards.forEach((card, i) => {
      card.classList.toggle("active", i === index);
    });
    activeStory = index;
  }

  function renderStoryImages() {
    storyCards.forEach((card, index) => {
      const imageIndex = (imageStep + index) % storyImages.length;
      card.style.backgroundImage = `url("${storyImages[imageIndex]}")`;
    });
  }

  function startStoryTimer() {
    clearInterval(storyTimer);
    storyTimer = setInterval(() => {
      imageStep = (imageStep + 1) % storyImages.length;
      renderStoryImages();
      setActiveStory((activeStory + 1) % storyCards.length);
    }, 3000);
  }

  storyCards.forEach((card, index) => {
    card.addEventListener("click", () => {
      setActiveStory(index);
      startStoryTimer();
    });
  });

  renderStoryImages();
  setActiveStory(0);
  startStoryTimer();
}

function getInitials(name) {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function renderAccountWidget(user) {
  const widget = document.getElementById("accountWidget");
  if (!widget) return;
  if (!user) {
    widget.innerHTML = '<a class="account-btn" href="profile.html">Account</a>';
    return;
  }
  const name = user.name || "User";
  const photo = user.profileImage;
  const initials = getInitials(name);
  const incoming = Math.max(0, Number(user.incomingTransactionCount) || 0);
  const badge = incoming > 0
    ? `<span class="account-incoming-badge" title="Incoming transactions">${incoming > 99 ? "99+" : incoming}</span>`
    : "";
  if (photo) {
    widget.innerHTML = `<a class="account-btn profile-photo-btn" href="profile.html" title="Your details"><img class="profile-photo-img" src="${escapeHtml(photo)}" alt="${escapeHtml(name)}" />${badge}</a>`;
  } else {
    widget.innerHTML = `<a class="account-btn profile-photo-btn profile-initials" href="profile.html" title="Your details"><span class="profile-initials-text">${escapeHtml(initials)}</span>${badge}</a>`;
  }
}

(async function initShop() {
  if (!api) showCartMessage("Backend API not loaded.", true);
  try {
    if (api) {
      await refreshCartFromServer();
      if (!isWholesaleMode) await refreshWalletFromServer();
      await loadCommunityPosts();
      await loadAdPosts();
      await loadCatalogStats();
      const me = await api.auth.me().catch(() => ({ user: null }));
      if (!me.user && !isWholesaleMode) {
        window.location.href = "auth.html";
        return;
      }
      renderAccountWidget(me.user);
      applyNavVisibility(me.user?.role);
      if (me.user && me.user.role === "advertiser") {
        document.querySelectorAll('a[href="post.html"]').forEach((el) => { el.style.display = "none"; });
      }
    }
  } catch (error) {
    showCartMessage("Could not load saved cart.", true);
  }
  renderCart();
  renderCheckoutWalletBalance();
  applyProductFilters();
})();
