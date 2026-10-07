document.addEventListener("DOMContentLoaded", () => {
  const codeListEl = document.getElementById("code-list");
  const saveBtn = document.getElementById("save-sc-btn");
  const cancelEditBtn = document.getElementById("cancel-edit-btn");
  const formHeaderEl = document.getElementById("form-header");
  
  const codeIn = document.getElementById("code");
  const foodNameIn = document.getElementById("foodName");
  const quantityIn = document.getElementById("quantity");
  const unitIn = document.getElementById("unit");

  let shortcodes = {};
  let editingKey = null;

  // Load registered codes
  function loadAndRender() {
    chrome.storage.local.get("shortcodes", (result) => {
      shortcodes = result.shortcodes || {};
      renderList();
    });
  }

  function renderList() {
    // Clear out items except the label header
    const items = Array.from(codeListEl.querySelectorAll(".shortcode-item"));
    items.forEach(el => el.remove());

    const keys = Object.keys(shortcodes).sort();
    if (keys.length === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "shortcode-item";
      emptyEl.style.justifyContent = "center";
      emptyEl.style.color = "#64748b";
      emptyEl.style.fontStyle = "italic";
      emptyEl.innerText = "No codes saved yet.";
      codeListEl.appendChild(emptyEl);
      return;
    }

    keys.forEach(key => {
      const data = shortcodes[key];
      const div = document.createElement("div");
      div.className = "shortcode-item";
      div.innerHTML = `
        <div class="shortcode-info">
          <span class="shortcode-meta">${key}</span> &rarr;
          <span style="color:#ffffff; font-size:12px; font-weight:500;">${data.defaultQuantity || data.baseQuantity || 1} ${data.unit}</span>
          <div class="shortcode-name">${data.foodName}</div>
        </div>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button class="edit-btn" data-key="${key}" style="background:none; border:none; color:#38bdf8; cursor:pointer; font-size:12px; padding:4px;">✏️</button>
          <button class="delete-btn" data-key="${key}">&times;</button>
        </div>
      `;

      div.querySelector(".edit-btn").addEventListener("click", (e) => {
        const keyToEdit = e.currentTarget.getAttribute("data-key");
        startEdit(keyToEdit);
      });

      div.querySelector(".delete-btn").addEventListener("click", (e) => {
        const keyToDelete = e.currentTarget.getAttribute("data-key");
        if (confirm("Delete shortcode \"" + keyToDelete + "\"?")) {
          delete shortcodes[keyToDelete];
          chrome.storage.local.set({ shortcodes }, () => {
            if (editingKey === keyToDelete) {
              resetForm();
            }
            loadAndRender();
          });
        }
      });

      codeListEl.appendChild(div);
    });
  }

  function startEdit(key) {
    editingKey = key;
    const data = shortcodes[key];
    
    codeIn.value = key;
    foodNameIn.value = data.foodName;
    quantityIn.value = data.defaultQuantity || data.baseQuantity || 1;
    unitIn.value = data.unit;

    formHeaderEl.innerText = "Edit Shortcode";
    saveBtn.innerText = "Save Changes";
    cancelEditBtn.style.display = "block";
    codeIn.focus();
  }

  function resetForm() {
    editingKey = null;
    codeIn.value = "";
    foodNameIn.value = "";
    quantityIn.value = "1";
    unitIn.value = "g"; // default back to grams!

    formHeaderEl.innerText = "Register New Shortcode";
    saveBtn.innerText = "Save Shortcode";
    cancelEditBtn.style.display = "none";
  }

  cancelEditBtn.addEventListener("click", () => {
    resetForm();
  });

  saveBtn.addEventListener("click", () => {
    const rawKey = codeIn.value.trim().toLowerCase();
    const foodName = foodNameIn.value.trim();
    const qty = parseFloat(quantityIn.value) || 1;
    const unit = unitIn.value.trim() || "g";

    if (!rawKey || !foodName) {
      alert("Please provide both a code and a food search name.");
      return;
    }

    // If we changed the code name in edit mode, delete the old trigger first
    if (editingKey && editingKey !== rawKey) {
      delete shortcodes[editingKey];
    }

    // Update state & sync
    shortcodes[rawKey] = {
      foodName,
      defaultQuantity: qty,
      unit
    };

    chrome.storage.local.set({ shortcodes }, () => {
      resetForm();
      loadAndRender();
    });
  });

  loadAndRender();
});