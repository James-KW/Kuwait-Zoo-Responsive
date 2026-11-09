import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const REPORT_DOC_ID = '__report__';
const deletedIds = new Set();
let observer;
let activeUser = null;

function $(id) { return document.getElementById(id); }

function safeCount(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function reportTotals() {
  const rows = [...document.querySelectorAll('#speciesRows tr')];
  let male = 0, female = 0, unknown = 0, total = 0, chimpanzees = 0, monkeySpecies = 0;
  for (const row of rows) {
    const cells = row.querySelectorAll('[data-field]');
    const values = Object.fromEntries([...cells].map(cell => [cell.dataset.field, safeCount(cell.textContent.trim())]));
    const rowTotal = values.male + values.female + values.unknown;
    male += values.male; female += values.female; unknown += values.unknown; total += rowTotal;
    if ((row.dataset.id || '').startsWith('chimp')) chimpanzees += rowTotal;
    else monkeySpecies++;
  }
  const assign = (id, value) => { const element = $(id); if (element) element.textContent = value; };
  assign('speciesCount', monkeySpecies);
  assign('populationTotal', total);
  assign('maleTotal', male);
  assign('femaleTotal', female);
  assign('unknownTotal', unknown);
  assign('chimpTotal', chimpanzees);
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
    alert('Sign in and enable Edit Mode first.');
    return;
  }
  const label = $('newSpeciesName').value.trim();
  if (!label) { $('newSpeciesName').focus(); return; }
  const id = slugify(label);
  if (!id || id === REPORT_DOC_ID) { alert('Please enter a valid species name.'); return; }
  const ref = doc(db, 'species', id);
  const button = $('addSpeciesButton');
  button.disabled = true;
  try {
    if ((await getDoc(ref)).exists()) {
      alert('A species with this name/ID already exists.');
      return;
    }
    const male = safeCount($('newSpeciesMale').value);
    const female = safeCount($('newSpeciesFemale').value);
    const unknown = safeCount($('newSpeciesUnknown').value);
    await setDoc(ref, { label, emoji: '🐒', male, female, unknown, total: male + female + unknown, updatedAt: serverTimestamp() });
    deletedIds.delete(id);
    await setDoc(doc(db, 'species', REPORT_DOC_ID), { deletedSpecies: [...deletedIds], updatedAt: serverTimestamp() }, { merge: true });
    $('newSpeciesName').value = '';
    $('newSpeciesMale').value = $('newSpeciesFemale').value = $('newSpeciesUnknown').value = '0';
    const status = $('status');
    status.textContent = `${label} added and saved to Firestore.`;
    status.style.color = '#20743b';
  } catch (error) {
    console.error(error);
    const status = $('status');
    status.textContent = 'Could not add species. Check Firestore write rules and try again.';
    status.style.color = '#b42318';
  } finally {
    button.disabled = false;
  }
}

async function deleteSpecies(db, id, label) {
  if (!activeUser || !document.body.classList.contains('editing')) return;
  if (!confirm(`Delete ${label} permanently from Firestore?`)) return;
  const status = $('status');
  try {
    const nextDeleted = new Set(deletedIds);
    nextDeleted.add(id);
    // Persist the tombstone first so default species are not reintroduced on refresh.
    await setDoc(doc(db, 'species', REPORT_DOC_ID), { deletedSpecies: [...nextDeleted], updatedAt: serverTimestamp() }, { merge: true });
    await deleteDoc(doc(db, 'species', id));
    deletedIds.add(id);
    filterDeletedRows();
    status.textContent = `${label} deleted and saved. It will stay deleted after reload.`;
    status.style.color = '#20743b';
  } catch (error) {
    console.error(error);
    status.textContent = 'Delete failed. Check that Firestore rules allow the admin to update __report__ and delete species documents.';
    status.style.color = '#b42318';
  }
}

function initialize() {
  if (!$('speciesRows') || !$('editControls')) return;
  let app;
  try { app = getApp(); } catch { return; }
  const auth = getAuth(app), db = getFirestore(app);
  buildAddSpeciesControl();
  onAuthStateChanged(auth, user => { activeUser = user; });

  onSnapshot(collection(db, 'species'), snapshot => {
    const metadata = snapshot.docs.find(item => item.id === REPORT_DOC_ID)?.data();
    deletedIds.clear();
    for (const id of metadata?.deletedSpecies || []) deletedIds.add(id);
    filterDeletedRows();
  }, error => console.error('Could not load persisted deleted species:', error));

  const tbody = $('speciesRows');
  observer = new MutationObserver(filterDeletedRows);
  observer.observe(tbody, { childList: true });
  tbody.addEventListener('click', event => {
    const button = event.target.closest('.delete-species');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const row = button.closest('tr');
    if (row) deleteSpecies(db, row.dataset.id, row.querySelector('td')?.textContent.trim() || row.dataset.id);
  }, true);
  $('addSpeciesButton').addEventListener('click', () => addSpecies(db));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
