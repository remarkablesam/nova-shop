const revealElements = document.querySelectorAll(".reveal");
const api = window.NovaApi;
const joinEarlyBtn = document.getElementById("joinEarlyBtn");
const launchWaitlistBtn = document.getElementById("launchWaitlistBtn");
const waitlistForm = document.getElementById("waitlistForm");
const waitlistName = document.getElementById("waitlistName");
const waitlistEmail = document.getElementById("waitlistEmail");
const waitlistRole = document.getElementById("waitlistRole");
const waitlistMessage = document.getElementById("waitlistMessage");
const vaultForm = document.getElementById("vaultForm");
const assetType = document.getElementById("assetType");
const targetCategory = document.getElementById("targetCategory");
const vaultAmount = document.getElementById("vaultAmount");
const allocationPreview = document.getElementById("allocationPreview");

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
      }
    });
  },
  { threshold: 0.2 }
);

revealElements.forEach((item, idx) => {
  item.style.transitionDelay = `${Math.min(idx * 60, 360)}ms`;
  revealObserver.observe(item);
});

const counters = document.querySelectorAll("[data-count]");
let counterStarted = false;

function animateCounters() {
  if (counterStarted) return;
  counterStarted = true;

  counters.forEach((counter) => {
    const target = Number(counter.dataset.count);
    const duration = 1300;
    const start = performance.now();

    function update(now) {
      const progress = Math.min((now - start) / duration, 1);
      counter.textContent = Math.floor(target * (0.15 + 0.85 * progress)).toString();
      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  });
}

const statsSection = document.querySelector(".stats");
const statsObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) animateCounters();
    });
  },
  { threshold: 0.45 }
);

if (statsSection) statsObserver.observe(statsSection);

const cards = document.querySelectorAll(".tilt");
cards.forEach((card) => {
  card.addEventListener("mousemove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rotateY = ((x / rect.width) - 0.5) * 9;
    const rotateX = (0.5 - (y / rect.height)) * 8;
    card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });

  card.addEventListener("mouseleave", () => {
    card.style.transform = "perspective(900px) rotateX(0) rotateY(0)";
  });
});

function scrollToWaitlist() {
  const waitlist = document.getElementById("waitlist");
  if (waitlist) waitlist.scrollIntoView({ behavior: "smooth", block: "start" });
}

if (joinEarlyBtn) joinEarlyBtn.addEventListener("click", scrollToWaitlist);
if (launchWaitlistBtn) launchWaitlistBtn.addEventListener("click", scrollToWaitlist);

function getAllocationParts(category) {
  if (category === "Clothing") return { primary: 0.7, reserve: 0.3 };
  if (category === "Services") return { primary: 0.75, reserve: 0.25 };
  return { primary: 0.5, reserve: 0.5 };
}

vaultForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number(vaultAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    allocationPreview.textContent = "Please enter a valid amount.";
    allocationPreview.style.color = "#ff6a3d";
    return;
  }

  const category = targetCategory.value;
  const asset = assetType.value;
  const parts = getAllocationParts(category);
  const primary = Math.round(amount * parts.primary);
  const reserve = Math.round(amount * parts.reserve);
  allocationPreview.style.color = "#3ff2d0";
  allocationPreview.textContent = `Preview: ${primary.toLocaleString()} ${asset} to ${category}, ${reserve.toLocaleString()} ${asset} to reserve liquidity.`;
});

waitlistForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = waitlistName.value.trim();
  const email = waitlistEmail.value.trim().toLowerCase();
  const role = waitlistRole.value;

  if (!name || !email) {
    waitlistMessage.textContent = "Please complete all fields.";
    waitlistMessage.style.color = "#ff6a3d";
    return;
  }
  if (!api) {
    waitlistMessage.textContent = "API unavailable.";
    waitlistMessage.style.color = "#ff6a3d";
    return;
  }

  try {
    await api.waitlist.submit({ name, email, role });
    waitlistForm.reset();
    waitlistMessage.style.color = "#3ff2d0";
    waitlistMessage.textContent = "You are on the waitlist.";
  } catch (error) {
    waitlistMessage.textContent = error.message || "Waitlist submission failed.";
    waitlistMessage.style.color = "#ff6a3d";
  }
});
