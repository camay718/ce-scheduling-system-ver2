/**
 * 監査ログシステム - CEスケジュール管理システムv2
 * 全操作の記録と管理（actor解決強化版）
 */
class AuditLogger {
    constructor() {
        this.isEnabled = true;
        this.maxRetries = 2;
        this.retryDelay = 500;
    }

    /**
     * 現在の操作者情報を、複数ソースから安全に解決する
     * 優先順位: window.currentUserData > sessionStorage > localStorage.dashboardAuth
     */
    getActorInfo() {
        let dashboardAuth = {};
        try {
            dashboardAuth = JSON.parse(localStorage.getItem('dashboardAuth') || '{}');
        } catch (e) {
            dashboardAuth = {};
        }

        const uid =
            window.currentUserData?.uid ||
            sessionStorage.getItem('targetUID') ||
            dashboardAuth.uid ||
            'anonymous';

        const username =
            window.currentUserData?.username ||
            sessionStorage.getItem('currentUsername') ||
            dashboardAuth.username ||
            'unknown';

        const displayName =
            window.currentUserData?.displayName ||
            dashboardAuth.displayName ||
            username ||
            'unknown';

        const role =
            window.currentUserData?.role ||
            sessionStorage.getItem('userRole') ||
            dashboardAuth.role ||
            'viewer';

        return { uid, username, displayName, role };
    }

    /**
     * 監査ログエントリを記録
     */
    async logAction(action, details = {}, additionalData = {}) {
        if (!this.isEnabled || !window.database || !window.DATA_ROOT) {
            console.warn('⚠️ 監査ログ記録がスキップされました');
            return;
        }

        try {
            const actor = this.getActorInfo();

            const entry = {
                action: action,
                details: {
                    ...details,
                    page: this.getCurrentPage(),
                    ...additionalData
                },
                uid: actor.uid,
                username: actor.username,
                displayName: actor.displayName,
                role: actor.role,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                userAgent: navigator.userAgent.substring(0, 100)
            };

            // 重要操作は同期記録、その他は非同期記録
            const criticalActions = ['login', 'logout', 'user-create', 'user-delete', 'schedule-publish', 'template-delete'];

            if (criticalActions.includes(action)) {
                await this.writeLogEntry(entry);
            } else {
                setTimeout(() => {
                    this.writeLogEntry(entry).catch(error => {
                        console.warn('⚠️ 監査ログ記録失敗:', error.message);
                    });
                }, 50);
            }

            console.log('📝 監査ログ記録:', action, details, `by ${actor.displayName}`);

        } catch (error) {
            console.error('❌ 監査ログ記録エラー:', error);
        }
    }

    /**
     * ログエントリをFirebaseに書き込み（リトライ機能付き）
     */
    async writeLogEntry(entry, retryCount = 0) {
        try {
            await window.database.ref(`${window.DATA_ROOT}/auditLogs`).push(entry);
        } catch (error) {
            if (retryCount < this.maxRetries) {
                console.warn(`⚠️ 監査ログ書き込みリトライ (${retryCount + 1}/${this.maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.writeLogEntry(entry, retryCount + 1);
            } else {
                throw new Error(`監査ログ書き込み失敗: ${error.message}`);
            }
        }
    }

    getCurrentPage() {
        const path = window.location.pathname;
        return path.split('/').pop()?.replace('.html', '') || 'unknown';
    }

    // 便利メソッド群
    async logPageAccess(pageName) {
        await this.logAction('page-access', {
            pageName: pageName,
            referrer: document.referrer || 'direct'
        });
    }

    async logEventAction(action, eventData, dateKey = '') {
        await this.logAction(`event-${action}`, {
            eventName: eventData.name || 'unknown',
            department: eventData.department || 'unknown',
            dateKey: dateKey,
            eventId: eventData.id || 'unknown',
            requiredPeople: eventData.requiredPeople || 0,
            count: eventData.count || 0
        });
    }

    async logCEAssignment(action, ceData, contextData, dateKey = '') {
        await this.logAction(`ce-${action}`, {
            ceName: ceData.ceName || ceData.name || 'unknown',
            ceId: ceData.ceId || ceData.id || 'unknown',
            contextName: contextData.name || 'unknown',
            contextType: contextData.type || 'event',
            department: contextData.department || 'unknown',
            dateKey: dateKey,
            workType: ceData.workType || 'unknown'
        });
    }

    async logMonthlyTaskAction(action, taskData, dateKey = '') {
        await this.logAction(`monthly-${action}`, {
            taskName: taskData.name || 'unknown',
            department: taskData.department || 'unknown',
            yearMonth: taskData.yearMonth || 'unknown',
            dateKey: dateKey,
            goalCount: taskData.goalCount || 0,
            actualCount: taskData.actualCount || 0
        });
    }

    async logScheduleAction(action, scheduleData = {}) {
        await this.logAction(`schedule-${action}`, {
            targetMonth: scheduleData.targetMonth || 'unknown',
            affectedCEs: scheduleData.affectedCEs || 0,
            scheduleType: scheduleData.type || 'unknown',
            changes: scheduleData.changes || {}
        });
    }

    async logTemplateAction(action, data = {}) {
        // action: 'create' | 'rename' | 'delete' | 'apply' | 'reorder'
        await this.logAction(`template-${action}`, {
            department: data.department || 'unknown',
            templateId: data.templateId || data.id || '',
            name: data.name || '',
            dateKey: data.dateKey || '',
            added: data.added ?? null,
            skipped: data.skipped ?? null,
            startDate: data.startDate || '',
            endDate: data.endDate || '',
            totalDays: data.totalDays ?? null,
            totalAdded: data.totalAdded ?? null,
            totalSkipped: data.totalSkipped ?? null,
            items: data.items ?? null
        });
    }

    async logEventCopy(data = {}) {
        await this.logAction('event-copy', {
            name: data.name || '',
            from: data.from || data.srcDateKey || '',
            to: data.to || data.destDateKey || '',
            department: data.department || 'unknown'
        });
    }

    async logMonthlyTaskCopy(data = {}) {
        await this.logAction('monthly-task-copy', {
            name: data.name || '',
            fromYearMonth: data.fromYearMonth || '',
            toYearMonth: data.toYearMonth || '',
            department: data.department || 'unknown'
        });
    }
}

// グローバルインスタンス作成
window.auditLogger = new AuditLogger();
window.logAudit = (action, details, additionalData) => {
    return window.auditLogger.logAction(action, details, additionalData);
};

console.log('✅ 監査ログシステム初期化完了');
