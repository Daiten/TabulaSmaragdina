const STORAGE_KEY = "materials-encyclopedia-db-v1";

const state = loadState();

const propertyForm = document.getElementById("propertyForm");
const propertyList = document.getElementById("propertyList");
const materialForm = document.getElementById("materialForm");
const materialPropertiesContainer = document.getElementById("materialPropertiesContainer");
const materialsTableContainer = document.getElementById("materialsTableContainer");
const analyticsContainer = document.getElementById("analyticsContainer");
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");
const clearBtn = document.getElementById("clearBtn");
const propertyValueTemplate = document.getElementById("propertyValueTemplate");

// ── Modal elements (add these to your HTML if not present) ──────────────────
// The script will create them dynamically if missing.
let editModal = null;
let editModalBackdrop = null;

propertyForm.addEventListener("submit", onAddProperty);
materialForm.addEventListener("submit", onAddMaterial);
exportBtn.addEventListener("click", onExport);
importInput.addEventListener("change", onImport);
clearBtn.addEventListener("click", onClearAll);

ensureModalInDOM();
render();

// ── State persistence ────────────────────────────────────────────────────────

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { version: 1, properties: [], materials: [] };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid saved state");
    }
    return {
      version: 1,
      properties: Array.isArray(parsed.properties) ? parsed.properties : [],
      materials: Array.isArray(parsed.materials) ? parsed.materials : []
    };
  } catch {
    return { version: 1, properties: [], materials: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ── Add handlers ─────────────────────────────────────────────────────────────

function onAddProperty(event) {
  event.preventDefault();
  const formData = new FormData(propertyForm);
  const name = String(formData.get("propertyName") || "").trim();
  const type = String(formData.get("propertyType") || "").trim();
  const unit = String(formData.get("propertyUnit") || "").trim();

  if (!name) {
    return;
  }
  if (state.properties.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    alert("Property already exists.");
    return;
  }

  state.properties.push({
    id: crypto.randomUUID(),
    name,
    type,
    unit
  });

  propertyForm.reset();
  saveState();
  render();
}

function onAddMaterial(event) {
  event.preventDefault();
  const formData = new FormData(materialForm);
  const name = String(formData.get("materialName") || "").trim();
  const kind = String(formData.get("materialKind") || "Custom").trim();
  const notes = String(formData.get("materialNotes") || "").trim();

  if (!name) {
    return;
  }

  const values = collectPropertyValues(formData);

  state.materials.push({
    id: crypto.randomUUID(),
    name,
    kind,
    notes,
    values
  });

  materialForm.reset();
  saveState();
  render();
}

/** Read all prop-* fields from a FormData and return a values map. */
function collectPropertyValues(formData) {
  const values = {};
  for (const prop of state.properties) {
    if (prop.type === "number") {
      const raw = String(formData.get(`prop-${prop.id}`) || "").trim();
      values[prop.id] = raw === "" ? null : Number(raw);
    } else if (prop.type === "category") {
      const raw = String(formData.get(`prop-${prop.id}`) || "").trim();
      values[prop.id] = raw || null;
    } else if (prop.type === "tags") {
      const raw = String(formData.get(`prop-${prop.id}`) || "").trim();
      const tags = raw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      values[prop.id] = tags;
    } else {
      const raw = String(formData.get(`prop-${prop.id}`) || "").trim();
      values[prop.id] = raw || null;
    }
  }
  return values;
}

// ── Export / Import / Clear ──────────────────────────────────────────────────

function onExport() {
  const payload = {
    exportedAt: new Date().toISOString(),
    ...state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `materials-encyclopedia-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function onImport(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.properties) || !Array.isArray(parsed.materials)) {
      throw new Error("Invalid format");
    }
    state.properties = parsed.properties;
    state.materials = parsed.materials;
    saveState();
    render();
  } catch {
    alert("Import failed: invalid JSON format.");
  } finally {
    importInput.value = "";
  }
}

function onClearAll() {
  const ok = confirm("Delete all properties and materials?");
  if (!ok) {
    return;
  }
  state.properties = [];
  state.materials = [];
  saveState();
  render();
}

// ── Render ───────────────────────────────────────────────────────────────────

function render() {
  renderPropertyList();
  renderMaterialPropertyInputs();
  renderMaterialsTable();
  renderAnalytics();
}

function renderPropertyList() {
  propertyList.innerHTML = "";
  if (state.properties.length === 0) {
    propertyList.innerHTML = '<p class="muted">No properties yet.</p>';
    return;
  }

  for (const prop of state.properties) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <span><strong>${escapeHtml(prop.name)}</strong> (${escapeHtml(prop.type)}${prop.unit ? ", " + escapeHtml(prop.unit) : ""})</span>
      <div style="display:flex;gap:6px;">
        <button type="button" data-property-edit="${prop.id}">Edit</button>
        <button type="button" data-property-remove="${prop.id}" class="danger">Remove</button>
      </div>
    `;
    propertyList.appendChild(item);
  }

  propertyList.querySelectorAll("[data-property-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-property-edit");
      openEditPropertyModal(id);
    });
  });

  propertyList.querySelectorAll("[data-property-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-property-remove");
      removeProperty(id);
    });
  });
}

function removeProperty(propertyId) {
  state.properties = state.properties.filter((p) => p.id !== propertyId);
  for (const material of state.materials) {
    delete material.values[propertyId];
  }
  saveState();
  render();
}

function renderMaterialPropertyInputs() {
  materialPropertiesContainer.innerHTML = "";
  if (state.properties.length === 0) {
    materialPropertiesContainer.innerHTML = '<p class="muted">Define properties first.</p>';
    return;
  }

  for (const prop of state.properties) {
    const clone = propertyValueTemplate.content.cloneNode(true);
    const row = clone.querySelector(".property-value-row");
    const label = row.querySelector("label");
    const valueInput = row.querySelector(".value-input");
    label.textContent = `${prop.name}${prop.unit ? ` (${prop.unit})` : ""}`;

    const input = buildPropertyInput(prop);
    valueInput.appendChild(input);
    materialPropertiesContainer.appendChild(clone);
  }
}

/** Build the right <input> element for a property type. */
function buildPropertyInput(prop, existingValue) {
  let input;
  if (prop.type === "number") {
    input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.placeholder = "Numeric value";
    if (existingValue != null) input.value = existingValue;
  } else if (prop.type === "tags") {
    input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Comma-separated tags, e.g. sweet, sour";
    if (Array.isArray(existingValue)) input.value = existingValue.join(", ");
  } else {
    input = document.createElement("input");
    input.type = "text";
    input.placeholder = prop.type === "category" ? "Category value" : "Text value";
    if (existingValue != null) input.value = existingValue;
  }
  input.name = `prop-${prop.id}`;
  return input;
}

function renderMaterialsTable() {
  if (state.materials.length === 0) {
    materialsTableContainer.innerHTML = '<p class="muted">No materials yet.</p>';
    return;
  }

  const table = document.createElement("table");
  const headers = ["Name", "Kind", ...state.properties.map((p) => p.name), "Notes", "Actions"];
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  state.materials.forEach((material) => {
    const tr = document.createElement("tr");
    tr.appendChild(cell(material.name));
    tr.appendChild(cell(material.kind));

    for (const prop of state.properties) {
      const val = material.values[prop.id];
      if (Array.isArray(val)) {
        const td = document.createElement("td");
        td.innerHTML = val.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join("");
        tr.appendChild(td);
      } else {
        tr.appendChild(cell(val == null || val === "" ? "—" : String(val)));
      }
    }

    tr.appendChild(cell(material.notes || "—"));

    const actionTd = document.createElement("td");
    actionTd.style.display = "flex";
    actionTd.style.gap = "6px";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openEditMaterialModal(material.id));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      state.materials = state.materials.filter((m) => m.id !== material.id);
      saveState();
      render();
    });

    actionTd.appendChild(editBtn);
    actionTd.appendChild(delBtn);
    tr.appendChild(actionTd);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  materialsTableContainer.innerHTML = "";
  materialsTableContainer.appendChild(table);
}

// ── Edit Modal ───────────────────────────────────────────────────────────────

function ensureModalInDOM() {
  if (document.getElementById("editModal")) {
    editModal = document.getElementById("editModal");
    editModalBackdrop = document.getElementById("editModalBackdrop");
    return;
  }

  // Inject minimal modal styles
  const style = document.createElement("style");
  style.textContent = `
    #editModalBackdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    #editModalBackdrop.open { display: flex; }
    #editModal {
      background: #fff;
      border-radius: 8px;
      padding: 24px 28px;
      min-width: 340px;
      max-width: 560px;
      width: 100%;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    }
    #editModal h2 { margin: 0 0 16px; font-size: 1.1rem; }
    #editModal label { display: block; margin-bottom: 4px; font-weight: 600; font-size: 0.9rem; }
    #editModal input, #editModal textarea { width: 100%; box-sizing: border-box; margin-bottom: 12px; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.95rem; }
    #editModal .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
  `;
  document.head.appendChild(style);

  editModalBackdrop = document.createElement("div");
  editModalBackdrop.id = "editModalBackdrop";

  editModal = document.createElement("div");
  editModal.id = "editModal";
  editModal.setAttribute("role", "dialog");
  editModal.setAttribute("aria-modal", "true");

  editModalBackdrop.appendChild(editModal);
  document.body.appendChild(editModalBackdrop);

  // Close on backdrop click
  editModalBackdrop.addEventListener("click", (e) => {
    if (e.target === editModalBackdrop) closeModal();
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function openModal(contentBuilder) {
  editModal.innerHTML = "";
  contentBuilder(editModal);
  editModalBackdrop.classList.add("open");
  // Focus first input
  const first = editModal.querySelector("input, textarea, select");
  if (first) first.focus();
}

function closeModal() {
  editModalBackdrop.classList.remove("open");
  editModal.innerHTML = "";
}

// ── Edit Property Modal ──────────────────────────────────────────────────────

function openEditPropertyModal(propertyId) {
  const prop = state.properties.find((p) => p.id === propertyId);
  if (!prop) return;

  openModal((container) => {
    const h2 = document.createElement("h2");
    h2.textContent = "Edit Property";
    container.appendChild(h2);

    // Name
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Name";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = prop.name;

    // Type
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Type";
    const typeSelect = document.createElement("select");
    typeSelect.style.cssText = "width:100%;margin-bottom:12px;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:0.95rem;box-sizing:border-box;";
    ["number", "text", "category", "tags"].forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      if (t === prop.type) opt.selected = true;
      typeSelect.appendChild(opt);
    });

    // Unit
    const unitLabel = document.createElement("label");
    unitLabel.textContent = "Unit (optional)";
    const unitInput = document.createElement("input");
    unitInput.type = "text";
    unitInput.value = prop.unit || "";

    container.appendChild(nameLabel);
    container.appendChild(nameInput);
    container.appendChild(typeLabel);
    container.appendChild(typeSelect);
    container.appendChild(unitLabel);
    container.appendChild(unitInput);

    // Actions
    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", closeModal);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => {
      const newName = nameInput.value.trim();
      const newType = typeSelect.value;
      const newUnit = unitInput.value.trim();

      if (!newName) {
        alert("Name cannot be empty.");
        return;
      }
      // Check for duplicate name (excluding itself)
      if (state.properties.some((p) => p.id !== propertyId && p.name.toLowerCase() === newName.toLowerCase())) {
        alert("Another property with that name already exists.");
        return;
      }

      prop.name = newName;
      prop.type = newType;
      prop.unit = newUnit;

      saveState();
      render();
      closeModal();
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    container.appendChild(actions);
  });
}

// ── Edit Material Modal ──────────────────────────────────────────────────────

function openEditMaterialModal(materialId) {
  const material = state.materials.find((m) => m.id === materialId);
  if (!material) return;

  openModal((container) => {
    const h2 = document.createElement("h2");
    h2.textContent = `Edit Material: ${escapeHtml(material.name)}`;
    container.appendChild(h2);

    // Name
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Name";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = material.name;

    // Kind
    const kindLabel = document.createElement("label");
    kindLabel.textContent = "Kind";
    const kindInput = document.createElement("input");
    kindInput.type = "text";
    kindInput.value = material.kind || "";

    // Notes
    const notesLabel = document.createElement("label");
    notesLabel.textContent = "Notes";
    const notesInput = document.createElement("textarea");
    notesInput.rows = 3;
    notesInput.style.cssText = "width:100%;box-sizing:border-box;margin-bottom:12px;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:0.95rem;";
    notesInput.value = material.notes || "";

    container.appendChild(nameLabel);
    container.appendChild(nameInput);
    container.appendChild(kindLabel);
    container.appendChild(kindInput);
    container.appendChild(notesLabel);
    container.appendChild(notesInput);

    // Property values
    if (state.properties.length > 0) {
      const propsHeading = document.createElement("label");
      propsHeading.textContent = "Property Values";
      propsHeading.style.marginTop = "4px";
      container.appendChild(propsHeading);

      for (const prop of state.properties) {
        const propLabel = document.createElement("label");
        propLabel.textContent = `${prop.name}${prop.unit ? ` (${prop.unit})` : ""}`;
        propLabel.style.fontWeight = "normal";
        const propInput = buildPropertyInput(prop, material.values[prop.id]);
        container.appendChild(propLabel);
        container.appendChild(propInput);
      }
    }

    // Actions
    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", closeModal);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => {
      const newName = nameInput.value.trim();
      if (!newName) {
        alert("Name cannot be empty.");
        return;
      }

      material.name = newName;
      material.kind = kindInput.value.trim() || "Custom";
      material.notes = notesInput.value.trim();

      // Collect property values from the modal inputs
      for (const prop of state.properties) {
        const input = container.querySelector(`[name="prop-${prop.id}"]`);
        if (!input) continue;
        const raw = input.value.trim();
        if (prop.type === "number") {
          material.values[prop.id] = raw === "" ? null : Number(raw);
        } else if (prop.type === "tags") {
          material.values[prop.id] = raw.split(",").map((t) => t.trim()).filter(Boolean);
        } else {
          material.values[prop.id] = raw || null;
        }
      }

      saveState();
      render();
      closeModal();
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    container.appendChild(actions);
  });
}

// ── Analytics ────────────────────────────────────────────────────────────────

function renderAnalytics() {
  analyticsContainer.innerHTML = "";
  if (state.materials.length < 2) {
    analyticsContainer.innerHTML = '<p class="muted">Add at least 2 materials to see analytics.</p>';
    return;
  }

  const numericProperties = state.properties.filter((p) => p.type === "number");
  const tagProperties = state.properties.filter((p) => p.type === "tags");
  const categoryProperties = state.properties.filter((p) => p.type === "category");

  renderNumericCorrelations(numericProperties);
  renderCategoryAverages(categoryProperties, numericProperties);
  renderLikelyTagRules(tagProperties);
}

function renderNumericCorrelations(numericProperties) {
  const block = createAnalyticsBlock("Numeric Correlations");
  if (numericProperties.length < 2) {
    block.appendChild(muted("Need at least 2 numeric properties."));
    analyticsContainer.appendChild(block);
    return;
  }

  const rows = [];
  for (let i = 0; i < numericProperties.length; i += 1) {
    for (let j = i + 1; j < numericProperties.length; j += 1) {
      const a = numericProperties[i];
      const b = numericProperties[j];
      const pairs = state.materials
        .map((m) => [m.values[a.id], m.values[b.id]])
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
      if (pairs.length < 3) {
        continue;
      }
      const corr = pearson(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
      rows.push(`${a.name} vs ${b.name}: r = ${corr.toFixed(3)} (n=${pairs.length})`);
    }
  }

  if (rows.length === 0) {
    block.appendChild(muted("Not enough complete numeric pairs."));
  } else {
    const ul = document.createElement("ul");
    rows.sort((x, y) => Math.abs(parseFloat(y.split("r = ")[1])) - Math.abs(parseFloat(x.split("r = ")[1])));
    rows.slice(0, 8).forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r;
      ul.appendChild(li);
    });
    block.appendChild(ul);
  }

  analyticsContainer.appendChild(block);
}

function renderCategoryAverages(categoryProperties, numericProperties) {
  const block = createAnalyticsBlock("Category -> Numeric Averages");
  if (categoryProperties.length === 0 || numericProperties.length === 0) {
    block.appendChild(muted("Need at least one category and one numeric property."));
    analyticsContainer.appendChild(block);
    return;
  }

  const ul = document.createElement("ul");
  let count = 0;
  for (const catProp of categoryProperties) {
    for (const numProp of numericProperties) {
      const groups = new Map();
      for (const material of state.materials) {
        const cat = material.values[catProp.id];
        const num = material.values[numProp.id];
        if (!cat || !Number.isFinite(num)) {
          continue;
        }
        if (!groups.has(cat)) {
          groups.set(cat, []);
        }
        groups.get(cat).push(num);
      }
      if (groups.size < 2) {
        continue;
      }
      const parts = [];
      for (const [cat, values] of groups.entries()) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        parts.push(`${cat}: ${avg.toFixed(3)} (n=${values.length})`);
      }
      const li = document.createElement("li");
      li.textContent = `${catProp.name} -> ${numProp.name}: ${parts.join(" | ")}`;
      ul.appendChild(li);
      count += 1;
      if (count >= 8) {
        break;
      }
    }
    if (count >= 8) {
      break;
    }
  }

  if (count === 0) {
    block.appendChild(muted("No category groups with numeric data found."));
  } else {
    block.appendChild(ul);
  }
  analyticsContainer.appendChild(block);
}

function renderLikelyTagRules(tagProperties) {
  const block = createAnalyticsBlock("Likely Tag Clues");
  if (tagProperties.length === 0) {
    block.appendChild(muted("Need at least one tag property."));
    analyticsContainer.appendChild(block);
    return;
  }

  const lines = [];
  for (const tagProp of tagProperties) {
    const allTags = collectAllTags(tagProp.id);
    const predictors = state.properties.filter((p) => p.id !== tagProp.id && (p.type === "category" || p.type === "text"));
    for (const predictor of predictors) {
      for (const tag of allTags) {
        const grouped = computeConditionalTagRate(tagProp.id, tag, predictor.id);
        for (const [predictorValue, rates] of grouped.entries()) {
          if (rates.total < 2) {
            continue;
          }
          const rate = rates.hit / rates.total;
          if (rate >= 0.7) {
            lines.push(
              `When ${predictor.name} = ${predictorValue}, tag "${tag}" appears ${Math.round(rate * 100)}% of the time (n=${rates.total}).`
            );
          }
        }
      }
    }
  }

  if (lines.length === 0) {
    block.appendChild(muted("No strong clues yet. Add more materials/tags for better patterns."));
  } else {
    const ul = document.createElement("ul");
    lines.slice(0, 10).forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      ul.appendChild(li);
    });
    block.appendChild(ul);
  }

  analyticsContainer.appendChild(block);
}

// ── Utilities ────────────────────────────────────────────────────────────────

function collectAllTags(propertyId) {
  const set = new Set();
  for (const material of state.materials) {
    const arr = material.values[propertyId];
    if (Array.isArray(arr)) {
      arr.forEach((tag) => set.add(tag));
    }
  }
  return [...set];
}

function computeConditionalTagRate(tagPropertyId, tag, predictorPropertyId) {
  const map = new Map();
  for (const material of state.materials) {
    const predictorVal = material.values[predictorPropertyId];
    if (!predictorVal) {
      continue;
    }
    if (!map.has(predictorVal)) {
      map.set(predictorVal, { total: 0, hit: 0 });
    }
    const bucket = map.get(predictorVal);
    bucket.total += 1;
    const tags = material.values[tagPropertyId];
    if (Array.isArray(tags) && tags.includes(tag)) {
      bucket.hit += 1;
    }
  }
  return map;
}

function pearson(xs, ys) {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

function cell(content) {
  const td = document.createElement("td");
  td.textContent = content;
  return td;
}

function createAnalyticsBlock(title) {
  const block = document.createElement("div");
  block.className = "analytics-block";
  const h3 = document.createElement("h3");
  h3.textContent = title;
  block.appendChild(h3);
  return block;
}

function muted(text) {
  const p = document.createElement("p");
  p.className = "muted";
  p.textContent = text;
  return p;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
