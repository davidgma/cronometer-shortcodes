# cronometer-shortcodes

> Cronometer Shortcode Companion — Chrome Extension

This repository contains the production Chrome extension for registering and expanding food logging shortcodes directly in [Cronometer](https://cronometer.com).

## 📦 Extension Structure

- **`manifest.json`**: Chrome Extension Manifest (V3) declaring host permissions for cronometer.com and background triggers.
- **`background.js`**: Background Service Worker handling extension icon clicks to toggle the Cronometer sidebar.
- **`shortcodes.json`**: Editable companion file listing default keyboard triggers, search targets, and physical weights/portions.
- **`mappings.json`**: Editable companion file mapping Cronometer food names to preferred names.
- **`drinks.json`**: Editable companion file listing drinks excluded from weight.
- **`endings.json`**: Editable companion file listing endings removed from names.
- **`content.js`**: Content script injected into Cronometer page. Spawns the sidebar in a Shadow DOM, listens to keyboard shortcodes, and automates input.
- **`content.css`**: Styling for the toggle icon injected directly into the tab.
- **`popup.html`**: The extension toolbar popup index file, rendering a full dashboard to configure and test shortcodes.
- **`popup.js`**: Logic behind the popup settings menu, enabling creating, saving, and deleting custom shortcodes.
- **`icons/icon16.png`**: 16x16 PNG extension icon (browser tab, toolbar, and contextual menu size)
- **`icons/icon48.png`**: 48x48 PNG extension icon (Chrome extensions management page size)
- **`icons/icon128.png`**: 128x128 PNG extension icon (Chrome Web Store and installation display size)

## 🚀 Installation in Chrome

1. Clone or download this repository locally.
2. In Google Chrome, navigate to `chrome://extensions/`.
3. Toggle on **Developer mode** in the top right corner.
4. Click **Load unpacked** and select this repository folder.
5. Open Cronometer (`https://cronometer.com`), navigate to your Diary or Food Search modal, and start typing registered shortcodes!
