// CEスケジュール管理システム V2 - メイン処理（独自認証システム対応版）

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
            
            // Step 6: 独自認証状態チェック（Firebase Auth の代わり）
            debugLog('Step 6: 独自認証状態チェック開始');
            await checkCustomAuthState();
            debugLog('独自認証状態チェック完了');
            
            isInitialized = true;
            debugLog('システム初期化完了');
            
        } catch (error) {
            debugLog(`初期化エラー: ${error.message}`, 'error');
            console.error('システム初期化エラー:', error);
            showError(`システム初期化に失敗しました: ${error.message}`);
        }
    }
    
    // 独自認証状態チェック（sessionStorageベース）
    async function checkCustomAuthState() {
        try {
            const targetUID = sessionStorage.getItem('targetUID');
            const currentUsername = sessionStorage.getItem('currentUsername');
            
            debugLog(`セッション確認: UID=${targetUID}, Username=${currentUsername}`);
            
            if (targetUID && currentUsername) {
                debugLog('有効なセッション検出');
                
                // データベースからユーザー情報を取得
                try {
                    await ensureFirebaseReady();
                    const userData = await authInstance.getCurrentUser();
                    
                    if (userData) {
                        debugLog('ユーザーデータ取得成功');
                        currentUser = { 
                            uid: targetUID, 
                            username: currentUsername,
                            email: userData.email || currentUsername,
                            ...userData 
                        };
                        showDashboard(userData);
                    } else {
                        debugLog('ユーザーデータ取得失敗 - ログイン画面へ');
                        redirectToLogin();
                    }
                } catch (error) {
                    debugLog(`ユーザーデータ取得エラー: ${error.message}`, 'error');
                    redirectToLogin();
                }
            } else {
                debugLog('セッション情報なし - ログイン画面へ');
                redirectToLogin();
            }
        } catch (error) {
            debugLog(`認証状態チェックエラー: ${error.message}`, 'error');
            redirectToLogin();
        }
    }
    
    // Firebase準備完了まで待機
    async function ensureFirebaseReady() {
        let retryCount = 0;
        const maxRetries = 10;
        
        while (retryCount < maxRetries) {
            try {
                if (window.database && window.DATA_ROOT) {
                    debugLog('Firebase データベース準備完了');
                    return;
                }
                
                // firebase-config.js が読み込まれるまで待機
                if (typeof window.waitForFirebase === 'function') {
                    await window.waitForFirebase();
                    return;
                }
                
                await new Promise(resolve => setTimeout(resolve, 500));
                retryCount++;
                debugLog(`Firebase準備待機中... (${retryCount}/${maxRetries})`);
            } catch (error) {
                retryCount++;
                debugLog(`Firebase準備エラー (${retryCount}/${maxRetries}): ${error.message}`, 'error');
                if (retryCount >= maxRetries) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        throw new Error('Firebase初期化タイムアウト');
    }
    
    // ログイン画面にリダイレクト
    function redirectToLogin() {
        debugLog('ログイン画面にリダイレクト');
        // セッション情報をクリア
        sessionStorage.removeItem('targetUID');
        sessionStorage.removeItem('currentUsername');
        sessionStorage.removeItem('needsSetup');
        
        // ログイン画面にリダイレクト
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }
    
    // UI初期化
    function initializeUI() {
        debugLog('UI初期化開始');
        
        // ログインフォーム作成（フォールバック用）
        const loginContent = document.getElementById('login-content');
        if (loginContent) {
            loginContent.innerHTML = `
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <p>認証状態を確認しています...</p>
                </div>
            `;
        }
        
        // ログアウトボタンイベント
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
            debugLog('ログアウトボタンイベント設定完了');
        }
        
        debugLog('UI初期化完了');
    }
    
    // ログアウト処理
    async function handleLogout() {
        try {
            debugLog('ログアウト処理開始');
            
            // セッション情報をクリア
            sessionStorage.removeItem('targetUID');
            sessionStorage.removeItem('currentUsername');
            sessionStorage.removeItem('needsSetup');
            
            // ローカル状態クリア
            currentUser = null;
            
            debugLog('ログアウト完了');
            
            // ログイン画面にリダイレクト
            window.location.href = 'index.html';
            
        } catch (error) {
            debugLog(`ログアウトエラー: ${error.message}`, 'error');
            console.error('ログアウトエラー:', error);
            // エラーでもログイン画面に移動
            window.location.href = 'index.html';
        }
    }
    
// ログイン画面表示（即座にリダイレクト）
function showLogin() {
    debugLog('認証なし - ログイン画面にリダイレクト');
    
    // ローディング画面を表示したまま即座にリダイレクト
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        const loadingContent = loadingScreen.querySelector('.loading-content p');
        if (loadingContent) {
            loadingContent.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 認証が必要です。ログイン画面に移動します...';
        }
    }
    
    // 即座にリダイレクト（2秒待機を削除）
    setTimeout(() => {
        redirectToLogin();
    }, 1000);
}
    
    // ダッシュボード表示
    function showDashboard(userData) {
        debugLog('ダッシュボード表示開始');
        
        try {
            const loginContainer = document.getElementById('login-container');
            const dashboardContainer = document.getElementById('dashboard-container');
            
            if (loginContainer) {
                loginContainer.style.display = 'none';
            }
            if (dashboardContainer) {
                dashboardContainer.style.display = 'block';
            }
            
            // ユーザー名表示
            const userNameElement = document.getElementById('user-name');
            if (userNameElement && userData.displayName) {
                userNameElement.textContent = userData.displayName;
            }
            
            // サイドバーメニュー初期化
            initializeSidebar();
            
            // メインコンテンツ初期化
            initializeMainContent(userData);
            
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
                            <i class="fas fa-calendar-alt"></i> スケジュール表示
                        </button>
                    </li>
                    <li style="margin-bottom: 10px;">
                        <button class="btn btn-primary" style="width: 100%;" onclick="showActivityLog()">
                            <i class="fas fa-list-alt"></i> 活動ログ
                        </button>
                    </li>
                    <li style="margin-bottom: 10px;">
                        <button class="btn btn-primary" style="width: 100%;" onclick="showUserSettings()">
                            <i class="fas fa-user-cog"></i> 個人設定
                        </button>
                    </li>
                </ul>
            `;
        }
    }
    
    // メインコンテンツ初期化
    function initializeMainContent(userData) {
        debugLog('メインコンテンツ初期化');
        
        const mainContentArea = document.getElementById('main-content-area');
        if (mainContentArea) {
            mainContentArea.innerHTML = `
                <div style="padding: 20px;">
                    <h2 style="color: #667eea; margin-bottom: 20px;">
                        <i class="fas fa-tachometer-alt"></i> ダッシュボード
                    </h2>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="margin-bottom: 15px;">ようこそ、${userData.displayName || userData.username}さん</h3>
                        <p style="margin-bottom: 10px;">CEスケジュール管理システム V2 にログインしました。</p>
                        <p style="margin-bottom: 15px;">サイドバーのメニューから各機能をご利用ください。</p>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <span style="background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                <i class="fas fa-circle"></i> オンライン
                            </span>
                            <span style="background: #17a2b8; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                権限: ${userData.role || 'viewer'}
                            </span>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <h4 style="color: #667eea; margin-bottom: 10px;">
                                <i class="fas fa-calendar-check"></i> 今日の予定
                            </h4>
                            <p style="color: #666;">スケジュール機能で確認できます</p>
                        </div>
                        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <h4 style="color: #667eea; margin-bottom: 10px;">
                                <i class="fas fa-bell"></i> 通知
                            </h4>
                            <p style="color: #666;">新しい通知はありません</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    // エラー表示
    function showError(message) {
        console.error('エラー:', message);
        debugLog(`エラー表示: ${message}`, 'error');
        
        // 簡単なエラー表示
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: #f8d7da; color: #721c24; padding: 15px 20px;
            border-radius: 8px; border: 1px solid #f5c6cb;
            z-index: 9999; max-width: 400px;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }
    
    // グローバル関数定義
    window.showScheduleView = function() {
        debugLog('スケジュール表示要求');
        const mainContentArea = document.getElementById('main-content-area');
        if (mainContentArea) {
            mainContentArea.innerHTML = `
                <div style="padding: 20px;">
                    <h2 style="color: #667eea; margin-bottom: 20px;">
                        <i class="fas fa-calendar-alt"></i> スケジュール表示
                    </h2>
                    <p>スケジュール機能は実装中です。</p>
                    <div style="margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="initializeMainContent({displayName: '${currentUser?.displayName || 'ユーザー'}', username: '${currentUser?.username || ''}', role: '${currentUser?.role || 'viewer}'})">
                            <i class="fas fa-arrow-left"></i> ダッシュボードに戻る
                        </button>
                    </div>
                </div>
            `;
        }
    };
    
    window.showActivityLog = function() {
        debugLog('活動ログ表示要求');
        const mainContentArea = document.getElementById('main-content-area');
        if (mainContentArea) {
            mainContentArea.innerHTML = `
                <div style="padding: 20px;">
                    <h2 style="color: #667eea; margin-bottom: 20px;">
                        <i class="fas fa-list-alt"></i> 活動ログ
                    </h2>
                    <p>活動ログ機能は実装中です。</p>
                    <div style="margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="initializeMainContent({displayName: '${currentUser?.displayName || 'ユーザー'}', username: '${currentUser?.username || ''}', role: '${currentUser?.role || 'viewer}'})">
                            <i class="fas fa-arrow-left"></i> ダッシュボードに戻る
                        </button>
                    </div>
                </div>
            `;
        }
    };
    
    window.showUserSettings = function() {
        debugLog('個人設定表示要求');
        window.location.href = 'pages/user-setup.html';
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
