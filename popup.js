// Popup script for Lumen Study — library view

const MODE_LABELS = {
  tldr: "TL;DR",
  short: "Short summary",
  detailed: "Detailed summary",
  keypoints: "Key points",
  eli12: "Explain like I'm 12",
  flashcards: "Flashcards"
};

let currentFilter = "all";
let searchQuery = "";
let library = [];

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function getPreview(entry) {
  const r = entry.result;
  if (!r) return "";
  if (r.type === "text") return r.text;
  if (r.type === "list") return r.items.join(" • ");
  if (r.type === "flashcards") {
    return r.cards.map((c) => c.front).slice(0, 2).join(" · ");
  }
  return "";
}

async function loadLibrary() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ studyLibrary: [] }, (res) => {
      library = res.studyLibrary || [];
      resolve();
    });
  });
}

function filtered() {
  let items = library;
  if (currentFilter !== "all") {
    items = items.filter((e) => e.mode === currentFilter);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    items = items.filter((e) => {
      const preview = getPreview(e).toLowerCase();
      const title = (e.title || "").toLowerCase();
      const src = (e.sourceText || "").toLowerCase();
      return preview.includes(q) || title.includes(q) || src.includes(q);
    });
  }
  return items;
}

function render() {
  document.getElementById("totalCount").textContent = library.length;
  const content = document.getElementById("content");
  const empty = document.getElementById("empty");
  content.querySelectorAll(".study-card").forEach((n) => n.remove());

  const items = filtered();

  if (items.length === 0) {
    empty.style.display = "flex";
    if (searchQuery) {
      empty.querySelector("h2").textContent = "No matches";
      empty.querySelector("p").innerHTML = `Nothing found for <em>"${escapeHtml(searchQuery)}"</em>.`;
    } else if (currentFilter !== "all") {
      empty.querySelector("h2").textContent = "Empty in this filter";
      empty.querySelector("p").textContent = "You haven't saved anything of this type yet.";
    } else {
      empty.querySelector("h2").textContent = "Nothing saved yet";
      empty.querySelector("p").innerHTML = `Select any text on a page, tap <em>Study</em>, then hit the bookmark to save it here.`;
    }
    return;
  }

  empty.style.display = "none";

  items.forEach((entry, idx) => {
    const card = document.createElement("div");
    card.className = "study-card";
    card.style.animationDelay = `${Math.min(idx, 6) * 30}ms`;
    const preview = getPreview(entry);

    card.innerHTML = `
      <div class="card-head">
        <span class="dot dot-${entry.mode}"></span>
        <span class="card-mode-label">${MODE_LABELS[entry.mode] || entry.mode}</span>
        <span class="card-time">${timeAgo(entry.createdAt)}</span>
      </div>
      <div class="card-preview">${escapeHtml(preview)}</div>
      <div class="card-source">${escapeHtml(entry.title || getDomain(entry.url))}</div>
    `;
    card.addEventListener("click", () => openModal(entry));
    content.appendChild(card);
  });
}

function openModal(entry) {
  const modal = document.getElementById("modal");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");
  const source = document.getElementById("modalSource");
  const delBtn = document.getElementById("modalDelete");

  title.innerHTML = `<span class="dot dot-${entry.mode}"></span> ${escapeHtml(MODE_LABELS[entry.mode] || entry.mode)}`;

  const r = entry.result;
  let html = "";
  if (r.type === "text") {
    html = `<p>${escapeHtml(r.text).split(/\n\n+/).join("</p><p>")}</p>`;
  } else if (r.type === "list") {
    html = `<ul>${r.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
  } else if (r.type === "flashcards") {
    html = r.cards.map((c) => `
      <div class="fc-preview">
        <div class="q">Q: ${escapeHtml(c.front)}</div>
        <div class="a">A: ${escapeHtml(c.back)}</div>
      </div>
    `).join("");
  }

  if (entry.sourceText) {
    html += `<div class="source-ctx">${escapeHtml(entry.sourceText.slice(0, 400))}${entry.sourceText.length > 400 ? "…" : ""}</div>`;
  }

  body.innerHTML = html;
  source.href = entry.url;
  source.textContent = getDomain(entry.url);

  delBtn.onclick = async () => {
    if (!confirm("Delete this saved entry?")) return;
    library = library.filter((e) => e.id !== entry.id);
    await chrome.storage.local.set({ studyLibrary: library });
    closeModal();
    render();
  };

  modal.style.display = "flex";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}

async function exportAll() {
  if (library.length === 0) {
    alert("Nothing to export yet.");
    return;
  }

  let md = `# My Study Library\n\n*Exported ${new Date().toLocaleDateString()}*\n\n---\n\n`;

  library
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((e) => {
      md += `## ${MODE_LABELS[e.mode] || e.mode} — ${e.title || getDomain(e.url)}\n\n`;
      md += `*Source: [${getDomain(e.url)}](${e.url}) · ${new Date(e.createdAt).toLocaleDateString()}*\n\n`;

      const r = e.result;
      if (r.type === "text") {
        md += r.text + "\n\n";
      } else if (r.type === "list") {
        md += r.items.map((i) => `- ${i}`).join("\n") + "\n\n";
      } else if (r.type === "flashcards") {
        r.cards.forEach((c) => {
          md += `**Q:** ${c.front}\n**A:** ${c.back}\n\n`;
        });
      }
      md += `---\n\n`;
    });

  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lumen-study-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", async () => {
  // Filter chips
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentFilter = chip.dataset.mode;
      render();
    });
  });

  // Search
  document.getElementById("search").addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    render();
  });

  // Modal close
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // Settings
  document.getElementById("settingsBtn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Export
  document.getElementById("exportBtn").addEventListener("click", exportAll);

  // Live updates
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.action === "savedUpdated") {
      await loadLibrary();
      render();
    }
  });

  await loadLibrary();
  render();
});
