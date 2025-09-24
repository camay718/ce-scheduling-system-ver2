// CEスケジュール管理システム V2 - メイン処理
// 段階的初期化でエラー箇所を特定

(function() {
    'use strict';
    
    console.log('[MAIN] dashboard-main.js 読み込み開始');
    
    // グローバル変数
    let authInstance = null;
    let currentUser = null;
    let isInitialized = false;
    
    // デバッグ用関数
    function debugLog(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(`[MAIN-${level.toUpperCase()}]`, logMessage);
        
        // デバッグ画面にも表示
        const debugDiv = document.getElementById('debug-status');
        if (debugDiv) {
            debugDiv.innerHTML += `<br>${logMessage}`;
        }
    }
    
    // 段階的初期化
    async function initializeSystem() {
        try {
            debugLog('システム初期化開始');
            
            // Step 1: 基本環境チェック
            debugLog('Step 1: 基本環境チェック');
            if (!window.firebase) {
                throw new Error('Firebase が読み込まれていません');
            }
            debugLog('Firebase 確認済み');
            
            // Step 2: 必要クラスの存在確認
            debugLog('Step 2: 必要クラスの存在確認');
            const requiredClasses = ['DashboardAuth', 'WorkScheduleViewer', 'PublishedScheduleResolver', 'ActivityLogger'];
            for (const className of requiredClasses) {
                if (typeof window[className] === 'undefined') {
                    throw new Error(`${className} クラスが見つかりません`);
                }
                debugLog(`${className} 確認済み`);
            }
            
            // Step 3: Firebase初期化
            debugLog('Step 3: Firebase初期化');
            if (!firebase.apps.length) {
                const firebaseConfig = {
                    apiKey: "AIzaSyC7VLauLy9vkEcBZHrQ3wKJYm_A6DbJHQ8",
                    authDomain: "ce-schedule-system.firebaseapp.com",
                    databaseURL: "https://ce-schedule-system-default-rtdb.firebaseio.com",
                    projectId: "ce-schedule-system",
                    storageBucket: "ce-schedule-system.appspot.com",
                    messagingSenderId: "461684979105",
                    appId: "1:461684979105:web:1234567890abcdef"
                };
                firebase.initializeApp(firebaseConfig);
                debugLog('Firebase アプリ初期化完了');
            }
            
            // Step 4: 認証インスタンス作成
            debugLog('Step 4: 認証インスタンス作成');
            authInstance = new DashboardAuth();
            debugLog('DashboardAuth インスタンス作成完了');
            
            // Step 5: UI初期化
            debugLog('Step 5: UI初期化');
            initializeUI();
            debugLog('UI初期化完了');
            
            // Step 6: 認証状態監視開始
            debugLog('Step 6: 認証状態監視開始');
            firebase.auth().onAuthStateChanged(handleAuthStateChange);
            debugLog('認証状態監視設定完了');
            
            isInitialized = true;
            debugLog('システム初期化完了');
            
        } catch (error) {
            debugLog(`初期化エラー: ${error.message}`, 'error');
            console.error('システム初期化エラー:', error);
            showError(`システム初期化に失敗しました: ${error.message}`);
        }
    }
    
    // UI初期化
    function initializeUI() {
        debugLog('UI初期化開始');
        
        // ログインフォーム作成
        const loginContent = document.getElementById('login-content');
        if (loginContent) {
            loginContent.innerHTML = `
                <form id="login-form" class="login-form">
                    <div class="form-group">
                        <label for="email">メールアドレス</label>
                        <input type="email" id="email" required>
                    </div>
                    <div class="form-group">
                        <label for="password">パスワード</label>
                        <input type="password" id="password" required>
                    </div>
                    <button type="submit" class="login-button" id="login-btn">ログイン</button>
                </form>
                <div id="login-error" class="error-message" style="display: none;"></div>
            `;
            
            // ログインフォームイベント
            const loginForm = document.getElementById('login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', handleLogin);
                debugLog('ログインフォームイベント設定完了');
            }
        }
        
        // ログアウトボタンイベント
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
            debugLog('ログアウトボタンイベント設定完了');
        }
        
        debugLog('UI初期化完了');
    }
    
    // 認証状態変更ハンドラー
    async function handleAuthStateChange(user) {
        try {
            debugLog(`認証状態変更: ${user ? user.email : '未認証'}`);
            
            if (user) {
                debugLog('ユーザーログイン検出');
                currentUser = user;
                
                // ユーザーデータ取得
                debugLog('ユーザーデータ取得開始');
                const userData = await authInstance.getCurrentUser();
                
                if (userData) {
                    debugLog('ユーザーデータ取得完了');
                    showDashboard(userData);
                } else {
                    debugLog('ユーザーデータ取得失敗', 'error');
                    showError('ユーザーデータの取得に失敗しました');
                }
            } else {
                debugLog('ユーザーログアウト検出');
                currentUser = null;
                showLogin();
            }
        } catch (error) {
            debugLog(`認証状態変更エラー: ${error.message}`, 'error');
            console.error('認証状態変更エラー:', error);
            showError('認証処理でエラーが発生しました');
        }
    }
    
    // ログイン処理
    async function handleLogin(event) {
        event.preventDefault();
        
        try {
            debugLog('ログイン処理開始');
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                throw new Error('メールアドレスとパスワードを入力してください');
            }
            
            debugLog(`ログイン試行: ${email}`);
            
            // ログインボタン無効化
            const loginBtn = document.getElementById('login-btn');
            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.textContent = 'ログイン中...';
            }
            
            // Firebase認証
            await firebase.auth().signInWithEmailAndPassword(email, password);
            debugLog('Firebase認証成功');
            
        } catch (error) {
            debugLog(`ログインエラー: ${error.message}`, 'error');
            console.error('ログインエラー:', error);
            showLoginError(error.message);
            
            // ログインボタン復活
            const loginBtn = document.getElementById('login-btn');
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'ログイン';
            }
        }
    }
    
    // ログアウト処理
    async function handleLogout() {
        try {
            debugLog('ログアウト処理開始');
            await firebase.auth().signOut();
            debugLog('ログアウト完了');
        } catch (error) {
            debugLog(`ログアウトエラー: ${error.message}`, 'error');
            console.error('ログアウトエラー:', error);
        }
    }
    
    // ログイン画面表示
    function showLogin() {
        debugLog('ログイン画面表示');
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('dashboard-container').style.display = 'none';
        
        // エラーメッセージクリア
        const errorDiv = document.getElementById('login-error');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }
    
    // ダッシュボード表示
    function showDashboard(userData) {
        debugLog('ダッシュボード表示開始');
        
        try {
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('dashboard-container').style.display = 'block';
            
            // ユーザー名表示
            const userNameElement = document.getElementById('user-name');
            if (userNameElement && userData.name) {
                userNameElement.textContent = userData.name;
            }
            
            // サイドバーメニュー初期化
            initializeSidebar();
            
            // メインコンテンツ初期化
            initializeMainContent();
            
            debugLog('ダッシュボード表示完了');
            
        } catch (error) {
            debugLog(`ダッシュボード表示エラー: ${error.message}`, 'error');
            console.error('ダッシュボード表示エラー:', error);
            showError('ダッシュボードの表示に失敗しました');
        }
    }
    
    // サイドバー初期化
    function initializeSidebar() {
        debugLog('サイドバー初期化');
        
        const sidebarNav = document.getElementById('sidebar-nav');
        if (sidebarNav) {
            sidebarNav.innerHTML = `
                <ul style="list-style: none; padding: 0;">
                    <li style="margin-bottom: 10px;">
                        <button class="btn btn-primary" style="width: 100%;" onclick="showScheduleView()">
                            スケジュール表示
                        </button>
                    </li>
                    <li style="margin-bottom: 10px;">
                        <button class="btn btn-primary" style="width: 100%;" onclick="showActivityLog()">
                            活動ログ
                        </button>
                    </li>
                </ul>
            `;
        }
    }
    
    // メインコンテンツ初期化
    function initializeMainContent() {
        debugLog('メインコンテンツ初期化');
        
        const mainContentArea = document.getElementById('main-content-area');
        if (mainContentArea) {
            mainContentArea.innerHTML = `
                <h2>CEスケジュール管理システム V2</h2>
                <p>システムが正常に動作しています。</p>
                <p>サイドバーのメニューから機能を選択してください。</p>
                
                <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
                    <h3>システム状態</h3>
                    <p>ユーザー: ${currentUser ? currentUser.email : 'なし'}</p>
                    <p>初期化状態: ${isInitialized ? '完了' : '未完了'}</p>
                    <p>最終更新: ${new Date().toLocaleString()}</p>
                </div>
            `;
        }
    }
    
    // エラー表示
    function showError(message) {
        alert(`エラー: ${message}`);
        debugLog(`エラー表示: ${message}`, 'error');
    }
    
    // ログインエラー表示
    function showLoginError(message) {
        const errorDiv = document.getElementById('login-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }
    
    // グローバル関数定義
    window.showScheduleView = function() {
        debugLog('スケジュール表示要求');
        const mainContentArea = document.getElementById('main-content-area');
        if (mainContentArea) {
            mainContentArea.innerHTML = '<h2>スケジュール表示</h2><p>スケジュール機能は実装中です。</p>';
        }
    };
    
    window.showActivityLog = function() {
        debugLog('活動ログ表示要求');
        const mainContentArea = document.getElementById('main-content-area');
        if (mainContentArea) {
            mainContentArea.innerHTML = '<h2>活動ログ</h2><p>活動ログ機能は実装中です。</p>';
        }
    };
    
    // DOM読み込み完了後に初期化開始
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSystem);
    } else {
        // 既にDOMが読み込まれている場合は即座に実行
        setTimeout(initializeSystem, 100);
    }
    
    debugLog('dashboard-main.js 読み込み完了');
})();
