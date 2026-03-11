const api = window.NovaApi;
const postForm = document.getElementById("postForm");
const postTitle = document.getElementById("postTitle");
const postCategory = document.getElementById("postCategory");
const postPrice = document.getElementById("postPrice");
const postContact = document.getElementById("postContact");
const postDescription = document.getElementById("postDescription");
const postImage = document.getElementById("postImage");
const imagePreviewWrap = document.getElementById("imagePreviewWrap");
const imagePreview = document.getElementById("imagePreview");
const postMessage = document.getElementById("postMessage");
const myPosts = document.getElementById("myPosts");
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
  postMessage.textContent = message;
  postMessage.style.color = isError ? "#b33b4a" : "#158b74";
}

function money(value) {
  return `#${Number(value || 0).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadMyPosts() {
  if (!api) return;
  try {
    const result = await api.productPosts.listMine(20);
    const items = Array.isArray(result.items) ? result.items : [];
    if (!items.length) {
      myPosts.innerHTML = '<div class="post-item">No posts yet.</div>';
      return;
    }

    myPosts.innerHTML = items
      .map((item) => {
        const date = new Date(item.createdAt || Date.now()).toLocaleString();
        const imageMarkup = item.imageData ? `<img src="${escapeHtml(item.imageData)}" alt="${escapeHtml(item.title)}" />` : "";
        return `
          <article class="post-item">
            ${imageMarkup}
            <strong>${item.title} • ${money(item.price)}</strong>
            <div>${item.description}</div>
            <small>${item.category} • ${item.contact} • ${date}</small>
          </article>
        `;
      })
      .join("");
  } catch (error) {
    setMessage(error.message || "Could not load your posts.", true);
  }
}

postImage.addEventListener("change", async () => {
  const file = postImage.files && postImage.files[0];
  if (!file) {
    selectedImageData = "";
    imagePreviewWrap.classList.add("hidden");
    imagePreview.removeAttribute("src");
    return;
  }

  if (!file.type.startsWith("image/")) {
    setMessage("Please choose a valid image file.", true);
    postImage.value = "";
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    setMessage("Image must be 2MB or less.", true);
    postImage.value = "";
    return;
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });

  selectedImageData = dataUrl;
  imagePreview.src = dataUrl;
  imagePreviewWrap.classList.remove("hidden");
  setMessage("Image ready to post.");
});

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!api) return setMessage("API unavailable.", true);

  const body = {
    title: postTitle.value.trim(),
    category: postCategory.value,
    price: Number(postPrice.value),
    contact: postContact.value.trim(),
    description: postDescription.value.trim(),
    imageData: selectedImageData
  };

  try {
    await api.productPosts.create(body);
    postForm.reset();
    selectedImageData = "";
    imagePreviewWrap.classList.add("hidden");
    imagePreview.removeAttribute("src");
    setMessage("Product posted successfully.");
    await loadMyPosts();
  } catch (error) {
    setMessage(error.message || "Could not post product.", true);
  }
});

if (api) {
  requireAccess(["seller"]).then((ok) => {
    if (ok) void loadMyPosts();
  });
}
