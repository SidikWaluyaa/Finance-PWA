/**
 * MyFinance App - Core Logic (v3 - Optimized Camera & Drive)
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
    initCameraHandlers();
    loadData();
    
    // Refresh App Button
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
            const target = item.getAttribute('data-section');
            switchSection(target);
        });
    });
}

function switchSection(target) {
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const sections = document.querySelectorAll('.page-section');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(i => i.classList.toggle('active', i.getAttribute('data-section') === target));
    sections.forEach(s => s.classList.toggle('active', s.id === `section-${target}`));
    
    state.activeSection = target;
    if (pageTitle) pageTitle.textContent = target.charAt(0).toUpperCase() + target.slice(1);
    if (target === 'statistik') renderDetailChart();
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
                const res = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify(formData) });
                const result = await res.json();
                if (result.status === 'success') {
                    showToast('Berhasil disimpan!');
                    clearPendingImage();
                    form.reset();
                    if (dateInput) dateInput.valueAsDate = new Date();
                    loadData();
                } else throw new Error(result.message);
            } catch (err) {
                showToast('Gagal: ' + err.message);
            }
        });
    }

    const removeBtn = document.getElementById('remove-receipt');
    if (removeBtn) removeBtn.addEventListener('click', clearPendingImage);
    
    const search = document.getElementById('search-input');
    if (search) search.addEventListener('input', (e) => renderTransactionList(e.target.value.toLowerCase()));
}

function clearPendingImage() {
    state.pendingImage = null;
    const container = document.getElementById('receipt-preview-container');
    if (container) container.style.display = 'none';
}

// --- Camera & Scan ---
let cameraStream = null;

function initCameraHandlers() {
    const scanBtn = document.getElementById('nav-scan-trigger');
    const closeBtn = document.getElementById('close-camera');
    const shutterBtn = document.getElementById('shutter-btn');
    
    if (scanBtn) scanBtn.addEventListener('click', () => {
        // Direct approach: If we are on mobile, use native camera by default for better compatibility
        // unless they are specifically using a modern browser with good support.
        if (isMobileDevice()) {
            openNativeCamera();
        } else {
            startCamera();
        }
    });

    if (closeBtn) closeBtn.addEventListener('click', stopCamera);
    if (shutterBtn) shutterBtn.addEventListener('click', capturePhoto);
}

function isMobileDevice() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        openNativeCamera();
        return;
    }

    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-stream');

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
        });
        video.srcObject = cameraStream;
        modal.classList.add('active');
    } catch (e) {
        console.error(e);
        openNativeCamera();
    }
}

function openNativeCamera() {
    showToast("Membuka Kamera...");
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // This triggers the real camera app on mobile
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
        cameraStream.getTracks().forEach(t => t.stop());
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
    
    // UI Feedback
    const preview = document.getElementById('receipt-preview');
    const container = document.getElementById('receipt-preview-container');
    if (preview && container) {
        preview.src = base64;
        container.style.display = 'block';
    }

    // Go to form
    switchSection('transaksi');
    showToast("Struk terbaca! Preview ada di form.");
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
        const photo = (t.foto && t.foto.startsWith('http')) ? `<a href="${t.foto}" target="_blank" class="t-photo-link" style="display:block; font-size:10px; color:var(--primary); margin-top:4px;">Lihat Struk</a>` : '';
        item.innerHTML = `
            <div class="t-info">
                <span class="t-category">${t.kategori || 'Lainnya'}</span>
                <span class="t-date">${new Date(t.tanggal).toLocaleDateString('id-ID')}</span>
                ${photo}
            </div>
            <div class="t-amount ${t.jenis}">${t.jenis === 'pemasukan' ? '+' : '-'} ${formatCurrency(t.nominal)}</div>
        `;
        list.appendChild(item);
    });
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
        data: { labels: [], datasets: [{ data: [] }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });

    trendChart = new Chart(trendCtx, {
        type: 'bar',
        data: { labels: ['Pemasukan', 'Pengeluaran'], datasets: [{ data: [0, 0] }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

function updateCharts() {
    if (!catChart || !trendChart) return;
    const expItems = state.transactions.filter(t => t.jenis === 'pengeluaran');
    const cats = {};
    expItems.forEach(i => { cats[i.kategori] = (cats[i.kategori] || 0) + (parseFloat(i.nominal) || 0); });
    catChart.data.labels = Object.keys(cats).length ? Object.keys(cats) : ['Belum ada data'];
    catChart.data.datasets[0].data = Object.values(cats).length ? Object.values(cats) : [0];
    catChart.data.datasets[0].backgroundColor = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];
    catChart.update();

    const inc = state.transactions.filter(t => t.jenis === 'pemasukan').reduce((s,t) => s+(parseFloat(t.nominal)||0), 0);
    const exp = state.transactions.filter(t => t.jenis === 'pengeluaran').reduce((s,t) => s+(parseFloat(t.nominal)||0), 0);
    trendChart.data.datasets[0].data = [inc, exp];
    trendChart.data.datasets[0].backgroundColor = ['#10B981', '#EF4444'];
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
