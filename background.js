// Background service worker for Lumen Study
// Handles: context menu, keyboard shortcut, AI API requests

const PROMPTS = {
  tldr: (text) => `Summarize the following text in ONE concise sentence (max 25 words). Be direct, no preamble.\n\nTEXT:\n"""${text}"""\n\nTL;DR:`,

  short: (text) => `Summarize the following text as 3-5 short bullet points. Each bullet should be one clear sentence capturing a distinct key idea. Output ONLY the bullets as a JSON array of strings, nothing else.\n\nTEXT:\n"""${text}"""\n\nJSON array:`,

  detailed: (text) => `Write a detailed summary of the following text in 2-3 paragraphs. Preserve key terms, numbers, and nuance. Do not add any information that isn't in the text. Output only the summary, no preamble.\n\nTEXT:\n"""${text}"""\n\nSummary:`,

  keypoints: (text) => `Extract the 3-6 most important key points from the following text. Each point should be a complete, standalone idea. Output ONLY a JSON array of strings, nothing else.\n\nTEXT:\n"""${text}"""\n\nJSON array:`,

  eli12: (text) => `Rewrite the following text so a curious 12-year-old can understand it. Use simple words, short sentences, and concrete analogies where helpful. Keep the meaning accurate. Output only the rewritten explanation, no preamble.\n\nTEXT:\n"""${text}"""\n\nExplanation:`,

  flashcards: (text) => `Create 3-6 flashcards from the following text for active-recall studying. Each flashcard has a "front" (a clear question) and a "back" (a concise accurate answer). Focus on the most test-worthy concepts, definitions, and causal relationships — not trivia. Output ONLY a valid JSON array in the exact format below, nothing else:\n\n[{"front":"question?","back":"answer."},{"front":"...","back":"..."}]\n\nTEXT:\n"""${text}"""\n\nJSON array:`
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        provider: "anthropic",
        anthropicKey: "",
        openaiKey: "",
        anthropicModel: "claude-haiku-4-5-20251001",
        openaiModel: "gpt-4o-mini"
      },
      (res) => resolve(res)
    );
  });
}

async function callAnthropic(prompt, settings) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.anthropicKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: settings.anthropicModel || "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data.content?.[0]?.text || "";
  return content.trim();
}

async function callOpenAI(prompt, settings) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.openaiKey}`
    },
    body: JSON.stringify({
      model: settings.openaiModel || "gpt-4o-mini",
      max_tokens: 1500,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  return content.trim();
}

async function runAI(prompt) {
  const settings = await getSettings();

  if (settings.provider === "anthropic") {
    if (!settings.anthropicKey) {
      throw new Error("NO_KEY:anthropic");
    }
    return await callAnthropic(prompt, settings);
  } else if (settings.provider === "openai") {
    if (!settings.openaiKey) {
      throw new Error("NO_KEY:openai");
    }
    return await callOpenAI(prompt, settings);
  } else {
    throw new Error("No AI provider configured");
  }
}

// Parse JSON with resilience (models sometimes wrap in ```json fences)
function parseJSONLoose(str) {
  if (!str) return null;
  let s = str.trim();
  // Strip code fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  // Find first [ or { and last ] or }
  const firstBracket = Math.min(
    ...[s.indexOf("["), s.indexOf("{")].filter((i) => i >= 0)
  );
  const lastBracket = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    s = s.slice(firstBracket, lastBracket + 1);
  }
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function processRequest(mode, text) {
  if (!text || text.trim().length < 10) {
    throw new Error("Please select at least a few sentences of text.");
  }

  // Truncate very long inputs to avoid runaway cost
  const MAX_CHARS = 12000;
  const trimmed = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "…" : text;

  const prompt = PROMPTS[mode](trimmed);
  const raw = await runAI(prompt);

  // Post-process based on mode
  if (mode === "short" || mode === "keypoints") {
    const parsed = parseJSONLoose(raw);
    if (Array.isArray(parsed)) return { type: "list", items: parsed };
    // Fallback: split by newline/bullet
    const lines = raw
      .split(/\n+/)
      .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
      .filter((l) => l.length > 3);
    return { type: "list", items: lines };
  }

  if (mode === "flashcards") {
    const parsed = parseJSONLoose(raw);
    if (Array.isArray(parsed)) {
      const cards = parsed
        .filter((c) => c && typeof c === "object" && c.front && c.back)
        .map((c) => ({ front: String(c.front), back: String(c.back) }));
      return { type: "flashcards", cards };
    }
    return { type: "flashcards", cards: [] };
  }

  // tldr, detailed, eli12 → plain text
  return { type: "text", text: raw };
}

// ---------- Context menu ----------
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "study-parent",
    title: "Lumen Study",
    contexts: ["selection"]
  });

  const modes = [
    { id: "tldr", label: "TL;DR" },
    { id: "short", label: "Short summary" },
    { id: "detailed", label: "Detailed summary" },
    { id: "keypoints", label: "Key points" },
    { id: "eli12", label: "Explain like I'm 12" },
    { id: "flashcards", label: "Make flashcards" }
  ];

  modes.forEach((m) => {
    chrome.contextMenus.create({
      id: "study-" + m.id,
      parentId: "study-parent",
      title: m.label,
      contexts: ["selection"]
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.menuItemId.startsWith("study-")) return;
  const mode = info.menuItemId.replace("study-", "");
  if (mode === "parent") return;
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: "runStudyMode",
      mode,
      selectedText: info.selectionText || ""
    }).catch(() => {});
  }
});

// Keyboard shortcut — opens the card with short summary by default
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "summarize-selection" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: "runStudyMode",
      mode: "short"
    }).catch(() => {});
  }
});

// Main message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "studyRequest") {
    processRequest(msg.mode, msg.text)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true; // async
  }
  if (msg.action === "openOptions") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.action === "savedUpdated") {
    chrome.runtime.sendMessage(msg).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }
});
