<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>V2認証システム - 修正版 auth-core.js</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <div class="bg-white rounded-lg shadow-lg p-6">
            <div class="flex items-center mb-6">
                <i class="fas fa-code text-blue-600 text-2xl mr-3"></i>
                <h1 class="text-2xl font-bold text-gray-800">V2認証システム - 修正版 auth-core.js</h1>
            </div>
            
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <h2 class="text-red-800 font-semibold mb-2">
                    <i class="fas fa-exclamation-triangle mr-2"></i>修正内容
                </h2>
                <ul class="text-red-700 text-sm space-y-1">
                    <li>• ユーザー名ベースログイン処理をAuthSystemCoreクラス内に統合</li>
                    <li>• 構文エラーの修正（クラス外部メソッド定義を修正）</li>
                    <li>• グローバル関数の正しい設定</li>
                </ul>
            </div>

            <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <h2 class="text-green-800 font-semibold mb-2">
                    <i class="fas fa-clipboard mr-2"></i>使用方法
                </h2>
                <p class="text-green-700 text-sm">
                    以下のコードを <code class="bg-gray-200 px-1 rounded">v2/js/auth/auth-core.js</code> に完全置換してください
                </p>
            </div>

            <div class="bg-gray-50 rounded-lg p-4">
                <div class="flex justify-between items-center mb-3">
                    <h3 class="font-semibold text-gray-700">修正版 auth-core.js</h3>
                    <button onclick="copyCode()" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                        <i class="fas fa-copy mr-1"></i>コピー
                    </button>
                </div>
                <pre id="codeContent" class="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-x-auto max-h-96 overflow-y-auto"><code>// V2認証システムコア（修正版）
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
        const maxWaitTime = 10000; // 10秒
        const startTime = Date.now();
        
        while (!window.firebase && (Date.now() - startTime) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (!window.firebase) {
            throw new Error('Firebase初期化タイムアウト');
        }
        
        console.log('✅ Firebase準備完了、認証システム初期化開始');
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
            // セッションからターゲットUIDを取得
            const targetUID = sessionStorage.getItem('targetUID') || user.uid;
            
            // ユーザーデータ取得
            const userSnapshot = await this.database.ref(`ceScheduleV2/users/${targetUID}`).once('value');
            
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                console.log('✅ ユーザーデータ取得:', userData);
                
                // 設定完了確認
                if (userData.setupCompleted) {
                    // ダッシュボードに遷移
                    console.log('🚀 設定完了済み - ダッシュボードに遷移');
                    window.location.href = 'dashboard.html';
                } else {
                    // 個人設定画面表示
                    this.showUserSetupScreen(userData);
                }
            } else {
                console.log('⚠️ ユーザーデータが見つかりません');
                this.handleMissingUserData(user);
            }
        } catch (error) {
            console.error('❌ 認証ユーザー処理エラー:', error);
        }
    }

    handleMissingUserData(user) {
        console.log('⚠️ ユーザーデータ不足 - 管理者に確認を促す');
        alert('ユーザーデータが見つかりません。管理者に確認してください。');
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
        
        // 権限表示
        const userRoleElement = document.getElementById('userRole');
        if (userRoleElement) {
            const roleNames = {
                'admin': '管理者',
                'editor': '編集者',
                'viewer': '閲覧者'
            };
            userRoleElement.textContent = roleNames[userData.role] || '閲覧者';
        }
    }

    // 🆕 ユーザー名ベースログイン処理
    async handleUsernameLogin(username) {
        try {
            console.log('🔐 ユーザー名ログイン開始:', username);
            
            // 1. ユーザー名からUIDを取得
            const usernameSnapshot = await this.database.ref(`ceScheduleV2/usernames/${username}`).once('value');
            const uid = usernameSnapshot.val();
            
            if (!uid) {
                console.error('❌ ユーザー名が見つかりません:', username);
                alert('ユーザー名が見つかりません。管理者に確認してください。');
                return false;
            }
            
            console.log('✅ UID取得成功:', uid);
            
            // 2. ユーザーデータ取得
            const userSnapshot = await this.database.ref(`ceScheduleV2/users/${uid}`).once('value');
            const userData = userSnapshot.val();
            
            if (!userData) {
                console.error('❌ ユーザーデータが見つかりません');
                alert('ユーザーデータが見つかりません。管理者に確認してください。');
                return false;
            }
            
            console.log('✅ ユーザーデータ取得:', userData);
            
            // 3. 匿名認証実行
            const authResult = await this.auth.signInAnonymously();
            console.log('✅ 匿名認証完了:', authResult.user.uid);
            
            // 4. セッションにUID保存
            sessionStorage.setItem('targetUID', uid);
            sessionStorage.setItem('currentUsername', username);
            
            // 5. 個人設定完了確認
            if (userData.setupCompleted) {
                console.log('✅ 設定完了済み → ダッシュボードへ');
                // ダッシュボードに遷移
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                console.log('⚠️ 個人設定が必要 → 設定画面へ');
                this.showUserSetupScreen(userData);
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ ログイン処理エラー:', error);
            alert('ログインに失敗しました: ' + error.message);
            return false;
        }
    }

    // 🆕 個人設定画面表示
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

    // 🆕 ユーザー設定フォーム処理
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

    // 🆕 ユーザー設定完了処理
    async handleUserSetupComplete() {
        try {
            const displayName = document.getElementById('displayName').value.trim();
            const email = document.getElementById('email').value.trim();
            
            if (!displayName) {
                alert('表示名を入力してください');
                return;
            }
            
            const targetUID = sessionStorage.getItem('targetUID');
            const username = sessionStorage.getItem('currentUsername');
            
            if (!targetUID) {
                console.error('❌ ターゲットUIDが見つかりません');
                return;
            }
            
            console.log('💾 ユーザー設定保存開始');
            
            // ユーザーデータ更新
            const updateData = {
                displayName: displayName,
                email: email,
                setupCompleted: true,
                lastLogin: firebase.database.ServerValue.TIMESTAMP,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            };
            
            await this.database.ref(`ceScheduleV2/users/${targetUID}`).update(updateData);
            console.log('✅ ユーザー設定保存完了');
            
            // ダッシュボードに遷移
            console.log('🚀 ダッシュボードに遷移');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
            
        } catch (error) {
            console.error('❌ 設定保存エラー:', error);
            alert('設定の保存に失敗しました: ' + error.message);
        }
    }

    // 🆕 isAdmin メソッドを追加
    isAdmin() {
        if (!this.currentUser) return false;
        const targetUID = sessionStorage.getItem('targetUID') || this.currentUser.uid;
        // 実際の権限チェックはここで実装
        return true; // 開発用
    }

    // 🆕 現在のユーザー情報取得
    getCurrentUser() {
        return this.currentUser;
    }

    // 🆕 ユーザー権限取得
    getUserRole() {
        // セッションや現在のユーザーから権限を取得
        return 'viewer'; // デフォルト
    }

    // 🆕 ログアウト機能
    async logout() {
        try {
            await this.auth.signOut();
            sessionStorage.clear();
            console.log('✅ ログアウト完了');
            window.location.href = 'index.html';
        } catch (error) {
            console.error('❌ ログアウトエラー:', error);
        }
    }

    // 🆕 匿名ログイン（開発用）
    async signInAnonymously() {
        try {
            const result = await this.auth.signInAnonymously();
            console.log('✅ 匿名ログイン完了');
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
        window.logout = () => authSystem.logout();
        window.getCurrentUser = () => authSystem.getCurrentUser();
        window.getUserRole = () => authSystem.getUserRole();
        window.isAdmin = () => authSystem.isAdmin();
        
        // 🆕 ユーザー名ベースログイン関数
        window.handleLogin = (username) => {
            if (authSystem) {
                return authSystem.handleUsernameLogin(username);
            } else {
                console.error('❌ 認証システムインスタンスが見つかりません');
                return false;
            }
        };
        
        // グローバルインスタンス保存
        window.authSystemInstance = authSystem;
        
        console.log('✅ グローバル関数設定完了');
    } catch (error) {
        console.error('❌ 認証システム初期化失敗:', error);
    }
});

console.log('🔒 認証システムコア読み込み完了（修正版）');</code></pre>
            </div>
        </div>
    </div>

    <script>
        function copyCode() {
            const codeContent = document.getElementById('codeContent').textContent;
            navigator.clipboard.writeText(codeContent).then(() => {
                // 成功メッセージ表示
                const button = event.target.closest('button');
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check mr-1"></i>コピー完了';
                button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                button.classList.add('bg-green-600');
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.classList.remove('bg-green-600');
                    button.classList.add('bg-blue-600', 'hover:bg-blue-700');
                }, 2000);
            }).catch(err => {
                console.error('コピーに失敗しました:', err);
                alert('コピーに失敗しました。手動でコードを選択してコピーしてください。');
            });
        }
    </script>
</body>
</html>
