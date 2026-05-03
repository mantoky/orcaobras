/**
 * OrçaObras - Firebase Integration
 * ================================
 * Firebase initialization and Firestore/Auth helpers
 */

let db = null;
let auth = null;
let firebaseInitialized = false;

async function initFirebase() {
    if (firebaseInitialized) return { db, auth };

    try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js');
        const { getFirestore, enableIndexedDbPersistence } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
        const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');

        const app = initializeApp(Config.FIREBASE);
        db = getFirestore(app);
        auth = getAuth(app);

        await enableIndexedDbPersistence(db).catch(err => {
            if (err.code === 'failed-precondition') {
                console.warn('Firestore persistence: multiple tabs open');
            } else if (err.code === 'unimplemented') {
                console.warn('Firestore persistence: not supported in this browser');
            }
        });

        firebaseInitialized = true;
        console.log('Firebase initialized successfully');
        return { db, auth };
    } catch (error) {
        console.error('Firebase initialization failed:', error);
        throw error;
    }
}

async function isFirebaseReady() {
    if (!firebaseInitialized) {
        await initFirebase();
    }
    return { db, auth };
}

const FirebaseService = {
    async init() {
        return await initFirebase();
    },

    async getUserBudgets(userId) {
        const { db } = await isFirebaseReady();
        const { getDocs, query, collection, where, orderBy } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
        
        const q = query(
            collection(db, 'budgets'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async saveBudget(budget) {
        const { db } = await isFirebaseReady();
        const { doc, setDoc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
        
        const budgetData = {
            ...budget,
            createdAt: budget.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (budget.id) {
            const docRef = doc(db, 'budgets', budget.id);
            await updateDoc(docRef, budgetData);
            return budget.id;
        } else {
            const docRef = doc(collection(db, 'budgets'));
            await setDoc(docRef, budgetData);
            return docRef.id;
        }
    },

    async deleteBudget(budgetId) {
        const { db } = await isFirebaseReady();
        const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
        await deleteDoc(doc(db, 'budgets', budgetId));
    },

    async getDatabase() {
        const { db } = await isFirebaseReady();
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
        
        const docRef = doc(db, 'database', 'items');
        const snapshot = await getDoc(docRef);
        
        if (snapshot.exists()) {
            return snapshot.data().items || [];
        }
        return [];
    },

    async saveDatabase(items) {
        const { db } = await isFirebaseReady();
        const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
        await setDoc(doc(db, 'database', 'items'), { items, updatedAt: new Date().toISOString() });
    },

    async loginWithEmail(email, password) {
        const { auth } = await isFirebaseReady();
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');
        const result = await signInWithEmailAndPassword(auth, email, password);
        return result.user;
    },

    async registerUser(email, password, name) {
        const { auth } = await isFirebaseReady();
        const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');
        
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
        return result.user;
    },

    async logoutFirebase() {
        const { auth } = await isFirebaseReady();
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');
        await signOut(auth);
    },

    onAuthChange(callback) {
        if (!auth) {
            initFirebase().then(() => this.onAuthChange(callback));
            return;
        }
        const { onAuthStateChanged } = window.firebaseAuth || {};
        if (onAuthStateChanged) {
            onAuthStateChanged(auth, callback);
        }
    }
};

window.FirebaseService = FirebaseService;