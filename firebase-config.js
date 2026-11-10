import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, onSnapshot, deleteDoc, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app), $ = id => document.getElementById(id), rows = $('speciesRows'), REPORT_ID = '__report__';
let user = null, edit = false, dirty = false, data = [], desiredScale = .85, reportNote = 'Total baboons = 9; Old cage: 5 (2M, 3F); New Cage: 4 (2M, 2F). Lemur has 1 baby monkey.', reportSummary = '';
const defaults = [
  ['lemur', 'Lemur', '🐒', 3, 4, 1],
  ['squirrel_monkey', 'Squirrel Monkey', '🐵', 5, 1, 0],
  ['baboon', 'Baboon', '🐒', 4, 5, 0],
  ['vervets', 'Vervets', '🐒', 5, 6, 0],
  ['rhesus', 'Rhesus', '🐒', 4, 0, 0],
  ['chimpanzee_big', 'Chimpanzee (Big)', '🐵', 0, 0, 1],
  ['chimpanzee_small', 'Chimpanzee (Small)', '🐵', 3, 1, 0],
  ['mona', 'Mona', '🐒', 0, 1, 0]
];
const num = x => Number.isSafeInteger(Number(x)) && Number(x) >= 0 ? Number(x) : 0;
const total = x => num(x.total ?? num(x.male) + num(x.female) + num(x.unknown));

function fitReport() {
  const mobile = matchMedia('(max-width:700px)').matches;
  const pxPerCm = 96 / 2.54;
  const desired = mobile ? 0.9 : desiredScale;
  const available = mobile ? Math.max(240, innerWidth - 16) : Infinity;
  const scale = mobile ? Math.min(desired, available / (21 * pxPerCm)) : desiredScale;
  document.documentElement.style.setProperty('--report-scale', scale);
}

function updateStats(list) {
  const t = list.reduce((a, x) => ({ male: a.male + num(x.male), female: a.female + num(x.female), unknown: a.unknown + num(x.unknown), total: a.total + total(x) }), { male: 0, female: 0, unknown: 0, total: 0 });
  $('speciesCount').textContent = list.length;
  $('populationTotal').textContent = t.total;
  $('maleTotal').textContent = t.male;
  $('femaleTotal').textContent = t.female;
  $('unknownTotal').textContent = t.unknown;
  $('chimpTotal').textContent = list.filter(x => /chimp/i.test(x.label || x.id)).reduce((sum, x) => sum + total(x), 0);
}

function render(list) {
  data = list;
  rows.replaceChildren();
  for (const x of list) {
    const tr = document.createElement('tr');
    tr.dataset.id = x.id;
    const species = document.createElement('td');
    const wrap = document.createElement('div');
    const emoji = document.createElement('span');
    const label = document.createElement('strong');
    const del = document.createElement('button');
    wrap.className = 'species-name';
    emoji.className = 'emoji';
    emoji.textContent = x.emoji || '🐒';
    label.textContent = x.label || x.id;
    wrap.append(emoji, label);
    del.className = 'delete-species';
    del.type = 'button';
    del.title = `Delete ${x.label || x.id}`;
    del.setAttribute('aria-label', `Delete ${x.label || x.id}`);
    del.innerHTML = '<i class="fas fa-trash"></i>';
    del.addEventListener('click', () => removeSpecies(x.id, x.label || x.id));
    wrap.append(del);
    species.append(wrap);
    tr.append(species);

    for (const field of ['male', 'female', 'unknown']) {
      const td = document.createElement('td');
      td.textContent = num(x[field]);
      td.dataset.field = field;
      td.contentEditable = String(edit);
      td.spellcheck = false;
      tr.append(td);
    }

    const sum = document.createElement('td');
    sum.textContent = total(x);
    tr.append(sum);
    rows.append(tr);
  }

  updateStats(list);
  fitReport();
}

function edited() {
  return [...rows.querySelectorAll('tr')].map(tr => {
    const x = { ...(data.find(y => y.id === tr.dataset.id) || {}), id: tr.dataset.id };
    for (const f of ['male', 'female', 'unknown']) x[f] = num(tr.querySelector(`[data-field="${f}"]`)?.textContent || 0);
    x.total = x.male + x.female + x.unknown;
    x.label = tr.querySelector('.species-name strong')?.textContent.trim() || x.label || x.id;
    return x;
  });
}

function setEdit(value) {
  edit = value;
  document.body.classList.toggle('editing', value);
  rows.querySelectorAll('[data-field]').forEach(x => x.contentEditable = String(value));
  document.querySelectorAll('.editable-copy').forEach(el => el.setAttribute('contenteditable', String(value)));
  $('editStatus').classList.toggle('active', value);
  $('editBtn').classList.toggle('active', value);
  $('status').textContent = value ? 'Edit mode active' : 'Edit mode disabled';
}

async function removeSpecies(id, label) {
  if (!user || !edit) return;
  if (!confirm(`Delete ${label} from the population report and Firestore?`)) return;
  try {
    await deleteDoc(doc(db, 'species', id));
    dirty = true;
    data = data.filter(x => x.id !== id);
    render(data);
    dirty = false;
    $('status').textContent = `${label} deleted from Firestore.`;
  } catch (e) {
    console.error(e);
    $('status').textContent = 'Delete failed. Check Firestore rules allow your admin account to delete species.';
  }
}

rows.addEventListener('input', () => {
  if (edit) {
    dirty = true;
    updateStats(edited());
    $('status').textContent = 'Unsaved changes';
    fitReport();
  }
});

document.querySelectorAll('.editable-copy').forEach(el => el.addEventListener('input', () => {
  if (edit) {
    dirty = true;
    $('status').textContent = 'Unsaved report text changes';
    fitReport();
  }
}));

async function save() {
  if (!user || !edit) return;
  const list = edited(), note = $('populationNote').textContent.trim(), summary = $('summaryText').textContent.trim();
  $('saveBtn').disabled = true;
  $('statusSave').disabled = true;
  $('status').textContent = 'Saving changes…';

  try {
    for (const x of list) {
      await setDoc(doc(db, 'species', x.id), {
        label: x.label,
        emoji: x.emoji || '🐒',
        male: x.male,
        female: x.female,
        unknown: x.unknown,
        total: x.total,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    await setDoc(doc(db, 'species', REPORT_ID), {
      populationNote: note,
      populationSummary: summary,
      updatedAt: serverTimestamp()
    }, { merge: true });
    reportNote = note;
    reportSummary = summary;
    data = list;
    dirty = false;
    $('status').textContent = 'Population, note, and summary saved to Firestore.';
    $('status').style.color = '#20743b';
  } catch (e) {
    console.error(e);
    $('status').textContent = 'Save failed. Check Firestore rules for writes to the species collection.';
    $('status').style.color = '#b42318';
  } finally {
    $('saveBtn').disabled = !edit;
    $('statusSave').disabled = false;
    fitReport();
  }
}

$('editBtn').addEventListener('click', () => setEdit(!edit));
$('saveBtn').addEventListener('click', save);
$('statusSave').addEventListener('click', save);
$('cancelEdit').addEventListener('click', () => {
  dirty = false;
  render(data);
  $('populationNote').textContent = reportNote;
  if (reportSummary) $('summaryText').textContent = reportSummary;
  setEdit(false);
});
$('logoutBtn').addEventListener('click', async () => { await signOut(auth); location.reload(); });

onAuthStateChanged(auth, u => {
  user = u;
  $('authLabel').textContent = u ? `Admin Mode | ${u.email || 'signed in'}` : 'Public Population View';
  $('loginLink').hidden = !!u;
  $('logoutBtn').hidden = !u;
  $('editControls').hidden = !u;
  $('panelMode').textContent = u ? 'Admin signed in' : 'Public view';
  if (!u && edit) setEdit(false);
});

onSnapshot(collection(db, 'species'), snap => {
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const meta = docs.find(x => x.id === REPORT_ID);
  if (meta) {
    if (typeof meta.populationNote === 'string') reportNote = meta.populationNote;
    if (typeof meta.populationSummary === 'string') reportSummary = meta.populationSummary;
    $('populationNote').textContent = reportNote;
    if (!edit && reportSummary) $('summaryText').textContent = reportSummary;
  }
  if (dirty) return;
  const speciesDocs = docs.filter(x => x.id !== REPORT_ID);
  const list = defaults.map(base => speciesDocs.find(x => x.id === base[0]) || { id: base[0], label: base[1], emoji: base[2], male: base[3], female: base[4], unknown: base[5], total: base[3] + base[4] + base[5] }).filter(x => !x.deleted);
  for (const x of speciesDocs) if (!defaults.some(y => y[0] === x.id) && !x.deleted) list.push(x);
  render(list);
  $('status').textContent = 'Live data connected';
}, e => {
  console.error(e);
  render(defaults.map(([id, label, emoji, male, female, unknown]) => ({ id, label, emoji, male, female, unknown, total: male + female + unknown })));
  $('status').textContent = 'Using default data; Firestore connection unavailable.';
});

const date = () => new Date().toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).replace(',', '');
function setDates() {
  const d = date();
  $('#footerDate').textContent = d;
  $('#sideDate').textContent = d;
}
setDates();

$('panelToggle').addEventListener('click', () => {
  const open = $('sidePanel').classList.toggle('open');
  $('panelToggle').textContent = open ? 'Hide controls' : 'Show controls';
  $('panelToggle').setAttribute('aria-expanded', String(open));
});

const historyKey = 'kuwaitZooImageHistory';
function loadHistory() {
  const el = $('imageHistory');
  let history = [];
  try { history = JSON.parse(localStorage.getItem(historyKey) || '[]'); } catch {}
  el.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No saved images yet';
    el.append(empty);
    return;
  }
  for (const item of history.slice(0, 5)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'history-item';
    btn.textContent = item.name;
    btn.addEventListener('click', () => {
      const img = new Image();
      img.src = item.data;
      img.alt = item.name;
      const wrapped = document.createElement('div');
      wrapped.className = 'history-preview';
      wrapped.append(img);
      document.body.append(wrapped);
    });
    el.append(btn);
  }
}

$('downloadBtn').addEventListener('click', async () => {
  const node = $('capture');
  const canvas = await html2canvas(node, { scale: 2, useCORS: true });
  const dataUrl = canvas.toDataURL('image/png');
  const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
  history.push({ name: `KuwaitZoo-${Date.now()}.png`, data: dataUrl });
  localStorage.setItem(historyKey, JSON.stringify(history.slice(-5)));
  loadHistory();
  $('status').textContent = 'Image downloaded and saved';
});

$('clearHistory').addEventListener('click', () => {
  localStorage.removeItem(historyKey);
  loadHistory();
});

loadHistory();
