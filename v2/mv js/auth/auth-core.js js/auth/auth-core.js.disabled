// V2認証システムコア（リダイレクトループ修正版）
class AuthSystemCore {
    constructor() {
        this.auth = null;
        this.database = null;
        this.currentUser = null;
        this.isInitialized = false;
        this.isProcessing = false; // 重複処理防止フラグ
        this.init();
    }

    async init() {
        if (this.isInitialized) {
            console.log('⚠️ 認証システム既に初期化済み');
            return;
        }

        console.log('🔐 認証システムV2 初期化中...');
        
        try {
            await this.waitForFirebase();
            this.auth = window.auth;
            this.database = window.database;
            
            // 認証状態リスナー設定（一度だけ）
            this.auth.onAuthStateChanged((user) => this.handleAuthStateChange(user));
            this.isInitialized = true;
            console.log('✅ 認証システム初期化完了');
            
        } catch (error) {
            console.error('❌ 認証システム初期化エラー:', error);
        }
    }

    async waitForFirebase() {
        let attempts = 0;
        while (attempts < 30) {
            if (window.auth && window.database) return;
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }
        throw new Error('Firebase初期化タイムアウト');
    }

    async handleAuthStateChange(user) {
        // 重複処理防止
        if (this.isProcessing) {
            console.log('🔄 認証処理中のため無視');
            return;
        }

        this.isProcessing = true;

        try {
            const currentPath = window.location.pathname;
            const targetUID = sessionStorage.getItem('targetUID');
            
            console.log('🔍 認証状態変更:', {
                hasUser: !!user,
                hasTargetUID: !!targetUID,
                currentPath: currentPath
            });

            if (user && targetUID) {
                // 認証済み + セッションあり
                if (currentPath.includes('index.html') || currentPath.endsWith('v2/') || currentPath.endsWith('/')) {
                    // index.html → dashboard.htmlへの遷移を遅延実行
                    console.log('✅ ログイン完了 → ダッシュボード遷移（遅延実行）');
                    setTimeout(() => {
                        if (!this.isProcessing) return; // 既に他の処理が実行された場合は無視
                        window.location.href = 'dashboard.html';
                    }, 1000); // 1秒遅延
                }
                // dashboard.htmlの場合は何もしない（dashboard側で処理）
            } else if (!targetUID) {
                // セッションなし → ログイン画面表示
                this.showLoginScreen();
            }
            // その他のケースは何もしない（状態が不安定な可能性があるため）
            
        } catch (error) {
            console.error('❌ 認証状態変更処理エラー:', error);
            this.showLoginScreen();
        } finally {
            // 処理完了後、少し遅延してフラグを解除
            setTimeout(() => {
                this.isProcessing = false;
            }, 2000);
        }
    }

    showLoginScreen() {
        const loading = document.getElementById('loading');
        const loginSection = document.getElementById('loginSection');
        const mainSection = document.getElementById('mainSection');
        const userSetupSection = document.getElementById('userSetupSection');
        
        if (loading) {
            loading.style.display = 'none';
            loading.classList.add('hidden');
        }
        
        if (mainSection) {
            mainSection.style.display = 'none';
            mainSection.classList.add('hidden');
        }
        
        if (userSetupSection) {
            userSetupSection.style.display = 'none';
            userSetupSection.classList.add('hidden');
        }
        
        if (loginSection) {
            loginSection.style.display = 'block';
            loginSection.classList.remove('hidden');
        }
    }

    // ログイン処理（既存のロジックを維持）
    async handleUsernamePasswordLogin(username, password) {
        if (this.isProcessing) {
            console.log('🔄 ログイン処理中のため無視');
            return false;
        }

        this.isProcessing = true;

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

            // セッション設定
            sessionStorage.setItem('targetUID', uid);
            sessionStorage.setItem('currentUsername', username);
            
            await this.database.ref(`${window.DATA_ROOT}/users/${uid}`).update({
                lastLogin: firebase.database.ServerValue.TIMESTAMP
            });

            console.log('✅ ログイン成功 → ダッシュボード遷移');
            // 遷移を遅延実行（認証状態の安定化を待つ）
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);
            
            return true;
            
        } catch (error) {
            console.error('❌ ログイン失敗:', error);
            alert('ログインに失敗しました: ' + error.message);
            return false;
        } finally {
            setTimeout(() => {
                this.isProcessing = false;
            }, 1000);
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

    // 個人設定画面表示
    showUserSetupScreen(userData) {
        const loginSection = document.getElementById('loginSection');
        const userSetupSection = document.getElementById('userSetupSection');
        const loading = document.getElementById('loading');
        
        if (loading) {
            loading.style.display = 'none';
            loading.classList.add('hidden');
        }
        
        if (loginSection) {
            loginSection.style.display = 'none';
            loginSection.classList.add('hidden');
        }
        
        if (userSetupSection) {
            userSetupSection.style.display = 'block';
            userSetupSection.classList.remove('hidden');
            
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

    // ユーザー設定完了処理
    async handleUserSetupComplete() {
        try {
            const displayName = document.getElementById('displayName').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('setupPassword').value.trim();

            if (!displayName || !password) {
                alert('表示名とパスワードを入力してください');
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
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);
            
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
            sessionStorage.clear();
            window.location.href = 'index.html';
            console.log('✅ ログアウト完了');
        } catch (error) {
            console.error('❌ ログアウトエラー:', error);
        }
    }
}

// グローバル変数（重複防止）
if (!window.authSystemInitialized) {
    window.authSystemInitialized = true;
    let authSystem = null;

    document.addEventListener('DOMContentLoaded', async () => {
        try {
            authSystem = new AuthSystemCore();
            
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
}

console.log('🔒 認証システムコア読み込み完了（リダイレクトループ修正版）');
