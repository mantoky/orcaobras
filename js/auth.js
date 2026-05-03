/**
 * OrçaObras - Authentication Module
 * ==================================
 * Handles user authentication and session management
 */

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.init();
    }

    init() {
        // Check for existing session
        const storedAuth = localStorage.getItem(Config.STORAGE_KEYS.AUTH);
        if (storedAuth) {
            try {
                const authData = JSON.parse(storedAuth);
                if (authData.user && authData.token) {
                    this.currentUser = authData.user;
                    this.isAuthenticated = true;
                }
            } catch (e) {
                console.error('Error parsing auth data:', e);
                this.logout();
            }
        }

        // Initialize users in storage if not exists
        this.initUsers();
    }

    initUsers() {
        const storedUsers = localStorage.getItem(Config.STORAGE_KEYS.USERS);
        if (!storedUsers) {
            localStorage.setItem(Config.STORAGE_KEYS.USERS, JSON.stringify(Config.DEFAULT_USERS));
        }
    }

    login(username, password) {
        return new Promise(async (resolve, reject) => {
            try {
                const { FirebaseService } = window;
                if (FirebaseService) {
                    await FirebaseService.init();
                    try {
                        const firebaseUser = await FirebaseService.loginWithEmail(username, password);
                        const token = this.generateToken();
                        this.currentUser = {
                            id: firebaseUser.uid,
                            username: firebaseUser.email,
                            name: firebaseUser.displayName || username,
                            role: 'ORÇAMENTISTA'
                        };
                        this.isAuthenticated = true;
                        localStorage.setItem(Config.STORAGE_KEYS.AUTH, JSON.stringify({
                            user: this.currentUser,
                            token: token,
                            loginTime: new Date().toISOString(),
                            firebase: true
                        }));
                        resolve(this.currentUser);
                        return;
                    } catch (fbError) {
                        if (fbError.code !== 'auth/user-not-found' && fbError.code !== 'auth/wrong-password') {
                            console.warn('Firebase login failed, trying local:', fbError.message);
                        }
                    }
                }
            } catch (initError) {
                console.warn('Firebase not available, using local auth');
            }

            // Fallback to local storage authentication
            const users = this.getUsers();
            const user = users.find(u =>
                u.username.toLowerCase() === username.toLowerCase() &&
                u.password === password
            );

            if (user) {
                const token = this.generateToken();
                this.currentUser = {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    role: user.role
                };
                this.isAuthenticated = true;

                localStorage.setItem(Config.STORAGE_KEYS.AUTH, JSON.stringify({
                    user: this.currentUser,
                    token: token,
                    loginTime: new Date().toISOString()
                }));

                resolve(this.currentUser);
            } else {
                reject(new Error('Usuário ou senha incorretos'));
            }
        });
    }

    logout() {
        this.currentUser = null;
        this.isAuthenticated = false;
        localStorage.removeItem(Config.STORAGE_KEYS.AUTH);
        
        const { FirebaseService } = window;
        if (FirebaseService) {
            FirebaseService.logoutFirebase().catch(() => {});
        }
    }

    isMaster() {
        return this.currentUser && this.currentUser.role === 'MASTER';
    }

    isOrcamentista() {
        return this.currentUser && this.currentUser.role === 'ORÇAMENTISTA';
    }

    canEditDatabase() {
        return this.isMaster();
    }

    getUsers() {
        try {
            return JSON.parse(localStorage.getItem(Config.STORAGE_KEYS.USERS)) || [];
        } catch (e) {
            return [];
        }
    }

    addUser(username, password, role, name) {
        return new Promise((resolve, reject) => {
            if (!this.isMaster()) {
                reject(new Error('Apenas usuários MASTER podem adicionar novos usuários'));
                return;
            }

            const users = this.getUsers();

            // Check if username already exists
            if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
                reject(new Error('Nome de usuário já existe'));
                return;
            }

            const newUser = {
                id: Date.now(),
                username: username,
                password: password,
                role: role,
                name: name || username,
                createdAt: new Date().toISOString()
            };

            users.push(newUser);
            localStorage.setItem(Config.STORAGE_KEYS.USERS, JSON.stringify(users));
            resolve(newUser);
        });
    }

    removeUser(userId) {
        return new Promise((resolve, reject) => {
            if (!this.isMaster()) {
                reject(new Error('Apenas usuários MASTER podem remover usuários'));
                return;
            }

            // Prevent removing yourself
            if (this.currentUser.id === userId) {
                reject(new Error('Você não pode remover seu próprio usuário'));
                return;
            }

            let users = this.getUsers();
            users = users.filter(u => u.id !== userId);
            localStorage.setItem(Config.STORAGE_KEYS.USERS, JSON.stringify(users));
            resolve();
        });
    }

    generateToken() {
        return 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

// Create global instance
const Auth = new AuthManager();