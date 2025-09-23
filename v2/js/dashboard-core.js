/*
==========================================
📊 ダッシュボードコアモジュール
クラス・ユーティリティ群
==========================================
*/

// 祝日判定関数（簡易実装）
window.isJapaneseHoliday = function(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const fixedHolidays = [
        {month: 1, day: 1},   // 元日
        {month: 2, day: 11},  // 建国記念の日
        {month: 4, day: 29},  // 昭和の日
        {month: 5, day: 3},   // 憲法記念日
        {month: 5, day: 4},   // みどりの日
        {month: 5, day: 5},   // こどもの日
        {month: 8, day: 11},  // 山の日
        {month: 11, day: 3},  // 文化の日
        {month: 11, day: 23}, // 勤労感謝の日
    ];
    
    return fixedHolidays.some(h => h.month === month && h.day === day);
};

// ログアウト（監査ログ付き）
window.handleLogout = async () => {
    try {
        try {
            const entry = {
                action: 'logout',
                details: {},
                uid: window.currentUserData?.uid || null,
                username: window.currentUserData?.username || 'unknown',
                displayName: window.currentUserData?.displayName || 'unknown',
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                userAgent: navigator.userAgent.substring(0, 100)
            };
            await window.database.ref(`${window.DATA_ROOT}/auditLogs`).push(entry);
        } catch (logError) {
            console.warn('監査ログ記録失敗:', logError);
        }
        if (window.auth && window.auth.currentUser) {
            await window.auth.signOut();
        }
    } catch (error) {
        console.error('ログアウトエラー:', error);
    } finally {
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = 'index.html';
    }
};

// 分析ページ開く関数
window.openAnalysisPage = function(pageType) {
    if (pageType === 'department-timeline') {
        window.open('department-timeline.html', '_blank');
    } else {
        window.showMessage(`${pageType}機能は開発中です`, 'info');
    }
};

// 公開勤務表連動管理クラス
class PublishedScheduleResolver {
    constructor() {
        this.publishedSchedules = [];
        this.cache = new Map();
        this.init();
    }

    async init() {
        try {
            await window.waitForFirebase();
            await this.loadPublishedSchedules();
            this.setupRealtimeUpdates();
            console.log('✅ 公開勤務表連動システム初期化完了');
        } catch (error) {
            console.error('❌ 公開勤務表連動システム初期化エラー:', error);
        }
    }

    async loadPublishedSchedules() {
        try {
            const snapshot = await window.database.ref(`${window.DATA_ROOT}/workSchedules`).once('value');
            const data = snapshot.val() || {};
            
            this.publishedSchedules = Object.keys(data).map(periodKey => ({
                key: periodKey,
                ...data[periodKey]
            })).filter(schedule => {
                return window.userRole === 'admin' || (schedule.metadata?.isVisible !== false);
            }).sort((a, b) => (b.metadata?.publishedAt || 0) - (a.metadata?.publishedAt || 0));

            this.cache.clear();
            
            console.log(`✅ 公開勤務表読み込み完了: ${this.publishedSchedules.length}件`);
        } catch (error) {
            console.error('❌ 公開勤務表読み込みエラー:', error);
        }
    }

    async getCEWorkStatusForDate(ceId, dateKey) {
        const cacheKey = `${ceId}_${dateKey}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const relevantSchedules = this.publishedSchedules.filter(schedule => {
            const metadata = schedule.metadata || {};
            return dateKey >= metadata.startDate && dateKey <= metadata.endDate;
        });

        if (relevantSchedules.length === 0) {
            return null;
        }

        // 競合チェック
        if (relevantSchedules.length > 1) {
            const conflicts = this.checkConflicts(ceId, dateKey, relevantSchedules);
            if (conflicts.length > 0) {
                console.warn('⚠️ 勤務表競合検出:', conflicts);
                window.showMessage(`${dateKey}に勤務表の競合があります。管理者に確認を依頼してください。`, 'warning');
                return { status: '競合', workType: 'ERROR', desired: false };
            }
        }

        const schedule = relevantSchedules[0];
        const scheduleData = schedule.scheduleData || {};
        const workTypeOverrides = schedule.workTypeOverrides || {};
        const ceList = schedule.ceList || [];
        
        const ce = ceList.find(c => c.id === ceId);
        if (!ce) return null;

        const workData = scheduleData[ceId]?.[dateKey];
        if (!workData) return null;

        const result = {
            workType: workData.workType || '×',
            status: workData.status || 'normal',
            desired: workData.desired || false,
            source: 'published_schedule',
            scheduleKey: schedule.key
        };

        this.cache.set(cacheKey, result);
        return result;
    }

    checkConflicts(ceId, dateKey, schedules) {
        const conflicts = [];
        const workTypes = schedules.map(s => ({
            key: s.key,
            workType: s.scheduleData?.[ceId]?.[dateKey]?.workType || '×'
        })).filter(w => w.workType !== '×');

        if (workTypes.length > 1) {
            const uniqueWorkTypes = new Set(workTypes.map(w => w.workType));
            if (uniqueWorkTypes.size > 1) {
                conflicts.push({
                    ceId,
                    dateKey,
                    conflictingSchedules: workTypes
                });
            }
        }
        
        return conflicts;
    }

    setupRealtimeUpdates() {
        window.database.ref(`${window.DATA_ROOT}/workSchedules`).on('value', () => {
            setTimeout(() => this.loadPublishedSchedules(), 500);
        });
    }

    getScheduleStatus() {
        return {
            total: this.publishedSchedules.length,
            visible: this.publishedSchedules.filter(s => s.metadata?.isVisible !== false).length,
            cacheSize: this.cache.size
        };
    }
}

// 活動ログ管理クラス
class ActivityLogger {
    constructor() {
        this.activities = [];
        this.maxEntries = 100;
        this.init();
    }

    async init() {
        try {
            await window.waitForFirebase();
            await this.loadRecentActivities();
            this.setupRealtimeUpdates();
            console.log('✅ アクティビティログ初期化完了');
        } catch (error) {
            console.error('❌ アクティビティログ初期化エラー:', error);
        }
    }

    async loadRecentActivities() {
        try {
            const snapshot = await window.database.ref(`${window.DATA_ROOT}/auditLogs`)
                .orderByChild('timestamp')
                .limitToLast(this.maxEntries)
                .once('value');
            
            const data = snapshot.val() || {};
            this.activities = Object.keys(data)
                .map(key => ({ id: key, ...data[key] }))
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                
            console.log(`✅ アクティビティ読み込み完了: ${this.activities.length}件`);
        } catch (error) {
            console.error('❌ アクティビティ読み込みエラー:', error);
        }
    }

    setupRealtimeUpdates() {
        window.database.ref(`${window.DATA_ROOT}/auditLogs`)
            .orderByChild('timestamp')
            .limitToLast(10)
            .on('child_added', (snapshot) => {
                const activity = { id: snapshot.key, ...snapshot.val() };
                
                const exists = this.activities.some(a => a.id === activity.id);
                if (!exists) {
                    this.activities.unshift(activity);
                    
                    if (this.activities.length > this.maxEntries) {
                        this.activities = this.activities.slice(0, this.maxEntries);
                    }
                    
                    this.notifyNewActivity(activity);
                }
            });
    }

    notifyNewActivity(activity) {
        if (activity.uid !== window.currentUserData?.uid) {
            const actionMap = {
                'event-add': '業務が追加されました',
                'event-edit': '業務が編集されました',
                'ce-assign': 'CE配置が変更されました',
                'schedule-publish': '勤務表が公開されました'
            };
            
            const message = actionMap[activity.action] || '変更が行われました';
            
            if (window.showNotification) {
                window.showNotification(`${activity.displayName || 'ユーザー'}が${message}`, 'info', 3000);
            }
        }
    }

    async logActivity(action, details = {}) {
        try {
            const entry = {
                action,
                details,
                uid: window.currentUserData?.uid || null,
                username: window.currentUserData?.username || 'unknown',
                displayName: window.currentUserData?.displayName || 'unknown',
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                userAgent: navigator.userAgent.substring(0, 100)
            };
            
            await window.database.ref(`${window.DATA_ROOT}/auditLogs`).push(entry);
            
        } catch (error) {
            console.warn('アクティビティログ記録失敗:', error);
        }
    }

    getRecentActivities(limit = 20) {
        return this.activities.slice(0, limit);
    }

    getActivitiesByDate(dateKey) {
        return this.activities.filter(activity => {
            const date = new Date(activity.timestamp);
            const activityDate = date.toISOString().split('T')[0].replace(/-/g, '');
            return activityDate === dateKey;
        });
    }

    renderActivityLog(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const recentActivities = this.getRecentActivities(15);
        
        if (recentActivities.length === 0) {
            container.innerHTML = '<div class="text-gray-500 text-center py-4">アクティビティがありません</div>';
            return;
        }

        container.innerHTML = recentActivities.map(activity => {
            const date = new Date(activity.timestamp);
            const timeStr = date.toLocaleString('ja-JP');
            const actionName = this.getActionDisplayName(activity.action);
            
            return `
                <div class="activity-item ${activity.action}">
                    <div class="flex justify-between items-start">
                        <div>
                            <strong>${activity.displayName || 'ユーザー'}</strong>が
                            <span class="text-blue-600">${actionName}</span>
                        </div>
                        <i class="fas fa-${this.getActionIcon(activity.action)} text-gray-400"></i>
                    </div>
                    ${activity.details ? `<div class="text-xs mt-1">${this.formatActivityDetails(activity.details)}</div>` : ''}
                    <div class="activity-timestamp">${timeStr}</div>
                </div>
            `;
        }).join('');
    }

    getActionDisplayName(action) {
        const actionMap = {
            'login': 'ログイン',
            'logout': 'ログアウト',
            'event-add': '業務追加',
            'event-edit': '業務編集',
            'event-delete': '業務削除',
            'ce-assign': 'CE配置',
            'ce-unassign': 'CE配置解除',
            'schedule-publish': '勤務表公開',
            'schedule-edit': '勤務表編集'
        };
        return actionMap[action] || action;
    }

    getActionIcon(action) {
        const iconMap = {
            'login': 'sign-in-alt',
            'logout': 'sign-out-alt',
            'event-add': 'plus',
            'event-edit': 'edit',
            'event-delete': 'trash',
            'ce-assign': 'user-plus',
            'ce-unassign': 'user-minus',
            'schedule-publish': 'calendar-check',
            'schedule-edit': 'calendar-edit'
        };
        return iconMap[action] || 'info';
    }

    formatActivityDetails(details) {
        if (typeof details === 'string') return details;
        
        const parts = [];
        if (details.eventTitle) parts.push(`業務: ${details.eventTitle}`);
        if (details.department) parts.push(`部門: ${details.department}`);
        if (details.ceNames) parts.push(`CE: ${details.ceNames.join(', ')}`);
        if (details.dateRange) parts.push(`期間: ${details.dateRange}`);
        
        return parts.join(' | ') || JSON.stringify(details);
    }
}

// 勤務表ビューア管理クラス
class WorkScheduleViewer {
    constructor() {
        this.currentPeriodKey = null;
        this.scheduleData = null;
        this.ceList = [];
        this.init();
    }

    async init() {
        try {
            await window.waitForFirebase();
            await this.loadLatestSchedule();
            this.setupUI();
            console.log('✅ 勤務表ビューア初期化完了');
        } catch (error) {
            console.error('❌ 勤務表ビューア初期化エラー:', error);
        }
    }

    async loadLatestSchedule() {
        try {
            const snapshot = await window.database.ref(`${window.DATA_ROOT}/workSchedules`).once('value');
            const schedules = snapshot.val() || {};
            
            const scheduleList = Object.keys(schedules)
                .map(key => ({ key, ...schedules[key] }))
                .filter(s => window.userRole === 'admin' || s.metadata?.isVisible !== false)
                .sort((a, b) => (b.metadata?.publishedAt || 0) - (a.metadata?.publishedAt || 0));
            
            if (scheduleList.length > 0) {
                const latest = scheduleList[0];
                this.currentPeriodKey = latest.key;
                this.scheduleData = latest.scheduleData || {};
                this.ceList = latest.ceList || [];
                this.metadata = latest.metadata || {};
                
                this.updatePeriodDisplay();
                this.renderScheduleTable();
            } else {
                this.showEmptyState();
            }
            
        } catch (error) {
            console.error('❌ 勤務表読み込みエラー:', error);
            this.showErrorState();
        }
    }

    setupUI() {
        const editorBtn = document.getElementById('openScheduleEditorBtn');
        if (editorBtn) {
            editorBtn.addEventListener('click', () => {
                this.openScheduleEditor();
            });
        }
    }

    updatePeriodDisplay() {
        const display = document.getElementById('currentPeriodDisplay');
        if (display && this.metadata) {
            const startDate = this.formatDate(this.metadata.startDate);
            const endDate = this.formatDate(this.metadata.endDate);
            display.textContent = `${startDate} 〜 ${endDate}`;
        }
    }

    formatDate(dateStr) {
        if (!dateStr || dateStr.length !== 8) return dateStr;
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${year}年${parseInt(month)}月${parseInt(day)}日`;
    }

    renderScheduleTable() {
        const container = document.getElementById('workScheduleDisplayArea');
        if (!container) return;

        if (!this.scheduleData || Object.keys(this.scheduleData).length === 0) {
            this.showEmptyState();
            return;
        }

        // スケジュール表の生成
        const table = this.generateScheduleTable();
        
        container.innerHTML = `
            <div class="schedule-table-container">
                ${table}
            </div>
            <div class="schedule-actions mt-4 text-center">
                <button onclick="window.scheduleViewer.openScheduleEditor()" 
                        class="btn-unified btn-primary-unified mr-2">
                    <i class="fas fa-edit mr-1"></i>編集
                </button>
                <button onclick="window.scheduleViewer.exportSchedule()" 
                        class="btn-unified btn-outline-unified">
                    <i class="fas fa-download mr-1"></i>エクスポート
                </button>
            </div>
        `;
    }

    generateScheduleTable() {
        if (!this.metadata || !this.scheduleData) return '';

        // 日付範囲生成
        const dates = this.generateDateRange(this.metadata.startDate, this.metadata.endDate);
        
        // CEリストをソート
        const sortedCEs = [...this.ceList].sort((a, b) => a.name.localeCompare(b.name));

        let html = `
            <div class="schedule-table-wrapper">
                <table class="schedule-table">
                    <thead>
                        <tr>
                            <th class="ce-name-header">CE名</th>
                            ${dates.map(date => `
                                <th class="date-header">
                                    <div class="date-display">
                                        <div class="month-day">${this.formatDateShort(date)}</div>
                                        <div class="weekday">${this.getWeekday(date)}</div>
                                    </div>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        // CE別行生成
        for (const ce of sortedCEs) {
            html += `<tr class="ce-row">`;
            html += `<td class="ce-name-cell">${ce.name}</td>`;
            
            for (const date of dates) {
                const workData = this.scheduleData[ce.id]?.[date];
                const workType = workData?.workType || '×';
                const status = workData?.status || 'normal';
                
                html += `
                    <td class="work-cell work-type-${workType} status-${status}">
                        <span class="work-type-display">${workType}</span>
                    </td>
                `;
            }
            
            html += `</tr>`;
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;

        return html;
    }

    generateDateRange(startDate, endDate) {
        const dates = [];
        const start = new Date(
            parseInt(startDate.substring(0, 4)),
            parseInt(startDate.substring(4, 6)) - 1,
            parseInt(startDate.substring(6, 8))
        );
        const end = new Date(
            parseInt(endDate.substring(0, 4)),
            parseInt(endDate.substring(4, 6)) - 1,
            parseInt(endDate.substring(6, 8))
        );

        const current = new Date(start);
        while (current <= end) {
            const dateStr = current.toISOString().split('T')[0].replace(/-/g, '');
            dates.push(dateStr);
            current.setDate(current.getDate() + 1);
        }

        return dates;
    }

    formatDateShort(dateStr) {
        const month = parseInt(dateStr.substring(4, 6));
        const day = parseInt(dateStr.substring(6, 8));
        return `${month}/${day}`;
    }

    getWeekday(dateStr) {
        const date = new Date(
            parseInt(dateStr.substring(0, 4)),
            parseInt(dateStr.substring(4, 6)) - 1,
            parseInt(dateStr.substring(6, 8))
        );
        
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        return weekdays[date.getDay()];
    }

    showEmptyState() {
        const container = document.getElementById('workScheduleDisplayArea');
        if (!container) return;

        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-table text-4xl mb-4"></i>
                <h3 class="text-lg font-semibold mb-2">CE勤務表</h3>
                <p class="mb-4">作成済みの勤務表がここに表示されます</p>
                <button onclick="window.scheduleViewer.openScheduleEditor()" 
                        class="btn-unified btn-primary-unified">
                    <i class="fas fa-plus mr-2"></i>最初の勤務表を作成
                </button>
            </div>
        `;
    }

    showErrorState() {
        const container = document.getElementById('workScheduleDisplayArea');
        if (!container) return;

        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <h3 class="text-lg font-semibold mb-2">読み込みエラー</h3>
                <p class="mb-4">勤務表の読み込み中にエラーが発生しました</p>
                <button onclick="window.scheduleViewer.loadLatestSchedule()" 
                        class="btn-unified btn-outline-unified">
                    <i class="fas fa-redo mr-2"></i>再読み込み
                </button>
            </div>
        `;
    }

    openScheduleEditor() {
        window.open('work-schedule-editor.html', '_blank');
    }

    exportSchedule() {
        if (!this.scheduleData) {
            window.showMessage('エクスポートできる勤務表がありません', 'warning');
            return;
        }

        // CSV形式でエクスポート
        const csv = this.generateCSV();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `勤務表_${this.currentPeriodKey}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        window.showMessage('勤務表をエクスポートしました', 'success');
    }

    generateCSV() {
        if (!this.metadata || !this.scheduleData) return '';

        const dates = this.generateDateRange(this.metadata.startDate, this.metadata.endDate);
        const sortedCEs = [...this.ceList].sort((a, b) => a.name.localeCompare(b.name));

        // CSVヘッダー
        let csv = 'CE名,' + dates.map(date => this.formatDateShort(date)).join(',') + '\n';

        // CE別データ
        for (const ce of sortedCEs) {
            let row = `"${ce.name}",`;
            const workTypes = dates.map(date => {
                const workData = this.scheduleData[ce.id]?.[date];
                return workData?.workType || '×';
            });
            row += workTypes.join(',');
            csv += row + '\n';
        }

        return csv;
    }
}

// ダッシュボード認証管理クラス
class DashboardAuth {
    constructor() {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.userRole = 'user';
        this.init();
    }

    async init() {
        try {
            await window.waitForFirebase();
            this.setupAuthStateListener();
            console.log('✅ ダッシュボード認証初期化完了');
        } catch (error) {
            console.error('❌ ダッシュボード認証初期化エラー:', error);
            this.redirectToLogin();
        }
    }

    setupAuthStateListener() {
        window.auth.onAuthStateChanged(async (user) => {
            if (user) {
                await this.handleUserAuthenticated(user);
            } else {
                this.handleUserNotAuthenticated();
            }
        });
    }

    async handleUserAuthenticated(user) {
        try {
            // ユーザーデータ取得
            const userSnapshot = await window.database.ref(`${window.DATA_ROOT}/users/${user.uid}`).once('value');
            const userData = userSnapshot.val();

            if (!userData) {
                console.error('ユーザーデータが見つかりません');
                this.redirectToLogin();
                return;
            }

            this.isAuthenticated = true;
            this.currentUser = user;
            this.userRole = userData.role || 'user';

            // グローバル変数設定
            window.currentUserData = {
                uid: user.uid,
                username: userData.username,
                displayName: userData.displayName,
                role: userData.role
            };
            window.userRole = userData.role;

            // UI更新
            this.updateUserDisplay(userData);
            this.showMainInterface();

            // ログイン記録
            await this.logLogin();

            console.log(`✅ ユーザー認証完了: ${userData.displayName} (${userData.role})`);

        } catch (error) {
            console.error('❌ ユーザー認証処理エラー:', error);
            this.redirectToLogin();
        }
    }

    handleUserNotAuthenticated() {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.userRole = 'user';
        
        delete window.currentUserData;
        delete window.userRole;

        this.redirectToLogin();
    }

    updateUserDisplay(userData) {
        const display = document.getElementById('currentUserDisplay');
        if (display) {
            display.textContent = `${userData.displayName} (${userData.role})`;
        }
    }

    showMainInterface() {
        const loading = document.getElementById('loading');
        const mainInterface = document.getElementById('mainInterface');
        
        if (loading) loading.style.display = 'none';
        if (mainInterface) mainInterface.style.display = 'block';
    }

    redirectToLogin() {
        if (window.location.pathname !== '/index.html' && 
            !window.location.pathname.endsWith('index.html')) {
            window.location.href = 'index.html';
        }
    }

    async logLogin() {
        try {
            const entry = {
                action: 'login',
                details: {
                    loginMethod: 'dashboard',
                    userAgent: navigator.userAgent.substring(0, 100)
                },
                uid: this.currentUser.uid,
                username: window.currentUserData.username,
                displayName: window.currentUserData.displayName,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            await window.database.ref(`${window.DATA_ROOT}/auditLogs`).push(entry);
        } catch (error) {
            console.warn('ログイン記録失敗:', error);
        }
    }

    checkPermission(requiredRole = 'user') {
        if (!this.isAuthenticated) return false;
        
        const roleHierarchy = {
            'user': 0,
            'admin': 1
        };
        
        const userLevel = roleHierarchy[this.userRole] || 0;
        const requiredLevel = roleHierarchy[requiredRole] || 0;
        
        return userLevel >= requiredLevel;
    }
}

// ログイン管理ウィンドウ
window.openLoginManagement = async () => {
    if (!window.checkPermission('admin')) {
        window.showMessage('管理者権限が必要です', 'error');
        return;
    }
    
    const modal = window.createModal('ログイン管理', `
        <div class="space-y-4">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 class="font-bold text-blue-800 mb-2">現在のセッション状況</h3>
                <div id="currentSessionInfo">読み込み中...</div>
            </div>
            
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 class="font-bold text-yellow-800 mb-2">最近のログイン履歴</h3>
                <div id="recentLoginHistory" class="text-sm max-h-40 overflow-y-auto">
                    読み込み中...
                </div>
            </div>
            
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 class="font-bold text-red-800 mb-2">緊急操作</h3>
                <button onclick="forceLogoutAllUsers()" 
                        class="btn-unified btn-danger-unified w-full">
                    <i class="fas fa-sign-out-alt mr-2"></i>全ユーザー強制ログアウト
                </button>
                <p class="text-xs text-red-600 mt-2">
                    ⚠️ この操作により全てのユーザーが強制的にログアウトされます
                </p>
            </div>
        </div>
    `, 'large');

    // セッション情報表示
    await loadSessionInfo();
    await loadLoginHistory();
};

async function loadSessionInfo() {
    try {
        const container = document.getElementById('currentSessionInfo');
        if (!container) return;

        // オンラインユーザー数を取得（簡易実装）
        const usersSnapshot = await window.database.ref(`${window.DATA_ROOT}/users`).once('value');
        const users = usersSnapshot.val() || {};
        const totalUsers = Object.keys(users).length;

        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <div class="font-medium">総ユーザー数</div>
                    <div class="text-lg font-bold text-blue-600">${totalUsers}名</div>
                </div>
                <div>
                    <div class="font-medium">現在のセッション</div>
                    <div class="text-lg font-bold text-green-600">アクティブ</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('セッション情報読み込みエラー:', error);
    }
}

async function loadLoginHistory() {
    try {
        const container = document.getElementById('recentLoginHistory');
        if (!container) return;

        const snapshot = await window.database.ref(`${window.DATA_ROOT}/auditLogs`)
            .orderByChild('action')
            .equalTo('login')
            .limitToLast(10)
            .once('value');

        const logs = snapshot.val() || {};
        const loginEntries = Object.values(logs)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (loginEntries.length === 0) {
            container.innerHTML = '<div class="text-gray-500">ログイン履歴がありません</div>';
            return;
        }

        container.innerHTML = loginEntries.map(entry => {
            const date = new Date(entry.timestamp);
            const timeStr = date.toLocaleString('ja-JP');
            
            return `
                <div class="flex justify-between items-center py-1 border-b border-gray-200 last:border-b-0">
                    <div>
                        <strong>${entry.displayName}</strong>
                        <span class="text-xs text-gray-500">(${entry.username})</span>
                    </div>
                    <div class="text-xs text-gray-500">${timeStr}</div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('ログイン履歴読み込みエラー:', error);
    }
}

async function forceLogoutAllUsers() {
    if (!confirm('本当に全ユーザーを強制ログアウトしますか？\nこの操作は取り消せません。')) {
        return;
    }

    try {
        // 強制ログアウトフラグを設定
        await window.database.ref(`${window.DATA_ROOT}/system/forceLogout`).set({
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            executor: window.currentUserData.displayName
        });

        window.showMessage('全ユーザーに強制ログアウトを実行しました', 'success');
        
        // モーダルを閉じる
        document.getElementById('modalOverlay')?.remove();

    } catch (error) {
        console.error('強制ログアウト実行エラー:', error);
        window.showMessage('強制ログアウトの実行に失敗しました', 'error');
    }
}

// グローバル公開
window.PublishedScheduleResolver = PublishedScheduleResolver;
window.ActivityLogger = ActivityLogger;
window.WorkScheduleViewer = WorkScheduleViewer;
window.DashboardAuth = DashboardAuth;
