/*
==========================================
🔒 認証システムコア - CRITICAL SECURITY FILE
このファイルはシステムセキュリティの根幹です

変更時の必須事項：
1. 完全バックアップの取得
2. テスト環境での動作確認
3. 段階的な実装とテスト
==========================================
*/

// V1認証情報（既存システムとの互換性のため保持）
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
        this.initialize();
    }

    async initialize() {
        // Firebase認証状態の監視
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    console.log('✅ Firebase認証ユーザー検出:', user.email);
                    this.currentUser = user.email;
                    await this.loadUserProfile(user.uid);
                    this.showMainInterface();
                } else {
                    console.log('ℹ️ Firebase認証なし - V1認証システム使用');
                    this.currentUser = null;
                    this.userProfile = null;
                    this.showLoginInterface();
                }
                this.isReady = true;
            });
        } else {
            // Firebase未準備の場合はV1システムを使用
            console.log('⚠️ Firebase未準備 - V1認証システムで継続');
            this.isReady = true;
        }
    }

    // V1互換ログイン処理
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

    // V1互換ログイン処理
    handleLogin() {
        const userId = document.getElementById('userId').value;
        const nameInput = document.getElementById('nameInput').value.trim();
        const securityInput = document.getElementById('securityInput').value;

        if (!userId) {
            this.showMessage('ユーザーを選択してください', 'error');
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
                this.showMessage('お名前を入力してください', 'error');
                return;
            }
            isValid = true;
            displayName = nameInput;
        } else {
            if (!securityInput) {
                this.showMessage('セキュリティコードを入力してください', 'error');
                return;
            }
            isValid = securityInput === credential.code;
        }

        if (isValid) {
            this.userRole = credential.role;
            this.currentUser = displayName;
            this.userDepartment = credential.department;
            
            // ログイン状態保存
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

    // ログアウト処理
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

    // ログイン状態復元
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

    // ユーザープロファイル読み込み（V2用）
    async loadUserProfile(uid) {
        if (!database) return null;
        
        try {
            const snapshot = await database.ref(`${DATA_ROOT}/users/${uid}`).once('value');
            this.userProfile = snapshot.val();
            
            if (!this.userProfile) {
                console.warn('⚠️ ユーザープロファイルが見つかりません');
                await this.createDefaultProfile(uid);
            }
            
            return this.userProfile;
        } catch (error) {
            console.error('❌ プロファイル読み込みエラー:', error);
            return null;
        }
    }

    // デフォルトプロファイル作成
    async createDefaultProfile(uid) {
        const defaultProfile = {
            displayName: this.currentUser || 'ユーザー',
            email: this.currentUser,
            department: '未設定',
            permissions: {
                canView: ['all'],
                canEdit: [],
                isAdmin: false
            },
            createdAt: new Date().toISOString()
        };

        try {
            await database.ref(`${DATA_ROOT}/users/${uid}`).set(defaultProfile);
            this.userProfile = defaultProfile;
            console.log('✅ デフォルトプロファイル作成完了');
        } catch (error) {
            console.error('❌ プロファイル作成エラー:', error);
        }
    }

    // インターフェース切り替え
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
        
        // ユーザー情報表示
        const userDisplay = document.getElementById('currentUserDisplay');
        if (userDisplay && this.currentUser) {
            userDisplay.textContent = this.currentUser;
        }
        
        console.log('✅ メイン画面を表示');
    }

    // メッセージ表示
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

    // 権限チェック
    hasPermission(permission) {
        switch (permission) {
            case 'admin':
                return this.userRole === 'admin';
            case 'editor':
                return ['editor', 'admin'].includes(this.userRole);
            case 'viewer':
                return ['viewer', 'editor', 'admin'].includes(this.userRole);
            default:
                return false;
        }
    }

    // 現在のユーザー情報取得
    getCurrentUser() {
        return {
            name: this.currentUser,
            role: this.userRole,
            department: this.userDepartment,
            profile: this.userProfile
        };
    }
}

// グローバルインスタンス作成（保護対象）
const authSystem = new AuthSystemV2();

// グローバル公開（保護）
Object.defineProperty(window, 'authSystem', {
    value: authSystem,
    writable: false,
    configurable: false
});

// V1互換関数のグローバル公開
Object.defineProperty(window, 'handleUserIdChange', {
    value: () => authSystem.handleUserIdChange(),
    writable: false,
    configurable: false
});

Object.defineProperty(window, 'handleLogin', {
    value: () => authSystem.handleLogin(),
    writable: false,
    configurable: false
});

console.log('🔒 認証システムコア読み込み完了');
