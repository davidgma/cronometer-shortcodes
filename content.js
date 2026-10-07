// Cronometer Shortcode Companion Content Script
(function () {
  if (window.hasCronometerShortcodeCompanion) return;
  window.hasCronometerShortcodeCompanion = true;

  // Global state
  let sidebarEl = null;
  let toggleButtonEl = null;
  let shortcodes = {};
  let mappings = {};
  let drinks = [];
  let endings = [];
  let activeTabId = "log"; // log | manage | mappings | drinks | endings | summary | json
  let activeJsonTabId = "shortcodes"; // shortcodes | mappings | drinks | endings
  let editingKey = null; // For editing shortcodes in sidebar
  let editingMappingKey = null; // For editing mappings
  let editingDrinkKey = null;
  let editingEndingKey = null;
  let isPinned = false; // Is side panel pinned (shifts webpage) or floating
  let scPosition = "right"; // "left" | "right"
  let scWidth = 350; // Sidebar width

  // Fetch data
  function loadShortcodes() {
    chrome.storage.local.get(["shortcodes", "mappings", "drinks", "endings", "sc_pinned", "sc_position", "sc_width"], (result) => {
      if (result.shortcodes) {
        shortcodes = result.shortcodes;
      }
      if (result.mappings) {
        mappings = result.mappings;
      }
      if (result.drinks) {
        drinks = result.drinks;
      }
      if (result.endings) {
        endings = result.endings;
      }
      isPinned = result.sc_pinned || false;
      scPosition = result.sc_position || "right";
      scWidth = result.sc_width || 350;
      updateSidebarViews();
      updatePinnedUI();
    });
  }
  loadShortcodes();

  // Listen for changes in storage
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.shortcodes) {
        shortcodes = changes.shortcodes.newValue || {};
        updateSidebarViews();
      }
      if (changes.mappings) {
        mappings = changes.mappings.newValue || {};
        updateSidebarViews();
      }
      if (changes.drinks) {
        drinks = changes.drinks.newValue || [];
        updateSidebarViews();
      }
      if (changes.endings) {
        endings = changes.endings.newValue || [];
        updateSidebarViews();
      }
      if (changes.sc_pinned !== undefined) {
        isPinned = changes.sc_pinned.newValue || false;
        updatePinnedUI();
      }
      if (changes.sc_position !== undefined) {
        scPosition = changes.sc_position.newValue || "right";
        updatePinnedUI();
      }
      if (changes.sc_width !== undefined) {
        scWidth = changes.sc_width.newValue || 350;
        updatePinnedUI();
      }
    }
  });

  // Create UI elements
  function init() {
    createToggleButton();
    loadStyles();
  }

  function createToggleButton() {
    toggleButtonEl = document.createElement("button");
    toggleButtonEl.id = "cronometer-sc-toggle";
    toggleButtonEl.innerHTML = "⌨️";
    toggleButtonEl.title = "Toggle Cronometer Shortcodes";
    
    // Quick-styles for toggle
    Object.assign(toggleButtonEl.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      width: "48px",
      height: "48px",
      borderRadius: "50%",
      backgroundColor: "#4caf50",
      color: "white",
      border: "none",
      boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
      fontSize: "22px",
      cursor: "pointer",
      zIndex: "999999",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "transform 0.2s ease"
    });

    toggleButtonEl.addEventListener("mouseenter", () => toggleButtonEl.style.transform = "scale(1.08)");
    toggleButtonEl.addEventListener("mouseleave", () => toggleButtonEl.style.transform = "scale(1)");
    toggleButtonEl.addEventListener("click", toggleSidebar);

    document.body.appendChild(toggleButtonEl);
  }

  function createSidebar() {
    sidebarEl = document.createElement("div");
    sidebarEl.id = "cronometer-sc-sidebar";
    // Let updatePinnedUI handle left/right and transform later.
    sidebarEl.dataset.isOpen = "false";
    
    // Style sidebar drawer
    Object.assign(sidebarEl.style, {
      position: "fixed",
      top: "0",
      width: "350px",
      height: "100%",
      backgroundColor: "#1e293b",
      color: "#f8fafc",
      boxShadow: "-4px 0 20px rgba(0,0,0,0.3)",
      zIndex: "999998",
      transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', sans-serif"
    });

    // Sidebar Inner Structure with beautiful 3-tab Navbar
    sidebarEl.innerHTML = `
      <!-- Sidebar Title Header -->
      <div style="padding: 16px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; background-color: #0f172a; shrink: 0;">
        <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: #4caf50; display: flex; align-items: center; gap: 8px;">
          <span>⌨️</span> Shortcode Input Sidebar
        </h3>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="cronometer-sc-position" style="background: none; border: none; display: flex; align-items: center; justify-content: center; padding: 4px; cursor: pointer; transition: background-color 0.2s; border-radius: 4px;" title="Toggle Sidebar Position">
            <svg id="cronometer-sc-position-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color: #94a3b8; transition: transform 0.2s, color 0.2s;">
              <line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <button id="cronometer-sc-pin" style="background: none; border: none; display: flex; align-items: center; justify-content: center; padding: 4px; cursor: pointer; transition: background-color 0.2s; border-radius: 4px;" title="Pin Sidebar">
            <svg id="cronometer-sc-pin-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color: #94a3b8; transition: transform 0.2s, color 0.2s;">
              <line x1="12" y1="17" x2="12" y2="22"></line>
              <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.33-2.9A2 2 0 0 1 15.79 9.9V5a1 1 0 0 0-1-1H9.21a1 1 0 0 0-1 1v4.9a2 2 0 0 1-.44 1.21l-2.33 2.9a2 2 0 0 0-.44 1.24V17Z"></path>
            </svg>
          </button>
          <button id="cronometer-sc-close" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; padding: 4px; line-height: 1; display: flex; align-items: center; justify-content: center;" title="Close Panel">&times;</button>
        </div>
      </div>

      <!-- Tab Buttons Navigation -->
      <div style="display: flex; flex-direction: column; background-color: #0f172a; border-bottom: 1px solid #334155; shrink: 0;">
        <div style="display: flex; width: 100%;">
          <button id="cronometer-sc-tabbtn-log" title="Log Food" style="flex: 1; padding: 12px 6px; background: none; border: none; cursor: pointer; transition: all 0.2s; border-bottom: 2px solid #4caf50; color: #4caf50; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </button>
          <button id="cronometer-sc-tabbtn-manage" title="Manage" style="flex: 1; padding: 12px 6px; background: none; border: none; cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent; color: #94a3b8; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
          </button>
          <button id="cronometer-sc-tabbtn-spreadsheet" title="Spreadsheet output" style="flex: 1; padding: 12px 6px; background: none; border: none; cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent; color: #94a3b8; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><line x1="3" x2="21" y1="9" y2="9" /><line x1="3" x2="21" y1="15" y2="15" /><line x1="9" x2="9" y1="9" y2="21" /><line x1="15" x2="15" y1="9" y2="21" /></svg>
          </button>
          <button id="cronometer-sc-tabbtn-json" title="JSON Text" style="flex: 1; padding: 12px 6px; background: none; border: none; cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent; color: #94a3b8; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
          </button>
        </div>
        <div id="cronometer-sc-secondary-nav" style="display: none; width: 100%; background-color: rgba(15,23,42,0.5); border-top: 1px solid #1e293b;">
          <button id="cronometer-sc-tabbtn-mappings" title="Mappings" style="flex: 1; padding: 8px 6px; background: none; border: none; cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent; color: #94a3b8; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" x2="3" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
          </button>
          <button id="cronometer-sc-tabbtn-drinks" title="Drinks Excluded" style="flex: 1; padding: 8px 6px; background: none; border: none; cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent; color: #94a3b8; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M17 8h1a4 4 0 1 1 0 8h-1"></path><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path><line x1="6" x2="6" y1="2" y2="4"></line><line x1="10" x2="10" y1="2" y2="4"></line><line x1="14" x2="14" y1="2" y2="4"></line></svg>
          </button>
          <button id="cronometer-sc-tabbtn-endings" title="Trim Endings" style="flex: 1; padding: 8px 6px; background: none; border: none; cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent; color: #94a3b8; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><circle cx="6" cy="6" r="3"></circle><path d="M8.12 8.12 12 12"></path><path d="M20 4 8.12 15.88"></path><circle cx="6" cy="18" r="3"></circle><path d="M14.8 14.8 20 20"></path></svg>
          </button>
          <button id="cronometer-sc-tabbtn-water" title="Water Adjustment Calculation" style="flex: 1; padding: 8px 6px; background: none; border: none; cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent; color: #94a3b8; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
          </button>
          <button id="cronometer-sc-tabbtn-summary" title="Generate summary" style="flex: 1; padding: 8px 6px; background: none; border: none; cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent; color: #94a3b8; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </button>
        </div>
      </div>

      <!-- TAB 1: Log Food Pane -->
      <div id="cronometer-sc-tab-log" style="display: flex; flex-direction: column; flex: 1; overflow-y: auto; background-color: #1e293b;">
        <div style="padding: 14px; border-bottom: 1px solid #334155; background-color: rgba(15,23,42,0.15);">
          <label style="display: block; font-size: 10px; color: #94a3b8; margin-bottom: 6px; font-weight: 600;">Shortcode command</label>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="cronometer-sc-input" placeholder="e.g. 2e 1.5b pb" style="flex: 1; padding: 8px 10px; border-radius: 6px; border: 1px solid #475569; background-color: #0f172a; color: white; font-family: monospace; font-size: 13px; outline: none;" />
            <button id="cronometer-sc-log-btn" style="background-color: #4caf50; color: white; border: none; padding: 0 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px;">Log</button>
          </div>
          <p style="margin: 6px 0 0 0; font-size: 10px; color: #64748b; font-style: italic;">
            Syntax: [qty][code] or [code][qty] separated by spaces. E.g. 2.5e or e2.5 (2.5 Eggs), pb (1 Peanut Butter).
          </p>
        </div>

        <div style="padding: 14px; flex: 1; overflow-y: auto;">
          <!-- Automation active banner -->
          <div id="cronometer-sc-active-automation" style="display: none; background-color: #0c4a6e; border: 1px solid #0369a1; padding: 10px; border-radius: 6px; margin-bottom: 14px;">
            <h4 style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; color: #38bdf8;">⚙️ Auto Input Active</h4>
            <div id="cronometer-sc-step" style="font-size: 10px; color: #bae6fd; font-family: monospace;">Ready</div>
          </div>

          <div id="cronometer-sc-list-heading" style="margin-bottom: 8px; font-size: 10px; color: #94a3b8; font-weight: 600; tracking-wider: 0.05em;">Registered Shortcodes</div>
          <div id="cronometer-sc-list" style="display: flex; flex-direction: column; gap: 6px;"></div>
        </div>
      </div>

      <!-- TAB 2: Manage GUI Form Pane -->
      <div id="cronometer-sc-tab-manage" style="display: none; flex-direction: column; flex: 1; overflow-y: auto; padding: 14px; background-color: #1e293b;">
        <!-- Add/Edit form -->
        <div style="background-color: #0f172a; padding: 12px; border-radius: 6px; border: 1px solid #334155; margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h4 id="cronometer-sc-form-header" style="margin: 0; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #94a3b8;">Add New Shortcode</h4>
            <span id="cronometer-sc-form-badge" style="display: none; font-size: 8px; color: #f59e0b; background-color: rgba(245,158,11,0.1); padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(245,158,11,0.2); font-weight: bold;">EDITING</span>
          </div>

          <div style="margin-bottom: 8px;">
            <label style="display: block; font-size: 8px; color: #64748b; margin-bottom: 2px; font-weight: bold;">Shortcode</label>
            <input type="text" id="cronometer-sc-form-code" placeholder="e.g. e" style="width: 100%; box-sizing: border-box; padding: 5px 8px; font-size: 12px; font-family: monospace; background-color: #1e293b; color: white; border: 1px solid #475569; border-radius: 4px; outline: none;" />
            <div id="cronometer-sc-form-code-error" style="display: none; color: #ef4444; font-size: 8px; margin-top: 2px;">Shortcode must be alphabetic.</div>
          </div>

          <div style="margin-bottom: 8px;">
            <label style="display: block; font-size: 8px; color: #64748b; margin-bottom: 2px; font-weight: bold;">Food Name Query</label>
            <input type="text" id="cronometer-sc-form-name" placeholder="e.g. Eggs, Whole" style="width: 100%; box-sizing: border-box; padding: 5px 8px; font-size: 11px; background-color: #1e293b; color: white; border: 1px solid #475569; border-radius: 4px; outline: none;" />
          </div>

          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <div style="flex: 1;">
              <label style="display: block; font-size: 8px; color: #64748b; margin-bottom: 2px; font-weight: bold;">Default Quantity</label>
              <input type="number" id="cronometer-sc-form-qty" value="1" style="width: 100%; box-sizing: border-box; padding: 5px 8px; font-size: 11px; background-color: #1e293b; color: white; border: 1px solid #475569; border-radius: 4px; outline: none; font-family: monospace;" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; font-size: 8px; color: #64748b; margin-bottom: 2px; font-weight: bold;">Unit</label>
              <input type="text" id="cronometer-sc-form-unit" placeholder="g" style="width: 100%; box-sizing: border-box; padding: 5px 8px; font-size: 11px; background-color: #1e293b; color: white; border: 1px solid #475569; border-radius: 4px; outline: none; font-family: monospace;" />
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button id="cronometer-sc-form-cancel" style="display: none; background: none; border: 1px solid #475569; color: #94a3b8; font-size: 11px; font-weight: 500; cursor: pointer; padding: 6px 10px; border-radius: 4px; flex: 1;">Cancel</button>
            <button id="cronometer-sc-form-save" style="background-color: #4caf50; color: white; border: none; font-size: 11px; font-weight: 600; cursor: pointer; padding: 6px 12px; border-radius: 4px; flex: 2;">Create Shortcode</button>
          </div>
        </div>

        <div style="margin-bottom: 6px; font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Edit or Delete entries</div>
        <div id="cronometer-sc-manage-list" style="display: flex; flex-direction: column; gap: 5px;"></div>
      </div>

      <!-- TAB 3: MAPPINGS: Manage Mappings Pane -->
      <div id="cronometer-sc-tab-mappings" style="display: none; flex-direction: column; flex: 1; overflow-y: auto; padding: 14px; background-color: #1e293b;">
        <div style="background-color: #0f172a; padding: 12px; border-radius: 6px; border: 1px solid #334155; margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h4 id="cronometer-sc-mapping-header" style="margin: 0; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #94a3b8;">Add New Mapping</h4>
            <span id="cronometer-sc-mapping-badge" style="display: none; font-size: 8px; color: #f59e0b; background-color: rgba(245,158,11,0.1); padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(245,158,11,0.2); font-weight: bold;">EDITING</span>
          </div>

          <div style="margin-bottom: 8px;">
            <label style="display: block; font-size: 8px; color: #64748b; margin-bottom: 2px; font-weight: bold;">Cronometer Food Name (Source)</label>
            <input type="text" id="cronometer-sc-mapping-source" placeholder="e.g. Mung Beans, Mature Seeds" style="width: 100%; box-sizing: border-box; padding: 5px 8px; font-size: 11px; background-color: #1e293b; color: white; border: 1px solid #475569; border-radius: 4px; outline: none;" />
          </div>

          <div style="margin-bottom: 8px;">
            <label style="display: block; font-size: 8px; color: #64748b; margin-bottom: 2px; font-weight: bold;">Preferred Food Name (Target)</label>
            <input type="text" id="cronometer-sc-mapping-target" placeholder="e.g. Mung Beans" style="width: 100%; box-sizing: border-box; padding: 5px 8px; font-size: 11px; background-color: #1e293b; color: white; border: 1px solid #475569; border-radius: 4px; outline: none;" />
          </div>

          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button id="cronometer-sc-mapping-cancel" style="display: none; background: none; border: 1px solid #475569; color: #94a3b8; font-size: 11px; font-weight: 500; cursor: pointer; padding: 6px 10px; border-radius: 4px; flex: 1;">Cancel</button>
            <button id="cronometer-sc-mapping-save" style="background-color: #4caf50; color: white; border: none; font-size: 11px; font-weight: 600; cursor: pointer; padding: 6px 12px; border-radius: 4px; flex: 2;">Create Mapping</button>
          </div>
        </div>

        <div style="margin-bottom: 6px; font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Edit or Delete existing mappings</div>
        <div id="cronometer-sc-mapping-list" style="display: flex; flex-direction: column; gap: 5px;"></div>
      </div>

      <!-- TAB DRINKS Pane -->
      <div id="cronometer-sc-tab-drinks" style="display: none; flex-direction: column; flex: 1; overflow-y: auto; padding: 14px; background-color: #1e293b;">
        <div style="background-color: #0f172a; padding: 12px; border-radius: 6px; border: 1px solid #334155; margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h4 id="cronometer-sc-drink-header" style="margin: 0; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #94a3b8;">Add New Drink Filter</h4>
            <span id="cronometer-sc-drink-badge" style="display: none; font-size: 8px; color: #f59e0b; background-color: rgba(245,158,11,0.1); padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(245,158,11,0.2); font-weight: bold;">EDITING</span>
          </div>
          <div style="margin-bottom: 8px;">
            <label style="display: block; font-size: 8px; color: #64748b; margin-bottom: 2px; font-weight: bold;">Drink / Liquid Name</label>
            <input type="text" id="cronometer-sc-drink-name" placeholder="e.g. Coffee" style="width: 100%; box-sizing: border-box; padding: 5px 8px; font-size: 11px; background-color: #1e293b; color: white; border: 1px solid #475569; border-radius: 4px; outline: none;" />
          </div>
          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <button id="cronometer-sc-drink-save" style="flex: 2; background-color: #4caf50; color: white; border: none; font-size: 11px; font-weight: 600; cursor: pointer; padding: 6px 12px; border-radius: 4px;">Add Drink</button>
            <button id="cronometer-sc-drink-cancel" style="display: none; flex: 1; background-color: transparent; border: 1px solid #475569; color: #94a3b8; font-size: 11px; font-weight: 600; cursor: pointer; padding: 6px 12px; border-radius: 4px;">Cancel</button>
          </div>
        </div>
        <div style="margin-bottom: 6px; font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Drinks Excluded From Weight</div>
        <div id="cronometer-sc-drink-list" style="display: flex; flex-direction: column; gap: 5px;"></div>
      </div>

      <!-- TAB ENDINGS Pane -->
      <div id="cronometer-sc-tab-endings" style="display: none; flex-direction: column; flex: 1; overflow-y: auto; padding: 14px; background-color: #1e293b;">
        <div style="background-color: #0f172a; padding: 12px; border-radius: 6px; border: 1px solid #334155; margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h4 id="cronometer-sc-ending-header" style="margin: 0; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #94a3b8;">Add Endings To Trim</h4>
            <span id="cronometer-sc-ending-badge" style="display: none; font-size: 8px; color: #f59e0b; background-color: rgba(245,158,11,0.1); padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(245,158,11,0.2); font-weight: bold;">EDITING</span>
          </div>
          <div style="margin-bottom: 8px;">
            <label style="display: block; font-size: 8px; color: #64748b; margin-bottom: 2px; font-weight: bold;">Ending String</label>
            <input type="text" id="cronometer-sc-ending-name" placeholder="e.g. , raw" style="width: 100%; box-sizing: border-box; padding: 5px 8px; font-size: 11px; background-color: #1e293b; color: white; border: 1px solid #475569; border-radius: 4px; outline: none;" />
          </div>
          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <button id="cronometer-sc-ending-save" style="flex: 2; background-color: #4caf50; color: white; border: none; font-size: 11px; font-weight: 600; cursor: pointer; padding: 6px 12px; border-radius: 4px;">Add Ending</button>
            <button id="cronometer-sc-ending-cancel" style="display: none; flex: 1; background-color: transparent; border: 1px solid #475569; color: #94a3b8; font-size: 11px; font-weight: 600; cursor: pointer; padding: 6px 12px; border-radius: 4px;">Cancel</button>
          </div>
        </div>
        <div style="margin-bottom: 6px; font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Endings Trimmed From Names</div>
        <div id="cronometer-sc-ending-list" style="display: flex; flex-direction: column; gap: 5px;"></div>
      </div>

      <!-- TAB: Water Pane -->
      <div id="cronometer-sc-tab-water" style="display: none; flex-direction: column; flex: 1; padding: 14px; background-color: #1e293b; overflow-y: auto;">
        <h4 style="margin: 0 0 10px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #94a3b8;">Water Adjustment Calculation</h4>
        <button id="cronometer-sc-btn-generate-water" style="background-color: #4caf50; color: white; border: none; padding: 10px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11px; margin-bottom: 12px;">Generate Summary</button>
        
        <div id="cronometer-sc-water-result-container" style="display: none; flex-direction: column; flex: 1; background-color: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 9px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Summary Output</span>
            <button id="cronometer-sc-btn-copy-water" style="background-color: #1e293b; color: #4caf50; border: 1px solid #334155; padding: 4px 8px; border-radius: 4px; font-size: 9px; font-weight: 600; cursor: pointer;">Copy</button>
          </div>
          <textarea id="cronometer-sc-water-textarea" readonly style="width: 100%; flex: 1; min-height: 100px; background: transparent; color: #cbd5e1; border: none; font-family: monospace; font-size: 10px; resize: none; outline: none; line-height: 1.4; margin-bottom: 10px;"></textarea>
          
          <label style="font-size: 10px; color: #94a3b8; font-weight: 600; margin-bottom: 4px;">Actual finished weight (g):</label>
          <input type="number" id="cronometer-sc-water-input" placeholder="e.g. 500" style="padding: 6px 8px; border-radius: 4px; border: 1px solid #475569; background-color: #1e293b; color: white; font-family: monospace; font-size: 11px; outline: none; margin-bottom: 8px;" />
          
          <div style="display: flex; justify-content: flex-start; align-items: center; gap: 16px;">
            <div id="cronometer-sc-water-diff" style="font-size: 11px; color: #4caf50; font-weight: bold;"></div>
            <button id="cronometer-sc-btn-log-water" style="display: none; background-color: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 10px;">Log</button>
          </div>
        </div>
      </div>
      
      <!-- TAB 4: Summary Pane -->
      <div id="cronometer-sc-tab-summary" style="display: none; flex-direction: column; flex: 1; padding: 14px; background-color: #1e293b; overflow-y: auto;">
        <h4 style="margin: 0 0 10px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #94a3b8;">Generate summary</h4>
        <p style="margin: 0 0 10px 0; font-size: 10px; color: #64748b; line-height: 14px; font-style: italic;">
          Generates a summary list of the day's foods reading the Cronometer daily log.
        </p>
        <button id="cronometer-sc-btn-generate-summary" style="background-color: #4caf50; color: white; border: none; padding: 10px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11px; margin-bottom: 12px;">Generate Summary</button>
        
        <div id="cronometer-sc-summary-result-container" style="display: none; flex-direction: column; flex: 1; background-color: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 9px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Summary Output</span>
            <button id="cronometer-sc-btn-copy-summary" style="background-color: #1e293b; color: #4caf50; border: 1px solid #334155; padding: 4px 8px; border-radius: 4px; font-size: 9px; font-weight: 600; cursor: pointer;">Copy</button>
          </div>
          <textarea id="cronometer-sc-summary-textarea" readonly style="width: 100%; flex: 1; min-height: 150px; background: transparent; color: #cbd5e1; border: none; font-family: monospace; font-size: 10px; resize: none; outline: none; line-height: 1.4;"></textarea>
        </div>
      </div>

      <!-- TAB 5: JSON Text Sync Pane -->
      <div id="cronometer-sc-tab-json" style="display: none; flex-direction: column; flex: 1; padding: 14px; background-color: #1e293b; overflow-y: auto;">
        <div style="display: flex; width: 100%; border-bottom: 1px solid #334155; margin-bottom: 10px;">
          <button id="cronometer-sc-json-tab-shortcodes" title="Shortcodes" style="flex: 1; padding: 8px 0; background: none; border: none; border-bottom: 2px solid #4caf50; color: #4caf50; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
          </button>
          <button id="cronometer-sc-json-tab-mappings" title="Mappings" style="flex: 1; padding: 8px 0; background: none; border: none; border-bottom: 2px solid transparent; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" x2="3" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
          </button>
          <button id="cronometer-sc-json-tab-drinks" title="Drinks" style="flex: 1; padding: 8px 0; background: none; border: none; border-bottom: 2px solid transparent; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M17 8h1a4 4 0 1 1 0 8h-1"></path><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path><line x1="6" x2="6" y1="2" y2="4"></line><line x1="10" x2="10" y1="2" y2="4"></line><line x1="14" x2="14" y1="2" y2="4"></line></svg>
          </button>
          <button id="cronometer-sc-json-tab-endings" title="Endings" style="flex: 1; padding: 8px 0; background: none; border: none; border-bottom: 2px solid transparent; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><circle cx="6" cy="6" r="3"></circle><path d="M8.12 8.12 12 12"></path><path d="M20 4 8.12 15.88"></path><circle cx="6" cy="18" r="3"></circle><path d="M14.8 14.8 20 20"></path></svg>
          </button>
          <button id="cronometer-sc-json-tab-zip" title="Download Data Zip" style="flex: 1; padding: 8px 0; background: none; border: none; border-bottom: 2px solid transparent; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect width="10" height="5" x="7" y="3"></rect><line x1="12" y1="12" x2="12" y2="16"></line><line x1="10" y1="14" x2="14" y2="14"></line></svg>
          </button>
        </div>
        <div id="cronometer-sc-json-tab-text-container" style="display: flex; flex-direction: column; flex: 1;">
          <p id="cronometer-sc-json-instructions" style="margin: 0 0 10px 0; font-size: 9px; color: #64748b; leading-height: 14px;">
            Copy the raw string text below to update <code style="background: #0f172a; padding: 2px; font-family: monospace;">/src/shortcodes.json</code> directly. You can also paste in your text modifications here and click Apply to update.
          </p>

          <textarea id="cronometer-sc-json-textarea" style="width: 100%; flex: 1; min-height: 200px; box-sizing: border-box; background-color: #0f172a; color: #4caf50; border: 1px solid #334155; border-radius: 6px; padding: 10px; font-family: monospace; font-size: 11px; resize: none; outline: none; line-height: 16px;"></textarea>
          
          <div style="display: flex; gap: 8px; margin-top: 10px; shrink: 0;">
            <button id="cronometer-sc-json-copy" style="flex: 1; background-color: #334155; color: white; border: 1px solid #475569; padding: 10px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11px;">Copy Text</button>
            <button id="cronometer-sc-json-apply" style="flex: 1; background-color: #4caf50; color: white; border: none; padding: 10px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11px;">Apply JSON</button>
          </div>
        </div>

        <div id="cronometer-sc-json-tab-files-container" style="display: none; flex-direction: column; padding-top: 10px; flex: 1;">
          <p style="font-size: 10px; color: #94a3b8; margin-bottom: 14px; line-height: 1.4;">
            Sync all your JSON workspace dictionaries with a local file folder directly via the File System API.
            <br/>
            <span style="color: #eab308; display: inline-block; margin-top: 4px;">Note: Browsers block selecting top-level directories like Downloads. Please create a new subfolder (e.g. "cronometer-data") to select.</span>
          </p>
          <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
            <button id="cronometer-sc-json-files-sel" style="background-color: #1e293b; color: white; border: 1px solid #475569; padding: 10px; border-radius: 6px; font-weight: 500; cursor: pointer; font-size: 11px;">Select Workspace Folder</button>
            <div id="cronometer-sc-json-files-actions" style="display: none; flex-direction: column; gap: 8px;">
              <button id="cronometer-sc-json-files-save" style="background-color: #4caf50; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11px;">Save Settings to Folder</button>
              <button id="cronometer-sc-json-files-load" style="background-color: #3b82f6; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11px;">Load Settings from Folder</button>
            </div>
            <p id="cronometer-sc-json-files-status" style="display: none; font-size: 10px; color: #4caf50; font-weight: bold; text-align: center; margin: 0;"></p>
          </div>
        </div>

        <div id="cronometer-sc-json-error" style="display: none; font-size: 9px; color: #f87171; background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); padding: 8px; border-radius: 4px; margin-top: 8px; word-break: break-all;"></div>
      </div>

      <!-- Footer overlay -->
      <div style="padding: 10px 14px; border-top: 1px solid #334155; background-color: #0f172a; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8; shrink: 0;">
        <span>Configure shortcuts in real-time</span>
        <span style="color: #4caf50; font-weight: bold;">LIVE SIDEBAR</span>
      </div>
      <div id="cronometer-sc-resizer" style="position: absolute; top: 0; bottom: 0; left: -4px; width: 8px; cursor: col-resize; z-index: 999999; background: transparent;"></div>
    `;

    document.body.appendChild(sidebarEl);

    // Resizing logic
    const resizer = sidebarEl.querySelector("#cronometer-sc-resizer");
    let isResizing = false;
    let resizeStartX = 0;
    let resizeStartWidth = 350;

    resizer.addEventListener("mousedown", (e) => {
      isResizing = true;
      resizeStartX = e.clientX;
      resizeStartWidth = parseInt(getComputedStyle(sidebarEl).width, 10);
      document.body.style.cursor = "col-resize";
      if (isPinned) {
        document.body.style.transition = "none";
      }
    });

    document.addEventListener("mousemove", (e) => {
      if (!isResizing) return;
      let delta = scPosition === "left" ? e.clientX - resizeStartX : resizeStartX - e.clientX; 
      let newWidth = resizeStartWidth + delta;
      if (newWidth < 280) newWidth = 280;
      if (newWidth > 800) newWidth = 800;
      sidebarEl.style.width = newWidth + "px";
      
      if (isPinned) {
        if (scPosition === "left") {
          document.body.style.marginLeft = newWidth + "px";
          document.body.style.marginRight = "0px";
        } else {
          document.body.style.marginRight = newWidth + "px";
          document.body.style.marginLeft = "0px";
        }
      }
    });

    document.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = "";
        let finalWidth = parseInt(getComputedStyle(sidebarEl).width, 10);
        chrome.storage.local.set({ sc_width: finalWidth }, () => {
          // Re-enable smooth transition logic inside updatePinnedUI
          // Make sure it runs after state sync
          updatePinnedUI();
        });
      }
    });

    // Sidebar Close Interaction
    sidebarEl.querySelector("#cronometer-sc-close").addEventListener("click", toggleSidebar);

    // Sidebar Pin Interaction
    sidebarEl.querySelector("#cronometer-sc-pin").addEventListener("click", () => {
      chrome.storage.local.set({ sc_pinned: !isPinned });
    });

    // Sidebar Position Toggle
    sidebarEl.querySelector("#cronometer-sc-position").addEventListener("click", () => {
      const newPos = scPosition === "right" ? "left" : "right";
      chrome.storage.local.set({ sc_position: newPos });
    });

    // Tab buttons trigger event listeners
    const tabs = ["log", "manage", "spreadsheet", "json"];
    tabs.forEach(tab => {
      sidebarEl.querySelector("#cronometer-sc-tabbtn-" + tab).addEventListener("click", () => switchTab(tab));
    });

    const secTabs = ["mappings", "drinks", "endings", "summary", "water"];
    secTabs.forEach(tab => {
      sidebarEl.querySelector("#cronometer-sc-tabbtn-" + tab).addEventListener("click", () => switchSecondaryTab(tab));
    });

    // Tab 1 (Log Food) listeners
    sidebarEl.querySelector("#cronometer-sc-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") executeInputs();
    });
    sidebarEl.querySelector("#cronometer-sc-input").addEventListener("input", () => {
      updateTab1Glossary();
    });
    sidebarEl.querySelector("#cronometer-sc-log-btn").addEventListener("click", executeInputs);

    // Tab 2 (Manage) Form listeners
    sidebarEl.querySelector("#cronometer-sc-form-save").addEventListener("click", submitForm);
    sidebarEl.querySelector("#cronometer-sc-form-cancel").addEventListener("click", resetForm);
    sidebarEl.querySelector("#cronometer-sc-form-code").addEventListener("input", updateLookahead);
    sidebarEl.querySelector("#cronometer-sc-form-name").addEventListener("input", updateTab2ManageList);

    // Tab 3 (Mappings) Form listeners
    sidebarEl.querySelector("#cronometer-sc-mapping-save").addEventListener("click", submitMappingForm);
    sidebarEl.querySelector("#cronometer-sc-mapping-cancel").addEventListener("click", resetMappingForm);
    sidebarEl.querySelector("#cronometer-sc-mapping-source").addEventListener("input", updateMappingLookahead);

    // Tab Drinks Form listeners
    sidebarEl.querySelector("#cronometer-sc-drink-save").addEventListener("click", submitDrinkForm);
    sidebarEl.querySelector("#cronometer-sc-drink-cancel").addEventListener("click", resetDrinkForm);
    sidebarEl.querySelector("#cronometer-sc-drink-name").addEventListener("input", updateDrinkLookahead);

    // Tab Endings Form listeners
    sidebarEl.querySelector("#cronometer-sc-ending-save").addEventListener("click", submitEndingForm);
    sidebarEl.querySelector("#cronometer-sc-ending-cancel").addEventListener("click", resetEndingForm);
    sidebarEl.querySelector("#cronometer-sc-ending-name").addEventListener("input", updateEndingLookahead);

    // Tab 4 (Summary) listeners
    sidebarEl.querySelector("#cronometer-sc-btn-generate-summary").addEventListener("click", generateSummary);
    sidebarEl.querySelector("#cronometer-sc-btn-generate-water").addEventListener("click", generateWaterSummary);
    sidebarEl.querySelector("#cronometer-sc-btn-copy-water").addEventListener("click", () => {
      const textarea = sidebarEl.querySelector("#cronometer-sc-water-textarea");
      textarea.select();
      document.execCommand("copy");
      showToast("Water summary copied to clipboard!", "success", 1000, "160px");
    });
        sidebarEl.querySelector("#cronometer-sc-water-input").addEventListener("input", updateWaterDiff);
    sidebarEl.querySelector("#cronometer-sc-btn-log-water").addEventListener("click", async () => {
      const isPositive = currentWaterDiff > 0;
      const foodName = isPositive ? "positive adjustment" : "negative adjustment";
      const amount = Math.round(Math.abs(currentWaterDiff));
      if (amount === 0) {
        showToast("Difference rounds to 0g; nothing to log.", "warning");
        return;
      }
      
      const logBtn = sidebarEl.querySelector("#cronometer-sc-btn-log-water");
      const originalText = logBtn.innerText;
      logBtn.innerText = "Logging...";
      
      try {
        await logFoodItem({ foodName, unit: "g" }, amount);
        showToast("Logged " + foodName + "!", "success");
      } catch (err) {
        showToast("Failed to log", "error");
      } finally {
        logBtn.innerText = originalText;
      }
    });

    sidebarEl.querySelector("#cronometer-sc-btn-copy-summary").addEventListener("click", () => {
      const textarea = sidebarEl.querySelector("#cronometer-sc-summary-textarea");
      textarea.select();
      document.execCommand("copy");
      showToast("Summary copied to clipboard!", "success");
    });

    sidebarEl.querySelector("#cronometer-sc-json-tab-shortcodes").addEventListener("click", () => {
      activeJsonTabId = "shortcodes";
      updateJsonTabContent();
      updateJsonTabHighlight();
    });

    sidebarEl.querySelector("#cronometer-sc-json-tab-mappings").addEventListener("click", () => {
      activeJsonTabId = "mappings";
      updateJsonTabContent();
      updateJsonTabHighlight();
    });

    sidebarEl.querySelector("#cronometer-sc-json-tab-drinks").addEventListener("click", () => {
      activeJsonTabId = "drinks";
      updateJsonTabContent();
      updateJsonTabHighlight();
    });

    sidebarEl.querySelector("#cronometer-sc-json-tab-endings").addEventListener("click", () => {
      activeJsonTabId = "endings";
      updateJsonTabContent();
      updateJsonTabHighlight();
    });

    sidebarEl.querySelector("#cronometer-sc-json-tab-zip").addEventListener("click", () => {
      activeJsonTabId = "files";
      updateJsonTabContent();
      updateJsonTabHighlight();
    });

    let directoryHandle = null;

    sidebarEl.querySelector("#cronometer-sc-json-files-sel").addEventListener("click", async () => {
      try {
        if (typeof window.showDirectoryPicker !== "function") {
          showToast("File System API not supported by browser", "error");
          return;
        }
        directoryHandle = await window.showDirectoryPicker({ 
          mode: 'readwrite',
          id: 'cronometer-json-sync',
          startIn: 'downloads'
        });
        sidebarEl.querySelector("#cronometer-sc-json-files-sel").innerText = "Selected: " + directoryHandle.name;
        sidebarEl.querySelector("#cronometer-sc-json-files-actions").style.display = "flex";
      } catch (err) {
        if (err.name !== 'AbortError') {
          showToast("Failed to select folder", "error");
        }
      }
    });

    sidebarEl.querySelector("#cronometer-sc-json-files-save").addEventListener("click", async () => {
      if (!directoryHandle) return;
      try {
        const saveFile = async (name, data) => {
          const fileHandle = await directoryHandle.getFileHandle(name, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(data, null, 2));
          await writable.close();
        };

        await saveFile("shortcodes.json", shortcodes || {});
        await saveFile("mappings.json", mappings || {});
        await saveFile("drinks.json", drinks || []);
        await saveFile("endings.json", endings || []);

        const statusEl = sidebarEl.querySelector("#cronometer-sc-json-files-status");
        statusEl.innerText = "✓ Saved Successfully";
        statusEl.style.display = "block";
        statusEl.style.color = "#4caf50";
        setTimeout(() => { statusEl.style.display = "none"; }, 2000);
      } catch (err) {
        showToast("Error saving to folder", "error");
        console.error(err);
      }
    });

    sidebarEl.querySelector("#cronometer-sc-json-files-load").addEventListener("click", async () => {
      if (!directoryHandle) return;
      try {
        const loadFile = async (name) => {
          const fileHandle = await directoryHandle.getFileHandle(name);
          const file = await fileHandle.getFile();
          const text = await file.text();
          return JSON.parse(text);
        };

        const loadedShortcodes = await loadFile('shortcodes.json');
        const loadedMappings = await loadFile('mappings.json');
        const loadedDrinks = await loadFile('drinks.json');
        const loadedEndings = await loadFile('endings.json');

        // Check if shapes are somewhat valid dictionaries
        if (typeof loadedShortcodes !== "object" || Array.isArray(loadedShortcodes)) throw new Error("shortcodes.json must be an object");
        if (typeof loadedMappings !== "object" || Array.isArray(loadedMappings)) throw new Error("mappings.json must be an object");
        if (!Array.isArray(loadedDrinks)) throw new Error("drinks.json must be an array");
        if (!Array.isArray(loadedEndings)) throw new Error("endings.json must be an array");

        chrome.storage.local.set({ 
          shortcodes: loadedShortcodes,
          mappings: loadedMappings,
          drinks: loadedDrinks,
          endings: loadedEndings
        }, () => {
          shortcodes = loadedShortcodes;
          mappings = loadedMappings;
          drinks = loadedDrinks;
          endings = loadedEndings;
          
          updateSidebarViews();
          
          const statusEl = sidebarEl.querySelector("#cronometer-sc-json-files-status");
          statusEl.innerText = "✓ Loaded Successfully";
          statusEl.style.display = "block";
          statusEl.style.color = "#3b82f6"; // Blue to distinguish load
          setTimeout(() => { statusEl.style.display = "none"; }, 2000);
        });
      } catch (err) {
        if (err.name === 'NotFoundError') {
           showToast("Missing 1 or more JSON files", "error");
        } else {
           showToast("Failed to load or parse files", "error");
        }
        console.error(err);
      }
    });

    // Tab 3 (JSON) copy and apply triggers
    sidebarEl.querySelector("#cronometer-sc-json-copy").addEventListener("click", () => {
      const textarea = sidebarEl.querySelector("#cronometer-sc-json-textarea");
      textarea.select();
      document.execCommand("copy");
      showToast("JSON copied to clipboard!", "success");
    });

    sidebarEl.querySelector("#cronometer-sc-json-apply").addEventListener("click", () => {
      const text = sidebarEl.querySelector("#cronometer-sc-json-textarea").value;
      const errBox = sidebarEl.querySelector("#cronometer-sc-json-error");
      try {
        const parsed = JSON.parse(text);
        if (activeJsonTabId === "shortcodes" || activeJsonTabId === "mappings") {
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new Error("JSON structure must be an object dictionary.");
          }
        } else {
          if (!Array.isArray(parsed)) {
            throw new Error("JSON structure must be an array of strings.");
          }
        }

        if (activeJsonTabId === "shortcodes") {
          Object.keys(parsed).forEach(k => {
            if (!parsed[k].foodName) {
              throw new Error("Item '" + k + "' is missing a required foodName query field.");
            }
          });
          shortcodes = parsed;
          chrome.storage.local.set({ shortcodes }, () => {
            showToast("Sync success! Synced shortcodes.json.", "success");
            errBox.style.display = "none";
            updateSidebarViews();
          });
        } else if (activeJsonTabId === "mappings") {
          Object.keys(parsed).forEach(k => {
            if (typeof parsed[k] !== "string") {
              throw new Error("Target mapping for '" + k + "' must be a string.");
            }
          });
          mappings = parsed;
          chrome.storage.local.set({ mappings }, () => {
            showToast("Sync success! Synced mappings.json.", "success");
            errBox.style.display = "none";
            updateSidebarViews();
          });
        } else if (activeJsonTabId === "drinks") {
          parsed.forEach(p => {
            if (typeof p !== "string") throw new Error("List must strictly contain strings.");
          });
          drinks = parsed;
          chrome.storage.local.set({ drinks }, () => {
            showToast("Sync success! Synced drinks.json.", "success");
            errBox.style.display = "none";
            updateSidebarViews();
          });
        } else if (activeJsonTabId === "endings") {
          parsed.forEach(p => {
            if (typeof p !== "string") throw new Error("List must strictly contain strings.");
          });
          endings = parsed;
          chrome.storage.local.set({ endings }, () => {
            showToast("Sync success! Synced endings.json.", "success");
            errBox.style.display = "none";
            updateSidebarViews();
          });
        }
      } catch (err) {
        errBox.innerText = "Parse Error: " + err.message;
        errBox.style.display = "block";
      }
    });
  }

  
  let currentWaterDiff = 0;
  function updateWaterDiff() {
    const inputEl = sidebarEl.querySelector("#cronometer-sc-water-input");
    const diffEl = sidebarEl.querySelector("#cronometer-sc-water-diff");
    const logBtn = sidebarEl.querySelector("#cronometer-sc-btn-log-water");
    if (!inputEl || !diffEl) return;
    
    const inputVal = parseFloat(inputEl.value);
    if (isNaN(inputVal)) {
      diffEl.textContent = "";
      if (logBtn) logBtn.style.display = "none";
      return;
    }
    
    currentWaterDiff = inputVal - lastCalculatedWaterWeight;
    let sign = currentWaterDiff > 0 ? "+" : "";
    diffEl.textContent = "Difference: " + sign + currentWaterDiff.toFixed(1) + " g";
    if (logBtn) {
       logBtn.style.display = currentWaterDiff !== 0 ? "block" : "none";
    }
  }

  function generateSummary() {
    const tableRows = document.querySelectorAll("div.diary-row, tr.diary-row, .crono-table tbody tr");
    if (!tableRows || tableRows.length === 0) {
      alert("No diary entries found. Please ensure you are on the Cronometer diary page.");
      return;
    }

    class CronometerDataRow {
      constructor() {
        this.meal = "unknown";
        this.time = "unknown";
        this.type = "food"; // Default to food
        this.name = "unknown";
        this.value = 0;
        this.unit = "unknown";
        this.calories = 0;
      }
    }

    const dataRows = [];
    let currentMeal = "unknown";

    for (const row of Array.from(tableRows)) {
      // Check meal group
      const mealTitleEl = row.querySelector(".diary-group-title");
      if (mealTitleEl && mealTitleEl.textContent) {
        currentMeal = mealTitleEl.textContent.trim();
        continue;
      }

      const tds = row.querySelectorAll("td, div.cell");
      if (!tds || tds.length < 5) continue;

      const dataRow = new CronometerDataRow();
      dataRow.meal = currentMeal;

      const timeEl = row.querySelector(".diary-time") || tds[0];
      if (timeEl && timeEl.textContent) dataRow.time = timeEl.textContent.trim();

      const html = row.innerHTML.toLowerCase();
      if (html.includes("icon-add-biometric") || html.includes("biometric")) dataRow.type = "biometric";
      else if (html.includes("icon-exercise") || html.includes("exercise") || html.includes("-kcal")) dataRow.type = "exercise";
      else if (html.includes("icon-notes") || html.includes("note")) dataRow.type = "note";
      else dataRow.type = "food";

      // Attempt to find the description which is usually the widest text element
      const texts = Array.from(tds).map(td => (td.textContent || "").trim());
      
      let rawName = texts[2] || "unknown";
      // Sometimes it's inside a specific class
      const nameDiv = row.querySelector(".diary-description, .food-name") || tds[2];
      if (nameDiv && nameDiv.textContent) rawName = nameDiv.textContent.trim();

      for (const ending of endings) {
        if (rawName.toLowerCase().endsWith(ending.toLowerCase())) {
          rawName = rawName.substring(0, rawName.length - ending.length);
        }
      }
      
      let foundMapping = mappings[rawName];
      if (!foundMapping) {
        const mKey = Object.keys(mappings).find(k => k.toLowerCase() === rawName.toLowerCase());
        if (mKey) foundMapping = mappings[mKey];
      }
      dataRow.name = foundMapping ? foundMapping : rawName;

      // Extract Value / Unit
      const amtDiv = row.querySelector(".amount, .diary-amount") || tds[3];
      if (amtDiv && amtDiv.textContent) dataRow.value = parseFloat(amtDiv.textContent) || 0;

      const unitDiv = row.querySelector(".unit, .diary-unit") || tds[4];
      if (unitDiv && unitDiv.textContent) dataRow.unit = unitDiv.textContent.trim();

      // Extract Calories
      const calDiv = row.querySelector(".energy, .diary-energy, .calories") || tds[5];
      if (calDiv && calDiv.textContent) dataRow.calories = parseFloat(calDiv.textContent) || 0;
      
      // If we couldn't parse value correctly, try to dig deeper (e.g. inputs inside cells)
      if (dataRow.value === 0 && amtDiv) {
         const input = amtDiv.querySelector("input");
         if (input && input.value) dataRow.value = parseFloat(input.value) || 0;
      }

      dataRows.push(dataRow);
    }

    let foodMap = new Map();
    let weightEaten = 0;
    let caloriesEaten = 0;
    let totalExercise = 0;

    for (const ObjectRow of dataRows) {
      if (ObjectRow.type === "food") {
        let isNegativeAdj = ObjectRow.name.toLowerCase().startsWith('negative adj');
        if (isNegativeAdj) {
          caloriesEaten -= ObjectRow.calories;
        } else {
          caloriesEaten += ObjectRow.calories;
        }
        
        const skipWeight = drinks.some(e => ObjectRow.name.trim().toLowerCase() === e.trim().toLowerCase());
        if (!skipWeight && (ObjectRow.unit === "g" || ObjectRow.unit === "ml" || ObjectRow.unit === "L")) {
          let multiplier = ObjectRow.unit === "L" ? 1000 : 1;
          if (isNegativeAdj) {
            weightEaten -= (ObjectRow.value * multiplier);
          } else {
            weightEaten += (ObjectRow.value * multiplier);
          }
        }

        const mapKey = ObjectRow.name + "|" + ObjectRow.time + "|" + ObjectRow.unit;
        if (!foodMap.has(mapKey)) {
          foodMap.set(mapKey, Object.assign({}, ObjectRow));
        } else {
          let existing = foodMap.get(mapKey);
          existing.value += ObjectRow.value;
          existing.calories += ObjectRow.calories;
        }
      } else if (ObjectRow.type === "exercise") {
        totalExercise += (ObjectRow.calories * -1); 
      }
    }

    let finalFoods = Array.from(foodMap.values());
    finalFoods.sort((a, b) => {
      if (a.time < b.time) return -1;
      if (a.time > b.time) return 1;
      const lowerA = a.name.toLowerCase();
      const lowerB = b.name.toLowerCase();
      if (lowerA < lowerB) return -1;
      if (lowerA > lowerB) return 1;
      return 0;
    });

    let output = [];
    for (const f of finalFoods) {
      // Ensure specific string format "L-glutamine (5g 09:20 )"
      output.push(f.name + " (" + f.value + f.unit + " " + f.time + " )");
    }

    const kcalPerG = weightEaten > 0 ? (caloriesEaten / weightEaten).toFixed(1) : "0.0";
    const netCalories = caloriesEaten - totalExercise;

    output.push("Weight eaten: " + Math.round(weightEaten) + " g");
    output.push("Calories eaten: " + Math.round(caloriesEaten) + " kCal");
    output.push("kcal/g: " + kcalPerG);
    output.push("Total exercise: " + Math.round(totalExercise) + " kCal");
    output.push("Net calories: " + Math.round(netCalories) + " kCal");

    
    // Extra summary: Macronutrient percentages
    let fatPercent = "0%", carbsPercent = "0%", proteinPercent = "0%";
    const getPercent = (className) => {
      const titleDiv = document.querySelector("div." + className + ".totals-title");
      if (titleDiv && titleDiv.parentElement) {
        const percentDiv = titleDiv.parentElement.querySelector("div.totals-percent");
        if (percentDiv) return percentDiv.textContent.trim();
      }
      return "0%";
    };
    fatPercent = getPercent("fat");
    carbsPercent = getPercent("carbs");
    proteinPercent = getPercent("protein");
    output.push("Fat " + fatPercent + ", Carbs " + carbsPercent + ", Protein " + proteinPercent);

    // Extra summary: Saturated fat
    let satFat = "0g";
    const nutrientNames = Array.from(document.querySelectorAll("div.nutrient-name"));
    const satFatDiv = nutrientNames.find(div => div.textContent.includes("Saturated"));
    if (satFatDiv) {
      const parentTd = satFatDiv.closest("td");
      if (parentTd) {
        const valueTd = parentTd.parentElement.querySelector("td.targets-table-number");
        if (valueTd) {
          satFat = valueTd.textContent.trim() + "g";
        }
      }
    }
    output.push("Saturated fat: " + satFat);

    const finalString = output.join("\n");
    
    const textArea = sidebarEl.querySelector("#cronometer-sc-summary-textarea");
    const container = sidebarEl.querySelector("#cronometer-sc-summary-result-container");
    if(textArea && container) {
      container.style.display = "flex";
      textArea.value = finalString;
      
      try {
        navigator.clipboard.writeText(finalString);
        showToast("Summary generated and copied to clipboard!", "success", 1000);
      } catch(e) {
        textArea.select();
        document.execCommand("copy");
        showToast("Summary generated and copied to clipboard!", "success", 1000);
      }
    }
  }
  let lastCalculatedWaterWeight = 0;
function generateWaterSummary() {
    const tableRows = document.querySelectorAll("div.diary-row.select, tr.diary-row.select, .crono-table tbody tr.select");
    if (!tableRows || tableRows.length === 0) {
      alert("No diary entries found. Please ensure you are on the Cronometer diary page.");
      return;
    }

    class CronometerDataRow {
      constructor() {
        this.meal = "unknown";
        this.time = "unknown";
        this.type = "food"; // Default to food
        this.name = "unknown";
        this.value = 0;
        this.unit = "unknown";
        this.calories = 0;
      }
    }

    const dataRows = [];
    let currentMeal = "unknown";

    for (const row of Array.from(tableRows)) {
      // Check meal group
      const mealTitleEl = row.querySelector(".diary-group-title");
      if (mealTitleEl && mealTitleEl.textContent) {
        currentMeal = mealTitleEl.textContent.trim();
        continue;
      }

      const tds = row.querySelectorAll("td, div.cell");
      if (!tds || tds.length < 5) continue;

      const dataRow = new CronometerDataRow();
      dataRow.meal = currentMeal;

      const timeEl = row.querySelector(".diary-time") || tds[0];
      if (timeEl && timeEl.textContent) dataRow.time = timeEl.textContent.trim();

      const html = row.innerHTML.toLowerCase();
      if (html.includes("icon-add-biometric") || html.includes("biometric")) dataRow.type = "biometric";
      else if (html.includes("icon-exercise") || html.includes("exercise") || html.includes("-kcal")) dataRow.type = "exercise";
      else if (html.includes("icon-notes") || html.includes("note")) dataRow.type = "note";
      else dataRow.type = "food";

      // Attempt to find the description which is usually the widest text element
      const texts = Array.from(tds).map(td => (td.textContent || "").trim());
      
      let rawName = texts[2] || "unknown";
      // Sometimes it's inside a specific class
      const nameDiv = row.querySelector(".diary-description, .food-name") || tds[2];
      if (nameDiv && nameDiv.textContent) rawName = nameDiv.textContent.trim();

      for (const ending of endings) {
        if (rawName.toLowerCase().endsWith(ending.toLowerCase())) {
          rawName = rawName.substring(0, rawName.length - ending.length);
        }
      }
      
      let foundMapping = mappings[rawName];
      if (!foundMapping) {
        const mKey = Object.keys(mappings).find(k => k.toLowerCase() === rawName.toLowerCase());
        if (mKey) foundMapping = mappings[mKey];
      }
      dataRow.name = foundMapping ? foundMapping : rawName;

      // Extract Value / Unit
      const amtDiv = row.querySelector(".amount, .diary-amount") || tds[3];
      if (amtDiv && amtDiv.textContent) dataRow.value = parseFloat(amtDiv.textContent) || 0;

      const unitDiv = row.querySelector(".unit, .diary-unit") || tds[4];
      if (unitDiv && unitDiv.textContent) dataRow.unit = unitDiv.textContent.trim();

      // Extract Calories
      const calDiv = row.querySelector(".energy, .diary-energy, .calories") || tds[5];
      if (calDiv && calDiv.textContent) dataRow.calories = parseFloat(calDiv.textContent) || 0;
      
      // If we couldn't parse value correctly, try to dig deeper (e.g. inputs inside cells)
      if (dataRow.value === 0 && amtDiv) {
         const input = amtDiv.querySelector("input");
         if (input && input.value) dataRow.value = parseFloat(input.value) || 0;
      }

      dataRows.push(dataRow);
    }

    let foodMap = new Map();
    let weightEaten = 0;
    let caloriesEaten = 0;
    let totalExercise = 0;

    for (const ObjectRow of dataRows) {
      if (ObjectRow.type === "food") {
        let isNegativeAdj = ObjectRow.name.toLowerCase().startsWith('negative adj');
        if (isNegativeAdj) {
          caloriesEaten -= ObjectRow.calories;
        } else {
          caloriesEaten += ObjectRow.calories;
        }
        
        const skipWeight = drinks.some(e => ObjectRow.name.trim().toLowerCase() === e.trim().toLowerCase());
        if (!skipWeight && (ObjectRow.unit === "g" || ObjectRow.unit === "ml" || ObjectRow.unit === "L")) {
          let multiplier = ObjectRow.unit === "L" ? 1000 : 1;
          if (isNegativeAdj) {
            weightEaten -= (ObjectRow.value * multiplier);
          } else {
            weightEaten += (ObjectRow.value * multiplier);
          }
        }

        const mapKey = ObjectRow.name + "|" + ObjectRow.time + "|" + ObjectRow.unit;
        if (!foodMap.has(mapKey)) {
          foodMap.set(mapKey, Object.assign({}, ObjectRow));
        } else {
          let existing = foodMap.get(mapKey);
          existing.value += ObjectRow.value;
          existing.calories += ObjectRow.calories;
        }
      } else if (ObjectRow.type === "exercise") {
        totalExercise += (ObjectRow.calories * -1); 
      }
    }

    let finalFoods = Array.from(foodMap.values());
    finalFoods.sort((a, b) => {
      if (a.time < b.time) return -1;
      if (a.time > b.time) return 1;
      const lowerA = a.name.toLowerCase();
      const lowerB = b.name.toLowerCase();
      if (lowerA < lowerB) return -1;
      if (lowerA > lowerB) return 1;
      return 0;
    });

    let output = [];
    for (const f of finalFoods) {
      // Ensure specific string format "L-glutamine (5g 09:20 )"
      output.push(f.name + " (" + f.value + f.unit + " " + f.time + " )");
    }

    const kcalPerG = weightEaten > 0 ? (caloriesEaten / weightEaten).toFixed(1) : "0.0";
    const netCalories = caloriesEaten - totalExercise;

    output.push("Weight eaten: " + Math.round(weightEaten) + " g");
    output.push("Calories eaten: " + Math.round(caloriesEaten) + " kCal");
    output.push("kcal/g: " + kcalPerG);
    output.push("Total exercise: " + Math.round(totalExercise) + " kCal");
    output.push("Net calories: " + Math.round(netCalories) + " kCal");

    
    // Extra summary: Macronutrient percentages
    let fatPercent = "0%", carbsPercent = "0%", proteinPercent = "0%";
    const getPercent = (className) => {
      const titleDiv = document.querySelector("div." + className + ".totals-title");
      if (titleDiv && titleDiv.parentElement) {
        const percentDiv = titleDiv.parentElement.querySelector("div.totals-percent");
        if (percentDiv) return percentDiv.textContent.trim();
      }
      return "0%";
    };
    fatPercent = getPercent("fat");
    carbsPercent = getPercent("carbs");
    proteinPercent = getPercent("protein");
    output.push("Fat " + fatPercent + ", Carbs " + carbsPercent + ", Protein " + proteinPercent);

    // Extra summary: Saturated fat
    let satFat = "0g";
    const nutrientNames = Array.from(document.querySelectorAll("div.nutrient-name"));
    const satFatDiv = nutrientNames.find(div => div.textContent.includes("Saturated"));
    if (satFatDiv) {
      const parentTd = satFatDiv.closest("td");
      if (parentTd) {
        const valueTd = parentTd.parentElement.querySelector("td.targets-table-number");
        if (valueTd) {
          satFat = valueTd.textContent.trim() + "g";
        }
      }
    }
    output.push("Saturated fat: " + satFat);

    const finalString = output.join("\n");
    
    const textArea = sidebarEl.querySelector("#cronometer-sc-water-textarea");
    lastCalculatedWaterWeight = weightEaten;
    updateWaterDiff();
    const container = sidebarEl.querySelector("#cronometer-sc-water-result-container");
    if(textArea && container) {
      container.style.display = "flex";
      textArea.value = finalString;
      
      try {
        navigator.clipboard.writeText(finalString);
        showToast("Summary generated and copied to clipboard!", "success", 1000, "160px");
      } catch(e) {
        textArea.select();
        document.execCommand("copy");
        showToast("Summary generated and copied to clipboard!", "success", 1000, "160px");
      }
      
      setTimeout(() => {
        const waterInput = sidebarEl.querySelector("#cronometer-sc-water-input");
        if (waterInput) {
          waterInput.focus();
        }
      }, 50);
    }
  }

  let activeSecondaryTabId = "summary";

  // Switch tabs in sidebar UI
  function switchTab(tabId) {
    if (tabId === "spreadsheet") {
      activeTabId = "spreadsheet";
      if (sidebarEl.querySelector("#cronometer-sc-secondary-nav")) {
        sidebarEl.querySelector("#cronometer-sc-secondary-nav").style.display = "flex";
      }
      switchSecondaryTab(activeSecondaryTabId);
      return;
    }
    
    if (["mappings", "drinks", "endings", "summary", "water"].includes(tabId)) {
      switchSecondaryTab(tabId);
      return;
    }

    activeTabId = tabId;
    if (sidebarEl.querySelector("#cronometer-sc-secondary-nav")) {
      sidebarEl.querySelector("#cronometer-sc-secondary-nav").style.display = "none";
    }

    sidebarEl.querySelector("#cronometer-sc-tab-log").style.display = tabId === "log" ? "flex" : "none";
    sidebarEl.querySelector("#cronometer-sc-tab-manage").style.display = tabId === "manage" ? "flex" : "none";
    sidebarEl.querySelector("#cronometer-sc-tab-mappings").style.display = "none";
    if (sidebarEl.querySelector("#cronometer-sc-tab-drinks")) sidebarEl.querySelector("#cronometer-sc-tab-drinks").style.display = "none";
    if (sidebarEl.querySelector("#cronometer-sc-tab-endings")) sidebarEl.querySelector("#cronometer-sc-tab-endings").style.display = "none";
    sidebarEl.querySelector("#cronometer-sc-tab-summary").style.display = "none";
    sidebarEl.querySelector("#cronometer-sc-tab-water").style.display = "none";
    sidebarEl.querySelector("#cronometer-sc-tab-json").style.display = tabId === "json" ? "flex" : "none";

    if (tabId === "log") {
      setTimeout(() => sidebarEl.querySelector("#cronometer-sc-input")?.focus(), 10);
    } else if (tabId === "manage") {
      setTimeout(() => sidebarEl.querySelector("#cronometer-sc-form-code")?.focus(), 10);
    }

    // Set buttons visual states
    const mainTabs = ["log", "manage", "spreadsheet", "json"];
    mainTabs.forEach(t => {
      const btn = sidebarEl.querySelector("#cronometer-sc-tabbtn-" + t);
      if (btn) {
        if (t === tabId) {
          btn.style.color = "#4caf50";
          btn.style.borderBottom = "2px solid #4caf50";
          btn.style.fontWeight = "600";
        } else {
          btn.style.color = "#94a3b8";
          btn.style.borderBottom = "2px solid transparent";
          btn.style.fontWeight = "500";
        }
      }
    });

    if (tabId === "json") {
      updateJsonTabContent();
    }
  }

  function switchSecondaryTab(tabId) {
    activeSecondaryTabId = tabId;
    activeTabId = "spreadsheet";

    if (sidebarEl.querySelector("#cronometer-sc-secondary-nav")) {
      sidebarEl.querySelector("#cronometer-sc-secondary-nav").style.display = "flex";
    }

    sidebarEl.querySelector("#cronometer-sc-tab-log").style.display = "none";
    sidebarEl.querySelector("#cronometer-sc-tab-manage").style.display = "none";
    sidebarEl.querySelector("#cronometer-sc-tab-mappings").style.display = tabId === "mappings" ? "flex" : "none";
    if (sidebarEl.querySelector("#cronometer-sc-tab-drinks")) sidebarEl.querySelector("#cronometer-sc-tab-drinks").style.display = tabId === "drinks" ? "flex" : "none";
    if (sidebarEl.querySelector("#cronometer-sc-tab-endings")) sidebarEl.querySelector("#cronometer-sc-tab-endings").style.display = tabId === "endings" ? "flex" : "none";
    sidebarEl.querySelector("#cronometer-sc-tab-summary").style.display = tabId === "summary" ? "flex" : "none";
    sidebarEl.querySelector("#cronometer-sc-tab-water").style.display = tabId === "water" ? "flex" : "none";
    sidebarEl.querySelector("#cronometer-sc-tab-json").style.display = "none";

    if (tabId === "mappings") {
      setTimeout(() => sidebarEl.querySelector("#cronometer-sc-mapping-source")?.focus(), 10);
    } else if (tabId === "drinks") {
      setTimeout(() => sidebarEl.querySelector("#cronometer-sc-drink-name")?.focus(), 10);
    } else if (tabId === "endings") {
      setTimeout(() => sidebarEl.querySelector("#cronometer-sc-ending-name")?.focus(), 10);
    }

    const mainTabs = ["log", "manage", "spreadsheet", "json"];
    mainTabs.forEach(t => {
      const btn = sidebarEl.querySelector("#cronometer-sc-tabbtn-" + t);
      if (btn) {
        if (t === "spreadsheet") {
          btn.style.color = "#4caf50";
          btn.style.borderBottom = "2px solid #4caf50";
          btn.style.fontWeight = "600";
        } else {
          btn.style.color = "#94a3b8";
          btn.style.borderBottom = "2px solid transparent";
          btn.style.fontWeight = "500";
        }
      }
    });

    const secTabs = ["mappings", "drinks", "endings", "summary"];
    secTabs.forEach(t => {
      const btn = sidebarEl.querySelector("#cronometer-sc-tabbtn-" + t);
      if (btn) {
        if (t === tabId) {
          btn.style.color = "#22d3ee";
          btn.style.borderBottom = "2px solid #22d3ee";
        } else {
          btn.style.color = "#64748b";
          btn.style.borderBottom = "2px solid transparent";
        }
      }
    });
  }

  function updateJsonTabContent() {
    const textContainer = sidebarEl.querySelector("#cronometer-sc-json-tab-text-container");
    const filesContainer = sidebarEl.querySelector("#cronometer-sc-json-tab-files-container");

    if (activeJsonTabId === "files") {
      textContainer.style.display = "none";
      filesContainer.style.display = "flex";
    } else {
      textContainer.style.display = "flex";
      filesContainer.style.display = "none";
      if (activeJsonTabId === "shortcodes") {
        sidebarEl.querySelector("#cronometer-sc-json-textarea").value = JSON.stringify(shortcodes, null, 2);
        sidebarEl.querySelector("#cronometer-sc-json-instructions").innerHTML = 'Copy the raw string text below to update <code style="background: #0f172a; padding: 2px; font-family: monospace;">/src/shortcodes.json</code> directly. You can also paste in your text modifications here and click Apply to update.<br />Item count: ' + Object.keys(shortcodes || {}).length;
      } else if (activeJsonTabId === "mappings") {
        sidebarEl.querySelector("#cronometer-sc-json-textarea").value = JSON.stringify(mappings, null, 2);
        sidebarEl.querySelector("#cronometer-sc-json-instructions").innerHTML = 'Copy the raw string text below to update <code style="background: #0f172a; padding: 2px; font-family: monospace;">/src/mappings.json</code> directly. You can also paste in your text modifications here and click Apply to update.<br />Item count: ' + Object.keys(mappings || {}).length;
      } else if (activeJsonTabId === "drinks") {
        sidebarEl.querySelector("#cronometer-sc-json-textarea").value = JSON.stringify(drinks, null, 2);
        sidebarEl.querySelector("#cronometer-sc-json-instructions").innerHTML = 'Copy the raw string text below to update <code style="background: #0f172a; padding: 2px; font-family: monospace;">/src/drinks.json</code> directly. You can also paste in your text modifications here and click Apply to update.<br />Item count: ' + (drinks || []).length;
      } else if (activeJsonTabId === "endings") {
        sidebarEl.querySelector("#cronometer-sc-json-textarea").value = JSON.stringify(endings, null, 2);
        sidebarEl.querySelector("#cronometer-sc-json-instructions").innerHTML = 'Copy the raw string text below to update <code style="background: #0f172a; padding: 2px; font-family: monospace;">/src/endings.json</code> directly. You can also paste in your text modifications here and click Apply to update.<br />Item count: ' + (endings || []).length;
      }
    }
    sidebarEl.querySelector("#cronometer-sc-json-error").style.display = "none";
  }

  function updateJsonTabHighlight() {
    const jsonTabs = ["shortcodes", "mappings", "drinks", "endings", "zip"];
    jsonTabs.forEach(t => {
      const btn = sidebarEl.querySelector("#cronometer-sc-json-tab-" + t);
      if (btn) {
        if (t === activeJsonTabId || (t === "zip" && activeJsonTabId === "files")) {
          btn.style.color = "#4caf50";
          btn.style.borderBottom = "2px solid #4caf50";
        } else {
          btn.style.color = "#64748b";
          btn.style.borderBottom = "2px solid transparent";
        }
      }
    });
  }

  // Submit Sidebar Form (Tab 2)
  function submitForm() {
    const codeIn = sidebarEl.querySelector("#cronometer-sc-form-code");
    const nameIn = sidebarEl.querySelector("#cronometer-sc-form-name");
    const qtyIn = sidebarEl.querySelector("#cronometer-sc-form-qty");
    const unitIn = sidebarEl.querySelector("#cronometer-sc-form-unit");

    const rawKey = codeIn.value.trim().toLowerCase();
    const foodName = nameIn.value.trim();
    const defaultQuantity = parseFloat(qtyIn.value) || 1;
    const unit = unitIn.value.trim() || "g";

    if (!rawKey || !foodName) {
      alert("Please provide both a code trigger and a food name query.");
      return;
    }

    if (!/^[a-z]+$/.test(rawKey)) {
      return;
    }

    // If changing name in edit mode, delete previous trigger key
    if (editingKey && editingKey !== rawKey) {
      delete shortcodes[editingKey];
    }

    shortcodes[rawKey] = {
      foodName,
      defaultQuantity,
      unit
    };

    chrome.storage.local.set({ shortcodes }, () => {
      resetForm();
      showToast("Shortcut saved!", "success");
      updateSidebarViews();
    });
  }

  function startEdit(key) {
    editingKey = key;
    const data = shortcodes[key];

    sidebarEl.querySelector("#cronometer-sc-form-code").value = key;
    sidebarEl.querySelector("#cronometer-sc-form-name").value = data.foodName;
    sidebarEl.querySelector("#cronometer-sc-form-qty").value = data.defaultQuantity || data.baseQuantity || 1;
    sidebarEl.querySelector("#cronometer-sc-form-unit").value = data.unit;

    sidebarEl.querySelector("#cronometer-sc-form-header").innerText = "Edit Shortcode";
    sidebarEl.querySelector("#cronometer-sc-form-badge").style.display = "inline-block";
    sidebarEl.querySelector("#cronometer-sc-form-save").innerText = "Save Changes";
    sidebarEl.querySelector("#cronometer-sc-form-cancel").style.display = "block";
    sidebarEl.querySelector("#cronometer-sc-form-code").focus();
  }

  function resetForm() {
    editingKey = null;
    sidebarEl.querySelector("#cronometer-sc-form-code").value = "";
    sidebarEl.querySelector("#cronometer-sc-form-name").value = "";
    sidebarEl.querySelector("#cronometer-sc-form-qty").value = "1";
    sidebarEl.querySelector("#cronometer-sc-form-unit").value = "g";

    sidebarEl.querySelector("#cronometer-sc-form-header").innerText = "Add New Shortcode";
    sidebarEl.querySelector("#cronometer-sc-form-badge").style.display = "none";
    sidebarEl.querySelector("#cronometer-sc-form-save").innerText = "Create Shortcode";
    sidebarEl.querySelector("#cronometer-sc-form-cancel").style.display = "none";
    updateTab2ManageList();
  }

  function updateLookahead() {
    const codeInput = sidebarEl.querySelector("#cronometer-sc-form-code");
    const errorEl = sidebarEl.querySelector("#cronometer-sc-form-code-error");
    if (!codeInput) return;
    const val = codeInput.value.trim().toLowerCase();

    if (val && !/^[a-z]+$/.test(val)) {
      if (errorEl) errorEl.style.display = "block";
    } else {
      if (errorEl) errorEl.style.display = "none";
    }

    if (!val) {
      if (editingKey) {
        resetForm();
      }
      // Re-render list with no filter
      updateTab2ManageList();
      return;
    }

    // Exact Match Auto-Load check
    const matchedData = shortcodes[val];
    if (matchedData) {
      if (editingKey !== val) {
        editingKey = val;
        sidebarEl.querySelector("#cronometer-sc-form-name").value = matchedData.foodName;
        sidebarEl.querySelector("#cronometer-sc-form-qty").value = matchedData.defaultQuantity || matchedData.baseQuantity || 1;
        sidebarEl.querySelector("#cronometer-sc-form-unit").value = matchedData.unit;

        sidebarEl.querySelector("#cronometer-sc-form-header").innerText = "Edit Shortcode";
        sidebarEl.querySelector("#cronometer-sc-form-badge").style.display = "inline-block";
        sidebarEl.querySelector("#cronometer-sc-form-save").innerText = "Save Changes";
        sidebarEl.querySelector("#cronometer-sc-form-cancel").style.display = "block";
      }
    } else {
      // If we were editing, change back to add-new-shortcode mode (but preserve field values)
      if (editingKey) {
        editingKey = null;
        sidebarEl.querySelector("#cronometer-sc-form-header").innerText = "Add New Shortcode";
        sidebarEl.querySelector("#cronometer-sc-form-badge").style.display = "none";
        sidebarEl.querySelector("#cronometer-sc-form-save").innerText = "Create Shortcode";
        sidebarEl.querySelector("#cronometer-sc-form-cancel").style.display = "none";
      }
    }

    // Filter manage list based on lookahead instead
    updateTab2ManageList();
  }

  // Submit Mappings Form (Tab 3)
  function submitMappingForm() {
    const sourceIn = sidebarEl.querySelector("#cronometer-sc-mapping-source");
    const targetIn = sidebarEl.querySelector("#cronometer-sc-mapping-target");

    const rawSource = sourceIn.value.trim();
    const targetName = targetIn.value.trim();

    if (!rawSource || !targetName) {
      alert("Please provide both a source and a target mapping name.");
      return;
    }

    // If changing name in edit mode, delete previous mapping source key
    if (editingMappingKey && editingMappingKey.toLowerCase() !== rawSource.toLowerCase()) {
      delete mappings[editingMappingKey];
    }

    mappings[rawSource] = targetName;

    chrome.storage.local.set({ mappings }, () => {
      resetMappingForm();
      showToast("Mapping saved!", "success");
      updateSidebarViews();
    });
  }

  function startMappingEdit(key) {
    editingMappingKey = key;
    const targetName = mappings[key];

    sidebarEl.querySelector("#cronometer-sc-mapping-source").value = key;
    sidebarEl.querySelector("#cronometer-sc-mapping-target").value = targetName;

    sidebarEl.querySelector("#cronometer-sc-mapping-header").innerText = "Edit Mapping";
    sidebarEl.querySelector("#cronometer-sc-mapping-badge").style.display = "inline-block";
    sidebarEl.querySelector("#cronometer-sc-mapping-save").innerText = "Save Changes";
    sidebarEl.querySelector("#cronometer-sc-mapping-cancel").style.display = "block";
    sidebarEl.querySelector("#cronometer-sc-mapping-source").focus();
  }

  function resetMappingForm() {
    editingMappingKey = null;
    sidebarEl.querySelector("#cronometer-sc-mapping-source").value = "";
    sidebarEl.querySelector("#cronometer-sc-mapping-target").value = "";

    sidebarEl.querySelector("#cronometer-sc-mapping-header").innerText = "Add New Mapping";
    sidebarEl.querySelector("#cronometer-sc-mapping-badge").style.display = "none";
    sidebarEl.querySelector("#cronometer-sc-mapping-save").innerText = "Create Mapping";
    sidebarEl.querySelector("#cronometer-sc-mapping-cancel").style.display = "none";
    updateTab3MappingList();
  }

  function updateMappingLookahead() {
    const sourceInput = sidebarEl.querySelector("#cronometer-sc-mapping-source");
    if (!sourceInput) return;
    const val = sourceInput.value.trim().toLowerCase();

    if (!val) {
      if (editingMappingKey) {
        resetMappingForm();
      }
      updateTab3MappingList();
      return;
    }

    const matchedKey = Object.keys(mappings).find(k => k.toLowerCase() === val);
    if (matchedKey) {
      if (!editingMappingKey || editingMappingKey.toLowerCase() !== val) {
        editingMappingKey = matchedKey;
        sidebarEl.querySelector("#cronometer-sc-mapping-target").value = mappings[matchedKey];

        sidebarEl.querySelector("#cronometer-sc-mapping-header").innerText = "Edit Mapping";
        sidebarEl.querySelector("#cronometer-sc-mapping-badge").style.display = "inline-block";
        sidebarEl.querySelector("#cronometer-sc-mapping-save").innerText = "Save Changes";
        sidebarEl.querySelector("#cronometer-sc-mapping-cancel").style.display = "block";
      }
    } else {
      if (editingMappingKey) {
        editingMappingKey = null;
        sidebarEl.querySelector("#cronometer-sc-mapping-header").innerText = "Add New Mapping";
        sidebarEl.querySelector("#cronometer-sc-mapping-badge").style.display = "none";
        sidebarEl.querySelector("#cronometer-sc-mapping-save").innerText = "Create Mapping";
        sidebarEl.querySelector("#cronometer-sc-mapping-cancel").style.display = "none";
      }
    }
    updateTab3MappingList();
  }

  // Submit Drink Form
  function submitDrinkForm() {
    const nameIn = sidebarEl.querySelector("#cronometer-sc-drink-name");
    const drinkName = nameIn.value.trim();

    if (!drinkName) {
      alert("Please provide a drink name to exclude.");
      return;
    }

    if (editingDrinkKey && editingDrinkKey !== drinkName) {
      drinks = drinks.filter(d => d !== editingDrinkKey);
    } else if (!editingDrinkKey && drinks.includes(drinkName)) {
      alert("The drink '" + drinkName + "' is already excluded!");
      return;
    }

    if (!drinks.includes(drinkName)) drinks.push(drinkName);

    chrome.storage.local.set({ drinks }, () => {
      resetDrinkForm();
      showToast("Drink excluded!", "success");
      updateSidebarViews();
    });
  }

  function startDrinkEdit(val) {
    editingDrinkKey = val;
    sidebarEl.querySelector("#cronometer-sc-drink-name").value = val;
    sidebarEl.querySelector("#cronometer-sc-drink-header").innerText = "Edit Excluded Drink";
    sidebarEl.querySelector("#cronometer-sc-drink-badge").style.display = "inline-block";
    sidebarEl.querySelector("#cronometer-sc-drink-save").innerText = "Save Changes";
    sidebarEl.querySelector("#cronometer-sc-drink-cancel").style.display = "block";
    updateTabDrinksList();
  }

  function resetDrinkForm() {
    editingDrinkKey = null;
    sidebarEl.querySelector("#cronometer-sc-drink-name").value = "";
    sidebarEl.querySelector("#cronometer-sc-drink-header").innerText = "Add New Drink Filter";
    sidebarEl.querySelector("#cronometer-sc-drink-badge").style.display = "none";
    sidebarEl.querySelector("#cronometer-sc-drink-save").innerText = "Add Drink";
    sidebarEl.querySelector("#cronometer-sc-drink-cancel").style.display = "none";
    updateTabDrinksList();
  }

  function updateDrinkLookahead() {
    const input = sidebarEl.querySelector("#cronometer-sc-drink-name");
    if (!input) return;
    const val = input.value.trim().toLowerCase();

    if (!val) {
      if (editingDrinkKey) resetDrinkForm();
      updateTabDrinksList();
      return;
    }

    const matched = drinks.find(d => d.toLowerCase() === val);
    if (matched) {
      if (!editingDrinkKey || editingDrinkKey.toLowerCase() !== val) {
        startDrinkEdit(matched);
      }
    } else {
      if (editingDrinkKey) {
        editingDrinkKey = null;
        sidebarEl.querySelector("#cronometer-sc-drink-header").innerText = "Add New Drink Filter";
        sidebarEl.querySelector("#cronometer-sc-drink-badge").style.display = "none";
        sidebarEl.querySelector("#cronometer-sc-drink-save").innerText = "Add Drink";
        sidebarEl.querySelector("#cronometer-sc-drink-cancel").style.display = "none";
      }
    }
    updateTabDrinksList();
  }

  // Submit Ending Form
  function submitEndingForm() {
    const nameIn = sidebarEl.querySelector("#cronometer-sc-ending-name");
    const endingName = nameIn.value;

    if (!endingName) {
      alert("Please provide an ending string to trim.");
      return;
    }

    if (editingEndingKey && editingEndingKey !== endingName) {
      endings = endings.filter(e => e !== editingEndingKey);
    } else if (!editingEndingKey && endings.includes(endingName)) {
      alert("The ending '" + endingName + "' is already registered!");
      return;
    }

    if (!endings.includes(endingName)) endings.push(endingName);

    chrome.storage.local.set({ endings }, () => {
      resetEndingForm();
      showToast("Ending registered!", "success");
      updateSidebarViews();
    });
  }

  function startEndingEdit(val) {
    editingEndingKey = val;
    sidebarEl.querySelector("#cronometer-sc-ending-name").value = val;
    sidebarEl.querySelector("#cronometer-sc-ending-header").innerText = "Edit Trim Ending";
    sidebarEl.querySelector("#cronometer-sc-ending-badge").style.display = "inline-block";
    sidebarEl.querySelector("#cronometer-sc-ending-save").innerText = "Save Changes";
    sidebarEl.querySelector("#cronometer-sc-ending-cancel").style.display = "block";
    updateTabEndingsList();
  }

  function resetEndingForm() {
    editingEndingKey = null;
    sidebarEl.querySelector("#cronometer-sc-ending-name").value = "";
    sidebarEl.querySelector("#cronometer-sc-ending-header").innerText = "Add Endings To Trim";
    sidebarEl.querySelector("#cronometer-sc-ending-badge").style.display = "none";
    sidebarEl.querySelector("#cronometer-sc-ending-save").innerText = "Add Ending";
    sidebarEl.querySelector("#cronometer-sc-ending-cancel").style.display = "none";
    updateTabEndingsList();
  }

  function updateEndingLookahead() {
    const input = sidebarEl.querySelector("#cronometer-sc-ending-name");
    if (!input) return;
    const val = input.value.toLowerCase();

    if (!val) {
      if (editingEndingKey) resetEndingForm();
      updateTabEndingsList();
      return;
    }

    const matched = endings.find(e => e.toLowerCase() === val);
    if (matched) {
      if (!editingEndingKey || editingEndingKey.toLowerCase() !== val) {
        startEndingEdit(matched);
      }
    } else {
      if (editingEndingKey) {
        editingEndingKey = null;
        sidebarEl.querySelector("#cronometer-sc-ending-header").innerText = "Add Endings To Trim";
        sidebarEl.querySelector("#cronometer-sc-ending-badge").style.display = "none";
        sidebarEl.querySelector("#cronometer-sc-ending-save").innerText = "Add Ending";
        sidebarEl.querySelector("#cronometer-sc-ending-cancel").style.display = "none";
      }
    }
    updateTabEndingsList();
  }

  function toggleSidebar() {
    if (!sidebarEl) {
      createSidebar();
    }

    const isOpen = sidebarEl.dataset.isOpen === "true";
    if (isOpen) {
      sidebarEl.dataset.isOpen = "false";
      sidebarEl.style.transform = scPosition === "left" ? "translateX(-150%)" : "translateX(150%)";
      toggleButtonEl.innerHTML = "⌨️";
    } else {
      sidebarEl.dataset.isOpen = "true";
      sidebarEl.style.transform = "translateX(0)";
      toggleButtonEl.innerHTML = "❌";
      setTimeout(() => {
        const input = sidebarEl.querySelector("#cronometer-sc-input");
        if (input) input.focus();
      }, 150);
      loadShortcodes();
    }
    updatePinnedUI();
  }

  // Handle toggle_sidebar messages from background scripts
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggle_sidebar") {
      toggleSidebar();
    }
  });

  // Redraw both views (Tab 1 view and Tab 2 lists)
  function updateSidebarViews() {
    if (!sidebarEl) return;
    updateTab1Glossary();
    updateTab2ManageList();
    updateTab3MappingList();
    updateTabDrinksList();
    updateTabEndingsList();
    if (activeTabId === "json") {
      updateJsonTabContent();
    }
  }

  // Update pin button styling & margin shift on body
  function updatePinnedUI() {
    if (!sidebarEl) return;
    
    // Width setup
    sidebarEl.style.width = scWidth + "px";
    
    // Position Setup & Resizer Position
    const resizer = sidebarEl.querySelector("#cronometer-sc-resizer");
    if (scPosition === "left") {
      sidebarEl.style.left = "0";
      sidebarEl.style.right = "auto";
      sidebarEl.style.borderRight = "1px solid #334155";
      sidebarEl.style.borderLeft = "none";
      if (resizer) {
        resizer.style.left = "auto";
        resizer.style.right = "-4px";
      }
    } else {
      sidebarEl.style.right = "0";
      sidebarEl.style.left = "auto";
      sidebarEl.style.borderLeft = "1px solid #334155";
      sidebarEl.style.borderRight = "none";
      if (resizer) {
        resizer.style.right = "auto";
        resizer.style.left = "-4px";
      }
    }

    // Transform setup relative to dataset state
    const isOpen = sidebarEl.dataset.isOpen === "true";
    if (!isOpen) {
      sidebarEl.style.transform = scPosition === "left" ? "translateX(-150%)" : "translateX(150%)";
    } else {
      sidebarEl.style.transform = "translateX(0)";
    }

    // Toggles Pin SVG UI
    const pinSvg = sidebarEl.querySelector("#cronometer-sc-pin-svg");
    if (pinSvg) {
      if (isPinned) {
        pinSvg.style.color = "#4caf50";
        pinSvg.style.transform = "rotate(45deg)";
        pinSvg.setAttribute("fill", "rgba(76, 175, 80, 0.2)");
      } else {
        pinSvg.style.color = "#94a3b8";
        pinSvg.style.transform = "none";
        pinSvg.setAttribute("fill", "none");
      }
    }

    // Toggle Pos SVG orientation
    const posSvg = sidebarEl.querySelector("#cronometer-sc-position-svg");
    if (posSvg) {
      if (scPosition === "left") {
        posSvg.innerHTML = '<path d="M5 12h14"/><path d="m13 18 6-6-6-6"/>'; // right arrow like lucide
      } else {
        posSvg.innerHTML = '<path d="m11 18-6-6 6-6"/><path d="M5 12h14"/>'; // left arrow like lucide
      }
    }

    // Body Setup for Cronometer Website resizing constraints
    let layoutStyle = document.getElementById("cronometer-sc-layout-style");
    if (!layoutStyle) {
      layoutStyle = document.createElement("style");
      layoutStyle.id = "cronometer-sc-layout-style";
      document.head.appendChild(layoutStyle);
    }

    if (isOpen && isPinned) {
      let marginProp = scPosition === "left" ? "margin-left" : "margin-right";
      layoutStyle.textContent = 
        "html { " +
        "  width: calc(100% - " + scWidth + "px) !important;" +
        "  " + marginProp + ": " + scWidth + "px !important;" +
        "  transition: width 0.3s, margin 0.3s;" +
        "}" +
        "body {" +
        "  width: 100% !important;" +
        "  min-width: 0 !important;" +
        "}" +
        "/* Override absolute positioning or fixed-width containers to be bounded */" +
        "body > div {" +
        "  max-width: 100% !important;" +
        "}";
    } else {
      layoutStyle.textContent = 
        "html {" +
        "  width: 100% !important;" +
        "  margin-left: 0px !important;" +
        "  margin-right: 0px !important;" +
        "  transition: width 0.3s, margin 0.3s;" +
        "}";
    }
  }

  // Draw Tab 1 Quick Log shortcuts Glossary
  function updateTab1Glossary() {
    const listEl = sidebarEl.querySelector("#cronometer-sc-list");
    if (!listEl) return;

    listEl.innerHTML = "";
    
    // Compute current prefix based on active input
    const inputEl = sidebarEl.querySelector("#cronometer-sc-input");
    const inputVal = inputEl ? inputEl.value : "";
    
    let lookupPrefix = "";
    if (inputVal && !inputVal.endsWith(' ')) {
      const tokens = inputVal.split(/\s+/);
      const lastToken = tokens[tokens.length - 1];
      if (lastToken) {
        const codeMatch = lastToken.match(/[a-z]+/i);
        const invalidChars = lastToken.replace(/[a-z0-9.]/gi, '');
        if (codeMatch && !invalidChars) {
          lookupPrefix = codeMatch[0].toLowerCase();
        }
      }
    }

    let codes = Object.keys(shortcodes).sort();
    if (lookupPrefix) {
      codes = codes.filter(code => code.startsWith(lookupPrefix));
    }

    // Update dynamic heading info
    const headingEl = sidebarEl.querySelector("#cronometer-sc-list-heading");
    if (headingEl) {
      if (lookupPrefix) {
        headingEl.innerText = `Matching Shortcodes (${codes.length})`;
      } else {
        headingEl.innerText = `My Registered Shortcodes (${Object.keys(shortcodes).length})`;
      }
    }
    
    if (codes.length === 0) {
      if (lookupPrefix) {
        listEl.innerHTML = `<div style="color: #94a3b8; font-size: 11px; font-style: italic; text-align: center; padding: 12px;">No registered shortcodes match typing search "${lookupPrefix}".</div>`;
      } else {
        listEl.innerHTML = `<div style="color: #64748b; font-size: 11px; font-style: italic; text-align: center; padding: 12px;">No shortcuts saved yet.</div>`;
      }
      return;
    }

    codes.forEach((code) => {
      const data = shortcodes[code];
      const itemEl = document.createElement("div");
      Object.assign(itemEl.style, {
        backgroundColor: "#334155",
        padding: "8px 10px",
        borderRadius: "6px",
        display: "flex",
        flexDirection: "column",
        gap: "3px",
        fontSize: "12px",
        borderLeft: "3px solid #4caf50"
      });

      itemEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-family: monospace; font-size: 13px; color: #4caf50;">${code}</strong>
          <span style="color: #94a3b8; font-size: 10px;">${data.defaultQuantity || data.baseQuantity || 1} ${data.unit}</span>
        </div>
        <div style="color: #f1f5f9; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; font-size: 11px;" title="${data.foodName}">
          ${data.foodName}
        </div>
        <div style="display: flex; gap: 8px; justify-content: space-between; margin-top: 2px; border-top: 1px solid #475569; padding-top: 2px;">
          <button class="cronometer-sc-inject-btn" data-code="${code}" style="background: none; border: none; color: #4caf50; padding: 0; cursor: pointer; font-size: 10px; text-align: left; font-weight: 500;">⚡ Autolog</button>
        </div>
      `;

      itemEl.querySelector(".cronometer-sc-inject-btn").addEventListener("click", (e) => {
        executeDirectCode(code);
      });

      listEl.appendChild(itemEl);
    });
  }

  // Draw Tab 2 Manage GUI List with Pencil and Garbage icons
  function updateTab2ManageList() {
    const listEl = sidebarEl.querySelector("#cronometer-sc-manage-list");
    if (!listEl) return;

    listEl.innerHTML = "";
    
    const codeInput = sidebarEl.querySelector("#cronometer-sc-form-code");
    const nameInput = sidebarEl.querySelector("#cronometer-sc-form-name");
    const filterVal = codeInput ? codeInput.value.trim().toLowerCase() : "";
    const nameFilterVal = nameInput ? nameInput.value.trim().toLowerCase() : "";
    
    let codes = Object.keys(shortcodes).sort();
    if (filterVal) {
      codes = codes.filter(k => k.toLowerCase().includes(filterVal));
    }
    if (nameFilterVal) {
      codes = codes.filter(k => shortcodes[k].foodName.toLowerCase().includes(nameFilterVal));
    }

    if (codes.length === 0) {
      listEl.innerHTML = `<div style="color: #64748b; font-size: 11px; font-style: italic; text-align: center; padding: 12px;">No shortcuts saved yet.</div>`;
      return;
    }

    codes.forEach((code) => {
      const data = shortcodes[code];
      const div = document.createElement("div");
      Object.assign(div.style, {
        backgroundColor: "rgba(15, 23, 42, 0.25)",
        border: "1px solid #334155",
        padding: "6px 8px",
        borderRadius: "4px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "10px"
      });

      div.innerHTML = `
        <div style="min-width: 0; flex: 1;">
          <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
            <strong style="font-family: monospace; font-size: 12px; color: #4caf50;">${code}</strong>
            <span style="color: #64748b; font-size: 10px;">(${data.defaultQuantity || data.baseQuantity || 1} ${data.unit})</span>
          </div>
          <div style="font-size: 11px; color: #cbd5e1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${data.foodName}</div>
        </div>
        <div style="display: flex; gap: 4px; align-items: center; shrink: 0;">
          <button class="edit-btn" data-key="${code}" style="background: none; border: none; color: #38bdf8; cursor: pointer; font-size: 12px; padding: 4px;">✏️</button>
          <button class="delete-btn" data-key="${code}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px; padding: 4px;">&times;</button>
        </div>
      `;

      div.querySelector(".edit-btn").addEventListener("click", () => {
        startEdit(code);
      });

      div.querySelector(".delete-btn").addEventListener("click", () => {
        if (confirm("Delete shortcode \"" + code + "\"?")) {
          delete shortcodes[code];
          chrome.storage.local.set({ shortcodes }, () => {
            if (editingKey === code) {
              resetForm();
            }
            updateSidebarViews();
          });
        }
      });

      listEl.appendChild(div);
    });
  }

  // Draw Tab 3 Mappings List
  function updateTab3MappingList() {
    const listEl = sidebarEl.querySelector("#cronometer-sc-mapping-list");
    if (!listEl) return;

    listEl.innerHTML = "";
    
    const sourceInput = sidebarEl.querySelector("#cronometer-sc-mapping-source");
    const filterVal = sourceInput ? sourceInput.value.trim().toLowerCase() : "";
    
    let sourceKeys = Object.keys(mappings).sort();
    if (filterVal) {
      sourceKeys = sourceKeys.filter(k => k.toLowerCase().includes(filterVal));
    }

    if (sourceKeys.length === 0) {
      listEl.innerHTML = `<div style="color: #64748b; font-size: 11px; font-style: italic; text-align: center; padding: 12px;">No mappings saved yet.</div>`;
      return;
    }

    sourceKeys.forEach((sourceKey) => {
      const targetName = mappings[sourceKey];
      const div = document.createElement("div");
      Object.assign(div.style, {
        backgroundColor: "rgba(15, 23, 42, 0.25)",
        border: "1px solid #334155",
        padding: "6px 8px",
        borderRadius: "4px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "10px"
      });

      div.innerHTML = `
        <div style="min-width: 0; flex: 1;">
          <div style="font-size: 11px; color: #cbd5e1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${sourceKey}</div>
          <div style="color: #64748b; font-size: 10px; margin-top: 2px;">&rarr; ${targetName}</div>
        </div>
        <div style="display: flex; gap: 4px; align-items: center; shrink: 0;">
          <button class="edit-btn" data-key="${sourceKey}" style="background: none; border: none; color: #38bdf8; cursor: pointer; font-size: 12px; padding: 4px;">✏️</button>
          <button class="delete-btn" data-key="${sourceKey}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px; padding: 4px;">&times;</button>
        </div>
      `;

      div.querySelector(".edit-btn").addEventListener("click", () => {
        startMappingEdit(sourceKey);
      });

      div.querySelector(".delete-btn").addEventListener("click", () => {
        if (confirm("Delete mapping \"" + sourceKey + "\"?")) {
          delete mappings[sourceKey];
          chrome.storage.local.set({ mappings }, () => {
            if (editingMappingKey === sourceKey) {
              resetMappingForm();
            }
            updateSidebarViews();
          });
        }
      });

      listEl.appendChild(div);
    });
  }

  // Draw Tab Drinks List
  function updateTabDrinksList() {
    const listEl = sidebarEl.querySelector("#cronometer-sc-drink-list");
    if (!listEl) return;

    listEl.innerHTML = "";
    
    const nameInput = sidebarEl.querySelector("#cronometer-sc-drink-name");
    const filterVal = nameInput ? nameInput.value.trim().toLowerCase() : "";
    
    let filtered = drinks || [];
    if (filterVal) {
      filtered = filtered.filter(d => d.toLowerCase().includes(filterVal));
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `<div style="color: #64748b; font-size: 11px; font-style: italic; text-align: center; padding: 12px;">No drinks matched.</div>`;
      return;
    }

    filtered.forEach((d) => {
      const div = document.createElement("div");
      Object.assign(div.style, {
        backgroundColor: "rgba(15, 23, 42, 0.25)",
        border: "1px solid #334155",
        padding: "6px 8px",
        borderRadius: "4px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "10px"
      });

      div.innerHTML = `
        <div style="min-width: 0; flex: 1;">
          <div style="font-size: 11px; color: #cbd5e1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${d}</div>
        </div>
        <div style="display: flex; gap: 4px; align-items: center; shrink: 0;">
          <button class="edit-btn" data-key="${d}" style="background: none; border: none; color: #38bdf8; cursor: pointer; font-size: 12px; padding: 4px;">✏️</button>
          <button class="delete-btn" data-key="${d}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px; padding: 4px;">&times;</button>
        </div>
      `;

      div.querySelector(".edit-btn").addEventListener("click", () => {
        startDrinkEdit(d);
      });

      div.querySelector(".delete-btn").addEventListener("click", () => {
        if (confirm("Delete excluded drink \"" + d + "\"?")) {
          drinks = drinks.filter(x => x !== d);
          chrome.storage.local.set({ drinks }, () => {
            if (editingDrinkKey === d) resetDrinkForm();
            updateSidebarViews();
          });
        }
      });

      listEl.appendChild(div);
    });
  }

  // Draw Tab Endings List
  function updateTabEndingsList() {
    const listEl = sidebarEl.querySelector("#cronometer-sc-ending-list");
    if (!listEl) return;

    listEl.innerHTML = "";
    
    const nameInput = sidebarEl.querySelector("#cronometer-sc-ending-name");
    const filterVal = nameInput ? nameInput.value.toLowerCase() : "";
    
    let filtered = endings || [];
    if (filterVal) {
      filtered = filtered.filter(e => e.toLowerCase().includes(filterVal));
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `<div style="color: #64748b; font-size: 11px; font-style: italic; text-align: center; padding: 12px;">No endings matched.</div>`;
      return;
    }

    filtered.forEach((e) => {
      const div = document.createElement("div");
      Object.assign(div.style, {
        backgroundColor: "rgba(15, 23, 42, 0.25)",
        border: "1px solid #334155",
        padding: "6px 8px",
        borderRadius: "4px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "10px"
      });

      div.innerHTML = `
        <div style="min-width: 0; flex: 1;">
          <div style="font-size: 11px; color: #cbd5e1; font-family: monospace; background: #0f172a; padding: 2px 4px; border-radius: 3px;">${e}</div>
        </div>
        <div style="display: flex; gap: 4px; align-items: center; shrink: 0;">
          <button class="edit-btn" data-key="${e}" style="background: none; border: none; color: #38bdf8; cursor: pointer; font-size: 12px; padding: 4px;">✏️</button>
          <button class="delete-btn" data-key="${e}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px; padding: 4px;">&times;</button>
        </div>
      `;

      div.querySelector(".edit-btn").addEventListener("click", () => {
        startEndingEdit(e);
      });

      div.querySelector(".delete-btn").addEventListener("click", () => {
        if (confirm("Delete ending string \"" + e + "\"?")) {
          endings = endings.filter(x => x !== e);
          chrome.storage.local.set({ endings }, () => {
            if (editingEndingKey === e) resetEndingForm();
            updateSidebarViews();
          });
        }
      });

      listEl.appendChild(div);
    });
  }

  // Parse command line inputs like "2e 1.5b pb"
  function parseCommands(text) {
    const tokens = text.trim().toLowerCase().split(/\s+/);
    const parsed = [];
    
    tokens.forEach(token => {
      if (!token) return;
      
      const codeMatch = token.match(/[a-z]+/i);
      const numMatch = token.match(/[0-9.]+/);
      const invalidChars = token.replace(/[a-z0-9.]/gi, '');
      
      if (codeMatch && !invalidChars) {
        const qtyStr = numMatch ? numMatch[0] : null;
        const code = codeMatch[0].toLowerCase();
        
        if (shortcodes[code]) {
          const sc = shortcodes[code];
          const finalVal = qtyStr ? parseFloat(qtyStr) : (sc.defaultQuantity || sc.baseQuantity || 1);
          parsed.push({
            code,
            quantity: finalVal,
            data: sc
          });
        } else {
          showToast("Shortcode '" + code + "' not found!", "error");
        }
      } else {
        showToast("Invalid command: '" + token + "'", "error");
      }
    });
    
    return parsed;
  }

  async function executeInputs() {
    const inputEl = document.getElementById("cronometer-sc-input");
    const cmdText = inputEl.value;
    if (!cmdText) return;

    const items = parseCommands(cmdText);
    if (items.length === 0) return;

    inputEl.value = "";
    updateTab1Glossary();
    showToast("Processing " + items.length + " commands...", "info");

    for (const item of items) {
      await logFoodItem(item.data, item.quantity);
    }
  }

  async function executeDirectCode(code) {
    if (shortcodes[code]) {
      showToast("Logging " + code + "...", "info");
      const sc = shortcodes[code];
      const defaultQty = sc.defaultQuantity || sc.baseQuantity || 1;
      await logFoodItem(sc, defaultQty);
    }
  }

  // Core Automation Script for Cronometer
  async function logFoodItem(foodData, quantity) {
    const logsContainer = document.getElementById("cronometer-sc-active-automation");
    const stepEl = document.getElementById("cronometer-sc-step");
    
    if (logsContainer && stepEl) {
      logsContainer.style.display = "block";
    }

    const searchQuery = foodData.foodName;
    const finalQuantity = quantity;
    const selectUnit = foodData.unit;

    function updateStep(text) {
      console.log("[Shortcode Automation]:", text);
      if (stepEl) stepEl.innerText = text;
    }

    try {
      // Step 1: Click the main "Add Food" Button on Diary
      updateStep("Seeking 'Add Food' button...");
      
      // Let's search inside Cronometer for various selector candidates
      let addFoodButton = null;
      
      // Typical Cronometer selectors (supports standard desktop app web layouts)
      const possibleSelectors = [
        "button.gwt-Button.button-panel-btn",
        ".gwt-Button.button-panel-btn",
        "button.button-panel-btn",
        ".button-panel-btn",
        "button.gwt-Button:contains('Add Food')",
        ".gwt-Button",
        ".add-food-btn",
        "button[title*='Add Food']",
        "div[role='button']"
      ];

      // Scan standard query selector candidates
      for (const selector of possibleSelectors) {
        if (selector.includes(":contains")) {
          // jQuery-like containment check
          const textToMatch = selector.match(/'([^']+)'/)[1];
          const btns = Array.from(document.querySelectorAll("button, div"));
          addFoodButton = btns.find(b => b.textContent && b.textContent.trim() === textToMatch);
        } else {
          addFoodButton = document.querySelector(selector);
        }
        if (addFoodButton) break;
      }

      // Fallback: search all buttons for containing "Add Food"
      if (!addFoodButton) {
        const buttons = Array.from(document.querySelectorAll("button, div, span, a"));
        addFoodButton = buttons.find(b => {
          const txt = b.textContent ? b.textContent.trim() : "";
          return txt === "Add Food" || txt.includes("Add Food");
        });
      }

      if (!addFoodButton) {
        throw new Error("Could not find the 'Add Food' button on this page. Make sure you are logged in and in the Diary tab.");
      }

      // Click Add Food
      safeClick(addFoodButton);
      await sleep(1500); // Allow modal to build

      // Step 2: Extract Search Box inside Dialog
      updateStep("Seeking Food Search Input...");
      let searchInput = document.querySelector(".gwt-TextBox.search-field, input.gwt-TextBox.search-field, .search-field, input[placeholder*='Search'], input.gwt-TextBox, input.search-box");
      
      if (!searchInput) {
        // Try query based on active focus or general inputs within dialogs
        searchInput = document.activeElement && document.activeElement.tagName === "INPUT" 
          ? document.activeElement 
          : document.querySelector(".gwt-DialogBox input[type='text'], input.gwt-SuggestBox");
      }

      if (!searchInput) {
        throw new Error("Food Search input field not found! Please check if the dialog opened successfully.");
      }

      // Put query simulating actual typing sequence to wake GWT Suggest Box listeners
      updateStep("Entering search query: '" + searchQuery + "'");
      searchInput.focus();
      searchInput.value = "";
      for (let i = 0; i < searchQuery.length; i++) {
        searchInput.value += searchQuery[i];
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        searchInput.dispatchEvent(new Event("change", { bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: searchQuery[i], bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent("keypress", { key: searchQuery[i], bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent("keyup", { key: searchQuery[i], bubbles: true }));
        await sleep(50); // micro delay for debounce type matching
      }
      
      // Extra events to trigger GWT search handlers
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
      
      // Trigger return key or search action
      searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }));
      await sleep(2200); // Wait for query response list

      // Step 3: Pick top result
      updateStep("Picking first search result...");
      
      // Specifically target table.crono-table.crono-table-hover tr[tabindex='0'] or fall back appropriately
      let firstResult = document.querySelector("table.crono-table.crono-table-hover tr[tabindex='0']");
      
      if (!firstResult) {
        firstResult = document.querySelector(".crono-table-hover tr[tabindex='0']") ||
                      document.querySelector(".crono-table tr[tabindex='0']") ||
                      document.querySelector(".gwt-SuggestBoxPopup .item, .search-result-row, table.suggest-popup-table tr") ||
                      document.querySelector(".gwt-CellList div, .suggest-popup-item, .suggest-item");
      }

      console.log("[Cronometer Shortcodes Debug] Targeting first result:", firstResult);

      if (firstResult) {
        // GWT CellTable/DataGrid widgets often require mousedown, pointerdown, mousemove, mouseup combinations
        // along with focus shifting to process table-row selection correctly.
        console.log("[Cronometer Shortcodes Debug] Found row element. Dispatches full click & pointer stream.");
        
        try {
          if (typeof firstResult.focus === "function") {
            firstResult.focus();
          }
        } catch (focusError) {
          console.log("[Cronometer Shortcodes Debug] Focus on row error:", focusError);
        }

        const triggerMouseEvent = (element, eventName) => {
          const mEvent = new MouseEvent(eventName, {
            bubbles: true,
            cancelable: true,
            view: window,
            buttons: 1
          });
          element.dispatchEvent(mEvent);
        };

        const triggerPointerEvent = (element, eventName) => {
          const pEvent = new PointerEvent(eventName, {
            bubbles: true,
            cancelable: true,
            view: window,
            buttons: 1,
            pointerId: 1,
            isPrimary: true
          });
          element.dispatchEvent(pEvent);
        };

        const simulateDeepClick = (element) => {
          triggerPointerEvent(element, "pointerdown");
          triggerMouseEvent(element, "mousedown");
          triggerPointerEvent(element, "pointerup");
          triggerMouseEvent(element, "mouseup");
          safeClick(element);
        };

        // Dispatch events on the TR element
        simulateDeepClick(firstResult);

        // Many libraries (like GWT or Grid layouts) attach event listeners directly to the td (cell) level
        // rather than the row. Clicking the first cell triggers row activation.
        const firstTd = firstResult.querySelector("td");
        if (firstTd) {
          console.log("[Cronometer Shortcodes Debug] Dispatching full click stream to children TD:", firstTd);
          simulateDeepClick(firstTd);
        }

        await sleep(1500); // Allow selection change animations to persist
      } else {
        updateStep("Suggest list missing. Please click the desired search result manually to complete.");
        // We do not stop execution, so user can manually tap.
        showToast("Auto-click result failed. Tap the correct result, then let the system handle quantity!", "warning");
        await waitForUserOrTimeout(5000);
      }

      // Step 4: Fill Quantity & Unit
      updateStep("Filling Unit (" + selectUnit + ") & Quantity (" + finalQuantity + ")...");
      console.log("[Cronometer Shortcodes Debug] Finding .amount element and surrounding controls...");
      
      let amountDiv = document.querySelector(".amount") || document.querySelector("div.amount");
      let qtyInput = null;
      let unitBtn = null;
      let dropdownDiv = null;
      let unitSelected = false;

      if (amountDiv) {
        console.log("[Cronometer Shortcodes Debug] Found amount container:", amountDiv);
        
        // Find the first input element somewhere within that element hierarchy (not an immediate child element)
        qtyInput = amountDiv.querySelector("input");
        if (qtyInput) {
          console.log("[Cronometer Shortcodes Debug] Located quantity input element within .amount:", qtyInput);
        } else {
          console.log("[Cronometer Shortcodes Debug] No input element found inside .amount!");
        }

        // To get to the unit dropdown, go to the next sibling div element after the div with the class="amount"
        let nextSibling = amountDiv.nextElementSibling;
        let siblingDiv = null;
        while (nextSibling) {
          if (nextSibling.tagName.toLowerCase() === "div") {
            siblingDiv = nextSibling;
            break;
          }
          nextSibling = nextSibling.nextElementSibling;
        }

        if (siblingDiv) {
          console.log("[Cronometer Shortcodes Debug] Found next sibling div element:", siblingDiv);
          
          // The dropdown button is the only button element underneath this (not a direct child so search for it)
          unitBtn = siblingDiv.querySelector("button");
          if (unitBtn) {
            console.log("[Cronometer Shortcodes Debug] Found unit dropdown button under next sibling div:", unitBtn);
          } else {
            console.log("[Cronometer Shortcodes Debug] No button element found under next sibling div!");
          }
        } else {
          console.log("[Cronometer Shortcodes Debug] No sibling div element found after .amount!");
        }
      } else {
        console.log("[Cronometer Shortcodes Debug] .amount class div element NOT found on page! Make sure the food search completed and Cronometer opened the add food dialog.");
      }

      // First: Select and update the unit dropdown
      if (unitBtn) {
        console.log("[Cronometer Shortcodes Debug] Clicking unit dropdown button first to open menu:", unitBtn);
        safeClick(unitBtn);
        await sleep(400); // Wait for the dropdown items to render
        
        // Then the div that contains all the anchors with the units available in the dropdown is the first sibling div after the button element.
        let nextSib = unitBtn.nextElementSibling;
        while (nextSib) {
          if (nextSib.tagName.toLowerCase() === 'div') {
            dropdownDiv = nextSib;
            break;
          }
          nextSib = nextSib.nextElementSibling;
        }

        if (dropdownDiv) {
          console.log("[Cronometer Shortcodes Debug] Found options dropdown wrapper div as first sibling div after button:", dropdownDiv);
          const anchors = Array.from(dropdownDiv.querySelectorAll("a"));
          console.log("[Cronometer Shortcodes Debug] Dropdown contains anchors:", anchors.map(a => a.textContent));
          
          let matchingAnchor = anchors.find(a => a.textContent.trim().toLowerCase() === selectUnit.toLowerCase());
          if (!matchingAnchor) {
            // Partial match fallback
            matchingAnchor = anchors.find(a => a.textContent.trim().toLowerCase().includes(selectUnit.toLowerCase()));
          }

          if (matchingAnchor) {
            console.log("[Cronometer Shortcodes Debug] Clicking matching unit anchor:", matchingAnchor);
            safeClick(matchingAnchor);
            unitSelected = true;
          } else {
            console.log("[Cronometer Shortcodes Debug] No matching unit anchor found in dropdown for unit:", selectUnit);
          }
        } else {
          console.log("[Cronometer Shortcodes Debug] Could not find the first sibling div following the button element.");
        }
      }

      // Sleep a bit to make sure unit selection completed and any site events stabilized
      await sleep(500);

      // Second: Update quantity input box so it doesn't get reset by the unit picker
      if (qtyInput) {
        console.log("[Cronometer Shortcodes Debug] Now updating quantity input with value:", finalQuantity);
        qtyInput.focus();
        qtyInput.value = finalQuantity;
        qtyInput.dispatchEvent(new Event("input", { bubbles: true }));
        qtyInput.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        console.log("[Cronometer Shortcodes Debug] Quantity input element not available to fill.");
      }

      await sleep(650);

      // Step 5: Save
      updateStep("Clicking Add/Save...");
      let saveBtn = document.querySelector(".add-to-diary-btn-container button") ||
                    document.querySelector(".add-to-diary-btn-container > button");
      
      if (!saveBtn) {
        // Try fallback to other buttons
        saveBtn = document.querySelector("button.save-btn, .gwt-DialogBox button:contains('Add'), button:not([id])");
        if (!saveBtn) {
          const btns = Array.from(document.querySelectorAll(".gwt-DialogBox button, button"));
          saveBtn = btns.find(b => {
            const txt = b.textContent ? b.textContent.trim().toLowerCase() : "";
            return txt === "add" || txt === "save" || txt.includes("add food");
          });
        }
      }

      if (saveBtn) {
        console.log("[Cronometer Shortcodes Debug] Submitting diary form via button:", saveBtn);
        safeClick(saveBtn);
        updateStep("Food logged successfully!");
        showToast("Successfully logged: " + finalQuantity + "x " + searchQuery, "success");
      } else {
        updateStep("Complete by clicking 'Add' manually.");
        showToast("Ready! Click the green 'Add' button on screen to finish logging.", "info");
      }

    } catch (err) {
      console.error(err);
      updateStep("Automation error: " + err.message);
      
      // Copy instructions to clipboard as easy backup!
      try {
        navigator.clipboard.writeText(searchQuery);
        showToast("DOM updated: Copied '" + searchQuery + "' to Clipboard. Paste & enter: " + finalQuantity + " " + selectUnit, "warning");
      } catch (clipErr) {
        showToast("Backup: Enter " + finalQuantity + " x " + searchQuery + " (" + selectUnit + ") in Cronometer.", "warning");
      }
    }

    // Wrap-up UI
    await sleep(2500);
    if (logsContainer) {
      logsContainer.style.display = "none";
    }
    
    // Return the input focus to the log food input box
    const inputEl = document.getElementById("cronometer-sc-input");
    if (inputEl) {
      console.log("[Cronometer Shortcodes Debug] Returning focus to log food input box...");
      inputEl.focus();
    }
  }

  // Helper Utility promises
  function safeClick(el) {
    if (!el) return;
    
    // Dispatch a programmatic MouseEvent instead of calling .click() natively
    // This avoids Chrome Extension CSP from trying to evaluate javascript: hrefs 
    // natively, which throws the WASM-eval error, while still triggering React/GWT listeners.
    const mEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
      buttons: 1
    });
    el.dispatchEvent(mEvent);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function waitForUserOrTimeout(ms) {
    return new Promise(resolve => {
      const t = setTimeout(resolve, ms);
      // If user clicks anywhere, continue fast
      const clickListener = () => {
        clearTimeout(t);
        document.removeEventListener("click", clickListener);
        resolve();
      };
      document.addEventListener("click", clickListener);
    });
  }

  function showToast(message, type = "info", duration = 4000, bottomOffset = "80px") {
    const toast = document.createElement("div");
    let bg = "#0284c7";
    if (type === "success") bg = "#16a34a";
    if (type === "warning" || type === "error") bg = "#dc2626";

    Object.assign(toast.style, {
      position: "fixed",
      bottom: bottomOffset,
      right: "20px",
      padding: "12px 18px",
      backgroundColor: bg,
      color: "white",
      borderRadius: "6px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      zIndex: "1000000",
      fontSize: "13px",
      fontFamily: "'Inter', sans-serif",
      fontWeight: "500",
      transition: "opacity 0.2s ease, transform 0.2s ease"
    });

    toast.innerText = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 200);
    }, duration);
  }

  // Load css styling
  function loadStyles() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap";
    document.head.appendChild(link);
  }

  init();
})();
