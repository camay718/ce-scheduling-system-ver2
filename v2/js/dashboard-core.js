// CEスケジュール管理システム V2 - Dashboard Core Classes
// 元のdashboard.htmlのコアクラス群を集約

console.log('[CORE] dashboard-core.js 読み込み開始');

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

        const effectiveWorkType = this.getEffectiveWorkType(ceId, dateKey, ce, workTypeOverrides);
        const status = workData.customText?.trim() || workData.status;
        
        const result = {
            status: status,
            workType: effectiveWorkType,
            desired: workData.desired || false
        };

        this.cache.set(cacheKey, result);
        return result;
    }

    checkConflicts(ceId, dateKey, schedules) {
        const statuses = schedules.map(schedule => {
            const scheduleData = schedule.scheduleData || {};
            const workData = scheduleData[ceId]?.[dateKey];
            return workData ? (workData.customText?.trim() || workData.status) : null;
        }).filter(status => status !== null);

        const uniqueStatuses = [...new Set(statuses)];
        return uniqueStatuses.length > 1 ? uniqueStatuses : [];
    }

    getEffectiveWorkType(ceId, dateKey, ce, workTypeOverrides) {
        const overrides = workTypeOverrides[ceId];
        if (Array.isArray(overrides)) {
            const validOverrides = overrides.filter(override => 
                dateKey >= override.startDate && dateKey <= override.endDate
            );
            if (validOverrides.length > 0) {
                const latest = validOverrides.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
                return latest.workType;
            }
        } else if (overrides && overrides.startDate && dateKey >= overrides.startDate && dateKey <= overrides.endDate) {
            return overrides.workType;
        }
        
        return ce.workType || 'ME';
    }

    setupRealtimeUpdates() {
        window.database.ref(`${window.DATA_ROOT}/workSchedules`).on('value', async () => {
            console.log('🔄 公開勤務表データ更新検知（連動システム）');
            await this.loadPublishedSchedules();
            
            if (window.ceManager && typeof window.ceManager.updateCEIconsFromSchedule === 'function') {
                window.ceManager.updateCEIconsFromSchedule();
            }
        });
    }

    async applyCEStatusToList(dateKey) {
        const ceItems = document.querySelectorAll('#ceListContainer .ce-item');
        const ceList = window.ceManager?.ceList || [];

        for (let i = 0; i < ceItems.length; i++) {
            const item = ceItems[i];
            const ce = ceList[i];
            if (!ce) continue;

            // 既存のクラスとバッジを削除
            item.classList.remove('worktype-ope', 'worktype-me', 'worktype-hd', 'worktype-flex', 'worktype-error');
            item.querySelectorAll('.status-badge').forEach(badge => badge.remove());

            const workStatus = await this.getCEWorkStatusForDate(ce.id, dateKey);
            
            if (workStatus) {
                if (workStatus.workType === 'ERROR') {
                    item.classList.add('worktype-error');
                } else {
                    item.classList.add(`worktype-${workStatus.workType.toLowerCase()}`);
                }
                
                if (workStatus.status && workStatus.status !== 'A') {
                    const badge = document.createElement('div');
                    badge.className = 'status-badge';
                    badge.textContent = workStatus.status;
                    
                    const statusColors = {
                        'A1': '#FF9800', 'B': '#9C27B0', '非': '#607D8B',
                        '×': '#F44336', '年': '#2196F3', '出': '#2196F3', '研': '#795548',
                        '競合': '#FF0000'
                    };
                    if (statusColors[workStatus.status]) {
                        badge.style.background = statusColors[workStatus.status];
                        badge.style.color = 'white';
                    }
                    
                    item.appendChild(badge);
                }
                
                item.dataset.workType = workStatus.workType;
            } else {
                item.classList.add(`worktype-${(ce.workType || 'ME').toLowerCase()}`);
                item.dataset.workType = ce.workType || 'ME';
            }
        }
    }
}

// 変更履歴管理クラス
class ActivityLogger {
    constructor() {
        this.logContainer = null;
        this.realtimeRef = null;
        this.realtimeCallback = null;
        this.maxLogs = 50;
    }

    init() {
        this.logContainer = document.getElementById('activityLogContainer');
        if (this.logContainer) {
            this.setupRealtimeListener();
        }
    }

    setupRealtimeListener() {
        if (this.realtimeRef && this.realtimeCallback) {
            this.realtimeRef.off('child_added', this.realtimeCallback);
        }

        this.realtimeRef = window.database.ref(`${window.DATA_ROOT}/auditLogs`).limitToLast(this.maxLogs);
        this.realtimeCallback = (snapshot) => {
            const logEntry = snapshot.val();
            if (logEntry) {
                this.displayLogEntry(logEntry);
            }
        };
        
        this.logContainer.innerHTML = '<div class="text-center py-4 text-gray-500"><i class="fas fa-spinner fa-spin"></i> 履歴を読み込み中...</div>';
        
        this.realtimeRef.on('child_added', this.realtimeCallback);
    }

    displayLogEntry(entry) {
        if (!this.logContainer) return;

        if (this.logContainer.querySelector('.fa-spinner')) {
            this.logContainer.innerHTML = '';
        }

        const logItem = document.createElement('div');
        logItem.className = `activity-item ${this.getActionClass(entry.action)}`;

        const timestamp = entry.timestamp ? 
            new Date(entry.timestamp).toLocaleString('ja-JP', {
                month: 'short', day: 'numeric', 
                hour: '2-digit', minute: '2-digit'
            }) : '不明';
        
        const user = entry.displayName || entry.username || '不明';
        const actionText = this.getActionText(entry);

        logItem.innerHTML = `
            <div class="font-medium">${actionText}</div>
            <div class="activity-timestamp">[${timestamp}] ${user}</div>
        `;

        if (this.logContainer.firstChild) {
            this.logContainer.insertBefore(logItem, this.logContainer.firstChild);
        } else {
            this.logContainer.appendChild(logItem);
        }

        while (this.logContainer.children.length > this.maxLogs) {
            this.logContainer.removeChild(this.logContainer.lastChild);
        }
    }

    getActionText(entry) {
        const actionMap = {
            'login': 'ログイン',
            'logout': 'ログアウト',
            'event-add': '業務追加',
            'event-edit': '業務編集',
            'event-delete': '業務削除',
            'ce-assign': 'CE配置',
            'ce-unassign': 'CE配置解除',
            'schedule-create': '勤務表作成',
            'schedule-edit': '勤務表編集',
            'schedule-publish': '勤務表公開'
        };

        const actionText = actionMap[entry.action] || entry.action || '不明な操作';
        
        if (entry.details) {
            const details = entry.details;
            if (details.eventName) return `${actionText}: ${details.eventName}`;
            if (details.ceName) return `${actionText}: ${details.ceName}`;
            if (details.description) return `${actionText}: ${details.description}`;
        }
        
        return actionText;
    }

    getActionClass(action) {
        const classMap = {
            'login': 'login',
            'logout': 'login',
            'event-add': 'event-add',
            'event-edit': 'event-add',
            'event-delete': 'event-add',
            'ce-assign': 'ce-assign',
            'ce-unassign': 'ce-assign',
            'schedule-create': 'schedule-edit',
            'schedule-edit': 'schedule-edit',
            'schedule-publish': 'schedule-edit'
        };
        
        return classMap[action] || '';
    }
}

// 勤務表ビューア
class WorkScheduleViewer {
    constructor() {
        this.currentPeriodIndex = 0;
        this.availablePeriods = [];
        this.realtimeListener = null;
        this.init();
    }

    async init() {
        try {
            await window.waitForFirebase();
            this.setupRealtimeListener();
            this.setupEventListeners();
            console.log('✅ 勤務区分表ビューアー初期化完了');
        } catch (error) {
            console.error('❌ 勤務区分表ビューアー初期化エラー:', error);
        }
    }

    setupRealtimeListener() {
        if (this.realtimeListener) {
            this.realtimeListener.off();
        }
        
        this.realtimeListener = window.database.ref(`${window.DATA_ROOT}/workSchedules`);
        this.realtimeListener.on('value', async () => {
            console.log('🔄 公開勤務表データ更新検知');
            await this.loadAvailablePeriods();
            this.displayCurrentPeriod();
        });
    }

    async loadAvailablePeriods() {
        try {
            const snapshot = await window.database.ref(`${window.DATA_ROOT}/workSchedules`).once('value');
            const data = snapshot.val() || {};
            
            this.availablePeriods = Object.keys(data)
                .map(periodKey => ({
                    key: periodKey,
                    ...data[periodKey].metadata
                }))
                .filter(period => {
                    return window.userRole === 'admin' || (period.isVisible !== false);
                })
                .sort((a, b) => (b.publishedAt || b.createdAt || 0) - (a.publishedAt || a.createdAt || 0));
            
            if (this.availablePeriods.length > 0) {
                if (this.currentPeriodIndex >= this.availablePeriods.length) {
                    this.currentPeriodIndex = 0;
                }
                this.displayCurrentPeriod();
            } else {
                this.displayNoPeriods();
            }
        } catch (error) {
            console.error('❌ 期間データ読み込みエラー:', error);
        }
    }

    setupEventListeners() {
        const editorBtn = document.getElementById('openScheduleEditorBtn');
        if (editorBtn) editorBtn.onclick = () => this.openScheduleEditor();
    }

    navigatePeriod(direction) {
        const newIndex = this.currentPeriodIndex + direction;
        
        if (newIndex < 0 || newIndex >= this.availablePeriods.length) {
            window.showMessage('これ以上の期間はありません', 'info');
            return;
        }
        
        this.currentPeriodIndex = newIndex;
        this.displayCurrentPeriod();
    }

    async displayCurrentPeriod() {
        const displayEl = document.getElementById('currentPeriodDisplay');
        const footerEl = document.getElementById('scheduleControlsFooter');
        
        if (this.availablePeriods.length === 0) {
            this.displayNoPeriods();
            return;
        }

        const currentPeriod = this.availablePeriods[this.currentPeriodIndex];
        
        if (displayEl) {
            const visibilityStatus = currentPeriod.isVisible === false ? ' (非公開)' : '';
            displayEl.innerHTML = `
                <div>${currentPeriod.startDate} ～ ${currentPeriod.endDate}${visibilityStatus}</div>
                <div class="text-sm text-gray-500">
                    (${this.currentPeriodIndex + 1}/${this.availablePeriods.length})
                </div>
            `;
        }

        await this.renderWorkScheduleTable(currentPeriod.key);
        
        if (footerEl) {
            footerEl.innerHTML = `
                <div class="controls-container">
                    <div class="navigation-controls">
                        <button class="btn-unified btn-outline-unified" onclick="window.workScheduleViewer.navigatePeriod(-1)">
                            <i class="fas fa-chevron-left mr-1"></i>前の期間
                        </button>
                        <button class="btn-unified btn-outline-unified" onclick="window.workScheduleViewer.navigatePeriod(1)">
                            次の期間<i class="fas fa-chevron-right ml-1"></i>
                        </button>
                    </div>
                    <div class="admin-controls-container">
                        ${this.renderAdminControls(currentPeriod)}
                    </div>
                </div>
            `;
        }
    }

    renderAdminControls(period) {
        const isAdmin = (
            window.userRole === 'admin' && 
            window.currentUserData && 
            window.currentUserData.role === 'admin'
        );
        
        if (!isAdmin) {
            return '';
        }
        
        return `
            <div class="admin-controls">
                <span class="admin-label">管理者操作:</span>
                <button onclick="window.workScheduleViewer.toggleVisibility('${period.key}')" 
                        class="btn-small ${period.isVisible === false ? 'bg-green-500' : 'bg-yellow-500'} text-white" 
                        title="表示/非表示切替">
                    <i class="fas fa-eye${period.isVisible === false ? '' : '-slash'}"></i>
                </button>
                <button onclick="window.workScheduleViewer.deleteSchedule('${period.key}')" 
                        class="btn-small bg-red-500 text-white" title="削除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }

    displayNoPeriods() {
        const displayEl = document.getElementById('currentPeriodDisplay');
        const areaEl = document.getElementById('workScheduleDisplayArea');
        const footerEl = document.getElementById('scheduleControlsFooter');
        
        if (displayEl) displayEl.textContent = '作成済みの期間なし';
        if (areaEl) {
            areaEl.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-calendar-plus text-4xl text-gray-400 mb-4"></i>
                    <h3 class="text-lg font-semibold text-gray-600 mb-2">CE勤務表</h3>
                    <p class="text-gray-500 mb-4">まだ勤務表が作成されていません</p>
                    <button onclick="document.getElementById('openScheduleEditorBtn').click()" 
                            class="btn-unified btn-primary-unified">
                        <i class="fas fa-plus mr-2"></i>最初の勤務表を作成
                    </button>
                </div>
            `;
        }
        if (footerEl) footerEl.innerHTML = '';
    }

    async renderWorkScheduleTable(periodKey) {
        const areaEl = document.getElementById('workScheduleDisplayArea');
        if (!areaEl) return;

        try {
            const snapshot = await window.database.ref(`${window.DATA_ROOT}/workSchedules/${periodKey}`).once('value');
            const periodData = snapshot.val();
            
            if (!periodData || !periodData.ceList) {
                areaEl.innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-exclamation-triangle text-4xl text-yellow-500 mb-4"></i>
                        <p class="text-gray-600">勤務表データまたはCEリストが見つかりません</p>
                    </div>
                `;
                return;
            }

            const scheduleData = periodData.scheduleData || {};
            const ceList = periodData.ceList;
            const workTypeOverrides = periodData.workTypeOverrides || {};
            const metadata = periodData.metadata || {};
            const dates = this.generateDateRange(new Date(metadata.startDate), new Date(metadata.endDate));

            areaEl.innerHTML = `
                <div class="work-schedule-table-wrapper">
                    <table class="work-schedule-table">
                        ${this.generateTableHTML(dates, scheduleData, ceList, workTypeOverrides)}
                    </table>
                </div>
            `;

        } catch (error) {
            console.error('❌ 勤務表表示エラー:', error);
            areaEl.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                    <p class="text-gray-600">勤務表の読み込みでエラーが発生しました</p>
                </div>
            `;
        }
    }

    getEffectiveWorkType(ceId, dateKey, ceList, workTypeOverrides) {
        const ce = ceList.find(c => c.id === ceId);
        if (!ce) return 'ME';

        const overrides = workTypeOverrides[ceId];
        if (Array.isArray(overrides)) {
            const validOverrides = overrides.filter(override => 
                dateKey >= override.startDate && dateKey <= override.endDate
            );
            if (validOverrides.length > 0) {
                const latest = validOverrides.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
                return latest.workType;
            }
        } else if (overrides && overrides.startDate && dateKey >= overrides.startDate && dateKey <= overrides.endDate) {
            return overrides.workType;
        }
        
        return ce.workType || 'ME';
    }

    generateTableHTML(dates, scheduleData, ceList, workTypeOverrides) {
        let html = '<thead><tr><th class="name-header">氏名</th>';
        
        dates.forEach(date => {
            const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const headerClass = isWeekend ? 'date-header weekend-header' : 'date-header';
            
            html += `
                <th class="${headerClass}">
                    <div>${date.getDate()}</div>
                    <div class="text-xs">${dayOfWeek}</div>
                </th>
            `;
        });
        
        const summaryHeaders = ['A', 'A1', 'B', '非', '×', '年', '出', '研', '休日数', '実勤務', '当直回数'];
        summaryHeaders.forEach(header => {
            html += `<th class="summary-header">${header}</th>`;
        });
        html += '</tr></thead>';
        
        html += '<tbody>';
        ceList.forEach(ce => {
            const fullName = ce.fullName || ce.name || '';
            html += `<tr><td class="name-cell">
                <div class="font-medium">${fullName}</div>
            </td>`;
            
            const summary = { A: 0, A1: 0, B: 0, non: 0, off: 0, year: 0, trip: 0, training: 0, holidays: 0, actual: 0, night: 0 };
            
            dates.forEach(date => {
                const dateKey = this.formatDate(date);
                const workData = scheduleData[ce.id]?.[dateKey] || {};
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const status = workData.customText?.trim() || workData.status || (isWeekend ? '×' : 'A');
                const desired = workData.desired || false;
                
                const effectiveWorkType = this.getEffectiveWorkType(ce.id, dateKey, ceList, workTypeOverrides);
                
                if (isWeekend) summary.holidays++;
                switch (workData.status || (isWeekend ? '×' : 'A')) {
                    case 'A': summary.A++; summary.actual++; break;
                    case 'A1': summary.A1++; summary.actual++; break;
                    case 'B': summary.B++; summary.actual++; summary.night++; break;
                    case '非': summary.non++; summary.actual++; break;
                    case '×': summary.off++; break;
                    case '年': summary.year++; summary.actual++; break;
                    case '出': summary.trip++; summary.actual++; break;
                    case '研': summary.training++; summary.actual++; break;
                }
                
                let cellClass = `work-cell type-${effectiveWorkType.toLowerCase()}`;
                if (workData.status) cellClass += ` status-${workData.status}`;
                if (desired) cellClass += ' desired';
                if (isWeekend) cellClass += ' holiday';
                
                html += `<td class="${cellClass}">${status}</td>`;
            });
            
            const summaryValues = [summary.A, summary.A1, summary.B, summary.non, summary.off, summary.year, summary.trip, summary.training, summary.holidays, summary.actual, summary.night];
            summaryValues.forEach(value => {
                html += `<td class="summary-cell">${value}</td>`;
            });
            
            html += '</tr>';
        });
        html += '</tbody>';

        html += '<tfoot>';
        const footerTypes = [
            { label: 'OPE(A)', filter: (effectiveType, status) => effectiveType === 'OPE' && status === 'A' },
            { label: 'OPE(A1)', filter: (effectiveType, status) => effectiveType === 'OPE' && status === 'A1' },
            { label: 'ME', filter: (effectiveType, status) => effectiveType === 'ME' && ['A', 'A1', 'B', '非', '年', '出', '研'].includes(status) },
            { label: 'HD', filter: (effectiveType, status) => effectiveType === 'HD' && ['A', 'A1', 'B', '非', '年', '出', '研'].includes(status) },
            { label: 'FLEX', filter: (effectiveType, status) => effectiveType === 'FLEX' && ['A', 'A1', 'B', '非', '年', '出', '研'].includes(status) },
            { label: '当直', filter: (effectiveType, status) => status === 'B', target: 1 },
            { label: '非番', filter: (effectiveType, status) => status === '非', target: 1 }
        ];

        footerTypes.forEach(type => {
            html += `<tr class="footer-summary-row"><th class="type-label">${type.label}</th>`;
            
            dates.forEach(date => {
                const dateKey = this.formatDate(date);
                let count = 0;
                ceList.forEach(ce => {
                    const workData = scheduleData[ce.id]?.[dateKey] || {};
                    const status = workData.status || (date.getDay() === 0 || date.getDay() === 6 ? '×' : 'A');
                    const effectiveType = this.getEffectiveWorkType(ce.id, dateKey, ceList, workTypeOverrides);
                    
                    if (type.filter(effectiveType, status)) {
                        count++;
                    }
                });
                
                const cellClass = type.target && count !== type.target ? 'warning-count' : '';
                html += `<td class="${cellClass}">${count}</td>`;
            });
            
            for (let i = 0; i < summaryHeaders.length; i++) {
                html += '<td></td>';
            }
            html += '</tr>';
        });
        
        html += '</tfoot>';
        return html;
    }

    async toggleVisibility(periodKey) {
        const isAdmin = (
            window.userRole === 'admin' && 
            window.currentUserData && 
            window.currentUserData.role === 'admin'
        );
        
        if (!isAdmin) {
            window.showMessage('管理者権限が必要です', 'warning');
            return;
        }

        try {
            const snapshot = await window.database.ref(`${window.DATA_ROOT}/workSchedules/${periodKey}/metadata`).once('value');
            const metadata = snapshot.val();
            
            const newVisibility = !(metadata?.isVisible !== false);
            await window.database.ref(`${window.DATA_ROOT}/workSchedules/${periodKey}/metadata/isVisible`).set(newVisibility);
            
            window.showMessage(`勤務表を${newVisibility ? '表示' : '非表示'}に設定しました`, 'success');
            
            await this.loadAvailablePeriods();
            
        } catch (error) {
            console.error('❌ 表示切替エラー:', error);
            window.showMessage('表示設定の変更に失敗しました', 'error');
        }
    }

    async deleteSchedule(periodKey) {
        const isAdmin = (
            window.userRole === 'admin' && 
            window.currentUserData && 
            window.currentUserData.role === 'admin'
        );
        
        if (!isAdmin) {
            window.showMessage('管理者権限が必要です', 'warning');
            return;
        }

        const period = this.availablePeriods.find(p => p.key === periodKey);
        if (!period) return;

        if (!confirm(`勤務表「${period.startDate} ～ ${period.endDate}」を完全に削除しますか？\n\nこの操作は元に戻せません。`)) {
            return;
        }

        try {
            await window.database.ref(`${window.DATA_ROOT}/workSchedules/${periodKey}`).remove();
            window.showMessage('勤務表を削除しました', 'success');
            
            await this.loadAvailablePeriods();
            
        } catch (error) {
            console.error('❌ 勤務表削除エラー:', error);
            window.showMessage('勤務表の削除に失敗しました', 'error');
        }
    }

    generateDateRange(startDate, endDate) {
        const dates = [];
        const current = new Date(startDate);
        
        while (current <= endDate) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        
        return dates;
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    openScheduleEditor() {
        if (window.userRole === 'viewer') {
            window.showMessage('編集権限がありません', 'warning');
            return;
        }
        
        const targetUID = sessionStorage.getItem('targetUID');
        const currentUsername = sessionStorage.getItem('currentUsername');
        
        if (!targetUID || !currentUsername) {
            window.showMessage('セッション情報が不足しています。再度ログインしてください。', 'error');
            return;
        }
        
        const params = new URLSearchParams({
            uid: targetUID,
            username: currentUsername,
            role: window.userRole,
            timestamp: Date.now()
        });
        
        const url = `pages/work-schedule-editor.html?${params.toString()}`;
        
        const win = window.open(url, 'workScheduleEditor', 'width=1400,height=900,scrollbars=yes,resizable=yes');
        
        if (!win || win.closed || typeof win.closed === 'undefined') {
            if (confirm('新しいタブで開けませんでした。同じタブで勤務表エディタを開きますか？')) {
                window.location.href = url;
            } else {
                window.showMessage('勤務表エディタを開くには、ポップアップを許可してください', 'warning');
            }
        } else {
            console.log('✅ 勤務表エディタを新しいタブで開きました');
        }
    }
}

// ログイン管理機能（将来の開発用）
window.openLoginManagement = function() {
    window.showMessage('ログイン管理機能は開発中です', 'info');
};

// 統一された分析ページ開く関数
function openAnalyticsPage(pageName) {
    console.log(`分析ページを開いています: ${pageName}`);
    
    // 認証チェック
    const targetUID = sessionStorage.getItem('targetUID');
    const currentUsername = sessionStorage.getItem('currentUsername');
    
    if (!targetUID || !currentUsername) {
        window.showMessage('認証が必要です。ログインしてからアクセスしてください。', 'warning');
        return;
    }
    
    // 権限チェック
    if (window.userRole === 'viewer') {
        window.showMessage('分析機能の利用には編集権限以上が必要です', 'warning');
        return;
    }
    
    try {
        // analyticsフォルダ内のHTMLファイルを新しいタブで開く
        const url = `analytics/${pageName}.html`;
        
        const newWindow = window.open(url, '_blank', 'noopener,noreferrer,width=1400,height=900,scrollbars=yes,resizable=yes');
        
        // ポップアップブロッカー対応
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            console.warn('ポップアップがブロックされました');
            if (confirm('ポップアップがブロックされています。同じタブで分析ページを開きますか？')) {
                window.location.href = url;
            } else {
                window.showMessage('分析ページを開くには、ポップアップを許可してください', 'warning');
            }
        } else {
            console.log('分析ページが正常に開かれました');
        }
    } catch (error) {
        console.error('分析ページを開くときにエラーが発生しました:', error);
        window.showMessage('分析ページを開くことができませんでした', 'error');
    }
}

// グローバル公開
window.PublishedScheduleResolver = PublishedScheduleResolver;
window.ActivityLogger = ActivityLogger;  
window.WorkScheduleViewer = WorkScheduleViewer;
window.openAnalyticsPage = openAnalyticsPage;

console.log('[CORE] dashboard-core.js 読み込み完了');
