/*
==========================================
📊 ダッシュボードメイン処理
初期化・イベントリスナー・UI操作・エントリーポイント
==========================================
*/

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
    if (isInitialized) return;

    try {
        console.log('📊 ダッシュボード初期化開始...');

        // Firebase準備待ち
        await window.waitForFirebase();

        // 認証管理初期化
        dashboardAuth = new DashboardAuth();
        
        // 他のコンポーネント初期化は認証後に実行
        await waitForAuthentication();

        // コアコンポーネント初期化
        scheduleResolver = new PublishedScheduleResolver();
        activityLogger = new ActivityLogger();
        scheduleViewer = new WorkScheduleViewer();

        // グローバル公開
        window.scheduleResolver = scheduleResolver;
        window.activityLogger = activityLogger;
        window.scheduleViewer = scheduleViewer;

        // UI初期化
        initializeUI();
        setupEventListeners();
        
        // 初期画面表示
        showDailySchedule();

        isInitialized = true;
        console.log('✅ ダッシュボード初期化完了');

    } catch (error) {
        console.error('❌ ダッシュボード初期化エラー:', error);
        document.getElementById('loading').innerHTML = `
            <div class="text-red-500 text-center">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <h3 class="text-lg font-bold mb-2">初期化エラー</h3>
                <p class="mb-4">ダッシュボードの初期化に失敗しました</p>
                <button onclick="location.reload()" class="btn-unified btn-primary-unified">
                    <i class="fas fa-redo mr-2"></i>再読み込み
                </button>
            </div>
        `;
    }
}

// 認証完了待ち
async function waitForAuthentication() {
    return new Promise((resolve) => {
        const checkAuth = () => {
            if (dashboardAuth.isAuthenticated) {
                resolve();
            } else {
                setTimeout(checkAuth, 100);
            }
        };
        checkAuth();
    });
}

// UI初期化
function initializeUI() {
    // 日付ピッカー初期化
    const datePicker = document.getElementById('scheduleDatePicker');
    if (datePicker) {
        datePicker.value = formatDateForInput(currentDate);
    }

    // サイドバー初期化
    initializeSidebar();
    
    // 同期状態初期化
    initializeSyncStatus();

    // レスポンシブ対応
    setupResponsiveUI();
}

// イベントリスナー設定
function setupEventListeners() {
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
}

// ビュー切り替え
function switchView(view, contentId) {
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
    const activeTab = document.querySelector(`[onclick*="${view}"], #${view}ScheduleTab, #${view}Tab`);
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
    switch(view) {
        case 'daily':
            updateScheduleDisplay();
            break;
        case 'schedule':
            if (scheduleViewer) {
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
    switchView('daily', 'dailyScheduleContent');
    updateScheduleDisplay();
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
        // タイトル更新
        updateScheduleTitle();

        // 日別集計更新
        await updateDailySummary();

        // 部門グリッド更新
        await updateDepartmentGrid();

        // CEリスト更新
        await updateCEList();

    } catch (error) {
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

    } catch (error) {
        console.error('❌ 日別集計更新エラー:', error);
    }
}

// 部門グリッド更新
async function updateDepartmentGrid() {
    const grid = document.getElementById('departmentGrid');
    if (!grid) return;

    try {
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
        
        // グリッド生成
        grid.innerHTML = Object.keys(departmentGroups).map(dept => 
            generateDepartmentSection(dept, departmentGroups[dept])
        ).join('');

        // ドラッグ&ドロップ設定
        setupDragAndDrop();

    } catch (error) {
        console.error('❌ 部門グリッド更新エラー:', error);
    }
}

// CEリスト更新
async function updateCEList() {
    const container = document.getElementById('ceListContainer');
    const countElement = document.getElementById('ceListCount');
    
    if (!container) return;

    try {
        const dateKey = formatDateKey(currentDate);
        
        // CE一覧取得
        const cesSnapshot = await window.database.ref(`${window.DATA_ROOT}/ces`).once('value');
        const ces = cesSnapshot.val() || {};
        
        const ceList = Object.keys(ces).map(id => ({ id, ...ces[id] }))
            .sort((a, b) => a.name.localeCompare(b.name));

        // 勤務状況取得
        const ceStatusPromises = ceList.map(async (ce) => {
            const workStatus = scheduleResolver ? 
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

    } catch (error) {
        console.error('❌ CEリスト更新エラー:', error);
    }
}

// 設定コンテンツ読み込み
function loadSettingsContent() {
    const container = document.getElementById('settingsContent');
    if (!container) return;

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
                               value="${window.currentUserData?.displayName || ''}" readonly>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">権限</label>
                        <input type="text" id="userRole" class="input-unified" 
                               value="${window.currentUserData?.role || ''}" readonly>
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
            ${window.userRole === 'admin' ? `
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

// 業務追加モーダル
function openAddEventModal() {
    if (window.eventManager) {
        const dateStr = formatDateKey(currentDate);
        window.eventManager.openEventModal(null, dateStr);
    }
}

// 一括追加モーダル
function openBulkAddModal() {
    if (window.eventManager) {
        window.eventManager.openBulkAddModal();
    }
}

// 月次業務モーダル
function openMonthlyTaskModal() {
    // 月次業務追加の実装
    window.showMessage('月次業務追加機能は準備中です', 'info');
}

// テンプレート保存
function saveTemplate() {
    window.showMessage('テンプレート保存機能は準備中です', 'info');
}

// テンプレート読み込み
function loadTemplate() {
    window.showMessage('テンプレート読み込み機能は準備中です', 'info');
}

// 変更履歴表示
function showActivityLog() {
    if (!activityLogger) return;

    const modal = window.createModal('変更履歴', `
        <div class="activity-log" id="activityLogContainer">
            読み込み中...
        </div>
    `, 'large');

    activityLogger.renderActivityLog('activityLogContainer');
}

// システムデータエクスポート
async function exportSystemData() {
    if (!window.checkPermission('admin')) {
        window.showMessage('管理者権限が必要です', 'error');
        return;
    }

    try {
        window.showMessage('データエクスポートを準備しています...', 'info');
        
        // システムデータの収集とエクスポートの実装
        // 現在は準備中メッセージ
        setTimeout(() => {
            window.showMessage('データエクスポート機能は準備中です', 'info');
        }, 1000);

    } catch (error) {
        console.error('データエクスポートエラー:', error);
        window.showMessage('データエクスポートに失敗しました', 'error');
    }
}

// キーボードショートカット設定
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + キー の組み合わせのみ処理
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

// ウィンドウリサイズ処理
function handleWindowResize() {
    // レスポンシブ対応の追加処理
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
    
    // 日別イベントをグループ化
    Object.values(events).forEach(event => {
        const dept = event.department || 'その他';
        if (!groups[dept]) groups[dept] = { events: [], monthlyTasks: [] };
        groups[dept].events.push(event);
    });
    
    // 月次業務をグループ化
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

// ドラッグ&ドロップ設定
function setupDragAndDrop() {
    // イベントカードのドロップゾーン設定
    document.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleEventDrop);
        card.addEventListener('dragleave', handleDragLeave);
    });
    
    // 部門のドロップゾーン設定
    document.querySelectorAll('.assignment-dropzone').forEach(zone => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('drop', handleDepartmentDrop);
        zone.addEventListener('dragleave', handleDragLeave);
    });
}

// CE のドラッグ設定
function setupCEDragging() {
    document.querySelectorAll('.ce-item[draggable="true"]').forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });
}

// ドラッグ開始
function handleDragStart(e) {
    const ceId = e.target.dataset.ceId;
    const ceName = e.target.dataset.ceName;
    
    e.dataTransfer.setData('text/plain', JSON.stringify({
        ceId: ceId,
        ceName: ceName
    }));
    
    e.target.style.opacity = '0.5';
}

// ドラッグ終了
function handleDragEnd(e) {
    e.target.style.opacity = '1';
    
    // ドラッグオーバー表示をリセット
    document.querySelectorAll('.drag-over').forEach(element => {
        element.classList.remove('drag-over');
    });
}

// ドラッグオーバー
function handleDragOver(e) {
    e.preventDefault();
    e.target.closest('.event-card, .assignment-dropzone')?.classList.add('drag-over');
}

// ドラッグ離脱
function handleDragLeave(e) {
    e.target.closest('.event-card, .assignment-dropzone')?.classList.remove('drag-over');
}

// イベントカードドロップ
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
        window.showMessage('CE配置に失敗しました', 'error');
    }
}

// 部門ドロップ
function handleDepartmentDrop(e) {
    e.preventDefault();
    e.target.classList.remove('drag-over');
    
    // 部門への直接ドロップは新規イベント作成として処理
    window.showMessage('新規イベント作成機能は準備中です', 'info');
}

// CEを業務に配置
async function assignCEToEvent(eventId, ceId, ceName) {
    try {
        const dateKey = formatDateKey(currentDate);
        const eventRef = window.database.ref(`${window.DATA_ROOT}/events/${dateKey}/${eventId}`);
        
        // 現在の配置情報を取得
        const snapshot = await eventRef.once('value');
        const event = snapshot.val();
        
        if (!event) {
            window.showMessage('業務が見つかりません', 'error');
            return;
        }
        
        const assignedCEs = event.assignedCEs || [];
        
        // 重複チェック
        if (assignedCEs.some(ce => ce.id === ceId)) {
            window.showMessage('既に配置済みです', 'warning');
            return;
        }
        
        // CE情報取得
        const ceSnapshot = await window.database.ref(`${window.DATA_ROOT}/ces/${ceId}`).once('value');
        const ceData = ceSnapshot.val();
        
        if (!ceData) {
            window.showMessage('CE情報が見つかりません', 'error');
            return;
        }
        
        // 勤務状況チェック
        const workStatus = scheduleResolver ? 
            await scheduleResolver.getCEWorkStatusForDate(ceId, dateKey) : null;
        
        // 新しいCE情報を追加
        const newCE = {
            id: ceId,
            name: ceName,
            workType: workStatus?.workType || 'A',
            assignedAt: firebase.database.ServerValue.TIMESTAMP
        };
        
        assignedCEs.push(newCE);
        
        // データベース更新
        await eventRef.update({ assignedCEs });
        
        // アクティビティログ
        if (activityLogger) {
            await activityLogger.logActivity('ce-assign', {
                eventTitle: event.title,
                department: event.department,
                ceNames: [ceName],
                date: dateKey
            });
        }
        
        // UI更新
        updateScheduleDisplay();
        
        window.showMessage(`${ceName}を${event.title}に配置しました`, 'success');
        
    } catch (error) {
        console.error('CE配置エラー:', error);
        window.showMessage('CE配置に失敗しました', 'error');
    }
}

// CEを業務から除去
async function removeCEFromEvent(eventId, ceId) {
    try {
        const dateKey = formatDateKey(currentDate);
        const eventRef = window.database.ref(`${window.DATA_ROOT}/events/${dateKey}/${eventId}`);
        
        const snapshot = await eventRef.once('value');
        const event = snapshot.val();
        
        if (!event) return;
        
        const assignedCEs = event.assignedCEs || [];
        const updatedCEs = assignedCEs.filter(ce => ce.id !== ceId);
        
        await eventRef.update({ assignedCEs: updatedCEs });
        
        // アクティビティログ
        const removedCE = assignedCEs.find(ce => ce.id === ceId);
        if (activityLogger && removedCE) {
            await activityLogger.logActivity('ce-unassign', {
                eventTitle: event.title,
                department: event.department,
                ceNames: [removedCE.name],
                date: dateKey
            });
        }
        
        updateScheduleDisplay();
        window.showMessage('CE配置を解除しました', 'success');
        
    } catch (error) {
        console.error('CE配置解除エラー:', error);
        window.showMessage('CE配置解除に失敗しました', 'error');
    }
}

// DOMContentLoaded イベントで初期化実行
document.addEventListener('DOMContentLoaded', initializeDashboard);

// グローバル関数公開（レガシー互換性のため）
window.openAnalyticsPage = window.openAnalysisPage;
window.removeCEFromEvent = removeCEFromEvent;
