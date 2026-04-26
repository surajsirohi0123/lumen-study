// Options page logic

const els = {
  provider: document.querySelectorAll("input[name='provider']"),
  anthropicKey: document.getElementById("anthropicKey"),
  anthropicModel: document.getElementById("anthropicModel"),
  openaiKey: document.getElementById("openaiKey"),
  openaiModel: document.getElementById("openaiModel"),
  saveBtn: document.getElementById("saveBtn"),
  status: document.getElementById("status"),
  anthropicSection: document.getElementById("anthropic-section"),
  openaiSection: document.getElementById("openai-section"),
  toggleAnthropicKey: document.getElementById("toggleAnthropicKey"),
  toggleOpenaiKey: document.getElementById("toggleOpenaiKey")
};

function getSelectedProvider() {
  return Array.from(els.provider).find((r) => r.checked)?.value || "anthropic";
}

function updateVisibleSections() {
  const p = getSelectedProvider();
  els.anthropicSection.classList.toggle("hidden", p !== "anthropic");
  els.openaiSection.classList.toggle("hidden", p !== "openai");
}

function showStatus(text, type = "success") {
  els.status.textContent = text;
  els.status.className = `status show ${type}`;
  setTimeout(() => {
    els.status.classList.remove("show");
  }, 2400);
}

function toggleEye(input, button) {
  button.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
  });
}

async function load() {
  chrome.storage.sync.get(
    {
      provider: "anthropic",
      anthropicKey: "",
      openaiKey: "",
      anthropicModel: "claude-haiku-4-5-20251001",
      openaiModel: "gpt-4o-mini"
    },
    (res) => {
      Array.from(els.provider).forEach((r) => {
        r.checked = r.value === res.provider;
      });
      els.anthropicKey.value = res.anthropicKey || "";
      els.openaiKey.value = res.openaiKey || "";
      els.anthropicModel.value = res.anthropicModel;
      els.openaiModel.value = res.openaiModel;
      updateVisibleSections();
    }
  );
}

function save() {
  const provider = getSelectedProvider();
  const payload = {
    provider,
    anthropicKey: els.anthropicKey.value.trim(),
    openaiKey: els.openaiKey.value.trim(),
    anthropicModel: els.anthropicModel.value,
    openaiModel: els.openaiModel.value
  };

  // Validation
  if (provider === "anthropic" && !payload.anthropicKey) {
    showStatus("Anthropic API key is required", "error");
    return;
  }
  if (provider === "openai" && !payload.openaiKey) {
    showStatus("OpenAI API key is required", "error");
    return;
  }

  chrome.storage.sync.set(payload, () => {
    showStatus("Saved ✓", "success");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  Array.from(els.provider).forEach((r) => {
    r.addEventListener("change", updateVisibleSections);
  });
  els.saveBtn.addEventListener("click", save);
  toggleEye(els.anthropicKey, els.toggleAnthropicKey);
  toggleEye(els.openaiKey, els.toggleOpenaiKey);

  // Save on Enter in key fields
  [els.anthropicKey, els.openaiKey].forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
    });
  });

  load();
});
