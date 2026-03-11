const api = window.NovaApi;
const adForm = document.getElementById("adForm");
const adText = document.getElementById("adText");
const adImage = document.getElementById("adImage");
const adImagePreviewWrap = document.getElementById("adImagePreviewWrap");
const adImagePreview = document.getElementById("adImagePreview");
const adMessage = document.getElementById("adMessage");
const advertiserOnly = document.getElementById("advertiserOnly");
const nonAdvertiserMsg = document.getElementById("nonAdvertiserMsg");
const myAds = document.getElementById("myAds");
const myAdsSection = document.getElementById("myAdsSection");
let selectedImageData = "";

async function requireAccess(allowedRoles) {
  if (!api) return false;
  const me = await api.auth.me().catch(() => ({ user: null }));
  if (!me.user) {
    window.location.href = "auth.html";
    return false;
  }
  const role = me.user.role || "user";
  if (role !== "admin" && !allowedRoles.includes(role)) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

function setMessage(message, isError = false) {
  adMessage.textContent = message;
  adMessage.style.color = isError ? "#b33b4a" : "#158b74";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function checkAdvertiserAndShowForm() {
  if (!(await requireAccess(["advertiser"]))) return;
  if (!api) {
    advertiserOnly.classList.add("hidden");
    nonAdvertiserMsg.classList.remove("hidden");
    return;
  }
  try {
    const result = await api.auth.me();
    const user = result.user;
    const isAdvertiser = user && user.role === "advertiser";
    if (isAdvertiser) {
      advertiserOnly.classList.remove("hidden");
      nonAdvertiserMsg.classList.add("hidden");
      loadMyAds();
    } else {
      advertiserOnly.classList.add("hidden");
      nonAdvertiserMsg.classList.remove("hidden");
      myAdsSection.classList.add("hidden");
    }
  } catch (_e) {
    advertiserOnly.classList.add("hidden");
    nonAdvertiserMsg.classList.remove("hidden");
    myAdsSection.classList.add("hidden");
  }
}

async function loadMyAds() {
  if (!api || !api.adPosts) return;
  try {
    const result = await api.adPosts.list(20);
    const items = Array.isArray(result.items) ? result.items : [];
    const me = (await api.auth.me()).user;
    if (!me) {
      myAds.innerHTML = "<div class=\"post-item\">Log in to see your ads.</div>";
      return;
    }
    const mine = items.filter((ad) => ad.userEmail === me.email);
    if (mine.length === 0) {
      myAds.innerHTML = "<div class=\"post-item\">No ads yet.</div>";
      return;
    }
    myAds.innerHTML = mine
      .map((ad) => {
        const date = new Date(ad.createdAt || Date.now()).toLocaleString();
        const pos = ad.imagePosition || "none";
        const imageMarkup = ad.imageData
          ? `<img src="${escapeHtml(ad.imageData)}" alt="Ad" style="max-height:120px;object-fit:contain;" />`
          : "";
        return `
          <article class="post-item" data-ad-id="${escapeHtml(ad.id)}">
            <button type="button" class="post-item-delete" data-ad-id="${escapeHtml(ad.id)}" aria-label="Delete ad">×</button>
            ${imageMarkup}
            <div>${escapeHtml(ad.text).slice(0, 200)}${ad.text.length > 200 ? "…" : ""}</div>
            <small>Image: ${pos} • ${date}</small>
          </article>
        `;
      })
      .join("");

    myAds.querySelectorAll(".post-item-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const adId = btn.dataset.adId;
        if (!adId || !api.adPosts.delete) return;
        try {
          await api.adPosts.delete(adId);
          setMessage("Ad deleted.");
          loadMyAds();
        } catch (e) {
          setMessage(e.message || "Could not delete ad.", true);
        }
      });
    });
  } catch (e) {
    myAds.innerHTML = "<div class=\"post-item\">Could not load ads.</div>";
  }
}

const MAX_IMAGE_PX = 1200;
const JPEG_QUALITY = 0.82;
const MAX_DATA_URL_LENGTH = 2_600_000;

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      let dw = w;
      let dh = h;
      if (w > MAX_IMAGE_PX || h > MAX_IMAGE_PX) {
        if (w >= h) {
          dw = MAX_IMAGE_PX;
          dh = Math.round((h * MAX_IMAGE_PX) / w);
        } else {
          dh = MAX_IMAGE_PX;
          dw = Math.round((w * MAX_IMAGE_PX) / h);
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, dw, dh);
      let quality = JPEG_QUALITY;
      let dataUrl = canvas.toDataURL("image/jpeg", quality);
      while (dataUrl.length > MAX_DATA_URL_LENGTH && quality > 0.2) {
        quality -= 0.12;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image."));
    };
    img.src = url;
  });
}

adImage.addEventListener("change", async () => {
  const file = adImage.files && adImage.files[0];
  if (!file) {
    selectedImageData = "";
    adImagePreviewWrap.classList.add("hidden");
    adImagePreview.removeAttribute("src");
    return;
  }
  if (!file.type.startsWith("image/")) {
    setMessage("Please choose a valid image file.", true);
    adImage.value = "";
    return;
  }
  setMessage("Compressing image…");
  try {
    const dataUrl = await compressImageFile(file);
    selectedImageData = dataUrl;
    adImagePreview.src = dataUrl;
    adImagePreviewWrap.classList.remove("hidden");
    setMessage("Image ready (compressed for upload).");
  } catch (e) {
    setMessage(e.message || "Could not process image.", true);
    selectedImageData = "";
    adImagePreviewWrap.classList.add("hidden");
    adImage.value = "";
  }
});

adForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!api?.adPosts) return setMessage("API unavailable.", true);

  const text = adText.value.trim();
  const imagePosition = (document.querySelector("input[name=\"imagePosition\"]:checked") || {}).value || "none";

  if (!text.length) return setMessage("Enter your ad copy.", true);

  try {
    await api.adPosts.create({
      text,
      imageData: selectedImageData || undefined,
      imagePosition: selectedImageData ? imagePosition : "none"
    });
    adForm.reset();
    selectedImageData = "";
    adImagePreviewWrap.classList.add("hidden");
    adImagePreview.removeAttribute("src");
    document.querySelector("input[name=\"imagePosition\"][value=\"none\"]")?.click();
    setMessage("Ad published. It will appear in the shop grid.");
    loadMyAds();
  } catch (error) {
    setMessage(error.message || "Could not publish ad.", true);
  }
});

checkAdvertiserAndShowForm();
