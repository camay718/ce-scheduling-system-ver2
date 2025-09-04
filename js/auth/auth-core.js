/*
🔒 認証システムコア - V2専用（安全初期化版）
*/

// V1認証情報
const AUTH_CREDENTIALS = {
    'スタッフ': { type: 'name', role: 'viewer', department: null },
    '手術・麻酔': { code: 'secure_SurgAnest_6917_ce_system', role: 'editor', department: '手術・麻酔' },
    'MEセンター': { code: 'secure_MEcenter_6994_ce_system', role: 'editor', department: '機器管理・人工呼吸' },
    '血液浄化': { code: 'secure_Hemodialysis_6735_ce_system', role: 'editor', department: '血液浄化' },
    '不整脈': { code: 'secure_Arrhythm_6551_ce_system', role: 'editor', department: '不整脈' },
    '人工心肺・補助循環': { code: 'secure_CpbEcmo_6288_ce_system', role: 'editor', department: '人工心肺・補助循環' },
    '心・カテーテル': { code: 'secure_CardCath_6925_ce_system', role: 'editor', department: '心・カテーテル' },
    'モニター': { code: 'secure_CEmonitor_1122_ce_system', role: 'monitor', department: null },
    '管理者': { code: 'secure_CEadmin_5711_ce_system', role: 'admin', department: null }
};

// 認証システムクラス
class AuthSystemV2 {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.userRole = null;
        this.userDepartment = null;
        this.isReady = false;
        
        console.log('🔐 認証システムV2 初期化中...');
        
        // Firebase準備完了を待ってから初期化
        this.waitForFirebaseAndInitialize();
    }

    async waitForFirebaseAndInitialize() {
        // Firebase初期化完了まで待機（最大30秒）
        let attempts = 0;
        const maxAttempts = 300; // 30秒 (100ms × 300回)
        
        while (attempts < maxAttempts) {
            if (window.isFirebaseReady && window.auth) {
                console.log('✅ Firebase準備完了、認証システム初期化開始');
                this.initialize();
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
            
            if (attempts % 50 === 0) { // 5秒ごとにログ出力
                console.log('⏳ Firebase準備待ち...', attempts / 10, '秒経過');
            }
        }
        
        // タイムアウト時はV1システムで継続
        console.warn('⚠️ Firebase初期化タイムアウト - V1システムで継続');
        this.showLoginInterface();
        this.isReady = true;
    }

    initialize() {
        try {
            if (window.auth) {
                window.auth.onAuthStateChanged(async (user) => {
                    if (user) {
                        console.log('✅ Firebase認証ユーザー検出:', user.email);
                        this.currentUser = user.email;
                        await this.loadUserProfile(user.uid);
                        this.showMainInterface();
                    } else {
                        console.log('ℹ️ Firebase認証なし - V1認証システム使用');
                        this.showLoginInterface();
                    }
                    this.isReady = true;
                });
            } else {
                console.log('⚠️ Firebase Auth未準備 - V1認証システムで継続');
                this.showLoginInterface();
                this.isReady = true;
            }
        } catch (error) {
            console.error('❌ 認証システム初期化エラー:', error);
            this.showLoginInterface();
            this.isReady = true;
        }
    }

    // V1互換関数
    handleUserIdChange() {
        const userId = document.getElementById('userId');
        const nameDiv = document.getElementById('nameInputDiv');
        const secDiv = document.getElementById('securityCodeDiv');
        
        if (!userId || !nameDiv || !secDiv) return;
        
        const selectedValue = userId.value;
        
        if (selectedValue === 'スタッフ') {
            nameDiv.style.display = 'block';
            secDiv.style.display = 'none';
        } else if (selectedValue && selectedValue !== '') {
            nameDiv.style.display = 'none';
            secDiv.style.display = 'block';
        } else {
            nameDiv.style.display = 'none';
            secDiv.style.display = 'none';
        }
    }

    handleLogin() {
        const userId = document.getElementById('userId').value;
        const nameInput = document.getElementById('nameInput').value.trim();
        const securityInput = document.getElementById('securityInput').value;

        if (!userId) {
            this.showMessage('ユーザーを選択してください', 'warning');
            return;
        }

        const credential = AUTH_CREDENTIALS[userId];
        if (!credential) {
            this.showMessage('無効なユーザーです', 'error');
            return;
        }

        let isValid = false;
        let displayName = userId;
        
        if (credential.type === 'name') {
            if (!nameInput) {
                this.showMessage('お名前を入力してください', 'warning');
                return;
            }
            isValid = true;
            displayName = nameInput;
        } else {
            if (!securityInput) {
                this.showMessage('セキュリティコードを入力してください', 'warning');
                return;
            }
            isValid = securityInput === credential.code;
        }

        if (isValid) {
            this.userRole = credential.role;
            this.currentUser = displayName;
            this.userDepartment = credential.department;
            
            const loginExpiry = Date.now() + (24 * 60 * 60 * 1000);
            localStorage.setItem('ceSystemLoggedInUser', JSON.stringify({
                id: this.currentUser,
                role: this.userRole,
                department: this.userDepartment,
                loginTime: new Date().toISOString()
            }));
            localStorage.setItem('ceSystemLoginExpiry', loginExpiry.toString());
            
            this.showMainInterface();
            this.showMessage(`${userId}としてログインしました`, 'success');
        } else {
            this.showMessage('認証に失敗しました', 'error');
        }
    }

    handleLogout() {
        if (confirm('ログアウトしますか？')) {
            this.currentUser = null;
            this.userRole = null;
            this.userDepartment = null;
            
            localStorage.removeItem('ceSystemLoggedInUser');
            localStorage.removeItem('ceSystemLoginExpiry');
            
            this.showLoginInterface();
            this.showMessage('ログアウトしました', 'info');
        }
    }

    restoreLoginState() {
        try {
            const savedUser = localStorage.getItem('ceSystemLoggedInUser');
            const loginExpiry = localStorage.getItem('ceSystemLoginExpiry');
            
            if (savedUser && loginExpiry) {
                const currentTime = Date.now();
                const expiryTime = parseInt(loginExpiry);
                
                if (currentTime < expiryTime) {
                    const parsedUser = JSON.parse(savedUser);
                    this.currentUser = parsedUser.id;
                    this.userRole = parsedUser.role;
                    this.userDepartment = parsedUser.department;
                    this.showMainInterface();
                    this.showMessage(`お疲れ様です、${this.currentUser}さん！`, 'info');
                    return true;
                } else {
                    localStorage.removeItem('ceSystemLoggedInUser');
                    localStorage.removeItem('ceSystemLoginExpiry');
                }
            }
            return false;
        } catch (error) {
            console.error('❌ ログイン状態復元エラー:', error);
            return false;
        }
    }

    showLoginInterface() {
        const loginScreen = document.getElementById('loginScreen');
        const mainInterface = document.getElementById('mainInterface');
        
        if (loginScreen) loginScreen.style.display = 'flex';
        if (mainInterface) mainInterface.style.display = 'none';
        
        console.log('🔓 ログイン画面を表示');
    }

    showMainInterface() {
        const loginScreen = document.getElementById('loginScreen');
        const mainInterface = document.getElementById('mainInterface');
        
        if (loginScreen) loginScreen.style.display = 'none';
        if (mainInterface) mainInterface.style.display = 'flex';
        
        const userDisplay = document.getElementById('currentUserDisplay');
        if (userDisplay && this.currentUser) {
            userDisplay.textContent = this.currentUser;
        }
        
        console.log('✅ メイン画面を表示');
    }

    showMessage(text, type = 'info') {
        const container = document.getElementById('messageContainer');
        if (!container) {
            console.log(`[${type.toUpperCase()}] ${text}`);
            return;
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        const icons = { success: 'check', error: 'times', warning: 'exclamation', info: 'info' };
        messageDiv.innerHTML = `<i class="fas fa-${icons[type]}-circle"></i>${text}`;
        container.appendChild(messageDiv);
        setTimeout(() => messageDiv.remove(), 4000);
    }

async loadUserProfile(uid) {
    if (!window.database) {
        console.log('ℹ️ Database未準備 - プロファイル読み込みスキップ');
        return null;
    }
    
    try {
        console.log('📋 ユーザープロファイル読み込み開始:', uid);
        
        const snapshot = await window.database.ref(`${window.DATA_ROOT}/users/${uid}`).once('value');
        
        if (snapshot.exists()) {
            this.userProfile = snapshot.val();
            console.log('✅ ユーザープロファイル読み込み完了');
        } else {
            console.log('ℹ️ ユーザープロファイル未存在 - 新規作成');
            await this.createDefaultProfile(uid);
        }
        
        return this.userProfile;
        
    } catch (error) {
        console.warn('⚠️ プロファイル読み込み失敗 - V1システムで継続:', error.message);
        
        // エラー時でもシステムは継続動作
        this.userProfile = null;
        return null;
    }
}

// グローバルインスタンス作成（重複防止版）
(function() {
    // 重複作成防止
    if (window.authSystem) {
        console.log('ℹ️ 認証システム既に初期化済み');
        return;
    }
    
    try {
        window.authSystem = new AuthSystemV2();
        console.log('✅ 認証システムインスタンス作成完了');
        
        // グローバル関数として安全に公開
        window.handleUserIdChange = function() {
            try {
                return window.authSystem.handleUserIdChange();
            } catch (error) {
                console.error('handleUserIdChange エラー:', error);
            }
        };
        
        window.handleLogin = function() {
            try {
                return window.authSystem.handleLogin();
            } catch (error) {
                console.error('handleLogin エラー:', error);
            }
        };
        
        window.handleLogout = function() {
            try {
                return window.authSystem.handleLogout();
            } catch (error) {
                console.error('handleLogout エラー:', error);
            }
        };
        
        console.log('✅ グローバル関数設定完了');
        
    } catch (error) {
        console.error('❌ 認証システム作成エラー:', error);
        window.authSystem = null;
    }
})();

console.log('🔒 認証システムコア読み込み完了');
