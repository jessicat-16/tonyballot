// ==========================================
// SUPABASE CONFIGURATION
// ==========================================
// USER: Replace these with your actual Supabase project URL and Anon Key.
// You can find them in your Supabase Dashboard under Settings > API.
const SUPABASE_URL = 'https://lysduxclrsczzuqdjnpo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YCWYZuRTxliXl67cebn2zQ_cr10xIS4';;

let supabase;

if (SUPABASE_URL !== 'https://lysduxclrsczzuqdjnpo.supabase.co') {
  // Initialize Supabase Client
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  document.getElementById('supabase-warning').style.display = 'block';
  console.warn("Supabase is not configured. The app will not save data.");
}

// ==========================================
// STATE
// ==========================================
const state = {
  nickname: localStorage.getItem('tonyNickname') || '',
  groupId: localStorage.getItem('tonyGroupId') || null,
  groupCode: localStorage.getItem('tonyGroupCode') || '',
  groupName: localStorage.getItem('tonyGroupName') || '',
  bracketId: localStorage.getItem('tonyBracketId') || null,
  picks: JSON.parse(localStorage.getItem('tonyPicks') || '{}'),
  masterKey: {},
  isAdminMode: false
};

// ==========================================
// DOM ELEMENTS
// ==========================================
const pages = {
  home: document.getElementById('page-home'),
  bracket: document.getElementById('page-bracket'),
  leaderboard: document.getElementById('page-leaderboard'),
  admin: document.getElementById('page-admin')
};

const nav = {
  menu: document.getElementById('nav-menu'),
  bracket: document.getElementById('btn-nav-bracket'),
  leaderboard: document.getElementById('btn-nav-leaderboard'),
  admin: document.getElementById('btn-nav-admin'),
  logout: document.getElementById('btn-nav-logout')
};

const alerts = document.getElementById('alert-container');

// ==========================================
// UTILITIES
// ==========================================
function showAlert(message, type = 'success') {
  alerts.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => { alerts.innerHTML = ''; }, 4000);
}

function showPage(pageId) {
  Object.values(pages).forEach(p => p.classList.add('hidden'));
  pages[pageId].classList.remove('hidden');

  if (state.groupId) {
    nav.menu.classList.remove('hidden');
  } else {
    nav.menu.classList.add('hidden');
  }
}

function generateGroupCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ==========================================
// RENDER FUNCTIONS
// ==========================================
function renderCategories(containerId, isMasterKey = false) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  tonyNominees.forEach(category => {
    const section = document.createElement('div');
    section.className = 'category';

    const title = document.createElement('h2');
    title.textContent = category.name;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'nominee-grid';

    category.nominees.forEach(nominee => {
      const card = document.createElement('div');
      card.className = 'nominee-card';

      const targetPicks = isMasterKey ? state.masterKey : state.picks;

      if (targetPicks[category.id] === nominee.id) {
        card.classList.add('selected');
      }

      card.innerHTML = `
        <div class="nominee-name">${nominee.name}</div>
        <div class="nominee-show">${nominee.show}</div>
      `;

      card.onclick = () => {
        // Toggle selection logic
        if (targetPicks[category.id] === nominee.id) {
          delete targetPicks[category.id];
        } else {
          targetPicks[category.id] = nominee.id;
        }

        // Re-render
        renderCategories(containerId, isMasterKey);
      };

      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

function updateBracketHeader() {
  document.getElementById('bracket-group-name').textContent = state.groupName;
  document.getElementById('bracket-group-code').textContent = state.groupCode;
}

// ==========================================
// DATABASE INTERACTIONS
// ==========================================
async function fetchMasterKey() {
  if (!supabase) return;
  const { data, error } = await supabase.from('master_key').select('*').limit(1).single();
  if (error) {
    if (error.code === 'PGRST116') { // No rows found
      await supabase.from('master_key').insert([{ winners: {} }]);
    } else {
      console.error('Error fetching master key:', error);
    }
    return;
  }
  if (data) state.masterKey = data.winners;
}

async function fetchBracket() {
  if (!supabase || !state.groupId || !state.nickname) return;

  const { data, error } = await supabase
    .from('brackets')
    .select('*')
    .eq('group_id', state.groupId)
    .eq('user_name', state.nickname)
    .limit(1)
    .single();

  if (data) {
    state.bracketId = data.id;
    state.picks = data.picks;
    localStorage.setItem('tonyBracketId', data.id);
    localStorage.setItem('tonyPicks', JSON.stringify(data.picks));
  }
}

async function loadLeaderboard() {
  if (!supabase || !state.groupId) return;
  await fetchMasterKey();

  const { data: brackets, error } = await supabase
    .from('brackets')
    .select('*')
    .eq('group_id', state.groupId);

  if (error) {
    showAlert('Failed to load leaderboard', 'error');
    return;
  }

  // Calculate scores
  const masterKeyPairs = Object.entries(state.masterKey);
  const scoredBrackets = brackets.map(b => {
    let score = 0;
    masterKeyPairs.forEach(([cat, winnerId]) => {
      if (b.picks[cat] === winnerId) score += 1;
    });
    return { ...b, calculatedScore: score };
  });

  // Sort by score descending
  scoredBrackets.sort((a, b) => b.calculatedScore - a.calculatedScore);

  // Render
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '';

  if (scoredBrackets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">No brackets found.</td></tr>';
    return;
  }

  scoredBrackets.forEach((b, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rank">#${index + 1}</td>
      <td>${b.user_name} ${b.user_name === state.nickname ? '(You)' : ''}</td>
      <td><span class="score-badge">${b.calculatedScore}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// EVENT HANDLERS
// ==========================================
document.getElementById('btn-create').addEventListener('click', async () => {
  const nickname = document.getElementById('nickname').value.trim();
  const groupName = document.getElementById('group-name').value.trim();

  if (!nickname || !groupName) return showAlert('Nickname and Group Name are required', 'error');
  if (!supabase) return showAlert('Supabase is not configured', 'error');

  const code = generateGroupCode();

  const { data, error } = await supabase.from('groups').insert([{ name: groupName, code }]).select().single();

  if (error) return showAlert('Error creating group', 'error');

  state.nickname = nickname;
  state.groupId = data.id;
  state.groupName = data.name;
  state.groupCode = data.code;

  localStorage.setItem('tonyNickname', nickname);
  localStorage.setItem('tonyGroupId', data.id);
  localStorage.setItem('tonyGroupName', data.name);
  localStorage.setItem('tonyGroupCode', data.code);

  updateBracketHeader();
  renderCategories('categories-container', false);
  showPage('bracket');
  showAlert('Group created successfully!');
});

document.getElementById('btn-join').addEventListener('click', async () => {
  const nickname = document.getElementById('nickname').value.trim();
  const code = document.getElementById('join-code').value.trim().toUpperCase();

  if (!nickname || !code) return showAlert('Nickname and Group Code are required', 'error');
  if (!supabase) return showAlert('Supabase is not configured', 'error');

  const { data, error } = await supabase.from('groups').select('*').eq('code', code).single();

  if (error || !data) return showAlert('Group not found', 'error');

  state.nickname = nickname;
  state.groupId = data.id;
  state.groupName = data.name;
  state.groupCode = data.code;

  localStorage.setItem('tonyNickname', nickname);
  localStorage.setItem('tonyGroupId', data.id);
  localStorage.setItem('tonyGroupName', data.name);
  localStorage.setItem('tonyGroupCode', data.code);

  await fetchBracket();

  updateBracketHeader();
  renderCategories('categories-container', false);
  showPage('bracket');
  showAlert('Joined group successfully!');
});

document.getElementById('btn-save-bracket').addEventListener('click', async () => {
  if (!supabase || !state.groupId) return;

  const picksJSON = JSON.stringify(state.picks);
  localStorage.setItem('tonyPicks', picksJSON);

  let error;
  if (state.bracketId) {
    const res = await supabase.from('brackets').update({ picks: state.picks }).eq('id', state.bracketId);
    error = res.error;
  } else {
    const res = await supabase.from('brackets').insert([{
      group_id: state.groupId,
      user_name: state.nickname,
      picks: state.picks
    }]).select().single();

    error = res.error;
    if (res.data) {
      state.bracketId = res.data.id;
      localStorage.setItem('tonyBracketId', res.data.id);
    }
  }

  if (error) showAlert('Error saving picks', 'error');
  else showAlert('Picks saved successfully!');
});

document.getElementById('btn-save-master').addEventListener('click', async () => {
  if (!supabase) return;
  // Assuming ID 1 or updating all (there should only be one row)
  const { data: rows } = await supabase.from('master_key').select('id').limit(1);

  if (rows && rows.length > 0) {
    const { error } = await supabase.from('master_key').update({ winners: state.masterKey }).eq('id', rows[0].id);
    if (error) showAlert('Error saving Master Key', 'error');
    else showAlert('Master Key updated globally!');
  }
});

// Navigation
nav.bracket.addEventListener('click', () => {
  renderCategories('categories-container', false);
  showPage('bracket');
});

nav.leaderboard.addEventListener('click', () => {
  loadLeaderboard();
  showPage('leaderboard');
});

nav.admin.addEventListener('click', async () => {
  const pwd = prompt("Enter Admin Password (try 'admin'):");
  if (pwd === 'admin') {
    await fetchMasterKey();
    renderCategories('admin-categories-container', true);
    showPage('admin');
  } else if (pwd !== null) {
    showAlert('Incorrect password', 'error');
  }
});

nav.logout.addEventListener('click', () => {
  localStorage.clear();
  state.groupId = null;
  state.bracketId = null;
  state.picks = {};

  document.getElementById('nickname').value = '';
  document.getElementById('join-code').value = '';
  document.getElementById('group-name').value = '';

  showPage('home');
});

// ==========================================
// INITIALIZATION
// ==========================================
function init() {
  document.getElementById('nickname').value = state.nickname;

  if (state.groupId) {
    updateBracketHeader();
    renderCategories('categories-container', false);
    showPage('bracket');
  } else {
    showPage('home');
  }
}

init();
