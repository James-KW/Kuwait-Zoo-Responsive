import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const REPORT_DOC_ID = '__report__';
const deletedIds = new Set();
let activeUser = null;
let initialized = false;

function $(id) { return document.getElementById(id); }
function setStatus(message, isError = false) {
  const status = $('status');
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? '#b42318' : '#20743b';
}
function safeCount(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}
function reportTotals() {
  const rows = [...document.querySelectorAll('#speciesRows tr')];
  let male = 0, female = 0, unknown = 0, total = 0, chimpanzees = 0, monkeySpecies = 0;
  for (const row of rows) {
    const values = Object.fromEntries([...row.querySelectorAll('[data-field]')]
      .map(cell => [cell.dataset.field, safeCount(cell.textContent.trim())]));
    const rowTotal = values.male + values.female + values.unknown;
    male += values.male; female += values.female; unknown += values.unknown; total += rowTotal;
    if ((row.dataset.id || '').startsWith('chimp')) chimpanzees += rowTotal;
    else monkeySpecies++;
  }
  const assign = (id, value) => { const element = $(id); if (element) element.textContent = value; };
  assign('speciesCount', monkeySpecies); assign('populationTotal', total);
  assign('maleTotal', male); assign('femaleTotal', female);
  assign('unknownTotal', unknown); assign('chimpTotal', chimpanzees);
}
function filterDeletedRows() {
  const tbody = $('speciesRows');
  if (!tbody) return;
  for (const row of [...tbody.querySelectorAll('tr')]) {
    if (deletedIds.has(row.dataset.id)) row.remove();
  }
  reportTotals();
}
function buildAddSpeciesControl() {
  const controls = $('editControls');
  if (!controls || $('addSpeciesForm')) return;
  const section = document.createElement('section');
  section.id = 'addSpeciesForm';
  section.className = 'control-group';
  section.innerHTML = `
    <h3><i class="fas fa-circle-plus"></i> Add species</h3>
    <label style="display:block;font-size:12px;margin:6px 0 3px" for="newSpeciesName">Species name</label>
    <input id="newSpeciesName" maxlength="60" placeholder="e.g. Macaque" style="width:100%;padding:8px;border:1px solid #ccd8cf;border-radius:6px">
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:7px">
      <label style="font-size:11px">Male<input id="newSpeciesMale" type="number" min="0" step="1" value="0" style="width:100%;padding:7px;border:1px solid #ccd8cf;border-radius:5px"></label>
      <label style="font-size:11px">Female<input id="newSpeciesFemale" type="number" min="0" step="1" value="0" style="width:100%;padding:7px;border:1px solid #ccd8cf;border-radius:5px"></label>
      <label style="font-size:11px">Unknown<input id="newSpeciesUnknown" type="number" min="0" step="1" value="0" style="width:100%;padding:7px;border:1px solid #ccd8cf;border-radius:5px"></label>
    </div>
    <button class="control-btn" id="addSpeciesButton" type="button" style="margin-top:8px"><i class="fas fa-plus"></i> Add species</button>`;
  controls.append(section);
}
function slugify(name) {
  return name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}
async function addSpecies(db) {
  if (!activeUser || !document.body.classList.contains('editing')) {
    setStatus('Sign in as admin and enable Edit Mode before adding a species.', true); return;
  }
  const label = $('newSpeciesName').value.trim();
  if (!label) { $('newSpeciesName').focus(); return; }
  const id = slugify(label);
  if (!id || id === REPORT_DOC_ID) { setStatus('Enter a valid species name.', true); return; }
  const button = $('addSpeciesButton'); button.disabled = true;
  try {
    const ref = doc(db, 'species', id);
    if ((await getDoc(ref)).exists() && !deletedIds.has(id)) {
      setStatus('A species with this name already exists.', true); return;
    }
    const male = safeCount($('newSpeciesMale').value);
    const female = safeCount($('newSpeciesFemale').value);
    const unknown = safeCount($('newSpeciesUnknown').value);
    await setDoc(ref, { label, emoji: '🐒', male, female, unknown, total: male + female + unknown, updatedAt: serverTimestamp() });
    deletedIds.delete(id);
    await setDoc(doc(db, 'species', REPORT_DOC_ID), { deletedSpecies: [...deletedIds], updatedAt: serverTimestamp() }, { merge: true });
    $('newSpeciesName').value = '';
    $('newSpeciesMale').value = $('newSpeciesFemale').value = $('newSpeciesUnknown').value = '0';
    setStatus(`${label} added and saved to Firestore.`);
  } catch (error) {
    console.error('Add species failed:', error);
    setStatus(`Add failed (${error.code || error.message}). Check Firestore write rules.`, true);
  } finally { button.disabled = false; }
}
async function deleteSpecies(db, id, label) {
  if (!activeUser || !document.body.classList.contains('editing')) return;
  if (!confirm(`Delete ${label} from the report and Firestore?`)) return;
  try {
    const nextDeleted = new Set(deletedIds);
    nextDeleted.add(id);
    // Save the deletion marker before deleting the row document. Defaults are hidden using this marker after reload.
    await setDoc(doc(db, 'species', REPORT_DOC_ID), { deletedSpecies: [...nextDeleted], updatedAt: serverTimestamp() }, { merge: true });
    await deleteDoc(doc(db, 'species', id));
    deletedIds.add(id);
    filterDeletedRows();
    setStatus(`${label} deleted and saved. It will remain deleted after reload.`);
  } catch (error) {
    console.error('Delete species failed:', error);
    setStatus(`Delete failed (${error.code || error.message}). Firestore must allow admin writes to __report__ and deletes from species.`, true);
  }
}
function initialize() {
  if (initialized) return;
  const tbody = $('speciesRows'), controls = $('editControls');
  if (!tbody || !controls) return;
  let app;
  try { app = getApp(); } catch { return; }
  initialized = true;
  const auth = getAuth(app), db = getFirestore(app);
  buildAddSpeciesControl();
  onAuthStateChanged(auth, user => { activeUser = user; });
  onSnapshot(doc(db, 'species', REPORT_DOC_ID), snapshot => {
    deletedIds.clear();
    for (const id of snapshot.data()?.deletedSpecies || []) deletedIds.add(id);
    filterDeletedRows();
  }, error => {
    console.error('Could not read persistent deletion markers:', error);
    setStatus(`Could not load delete state (${error.code || error.message}); check Firestore read rules.`, true);
  });
  const observer = new MutationObserver(filterDeletedRows);
  observer.observe(tbody, { childList: true });
  // Capture before the page's row handlers so the delete action uses the persisted tombstone flow.
  tbody.addEventListener('click', event => {
    const button = event.target.closest('.delete-species');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const row = button.closest('tr');
    if (row) deleteSpecies(db, row.dataset.id, row.querySelector('td')?.textContent.trim() || row.dataset.id);
  }, true);
  $('addSpeciesButton').addEventListener('click', () => addSpecies(db));
}

// firebase-config.js imports this module before the page initializes its Firebase app.
// Retry briefly instead of silently abandoning all add/delete handlers on getApp() failure.
function startWhenReady() {
  initialize();
  if (!initialized) setTimeout(startWhenReady, 100);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startWhenReady, { once: true });
else startWhenReady();
