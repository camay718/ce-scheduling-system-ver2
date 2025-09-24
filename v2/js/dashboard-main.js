/*
==========================================
📊 ダッシュボードメイン処理 - デバッグ版
初期化・イベントリスナー・UI操作・エントリーポイント
==========================================
*/

// デバッグ用ログ関数
function debugLog(message, data = null) {
    console.log(`🔍 [DEBUG] ${message}`, data || '');
    
    // デバッグ情報を画面に表示
    const debugDiv = document.getElementById('debugLog') || createDebugDiv();
    const timestamp = new Date().toLocaleTimeString();
    debugDiv.innerHTML += `<div>${timestamp}: ${message}</div>`;
    if (data) {
        debugDiv.innerHTML += `<div style="margin-left: 20px; color: #666;">${JSON.stringify(data, null, 2)}</div>`;
    }
}

function createDebugDiv() {
    const div = document.createElement('div');
    div.id = 'debugLog';
    div.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        width: 400px;
        max-height: 300px;
        overflow-y: auto;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px;
        font-size: 12px;
        z-index: 9999;
        border-radius: 5px;
    `;
    document.body.appendChild(div);
    return div;
}

// グローバル変数
let scheduleResolver;
let activityLogger;
let scheduleViewer;
let dashboardAuth;
let currentDate = new Date();
let currentView = 'daily';
let isInitialized = false;

// 初期化処理
async function initializeDashboard() {
    if (isInitialized) {
        debugLog('初期化スキップ - 既に初期化済み');
        return;
    }

    try {
        debugLog('ダッシュボード初期化開始');
        debugLog('現在のURL', window.location.href);
        debugLog('現在のパス', window.location.pathname);

        // Firebase準備待ち
        debugLog('Firebase準備待ち開始');
        await window.waitForFirebase();
        debugLog('Firebase準備完了', {
            auth: !!window.auth,
            database: !!window.database,
            DATA_ROOT: window.DATA_ROOT
        });

        // 認証管理初期化（最優先）
        debugLog('認証管理初期化開始');
        dashboardAuth = new DashboardAuth();
        await dashboardAuth.init();
        debugLog('認証管理初期化完了');
        
        // 認証完了待ち
        debugLog('認証完了待ち開始');
        await waitForAuthentication();
        debugLog('認証確認完了', {
            isAuthenticated: dashboardAuth.isAuthenticated,
            currentUser: dashboardAuth.currentUser?.uid,
            userRole: dashboardAuth.userRole
        });

        // 認証後にコアコンポーネント初期化
        debugLog('コアコンポーネント初期化開始');
        await initializeCoreComponents();
        debugLog('コアコンポーネント初期化完了');

        // UI初期化
        debugLog('UI初期化開始');
        initializeUI();
        setupEventListeners();
        debugLog('UI初期化完了');
        
        // 初期画面表示
        debugLog('初期画面表示開始');
        showDailySchedule();
        debugLog('初期画面表示完了');

        isInitialized = true;
        debugLog('ダッシュボード初期化完了');

        // 3秒後にデバッグログを非表示にする
        setTimeout(() => {
            const debugDiv = document.getElementById('debugLog');
            if (debugDiv) {
                debugDiv.style.display = 'none';
            }
        }, 10000); // 10秒後に非表示

    } catch (error) {
        debugLog('ダッシュボード初期化エラー', error.message);
        console.error('❌ ダッシュボード初期化エラー:', error);
        showInitializationError(error);
    }
}

// コアコンポーネント初期化
async function initializeCoreComponents() {
    try {
        debugLog('コアコンポーネント初期化開始');
        
        // 各コンポーネントを順次初期化
        scheduleResolver = new PublishedScheduleResolver();
        activityLogger = new ActivityLogger();
        scheduleViewer = new WorkScheduleViewer();

        debugLog('コンポーネントインスタンス作成完了');

        // 並行初期化
        await Promise.all([
            scheduleResolver.init(),
            activityLogger.init(),
            scheduleViewer.init()
        ]);

        // グローバル公開
        window.scheduleResolver = scheduleResolver;
        window.activityLogger = activityLogger;
        window.scheduleViewer = scheduleViewer;

        debugLog('コアコンポーネント初期化完了');
    } catch (error) {
        debugLog('コアコンポーネント初期化エラー', error.message);
        console.error('❌ コアコンポーネント初期化エラー:', error);
        // コアコンポーネント初期化エラーでも続行
    }
}

// 認証完了待ち
async function waitForAuthentication() {
    return new Promise((resolve, reject) => {
        debugLog('認証完了待ち開始');
        
        const timeout = setTimeout(() => {
            debugLog('認証確認タイムアウト');
            reject(new Error('認証確認タイムアウト'));
        }, 15000); // 15秒タイムアウト

        const checkAuth = () => {
            debugLog('認証状態チェック', {
                isAuthenticated: dashboardAuth.isAuthenticated,
                authStateChangeHandled: dashboardAuth.authStateChangeHandled,
                currentUser: dashboardAuth.currentUser?.uid
            });

            if (dashboardAuth.isAuthenticated) {
                debugLog('認証完了確認');
                clearTimeout(timeout);
                resolve();
            } else if (dashboardAuth.authStateChangeHandled && !dashboardAuth.isAuthenticated) {
                // 認証状態が確定したが未認証の場合
                debugLog('未認証状態確定');
                clearTimeout(timeout);
                reject(new Error('認証されていません'));
            } else {
                setTimeout(checkAuth, 100);
            }
        };
        
        checkAuth();
    });
}

// 初期化エラー表示
function showInitializationError(error) {
    debugLog('初期化エラー表示', error.message);
    
    const loading = document.getElementById('loading');
    if (loading) {
        loading.innerHTML = `
            <div class="text-red-500 text-center">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <h3 class="text-lg font-bold mb-2">初期化エラー</h3>
                <p class="mb-4">${error.message || 'ダッシュボードの初期化に失敗しました'}</p>
                <div class="space-y-2">
                    <button onclick="location.reload()" class="btn-unified btn-primary-unified mr-2">
                        <i class="fas fa-redo mr-2"></i>再読み込み
                    </button>
                    <button onclick="window.location.href='index.html'" class="btn-unified btn-outline-unified">
                        <i class="fas fa-sign-in-alt mr-2"></i>ログイン画面へ
                    </button>
                </div>
            </div>
        `;
    }
}

// UI初期化
function initializeUI() {
    debugLog('UI初期化開始');
    
    // 日付ピッカー初期化
    const datePicker = document.getElementById('scheduleDatePicker');
    if (datePicker) {
        datePicker.value = formatDateForInput(currentDate);
        debugLog('日付ピッカー初期化完了');
    }

    // サイドバー初期化
    initializeSidebar();
    
    // 同期状態初期化
    initializeSyncStatus();

    // レスポンシブ対応
    setupResponsiveUI();
    
    debugLog('UI初期化完了');
}

// イベントリスナー設定
function setupEventListeners() {
    debugLog('イベントリスナー設定開始');
    
    // ナビゲーションタブ
    setupNavigationTabs();
    
    // 日付操作ボタン
    setupDateControls();
    
    // 業務追加ボタン
    setupEventButtons();
    
    // テンプレートボタン
    setupTemplateButtons();
    
    // リサイズイベント
    window.addEventListener('resize', handleWindowResize);
    
    // キーボードショートカット
    setupKeyboardShortcuts();

    // 権限チェック関数をグローバルに公開
    window.checkPermission = (requiredRole) => {
        return dashboardAuth ? dashboardAuth.checkPermission(requiredRole) : false;
    };
    
    debugLog('イベントリスナー設定完了');
}

// ナビゲーションタブ設定
function setupNavigationTabs() {
    const tabs = [
        { id: 'dailyScheduleTab', view: 'daily', content: 'dailyScheduleContent' },
        { id: 'weeklyScheduleTab', view: 'weekly', content: 'weeklyScheduleContent' },
        { id: 'ceWorkScheduleTab', view: 'schedule', content: 'ceWorkScheduleContent' },
        { id: 'analysisTab', view: 'analysis', content: 'analysisContent' },
        { id: 'settingsTab', view: 'settings', content: 'settingsContent' }
    ];

    tabs.forEach(tab => {
        const element = document.getElementById(tab.id);
        if (element) {
            element.addEventListener('click', () => switchView(tab.view, tab.content));
        }
    });
    
    debugLog('ナビゲーションタブ設定完了');
}

// 日付コントロール設定
function setupDateControls() {
    const prevBtn = document.getElementById('prevDayBtn');
    const nextBtn = document.getElementById('nextDayBtn');
    const todayBtn = document.getElementById('todayBtn');
    const datePicker = document.getElementById('scheduleDatePicker');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => changeDate(-1));
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => changeDate(1));
    }

    if (todayBtn) {
        todayBtn.addEventListener('click', () => goToToday());
    }

    if (datePicker) {
        datePicker.addEventListener('change', (e) => {
            const selectedDate = new Date(e.target.value);
            if (!isNaN(selectedDate.getTime())) {
                currentDate = selectedDate;
                updateScheduleDisplay();
            }
        });
    }
    
    debugLog('日付コントロール設定完了');
}

// 業務追加ボタン設定
function setupEventButtons() {
    const addEventBtn = document.getElementById('addEventButtonDaily');
    const addBulkBtn = document.getElementById('addBulkEventBtn');
    const addMonthlyBtn = document.getElementById('addMonthlyTaskBtn');

    if (addEventBtn) {
        addEventBtn.addEventListener('click', () => openAddEventModal());
    }

    if (addBulkBtn) {
        addBulkBtn.addEventListener('click', () => openBulkAddModal());
    }

    if (addMonthlyBtn) {
        addMonthlyBtn.addEventListener('click', () => openMonthlyTaskModal());
    }
    
    debugLog('業務追加ボタン設定完了');
}

// テンプレートボタン設定
function setupTemplateButtons() {
    const saveBtn = document.getElementById('templateSaveButton');
    const loadBtn = document.getElementById('templateAddLoadButton');

    if (saveBtn) {
        saveBtn.addEventListener('click', () => saveTemplate());
    }

    if (loadBtn) {
        loadBtn.addEventListener('click', () => loadTemplate());
    }
    
    debugLog('テンプレートボタン設定完了');
}

// サイドバー初期化
function initializeSidebar() {
    const toggleBtn = document.getElementById('toggleSidebar');
    const sidebar = document.getElementById('sidebar');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('expanded');
        });

        // クリック外でサイドバーを閉じる（モバイルのみ）
        if (window.innerWidth <= 768) {
            document.addEventListener('click', (e) => {
                if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
                    sidebar.classList.remove('expanded');
                }
            });
        }
    }
    
    debugLog('サイドバー初期化完了');
}

// 同期状態初期化
function initializeSyncStatus() {
    const syncStatus = document.getElementById('mainSyncStatus');
    const syncStatusText = document.getElementById('syncStatusText');
    const lastSyncTime = document.getElementById('lastSyncTime');

    if (syncStatus && syncStatusText && lastSyncTime) {
        // リアルタイム同期状態監視
        setInterval(() => {
            const now = new Date();
            lastSyncTime.textContent = `最終: ${now.toLocaleTimeString('ja-JP')}`;
        }, 30000); // 30秒ごと

        // 初回表示
        const now = new Date();
        lastSyncTime.textContent = `最終: ${now.toLocaleTimeString('ja-JP')}`;
    }
    
    debugLog('同期状態初期化完了');
}

// レスポンシブUI設定
function setupResponsiveUI() {
    const handleResponsive = () => {
        const isMobile = window.innerWidth <= 768;
        const sidebar = document.getElementById('sidebar');
        
        if (isMobile) {
            sidebar?.classList.remove('expanded');
        }
    };

    handleResponsive();
    window.addEventListener('resize', handleResponsive);
    
    debugLog('レスポンシブUI設定完了');
}

// ビュー切り替え
function switchView(view, contentId) {
    debugLog('ビュー切り替え', { view, contentId });
    
    currentView = view;

    // 全てのコンテンツを非表示
    document.querySelectorAll('.screen-content').forEach(content => {
        content.style.display = 'none';
    });

    // 全てのタブを非アクティブ
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // 選択されたコンテンツを表示
    const content = document.getElementById(contentId);
    if (content) {
        content.style.display = 'block';
    }

    // 選択されたタブをアクティブ
    const activeTab = document.querySelector(`#${view}ScheduleTab, #${view}Tab`);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    // ビュー固有の初期化処理
    handleViewSpecificInit(view);

    // モバイルでサイドバーを閉じる
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar')?.classList.remove('expanded');
    }
}

// ビュー固有初期化
function handleViewSpecificInit(view) {
    debugLog('ビュー固有初期化', view);
    
    switch(view) {
        case 'daily':
            updateScheduleDisplay();
            break;
        case 'schedule':
            if (scheduleViewer && scheduleViewer.isInitialized) {
                scheduleViewer.loadLatestSchedule();
            }
            break;
        case 'settings':
            loadSettingsContent();
            break;
        case 'analysis':
            // 分析画面は静的なので特別な処理不要
            break;
    }
}

// 日別スケジュール表示
function showDailySchedule() {
    debugLog('日別スケジュール表示開始');
    switchView('daily', 'dailyScheduleContent');
    updateScheduleDisplay();
    debugLog('日別スケジュール表示完了');
}

// 日付変更
function changeDate(delta) {
    currentDate.setDate(currentDate.getDate() + delta);
    updateDatePicker();
    updateScheduleDisplay();
}

// 今日に移動
function goToToday() {
    currentDate = new Date();
    updateDatePicker();
    updateScheduleDisplay();
}

// 日付ピッカー更新
function updateDatePicker() {
    const datePicker = document.getElementById('scheduleDatePicker');
    if (datePicker) {
        datePicker.value = formatDateForInput(currentDate);
    }
}

// スケジュール表示更新
async function updateScheduleDisplay() {
    if (currentView !== 'daily') return;

    try {
        debugLog('スケジュール表示更新開始');
        
        // タイトル更新
        updateScheduleTitle();

        // 日別集計更新
        await updateDailySummary();

        // 部門グリッド更新
        await updateDepartmentGrid();

        // CEリスト更新
        await updateCEList();

        debugLog('スケジュール表示更新完了');
    } catch (error) {
        debugLog('スケジュール表示更新エラー', error.message);
        console.error('❌ スケジュール表示更新エラー:', error);
    }
}

// スケジュールタイトル更新
function updateScheduleTitle() {
    const title = document.getElementById('dailyScheduleTitle');
    if (title) {
        const dateStr = formatDateDisplay(currentDate);
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][currentDate.getDay()];
        
        let dayType = '';
        if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
            dayType = ' 🔷'; // 土日マーク
        }
        if (window.isJapaneseHoliday && window.isJapaneseHoliday(currentDate)) {
            dayType = ' 🎌'; // 祝日マーク
        }

        title.textContent = `${dateStr}（${dayOfWeek}）${dayType}`;
    }
}

// 日別集計更新
async function updateDailySummary() {
    try {
        const dateKey = formatDateKey(currentDate);
        
        debugLog('日別集計更新開始', dateKey);
        
        // データベースアクセス前にFirebase準備確認
        if (!window.database) {
            debugLog('データベース未準備のため集計をスキップ');
            return;
        }
        
        // イベントデータ取得
        const eventsSnapshot = await window.database.ref(`${window.DATA_ROOT}/events/${dateKey}`).once('value');
        const events = eventsSnapshot.val() || {};
        
        // CE数取得
        const cesSnapshot = await window.database.ref(`${window.DATA_ROOT}/ces`).once('value');
        const ces = cesSnapshot.val() || {};
        
        const totalEvents = Object.keys(events).length;
        const totalCEs = Object.keys(ces).length;
        
        let totalRequired = 0;
        let totalAssigned = 0;
        
        Object.values(events).forEach(event => {
            if (event.requiredCEs) totalRequired += event.requiredCEs;
            if (event.assignedCEs) totalAssigned += event.assignedCEs.length;
        });

        debugLog('日別集計データ', {
            totalEvents,
            totalCEs,
            totalRequired,
            totalAssigned
        });

        // UI更新
        updateElement('totalEventCount', totalEvents);
        updateElement('totalAvailableCount', totalCEs);
        updateElement('totalRequiredCount', totalRequired);
        updateElement('totalAssignedCount', totalAssigned);
        updateElement('totalAssignedCount2', totalAssigned);

        // プログレスバー更新
        const progressFill = document.getElementById('overallProgressFill');
        if (progressFill) {
            const percentage = totalRequired > 0 ? Math.min((totalAssigned / totalRequired) * 100, 100) : 0;
            progressFill.style.width = `${percentage}%`;
        }
        
        debugLog('日別集計更新完了');

    } catch (error) {
        debugLog('日別集計更新エラー', error.message);
        console.error('❌ 日別集計更新エラー:', error);
    }
}

// 部門グリッド更新
async function updateDepartmentGrid() {
    const grid = document.getElementById('departmentGrid');
    if (!grid || !window.database) return;

    try {
        debugLog('部門グリッド更新開始');
        
        const dateKey = formatDateKey(currentDate);
        
        // 部門別イベント取得
        const eventsSnapshot = await window.database.ref(`${window.DATA_ROOT}/events/${dateKey}`).once('value');
        const events = eventsSnapshot.val() || {};
        
        // 月次業務取得
        const monthKey = dateKey.substring(0, 6);
        const monthlySnapshot = await window.database.ref(`${window.DATA_ROOT}/monthlyTasks/${monthKey}`).once('value');
        const monthlyTasks = monthlySnapshot.val() || {};

        // 部門別グループ化
        const departmentGroups = groupEventsByDepartment(events, monthlyTasks);
        
        debugLog('部門グループ化完了', Object.keys(departmentGroups));
        
        // グリッド生成
        grid.innerHTML = Object.keys(departmentGroups).map(dept => 
            generateDepartmentSection(dept, departmentGroups[dept])
        ).join('');

        // ドラッグ&ドロップ設定
        setupDragAndDrop();
        
        debugLog('部門グリッド更新完了');

    } catch (error) {
        debugLog('部門グリッド更新エラー', error.message);
        console.error('❌ 部門グリッド更新エラー:', error);
    }
}

// CEリスト更新
async function updateCEList() {
    const container = document.getElementById('ceListContainer');
    const countElement = document.getElementById('ceListCount');
    
    if (!container || !window.database) return;

    try {
        debugLog('CEリスト更新開始');
        
        const dateKey = formatDateKey(currentDate);
        
        // CE一覧取得
        const cesSnapshot = await window.database.ref(`${window.DATA_ROOT}/ces`).once('value');
        const ces = cesSnapshot.val() || {};
        
        const ceList = Object.keys(ces).map(id => ({ id, ...ces[id] }))
            .sort((a, b) => a.name.localeCompare(b.name));

        debugLog('CE一覧取得完了', ceList.length);

        // 勤務状況取得
        const ceStatusPromises = ceList.map(async (ce) => {
            const workStatus = scheduleResolver && scheduleResolver.isInitialized ? 
                await scheduleResolver.getCEWorkStatusForDate(ce.id, dateKey) : null;
            return { ...ce, workStatus };
        });

        const ceListWithStatus = await Promise.all(ceStatusPromises);

        // CE数表示
        if (countElement) {
            countElement.textContent = ceList.length;
        }

        // CEリスト表示
        container.innerHTML = ceListWithStatus.map(ce => generateCEItem(ce)).join('');

        // ドラッグ可能化
        setupCEDragging();
        
        debugLog('CEリスト更新完了');

    } catch (error) {
        debugLog('CEリスト更新エラー', error.message);
        console.error('❌ CEリスト更新エラー:', error);
    }
}

// 設定コンテンツ読み込み
function loadSettingsContent() {
    const container = document.getElementById('settingsContent');
    if (!container) return;

    const userRole = window.userRole || 'user';
    const currentUserData = window.currentUserData || {};

    container.innerHTML = `
        <h2 class="text-2xl font-bold mb-6">設定</h2>
        
        <div class="space-y-6">
            <!-- ユーザー設定 -->
            <div class="glass-card p-6">
                <h3 class="text-lg font-semibold mb-4"><i class="fas fa-user-cog mr-2"></i>ユーザー設定</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">表示名</label>
                        <input type="text" id="userDisplayName" class="input-unified" 
                               value="${currentUserData.displayName || ''}" readonly>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">権限</label>
                        <input type="text" id="userRole" class="input-unified" 
                               value="${currentUserData.role || ''}" readonly>
                    </div>
                </div>
            </div>

            <!-- システム設定 -->
            <div class="glass-card p-6">
                <h3 class="text-lg font-semibold mb-4"><i class="fas fa-cog mr-2"></i>システム設定</h3>
                
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="font-medium">自動同期</div>
                            <div class="text-sm text-gray-500">リアルタイムでデータを同期します</div>
                        </div>
                        <input type="checkbox" id="autoSync" checked disabled class="form-checkbox">
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="font-medium">通知</div>
                            <div class="text-sm text-gray-500">変更通知を受け取ります</div>
                        </div>
                        <input type="checkbox" id="notifications" checked class="form-checkbox">
                    </div>
                </div>
            </div>

            <!-- 管理機能 -->
            ${userRole === 'admin' ? `
            <div class="glass-card p-6">
                <h3 class="text-lg font-semibold mb-4"><i class="fas fa-shield-alt mr-2"></i>管理機能</h3>
                
                <div class="space-y-3">
                    <button onclick="window.openLoginManagement()" 
                            class="btn-unified btn-outline-unified w-full">
                        <i class="fas fa-users-cog mr-2"></i>ログイン管理
                    </button>
                    
                    <button onclick="showActivityLog()" 
                            class="btn-unified btn-outline-unified w-full">
                        <i class="fas fa-history mr-2"></i>変更履歴確認
                    </button>
                    
                    <button onclick="exportSystemData()" 
                            class="btn-unified btn-outline-unified w-full">
                        <i class="fas fa-download mr-2"></i>データエクスポート
                    </button>
                </div>
            </div>
            ` : ''}

            <!-- バージョン情報 -->
            <div class="glass-card p-6">
                <h3 class="text-lg font-semibold mb-4"><i class="fas fa-info-circle mr-2"></i>システム情報</h3>
                
                <div class="text-sm text-gray-600 space-y-1">
                    <div>バージョン: V2.1.0</div>
                    <div>最終更新: 2024年12月17日</div>
                    <div>開発: CE課業務効率化プロジェクト</div>
                </div>
            </div>
        </div>
    `;
}

// 残りの関数は省略（前回と同じ）
function openAddEventModal() {
    if (window.eventManager) {
        const dateStr = formatDateKey(currentDate);
        window.eventManager.openEventModal(null, dateStr);
    } else if (window.showMessage) {
        window.showMessage('業務追加機能は準備中です', 'info');
    }
}

function openBulkAddModal() {
    if (window.eventManager) {
        window.eventManager.openBulkAddModal();
    } else if (window.showMessage) {
        window.showMessage('一括追加機能は準備中です', 'info');
    }
}

function openMonthlyTaskModal() {
    if (window.showMessage) {
        window.showMessage('月次業務追加機能は準備中です', 'info');
    }
}

function saveTemplate() {
    if (window.showMessage) {
        window.showMessage('テンプレート保存機能は準備中です', 'info');
    }
}

function loadTemplate() {
    if (window.showMessage) {
        window.showMessage('テンプレート読み込み機能は準備中です', 'info');
    }
}

function showActivityLog() {
    if (!activityLogger) {
        if (window.showMessage) {
            window.showMessage('アクティビティログが利用できません', 'warning');
        }
        return;
    }

    if (!window.createModal) {
        console.error('createModal関数が見つかりません');
        return;
    }

    const modal = window.createModal('変更履歴', `
        <div class="activity-log" id="activityLogContainer">
            読み込み中...
        </div>
    `, 'large');

    activityLogger.renderActivityLog('activityLogContainer');
}

async function exportSystemData() {
    if (!window.checkPermission('admin')) {
        if (window.showMessage) {
            window.showMessage('管理者権限が必要です', 'error');
        }
        return;
    }

    try {
        if (window.showMessage) {
            window.showMessage('データエクスポートを準備しています...', 'info');
        }
        
        setTimeout(() => {
            if (window.showMessage) {
                window.showMessage('データエクスポート機能は準備中です', 'info');
            }
        }, 1000);

    } catch (error) {
        console.error('データエクスポートエラー:', error);
        if (window.showMessage) {
            window.showMessage('データエクスポートに失敗しました', 'error');
        }
    }
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (!e.ctrlKey && !e.metaKey) return;

        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                changeDate(-1);
                break;
            case 'ArrowRight':
                e.preventDefault();
                changeDate(1);
                break;
            case 'Home':
                e.preventDefault();
                goToToday();
                break;
            case '1':
                e.preventDefault();
                switchView('daily', 'dailyScheduleContent');
                break;
            case '2':
                e.preventDefault();
                switchView('weekly', 'weeklyScheduleContent');
                break;
            case '3':
                e.preventDefault();
                switchView('schedule', 'ceWorkScheduleContent');
                break;
        }
    });
}

function handleWindowResize() {
    const isMobile = window.innerWidth <= 768;
    
    if (!isMobile) {
        const sidebar = document.getElementById('sidebar');
        sidebar?.classList.remove('expanded');
    }
}

// ユーティリティ関数
function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

function formatDateDisplay(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function groupEventsByDepartment(events, monthlyTasks) {
    const groups = {};
    
    Object.values(events).forEach(event => {
        const dept = event.department || 'その他';
        if (!groups[dept]) groups[dept] = { events: [], monthlyTasks: [] };
        groups[dept].events.push(event);
    });
    
    Object.values(monthlyTasks).forEach(task => {
        const dept = task.department || 'その他';
        if (!groups[dept]) groups[dept] = { events: [], monthlyTasks: [] };
        groups[dept].monthlyTasks.push(task);
    });
    
    return groups;
}

function generateDepartmentSection(department, data) {
    const deptColor = window.DEPARTMENT_COLORS?.[department] || '#e5e7eb';
    
    return `
        <div class="department-section glass-card p-4" style="border-left: 4px solid ${deptColor};">
            <h3 class="font-bold mb-3" style="color: ${deptColor};">
                <i class="fas fa-hospital mr-1"></i>${department}
            </h3>
            
            <div class="space-y-2">
                ${data.events.map(event => generateEventCard(event)).join('')}
                ${data.monthlyTasks.map(task => generateMonthlyTaskCard(task)).join('')}
            </div>
            
            <div class="assignment-dropzone mt-3 p-2 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500 text-sm">
                <i class="fas fa-plus mr-1"></i>CEをドラッグ＆ドロップ
            </div>
        </div>
    `;
}

function generateEventCard(event) {
    const assignedCount = event.assignedCEs ? event.assignedCEs.length : 0;
    const requiredCount = event.requiredCEs || 1;
    const progressPercent = requiredCount > 0 ? (assignedCount / requiredCount) * 100 : 0;
    
    return `
        <div class="event-card bg-white p-3 rounded-lg border shadow-sm" data-event-id="${event.id}">
            <div class="flex justify-between items-start mb-2">
                <div class="font-semibold text-gray-800">${event.title}</div>
                <div class="text-xs text-gray-500">${event.time || ''}</div>
            </div>
            
            <div class="event-count-display">
                配置: ${assignedCount}/${requiredCount}人
                <div class="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div class="bg-green-500 h-1.5 rounded-full transition-all" 
                         style="width: ${Math.min(progressPercent, 100)}%"></div>
                </div>
            </div>
            
            ${event.assignedCEs && event.assignedCEs.length > 0 ? `
                <div class="assigned-ces">
                    ${event.assignedCEs.map(ce => `
                        <span class="ce-chip worktype-${ce.workType || 'ope'}">
                            ${ce.name}
                            <span class="remove-ce" onclick="removeCEFromEvent('${event.id}', '${ce.id}')">×</span>
                        </span>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function generateMonthlyTaskCard(task) {
    return `
        <div class="monthly-task-card bg-yellow-50 border border-yellow-200" data-task-id="${task.id}">
            <div class="flex justify-between items-start">
                <div class="font-medium text-gray-800">${task.title}</div>
                <span class="monthly-task-badge">月次</span>
            </div>
            
            <div class="monthly-progress-bar">
                <div class="monthly-progress-fill" style="width: ${task.progress || 0}%"></div>
            </div>
            
            <div class="text-xs text-gray-600">
                進捗: ${task.progress || 0}% / 期限: ${task.deadline || '未設定'}
            </div>
        </div>
    `;
}

function generateCEItem(ce) {
    const workStatus = ce.workStatus;
    let statusClass = 'worktype-ope';
    let statusText = '勤務';
    
    if (workStatus) {
        statusClass = `worktype-${workStatus.workType.toLowerCase()}`;
        statusText = workStatus.workType;
    }
    
    return `
        <div class="ce-item ${statusClass} cursor-grab p-3 rounded-lg text-center font-medium" 
             draggable="true" data-ce-id="${ce.id}" data-ce-name="${ce.name}">
            <div class="text-sm font-bold">${ce.name}</div>
            <div class="text-xs mt-1">${statusText}</div>
        </div>
    `;
}

function setupDragAndDrop() {
    document.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleEventDrop);
        card.addEventListener('dragleave', handleDragLeave);
    });
    
    document.querySelectorAll('.assignment-dropzone').forEach(zone => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('drop', handleDepartmentDrop);
        zone.addEventListener('dragleave', handleDragLeave);
    });
}

function setupCEDragging() {
    document.querySelectorAll('.ce-item[draggable="true"]').forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });
}

function handleDragStart(e) {
    const ceId = e.target.dataset.ceId;
    const ceName = e.target.dataset.ceName;
    
    e.dataTransfer.setData('text/plain', JSON.stringify({
        ceId: ceId,
        ceName: ceName
    }));
    
    e.target.style.opacity = '0.5';
}

function handleDragEnd(e) {
    e.target.style.opacity = '1';
    
    document.querySelectorAll('.drag-over').forEach(element => {
        element.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.target.closest('.event-card, .assignment-dropzone')?.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.target.closest('.event-card, .assignment-dropzone')?.classList.remove('drag-over');
}

async function handleEventDrop(e) {
    e.preventDefault();
    e.target.classList.remove('drag-over');
    
    try {
        const ceData = JSON.parse(e.dataTransfer.getData('text/plain'));
        const eventCard = e.target.closest('.event-card');
        const eventId = eventCard?.dataset.eventId;
        
        if (eventId && ceData.ceId) {
            await assignCEToEvent(eventId, ceData.ceId, ceData.ceName);
        }
    } catch (error) {
        console.error('CE配置エラー:', error);
        if (window.showMessage) {
            window.showMessage('CE配置に失敗しました', 'error');
        }
    }
}

function handleDepartmentDrop(e) {
    e.preventDefault();
    e.target.classList.remove('drag-over');
    
    if (window.showMessage) {
        window.showMessage('新規イベント作成機能は準備中です', 'info');
    }
}

async function assignCEToEvent(eventId, ceId, ceName) {
    if (!window.database) {
        if (window.showMessage) {
            window.showMessage('データベースが利用できません', 'error');
        }
        return;
    }

    try {
        const dateKey = formatDateKey(currentDate);
        const eventRef = window.database.ref(`${window.DATA_ROOT}/events/${dateKey}/${eventId}`);
        
        const snapshot = await eventRef.once('value');
        const event = snapshot.val();
        
        if (!event) {
            if (window.showMessage) {
                window.showMessage('業務が見つかりません', 'error');
            }
            return;
        }
        
        const assignedCEs = event.assignedCEs || [];
        
        if (assignedCEs.some(ce => ce.id === ceId)) {
            if (window.showMessage) {
                window.showMessage('既に配置済みです', 'warning');
            }
            return;
        }
        
        const ceSnapshot = await window.database.ref(`${window.DATA_ROOT}/ces/${ceId}`).once('value');
        const ceData = ceSnapshot.val();
        
        if (!ceData) {
            if (window.showMessage) {
                window.showMessage('CE情報が見つかりません', 'error');
            }
            return;
        }
        
        const workStatus = scheduleResolver && scheduleResolver.isInitialized ? 
            await scheduleResolver.getCEWorkStatusForDate(ceId, dateKey) : null;
        
        const newCE = {
            id: ceId,
            name: ceName,
            workType: workStatus?.workType || 'A',
            assignedAt: firebase.database.ServerValue.TIMESTAMP
        };
        
        assignedCEs.push(newCE);
        
        await eventRef.update({ assignedCEs });
        
        if (activityLogger && activityLogger.isInitialized) {
            await activityLogger.logActivity('ce-assign', {
                eventTitle: event.title,
                department: event.department,
                ceNames: [ceName],
                date: dateKey
            });
        }
        
        updateScheduleDisplay();
        
        if (window.showMessage) {
            window.showMessage(`${ceName}を${event.title}に配置しました`, 'success');
        }
        
    } catch (error) {
        console.error('CE配置エラー:', error);
        if (window.showMessage) {
            window.showMessage('CE配置に失敗しました', 'error');
        }
    }
}

async function removeCEFromEvent(eventId, ceId) {
    if (!window.database) return;

    try {
        const dateKey = formatDateKey(currentDate);
        const eventRef = window.database.ref(`${window.DATA_ROOT}/events/${dateKey}/${eventId}`);
        
        const snapshot = await eventRef.once('value');
        const event = snapshot.val();
        
        if (!event) return;
        
        const assignedCEs = event.assignedCEs || [];
        const updatedCEs = assignedCEs.filter(ce => ce.id !== ceId);
        
        await eventRef.update({ assignedCEs: updatedCEs });
        
        const removedCE = assignedCEs.find(ce => ce.id === ceId);
        if (activityLogger && activityLogger.isInitialized && removedCE) {
            await activityLogger.logActivity('ce-unassign', {
                eventTitle: event.title,
                department: event.department,
                ceNames: [removedCE.name],
                date: dateKey
            });
        }
        
        updateScheduleDisplay();
        
        if (window.showMessage) {
            window.showMessage('CE配置を解除しました', 'success');
        }
        
    } catch (error) {
        console.error('CE配置解除エラー:', error);
        if (window.showMessage) {
            window.showMessage('CE配置解除に失敗しました', 'error');
        }
    }
}

// DOMContentLoaded イベントで初期化実行
document.addEventListener('DOMContentLoaded', initializeDashboard);

// グローバル関数公開（レガシー互換性のため）
window.openAnalyticsPage = window.openAnalysisPage;
window.removeCEFromEvent = removeCEFromEvent;
