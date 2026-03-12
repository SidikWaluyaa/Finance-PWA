/**
 * MyFinance App - Core Logic (v4 - Budgeting & Visuals)
 */

const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbzgkyLoyh6EQazlJU1IZi1CsEbAGGWeOZizjcum85BKs67i-Mxai5c3ZIbrFPmfvskhlA/exec',
    CURRENCY: 'Rp'
};

// Map categories to emojis/icons
const CATEGORY_MAP = {
    'makanan': '🍔',
    'minuman': '☕',
    'gaji': '💰',
    'transport': '🚗',
    'belanja': '🛍️',
    'hiburan': '🎬',
    'kesehatan': '🏥',
    'tagihan': '📑',
    'pendidikan': '🎓',
    'lainnya': '📦'
};

let state = {
    transactions: [],
    theme: localStorage.getItem('theme') || 'light',
    activeSection: 'dashboard',
    budgets: JSON.parse(localStorage.getItem('budgets')) || {}
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initPWA();
    initTheme();
    initNavigation();
    initForms();
    initCharts();
    loadData();
    
    // Custom Actions
    const refreshBtn = document.getElementById('force-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(regs => {
                    regs.forEach(r => r.unregister());
                    window.location.reload(true);
                });
            } else {
                window.location.reload(true);
            }
        });
    }

    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);

    const saveBudgetBtn = document.getElementById('save-budget-btn');
    if (saveBudgetBtn) saveBudgetBtn.addEventListener('click', saveBudget);
});

function initPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js').catch(e => console.error(e));
    }
}

function initTheme() {
    const toggle = document.getElementById('dark-mode-toggle');
    if (state.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    if (toggle) {
        toggle.checked = state.theme === 'dark';
        toggle.addEventListener('change', (e) => {
            state.theme = e.target.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', state.theme);
            localStorage.setItem('theme', state.theme);
        });
    }
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const sections = document.querySelectorAll('.page-section');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetSection = item.getAttribute('data-section');
            if (targetSection === state.activeSection) return;

            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(s => s.classList.remove('active'));
            const targetEl = document.getElementById(`section-${targetSection}`);
            if (targetEl) targetEl.classList.add('active');

            state.activeSection = targetSection;
            if (pageTitle) pageTitle.textContent = targetSection.charAt(0).toUpperCase() + targetSection.slice(1);
            if (targetSection === 'statistik') renderDetailChart();
            if (targetSection === 'dashboard') updateUI();
        });
    });
}

function initForms() {
    const form = document.getElementById('transaction-form');
    const dateInput = document.getElementById('t-date');
    if (dateInput) dateInput.valueAsDate = new Date();

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                action: 'addTransaction',
                tanggal: document.getElementById('t-date').value,
                jenis: document.getElementById('t-type').value,
                kategori: document.getElementById('t-category').value,
                nominal: parseFloat(document.getElementById('t-amount').value),
                catatan: document.getElementById('t-note').value
            };

            showToast('Menyimpan...');
            try {
                const res = await fetch(CONFIG.API_URL, { 
                    method: 'POST', 
                    body: JSON.stringify(formData) 
                });
                const result = await res.json();
                if (result.status === 'success') {
                    showToast('Berhasil disimpan!');
                    form.reset();
                    if (dateInput) dateInput.valueAsDate = new Date();
                    loadData();
                } else throw new Error(result.message);
            } catch (err) {
                showToast('Gagal: ' + err.message);
            }
        });
    }

    const search = document.getElementById('search-input');
    if (search) {
        search.addEventListener('input', (e) => renderTransactionList(e.target.value.toLowerCase()));
    }
}

// --- Data Management ---
async function loadData() {
    try {
        const res = await fetch(`${CONFIG.API_URL}?action=getTransactions`);
        const data = await res.json();
        state.transactions = data;
        updateUI();
    } catch (e) {
        showToast("Gagal memuat data.");
    }
}

function updateUI() {
    calculateSummary();
    renderTransactionList();
    renderBudgetInfo();
    updateCharts();
}

function calculateSummary() {
    const inc = state.transactions.filter(t => t.jenis === 'pemasukan').reduce((s, t) => s + (parseFloat(t.nominal) || 0), 0);
    const exp = state.transactions.filter(t => t.jenis === 'pengeluaran').reduce((s, t) => s + (parseFloat(t.nominal) || 0), 0);
    
    document.getElementById('total-balance').textContent = formatCurrency(inc - exp);
    document.getElementById('total-income').textContent = formatCurrency(inc);
    document.getElementById('total-expense').textContent = formatCurrency(exp);
}

function renderTransactionList(query = '') {
    const list = document.getElementById('transaction-list');
    if (!list) return;
    list.innerHTML = '';
    
    const filtered = state.transactions.filter(t => 
        (t.kategori && t.kategori.toLowerCase().includes(query)) || 
        (t.catatan && t.catatan.toLowerCase().includes(query))
    );

    filtered.forEach(t => {
        const item = document.createElement('div');
        item.className = 'transaction-item';
        const categoryKey = (t.kategori || '').toLowerCase();
        const icon = CATEGORY_MAP[categoryKey] || '📦';
        
        item.innerHTML = `
            <div class="t-icon-box">${icon}</div>
            <div class="t-info">
                <span class="t-category">${t.kategori || 'Lainnya'}</span>
                <span class="t-date">${new Date(t.tanggal).toLocaleDateString('id-ID')}</span>
            </div>
            <div class="t-amount ${t.jenis}">${t.jenis === 'pemasukan' ? '+' : '-'} ${formatCurrency(t.nominal)}</div>
        `;
        list.appendChild(item);
    });
}

function renderBudgetInfo() {
    const container = document.getElementById('budget-summary');
    if (!container) return;
    container.innerHTML = '';

    const expenses = state.transactions.filter(t => t.jenis === 'pengeluaran');
    const categories = Object.keys(state.budgets);

    if (categories.length === 0) {
        container.innerHTML = '<p class="text-light" style="font-size: 0.8rem;">Belum ada budget yang diatur.</p>';
        return;
    }

    categories.forEach(cat => {
        const limit = state.budgets[cat];
        const spent = expenses.filter(t => t.kategori.toLowerCase() === cat.toLowerCase()).reduce((s, t) => s + t.nominal, 0);
        const percent = Math.min(100, (spent / limit) * 100);
        const color = percent > 90 ? 'var(--expense)' : (percent > 70 ? '#F59E0B' : 'var(--income)');

        const el = document.createElement('div');
        el.className = 'budget-item';
        el.innerHTML = `
            <div class="budget-label">
                <span>${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                <span>${formatCurrency(spent)} / ${formatCurrency(limit)}</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percent}%; background: ${color}"></div>
            </div>
        `;
        container.appendChild(el);
    });
}

function saveBudget() {
    const cat = document.getElementById('budget-category').value.toLowerCase().trim();
    const limit = parseFloat(document.getElementById('budget-limit').value);
    
    if (cat && limit) {
        state.budgets[cat] = limit;
        localStorage.setItem('budgets', JSON.stringify(state.budgets));
        showToast(`Budget ${cat} disimpan!`);
        updateUI();
    }
}

function exportToCSV() {
    if (state.transactions.length === 0) return;
    
    let csv = 'ID,Tanggal,Jenis,Kategori,Nominal,Catatan\n';
    state.transactions.forEach(t => {
        csv += `${t.id},${t.tanggal},${t.jenis},${t.kategori},${t.nominal},"${t.catatan}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Keuangan_${new Date().toLocaleDateString()}.csv`;
    a.click();
    showToast('Laporan diunduh!');
}

function formatCurrency(n) {
    return "Rp " + (parseFloat(n) || 0).toLocaleString('id-ID');
}

function showToast(m) {
    const t = document.getElementById('toast');
    if (t) {
        t.textContent = m;
        t.classList.remove('hidden');
        setTimeout(() => t.classList.add('hidden'), 3000);
    }
}

// --- Charts ---
let catChart, trendChart, detailChart;
function initCharts() {
    const catCtx = document.getElementById('categoryChart');
    const trendCtx = document.getElementById('trendChart');
    if (!catCtx || !trendCtx) return;

    catChart = new Chart(catCtx, {
        type: 'doughnut',
        data: { labels: [], datasets: [{ data: [], backgroundColor: ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'] }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });

    trendChart = new Chart(trendCtx, {
        type: 'bar',
        data: { labels: ['Pemasukan', 'Pengeluaran'], datasets: [{ data: [0, 0], backgroundColor: ['#10B981', '#EF4444'] }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

function updateCharts() {
    if (!catChart || !trendChart) return;
    const expItems = state.transactions.filter(t => t.jenis === 'pengeluaran');
    const cats = {};
    expItems.forEach(i => { cats[i.kategori] = (cats[i.kategori] || 0) + (parseFloat(i.nominal) || 0); });
    catChart.data.labels = Object.keys(cats);
    catChart.data.datasets[0].data = Object.values(cats);
    catChart.update();

    const inc = state.transactions.filter(t => t.jenis === 'pemasukan').reduce((s,t) => s+(parseFloat(t.nominal)||0), 0);
    const exp = state.transactions.filter(t => t.jenis === 'pengeluaran').reduce((s,t) => s+(parseFloat(t.nominal)||0), 0);
    trendChart.data.datasets[0].data = [inc, exp];
    trendChart.update();
}

function renderDetailChart() {
    const ctx = document.getElementById('detailChart');
    if (!ctx) return;
    if (detailChart) detailChart.destroy();
    const months = {};
    state.transactions.forEach(t => {
        const m = new Date(t.tanggal).toLocaleString('id-ID', { month: 'short' });
        if (!months[m]) months[m] = { in: 0, out: 0 };
        if (t.jenis === 'pemasukan') months[m].in += (parseFloat(t.nominal) || 0);
        else months[m].out += (parseFloat(t.nominal) || 0);
    });
    detailChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(months),
            datasets: [
                { label: 'In', data: Object.values(months).map(v => v.in), borderColor: '#10B981' },
                { label: 'Out', data: Object.values(months).map(v => v.out), borderColor: '#EF4444' }
            ]
        }
    });
}
