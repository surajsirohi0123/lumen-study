# Lumen Study

AI-powered study companion that turns any text you select on the web into summaries, key points, simplified explanations, and flashcards. Designed to pair with Lumen Highlighter for a complete reading + learning workflow.

## Features

- **Six modes on any selection:**
  - **TL;DR** — one-sentence gist
  - **Short summary** — 3-5 bullets
  - **Detailed summary** — 2-3 paragraphs
  - **Key points** — the most test-worthy ideas
  - **Explain like I'm 12** — rewrite dense text in plain language
  - **Flashcards** — auto-generated Q&A cards you can flip through
- **Floating Study button** appears when you select text (below selection, so it doesn't clash with Lumen Highlighter)
- **Right-click menu** — skip the button entirely
- **Keyboard shortcut** — `Cmd/Ctrl + Shift + S` for instant short summary
- **Save to library** — bookmark any summary to revisit later
- **Search & filter** your library by type or keyword
- **Export library** as Markdown for notes apps like Obsidian or Notion
- **Choose your AI** — Anthropic Claude or OpenAI, with your own API key
- **All summaries stored locally** — only the selected passage ever leaves your browser, and only to the provider you chose

## Installation

1. Unzip this folder somewhere on your computer.
2. Open Chrome/Edge/Brave/Arc → `chrome://extensions`
3. Toggle **Developer mode** on (top-right)
4. Click **Load unpacked** and select the `lumen-study` folder
5. Pin Lumen Study to your toolbar

## First-time setup

1. Click the Lumen Study icon → click the gear ⚙ in the footer (or right-click → Options)
2. Pick a provider:
   - **Anthropic Claude** — get a key at [console.anthropic.com](https://console.anthropic.com/settings/keys)
   - **OpenAI** — get a key at [platform.openai.com](https://platform.openai.com/api-keys)
3. Paste your API key and click **Save**

Claude Haiku and GPT-4o-mini are both cheap (pennies per hundreds of summaries) and fast — either is a great default.

## How to use

1. Select any text on any webpage
2. The orange **Study** button appears — click it to see the mode menu
3. Pick a mode; a card slides in with your result
4. Use the card's buttons to **copy**, **save to library**, or **close**
5. Click the extension icon anytime to browse your saved summaries

### Tips for students

- **Flashcards are the biggest leverage** — do a passage, save the cards, flip through them before bed. Active recall beats re-reading.
- **Start with TL;DR, then go deeper** — saves time figuring out if a passage is worth reading in detail.
- **ELI12 on hard paragraphs** — useful for academic papers, legal text, or technical docs above your current level.
- **Export as Markdown** and drop it into Obsidian/Notion for your permanent notes.

## Works great with Lumen Highlighter

If you've installed Lumen Highlighter, both extensions coexist: highlight first (Lumen's toolbar appears above selection), then tap the Study button (appears below selection) to summarize what you just highlighted. Matching aesthetic, no conflicts.

## File structure

```
lumen-study/
├── manifest.json
├── background.js      # AI API calls, context menu, shortcut
├── content.js         # Floating button, result card, flashcards UI
├── content.css
├── popup.html         # Library view
├── popup.css
├── popup.js
├── options.html       # Settings / API keys
├── options.css
├── options.js
└── icons/
```

## Privacy

- **API keys** are stored in Chrome's sync storage (encrypted by Chrome).
- **Saved summaries** are in your browser's local storage — nothing is sent to any server.
- **Selected text** is sent only to your chosen provider (Anthropic or OpenAI), only when you trigger a mode. No third-party analytics, no telemetry.
