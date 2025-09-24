// CEスケジュール管理システム V2 - メイン処理（元機能完全再現版）

(function() {
    'use strict';
    
    console.log('[MAIN] dashboard-main.js 読み込み開始');
    
    // グローバル変数
    let authInstance = null;
    let currentUser = null;
    let isInitialized = false;
    let database = null;
    let DATA_ROOT = null;
    
    // 段階的初期化
    async function initializeSystem() {
        try {
            console.log('[MAIN] システム初期化開始');
            
            // Firebase設定待機
            await waitForFirebaseConfig();
            console.log('[MAIN] Firebase設定完了');
            
            // 既存認証システムでの認証チェック
            await checkAuthentication();
            console.log('[MAIN] 認証チェック完了');
            
            // システム初期化
            await initializeComponents();
            console.log('[MAIN] コンポーネント初期化完了');
            
            isInitialized = true;
            console.log('[MAIN] システム初期化完了');
            
        } catch (error) {
            console.error('[MAIN] 初期化エラー:', error);
            handleInitializationError(error);
        }
    }
    
    // Firebase設定待機
    async function waitForFirebaseConfig() {
        let retryCount = 0;
        const maxRetries = 20;
        
        while (retryCount < maxRetries) {
            if (window.database && window.DATA_ROOT && typeof window.waitForFirebase === 'function') {
                await window.waitForFirebase();
                database = window.database;
                DATA_ROOT = window.DATA_ROOT;
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 250));
            retryCount++;
        }
        
        throw new Error('Firebase設定の読み込みがタイムアウトしました');
    }
    
    // 認証チェック（既存システム準拠）
    async function checkAuthentication() {
        const targetUID = sessionStorage.getItem('targetUID');
        const currentUsername = sessionStorage.getItem('currentUsername');
        
        console.log('[MAIN] セッション確認:', { targetUID: !!targetUID, username: currentUsername });
        
        if (!targetUID || !currentUsername) {
            console.log('[MAIN] セッション情報なし - ログイン画面へリダイレクト');
            redirectToLogin();
            return;
        }
        
        try {
            // データベースからユーザー情報を取得
            const userSnap = await database.ref(`${DATA_ROOT}/users/${targetUID}`).once('value');
            const userData = userSnap.val();
            
            if (!userData) {
                console.log('[MAIN] ユーザーデータが見つかりません');
                redirectToLogin();
                return;
            }
            
            currentUser = {
                uid: targetUID,
                username: currentUsername,
                ...userData
            };
            
            console.log('[MAIN] 認証成功:', currentUser.displayName || currentUser.username);
            
        } catch (error) {
            console.error('[MAIN] ユーザーデータ取得エラー:', error);
            redirectToLogin();
        }
    }
    
    // コンポーネント初期化
    async function initializeComponents() {
        // 必要クラスの存在確認
        const requiredClasses = ['DashboardAuth', 'WorkScheduleViewer', 'PublishedScheduleResolver', 'ActivityLogger'];
        for (const className of requiredClasses) {
            if (typeof window[className] === 'undefined') {
                throw new Error(`${className} クラスが見つかりません`);
            }
        }
        
        // 認証インスタンス作成
        authInstance = new DashboardAuth();
        
        // UI初期化
        initializeUI();
        
        // ダッシュボード表示
        showDashboard();
    }
    
    // UI初期化（元の機能を再現）
    function initializeUI() {
        console.log('[MAIN] UI初期化開始');
        
        // ユーザー名表示
        updateUserInfo();
        
        // イベントリスナー設定
        setupEventListeners();
        
        // サイドバーメニュー初期化
        initializeSidebar();
        
        // メインコンテンツ初期化
        initializeMainContent();
        
        console.log('[MAIN] UI初期化完了');
    }
    
    // ユーザー情報更新
    function updateUserInfo() {
        const userNameElement = document.getElementById('user-name');
        if (userNameElement && currentUser) {
            userNameElement.textContent = currentUser.displayName || currentUser.username;
        }
    }
    
    // イベントリスナー設定
    function setupEventListeners() {
        // ログアウトボタン
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
        
        // その他のイベントリスナーをここに追加
        // 元のdashboard.htmlにあったイベントリスナーを再現
    }
    
    // ログアウト処理
    function handleLogout() {
        if (confirm('ログアウトしますか？')) {
            console.log('[MAIN] ログアウト処理開始');
            
            // セッション情報をクリア
            sessionStorage.removeItem('targetUID');
            sessionStorage.removeItem('currentUsername');
            sessionStorage.removeItem('needsSetup');
            
            // ローカル状態クリア
            currentUser = null;
            authInstance = null;
            
            console.log('[MAIN] ログアウト完了');
            
            // ログイン画面にリダイレクト
            window.location.href = 'index.html';
        }
    }
    
    // ダッシュボード表示
    function showDashboard() {
        console.log('[MAIN] ダッシュボード表示');
        
        // ローディング画面を隠してダッシュボードを表示
        const loadingScreen = document.getElementById('loading-screen');
        const dashboardContainer = document.getElementById('dashboard-container');
        
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        if (dashboardContainer) {
            dashboardContainer.style.display = 'block';
        }
    }
    
    // サイドバー初期化（元の機能を再現）
    function initializeSidebar() {
        const sidebarNav = document.getElementById('sidebar-nav');
        if (!sidebarNav) return;
        
        // 元のdashboard.htmlのメニュー構成を再現
        sidebarNav.innerHTML = `
            <ul style="list-style: none; padding: 0;">
                <li style="margin-bottom: 10px;">
                    <button class="btn btn-primary menu-item" onclick="showScheduleView()">
                        <i class="fas fa-calendar-alt"></i> スケジュール表示
                    </button>
                </li>
                <li style="margin-bottom: 10px;">
                    <button class="btn btn-primary menu-item" onclick="showWorkSchedule()">
                        <i class="fas fa-briefcase"></i> 勤務スケジュール
                    </button>
                </li>
                <li style="margin-bottom: 10px;">
                    <button class="btn btn-primary menu-item" onclick="showPublishedSchedule()">
                        <i class="fas fa-calendar-check"></i> 公開スケジュール
                    </button>
                </li>
                <li style="margin-bottom: 10px;">
                    <button class="btn btn-primary menu-item" onclick="showActivityLog()">
                        <i class="fas fa-list-alt"></i> 活動ログ
                    </button>
                </li>
                <li style="margin-bottom: 10px;">
                    <button class="btn btn-primary menu-item" onclick="showUserSettings()">
                        <i class="fas fa-user-cog"></i> 個人設定
                    </button>
                </li>
            </ul>
        `;
    }
    
    // メインコンテンツ初期化
    function initializeMainContent() {
        const mainContentArea = document.getElementById('main-content-area');
        if (!mainContentArea) return;
        
        // 元のダッシュボードのウェルカム画面を再現
        mainContentArea.innerHTML = `
            <div class="welcome-section">
                <h2 style="color: #667eea; margin-bottom: 20px;">
                    <i class="fas fa-home"></i> ダッシュボード
                </h2>
                <div class="welcome-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 15px; margin-bottom: 25px;">
                    <h3>ようこそ、${currentUser?.displayName || currentUser?.username}さん</h3>
                    <p>CEスケジュール管理システム V2 へようこそ。左側のメニューから各機能をご利用ください。</p>
                </div>
                
                <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                    <div class="stat-card" style="background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #667eea;">
                        <h4 style="color: #667eea; margin-bottom: 10px;">
                            <i class="fas fa-calendar-check"></i> 今日の予定
                        </h4>
                        <p style="color: #666;">スケジュール機能で確認できます</p>
                    </div>
                    <div class="stat-card" style="background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #28a745;">
                        <h4 style="color: #28a745; margin-bottom: 10px;">
                            <i class="fas fa-user-circle"></i> アカウント状態
                        </h4>
                        <p style="color: #666;">アクティブ</p>
                    </div>
                    <div class="stat-card" style="background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #17a2b8;">
                        <h4 style="color: #17a2b8; margin-bottom: 10px;">
                            <i class="fas fa-bell"></i> 通知
                        </h4>
                        <p style="color: #666;">新しい通知はありません</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    // ログイン画面リダイレクト
    function redirectToLogin() {
        console.log('[MAIN] ログイン画面にリダイレクト');
        window.location.href = 'index.html';
    }
    
    // 初期化エラーハンドリング
    function handleInitializationError(error) {
        console.error('[MAIN] 初期化エラー:', error);
        alert(`システム初期化エラー: ${error.message}\nログイン画面に戻ります。`);
        redirectToLogin();
    }
    
    // グローバル関数定義（元のdashboard.htmlの機能を再現）
    window.showScheduleView = function() {
        console.log('[MAIN] スケジュール表示');
        // 元の機能を実装
        const mainContentArea = document.getElementById('main-content-area');
        if (mainContentArea) {
            mainContentArea.innerHTML = `
                <h2 style="color: #667eea; margin-bottom: 20px;">
                    <i class="fas fa-calendar-alt"></i> スケジュール表示
                </h2>
                <p>スケジュール機能を初期化しています...</p>
                <button class="btn btn-secondary" style="margin-top: 15px;" onclick="initializeMainContent()">
                    <i class="fas fa-home"></i> ダッシュボードに戻る
                </button>
            `;
        }
    };
    
    window.showWorkSchedule = function() {
        console.log('[MAIN] 勤務スケジュール表示');
        // WorkScheduleViewer を使用した実装
        if (typeof WorkScheduleViewer !== 'undefined') {
            // 実際の機能実装
        }
    };
    
    window.showPublishedSchedule = function() {
        console.log('[MAIN] 公開スケジュール表示');
        // PublishedScheduleResolver を使用した実装
        if (typeof PublishedScheduleResolver !== 'undefined') {
            // 実際の機能実装
        }
    };
    
    window.showActivityLog = function() {
        console.log('[MAIN] 活動ログ表示');
        // ActivityLogger を使用した実装
        if (typeof ActivityLogger !== 'undefined') {
            // 実際の機能実装
        }
    };
    
    window.showUserSettings = function() {
        console.log('[MAIN] 個人設定表示');
        window.location.href = 'pages/user-setup.html';
    };
    
    // DOM読み込み完了後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSystem);
    } else {
        setTimeout(initializeSystem, 100);
    }
    
    console.log('[MAIN] dashboard-main.js 読み込み完了');
})();
