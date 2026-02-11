// ============================================
// 🔄 FIREBASE-SYNC.JS — Synchronisation temps réel
// Version 1.1 — Aux Petits des Oiseaux
// ============================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyANl-hEncz22PVXEk6dHoBdtqLf9S0Ecr0",
  authDomain: "auxpetitsdesoiseaux-610fe.firebaseapp.com",
  databaseURL: "https://auxpetitsdesoiseaux-610fe-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "auxpetitsdesoiseaux-610fe",
  storageBucket: "auxpetitsdesoiseaux-610fe.firebasestorage.app",
  messagingSenderId: "710461886524",
  appId: "1:710461886524:web:64edd27e3629c542a83339"
};

// ============================================
// VARIABLES INTERNES (ne pas modifier)
// ============================================

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let currentFirebaseUser = null;
let isSyncingFromFirebase = false;
let firebaseListener = null;
let syncDebounceTimer = null;

// ============================================
// INITIALISATION
// ============================================

function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn('⚠️ SDK Firebase non chargé — mode local uniquement');
    updateSyncStatus('offline', 'Mode local');
    return;
  }

  try {
    firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    firebaseAuth = firebase.auth();
    firebaseDb = firebase.database();

    firebaseAuth.onAuthStateChanged(handleAuthStateChanged);

    console.log('✅ Firebase initialisé');
  } catch (error) {
    console.error('❌ Erreur initialisation Firebase:', error);
    updateSyncStatus('error', 'Erreur Firebase');
  }
}

// ============================================
// AUTHENTIFICATION
// ============================================

function handleAuthStateChanged(user) {
  currentFirebaseUser = user;

  if (user) {
    console.log('✅ Connecté:', user.email);
    updateAuthUI(true, user);
    startFirebaseSync();
  } else {
    console.log('ℹ️ Non connecté — mode local');
    updateAuthUI(false);
    stopFirebaseSync();
    updateSyncStatus('offline', 'Non connecté');
  }
}

async function loginWithGoogle() {
  if (!firebaseAuth) {
    alert('Firebase n\'est pas configuré. Consulte le guide de configuration.');
    return;
  }

  try {
    updateSyncStatus('syncing', 'Connexion...');
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebaseAuth.signInWithPopup(provider);
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      updateSyncStatus('offline', 'Connexion annulée');
    } else if (error.code === 'auth/popup-blocked') {
      alert('Le popup de connexion a été bloqué. Autorise les popups pour ce site.');
      updateSyncStatus('error', 'Popup bloqué');
    } else {
      console.error('❌ Erreur connexion:', error);
      alert('Erreur de connexion : ' + error.message);
      updateSyncStatus('error', 'Erreur connexion');
    }
  }
}

async function logoutFirebase() {
  if (!firebaseAuth) return;

  try {
    stopFirebaseSync();
    await firebaseAuth.signOut();
    updateSyncStatus('offline', 'Déconnecté');
  } catch (error) {
    console.error('❌ Erreur déconnexion:', error);
  }
}

// ============================================
// SYNCHRONISATION
// ============================================

function startFirebaseSync() {
  if (!currentFirebaseUser) return;

  updateSyncStatus('syncing', 'Synchronisation...');

  const userRef = firebaseDb.ref('users/' + currentFirebaseUser.uid);

  userRef.once('value').then(snapshot => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const localTimestamp = parseInt(localStorage.getItem('lastModified') || '0');
      const remoteTimestamp = data.lastModified || 0;

      if (remoteTimestamp > localTimestamp) {
        console.log('🔄 Chargement depuis Firebase (plus récent)');
        applyFirebaseData(data);
      } else if (localTimestamp > remoteTimestamp) {
        console.log('🔄 Envoi vers Firebase (local plus récent)');
        pushToFirebase();
      } else {
        console.log('✅ Données synchronisées');
        updateSyncStatus('synced', 'Synchronisé');
      }
    } else {
      console.log('📤 Première synchronisation — envoi des données locales');
      pushToFirebase();
    }

    listenToFirebase();

  }).catch(error => {
    console.error('❌ Erreur lecture Firebase:', error);
    updateSyncStatus('error', 'Erreur lecture');
  });
}

function applyFirebaseData(data) {
  isSyncingFromFirebase = true;

  try {
    if (data.transactions && Array.isArray(data.transactions)) {
      state.transactions = data.transactions;
      localStorage.setItem('transactions', JSON.stringify(state.transactions));
    }

    if (data.budgets && typeof data.budgets === 'object') {
      state.budgets = data.budgets;
      localStorage.setItem('budgets', JSON.stringify(state.budgets));
    }

    if (data.categories && typeof data.categories === 'object') {
      CATEGORIES = data.categories;
      localStorage.setItem('customCategories', JSON.stringify(CATEGORIES));
    }

    if (data.epargneBase && typeof data.epargneBase === 'object') {
      state.epargneBase = data.epargneBase;
    }

    if (data.lastModified) {
      localStorage.setItem('lastModified', data.lastModified.toString());
    }

    updateDisplay();
    updateSyncStatus('synced', 'Synchronisé');

  } catch (error) {
    console.error('❌ Erreur application données Firebase:', error);
    updateSyncStatus('error', 'Erreur sync');
  }

  isSyncingFromFirebase = false;
}

function listenToFirebase() {
  if (!currentFirebaseUser || firebaseListener) return;

  const userRef = firebaseDb.ref('users/' + currentFirebaseUser.uid);

  let isFirstEvent = true;

  firebaseListener = userRef.on('value', (snapshot) => {
    if (isSyncingFromFirebase || isFirstEvent) {
      isFirstEvent = false;
      return;
    }

    const data = snapshot.val();
    if (!data || !data.lastModified) return;

    const localTimestamp = parseInt(localStorage.getItem('lastModified') || '0');
    if (data.lastModified <= localTimestamp) return;

    console.log('🔄 Mise à jour reçue depuis un autre appareil');
    applyFirebaseData(data);

  }, (error) => {
    console.error('❌ Erreur listener Firebase:', error);
    updateSyncStatus('error', 'Erreur écoute');
  });
}

function stopFirebaseSync() {
  if (firebaseListener && currentFirebaseUser) {
    firebaseDb.ref('users/' + currentFirebaseUser.uid).off('value', firebaseListener);
    firebaseListener = null;
  }
}

/**
 * Nettoie récursivement les données pour Firebase :
 * - Remplace undefined par null
 * - Convertit les tableaux creux (sparse arrays) en tableaux denses
 * - Supprime les clés avec valeur undefined dans les objets
 */
function deepCleanForFirebase(data) {
  if (data === undefined) return null;
  if (data === null || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    // Convertir en tableau dense : chaque index doit avoir une valeur
    const cleaned = [];
    for (let i = 0; i < data.length; i++) {
      cleaned[i] = deepCleanForFirebase(data[i] !== undefined ? data[i] : null);
    }
    return cleaned;
  }

  // Objet : nettoyer chaque propriété
  const cleaned = {};
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val !== undefined) {
      cleaned[key] = deepCleanForFirebase(val);
    }
  }
  return cleaned;
}

function pushToFirebase() {
  if (!currentFirebaseUser || isSyncingFromFirebase) return;

  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);

  updateSyncStatus('syncing', 'Envoi...');

  syncDebounceTimer = setTimeout(() => {
    const timestamp = Date.now();
    const userRef = firebaseDb.ref('users/' + currentFirebaseUser.uid);

    // Nettoyage profond pour éliminer les undefined que Firebase refuse
    const cleanData = deepCleanForFirebase({
      transactions: state.transactions || [],
      budgets: state.budgets || {},
      categories: CATEGORIES || {},
      epargneBase: state.epargneBase || {},
      lastModified: timestamp,
      lastDevice: navigator.userAgent.substring(0, 100)
    });

    console.log('📤 Envoi vers Firebase...', Object.keys(cleanData));

    userRef.set(cleanData).then(() => {
      localStorage.setItem('lastModified', timestamp.toString());
      updateSyncStatus('synced', 'Synchronisé');
      console.log('✅ Données envoyées vers Firebase');
    }).catch(error => {
      console.error('❌ Erreur envoi Firebase:', error);
      updateSyncStatus('error', 'Erreur envoi');
    });
  }, 500);
}

// ============================================
// INTERFACE UTILISATEUR
// ============================================

function updateAuthUI(isLoggedIn, user) {
  const authBtn = document.getElementById('sync-auth-btn');
  if (!authBtn) return;

  if (isLoggedIn && user) {
    const shortName = user.displayName
      ? user.displayName.split(' ')[0]
      : user.email.split('@')[0];

    authBtn.innerHTML = `
      <span class="sync-dot" id="sync-indicator" title="Synchronisé"></span>
      <span class="sync-user-name">${shortName}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
      </svg>`;
    authBtn.onclick = logoutFirebase;
    authBtn.classList.add('logged-in');
    authBtn.title = `Connecté : ${user.email} — Cliquer pour se déconnecter`;
  } else {
    authBtn.innerHTML = `
      <span class="sync-dot sync-offline" id="sync-indicator" title="Non connecté"></span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
      </svg>
      Sync`;
    authBtn.onclick = loginWithGoogle;
    authBtn.classList.remove('logged-in');
    authBtn.title = 'Se connecter avec Google pour synchroniser';
  }
}

function updateSyncStatus(status, text) {
  const indicator = document.getElementById('sync-indicator');
  if (!indicator) return;

  indicator.classList.remove('sync-synced', 'sync-syncing', 'sync-error', 'sync-offline');
  indicator.classList.add('sync-' + status);
  indicator.title = text;
}
