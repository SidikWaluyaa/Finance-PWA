/**
 * MyFinance App - Core Logic (Consolidated & Improved Camera)
 */

const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbzgkyLoyh6EQazlJU1IZi1CsEbAGGWeOZizjcum85BKs67i-Mxai5c3ZIbrFPmfvskhlA/exec',
    CURRENCY: 'Rp'
};

let state = {
    transactions: [],
    theme: localStorage.getItem('theme') || 'light',
    activeSection: 'dashboard',
    pendingImage: null
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initPWA();
    initTheme();
    initNavigation();
    initForms();
    initCharts();
    initCameraControls();
    loadData();
});

function initPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js').catch(err => console.error('SW Error', err));
    }
}

function initTheme() {
    const toggle = document.getElementById('dark-mode-toggle');
    if (state.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (toggle) toggle.checked = true;
    }
    if (toggle) {
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
            pageTitle.textContent = targetSection.charAt(0).toUpperCase() + targetSection.slice(1);
            if (targetSection === 'statistik') renderDetailChart();
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
                catatan: document.getElementById('t-note').value,
                image: state.pendingImage || null
            };

            showToast('Menyimpan...');
            try {
                const response = await fetch(CONFIG.API_URL, {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                const result = await response.json();
                if (result.status === 'success') {
                    showToast('Berhasil disimpan!');
                    state.pendingImage = null;
                    form.reset();
                    if (dateInput) dateInput.valueAsDate = new Date();
                    loadData();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Gagal: ' + error.message);
            }
        });
    }

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => renderTransactionList(e.target.value.toLowerCase()));
    }
}

// --- Camera Logic ---
let cameraStream = null;

function initCameraControls() {
    const scanTrigger = document.getElementById('nav-scan-trigger');
    const closeBtn = document.getElementById('close-camera');
    const shutterBtn = document.getElementById('shutter-btn');
    const uploadInput = document.getElementById('upload-receipt');

    if (scanTrigger) scanTrigger.addEventListener('click', startCamera);
    if (closeBtn) closeBtn.addEventListener('click', stopCamera);
    if (shutterBtn) shutterBtn.addEventListener('click', capturePhoto);

    // Add upload button functionality in Profile or Dashboard to handle files
    if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => processScanResult(ev.target.result);
            reader.readAsDataURL(file);
        });
    }
}

async function startCamera() {
    // If NOT HTTPS, fallback immediately to native file input
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast("Membuka Kamera HP...");
        openNativeCamera();
        return;
    }

    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-stream');
    
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, 
            audio: false 
        });
        video.srcObject = cameraStream;
        modal.classList.add('active');
    } catch (err) {
        console.error("Camera error:", err);
        showToast("Gagal akses kamera, mencoba alternatif...");
        openNativeCamera();
    }
}

function openNativeCamera() {
    // Create a temporary hidden input to trigger the actual camera app
    let input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => processScanResult(ev.target.result);
            reader.readAsDataURL(file);
        }
    };
    input.click();
}

function stopCamera() {
    const modal = document.getElementById('camera-modal');
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    const video = document.getElementById('camera-stream');
    if (video) video.srcObject = null;
    modal.classList.remove('active');
}

async function capturePhoto() {
    const video = document.getElementById('camera-stream');
    const canvas = document.getElementById('capture-canvas');
    if (!video || !video.videoWidth) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.8);
    stopCamera();
    processScanResult(base64);
}

function processScanResult(base64) {
    state.pendingImage = base64;
    
    // Auto navigate to Transaction
    const tNav = document.querySelector('[data-section="transaksi"]');
    if (tNav) tNav.click();
    
    showToast("Struk terbaca! Silakan isi detail.");
}

// --- Data & Charts (Simplified) ---
async function loadData() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getTransactions`);
        const data = await response.json();
        state.transactions = data;
        updateUI();
    } catch (e) {
        console.error("Load error", e);
        showToast("Offline / Gagal muat data.");
    }
}

function updateUI() {
    calculateSummary();
    renderTransactionList();
    updateCharts();
}

function calculateSummary() {
    const income = state.transactions.filter(t => t.jenis === 'pemasukan').reduce((s, t) => s + (t.nominal || 0), 0);
    const expense = state.transactions.filter(t => t.jenis === 'pengeluaran').reduce((s, t) => s + (t.nominal || 0), 0);
    
    const balanceEl = document.getElementById('total-balance');
    const inEl = document.getElementById('total-income');
    const outEl = document.getElementById('total-expense');
    
    if (balanceEl) balanceEl.textContent = formatCurrency(income - expense);
    if (inEl) inEl.textContent = formatCurrency(income);
    if (outEl) outEl.textContent = formatCurrency(expense);
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
        const photo = t.foto ? `<a href="${t.foto}" target="_blank" class="t-photo-link" style="display:block; font-size:10px; color:var(--primary); margin-top:4px;">Lihat Struk</a>` : '';
        item.innerHTML = `
            <div class="t-info">
                <span class="t-category">${t.kategori || 'Uncategorized'}</span>
                <span class="t-date">${new Date(t.tanggal).toLocaleDateString('id-ID')}</span>
                ${photo}
            </div>
            <div class="t-amount ${t.jenis}">${t.jenis === 'pemasukan' ? '+' : '-'} ${formatCurrency(t.nominal)}</div>
        `;
        list.appendChild(item);
    });
}

function formatCurrency(n) {
    return "Rp " + (n || 0).toLocaleString('id-ID');
}

function showToast(m) {
    const t = document.getElementById('toast');
    if (t) {
        t.textContent = m;
        t.classList.remove('hidden');
        setTimeout(() => t.classList.add('hidden'), 3000);
    }
}

// --- Charts Logic ---
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
    const items = state.transactions.filter(t => t.jenis === 'pengeluaran');
    const cats = {};
    items.forEach(i => { cats[i.kategori] = (cats[i.kategori] || 0) + (i.nominal || 0); });
    catChart.data.labels = Object.keys(cats);
    catChart.data.datasets[0].data = Object.values(cats);
    catChart.update();

    const inc = state.transactions.filter(t => t.jenis === 'pemasukan').reduce((s,t) => s+(t.nominal||0), 0);
    const exp = state.transactions.filter(t => t.jenis === 'pengeluaran').reduce((s,t) => s+(t.nominal||0), 0);
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
        if (t.jenis === 'pemasukan') months[m].in += t.nominal;
        else months[m].out += t.nominal;
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
