const API = 'api/transactions.php';

const CATEGORIES = {
  expense: ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Other'],
  income: ['Salary', 'Freelance', 'Investment', 'Gift', 'Other'],
};

let categoryChart, monthChart;
let currentType = 'expense';

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  applyStoredTheme();
  populateCategorySelect('txCategory', currentType);
  populateFilterCategories();
  document.getElementById('txDate').value = new Date().toISOString().slice(0, 10);

  loadAll();

  document.getElementById('addBtn').addEventListener('click', () => openModal());
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modalBackdrop') closeModal();
  });
  document.getElementById('txForm').addEventListener('submit', saveTransaction);
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('seedBtn').addEventListener('click', seedDemo);

  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      document.getElementById('txType').value = currentType;
      populateCategorySelect('txCategory', currentType);
    });
  });

  ['searchInput', 'filterType', 'filterCategory', 'filterMonth'].forEach(id => {
    document.getElementById(id).addEventListener('input', debounce(loadTransactions, 250));
  });
  document.getElementById('clearFilters').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterMonth').value = '';
    loadTransactions();
  });
});

function loadAll() {
  loadTransactions();
  loadSummary();
}

// ---------- API calls ----------
async function loadTransactions() {
  const params = new URLSearchParams();
  const search = document.getElementById('searchInput').value.trim();
  const type = document.getElementById('filterType').value;
  const category = document.getElementById('filterCategory').value;
  const month = document.getElementById('filterMonth').value;
  if (search) params.set('search', search);
  if (type) params.set('type', type);
  if (category) params.set('category', category);
  if (month) params.set('month', month);

  try {
    const res = await fetch(`${API}?${params.toString()}`);
    const data = await res.json();
    renderTable(Array.isArray(data) ? data : []);
  } catch (err) {
    renderTable([]);
    showToast('Could not reach the server');
  }
}

async function loadSummary() {
  try {
    const res = await fetch(`${API}?action=summary`);
    const data = await res.json();
    renderCards(data);
    renderCharts(data);
  } catch (err) {
    showToast('Could not load summary');
  }
}

async function saveTransaction(e) {
  e.preventDefault();
  const id = document.getElementById('txId').value;
  const payload = {
    title: document.getElementById('txTitle').value.trim(),
    amount: parseFloat(document.getElementById('txAmount').value),
    type: currentType,
    category: document.getElementById('txCategory').value,
    date: document.getElementById('txDate').value,
    note: document.getElementById('txNote').value.trim(),
  };

  try {
    const res = await fetch(id ? `${API}?id=${id}` : API, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      const msg = data.errors ? Object.values(data.errors).join(', ') : (data.error || 'Something went wrong');
      document.getElementById('formError').textContent = msg;
      return;
    }

    closeModal();
    showToast(id ? 'Transaction updated' : 'Transaction added');
    loadAll();
    populateFilterCategories();
  } catch (err) {
    document.getElementById('formError').textContent = 'Network error — is the PHP server running?';
  }
}

async function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  try {
    await fetch(`${API}?id=${id}`, { method: 'DELETE' });
    showToast('Transaction deleted');
    loadAll();
  } catch (err) {
    showToast('Could not delete');
  }
}

async function seedDemo() {
  try {
    await fetch(`${API}?action=seed`, { method: 'POST' });
    showToast('Demo data loaded');
    populateFilterCategories();
    loadAll();
  } catch (err) {
    showToast('Could not seed data');
  }
}

// ---------- Rendering ----------
function renderCards(s) {
  document.getElementById('statBalance').textContent = formatCurrency(s.balance);
  document.getElementById('statIncome').textContent = formatCurrency(s.income);
  document.getElementById('statExpense').textContent = formatCurrency(s.expense);
  const totalTx = (s.byMonth || []).reduce((sum) => sum, 0);
}

function renderTable(rows) {
  const body = document.getElementById('txTableBody');
  document.getElementById('statCount').textContent = rows.length;

  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="empty">No transactions yet — add one or load demo data.</td></tr>`;
    return;
  }

  body.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.title)}</td>
      <td><span class="pill pill-${r.type}">${escapeHtml(r.category)}</span></td>
      <td>${formatDate(r.date)}</td>
      <td>${escapeHtml(r.note || '—')}</td>
      <td class="right amount-${r.type}">${r.type === 'income' ? '+' : '−'} ${formatCurrency(r.amount)}</td>
      <td class="right">
        <div class="row-actions">
          <button class="icon-btn" onclick='editTransaction(${JSON.stringify(r)})' title="Edit">✎</button>
          <button class="icon-btn danger" onclick="deleteTransaction(${r.id})" title="Delete">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderCharts(s) {
  const catCtx = document.getElementById('categoryChart');
  const catLabels = (s.byCategory || []).map(c => c.category);
  const catData = (s.byCategory || []).map(c => c.total);
  const palette = ['#6d5efc', '#f0466b', '#16a97e', '#f5a524', '#3aa0ff', '#c964f0', '#ff7849', '#48c9b0'];

  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(catCtx, {
    type: 'doughnut',
    data: {
      labels: catLabels.length ? catLabels : ['No data'],
      datasets: [{
        data: catData.length ? catData : [1],
        backgroundColor: catLabels.length ? palette : ['#e7e9f3'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } } },
      cutout: '65%',
    },
  });

  const monCtx = document.getElementById('monthChart');
  const months = (s.byMonth || []).map(m => m.month);
  const income = (s.byMonth || []).map(m => m.income);
  const expense = (s.byMonth || []).map(m => m.expense);

  if (monthChart) monthChart.destroy();
  monthChart = new Chart(monCtx, {
    type: 'bar',
    data: {
      labels: months.length ? months : ['No data'],
      datasets: [
        { label: 'Income', data: income.length ? income : [0], backgroundColor: '#16a97e', borderRadius: 6 },
        { label: 'Expense', data: expense.length ? expense : [0], backgroundColor: '#f0466b', borderRadius: 6 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 11 } } } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

// ---------- Modal ----------
function openModal(tx = null) {
  document.getElementById('formError').textContent = '';
  document.getElementById('modalTitle').textContent = tx ? 'Edit Transaction' : 'Add Transaction';
  document.getElementById('txId').value = tx ? tx.id : '';
  document.getElementById('txTitle').value = tx ? tx.title : '';
  document.getElementById('txAmount').value = tx ? tx.amount : '';
  document.getElementById('txDate').value = tx ? tx.date : new Date().toISOString().slice(0, 10);
  document.getElementById('txNote').value = tx ? (tx.note || '') : '';

  currentType = tx ? tx.type : 'expense';
  document.getElementById('txType').value = currentType;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === currentType));
  populateCategorySelect('txCategory', currentType);
  if (tx) document.getElementById('txCategory').value = tx.category;

  document.getElementById('modalBackdrop').classList.add('open');
}

function editTransaction(tx) { openModal(tx); }

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
  document.getElementById('txForm').reset();
}

// ---------- Helpers ----------
function populateCategorySelect(id, type) {
  const select = document.getElementById(id);
  select.innerHTML = CATEGORIES[type].map(c => `<option value="${c}">${c}</option>`).join('');
}

async function populateFilterCategories() {
  const all = [...new Set([...CATEGORIES.expense, ...CATEGORIES.income])];
  const select = document.getElementById('filterCategory');
  const current = select.value;
  select.innerHTML = '<option value="">All Categories</option>' + all.map(c => `<option value="${c}">${c}</option>`).join('');
  select.value = current;
}

function formatCurrency(n) {
  const num = Number(n) || 0;
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('spendwise-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeToggle').textContent = isDark ? '🌙 Dark mode' : '☀️ Light mode';
}
function applyStoredTheme() {
  const saved = localStorage.getItem('spendwise-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeToggle').textContent = saved === 'dark' ? '☀️ Light mode' : '🌙 Dark mode';
}
