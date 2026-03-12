/**
 * MyFinance App - Core Logic
 */

// --- Configuration & State ---
const CONFIG = {
    // Replace with your Google Apps Script Web App URL after deployment
    API_URL: 'https://script.google.com/macros/s/AKfycbz1NfGe3ie8q4CXqjz8MUGLzHzfaMRYVaEiu5OkvfsHmX93xyqTgpI9lL2p6p5E6DfV5Q/exec',
    CURRENCY: 'Rp'
};

let state = {
    transactions: [],
    theme: localStorage.getItem('theme') || 'light',
    activeSection: 'dashboard'
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initPWA();
    initTheme();
    initNavigation();
    initForms();
    initCharts();
    loadData(); // Initial load
});

// --- PWA Setup ---
function initPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(err => console.error('SW Registration Failed', err));
    }
}

// --- Theme Management ---
function initTheme() {
    const toggle = document.getElementById('dark-mode-toggle');
    if (state.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        toggle.checked = true;
    }

    toggle.addEventListener('change', (e) => {
        state.theme = e.target.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('theme', state.theme);
    });
}

// --- Navigation ---
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.page-section');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetSection = item.getAttribute('data-section');
            if (targetSection === state.activeSection) return;

            // Update Nav UI
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Update Section UI
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(`section-${targetSection}`).classList.add('active');

            // Update Title
            state.activeSection = targetSection;
            pageTitle.textContent = targetSection.charAt(0).toUpperCase() + targetSection.slice(1);
            
            // Special handling for statistics re-render
            if (targetSection === 'statistik') renderDetailChart();
        });
    });
}

// --- Form Handling ---
function initForms() {
    const form = document.getElementById('transaction-form');
    // Set default date to today
    document.getElementById('t-date').valueAsDate = new Date();

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

        showToast('Menyimpan transaksi...');
        
        try {
            // Optimistic Update (Local UI)
            const newT = { ...formData, id: Date.now(), timestamp: new Date().toISOString() };
            state.transactions.unshift(newT);
            updateUI();
            form.reset();
            document.getElementById('t-date').valueAsDate = new Date();

            // Actual API Call
            if (CONFIG.API_URL.includes('REPLACE_WITH_YOUR_SCRIPT_ID')) {
                console.warn('API URL not configured. Data saved locally only.');
                showToast('Tersimpan secara lokal (API belum dikonfigurasi)');
            } else {
                const response = await fetch(CONFIG.API_URL, {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                const result = await response.json();
                if (result.status === 'success') {
                    showToast('Transaksi berhasil disimpan!');
                }
            }
        } catch (error) {
            console.error('Error saving transaction:', error);
            showToast('Gagal menyimpan ke server, data tersimpan di cache.');
        }
    });

    // Search & Filter
    document.getElementById('search-input').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        renderTransactionList(query);
    });
}

// --- Data Management ---
async function loadData() {
    try {
        if (!CONFIG.API_URL.includes('REPLACE_WITH_YOUR_SCRIPT_ID')) {
            const response = await fetch(`${CONFIG.API_URL}?action=getTransactions`);
            const data = await response.json();
            state.transactions = data;
        } else {
            // Use dummy data if API not set
            state.transactions = [
                { id: 1, tanggal: '2024-03-01', jenis: 'pemasukan', kategori: 'Gaji', nominal: 5000000, catatan: 'Gaji Bulanan' },
                { id: 2, tanggal: '2024-03-02', jenis: 'pengeluaran', kategori: 'Makanan', nominal: 150000, catatan: 'Makan Siang' },
                { id: 3, tanggal: '2024-03-03', jenis: 'pengeluaran', kategori: 'Transport', nominal: 50000, catatan: 'Ojek Online' }
            ];
        }
        updateUI();
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Gagal memuat data dari server.');
    }
}

function updateUI() {
    calculateSummary();
    renderTransactionList();
    updateCharts();
}

function calculateSummary() {
    const totalIncome = state.transactions
        .filter(t => t.jenis === 'pemasukan')
        .reduce((sum, t) => sum + t.nominal, 0);
    
    const totalExpense = state.transactions
        .filter(t => t.jenis === 'pengeluaran')
        .reduce((sum, t) => sum + t.nominal, 0);

    const balance = totalIncome - totalExpense;

    document.getElementById('total-balance').textContent = formatCurrency(balance);
    document.getElementById('total-income').textContent = formatCurrency(totalIncome);
    document.getElementById('total-expense').textContent = formatCurrency(totalExpense);
}

function renderTransactionList(query = '') {
    const list = document.getElementById('transaction-list');
    list.innerHTML = '';

    const filtered = state.transactions.filter(t => 
        t.kategori.toLowerCase().includes(query) || 
        t.catatan.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        list.innerHTML = '<div class="text-center p-4">Tidak ada transaksi ditemukan</div>';
        return;
    }

    filtered.forEach(t => {
        const item = document.createElement('div');
        item.className = 'transaction-item';
        item.innerHTML = `
            <div class="t-info">
                <span class="t-category">${t.kategori}</span>
                <span class="t-date">${new Date(t.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <div class="t-amount ${t.jenis}">
                ${t.jenis === 'pemasukan' ? '+' : '-'} ${formatCurrency(t.nominal)}
            </div>
        `;
        list.appendChild(item);
    });
}

// --- Chart.js Integration ---
let catChart, trendChart, detailChart;

function initCharts() {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = state.theme === 'dark' ? '#94A3B8' : '#64748B';

    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    catChart = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });

    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(ctxTrend, {
        type: 'bar',
        data: {
            labels: ['Pemasukan', 'Pengeluaran'],
            datasets: [{
                label: 'Nominal',
                data: [0, 0],
                backgroundColor: ['#10B981', '#EF4444'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });
}

function updateCharts() {
    // Category Data
    const expenses = state.transactions.filter(t => t.jenis === 'pengeluaran');
    const catTotals = {};
    expenses.forEach(t => {
        catTotals[t.kategori] = (catTotals[t.kategori] || 0) + t.nominal;
    });

    catChart.data.labels = Object.keys(catTotals);
    catChart.data.datasets[0].data = Object.values(catTotals);
    catChart.update();

    // Trend Data
    const income = state.transactions.filter(t => t.jenis === 'pemasukan').reduce((s, t) => s + t.nominal, 0);
    const expense = state.transactions.filter(t => t.jenis === 'pengeluaran').reduce((s, t) => s + t.nominal, 0);
    trendChart.data.datasets[0].data = [income, expense];
    trendChart.update();
}

function renderDetailChart() {
    const ctxDetail = document.getElementById('detailChart').getContext('2d');
    if (detailChart) detailChart.destroy();

    // Group by month (simplified)
    const monthlyData = {};
    state.transactions.forEach(t => {
        const month = new Date(t.tanggal).toLocaleString('id-ID', { month: 'short' });
        if (!monthlyData[month]) monthlyData[month] = { in: 0, out: 0 };
        if (t.jenis === 'pemasukan') monthlyData[month].in += t.nominal;
        else monthlyData[month].out += t.nominal;
    });

    detailChart = new Chart(ctxDetail, {
        type: 'line',
        data: {
            labels: Object.keys(monthlyData),
            datasets: [
                { label: 'Pemasukan', data: Object.values(monthlyData).map(d => d.in), borderColor: '#10B981', tension: 0.4 },
                { label: 'Pengeluaran', data: Object.values(monthlyData).map(d => d.out), borderColor: '#EF4444', tension: 0.4 }
            ]
        },
        options: { responsive: true }
    });
}

// --- Utilities ---
function formatCurrency(num) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(num).replace('IDR', 'Rp');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// --- Camera Logic Placeholder ---
document.getElementById('capture-btn').addEventListener('click', () => {
    showToast('Membuka kamera...');
    // In a real device, you'd use navigator.mediaDevices.getUserMedia
    // For this PWA, we'll suggest the file upload for better compatibility
    document.getElementById('upload-receipt').click();
});

document.getElementById('upload-receipt').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        showToast('Foto berhasil dipilih!');
        // Logic to upload to Drive via Apps Script would go here
    }
});
