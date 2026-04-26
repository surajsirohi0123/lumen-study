// Content script for Lumen Study
// Adds a floating study button on selection, and an in-page result card

(function () {
  "use strict";
  if (window.__lumenStudyLoaded) return;
  window.__lumenStudyLoaded = true;

  const PAGE_URL = location.href.split("#")[0];
  const PAGE_TITLE = document.title || PAGE_URL;

  let floatBtn = null;
  let card = null;
  let currentText = "";

  // ---------- Floating study button ----------
  function removeFloatBtn() {
    if (floatBtn) {
      floatBtn.remove();
      floatBtn = null;
    }
  }

  function showFloatBtn(selection) {
    removeFloatBtn();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (text.length < 10) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    currentText = text;

    floatBtn = document.createElement("div");
    floatBtn.className = "lumen-study-ui lumen-study-fab";

    // Position BELOW selection on right edge to avoid clashing with Lumen highlighter toolbar (which sits ABOVE selection)
    floatBtn.style.top = window.scrollY + rect.bottom + 8 + "px";
    floatBtn.style.left = window.scrollX + rect.right - 40 + "px";

    floatBtn.innerHTML = `
      <button class="lumen-study-fab-main" title="Study this text">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <span>Study</span>
      </button>
      <div class="lumen-study-fab-menu">
        <button data-mode="tldr">TL;DR</button>
        <button data-mode="short">Short summary</button>
        <button data-mode="detailed">Detailed summary</button>
        <button data-mode="keypoints">Key points</button>
        <button data-mode="eli12">Explain like I'm 12</button>
        <button data-mode="flashcards">Flashcards</button>
      </div>
    `;

    floatBtn.querySelectorAll("button[data-mode]").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const mode = btn.dataset.mode;
        runStudy(mode, currentText);
      });
    });

    // Toggle menu
    const main = floatBtn.querySelector(".lumen-study-fab-main");
    main.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      floatBtn.classList.toggle("open");
    });

    document.body.appendChild(floatBtn);
  }

  // ---------- Result card ----------
  function removeCard() {
    if (card) {
      card.remove();
      card = null;
    }
  }

  function createCardShell(titleText, mode) {
    removeCard();
    card = document.createElement("div");
    card.className = "lumen-study-ui lumen-study-card";
    card.innerHTML = `
      <div class="lsc-head">
        <div class="lsc-title">
          <span class="lsc-dot lsc-dot-${mode}"></span>
          <span class="lsc-title-text">${escapeHtml(titleText)}</span>
        </div>
        <div class="lsc-head-actions">
          <button class="lsc-icon-btn" data-act="save" title="Save to library">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button class="lsc-icon-btn" data-act="copy" title="Copy">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="lsc-icon-btn lsc-close" data-act="close" title="Close">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="lsc-body">
        <div class="lsc-loading">
          <div class="lsc-spinner"></div>
          <span>Thinking…</span>
        </div>
      </div>
    `;

    // Position: centered top-right of viewport
    card.style.top = window.scrollY + 24 + "px";
    card.style.right = "24px";

    // Button handlers
    card.querySelector("[data-act='close']").addEventListener("click", removeCard);

    document.body.appendChild(card);
    makeDraggable(card);
  }

  function makeDraggable(el) {
    const head = el.querySelector(".lsc-head");
    let isDown = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    head.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      isDown = true;
      const rect = el.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      el.style.right = "auto";
      el.style.left = startLeft + "px";
      el.style.top = window.scrollY + startTop + "px";
      head.style.cursor = "grabbing";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = startLeft + dx + "px";
      el.style.top = window.scrollY + startTop + dy + "px";
    });

    document.addEventListener("mouseup", () => {
      if (!isDown) return;
      isDown = false;
      head.style.cursor = "grab";
    });
  }

  function renderResult(result, mode, sourceText) {
    if (!card) return;
    const body = card.querySelector(".lsc-body");

    if (result.type === "text") {
      body.innerHTML = `<div class="lsc-text">${escapeHtml(result.text).replace(/\n\n/g, "</p><p>").replace(/^/, "<p>").replace(/$/, "</p>")}</div>`;
    } else if (result.type === "list") {
      const items = result.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
      body.innerHTML = `<ul class="lsc-list">${items}</ul>`;
    } else if (result.type === "flashcards") {
      if (!result.cards.length) {
        body.innerHTML = `<div class="lsc-text lsc-error">Couldn't parse flashcards. Try a longer passage.</div>`;
      } else {
        renderFlashcards(body, result.cards);
      }
    }

    // Wire copy & save buttons now that we have content
    const copyBtn = card.querySelector("[data-act='copy']");
    copyBtn.onclick = () => {
      let txt = "";
      if (result.type === "text") txt = result.text;
      else if (result.type === "list") txt = result.items.map((i) => "• " + i).join("\n");
      else if (result.type === "flashcards") txt = result.cards.map((c) => `Q: ${c.front}\nA: ${c.back}`).join("\n\n");
      navigator.clipboard.writeText(txt).catch(() => {});
      flashButton(copyBtn);
    };

    const saveBtn = card.querySelector("[data-act='save']");
    saveBtn.onclick = async () => {
      await saveToLibrary({
        id: "ls_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
        mode,
        result,
        sourceText: sourceText.slice(0, 1200),
        url: PAGE_URL,
        title: PAGE_TITLE,
        createdAt: Date.now()
      });
      flashButton(saveBtn);
    };
  }

  function flashButton(btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    btn.classList.add("lsc-success");
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.remove("lsc-success");
    }, 900);
  }

  function renderFlashcards(body, cards) {
    let index = 0;
    let flipped = false;

    function draw() {
      const c = cards[index];
      body.innerHTML = `
        <div class="lsc-fc-wrap">
          <div class="lsc-fc ${flipped ? "flipped" : ""}">
            <div class="lsc-fc-face lsc-fc-front">
              <div class="lsc-fc-label">Question</div>
              <div class="lsc-fc-content">${escapeHtml(c.front)}</div>
              <div class="lsc-fc-hint">Click to reveal answer</div>
            </div>
            <div class="lsc-fc-face lsc-fc-back">
              <div class="lsc-fc-label">Answer</div>
              <div class="lsc-fc-content">${escapeHtml(c.back)}</div>
              <div class="lsc-fc-hint">Click to see question</div>
            </div>
          </div>
          <div class="lsc-fc-nav">
            <button class="lsc-fc-btn" data-fc="prev" ${index === 0 ? "disabled" : ""}>←</button>
            <span class="lsc-fc-count">${index + 1} / ${cards.length}</span>
            <button class="lsc-fc-btn" data-fc="next" ${index === cards.length - 1 ? "disabled" : ""}>→</button>
          </div>
        </div>
      `;

      body.querySelector(".lsc-fc").addEventListener("click", () => {
        flipped = !flipped;
        draw();
      });
      const prev = body.querySelector("[data-fc='prev']");
      const next = body.querySelector("[data-fc='next']");
      if (prev) prev.addEventListener("click", (e) => {
        e.stopPropagation();
        if (index > 0) { index--; flipped = false; draw(); }
      });
      if (next) next.addEventListener("click", (e) => {
        e.stopPropagation();
        if (index < cards.length - 1) { index++; flipped = false; draw(); }
      });
    }

    draw();
  }

  function renderError(errMsg) {
    if (!card) return;
    const body = card.querySelector(".lsc-body");

    if (errMsg && errMsg.startsWith("NO_KEY:")) {
      const provider = errMsg.split(":")[1];
      body.innerHTML = `
        <div class="lsc-error">
          <div class="lsc-error-title">No API key yet</div>
          <p>You need to add your ${provider === "anthropic" ? "Anthropic" : "OpenAI"} API key to use Lumen Study.</p>
          <button class="lsc-primary-btn" id="lsc-open-options">Open settings</button>
        </div>
      `;
      body.querySelector("#lsc-open-options").addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "openOptions" });
      });
    } else {
      body.innerHTML = `
        <div class="lsc-error">
          <div class="lsc-error-title">Something went wrong</div>
          <p>${escapeHtml(errMsg || "Unknown error")}</p>
        </div>
      `;
    }
  }

  // ---------- Main action ----------
  async function runStudy(mode, text) {
    removeFloatBtn();

    // Use current selection if text wasn't captured
    if (!text || text.length < 10) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) text = sel.toString().trim();
    }

    if (!text || text.length < 10) {
      alert("Please select at least a sentence or two of text first.");
      return;
    }

    const titles = {
      tldr: "TL;DR",
      short: "Short summary",
      detailed: "Detailed summary",
      keypoints: "Key points",
      eli12: "Explain like I'm 12",
      flashcards: "Flashcards"
    };

    createCardShell(titles[mode] || "Summary", mode);

    try {
      const response = await chrome.runtime.sendMessage({
        action: "studyRequest",
        mode,
        text
      });

      if (response && response.ok) {
        renderResult(response.result, mode, text);
      } else {
        renderError(response?.error || "No response from background");
      }
    } catch (err) {
      renderError(err.message || String(err));
    }
  }

  // ---------- Library (saved summaries) ----------
  async function saveToLibrary(entry) {
    return new Promise((resolve) => {
      chrome.storage.local.get({ studyLibrary: [] }, (res) => {
        const lib = res.studyLibrary || [];
        lib.unshift(entry);
        // Cap at 500 entries
        const capped = lib.slice(0, 500);
        chrome.storage.local.set({ studyLibrary: capped }, () => {
          chrome.runtime.sendMessage({ action: "savedUpdated" }).catch(() => {});
          resolve();
        });
      });
    });
  }

  // ---------- Selection listeners ----------
  document.addEventListener("mouseup", (e) => {
    if (e.target.closest && e.target.closest(".lumen-study-ui")) return;
    // Don't conflict with Lumen highlighter's toolbar
    if (e.target.closest && e.target.closest(".lumen-ui")) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 10) {
        showFloatBtn(sel);
      } else {
        removeFloatBtn();
      }
    }, 12);
  });

  document.addEventListener("mousedown", (e) => {
    if (e.target.closest && e.target.closest(".lumen-study-ui")) return;
    removeFloatBtn();
  });

  document.addEventListener("scroll", () => removeFloatBtn(), { passive: true });

  // Listen for messages from background (context menu / shortcut)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "runStudyMode") {
      let text = msg.selectedText || "";
      if (!text) {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) text = sel.toString().trim();
      }
      runStudy(msg.mode, text);
      sendResponse({ ok: true });
    }
    return true;
  });

  // ---------- Utility ----------
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
