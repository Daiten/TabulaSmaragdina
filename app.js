const STORAGE_KEY = "materials-encyclopedia-db-v1";

const state = loadState();
let editingMaterialId = null;

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

propertyForm.addEventListener("submit", onAddProperty);
materialForm.addEventListener("submit", onAddMaterial);
exportBtn.addEventListener("click", onExport);
importInput.addEventListener("change", onImport);
clearBtn.addEventListener("click", onClearAll);

render();

/* ---------------- STATE ---------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, properties: [], materials: [] };

    const parsed = JSON.parse(raw);
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

/* ---------------- PROPERTIES ---------------- */

function onAddProperty(event) {
  event.preventDefault();
  const formData = new FormData(propertyForm);
  const name = String(formData.get("propertyName") || "").trim();
  const type = String(formData.get("propertyType") || "").trim();
  const unit = String(formData.get("propertyUnit") || "").trim();

  if (!name) return;

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

function removeProperty(propertyId) {
  state.properties = state.properties.filter((p) => p.id !== propertyId);
  for (const material of state.materials) {
    delete material.values[propertyId];
  }
  saveState();
  render();
}

/* ---------------- MATERIALS (ADD + EDIT) ---------------- */

function startEditMaterial(id) {
  const material = state.materials.find((m) => m.id === id);
  if (!material) return;

  editingMaterialId = id;

  materialForm.querySelector("[name='materialName']").value = material.name;
  materialForm.querySelector("[name='materialKind']").value = material.kind;
  materialForm.querySelector("[name='materialNotes']").value = material.notes;

  for (const prop of state.properties) {
    const input = materialForm.querySelector(`[name='
