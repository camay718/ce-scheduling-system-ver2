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
        
        try {
            this.auth = firebase.auth();
            this.database = firebase.database();
            
            // 認証状態変更リスナー
            this.auth.onAuthStateChanged((user) => {
                this.handleAuthStateChange(user);
            });
            
            this.isInitialized = true;
            console.log('✅ 認証システムインスタンス作成完了');
            
        } catch (error) {
            console.error('❌ 認証システム初期化エラー:', error);
        }
    }

    async waitForFirebase() {
        let attempts = 0;
        while (attempts < 100 && (!window.firebase || !window.firebase.apps || window.firebase.apps.length === 0)) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
            console.log('✅ Firebase準備完了、認証システム初期化開始');
        } else {
            throw new Error('Firebase初期化タイムアウト');
        }
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
            // ユーザーデータ取得
            const userSnapshot = await this.database.ref(`ceScheduleV2/users/${user.uid}`).once('value');
            
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
        // ユーザーデータが存在しない場合の処理
        console.log('🔄 ユーザーデータ作成が必要');
        // 初期設定画面にリダイレクトするか、ログアウトする
        this.logout();
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
        console.log('🏠 メイン画面を表示:', userData);
        const loginSection = document.getElementById('loginSection');
        const mainSection = document.getElementById('mainSection');
        
        if (loginSection) {
            loginSection.style.display = 'none';
        }
        if (mainSection) {
            mainSection.style.display = 'block';
        }
        
        // ユーザー情報表示
        this.updateUserDisplay(userData);
    }

    updateUserDisplay(userData) {
        // ユーザー名表示
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = userData.displayName || userData.username || 'ユーザー';
        }
        
        // 部門表示
        const departmentElement = document.getElementById('userDepartment');
        if (departmentElement) {
            departmentElement.textContent = userData.department || '';
        }
    }

    // 🆕 isAdmin メソッドを追加
    isAdmin() {
        if (this.currentUser && this.currentUser.userData) {
            return this.currentUser.userData.role === 'admin';
        }
        return false;
    }

    // 🆕 現在のユーザー情報取得
    getCurrentUser() {
        return this.currentUser;
    }

    // 🆕 ユーザー権限取得
    getUserRole() {
        if (this.currentUser && this.currentUser.userData) {
            return this.currentUser.userData.role || 'viewer';
        }
        return 'viewer';
    }

    // 🆕 ログアウト機能
    async logout() {
        try {
            if (this.auth) {
                await this.auth.signOut();
                console.log('✅ ログアウト完了');
            }
        } catch (error) {
            console.error('❌ ログアウトエラー:', error);
        }
    }

    // 🆕 匿名ログイン（開発用）
    async signInAnonymously() {
        try {
            if (this.auth) {
                const result = await this.auth.signInAnonymously();
                console.log('✅ 匿名ログイン完了:', result.user.uid);
                return result.user;
            }
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
        window.authSystem = authSystem;
        
        // グローバル関数設定
        window.logout = () => authSystem.logout();
        window.getCurrentUser = () => authSystem.getCurrentUser();
        window.getUserRole = () => authSystem.getUserRole();
        window.isAdmin = () => authSystem.isAdmin();
        
        console.log('✅ グローバル関数設定完了');
        
    } catch (error) {
        console.error('❌ 認証システム初期化失敗:', error);
    }
});

console.log('🔒 認証システムコア読み込み完了（修正版）');
