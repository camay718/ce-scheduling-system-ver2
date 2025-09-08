// V2認証システムコア（修正版）
class AuthSystemCore {
    constructor() {
        this.auth = null;
        this.database = null;
        this.currentUser = null;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        console.log('🔐 認証システムV2 初期化中...');
        await this.waitForFirebase();
        
        this.auth = window.auth;
        this.database = window.database;
        
        this.auth.onAuthStateChanged((user) => this.handleAuthStateChange(user));
        this.isInitialized = true;
        console.log('✅ 認証システム初期化完了');
    }

    async waitForFirebase() {
        let attempts = 0;
        while (attempts < 50) {
            if (window.auth && window.database) return;
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }
        throw new Error('Firebase初期化タイムアウト');
    }

    async handleAuthStateChange(user) {
        if (user) {
            console.log('🔐 認証ユーザー:', user.uid);
            this.currentUser = user;

            const targetUID = sessionStorage.getItem('targetUID');
            if (targetUID || !user.isAnonymous) {
                await this.handleAuthenticatedUser(user);
            } else {
                this.showLoginScreen();
            }
        } else {
            console.log('🔓 未認証状態');
            this.currentUser = null;
            this.showLoginScreen();
        }
    }

    async handleAuthenticatedUser(user) {
        try {
            const targetUID = sessionStorage.getItem('targetUID');
            const uid = targetUID || user.uid;
            
            const userSnapshot = await this.database.ref(`${window.DATA_ROOT}/users/${uid}`).once('value');
            
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                window.userRole = userData.role || 'viewer';
                
                if (userData.setupCompleted) {
                    const path = window.location.pathname;
                    if (path.includes('index.html') || path.endsWith('v2/') || path.endsWith('/')) {
                        console.log('🚀 ダッシュボード遷移実行');
                        window.location.href = 'dashboard.html';
                    }
                } else {
                    console.log('⚠️ 個人設定未完了 → 設定画面表示');
                    this.showUserSetupScreen(userData);
                }
            } else {
                console.log('⚠️ ユーザーデータが見つかりません');
                this.showLoginScreen();
            }
        } catch (error) {
            console.error('❌ 認証ユーザー処理エラー:', error);
            this.showLoginScreen();
        }
    }

    showLoginScreen() {
        const login = document.getElementById('loginSection');
        const main = document.getElementById('mainSection');
        const setup = document.getElementById('userSetupSection');
        
        if (setup) setup.style.display = 'none';
        if (main) main.style.display = 'none';
        if (login) login.style.display = 'block';
    }

    showUserSetupScreen(userData) {
        const login = document.getElementById('loginSection');
        const setup = document.getElementById('userSetupSection');
        
        if (login) {
            login.style.display = 'none';
            login.classList.add('hidden');
        }
        
        if (setup) {
            setup.style.display = 'block';
            setup.classList.remove('hidden');
            
            // 既存データの表示
            const displayNameInput = document.getElementById('displayName');
            const emailInput = document.getElementById('email');
            
            if (displayNameInput) displayNameInput.value = userData?.displayName || '';
            if (emailInput) emailInput.value = userData?.email || '';
        }
        
        this.setupUserSetupForm();
    }

    setupUserSetupForm() {
        const form = document.getElementById('userSetupForm');
        if (form && !form.hasAttribute('data-setup')) {
            form.setAttribute('data-setup', 'true');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleUserSetupComplete();
            });
        }
    }

    // ユーザー名/パスワードログイン
    async handleUsernamePasswordLogin(username, password) {
        try {
            console.log('🔐 ログイン開始:', username);
            
            const nameSnapshot = await this.database.ref(`${window.DATA_ROOT}/usernames/${username}`).once('value');
            const uid = nameSnapshot.val();
            
            if (!uid) throw new Error('ユーザー名が見つかりません');

            const userSnapshot = await this.database.ref(`${window.DATA_ROOT}/users/${uid}`).once('value');
            const userData = userSnapshot.val();
            
            if (!userData) throw new Error('ユーザーデータが見つかりません');

            if (!userData.password) {
                return await this.handleInitialLogin(username);
            }
            
            if (userData.password !== password) {
                throw new Error('パスワードが正しくありません');
            }

            await this.auth.signInAnonymously();
            sessionStorage.setItem('targetUID', uid);
            sessionStorage.setItem('currentUsername', username);
            
            await this.database.ref(`${window.DATA_ROOT}/users/${uid}`).update({
                lastLogin: firebase.database.ServerValue.TIMESTAMP
            });

            console.log('🚀 ダッシュボード遷移');
            setTimeout(() => window.location.href = 'dashboard.html', 300);
            return true;
            
        } catch (error) {
            console.error('❌ ログイン失敗:', error);
            alert('ログインに失敗しました: ' + error.message);
            return false;
        }
    }

    // 初回ログイン処理
    async handleInitialLogin(username) {
        try {
            const nameSnapshot = await this.database.ref(`${window.DATA_ROOT}/usernames/${username}`).once('value');
            const uid = nameSnapshot.val();
            
            if (!uid) throw new Error('ユーザー名が見つかりません');

            const userSnapshot = await this.database.ref(`${window.DATA_ROOT}/users/${uid}`).once('value');
            const userData = userSnapshot.val();
            
            if (!userData) throw new Error('ユーザーデータが見つかりません');

            await this.auth.signInAnonymously();
            sessionStorage.setItem('targetUID', uid);
            sessionStorage.setItem('currentUsername', username);
            
            this.showUserSetupScreen(userData);
            return true;
            
        } catch (error) {
            console.error('❌ 初回ログイン処理エラー:', error);
            alert(error.message);
            return false;
        }
    }

    // ユーザー設定完了処理（ID修正版）
    async handleUserSetupComplete() {
        try {
            const displayName = document.getElementById('displayName').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('setupPassword').value.trim(); // ← 修正

            if (!displayName) {
                alert('表示名を入力してください');
                return;
            }
            
            if (!password) {
                alert('パスワードを設定してください');
                return;
            }

            const targetUID = sessionStorage.getItem('targetUID');
            if (!targetUID) {
                console.error('❌ ターゲットUIDが見つかりません');
                return;
            }

            await this.database.ref(`${window.DATA_ROOT}/users/${targetUID}`).update({
                displayName: displayName,
                email: email,
                password: password,
                setupCompleted: true,
                lastLogin: firebase.database.ServerValue.TIMESTAMP,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });

            console.log('✅ ユーザー設定保存完了 → ダッシュボード遷移');
            window.location.href = 'dashboard.html';
            
        } catch (error) {
            console.error('❌ 設定保存エラー:', error);
            alert('設定の保存に失敗しました: ' + error.message);
        }
    }

    // ユーティリティメソッド
    isAdmin() { return (window.userRole || 'viewer') === 'admin'; }
    getCurrentUser() { return this.currentUser; }
    getUserRole() { return window.userRole || 'viewer'; }

    async logout() {
        try {
            await this.auth.signOut();
            sessionStorage.clear();
            window.location.href = 'index.html';
            console.log('✅ ログアウト完了');
        } catch (error) {
            console.error('❌ ログアウトエラー:', error);
        }
    }
}

// グローバル変数
let authSystem = null;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        authSystem = new AuthSystemCore();
        
        // グローバル関数設定
        window.authSystem = authSystem;
        window.authSystemInstance = authSystem;
        window.logout = () => authSystem.logout();
        window.getCurrentUser = () => authSystem.getCurrentUser();
        window.getUserRole = () => authSystem.getUserRole();
        window.isAdmin = () => authSystem.isAdmin();
        
        console.log('✅ 認証システムグローバル関数設定完了');
        
    } catch (error) {
        console.error('❌ 認証システム初期化失敗:', error);
    }
});

// グローバルログイン関数
window.handleLogin = (username, password) => {
    if (window.authSystemInstance) {
        return password
            ? window.authSystemInstance.handleUsernamePasswordLogin(username, password)
            : window.authSystemInstance.handleInitialLogin(username);
    } else {
        console.error('❌ 認証システムインスタンスが見つかりません');
        return false;
    }
};

console.log('🔒 認証システムコア読み込み完了（修正版）');
