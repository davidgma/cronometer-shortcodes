// Listen for extension icon clicks to notify the active Cronometer tab
chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes("cronometer.com")) {
    chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" });
  } else {
    // If not on Cronometer, guide the user there
    chrome.tabs.create({ url: "https://cronometer.com" });
  }
});

// Initialize by fetching the companion default shortcodes JSON file on installation or update
chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get(["shortcodes", "mappings", "drinks", "endings", "extension_version"], (result) => {
    const isNewVersion = result.extension_version !== "1.1.0";

    if (!result.shortcodes || isNewVersion) {
      fetch(chrome.runtime.getURL("shortcodes.json"))
        .then((res) => res.json())
        .then((defaultShortcodes) => {
          // Keep user custom codes, but apply updated/new default shortcodes
          const merged = Object.assign({}, result.shortcodes || {}, defaultShortcodes);
          chrome.storage.local.set({ shortcodes: merged, extension_version: "1.1.0" }, () => {
            console.log("Default shortcodes initialized/updated from shortcodes.json (v1.1.0)");
          });
        })
        .catch((err) => {
          console.error("Error loading default shortcode mapping file:", err);
        });
    }
    if (!result.mappings || isNewVersion) {
      fetch(chrome.runtime.getURL("mappings.json"))
        .then((res) => res.json())
        .then((defaultMappings) => {
          const merged = Object.assign({}, result.mappings || {}, defaultMappings);
          chrome.storage.local.set({ mappings: merged }, () => {
            console.log("Default mappings initialized/updated from mappings.json");
          });
        })
        .catch((err) => {
          console.error("Error loading default mappings mapping file:", err);
        });
    }
    if (!result.drinks || isNewVersion) {
      fetch(chrome.runtime.getURL("drinks.json"))
        .then((res) => res.json())
        .then((defaultDrinks) => {
          chrome.storage.local.set({ drinks: defaultDrinks }, () => {
            console.log("Default drinks initialized from drinks.json");
          });
        })
        .catch((err) => {
          console.error("Error loading default drinks mapping file:", err);
        });
    }
    if (!result.endings || isNewVersion) {
      fetch(chrome.runtime.getURL("endings.json"))
        .then((res) => res.json())
        .then((defaultEndings) => {
          chrome.storage.local.set({ endings: defaultEndings }, () => {
            console.log("Default endings initialized from endings.json");
          });
        })
        .catch((err) => {
          console.error("Error loading default endings mapping file:", err);
        });
    }
  });
});
