/**
 * MyFinance App - Core Logic (v5 - CRUD Support)
 */

const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbzgkyLoyh6EQazlJU1IZi1CsEbAGGWeOZizjcum85BKs67i-Mxai5c3ZIbrFPmfvskhlA/exec',
    CURRENCY: 'Rp'
};

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
    zoom: localStorage.getItem('zoom') || 16,
    activeSection: 'dashboard',
    budgets: JSON.parse(localStorage.getItem('budgets')) || {},
    editingId: null,
    savingsGoals: JSON.parse(localStorage.getItem('savingsGoals')) || [],
    dateFilter: new Date().toISOString().slice(0, 7),
    wallets: JSON.parse(localStorage.getItem('wallets')) || ['Tunai', 'BCA', 'GoPay']
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initPWA();
    initSettings();
    initNavigation();
    initForms();
    initCharts();
    loadData();
    
    window.deleteBudget = deleteBudget;
    window.editTransaction = editTransaction;
    window.deleteTransaction = deleteTransaction;
    window.deleteGoal = deleteGoal;
    window.saveGoal = saveGoal;
    window.saveBudget = saveBudget;
    window.addWallet = addWallet;
    window.deleteWallet = deleteWallet;
    
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

    const exportBtn = document.getElementById('export-pdf-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportToPDF);

    const saveBudgetBtn = document.getElementById('save-budget-btn');
    if (saveBudgetBtn) saveBudgetBtn.addEventListener('click', saveBudget);

    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);
});

function initPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js').catch(e => console.error(e));
    }
}

function initSettings() {
    // Theme Logic
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

    // Zoom Logic
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomText = document.getElementById('zoom-level-text');
    
    // Apply initial zoom
    document.documentElement.style.fontSize = state.zoom + 'px';
    
    if (zoomSlider) {
        zoomSlider.value = state.zoom;
        if (zoomText) zoomText.textContent = Math.round((state.zoom / 16) * 100) + '%';
        
        zoomSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            state.zoom = val;
            document.documentElement.style.fontSize = val + 'px';
            if (zoomText) zoomText.textContent = Math.round((val / 16) * 100) + '%';
            localStorage.setItem('zoom', val);
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
            switchSection(targetSection);
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
    if (target === 'dashboard') updateUI();
}

function initForms() {
    const form = document.getElementById('transaction-form');
    const dateInput = document.getElementById('t-date');
    if (dateInput) dateInput.valueAsDate = new Date();

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const action = state.editingId ? 'updateTransaction' : 'addTransaction';
            const formData = {
                action: action,
                id: state.editingId,
                tanggal: document.getElementById('t-date').value,
                jenis: document.getElementById('t-type').value,
                kategori: document.getElementById('t-category').value,
                nominal: parseFloat(document.getElementById('t-amount').value),
                dompet: document.getElementById('t-wallet').value || 'Tunai',
                catatan: document.getElementById('t-note').value
            };

            showToast(state.editingId ? 'Memperbarui...' : 'Menyimpan...');
            try {
                const res = await fetch(CONFIG.API_URL, { 
                    method: 'POST', 
                    body: JSON.stringify(formData) 
                });
                const result = await res.json();
                if (result.status === 'success') {
                    showToast(state.editingId ? 'Berhasil diperbarui!' : 'Berhasil disimpan!');
                    cancelEdit(); // Reset form & state
                    loadData();
                } else throw new Error(result.message);
            } catch (err) {
                showToast('Gagal: ' + err.message);
            }
        });
    }

    const saveBudgetBtn = document.getElementById('save-budget-btn');
    if (saveBudgetBtn) saveBudgetBtn.addEventListener('click', saveBudget);

    const saveGoalBtn = document.getElementById('save-goal-btn');
    if (saveGoalBtn) saveGoalBtn.addEventListener('click', saveGoal);

    const dateFilter = document.getElementById('global-date-filter');
    if (dateFilter) {
        dateFilter.value = state.dateFilter;
        dateFilter.addEventListener('change', (e) => {
            state.dateFilter = e.target.value;
            updateUI();
        });
    }

    const search = document.getElementById('search-input');
    if (search) {
        search.addEventListener('input', (e) => renderTransactionList(e.target.value.toLowerCase()));
    }
}

function cancelEdit() {
    state.editingId = null;
    const form = document.getElementById('transaction-form');
    if (form) form.reset();
    
    // Set default date and wallet
    const dateInput = document.getElementById('t-date');
    if (dateInput) dateInput.valueAsDate = new Date();
    
    const walletInput = document.getElementById('t-wallet');
    if (walletInput && state.wallets.length > 0) walletInput.value = state.wallets[0];
    
    document.getElementById('form-title').textContent = 'Tambah Transaksi';
    document.getElementById('submit-btn').textContent = 'Simpan Transaksi';
    document.getElementById('cancel-edit-btn').style.display = 'none';
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

function getFilteredTransactions() {
    if (!state.dateFilter) return state.transactions;
    return state.transactions.filter(t => {
        if (!t.tanggal) return false;
        try {
            const dateObj = new Date(t.tanggal);
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            return `${yyyy}-${mm}` === state.dateFilter;
        } catch(e) {
            return false;
        }
    });
}

function updateUI() {
    calculateSummary();
    renderTransactionList();
    renderBudgetInfo();
    renderSavingsGoals();
    renderWallets();
    updateCharts();
}

function calculateSummary() {
    // Balances per wallet (All-Time)
    const walletBalances = {};
    state.wallets.forEach(w => walletBalances[w] = 0);
    
    let allInc = 0;
    let allExp = 0;

    state.transactions.forEach(t => {
        const nominal = parseFloat(t.nominal) || 0;
        const dompet = t.dompet || 'Tunai';
        if (!walletBalances[dompet]) walletBalances[dompet] = 0;

        if (t.jenis === 'pemasukan') {
            allInc += nominal;
            walletBalances[dompet] += nominal;
        } else if (t.jenis === 'pengeluaran') {
            allExp += nominal;
            walletBalances[dompet] -= nominal;
        }
    });
    
    // Income and Expense (Filtered by Month)
    const txs = getFilteredTransactions();
    const sumInc = txs.filter(t => t.jenis === 'pemasukan').reduce((s, t) => s + (parseFloat(t.nominal) || 0), 0);
    const sumExp = txs.filter(t => t.jenis === 'pengeluaran').reduce((s, t) => s + (parseFloat(t.nominal) || 0), 0);
    
    document.getElementById('total-balance').textContent = formatCurrency(allInc - allExp);
    document.getElementById('total-income').textContent = formatCurrency(sumInc);
    document.getElementById('total-expense').textContent = formatCurrency(sumExp);

    // Render Mini Wallet Cards on Dashboard
    const walletContainer = document.getElementById('wallet-balances');
    if (walletContainer) {
        walletContainer.innerHTML = '';
        state.wallets.forEach(w => {
            const bal = walletBalances[w] || 0;
            walletContainer.innerHTML += `
                <div style="min-width: 140px; padding: 0.8rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 2px;">${w}</div>
                    <div style="font-size: 1rem; font-weight: 700; color: ${bal < 0 ? 'var(--expense)' : 'var(--text)'};">${formatCurrency(bal)}</div>
                </div>
            `;
        });
    }
}

function renderTransactionList(query = '') {
    const list = document.getElementById('transaction-list');
    if (!list) return;
    list.innerHTML = '';
    
    const txs = getFilteredTransactions();
    const filtered = txs.filter(t => 
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
            <div class="t-actions">
                <button class="btn-icon-xs btn-edit" onclick="editTransaction('${t.id}')">✏️</button>
                <button class="btn-icon-xs btn-delete" onclick="deleteTransaction('${t.id}')">🗑️</button>
            </div>
        `;
        list.appendChild(item);
    });
}

async function deleteTransaction(id) {
    if (!confirm('Hapus transaksi ini?')) return;
    
    showToast('Menghapus...');
    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'deleteTransaction', id: id })
        });
        const result = await res.json();
        if (result.status === 'success') {
            showToast('Terhapus!');
            loadData();
        } else throw new Error(result.message);
    } catch (err) {
        showToast('Gagal hapus: ' + err.message);
    }
}

function editTransaction(id) {
    const t = state.transactions.find(item => item.id == id);
    if (!t) return;

    state.editingId = id;
    
    // Switch to transaction section
    switchSection('transaksi');
    
    // Fill form
    document.getElementById('form-title').textContent = 'Edit Transaksi';
    document.getElementById('submit-btn').textContent = 'Perbarui Transaksi';
    document.getElementById('cancel-edit-btn').style.display = 'block';
    
    document.getElementById('t-date').value = t.tanggal.split('T')[0];
    document.getElementById('t-type').value = t.jenis;
    document.getElementById('t-category').value = t.kategori;
    document.getElementById('t-amount').value = t.nominal;
    document.getElementById('t-note').value = t.catatan || '';
    
    // Scroll to top of form
    document.getElementById('section-transaksi').scrollTop = 0;
}

function renderBudgetInfo() {
    const container = document.getElementById('budget-summary');
    if (!container) return;
    container.innerHTML = '';

    const txs = getFilteredTransactions();
    const expenses = txs.filter(t => t.jenis === 'pengeluaran');
    const categories = Object.keys(state.budgets);

    if (categories.length === 0) {
        container.innerHTML = '<p class="text-light" style="font-size: 0.8rem;">Belum ada budget yang diatur.</p>';
        return;
    }

    categories.forEach(cat => {
        const limit = state.budgets[cat];
        const spent = expenses.filter(t => t.kategori.toLowerCase() === cat.toLowerCase()).reduce((s, t) => s + parseFloat(t.nominal), 0);
        const percent = Math.min(100, (spent / limit) * 100);
        const color = percent > 90 ? 'var(--expense)' : (percent > 70 ? '#F59E0B' : 'var(--income)');

        const el = document.createElement('div');
        el.className = 'budget-item';
        
        el.innerHTML = `
            <div class="budget-label" style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 700;">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                <div class="budget-actions" style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.85rem;">${formatCurrency(spent)} / ${formatCurrency(limit)}</span>
                </div>
            </div>
            <div class="progress-bar" style="margin-top: 5px;">
                <div class="progress-fill" style="width: ${percent}%; background: ${color}"></div>
            </div>
        `;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.className = 'btn-icon-xs btn-delete';
        deleteBtn.style.padding = '0';
        deleteBtn.style.width = '28px';
        deleteBtn.style.height = '28px';
        deleteBtn.title = 'Hapus Anggaran';
        deleteBtn.onclick = () => deleteBudget(cat);
        
        el.querySelector('.budget-actions').appendChild(deleteBtn);
        
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

function deleteBudget(category) {
    if (confirm(`Hapus anggaran untuk kategori ${category}?`)) {
        delete state.budgets[category];
        localStorage.setItem('budgets', JSON.stringify(state.budgets));
        showToast(`Budget ${category} dihapus!`);
        updateUI();
    }
}

function renderSavingsGoals() {
    const container = document.getElementById('savings-summary');
    if (!container) return;
    container.innerHTML = '';

    if (!state.savingsGoals || state.savingsGoals.length === 0) {
        container.innerHTML = '<p class="text-light" style="font-size: 0.8rem;">Belum ada target tabungan yang diatur.</p>';
        return;
    }

    // Savings are money moved out of available balance to a "Savings" bucket. 
    // We calculate total saved by summing all 'pengeluaran' across all time tagged as 'Tabungan'.
    const totalSaved = state.transactions
        .filter(t => t.jenis === 'pengeluaran' && t.kategori && t.kategori.toLowerCase() === 'tabungan')
        .reduce((s, t) => s + parseFloat(t.nominal), 0);

    state.savingsGoals.forEach((goal, index) => {
        const percent = Math.min(100, (totalSaved / goal.amount) * 100);
        const color = percent >= 100 ? 'var(--income)' : '#3B82F6';

        const el = document.createElement('div');
        el.className = 'budget-item';
        el.innerHTML = `
            <div class="budget-label" style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 700;">${goal.name}</span>
                <div class="budget-actions" style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.85rem;">${formatCurrency(totalSaved)} / ${formatCurrency(goal.amount)}</span>
                </div>
            </div>
            <div class="progress-bar" style="margin-top: 5px;">
                <div class="progress-fill" style="width: ${percent}%; background: ${color}"></div>
            </div>
        `;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.className = 'btn-icon-xs btn-delete';
        deleteBtn.style.padding = '0';
        deleteBtn.style.width = '28px';
        deleteBtn.style.height = '28px';
        deleteBtn.title = 'Hapus Target';
        deleteBtn.onclick = () => deleteGoal(index);
        
        el.querySelector('.budget-actions').appendChild(deleteBtn);
        
        container.appendChild(el);
    });
}

function saveGoal() {
    const name = document.getElementById('goal-name').value.trim();
    const amount = parseFloat(document.getElementById('goal-target').value);
    
    if (name && amount) {
        if (!state.savingsGoals) state.savingsGoals = [];
        state.savingsGoals.push({ name, amount });
        localStorage.setItem('savingsGoals', JSON.stringify(state.savingsGoals));
        showToast(`Target ${name} disimpan!`);
        document.getElementById('goal-name').value = '';
        document.getElementById('goal-target').value = '';
        updateUI();
    }
}

function deleteGoal(index) {
    if (confirm(`Hapus target tabungan ini?`)) {
        state.savingsGoals.splice(index, 1);
        localStorage.setItem('savingsGoals', JSON.stringify(state.savingsGoals));
        showToast(`Target dihapus!`);
        updateUI();
    }
}

function renderWallets() {
    // 1. Render Wallet List in Settings (Profil)
    const walletList = document.getElementById('wallet-list');
    if (walletList) {
        walletList.innerHTML = '';
        state.wallets.forEach((w, index) => {
            const el = document.createElement('div');
            el.className = 'setting-item';
            el.innerHTML = `
                <span style="font-weight: 500;">${w}</span>
                <button class="btn-icon-xs btn-delete" style="padding: 0; width: 28px; height: 28px;" title="Hapus Dompet" onclick="deleteWallet(${index})">🗑️</button>
            `;
            walletList.appendChild(el);
        });
    }

    // 2. Render Wallet Dropdown in Transaction Form
    const walletSelect = document.getElementById('t-wallet');
    if (walletSelect) {
        const currentVal = walletSelect.value;
        walletSelect.innerHTML = '';
        state.wallets.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w;
            opt.textContent = w;
            walletSelect.appendChild(opt);
        });
        if (state.wallets.includes(currentVal)) {
            walletSelect.value = currentVal;
        } else if (state.wallets.length > 0) {
            walletSelect.value = state.wallets[0];
        }
    }
}

function addWallet() {
    const nameInput = document.getElementById('new-wallet-name');
    const name = nameInput.value.trim();
    if (name && !state.wallets.includes(name)) {
        state.wallets.push(name);
        localStorage.setItem('wallets', JSON.stringify(state.wallets));
        nameInput.value = '';
        showToast(`Dompet ${name} ditambahkan!`);
        updateUI();
    } else if (state.wallets.includes(name)) {
        showToast(`Dompet ${name} sudah ada!`);
    }
}

function deleteWallet(index) {
    if (state.wallets.length <= 1) {
        alert("Minimal harus ada 1 dompet tersisa!");
        return;
    }
    const walletName = state.wallets[index];
    if (confirm(`Apakah Anda yakin ingin menghapus dompet "${walletName}"? Transaksi lama dengan dompet ini tetap ada, namun dompetnya tidak tersedia lagi untuk transaksi baru.`)) {
        state.wallets.splice(index, 1);
        localStorage.setItem('wallets', JSON.stringify(state.wallets));
        showToast(`Dompet ${walletName} dihapus!`);
        updateUI();
    }
}

function exportToPDF() {
    if (state.transactions.length === 0) {
        showToast('Tidak ada data untuk diexport.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Set Document Properties
    doc.setProperties({
        title: 'Laporan Keuangan MyFinance',
        subject: 'Laporan Transaksi',
        creator: 'MyFinance PWA'
    });

    // Premium Header Design
    doc.setFillColor(79, 70, 229); // Primary color
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("MyFinance", 15, 20);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Laporan Keuangan", 15, 30);
    
    doc.setFontSize(10);
    const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Tanggal Cetak: ${dateStr}`, 195, 20, { align: 'right' });

    // Financial Summary Section
    const inc = state.transactions.filter(t => t.jenis === 'pemasukan').reduce((s, t) => s + (parseFloat(t.nominal) || 0), 0);
    const exp = state.transactions.filter(t => t.jenis === 'pengeluaran').reduce((s, t) => s + (parseFloat(t.nominal) || 0), 0);
    const bal = inc - exp;

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.text("Ringkasan Total:", 15, 50);
    
    doc.setFontSize(10);
    doc.text(`Total Pemasukan: ${formatCurrency(inc)}`, 15, 58);
    doc.text(`Total Pengeluaran: ${formatCurrency(exp)}`, 15, 64);
    doc.setFont("helvetica", "bold");
    doc.text(`Saldo Akhir: ${formatCurrency(bal)}`, 15, 70);
    doc.setFont("helvetica", "normal");

    // Line Separator
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(15, 75, 195, 75);

    // Prepare Table Data
    const tableBody = state.transactions.map((t, idx) => [
        idx + 1,
        new Date(t.tanggal).toLocaleDateString('id-ID'),
        t.jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
        t.kategori || '-',
        formatCurrency(t.nominal),
        t.catatan || '-'
    ]);

    // Enhanced AutoTable Styling
    doc.autoTable({
        startY: 85,
        head: [['No', 'Tanggal', 'Jenis', 'Kategori', 'Nominal', 'Catatan']],
        body: tableBody,
        theme: 'striped',
        headStyles: {
            fillColor: [79, 70, 229],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 15 },
            2: { halign: 'center' },
            4: { halign: 'right' } // Align nominal right
        },
        styles: {
            fontSize: 9,
            cellPadding: 4,
            lineWidth: 0.1,
            lineColor: [220, 220, 220]
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252] // Light background for striped effect
        },
        didParseCell: function(data) {
            // Apply color to amounts based on income/expense
            if (data.section === 'body' && data.column.index === 4) {
                const isIncome = data.row.raw[2] === 'Pemasukan';
                if (isIncome) {
                    data.cell.styles.textColor = [16, 185, 129]; // Green
                } else {
                    data.cell.styles.textColor = [239, 68, 68]; // Red
                }
            }
        }
    });

    // Add Footer with Page Numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Dibuat oleh MyFinance PWA - Halaman ${i} dari ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    // Save PDF
    doc.save(`Laporan_Keuangan_${new Date().getTime()}.pdf`);
    showToast('PDF Laporan berhasil diunduh!');
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

// Global functions for inline onclick handlers
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.switchSection = switchSection;
