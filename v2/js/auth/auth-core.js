// V2認証システムコア（パスワード認証対応版）
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
        
        // Firebase準備待機
        await this.waitForFirebase();
        
        // Firebase初期化確認
        this.auth = firebase.auth();
        this.database = firebase.database();
        
        // 認証状態リスナー設定
        this.auth.onAuthStateChanged((user) => {
            this.handleAuthStateChange(user);
        });
        
        this.isInitialized = true;
        console.log('✅ 認証システムインスタンス作成完了');
    }

    async waitForFirebase() {
        let attempts = 0;
        const maxAttempts = 50;
        
        while (attempts < maxAttempts) {
            if (typeof firebase !== 'undefined' && firebase.auth && firebase.database) {
                console.log('✅ Firebase準備完了、認証システム初期化開始');
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        throw new Error('Firebase初期化タイムアウト');
    }

    async handleAuthStateChange(user) {
        if (user) {
            console.log('🔐 認証ユーザー:', user.uid);
            this.currentUser = user;
            
            if (!user.isAnonymous) {
                // 通常認証ユーザー
                await this.handleAuthenticatedUser(user);
            } else {
                // 匿名ユーザー
                console.log('ℹ️ 匿名/未認証ユーザー - ログイン画面表示');
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
            // セッションからターゲットUID取得
            const targetUID = sessionStorage.getItem('targetUID');
            const uid = targetUID || user.uid;
            
            // ユーザーデータ取得
            const userSnapshot = await this.database.ref(`ceScheduleV2/users/${uid}`).once('value');
            
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                console.log('✅ ユーザーデータ取得:', userData);
                
                // メイン画面へ
                this.showMainScreen(userData);
            } else {
                console.log('⚠️ ユーザーデータが見つかりません');
                this.handleMissingUserData(user);
            }
        } catch (error) {
            console.error('❌ 認証ユーザー処理エラー:', error);
        }
    }

    handleMissingUserData(user) {
        console.log('🔧 ユーザーデータ作成が必要');
        this.showLoginScreen();
    }

    showLoginScreen() {
        console.log('🔓 ログイン画面を表示');
        const loginSection = document.getElementById('loginSection');
        const mainSection = document.getElementById('mainSection');
        
        if (loginSection) {
            loginSection.style.display = 'block';
        }
        if (mainSection) {
            mainSection.style.display = 'none';
        }
    }

    showMainScreen(userData) {
        console.log('🏠 メイン画面を表示');
        
        const loginSection = document.getElementById('loginSection');
        const mainSection = document.getElementById('mainSection');
        
        if (loginSection) {
            loginSection.style.display = 'none';
        }
        if (mainSection) {
            mainSection.style.display = 'block';
        }
        
        this.updateUserDisplay(userData);
    }

    updateUserDisplay(userData) {
        // ユーザー名表示
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = userData.displayName || userData.username || 'ユーザー';
        }
    }

    // パスワード認証ログイン処理
async handleUsernamePasswordLogin(username, password) {
    try {
        console.log('🔐 ユーザー名・パスワードログイン開始:', username);
        
        // 1. ユーザー名からUID取得
        const usernameSnapshot = await this.database.ref(`ceScheduleV2/usernames/${username}`).once('value');
        const uid = usernameSnapshot.val();
        
        if (!uid) {
            throw new Error('ユーザー名が見つかりません');
        }
        
        console.log('✅ UID取得成功:', uid);
        
        // 2. ユーザーデータ取得・パスワード確認
        const userSnapshot = await this.database.ref(`ceScheduleV2/users/${uid}`).once('value');
        const userData = userSnapshot.val();
        
        if (!userData) {
            throw new Error('ユーザーデータが見つかりません');
        }
        
        // 🔍 デバッグ：実際のユーザーデータを表示
        console.log('🔍 デバッグ - 取得したユーザーデータ:', {
            username: userData.username,
            password: userData.password,
            setupCompleted: userData.setupCompleted,
            displayName: userData.displayName,
            role: userData.role
        });
        
        console.log('🔍 デバッグ - 入力されたパスワード:', password);
        console.log('🔍 デバッグ - データベース内パスワード:', userData.password);
        console.log('🔍 デバッグ - パスワード一致確認:', userData.password === password);
        
        // 3. パスワード確認
        if (!userData.password) {
            // パスワード未設定の場合は初回ログイン扱い
            console.log('⚠️ パスワード未設定 → 初回ログイン処理へ');
            return await this.handleInitialLogin(username);
        }
        
        if (userData.password !== password) {
            console.error('❌ パスワード不一致');
            console.error('期待値:', userData.password);
            console.error('入力値:', password);
            throw new Error('パスワードが正しくありません');
        }
        
        console.log('✅ パスワード認証成功');
        
        // 4. 匿名認証実行
        const authResult = await this.auth.signInAnonymously();
        console.log('✅ 匿名認証完了:', authResult.user.uid);
        
        // 5. セッションにUID保存
        sessionStorage.setItem('targetUID', uid);
        sessionStorage.setItem('currentUsername', username);
        
        // 6. 最終ログイン時刻更新
        await this.database.ref(`ceScheduleV2/users/${uid}`).update({
            lastLogin: firebase.database.ServerValue.TIMESTAMP
        });
        
        // 7. ダッシュボードに遷移
        console.log('✅ ログイン完了 → ダッシュボードへ');
        window.location.href = 'dashboard.html';
        
        return true;
        
    } catch (error) {
        console.error('❌ ログイン処理エラー:', error);
        alert('ログインに失敗しました: ' + error.message);
        return false;
    }
}

    // 初回ログイン処理（パスワード未設定ユーザー用）
    async handleInitialLogin(username) {
        try {
            console.log('🔐 初回ログイン処理開始:', username);
            
            // ユーザー名からUID取得
            const usernameSnapshot = await this.database.ref(`ceScheduleV2/usernames/${username}`).once('value');
            const uid = usernameSnapshot.val();
            
            if (!uid) {
                throw new Error('ユーザー名が見つかりません');
            }
            
            // ユーザーデータ取得
            const userSnapshot = await this.database.ref(`ceScheduleV2/users/${uid}`).once('value');
            const userData = userSnapshot.val();
            
            if (!userData) {
                throw new Error('ユーザーデータが見つかりません');
            }
            
            // パスワード未設定または個人設定未完了の場合
            if (!userData.password || !userData.setupCompleted) {
                console.log('⚠️ 個人設定が必要 → 設定画面へ');
                
                // 匿名認証
                await this.auth.signInAnonymously();
                
                // セッション保存
                sessionStorage.setItem('targetUID', uid);
                sessionStorage.setItem('currentUsername', username);
                
                // 個人設定画面表示
                this.showUserSetupScreen(userData);
                return true;
            } else {
                throw new Error('このユーザーは既に設定済みです。パスワードを入力してログインしてください。');
            }
            
        } catch (error) {
            console.error('❌ 初回ログイン処理エラー:', error);
            alert(error.message);
            return false;
        }
    }

    // 個人設定画面表示
    showUserSetupScreen(userData) {
        console.log('🔧 個人設定画面を表示');
        
        const loginSection = document.getElementById('loginSection');
        const userSetupSection = document.getElementById('userSetupSection');
        
        if (loginSection) {
            loginSection.style.display = 'none';
            loginSection.classList.add('hidden');
        }
        
        if (userSetupSection) {
            userSetupSection.style.display = 'block';
            userSetupSection.classList.remove('hidden');
            
            // 既存データがあれば表示
            if (userData) {
                const displayNameInput = document.getElementById('displayName');
                const emailInput = document.getElementById('email');
                
                if (displayNameInput) displayNameInput.value = userData.displayName || '';
                if (emailInput) emailInput.value = userData.email || '';
            }
            
            // 設定完了処理
            this.setupUserSetupForm();
        }
    }

    // ユーザー設定フォーム処理
    setupUserSetupForm() {
        const userSetupForm = document.getElementById('userSetupForm');
        
        if (userSetupForm && !userSetupForm.hasAttribute('data-setup')) {
            userSetupForm.setAttribute('data-setup', 'true');
            
            userSetupForm.addEventListener('submit', async (e) => {
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
            const password = document.getElementById('password').value.trim();
            
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
            
            console.log('💾 ユーザー設定保存開始');
            
            // ユーザーデータ更新
            const updateData = {
                displayName: displayName,
                email: email,
                password: password, // 実際の運用では暗号化が必要
                setupCompleted: true,
                lastLogin: firebase.database.ServerValue.TIMESTAMP,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            };
            
            await this.database.ref(`ceScheduleV2/users/${targetUID}`).update(updateData);
            console.log('✅ ユーザー設定保存完了');
            
            // ダッシュボードに遷移
            console.log('🚀 ダッシュボードに遷移');
            window.location.href = 'dashboard.html';
            
        } catch (error) {
            console.error('❌ 設定保存エラー:', error);
            alert('設定の保存に失敗しました: ' + error.message);
        }
    }

    // 管理者権限確認
    isAdmin() {
        const userRole = this.getUserRole();
        return userRole === 'admin';
    }

    // 現在のユーザー情報取得
    getCurrentUser() {
        return this.currentUser;
    }

    // ユーザー権限取得
    getUserRole() {
        // 実装：ユーザーデータから権限を取得
        return 'viewer'; // 仮実装
    }

    // ログアウト機能
    async logout() {
        try {
            await this.auth.signOut();
            sessionStorage.clear();
            console.log('✅ ログアウト完了');
        } catch (error) {
            console.error('❌ ログアウトエラー:', error);
        }
    }

    // 匿名ログイン（開発用）
    async signInAnonymously() {
        try {
            const result = await this.auth.signInAnonymously();
            console.log('✅ 匿名ログイン成功:', result.user.uid);
            return result.user;
        } catch (error) {
            console.error('❌ 匿名ログインエラー:', error);
            throw error;
        }
    }
}

// グローバル変数
let authSystem = null;

// システム初期化
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
        
        console.log('✅ グローバル関数設定完了');
        
    } catch (error) {
        console.error('❌ 認証システム初期化失敗:', error);
    }
});

// グローバル関数として公開
window.handleLogin = (username, password) => {
    if (window.authSystemInstance) {
        if (password) {
            // パスワード付きログイン
            return window.authSystemInstance.handleUsernamePasswordLogin(username, password);
        } else {
            // 初回ログイン（パスワード未設定）
            return window.authSystemInstance.handleInitialLogin(username);
        }
    } else {
        console.error('❌ 認証システムインスタンスが見つかりません');
        return false;
    }
};
class UserSetupManager {
    static async getCurrentUserInfo() {
        try {
            const user = auth.currentUser;
            if (!user) return null;

            const targetUID = sessionStorage.getItem('targetUID') || user.uid;
            const userSnapshot = await database.ref(`ceScheduleV2/users/${targetUID}`).once('value');
            const userData = userSnapshot.val();
            
            if (userData) {
                window.userRole = userData.role || 'viewer';
                return userData;
            }
            return null;
        } catch (error) {
            console.error('ユーザー情報取得エラー:', error);
            return null;
        }
    }

    static async updateUserInfo(data) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('認証されていません');

            const targetUID = sessionStorage.getItem('targetUID') || user.uid;
            await database.ref(`ceScheduleV2/users/${targetUID}`).update({
                ...data,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
            return true;
        } catch (error) {
            console.error('ユーザー情報更新エラー:', error);
            return false;
        }
    }

    static async checkUserPermission() {
        const userInfo = await this.getCurrentUserInfo();
        return userInfo ? userInfo.role : 'viewer';
    }

    static hasPermission(requiredRole) {
        const roleHierarchy = { 'admin': 3, 'editor': 2, 'viewer': 1 };
        const userRoleLevel = roleHierarchy[window.userRole] || 1;
        const requiredRoleLevel = roleHierarchy[requiredRole] || 1;
        
        return userRoleLevel >= requiredRoleLevel;
    }
}

// グローバルに公開
window.UserSetupManager = UserSetupManager;

console.log('✅ UserSetupManager クラス追加完了');
console.log('🔒 認証システムコア読み込み完了（パスワード認証版）');

