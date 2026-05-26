/**
 * 公開勤務表連動システム
 */
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

    const globalCE = (window.ceManager?.ceList || []).find(c => c.id === ceId);
    const globalWorkType = globalCE?.workType || 'ME';

    // 該当日付を含む公開勤務表を抽出
    const relevantSchedules = this.publishedSchedules.filter(schedule => {
        const metadata = schedule.metadata || {};
        return dateKey >= metadata.startDate && dateKey <= metadata.endDate;
    });

    // 公開勤務表が無い場合 → ベース勤務区分
    if (relevantSchedules.length === 0) {
        if (globalCE) {
            return { status: 'A', workType: globalWorkType, desired: false };
        }
        return null;
    }

    // ★複数該当時: priority(大きいほど優先) → publishedAt(新しい順) で1件に絞る
    const schedule = relevantSchedules.sort((a, b) => {
        const pa = a.metadata?.priority ?? 0;
        const pb = b.metadata?.priority ?? 0;
        if (pa !== pb) return pb - pa;  // priority降順
        const ta = a.metadata?.publishedAt || 0;
        const tb = b.metadata?.publishedAt || 0;
        return tb - ta;                  // publishedAt降順
    })[0];

    console.log(`📋 採用勤務表: ${schedule.key} (priority=${schedule.metadata?.priority ?? 0}, 日付=${dateKey})`);

    const scheduleData = schedule.scheduleData || {};
    const workTypeOverrides = schedule.workTypeOverrides || {};
    const ceList = schedule.ceList || [];
    const dateOverrides = schedule.dateOverrides || {};

    // 公開勤務表 ceList に居なくてもグローバルCEで代替（関健宏もここで救済）
    let ce = ceList.find(c => c.id === ceId);
    if (!ce) {
        if (!globalCE) return null;
        ce = globalCE;
    }

    const workData = scheduleData[ceId]?.[dateKey];

    // workType解決の優先順位:
    //   1. workTypeOverrides（期間オーバーライド設定）★最優先
    //   2. workData.workType（scheduleData内のworkType）
    //   3. ce.workType（ベース勤務区分）
    const overrideWorkType = this.getEffectiveWorkType(ceId, dateKey, ce, workTypeOverrides);
    let effectiveWorkType;
    if (overrideWorkType && overrideWorkType !== (ce.workType || 'ME')) {
        effectiveWorkType = overrideWorkType;
    } else if (workData && workData.workType) {
        effectiveWorkType = workData.workType;
    } else {
        effectiveWorkType = overrideWorkType;
    }

    if (!workData) {
        const isHoliday = this.isWeekendOrHoliday(dateKey, dateOverrides);
        const defaultStatus = isHoliday ? '×' : 'A';
        const result = {
            status: defaultStatus,
            workType: effectiveWorkType,
            desired: false
        };
        this.cache.set(cacheKey, result);
        return result;
    }

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
        
        // 配列形式のオーバーライド
        if (Array.isArray(overrides)) {
            const validOverrides = overrides.filter(override => {
                if (!override || !override.startDate || !override.endDate) return false;
                return dateKey >= override.startDate && dateKey <= override.endDate;
            });
            if (validOverrides.length > 0) {
                // 最新のcreatedAt優先
                const latest = validOverrides.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
                console.log(`✅ workTypeOverride適用: ${ceId} ${dateKey} → ${latest.workType}`);
                return latest.workType;
            }
        } 
        // オブジェクト形式のオーバーライド（単一）
        else if (overrides && overrides.startDate && overrides.endDate) {
            if (dateKey >= overrides.startDate && dateKey <= overrides.endDate) {
                console.log(`✅ workTypeOverride適用: ${ceId} ${dateKey} → ${overrides.workType}`);
                return overrides.workType;
            }
        }
        
        return ce.workType || 'ME';
    }

    isWeekendOrHoliday(dateKey, dateOverrides = {}) {
        // オーバーライドチェック
        if (dateOverrides[dateKey] === 'holiday') {
            return true;
        }
        if (dateOverrides[dateKey] === 'workday') {
            return false;
        }
        
        // 日付パース
        const [year, month, day] = dateKey.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay();
        
        // 土日判定
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return true;
        }
        
        // 祝日判定（constants.jsから取得、またはハードコード）
        if (window.HOLIDAYS && window.HOLIDAYS.has && window.HOLIDAYS.has(dateKey)) {
            return true;
        }
        
        return false;
    }

setupRealtimeUpdates() {

    window.database.ref(`${window.DATA_ROOT}/workSchedules`).on('value', async () => {
        console.log('🔄 公開勤務表データ更新検知');
        this.cache.clear();  // ★追加: キャッシュ強制クリア
        await this.loadPublishedSchedules();
        
        if (window.ceManager && typeof window.ceManager.updateCEIconsFromSchedule === 'function') {
            window.ceManager.updateCEIconsFromSchedule();
        }
    });

    // ★追加: ceList変更時にもキャッシュクリア（新規CE追加に対応）
    window.database.ref(`${window.DATA_ROOT}/ceList`).on('value', () => {
        this.cache.clear();
        console.log('🔄 CE一覧更新検知（キャッシュクリア）');
    });
}

async applyCEStatusToList(dateKey) {
    const ceItems = document.querySelectorAll('#ceListContainer .ce-item');
    const ceMap = new Map((window.ceManager?.ceList || []).map(c => [c.id, c]));

    for (const item of ceItems) {
        const ceId = item.dataset.ceId;  // ★ idで突合（indexに依存しない）
        const ce = ceMap.get(ceId);
        if (!ce) continue;

        item.classList.remove('worktype-ope', 'worktype-me', 'worktype-hd', 'worktype-flex', 'worktype-error');
        item.querySelectorAll('.status-badge').forEach(badge => badge.remove());

        const workStatus = await this.getCEWorkStatusForDate(ceId, dateKey);
        const wt = (workStatus?.workType || ce.workType || 'ME');

        if (wt === 'ERROR') {
            item.classList.add('worktype-error');
        } else {
            item.classList.add(`worktype-${wt.toLowerCase()}`);
        }
        item.dataset.workType = wt;

        if (workStatus?.status && workStatus.status !== 'A') {
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
    }
}
}

window.PublishedScheduleResolver = PublishedScheduleResolver;
