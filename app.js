// ============================================
// ✅ FICHIER APP.JS FINAL - Version 6.0
// Nouvelles fonctionnalités:
// - Recherche intelligente transactions
// - Export CSV
// - Comparaison N vs N-1 (onglet Statistiques)
// - Catégories personnalisables (onglet Paramètres)
// ============================================

const DEFAULT_CATEGORIES = {
  Revenus: ['Salaire', 'Prime', 'Remboursement', 'Intérêts', 'Rbsmt Sécu', 'Rbsmt Mutuelle', 'Autres revenus', 'Solde M-1'],
  Charges_fixes: ['Portable', 'Fibre', 'EDF', 'Eau', 'Crédit maison', 'Assurance', 'Taxe Foncière', 'Microsoft', 'Ménage', 'PAC', 'Ursaaf', 'Mutuelle', 'Autres fixes'],
  Essentiel: ['Alimentation', 'Essence', 'Tabac', 'Gaz', 'Santé/Pharma', 'Autres essentiels'],
  Extras: ['Shopping', 'Bar/Resto', 'Bricolage', 'Beauté', 'Cadeaux', 'Animaux', 'Autres Extras'],
  Epargne: ['Fin de mois', 'Pets/Home/Auto', 'Anniv/Noël', 'Vacances', 'Santé', 'Travaux', 'Urgences']
};

let CATEGORIES = {};

const state = {
  currentUser: { uid: 'local_user' },
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  transactions: [],
  budgets: {},
  editingTransaction: null,
  sortKey: 'date',
  sortDir: 'desc',
  filterMonth: 'all',
  filterType: 'all',
  filterCategory: 'all',
  searchQuery: '',
  editBudget: null,
  bulkEdit: null,
  returnToDashboard: false,
  epargneBase: {
    'Fin de mois': 3870.83,
    'Pets/Home/Auto': 165.3,
    'Santé': 379.77,
    'Urgences': 203.5
  }
};

const MONTHS_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
const COLORS = { revenus: '#4EA09C', depenses: '#CC0066', epargne: '#9893B3' };

function formatCurrency(amount) {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount).replace('€', '').trim();
}

function escapeHtmlAttr(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

window.addEventListener('load', initApp);

function initApp() {
  loadCategories();
  setupEventListeners();
  loadUserData();
  updateDisplay();
  initStatisticsDefaults();
  // Initialiser Firebase (la sync démarre après connexion Google)
  if (typeof initFirebase === 'function') initFirebase();
}

function initStatisticsDefaults() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Mois précédent (gère le passage d'année)
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear = currentYear - 1;
  }
  
  // Activer le mode "Par Mois"
  document.querySelectorAll('.stats-mode-btn').forEach(b => b.classList.remove('active'));
  const monthBtn = document.getElementById('stats-mode-month');
  if (monthBtn) monthBtn.classList.add('active');
  
  // Afficher les sélecteurs de mois
  document.querySelectorAll('.stats-month-select').forEach(sel => {
    sel.style.display = 'inline-block';
  });
  
  // Sélection 1 : mois en cours, année en cours
  const y1 = document.getElementById('compare-year-1');
  const m1 = document.getElementById('compare-month-1');
  if (y1) y1.value = String(currentYear);
  if (m1) m1.value = String(currentMonth);
  
  // Sélection 2 : mois précédent
  const y2 = document.getElementById('compare-year-2');
  const m2 = document.getElementById('compare-month-2');
  if (y2) y2.value = String(prevYear);
  if (m2) m2.value = String(prevMonth);
}

// ============================================
// GESTION DES CATÉGORIES PERSONNALISABLES
// ============================================

function loadCategories() {
  const stored = localStorage.getItem('customCategories');
  if (stored) {
    try {
      CATEGORIES = JSON.parse(stored);
      console.log('✅ Catégories personnalisées chargées');
    } catch (e) {
      console.error('Erreur chargement catégories:', e);
      CATEGORIES = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    }
  } else {
    CATEGORIES = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  }
}

function saveCategories() {
  localStorage.setItem('customCategories', JSON.stringify(CATEGORIES));
  console.log('✅ Catégories sauvegardées');
  // Synchroniser avec Firebase si connecté
  if (typeof pushToFirebase === 'function') pushToFirebase();
}

function resetCategories() {
  if (!confirm('⚠️ Réinitialiser TOUTES les catégories aux valeurs par défaut ?\n\nCette action est irréversible.')) {
    return;
  }
  CATEGORIES = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  saveCategories();
  renderSettingsCategories();
  updateCategoryFilter();
  updateCategoryOptions();
  alert('✅ Catégories réinitialisées !');
}

function addCategory(type) {
  const name = prompt(`Nom de la nouvelle catégorie pour ${type.replace('_', ' ')} :`);
  if (!name || name.trim() === '') return;
  
  const trimmedName = name.trim();
  
  if (CATEGORIES[type].includes(trimmedName)) {
    alert('❌ Cette catégorie existe déjà !');
    return;
  }
  
  CATEGORIES[type].push(trimmedName);
  saveCategories();
  
  // IMPORTANT : Créer les budgets pour TOUTES les années existantes
  Object.keys(state.budgets).forEach(year => {
    if (!state.budgets[year][type]) state.budgets[year][type] = {};
    state.budgets[year][type][trimmedName] = Array(12).fill(0);
  });
  saveBudgets();
  
  // Mettre à jour TOUS les affichages
  renderSettingsCategories();
  updateCategoryFilter();
  updateCategoryOptions();
  renderBudgetTables();
  updateDashboard();
  
  alert(`✅ Catégorie "${trimmedName}" ajoutée !`);
}

function renameCategory(type, oldName) {
  const newName = prompt(`Renommer la catégorie "${oldName}" :`, oldName);
  if (!newName || newName.trim() === '' || newName.trim() === oldName) return;
  
  const trimmedName = newName.trim();
  
  if (CATEGORIES[type].includes(trimmedName)) {
    alert('❌ Cette catégorie existe déjà !');
    return;
  }
  
  const index = CATEGORIES[type].indexOf(oldName);
  if (index !== -1) {
    CATEGORIES[type][index] = trimmedName;
  }
  
  state.transactions.forEach(t => {
    if (t.type === type && t.category === oldName) {
      t.category = trimmedName;
    }
  });
  saveTransactions();
  
  Object.keys(state.budgets).forEach(year => {
    if (state.budgets[year][type] && state.budgets[year][type][oldName]) {
      state.budgets[year][type][trimmedName] = state.budgets[year][type][oldName];
      delete state.budgets[year][type][oldName];
    }
  });
  saveBudgets();
  
  saveCategories();
  renderSettingsCategories();
  updateCategoryFilter();
  updateCategoryOptions();
  updateDisplay();
  
  alert(`✅ Catégorie renommée : "${oldName}" → "${trimmedName}"`);
}

function deleteCategory(type, name) {
  const transactionsCount = state.transactions.filter(t => t.type === type && t.category === name).length;
  
  let confirmMsg = `⚠️ Supprimer la catégorie "${name}" ?\n\n`;
  if (transactionsCount > 0) {
    confirmMsg += `⚠️ ATTENTION : ${transactionsCount} transaction(s) utilisent cette catégorie.\nElles seront également supprimées !\n\n`;
  }
  confirmMsg += 'Cette action est irréversible.';
  
  if (!confirm(confirmMsg)) return;
  
  const index = CATEGORIES[type].indexOf(name);
  if (index !== -1) {
    CATEGORIES[type].splice(index, 1);
  }
  
  state.transactions = state.transactions.filter(t => !(t.type === type && t.category === name));
  saveTransactions();
  
  Object.keys(state.budgets).forEach(year => {
    if (state.budgets[year][type] && state.budgets[year][type][name]) {
      delete state.budgets[year][type][name];
    }
  });
  saveBudgets();
  
  saveCategories();
  renderSettingsCategories();
  updateCategoryFilter();
  updateCategoryOptions();
  updateDisplay();
  
  alert(`✅ Catégorie "${name}" supprimée !${transactionsCount > 0 ? `\n${transactionsCount} transaction(s) supprimée(s).` : ''}`);
}

function renderSettingsCategories() {
  Object.keys(CATEGORIES).forEach(type => {
    const container = document.getElementById(`categories-list-${type}`);
    if (!container) return;
    
    container.innerHTML = '';
    
    CATEGORIES[type].forEach(cat => {
      const item = document.createElement('div');
      item.className = 'category-item';
      item.innerHTML = `
        <span class="category-name">${cat}</span>
        <div class="category-actions">
          <button class="btn-category-edit" onclick="renameCategory('${type}', '${escapeHtmlAttr(cat)}')" title="Renommer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5l4 4L7 21H3v-4L16.5 3.5z"></path>
            </svg>
          </button>
          <button class="btn-category-delete" onclick="deleteCategory('${type}', '${escapeHtmlAttr(cat)}')" title="Supprimer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
      container.appendChild(item);
    });
  });
}

// ============================================
// EXPORT CSV
// ============================================

function exportToCSV() {
  const transactionsYear = state.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === state.currentYear;
  });
  
  if (transactionsYear.length === 0) {
    alert(`Aucune transaction pour l'année ${state.currentYear}`);
    return;
  }
  
  let csv = 'Date;Type;Catégorie;Montant;Commentaire\n';
  
  transactionsYear.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
    const date = new Date(t.date);
    const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    const type = t.type.replace('_', ' ');
    const category = t.category;
    const amount = t.amount.toFixed(2).replace('.', ',');
    const comment = (t.comment || '').replace(/;/g, ',');
    
    csv += `${dateStr};${type};${category};${amount};${comment}\n`;
  });
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions_${state.currentYear}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log(`✅ Export CSV: ${transactionsYear.length} transactions`);
}

// ============================================
// STATISTIQUES COMPARATIVES (N vs N-1)
// ============================================

function renderStatistics() {
  const mode = document.querySelector('.stats-mode-btn.active')?.dataset.mode || 'year';
  const year1 = parseInt(document.getElementById('compare-year-1').value);
  const year2 = parseInt(document.getElementById('compare-year-2').value);
  
  let stats1, stats2, label1, label2;
  
  if (mode === 'month') {
    const month1 = parseInt(document.getElementById('compare-month-1').value);
    const month2 = parseInt(document.getElementById('compare-month-2').value);
    stats1 = calculateMonthStats(year1, month1);
    stats2 = calculateMonthStats(year2, month2);
    label1 = `${MONTHS_SHORT[month1]} ${year1}`;
    label2 = `${MONTHS_SHORT[month2]} ${year2}`;
  } else {
    stats1 = calculateYearStats(year1);
    stats2 = calculateYearStats(year2);
    label1 = String(year1);
    label2 = String(year2);
  }
  
  document.getElementById('year1-header').textContent = label1;
  document.getElementById('year2-header').textContent = label2;
  
  renderComparisonTable(stats1, stats2, label1, label2);
  renderComparisonCharts(stats1, stats2, label1, label2);
}

function calculateYearStats(year) {
  const stats = {};
  
  Object.keys(CATEGORIES).forEach(type => {
    let total = 0;
    
    CATEGORIES[type].forEach(category => {
      const transactions = state.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === year && t.type === type && t.category === category;
      });
      total += transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    });
    
    stats[type] = total;
  });
  
  return stats;
}

function calculateMonthStats(year, month) {
  const stats = {};
  
  Object.keys(CATEGORIES).forEach(type => {
    let total = 0;
    
    CATEGORIES[type].forEach(category => {
      const transactions = state.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === year && d.getMonth() === month && t.type === type && t.category === category;
      });
      total += transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    });
    
    stats[type] = total;
  });
  
  return stats;
}

function renderComparisonTable(stats1, stats2, label1, label2) {
  const tbody = document.getElementById('comparison-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const types = ['Revenus', 'Charges_fixes', 'Essentiel', 'Extras', 'Epargne'];
  
  types.forEach(type => {
    const val1 = stats1[type] || 0;
    const val2 = stats2[type] || 0;
    const diff = val1 - val2;
    const pct = val2 !== 0 ? ((diff / val2) * 100) : 0;
    
    const row = document.createElement('tr');
    
    let badgeClass = 'badge-ecart-neutre';
    let diffColor = '#6b7280';
    
    if (type === 'Revenus') {
      if (diff > 0) {
        badgeClass = 'badge-ecart-positif';
        diffColor = COLORS.revenus;
      } else if (diff < 0) {
        badgeClass = 'badge-ecart-negatif';
        diffColor = COLORS.depenses;
      }
    } else {
      if (diff < 0) {
        badgeClass = 'badge-ecart-positif';
        diffColor = COLORS.revenus;
      } else if (diff > 0) {
        badgeClass = 'badge-ecart-negatif';
        diffColor = COLORS.depenses;
      }
    }
    
    const pctSign = pct >= 0 ? '+' : '';
    
    row.innerHTML = `
      <td style="padding: 1rem 1.5rem; font-weight: 600;">${type.replace('_', ' ')}</td>
      <td style="padding: 1rem 1.5rem; text-align: right;">${formatCurrency(val1)} €</td>
      <td style="padding: 1rem 1.5rem; text-align: right;">${formatCurrency(val2)} €</td>
      <td style="padding: 1rem 1.5rem; text-align: right;">
        <span class="badge-ecart ${badgeClass}">${formatCurrency(diff)} €</span>
      </td>
      <td style="padding: 1rem 1.5rem; text-align: right; font-weight: 600; color: ${diffColor};">
        ${pctSign}${pct.toFixed(1)} %
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderComparisonCharts(stats1, stats2, label1, label2) {
  renderBarChart(stats1, stats2, label1, label2);
  renderLineChart(stats1, stats2, label1, label2);
}

function renderBarChart(stats1, stats2, label1, label2) {
  const canvas = document.getElementById('chart-comparison-bars');
  if (!canvas) return;
  
  if (window.chartComparisonBars) {
    window.chartComparisonBars.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  window.chartComparisonBars = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Revenus', 'Dépenses Totales'],
      datasets: [
        {
          label: label1,
          data: [
            stats1.Revenus || 0,
            (stats1.Charges_fixes || 0) + (stats1.Essentiel || 0) + (stats1.Extras || 0)
          ],
          backgroundColor: COLORS.revenus
        },
        {
          label: label2,
          data: [
            stats2.Revenus || 0,
            (stats2.Charges_fixes || 0) + (stats2.Essentiel || 0) + (stats2.Extras || 0)
          ],
          backgroundColor: COLORS.depenses
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              return `${context.dataset.label}: ${formatCurrency(context.parsed.y)} €`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 500,
            callback: (value) => formatCurrency(value) + ' €'
          }
        }
      }
    }
  });
}

function renderLineChart(stats1, stats2, label1, label2) {
  const canvas = document.getElementById('chart-comparison-line');
  if (!canvas) return;
  
  if (window.chartComparisonLine) {
    window.chartComparisonLine.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  window.chartComparisonLine = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Revenus', 'Charges fixes', 'Essentiel', 'Extras', 'Épargne'],
      datasets: [
        {
          label: label1,
          data: [
            stats1.Revenus || 0,
            stats1.Charges_fixes || 0,
            stats1.Essentiel || 0,
            stats1.Extras || 0,
            stats1.Epargne || 0
          ],
          borderColor: COLORS.revenus,
          backgroundColor: 'rgba(78, 160, 156, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: label2,
          data: [
            stats2.Revenus || 0,
            stats2.Charges_fixes || 0,
            stats2.Essentiel || 0,
            stats2.Extras || 0,
            stats2.Epargne || 0
          ],
          borderColor: COLORS.depenses,
          backgroundColor: 'rgba(204, 0, 102, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              return `${context.dataset.label}: ${formatCurrency(context.parsed.y)} €`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 500,
            callback: (value) => formatCurrency(value) + ' €'
          }
        }
      }
    }
  });
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });

  document.getElementById('year-select').addEventListener('change', (e) => {
    state.currentYear = parseInt(e.target.value);
    updateDisplay();
  });

  document.getElementById('month-select').addEventListener('change', (e) => {
    state.currentMonth = parseInt(e.target.value);
    updateDashboard();
  });

  document.getElementById('new-transaction-btn').addEventListener('click', openNewTransactionForm);
  document.getElementById('dashboard-new-transaction-btn').addEventListener('click', openNewTransactionForm);
  document.getElementById('close-form-btn').addEventListener('click', closeTransactionForm);
  document.getElementById('cancel-transaction-btn').addEventListener('click', closeTransactionForm);
  document.getElementById('save-transaction-btn').addEventListener('click', handleTransactionSubmit);
  document.getElementById('save-and-new-transaction-btn').addEventListener('click', handleSaveAndNew);
  
  const reportBtn = document.getElementById('report-solde-btn');
  if (reportBtn) {
    reportBtn.addEventListener('click', reporterSolde);
  }
  
  document.getElementById('filter-month').addEventListener('change', (e) => {
    state.filterMonth = e.target.value;
    renderTransactionsTable();
  });

  document.getElementById('filter-type').addEventListener('change', (e) => {
    state.filterType = e.target.value;
    updateCategoryFilter();
    state.filterCategory = 'all';
    renderTransactionsTable();
  });
  
  document.getElementById('filter-category').addEventListener('change', (e) => {
    state.filterCategory = e.target.value;
    renderTransactionsTable();
  });

  // 🆕 RECHERCHE INTELLIGENTE
  const searchInput = document.getElementById('search-transactions');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase();
      renderTransactionsTable();
    });
  }

  document.querySelectorAll('.th-sortable').forEach(header => {
    header.addEventListener('click', () => {
      const sortKey = header.dataset.sort;
      if (state.sortKey === sortKey) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = sortKey;
        state.sortDir = 'desc';
      }
      renderTransactionsTable();
    });
  });
  
  const yearSelect = document.getElementById('year-select');
  yearSelect.innerHTML = YEARS.map(y => 
      `<option value="${y}" ${y === state.currentYear ? 'selected' : ''}>${y}</option>`
  ).join('');
  document.getElementById('nav-year').textContent = state.currentYear;
  
  // 🆕 EXPORT CSV
  const exportCsvBtn = document.getElementById('export-csv-btn-navbar');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportToCSV);
  }
  
  // 🆕 STATISTIQUES - Sélecteurs années + mois + mode
  const compareYear1 = document.getElementById('compare-year-1');
  const compareYear2 = document.getElementById('compare-year-2');
  const compareMonth1 = document.getElementById('compare-month-1');
  const compareMonth2 = document.getElementById('compare-month-2');
  
  if (compareYear1) compareYear1.addEventListener('change', renderStatistics);
  if (compareYear2) compareYear2.addEventListener('change', renderStatistics);
  if (compareMonth1) compareMonth1.addEventListener('change', renderStatistics);
  if (compareMonth2) compareMonth2.addEventListener('change', renderStatistics);
  
  // Toggle mode année / mois
  document.querySelectorAll('.stats-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.stats-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const isMonth = btn.dataset.mode === 'month';
      document.querySelectorAll('.stats-month-select').forEach(sel => {
        sel.style.display = isMonth ? 'inline-block' : 'none';
      });
      
      renderStatistics();
    });
  });
  
  // 🆕 PARAMÈTRES - Boutons
  document.querySelectorAll('.btn-add-category').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = e.currentTarget.dataset.type;
      addCategory(type);
    });
  });
  
  const resetBtn = document.getElementById('reset-categories-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetCategories);
  }
  
  const importBtnNav = document.getElementById('import-data-btn-navbar');
  const exportBtnNav = document.getElementById('export-data-btn-navbar');
  
  if (importBtnNav) {
    importBtnNav.addEventListener('click', () => {
      const fileInput = document.getElementById('import-file-input');
      if (fileInput) fileInput.click();
    });
  }
  
  if (exportBtnNav) {
    exportBtnNav.addEventListener('click', exportData);
  }
  
  document.getElementById('import-file-input')?.addEventListener('change', handleImportFile);
  
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('budget-cell-editable')) {
      const type = e.target.dataset.type;
      const category = e.target.dataset.category;
      const month = parseInt(e.target.dataset.month);
      const amount = parseFloat(e.target.dataset.amount);
      editBudgetCell(type, category, month, amount);
    }
    
    if (e.target.closest('.bulk-btn')) {
      const btn = e.target.closest('.bulk-btn');
      const type = btn.dataset.type;
      const category = btn.dataset.category;
      openBulkEdit(type, category);
    }
    
    if (e.target.closest('.btn-copy-budget')) {
      const btn = e.target.closest('.btn-copy-budget');
      const type = btn.dataset.type;
      copyBudget(type);
    }
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}-tab`).classList.add('active');
  
  if (tabName === 'dashboard') updateDashboard();
  if (tabName === 'transactions') renderTransactionsTable();
  if (tabName === 'budget') renderBudgetTables();
  if (tabName === 'statistics') renderStatistics();
  if (tabName === 'settings') renderSettingsCategories();
}

// ============================================
// NAVIGATION DASHBOARD → TRANSACTIONS
// ============================================

function showCategoryTransactions(type, category, month) {
  // Sauvegarder qu'on vient du dashboard
  state.returnToDashboard = true;
  
  // Configurer les filtres
  state.filterMonth = month.toString();
  state.filterType = type;
  state.filterCategory = category;
  
  // Mettre à jour les selects
  document.getElementById('filter-month').value = month.toString();
  document.getElementById('filter-type').value = type;
  updateCategoryFilter();
  document.getElementById('filter-category').value = category;
  
  // Basculer vers l'onglet transactions
  switchTab('transactions');
  
  // Afficher le bouton retour
  showReturnButton();
}

function showTypeTransactions(type, month) {
  // Sauvegarder qu'on vient du dashboard
  state.returnToDashboard = true;
  
  // Configurer les filtres (pas de filtre de catégorie)
  state.filterMonth = month.toString();
  state.filterType = type;
  state.filterCategory = 'all';
  
  // Mettre à jour les selects
  document.getElementById('filter-month').value = month.toString();
  document.getElementById('filter-type').value = type;
  updateCategoryFilter();
  document.getElementById('filter-category').value = 'all';
  
  // Basculer vers l'onglet transactions
  switchTab('transactions');
  
  // Afficher le bouton retour
  showReturnButton();
}

function showReturnButton() {
  const transactionsTab = document.getElementById('transactions-tab');
  let returnBtn = document.getElementById('return-to-dashboard-btn');
  
  if (!returnBtn) {
    returnBtn = document.createElement('button');
    returnBtn.id = 'return-to-dashboard-btn';
    returnBtn.className = 'btn-return-dashboard';
    returnBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
      Retour au récap
    `;
    returnBtn.addEventListener('click', returnToDashboard);
    transactionsTab.appendChild(returnBtn);
  }
  
  returnBtn.style.display = 'block';
}

function hideReturnButton() {
  const returnBtn = document.getElementById('return-to-dashboard-btn');
  if (returnBtn) {
    returnBtn.style.display = 'none';
  }
}

function returnToDashboard() {
  state.returnToDashboard = false;
  
  // Réinitialiser les filtres
  state.filterMonth = 'all';
  state.filterType = 'all';
  state.filterCategory = 'all';
  state.searchQuery = '';
  
  // Masquer le bouton retour
  hideReturnButton();
  
  // Retourner au dashboard
  switchTab('dashboard');
}

function loadUserData() {
  const storedTransactions = localStorage.getItem('transactions');
  const storedBudgets = localStorage.getItem('budgets');

  try {
    state.transactions = storedTransactions ? JSON.parse(storedTransactions) : initializeTransactions();
    state.budgets = storedBudgets ? JSON.parse(storedBudgets) : initializeBudgets();
  } catch (e) {
    console.error("Erreur de parsing LocalStorage", e);
    state.transactions = initializeTransactions();
    state.budgets = initializeBudgets();
  }
}

function initializeTransactions() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  if (currentYear >= 2025) {
      const monthStr = (currentMonth + 1).toString().padStart(2, '0');
      return [
        { id: 1, date: `${currentYear}-${monthStr}-05`, type: 'Extras', category: 'Shopping', amount: -7.26, comment: 'Vinted' },
        { id: 2, date: `${currentYear}-${monthStr}-04`, type: 'Revenus', category: 'Autres revenus', amount: 855.24, comment: 'LDDS' },
        { id: 3, date: `${currentYear}-${monthStr}-04`, type: 'Revenus', category: 'Salaire', amount: 1643.76, comment: 'Pole emploi' },
        { id: 4, date: `${currentYear}-${monthStr}-01`, type: 'Essentiel', category: 'Tabac', amount: -53.00, comment: '' },
        { id: 5, date: `${currentYear}-${monthStr}-01`, type: 'Essentiel', category: 'Alimentation', amount: -210.90, comment: 'Aldi' },
        { id: 6, date: `${currentYear}-${monthStr}-01`, type: 'Epargne', category: 'Fin de mois', amount: -856.24, comment: 'Ajustement' },
      ];
  }
  return [];
}

function initializeBudgets() {
  const budgets = {};
  const currentMonth = new Date().getMonth();
  
  const yearsToInit = [...new Set([new Date().getFullYear(), ...YEARS])];
  
  yearsToInit.forEach(y => {
    budgets[y] = {};
    Object.keys(CATEGORIES).forEach(type => {
      budgets[y][type] = {};
      CATEGORIES[type].forEach(cat => {
        budgets[y][type][cat] = Array(12).fill(0);
      });
    });
    if(y === new Date().getFullYear()){
      budgets[y].Revenus.Salaire[currentMonth] = 1643.76;
      budgets[y].Charges_fixes.EDF[currentMonth] = -78.73;
      budgets[y].Charges_fixes.Mutuelle[currentMonth] = -100.00;
      budgets[y].Essentiel.Alimentation[currentMonth] = -250;
      budgets[y].Extras.Shopping[currentMonth] = -100;
      budgets[y].Epargne.Santé[currentMonth] = -379.77;
      budgets[y].Epargne['Anniv/Noël'][currentMonth] = -50;
    }
  });
  return budgets;
}

function initializeBudgetsForYear(year) {
  state.budgets[year] = {};
  Object.keys(CATEGORIES).forEach(type => {
    state.budgets[year][type] = {};
    CATEGORIES[type].forEach(cat => {
      state.budgets[year][type][cat] = Array(12).fill(0);
    });
  });
  saveBudgets();
}

function saveTransactions() {
  localStorage.setItem('transactions', JSON.stringify(state.transactions));
  // Synchroniser avec Firebase si connecté
  if (typeof pushToFirebase === 'function') pushToFirebase();
}

function saveBudgets() {
  localStorage.setItem('budgets', JSON.stringify(state.budgets));
  // Synchroniser avec Firebase si connecté
  if (typeof pushToFirebase === 'function') pushToFirebase();
}

function updateDisplay() {
  document.getElementById('year-select').value = state.currentYear;
  
  const monthSelect = document.getElementById('month-select');
  if (monthSelect) {
      monthSelect.innerHTML = MONTHS_FULL.map((m, i) => 
        `<option value="${i}" ${i === state.currentMonth ? 'selected' : ''}>${m}</option>`
      ).join('');
      monthSelect.value = state.currentMonth;
  }
  
  document.getElementById('nav-year').textContent = state.currentYear;
  document.getElementById('trans-year').textContent = state.currentYear;

  // IMPORTANT : Mettre à jour les catégories dans tous les dropdowns
  updateCategoryFilter();
  updateCategoryOptions();

  const activeTab = document.querySelector('.nav-tab.active')?.dataset.tab || 'dashboard';
  switch(activeTab) {
      case 'dashboard': updateDashboard(); break;
      case 'transactions': renderTransactionsTable(); break;
      case 'budget': renderBudgetTables(); break;
      case 'statistics': renderStatistics(); break;
      case 'settings': renderSettingsCategories(); break;
  }
}

// ============================================
// CALCULS
// ============================================

function getReelAmount(type, category, year, month) {
  return state.transactions
    .filter(t => {
      if (t.type !== type || t.category !== category) return false;
      const transDate = new Date(t.date);
      return transDate.getFullYear() === year && transDate.getMonth() === month;
    })
    .reduce((sum, t) => sum + t.amount, 0);
}

function calculateStats() {
  const result = {};
  const currentBudgets = state.budgets[state.currentYear] || {};
  
  let totalRevenusReel = 0;
  let totalChargesFixesReel = 0;
  let totalEssentielReel = 0;
  let totalExtrasReel = 0;
  let totalEpargneReelPositif = 0;
  
  Object.keys(CATEGORIES).forEach(type => {
    let typeReel = 0;
    let typePrevu = 0;
    const byCategory = {};
    
    CATEGORIES[type].forEach(category => {
      const catTransactions = state.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === state.currentYear && 
               d.getMonth() === state.currentMonth &&
               t.type === type && t.category === category;
      });
      const catReel = catTransactions.reduce((sum, t) => sum + t.amount, 0);
      
      if (type === 'Epargne' && catReel > 0) {
        totalEpargneReelPositif += catReel;
      }
      
      const catBudget = currentBudgets[type]?.[category] || Array(12).fill(0);
      const catPrevu = catBudget[state.currentMonth] || 0;
      
      typeReel += catReel;
      typePrevu += catPrevu;
      
      byCategory[category] = {
        reel: catReel,
        prevu: catPrevu,
        ecart: catReel - catPrevu
      };
    });
    
    if (type === 'Revenus') totalRevenusReel = typeReel;
    if (type === 'Charges_fixes') totalChargesFixesReel = typeReel;
    if (type === 'Essentiel') totalEssentielReel = typeReel;
    if (type === 'Extras') totalExtrasReel = typeReel;
    
    result[type] = {
      reel: typeReel,
      prevu: typePrevu,
      byCategory: byCategory
    };
  });
  
  result.montantDisponible = totalRevenusReel - Math.abs(totalChargesFixesReel) - Math.abs(totalEssentielReel) - Math.abs(totalExtrasReel) - totalEpargneReelPositif;
  result.totalEpargneReelPositif = totalEpargneReelPositif;
  
  return result;
}

function calculateStatsForMonth(month) {
  const stats = {
    revenusReel: 0,
    chargesReel: 0,
    essentielReel: 0,
    extrasReel: 0,
    epargneNette: 0
  };
  
  state.transactions
    .filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === state.currentYear && d.getMonth() === month;
    })
    .forEach(t => {
      if (t.type === 'Revenus') stats.revenusReel += t.amount;
      if (t.type === 'Charges_fixes') stats.chargesReel += t.amount;
      if (t.type === 'Essentiel') stats.essentielReel += t.amount;
      if (t.type === 'Extras') stats.extrasReel += t.amount;
      if (t.type === 'Epargne') stats.epargneNette += t.amount;
    });
  
  return stats;
}

function calculateAnnualEpargneBudget() {
  const annualBudget = {};
  const currentBudgets = state.budgets[state.currentYear] || {};
  const epargneCategories = CATEGORIES.Epargne;
  
  const bases2025 = {
    'Fin de mois': 3870.83,
    'Pets/Home/Auto': 165.3,
    'Santé': 379.77,
    'Urgences': 203.5
  };

  epargneCategories.forEach(category => {
    const monthBudgets = currentBudgets.Epargne?.[category] || Array(12).fill(0);
    const totalMois = monthBudgets.reduce((sum, amount) => sum + amount, 0);
    
    if (state.currentYear === 2025) {
      const base = bases2025[category] || 0;
      annualBudget[category] = totalMois + base;
    } else if (state.currentYear > 2025) {
      const previousYearBudgets = state.budgets[state.currentYear - 1] || {};
      const previousMonthBudgets = previousYearBudgets.Epargne?.[category] || Array(12).fill(0);
      const previousYearTotal = previousMonthBudgets.reduce((sum, amount) => sum + amount, 0);
      
      const tempYear = state.currentYear;
      state.currentYear = state.currentYear - 1;
      const previousAnnualBudget = calculateAnnualEpargneBudget();
      state.currentYear = tempYear;
      
      annualBudget[category] = totalMois + (previousAnnualBudget[category] || 0);
    } else {
      annualBudget[category] = totalMois;
    }
  });
  
  return annualBudget;
}

function calculateAnnualEpargneReel() {
  const annualReel = {};
  const epargneCategories = CATEGORIES.Epargne;
  
  const bases2025 = {
    'Fin de mois': 3870.83,
    'Pets/Home/Auto': 165.3,
    'Santé': 379.77,
    'Urgences': 203.5
  };

  epargneCategories.forEach(category => {
    const transactionsAnnee = state.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === state.currentYear && 
             t.type === 'Epargne' && 
             t.category === category;
    });
    
    const totalMois = transactionsAnnee.reduce((sum, t) => sum + t.amount, 0);
    
    if (state.currentYear === 2025) {
      const base = bases2025[category] || 0;
      annualReel[category] = totalMois + base;
    } else if (state.currentYear > 2025) {
      const tempYear = state.currentYear;
      state.currentYear = state.currentYear - 1;
      const previousAnnualReel = calculateAnnualEpargneReel();
      state.currentYear = tempYear;
      
      annualReel[category] = totalMois + (previousAnnualReel[category] || 0);
    } else {
      annualReel[category] = totalMois;
    }
  });
  
  return annualReel;
}

// ============================================
// DASHBOARD
// ============================================

function updateDashboard() {
  const stats = calculateStats();
  
  document.getElementById('dashboard-month-title').innerHTML = 
    `${MONTHS_FULL[state.currentMonth]}<br>${state.currentYear}`;
  
  const revenusReelMensuel = stats.Revenus.reel;
  const chargesReelMensuel = Math.abs(stats.Charges_fixes.reel);
  const essentielReelMensuel = Math.abs(stats.Essentiel.reel);
  const extrasReelMensuel = Math.abs(stats.Extras.reel);
  const totalDepensesReelMensuel = chargesReelMensuel + essentielReelMensuel + extrasReelMensuel;
  
  const revenusPrevuMensuel = stats.Revenus.prevu;
  const chargesPrevuMensuel = Math.abs(stats.Charges_fixes.prevu);
  const essentielPrevuMensuel = Math.abs(stats.Essentiel.prevu);
  const extrasPrevuMensuel = Math.abs(stats.Extras.prevu);
  const totalDepensesPrevuMensuel = chargesPrevuMensuel + essentielPrevuMensuel + extrasPrevuMensuel;
  
  document.getElementById('stat-revenus').textContent = `${formatCurrency(revenusReelMensuel)} €`;

  const fixesRestant = chargesPrevuMensuel - chargesReelMensuel;
  document.getElementById('stat-depenses').textContent = `${formatCurrency(totalDepensesReelMensuel)} €`;
  const depensesSubtitle = document.querySelector('.stat-subtitle-micro');
  if (depensesSubtitle) {
    depensesSubtitle.textContent = `Fixes restant: ${formatCurrency(fixesRestant)} €`;
  }
  
  const epargneNetteMensuelle = state.transactions
    .filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === state.currentYear && 
             d.getMonth() === state.currentMonth &&
             t.type === 'Epargne';
    })
    .reduce((sum, t) => sum + t.amount, 0);
  
  const soldeDisponible = revenusReelMensuel - chargesPrevuMensuel - essentielReelMensuel - extrasReelMensuel - epargneNetteMensuelle;
  
  const soldeDispEl = document.getElementById('stat-disponible');
  soldeDispEl.textContent = `${formatCurrency(soldeDisponible)} €`;
  soldeDispEl.style.color = soldeDisponible >= 0 ? '#000000' : '#CC0066';
  
  const soldeCCP = revenusReelMensuel - chargesReelMensuel - essentielReelMensuel - extrasReelMensuel - epargneNetteMensuelle;
  
  const epargneAnnuelReel = calculateAnnualEpargneReel();
  
  const soldeLDDS = (epargneAnnuelReel['Fin de mois'] || 0) + 
                    (epargneAnnuelReel['Pets/Home/Auto'] || 0) +
                    (epargneAnnuelReel['Anniv/Noël'] || 0) + 
                    (epargneAnnuelReel['Vacances'] || 0);
  
  const soldeLivretA = (epargneAnnuelReel['Santé'] || 0) +
                       (epargneAnnuelReel['Travaux'] || 0) +
                       (epargneAnnuelReel['Urgences'] || 0);
  
  const soldesCCPEl = document.getElementById('solde-ccp');
  const soldesLDDSEl = document.getElementById('solde-ldds');
  const soldesLivretAEl = document.getElementById('solde-livret-a');
  
  if (soldesCCPEl) soldesCCPEl.textContent = `${formatCurrency(soldeCCP)} €`;
  if (soldesLDDSEl) soldesLDDSEl.textContent = `${formatCurrency(soldeLDDS)} €`;
  if (soldesLivretAEl) soldesLivretAEl.textContent = `${formatCurrency(soldeLivretA)} €`;
  
  updateReportButton(soldeCCP);
  
  renderStatsTable(stats);
  renderDetailedCategoriesTable(stats);
  
  const epargneBudgetAnnuel = calculateAnnualEpargneBudget();
  renderEpargneDashboardTable(epargneBudgetAnnuel);
  
  updateProgressBarDepenses();
  renderSparklineCCP();
}

function updateProgressBarDepenses() {
  const progressFill = document.getElementById('budget-progress-fill');
  if (!progressFill) return;
  
  const stats = calculateStats();
  
  const depensesReelles = Math.abs(stats.Charges_fixes.reel) + 
                          Math.abs(stats.Essentiel.reel) + 
                          Math.abs(stats.Extras.reel);
  
  const depensesPrevues = Math.abs(stats.Charges_fixes.prevu) + 
                          Math.abs(stats.Essentiel.prevu) + 
                          Math.abs(stats.Extras.prevu);
  
  const pourcentage = depensesPrevues > 0 ? (depensesReelles / depensesPrevues) * 100 : 0;
  const pourcentageAffiche = Math.min(pourcentage, 100);
  
  progressFill.style.width = pourcentageAffiche + '%';
  
  progressFill.classList.remove('progress-warning', 'progress-danger');
  
  if (pourcentage >= 100) {
    progressFill.classList.add('progress-danger');
  } else if (pourcentage >= 80) {
    progressFill.classList.add('progress-warning');
  }
}

function renderSparklineCCP() {
  const canvas = document.getElementById('sparkline-ccp');
  if (!canvas) return;
  
  const soldeCCPData = [];
  for (let m = 0; m < 12; m++) {
    const stats = calculateStatsForMonth(m);
    const soldeCCP = stats.revenusReel - 
                     Math.abs(stats.chargesReel) - 
                     Math.abs(stats.essentielReel) - 
                     Math.abs(stats.extrasReel) - 
                     stats.epargneNette;
    soldeCCPData.push(soldeCCP);
  }
  
  if (window.chartSparklineCCP) {
    window.chartSparklineCCP.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  window.chartSparklineCCP = new Chart(ctx, {
    type: 'line',
    data: {
      labels: MONTHS_SHORT,
      datasets: [{
        data: soldeCCPData,
        borderColor: '#4EA09C',
        backgroundColor: 'rgba(78, 160, 156, 0.15)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#4EA09C',
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          displayColors: false,
          backgroundColor: '#374151',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          padding: 8,
          cornerRadius: 6,
          callbacks: {
            title: (context) => MONTHS_FULL[context[0].dataIndex],
            label: (context) => formatCurrency(context.parsed.y) + ' €'
          }
        }
      },
      scales: {
        x: { display: false },
        y: { display: false }
      },
      interaction: {
        mode: 'index',
        intersect: false
      }
    }
  });
}

function renderStatsTable(stats) {
  const tbody = document.getElementById('stats-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const types = [
    { key: 'Revenus', label: 'Revenus' },
    { key: 'Charges_fixes', label: 'Charges Fixes' },
    { key: 'Essentiel', label: 'Essentiel' },
    { key: 'Extras', label: 'Extras' },
    { key: 'Epargne', label: 'Épargne' }
  ];
  
  types.forEach(({ key, label }) => {
    const typeStats = stats[key];
    if (!typeStats) return;
    
    const row = document.createElement('tr');
    
    let displayPrevu, displayReel, ecart;
    
    if (key === 'Revenus') {
      displayPrevu = typeStats.prevu;
      displayReel = typeStats.reel;
      ecart = typeStats.reel - typeStats.prevu;
    } else if (key === 'Epargne') {
      displayPrevu = typeStats.prevu;
      displayReel = typeStats.reel;
      ecart = typeStats.reel - typeStats.prevu;
    } else {
      displayPrevu = Math.abs(typeStats.prevu);
      displayReel = Math.abs(typeStats.reel);
      ecart = displayPrevu - displayReel;
    }
    
    let badgeClass = 'badge-ecart-neutre';
    if (Math.abs(ecart) < 0.01) {
      badgeClass = 'badge-ecart-neutre';
    } else if (ecart >= 0) {
      badgeClass = 'badge-ecart-positif';
    } else {
      badgeClass = 'badge-ecart-negatif';
    }
    
    row.innerHTML = `
      <td style="padding: 1rem 1.5rem; font-weight: 600;">
        <span class="category-link" onclick="showTypeTransactions('${key}', ${state.currentMonth})">
          ${label}
        </span>
      </td>
      <td style="padding: 1rem 1.5rem; text-align: right; font-weight: 600;">${formatCurrency(displayReel)} €</td>
      <td style="padding: 1rem 1.5rem; text-align: right;">${formatCurrency(displayPrevu)} €</td>
      <td style="padding: 1rem 1.5rem; text-align: right;">
        <span class="badge-ecart ${badgeClass}">${formatCurrency(ecart)} €</span>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderDetailedCategoriesTable(stats) {
  // Chercher ou créer le conteneur pour le tableau détaillé
  let detailedContainer = document.getElementById('detailed-categories-container');
  
  if (!detailedContainer) {
    // Trouver la grille des tableaux (qui contient récap + épargne)
    const tablesGrid = document.querySelector('.dashboard-tables-grid');
    
    // Créer la carte pour le tableau détaillé
    detailedContainer = document.createElement('div');
    detailedContainer.id = 'detailed-categories-container';
    detailedContainer.className = 'card-white';
    detailedContainer.style.marginTop = '1.5rem';
    detailedContainer.style.width = '100%';
    detailedContainer.style.overflowX = 'auto';
    
    // Insérer APRÈS la grille (pas dedans)
    tablesGrid.parentNode.insertBefore(detailedContainer, tablesGrid.nextSibling);
  }
  
  // Construire le HTML du tableau détaillé
  let html = `
    <div class="header-recap-bg" style="background-color: var(--color-epargne);">
      <h3 class="title-white-semibold">Détails par Catégorie</h3>
    </div>
    <table class="table-full">
      <thead class="thead-revenus-border">
        <tr>
          <th class="th-left-upper">Catégorie</th>
          <th class="th-right-upper">Réel</th>
          <th class="th-right-upper">Prévu</th>
          <th class="th-right-upper">Écart</th>
        </tr>
      </thead>
      <tbody class="tbody-white-divide">
  `;
  
  const types = [
    { key: 'Revenus', label: 'Revenus' },
    { key: 'Charges_fixes', label: 'Charges Fixes' },
    { key: 'Essentiel', label: 'Essentiel' },
    { key: 'Extras', label: 'Extras' },
    { key: 'Epargne', label: 'Épargne' }
  ];
  
  types.forEach(({ key, label }) => {
    const typeStats = stats[key];
    if (!typeStats || !typeStats.byCategory) return;
    
    // Afficher chaque catégorie du type
    Object.keys(typeStats.byCategory).forEach(category => {
      const catStats = typeStats.byCategory[category];
      
      let displayPrevu, displayReel, ecart;
      
      if (key === 'Revenus') {
        displayPrevu = catStats.prevu;
        displayReel = catStats.reel;
        ecart = catStats.reel - catStats.prevu;
      } else if (key === 'Epargne') {
        displayPrevu = catStats.prevu;
        displayReel = catStats.reel;
        ecart = catStats.reel - catStats.prevu;
      } else {
        displayPrevu = Math.abs(catStats.prevu);
        displayReel = Math.abs(catStats.reel);
        ecart = displayPrevu - displayReel;
      }
      
      let badgeClass = 'badge-ecart-neutre';
      if (Math.abs(ecart) < 0.01) {
        badgeClass = 'badge-ecart-neutre';
      } else if (ecart >= 0) {
        badgeClass = 'badge-ecart-positif';
      } else {
        badgeClass = 'badge-ecart-negatif';
      }
      
      html += `
        <tr>
          <td style="padding: 1rem 1.5rem; font-weight: 500;">
            <span class="category-link" onclick="showCategoryTransactions('${key}', '${escapeHtmlAttr(category)}', ${state.currentMonth})">
              ${category}
            </span>
          </td>
          <td style="padding: 1rem 1.5rem; text-align: right;">${formatCurrency(displayReel)} €</td>
          <td style="padding: 1rem 1.5rem; text-align: right; font-weight: 600;">${formatCurrency(displayPrevu)} €</td>
          <td style="padding: 1rem 1.5rem; text-align: right;">
            <span class="badge-ecart ${badgeClass}">${formatCurrency(ecart)} €</span>
          </td>
        </tr>
      `;
    });
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  detailedContainer.innerHTML = html;
}

function renderEpargneDashboardTable(epargneBudget) {
    const tbody = document.getElementById('epargne-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let totalEpargneAnnuel = 0;
    
    CATEGORIES.Epargne.forEach(category => {
        const budgetAmount = epargneBudget[category] || 0;
        totalEpargneAnnuel += budgetAmount;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1rem 1.5rem; font-weight: 500;">${category}</td>
            <td style="padding: 1rem 1.5rem; text-align: right; font-weight: 600;">
                ${formatCurrency(budgetAmount)} €
            </td>
        `;
        tbody.appendChild(row);
    });
    
    const headerEpargne = document.querySelector('.header-epargne-bg h3');
    if (headerEpargne) {
        headerEpargne.textContent = `Épargne Totale: ${formatCurrency(totalEpargneAnnuel)} €`;
    }
}

function updateReportButton(soldeCCP) {
  const reportBtn = document.getElementById('report-solde-btn');
  if (!reportBtn) return;
  
  // CORRECTION : Calculer correctement le mois suivant
  const nextMonth = (state.currentMonth + 1) % 12;
  const nextYear = state.currentMonth === 11 ? state.currentYear + 1 : state.currentYear;
  const nextMonthName = MONTHS_FULL[nextMonth];
  
  const isDecembre = state.currentMonth === 11;
  
  if (isDecembre) {
    reportBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
      Reporter vers ${nextMonthName} ${nextYear}
    `;
    reportBtn.title = `Créer une transaction "Solde M-1" le 1er ${nextMonthName} ${nextYear} avec ${formatCurrency(soldeCCP)} €`;
  } else {
    reportBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
      Reporter vers ${nextMonthName}
    `;
    reportBtn.title = `Créer une transaction "Solde M-1" le 1er ${nextMonthName} avec ${formatCurrency(soldeCCP)} €`;
  }
  
  reportBtn.dataset.soldeCcp = soldeCCP;
  reportBtn.dataset.nextMonth = nextMonth;
  reportBtn.dataset.nextYear = nextYear;
}

function reporterSolde() {
  const reportBtn = document.getElementById('report-solde-btn');
  if (!reportBtn) return;
  
  const soldeCCP = parseFloat(reportBtn.dataset.soldeCcp);
  const nextMonth = parseInt(reportBtn.dataset.nextMonth);
  const nextYear = parseInt(reportBtn.dataset.nextYear);
  const nextMonthName = MONTHS_FULL[nextMonth];
  
  const firstDayNextMonth = `${nextYear}-${(nextMonth + 1).toString().padStart(2, '0')}-01`;
  const existingReport = state.transactions.find(t => 
    t.date === firstDayNextMonth && 
    t.type === 'Revenus' && 
    t.category === 'Solde M-1'
  );
  
  if (existingReport) {
    const confirm1 = confirm(
      `Une transaction "Solde M-1" existe déjà pour ${nextMonthName} ${nextYear} (${formatCurrency(existingReport.amount)} €).\n\n` +
      `Voulez-vous la remplacer par le nouveau solde (${formatCurrency(soldeCCP)} €) ?`
    );
    
    if (!confirm1) return;
    
    existingReport.amount = soldeCCP;
    existingReport.comment = `Report automatique depuis ${MONTHS_FULL[state.currentMonth]} ${state.currentYear}`;
    
    saveTransactions();
    alert(`✅ Transaction "Solde M-1" mise à jour pour ${nextMonthName} ${nextYear} : ${formatCurrency(soldeCCP)} €`);
  } else {
    const confirm2 = confirm(
      `Créer une transaction "Solde M-1" le 1er ${nextMonthName} ${nextYear} ?\n\n` +
      `Montant : ${formatCurrency(soldeCCP)} €\n` +
      `(Solde CCP de ${MONTHS_FULL[state.currentMonth]} ${state.currentYear})`
    );
    
    if (!confirm2) return;
    
    if (!state.budgets[nextYear]) {
      initializeBudgetsForYear(nextYear);
    }
    
    const newId = state.transactions.length > 0 ? Math.max(...state.transactions.map(t => t.id)) + 1 : 1;
    const newTransaction = {
      id: newId,
      date: firstDayNextMonth,
      type: 'Revenus',
      category: 'Solde M-1',
      amount: soldeCCP,
      comment: `Report automatique depuis ${MONTHS_FULL[state.currentMonth]} ${state.currentYear}`
    };
    
    state.transactions.push(newTransaction);
    saveTransactions();
    
    alert(`✅ Transaction "Solde M-1" créée pour ${nextMonthName} ${nextYear} : ${formatCurrency(soldeCCP)} €`);
  }
  
  if (confirm(`Voulez-vous afficher ${nextMonthName} ${nextYear} maintenant ?`)) {
    state.currentMonth = nextMonth;
    state.currentYear = nextYear;
    updateDisplay(); 
  } else {
    updateDashboard();
    renderTransactionsTable();
  }
}

// ============================================
// TRANSACTIONS (avec recherche intelligente)
// ============================================

function openNewTransactionForm() {
  state.editingTransaction = null;
  document.getElementById('form-title').textContent = 'Nouvelle Transaction';
  document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('trans-type').value = 'Essentiel';
  updateCategoryOptions();
  document.getElementById('trans-category').value = CATEGORIES.Essentiel[0];
  document.getElementById('trans-amount').value = '';
  document.getElementById('trans-comment').value = '';
  document.getElementById('transaction-form').style.display = 'flex';
  
  const transDate = document.getElementById('trans-date');
  const transType = document.getElementById('trans-type');
  const transCategory = document.getElementById('trans-category');
  const transAmount = document.getElementById('trans-amount');
  const transComment = document.getElementById('trans-comment');
  
  transDate.removeEventListener('change', updateAmountFromBudget);
  transType.removeEventListener('change', handleTypeChange);
  transCategory.removeEventListener('change', updateAmountFromBudget);
  
  transDate.addEventListener('change', updateAmountFromBudget);
  transType.addEventListener('change', handleTypeChange);
  transCategory.addEventListener('change', updateAmountFromBudget);
  
  [transDate, transType, transCategory, transAmount, transComment].forEach(field => {
    field.removeEventListener('keypress', handleEnterKey);
    field.addEventListener('keypress', handleEnterKey);
  });
  
  updateAmountFromBudget();
}

function handleEnterKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleTransactionSubmit();
  }
}

function handleTypeChange() {
  updateCategoryOptions();
  updateAmountFromBudget();
}

function closeTransactionForm() {
  document.getElementById('transaction-form').style.display = 'none';
}

function updateCategoryOptions() {
  const type = document.getElementById('trans-type').value;
  const categorySelect = document.getElementById('trans-category');
  categorySelect.innerHTML = CATEGORIES[type].map(cat => 
    `<option value="${cat}">${cat}</option>`
  ).join('');
}

function updateAmountFromBudget() {
  const dateStr = document.getElementById('trans-date').value;
  if (!dateStr) return;
  
  const date = new Date(dateStr);
  const month = date.getMonth();
  const year = date.getFullYear();
  const type = document.getElementById('trans-type').value;
  const category = document.getElementById('trans-category').value;
  
  const budget = state.budgets[year]?.[type]?.[category]?.[month];
  const amountInput = document.getElementById('trans-amount');
  const commentInput = document.getElementById('trans-comment');
  
  if (type === 'Charges_fixes' && !commentInput.value.trim()) {
    const lastTransaction = state.transactions
      .filter(t => t.type === 'Charges_fixes' && t.category === category)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    
    if (lastTransaction && lastTransaction.comment) {
      commentInput.value = lastTransaction.comment;
    }
  }
  
  if (budget !== undefined && budget !== 0) {
    const absValue = Math.abs(budget);
    
    if (type === 'Charges_fixes') {
      amountInput.value = absValue.toFixed(2);
    } 
    else if (type === 'Essentiel' || type === 'Extras') {
      if (amountInput.value === '') {
        amountInput.value = absValue.toFixed(2);
      }
    }
    else if (amountInput.value === '') {
      amountInput.value = absValue.toFixed(2);
    }
  }
}

function handleTransactionSubmit() {
  const date = document.getElementById('trans-date').value;
  const type = document.getElementById('trans-type').value;
  const category = document.getElementById('trans-category').value;
  const amountInput = parseFloat(document.getElementById('trans-amount').value) || 0;
  const comment = document.getElementById('trans-comment').value;

  if (!date || !category || amountInput === 0) {
    alert('Veuillez remplir tous les champs obligatoires.');
    return;
  }

  let amount = amountInput;
  
  if (type === 'Charges_fixes' || type === 'Essentiel' || type === 'Extras') {
    amount = -Math.abs(amountInput);
  }
  
  if (state.editingTransaction) {
    const trans = state.transactions.find(t => t.id === state.editingTransaction);
    if (trans) {
      trans.date = date;
      trans.type = type;
      trans.category = category;
      trans.amount = amount;
      trans.comment = comment;
    }
  } else {
    const newId = state.transactions.length > 0 ? Math.max(...state.transactions.map(t => t.id)) + 1 : 1;
    state.transactions.push({ id: newId, date, type, category, amount, comment });
  }

  saveTransactions();
  closeTransactionForm();
  renderTransactionsTable();
  updateDashboard(); 
  renderBudgetTables(); 
}

function handleSaveAndNew() {
  const date = document.getElementById('trans-date').value;
  const type = document.getElementById('trans-type').value;
  const category = document.getElementById('trans-category').value;
  const amountInput = parseFloat(document.getElementById('trans-amount').value) || 0;
  const comment = document.getElementById('trans-comment').value;

  if (!date || !category || amountInput === 0) {
    alert('Veuillez remplir tous les champs obligatoires.');
    return;
  }

  let amount = amountInput;
  
  if (type === 'Charges_fixes' || type === 'Essentiel' || type === 'Extras') {
    amount = -Math.abs(amountInput);
  }
  
  const newId = state.transactions.length > 0 ? Math.max(...state.transactions.map(t => t.id)) + 1 : 1;
  state.transactions.push({ id: newId, date, type, category, amount, comment });

  saveTransactions();
  renderTransactionsTable();
  updateDashboard(); 
  renderBudgetTables();
  
  document.getElementById('trans-amount').value = '';
  document.getElementById('trans-comment').value = '';
  
  updateAmountFromBudget();
}

function editTransaction(id) {
  const trans = state.transactions.find(t => t.id === id);
  if (!trans) return;

  state.editingTransaction = id;
  document.getElementById('form-title').textContent = 'Modifier Transaction';
  document.getElementById('trans-date').value = trans.date;
  document.getElementById('trans-type').value = trans.type;
  updateCategoryOptions();
  document.getElementById('trans-category').value = trans.category;
  document.getElementById('trans-amount').value = Math.abs(trans.amount).toFixed(2);
  document.getElementById('trans-comment').value = trans.comment;
  document.getElementById('transaction-form').style.display = 'flex';
  
  const transDate = document.getElementById('trans-date');
  const transType = document.getElementById('trans-type');
  const transCategory = document.getElementById('trans-category');
  const transAmount = document.getElementById('trans-amount');
  const transComment = document.getElementById('trans-comment');
  
  transDate.removeEventListener('change', updateAmountFromBudget);
  transType.removeEventListener('change', handleTypeChange);
  transCategory.removeEventListener('change', updateAmountFromBudget);
  
  transDate.addEventListener('change', updateAmountFromBudget);
  transType.addEventListener('change', handleTypeChange);
  transCategory.addEventListener('change', updateAmountFromBudget);
  
  [transDate, transType, transCategory, transAmount, transComment].forEach(field => {
    field.removeEventListener('keypress', handleEnterKey);
    field.addEventListener('keypress', handleEnterKey);
  });
}

function deleteTransaction(id) {
  if (!confirm('Supprimer cette transaction ?')) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveTransactions();
  renderTransactionsTable();
  updateDashboard();
  renderBudgetTables(); 
}

function updateCategoryFilter() {
  const filterCategory = document.getElementById('filter-category');
  if (!filterCategory) return;
  
  const selectedType = state.filterType;
  
  filterCategory.innerHTML = '<option value="all">Toutes les catégories</option>';
  
  if (selectedType === 'all') {
    const allCategories = new Set();
    Object.values(CATEGORIES).forEach(cats => {
      cats.forEach(cat => allCategories.add(cat));
    });
    Array.from(allCategories).sort().forEach(cat => {
      filterCategory.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
  } else {
    CATEGORIES[selectedType]?.forEach(cat => {
      filterCategory.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
  }
}

function renderTransactionsTable() {
  const tbody = document.getElementById('transactions-table-body');
  if (!tbody) return;
  
  let filtered = state.transactions.filter(t => {
    const d = new Date(t.date);
    const transYear = d.getFullYear();
    const transMonth = d.getMonth().toString();
    
    if (transYear !== state.currentYear) return false;
    
    if (state.filterMonth !== 'all' && transMonth !== state.filterMonth) return false;
    
    if (state.filterType !== 'all') {
      const typeMatches = t.type === state.filterType;
      if (t.type === 'Epargne' && state.filterType !== 'Epargne') {
          return false;
      }
      if (t.type !== 'Epargne' && !typeMatches) return false;
      if (t.type === 'Epargne' && typeMatches) return true; 
    }
    
    if (state.filterCategory !== 'all' && t.category !== state.filterCategory) return false;
    
    // 🆕 RECHERCHE INTELLIGENTE
    if (state.searchQuery && state.searchQuery.trim() !== '') {
      const query = state.searchQuery.trim();
      const searchableText = `${t.category} ${t.comment} ${Math.abs(t.amount).toFixed(2)}`.toLowerCase();
      
      if (!searchableText.includes(query)) return false;
    }
    
    return true;
  });
  
  filtered.sort((a, b) => {
    let valA, valB;
    
    switch (state.sortKey) {
      case 'date':
        valA = new Date(a.date);
        valB = new Date(b.date);
        break;
      case 'type':
        valA = a.type.toLowerCase();
        valB = b.type.toLowerCase();
        break;
      case 'category':
        valA = a.category.toLowerCase();
        valB = b.category.toLowerCase();
        break;
      case 'amount':
        valA = a.amount;
        valB = b.amount;
        break;
      default:
        valA = new Date(a.date);
        valB = new Date(b.date);
    }
    
    if (valA < valB) return state.sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return state.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  tbody.innerHTML = '';

  filtered.forEach(t => {
    const date = new Date(t.date);
    const dateText = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().substring(2)}`;
    
    const amountText = formatCurrency(Math.abs(t.amount));
    const amountColor = t.amount >= 0 ? COLORS.revenus : COLORS.depenses;
    const amountSign = t.amount >= 0 ? '+' : '-';
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="padding: 0.4rem 0.75rem;">${dateText}</td>
      <td style="padding: 0.4rem 0.75rem;">${t.type.replace('_', ' ')}</td>
      <td style="padding: 0.4rem 0.75rem;">${t.category}</td>
      <td style="padding: 0.4rem 0.75rem; text-align: right; font-weight: 600; color: ${amountColor};">${amountSign} ${amountText} €</td>
      <td style="padding: 0.4rem 0.75rem;">${t.comment}</td>
      <td style="padding: 0.4rem 0.75rem; text-align: center; white-space: nowrap;">
        <button onclick="editTransaction(${t.id})" class="btn-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"></path><path d="M16.5 3.5l4 4L7 21H3v-4L16.5 3.5z"></path>
          </svg>
        </button>
        <button onclick="deleteTransaction(${t.id})" class="btn-icon btn-delete">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  const totalTransactions = filtered.reduce((sum, t) => sum + t.amount, 0);
  
  const totalRow = document.createElement('tr');
  totalRow.style.fontWeight = 'bold';
  totalRow.style.backgroundColor = '#f9fafb';
  const totalSign = totalTransactions >= 0 ? '+' : '-';
  totalRow.innerHTML = `
    <td colspan="3" style="padding: 0.75rem; text-align: right;">TOTAL (${filtered.length} transaction${filtered.length > 1 ? 's' : ''}) :</td>
    <td style="padding: 0.75rem; text-align: right; font-weight: 700; color: ${totalTransactions >= 0 ? COLORS.revenus : COLORS.depenses};">
      ${totalSign} ${formatCurrency(Math.abs(totalTransactions))} €
    </td>
    <td colspan="2"></td>
  `;
  tbody.appendChild(totalRow);
}

// ============================================
// BUDGET
// ============================================

function getTableNavigationLinks(currentType) {
  const types = Object.keys(CATEGORIES);
  const otherTypes = types.filter(t => t !== currentType);
  
  return otherTypes.map(type => {
    let label = type.replace('_', ' ');
    // Garder les noms complets au lieu des abréviations
    if (type === 'Charges_fixes') label = 'Charges Fixes';
    if (type === 'Essentiel') label = 'Essentiel';
    if (type === 'Extras') label = 'Extras';
    if (type === 'Epargne') label = 'Épargne';
    if (type === 'Revenus') label = 'Revenus';
    
    return `<a href="#budget-${type}" class="table-nav-link" title="Aller à ${label}">${label}</a>`;
  }).join('');
}

function renderBudgetTables() {
  const budgetContainer = document.getElementById('budget-tables-container');
  if (!budgetContainer) return;
  budgetContainer.innerHTML = '';

  const types = Object.keys(CATEGORIES);

  types.forEach(type => {
    const typeLabel = type.replace('_', ' ');
    const currentBudgets = state.budgets[state.currentYear]?.[type] || {};

    let html = `<div id="budget-${type}" class="card-white bordered-${type === 'Revenus' ? 'revenus' : type.includes('Epargne') ? 'epargne' : 'depenses'} budget-table-wrapper">
                  <div class="header-${type === 'Revenus' ? 'revenus-bg' : type.includes('Epargne') ? 'epargne-bg' : 'depenses-bg'}">
                    <h3 class="title-white-semibold">${typeLabel.toUpperCase()}</h3>
                    <div class="table-nav-links">
                      ${getTableNavigationLinks(type)}
                    </div>
                    <button class="btn-copy-budget" data-type="${type}">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      Copier Budget
                    </button>
                  </div>
                  <div class="table-scroll">
                  <table class="table-full budget-table budget-table-compact">
                    <thead>
                      <tr>
                        <th class="sticky-col category-col">Catégorie</th>
                        ${MONTHS_SHORT.map((m, i) => `<th class="${i === state.currentMonth ? 'current-month-header' : ''}">${m}</th>`).join('')}
                        <th>Total Annuel</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>`;
    
    let totalAnnualBudget = 0;
    let totalAnnualReel = 0;
    
    let epargneAnnuelPrevu = {};
    let epargneAnnuelReel = {};
    if (type === 'Epargne') {
      epargneAnnuelPrevu = calculateAnnualEpargneBudget();
      epargneAnnuelReel = calculateAnnualEpargneReel();
    }

    CATEGORIES[type].forEach(category => {
      const budgets = currentBudgets[category] || Array(12).fill(0);
      let annualTotalPrevu = budgets.reduce((sum, amount) => sum + amount, 0);
      
      if (type === 'Epargne') {
        annualTotalPrevu = epargneAnnuelPrevu[category] || 0;
      }
      
      totalAnnualBudget += Math.abs(annualTotalPrevu);

      let categoryAnnualReel = 0;

      let rowHTML_prevu = `<tr class="budget-prevu-row">
                             <td class="sticky-col category-col">${category} prévu</td>`;
      
      for (let m = 0; m < 12; m++) {
        const amount = budgets[m] || 0;
        const isCurrentMonth = m === state.currentMonth && state.currentYear === new Date().getFullYear();
        
        rowHTML_prevu += `<td class="budget-cell-editable ${isCurrentMonth ? 'current-month-cell' : ''}" 
                                  data-type="${type}" 
                                  data-category="${category}" 
                                  data-month="${m}" 
                                  data-amount="${amount}">
                            ${formatCurrency(Math.abs(amount))} €
                          </td>`;
      }
      
      rowHTML_prevu += `<td class="total-annual-cell">${formatCurrency(Math.abs(annualTotalPrevu))} €</td>`;
      
      rowHTML_prevu += `<td>
                           <button class="bulk-btn" data-type="${type}" data-category="${category}" title="Affecter le même montant aux 12 mois">
                             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                           </button>
                         </td>`;
      rowHTML_prevu += `</tr>`;
      
      let rowHTML_reel = `<tr class="budget-reel-row budget-category-separator">
                            <td class="sticky-col category-col">${category} réel</td>`;
      
      for (let m = 0; m < 12; m++) {
        const reelAmount = getReelAmount(type, category, state.currentYear, m);
        categoryAnnualReel += reelAmount;
        const isCurrentMonth = m === state.currentMonth && state.currentYear === new Date().getFullYear();
        const cellClass = `budget-cell-reel ${isCurrentMonth ? 'current-month-cell-reel' : ''}`;
        
        let colorStyle = '';
        if (m === state.currentMonth && budgets[m] !== 0) {
            const planned = budgets[m];
            const real = reelAmount;
            
            if (type === 'Revenus') {
                colorStyle = real >= planned ? `color: ${COLORS.revenus};` : `color: ${COLORS.depenses};`;
            } else {
                const plannedAbs = Math.abs(planned);
                const realAbs = Math.abs(real);
                colorStyle = realAbs <= plannedAbs ? `color: ${COLORS.revenus};` : `color: ${COLORS.depenses};`;
            }
        }

        rowHTML_reel += `<td class="${cellClass}" style="${colorStyle}">${formatCurrency(Math.abs(reelAmount))} €</td>`;
      }

      totalAnnualReel += categoryAnnualReel;

      let annualReelDisplay = categoryAnnualReel;
      if (type === 'Epargne') {
        annualReelDisplay = epargneAnnuelReel[category] || 0;
      }

      rowHTML_reel += `<td class="total-annual-cell-reel">${formatCurrency(Math.abs(annualReelDisplay))} €</td>`;
      rowHTML_reel += `<td></td>`; 
      rowHTML_reel += `</tr>`;

      html += rowHTML_prevu;
      html += rowHTML_reel;
    });

    let totalMensuelPrevu = Array(12).fill(0);
    let totalMensuelReel = Array(12).fill(0);
    
    CATEGORIES[type].forEach(category => {
      const budgets = currentBudgets[category] || Array(12).fill(0);
      
      for (let m = 0; m < 12; m++) {
        if (type === 'Revenus' || type === 'Epargne') {
          totalMensuelPrevu[m] += (budgets[m] || 0);
        } else {
          totalMensuelPrevu[m] += Math.abs(budgets[m] || 0);
        }
        
        const reelAmount = getReelAmount(type, category, state.currentYear, m);
        
        if (type === 'Revenus' || type === 'Epargne') {
          totalMensuelReel[m] += reelAmount;
        } else {
          totalMensuelReel[m] += Math.abs(reelAmount);
        }
      }
    });
    
    let totalRowHTML_prevu = `<tr class="budget-total-row budget-total-background"> 
                            <td class="sticky-col category-col">TOTAL ${typeLabel.toUpperCase()} (PRÉVU)</td>`;
    
    for (let m = 0; m < 12; m++) {
      const isCurrentMonth = m === state.currentMonth && state.currentYear === new Date().getFullYear();
      const montant = totalMensuelPrevu[m];
      
      let displayValue;
      if (type === 'Revenus' || type === 'Epargne') {
        displayValue = formatCurrency(montant);
      } else {
        displayValue = formatCurrency(Math.abs(montant));
      }
      
      totalRowHTML_prevu += `<td class="${isCurrentMonth ? 'current-month-cell' : ''}" style="font-weight: 600;">
                              ${displayValue} €
                            </td>`;
    }
    
    totalRowHTML_prevu += `<td class="total-annual-cell">${formatCurrency(Math.abs(totalAnnualBudget))} €</td>
                            <td></td>
                          </tr>`;
                          
    let totalReelDisplay = totalAnnualReel;
    if (type === 'Epargne') {
      totalReelDisplay = Object.values(epargneAnnuelReel).reduce((sum, val) => sum + val, 0);
    }
    
    let totalRowHTML_reel = `<tr class="budget-total-row budget-total-reel-row budget-total-background"> 
                            <td class="sticky-col category-col">TOTAL ${typeLabel.toUpperCase()} (RÉEL)</td>`;
    
    for (let m = 0; m < 12; m++) {
      const isCurrentMonth = m === state.currentMonth && state.currentYear === new Date().getFullYear();
      const montant = totalMensuelReel[m];
      
      let displayValue;
      if (type === 'Revenus' || type === 'Epargne') {
        displayValue = formatCurrency(montant);
      } else {
        displayValue = formatCurrency(Math.abs(montant));
      }
      
      totalRowHTML_reel += `<td class="${isCurrentMonth ? 'current-month-cell-reel' : ''}" style="font-weight: 600;">
                             ${displayValue} €
                           </td>`;
    }
    
    totalRowHTML_reel += `<td class="total-annual-cell-reel">${formatCurrency(Math.abs(totalReelDisplay))} €</td>
                            <td></td>
                          </tr>`;
    
    html += totalRowHTML_prevu;
    html += totalRowHTML_reel;
    
    html += `</tbody></table></div></div>`;
    
    budgetContainer.insertAdjacentHTML('beforeend', html);
  });
}

function editBudgetCell(type, category, month, currentValue) {
  const value = prompt(
    `Modifier le budget pour ${category} (${MONTHS_FULL[month]} ${state.currentYear}).\n\n` +
    `Entrez le montant (ex: 100 pour un revenu, -100 pour une dépense/épargne) :`, 
    currentValue.toFixed(2)
  );

  if (value === null) return;
  
  const amount = Math.round(parseFloat(value) * 100) / 100 || 0; 

  if (!state.budgets[state.currentYear]) initializeBudgetsForYear(state.currentYear);
  if (!state.budgets[state.currentYear][type]) state.budgets[state.currentYear][type] = {};
  if (!state.budgets[state.currentYear][type][category]) state.budgets[state.currentYear][type][category] = Array(12).fill(0);
  
  state.budgets[state.currentYear][type][category][month] = amount;
  
  saveBudgets();
  renderBudgetTables();
  updateDashboard();
}

function copyBudget(type) {
  const currentBudgets = state.budgets[state.currentYear]?.[type];
  if (!currentBudgets) {
    alert('Aucun budget à copier pour cette catégorie.');
    return;
  }
  
  const targetYear = state.currentYear;
  const targetType = type;
  
  const monthToCopy = prompt(
    `Copier les budgets de quel mois pour ${targetYear} ?\n\n` + 
    `Entrez le numéro du mois (1=Janvier, 12=Décembre). Le mois actuel est ${state.currentMonth + 1}.`,
    (state.currentMonth + 1).toString()
  );
  
  if (monthToCopy === null) return;
  
  const sourceMonth = parseInt(monthToCopy) - 1;
  if (sourceMonth < 0 || sourceMonth > 11) {
    alert('Numéro de mois invalide.');
    return;
  }

  const confirmCopy = confirm(
    `CONFIRMER : Copier TOUTES les catégories du mois de ${MONTHS_FULL[sourceMonth]} ${targetYear}\n` +
    `VERS TOUS les autres mois de ${targetYear} pour la section ${targetType.toUpperCase()} ?`
  );
  
  if (!confirmCopy) return;

  let changesCount = 0;
  
  CATEGORIES[targetType].forEach(category => {
    const sourceAmount = currentBudgets[category]?.[sourceMonth] || 0;
    
    for (let month = 0; month < 12; month++) {
      if (month !== sourceMonth) {
        if (!state.budgets[targetYear][targetType][category]) {
            state.budgets[targetYear][targetType][category] = Array(12).fill(0);
        }
        state.budgets[targetYear][targetType][category][month] = sourceAmount;
        changesCount++;
      }
    }
  });

  saveBudgets();
  renderBudgetTables();
  updateDashboard();
  alert(`✅ ${changesCount} budgets copiés de ${MONTHS_FULL[sourceMonth]} vers les 11 autres mois de l'année ${targetYear} pour la section ${targetType.toUpperCase()}.`);
}

function openBulkEdit(type, category) {
  const value = prompt(
    `Affecter quel montant (fixe) à la catégorie '${category}' pour les 12 mois de ${state.currentYear}?\n` +
    `Entrez le montant (ex: -100.00 pour une dépense) :`, '0.00'
  );

  if (value === null) return;
  
  const amount = Math.round(parseFloat(value) * 100) / 100 || 0; 
  
  if (!state.budgets[state.currentYear]) initializeBudgetsForYear(state.currentYear);
  if (!state.budgets[state.currentYear][type]) state.budgets[state.currentYear][type] = {};
  
  state.budgets[state.currentYear][type][category] = Array(12).fill(amount);
  
  saveBudgets();
  renderBudgetTables();
  updateDashboard();
  alert(`✅ Montant de ${formatCurrency(amount)} € affecté aux 12 mois pour la catégorie ${category}.`);
}

// ============================================
// DATA MANAGEMENT
// ============================================

function exportData() {
  const data = {
    transactions: state.transactions,
    budgets: state.budgets,
    categories: CATEGORIES,
    epargneBase: state.epargneBase,
    exportDate: new Date().toISOString(),
    version: '6.0'
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budget_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      if (confirm('Remplacer toutes les données actuelles par celles du fichier ?')) {
        state.transactions = data.transactions || [];
        state.budgets = data.budgets || {};
        if (data.categories) {
          CATEGORIES = data.categories;
          saveCategories();
        }
        if (data.epargneBase) state.epargneBase = data.epargneBase;
        saveTransactions();
        saveBudgets();
        updateDisplay();
        alert('✅ Données importées avec succès !');
      }
    } catch (error) {
      alert('❌ Erreur lors de l\'importation : ' + error.message);
    }
  };
  reader.readAsText(file);
  
  event.target.value = '';
}
