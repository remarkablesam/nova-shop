const api = window.NovaApi;
const params = new URLSearchParams(window.location.search);
const productId = String(params.get("id") || "").trim();

const productName = document.getElementById("productName");
const productMeta = document.getElementById("productMeta");
const productDescription = document.getElementById("productDescription");
const productIdPill = document.getElementById("productIdPill");
const productStockPill = document.getElementById("productStockPill");
const addWishlistBtn = document.getElementById("addWishlistBtn");
const reviewList = document.getElementById("reviewList");
const message = document.getElementById("message");
let activeRole = "user";

async function requireAccess(allowedRoles) {
  if (!api) return false;
  const me = await api.auth.me().catch(() => ({ user: null }));
  if (!me.user) {
    window.location.href = "auth.html";
    return false;
  }
  const role = me.user.role || "user";
  activeRole = role;
  if (role !== "admin" && !allowedRoles.includes(role)) {
    window.location.href = "index.html";
    return false;
  }
  if (addWishlistBtn) {
    addWishlistBtn.hidden = role === "advertiser";
  }
  return true;
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#9d2f2f" : "#1a7c67";
}

async function loadProduct() {
  if (!api || !productId) return setMessage("Product not found.", true);
  try {
    const result = await api.products.get(productId);
    const p = result.product || {};
    document.title = `Nova Market | ${p.name || "Product"}`;
    productName.textContent = p.name || "Product";
    productMeta.textContent = `${p.category || "Item"} • ${p.sellerName || "Unknown Seller"} • #${Number(p.price || 0).toFixed(2)}`;
    productDescription.textContent = p.description || "No description yet.";
    productIdPill.textContent = `ID: ${p.productId || "-"}`;
    productStockPill.textContent = `Stock: ${p.remaining ?? "-"}`;
    const reviews = Array.isArray(p.reviews) ? p.reviews : [];
    reviewList.innerHTML = reviews.length
      ? reviews.map((r) => `<li>${Number(r.stars || 0).toFixed(1)}★ • ${new Date(r.createdAt || Date.now()).toLocaleString()}</li>`).join("")
      : "<li>No reviews yet.</li>";
  } catch (error) {
    setMessage(error.message || "Could not load product.", true);
  }
}

addWishlistBtn.addEventListener("click", async () => {
  if (!api || !productId) return;
  try {
    await api.wishlist.add(productId);
    setMessage("Added to wishlist.");
  } catch (error) {
    setMessage(error.message || "Could not add to wishlist.", true);
  }
});

if (api) {
  requireAccess(["user", "seller", "advertiser"]).then((ok) => {
    if (ok) void loadProduct();
  });
}
