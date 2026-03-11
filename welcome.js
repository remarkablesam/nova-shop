(function initWelcomeExperience() {
  const shell = document.querySelector(".welcome-shell");
  const status = document.getElementById("motionStatus");
  if (!shell) return;

  const INTRO_MS = 2400;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function createAudio(src, volume, loop) {
    if (!src) return null;
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.loop = !!loop;
    audio.volume = volume;
    return audio;
  }

  const introAudio = createAudio("/universfield-cartoon-running-footsteps-250962.mp3", 0.35, true);

  const revealAudio = createAudio("/studiokolomna-whoosh-transitions-sfx-01-118227.mp3", 0.7, false);
  const retailClickAudio = createAudio("/floraphonic-ambient-metal-whoosh-2-174462.mp3", 0.85, false);
  const wholesaleClickAudio = createAudio("/floraphonic-cute-character-wee-1-188162.mp3", 0.85, false);

  let startedAudio = false;
  let revealTriggered = false;

  function setStatus(message) {
    if (!status) return;
    status.textContent = message;
  }

  function playRevealWhoosh() {
    if (!revealAudio) return;
    try {
      revealAudio.currentTime = 0;
      const p = revealAudio.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) {
      // Ignore playback failures.
    }
  }

  function stopIntroAudio() {
    if (!introAudio) return;
    introAudio.pause();
    introAudio.currentTime = 0;
  }

  function revealChoices() {
    if (revealTriggered) return;
    revealTriggered = true;

    stopIntroAudio();
    playRevealWhoosh();

    shell.dataset.stage = "choices";
    shell.dataset.animate = "true";
    setStatus("");
  }

  function runExperience() {
    shell.dataset.stage = "writing";
    shell.dataset.animate = "false";
    setStatus("Writing Nova Market...");
    window.setTimeout(revealChoices, INTRO_MS);
  }

  function bindChoiceClickSounds() {
    const retailLink = document.querySelector(".choice.retail");
    const wholesaleLink = document.querySelector(".choice.wholesale");

    function bind(link, audio) {
      if (!link || !audio) return;
      link.addEventListener("click", (event) => {
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        event.preventDefault();
        const href = link.getAttribute("href") || "/";

        try {
          audio.currentTime = 0;
          const playPromise = audio.play();
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {});
          }
        } catch (_) {
          // Ignore audio playback errors and continue navigation.
        }

        window.setTimeout(() => {
          window.location.href = href;
        }, 180);
      });
    }

    bind(retailLink, retailClickAudio);
    bind(wholesaleLink, wholesaleClickAudio);
  }

  async function startAudio() {
    if (startedAudio) return;
    if (shell.dataset.stage !== "writing") return;
    if (!introAudio) {
      startedAudio = true;
      return;
    }

    try {
      const playPromise = introAudio.play();
      if (playPromise && typeof playPromise.then === "function") {
        await playPromise;
      }
      startedAudio = true;
    } catch (_) {
      setStatus("Tap anywhere to enable intro sound");
    }
  }

  bindChoiceClickSounds();

  if (reduceMotion) {
    shell.dataset.stage = "choices";
    shell.dataset.animate = "true";
    setStatus("");
    return;
  }

  runExperience();
  void startAudio();

  window.addEventListener("pointerdown", () => {
    void startAudio();
  });

  window.addEventListener("keydown", () => {
    void startAudio();
  });
})();
