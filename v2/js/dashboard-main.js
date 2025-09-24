// CEスケジュール管理システム V2 - Dashboard Main Controller
// 元のdashboard.htmlのメイン処理・UI制御・認証システム

console.log('[MAIN] dashboard-main.js 読み込み開始');

// ダッシュボード認証・メイン制御
class DashboardAuth {
    constructor() {
        this.isInitialized = false;
        this.selectedDate = new Date();
        this.monthlyTasks = {};
        this.eventsRef = null;
        this.eventsCallback = null;
        this.monthlyRef = null;
        this.monthlyCallback = null;
    }

    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        try {
            await window.waitForFirebase();
            await this.checkAuthWithRetry();
        } catch (error) {
            console.error('初期化エラー:', error);
            this.redirectToLogin();
        }
    }

    async checkAuthWithRetry(maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const targetUID = sessionStorage.getItem('targetUID');
                const currentUsername = sessionStorage.getItem('currentUsername');
                if (!targetUID || !currentUsername) {
                    this.redirectToLogin();
                    return;
                }
                await this.ensureAnonymousAuth();
                
                const userSnapshot = await window.database.ref(`${window.DATA_ROOT}/users/${targetUID}`).once('value');
                const userData = userSnapshot.val();
                
                if (userData && userData.setupCompleted) {
                    window.userRole = userData.role || 'viewer';
                    window.currentUserData = userData;
                    this.showDashboard();
                    return;
                } else {
                    this.redirectToLogin();
                    return;
                }
            } catch (error) {
                if (attempt === maxRetries) {
                    this.redirectToLogin();
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    async ensureAnonymousAuth() {
        let user = window.auth.currentUser;
        if (!user) {
            const result = await window.auth.signInAnonymously();
            user = result.user;
        }
        return user;
    }

    redirectToLogin() {
        sessionStorage.clear();
        window.location.href = 'index.html';
    }

    setupRealtimeUpdates() {
        const updateEvents = () => {
            const dateKey = this.formatDate(this.selectedDate);
            
            if (this.eventsRef && this.eventsCallback) {
                this.eventsRef.off('value', this.eventsCallback);
            }
            
            this.eventsRef = window.database.ref(`${window.DATA_ROOT}/events/byDate/${dateKey}`);
            this.eventsCallback = (snapshot) => {
                console.log('🔄 イベントデータ更新検知');
                setTimeout(() => {
                    this.loadAndRenderEventsForSelectedDate();
                }, 300);
            };
            this.eventsRef.on('value', this.eventsCallback);

            // 月次業務のリアルタイム更新
            const yearMonth = dateKey.substring(0, 7);
            if (this.monthlyRef && this.monthlyCallback) {
                this.monthlyRef.off('value', this.monthlyCallback);
            }
            
            this.monthlyRef = window.database.ref(`${window.DATA_ROOT}/monthlyTasks/${yearMonth}`);
            this.monthlyCallback = async (snapshot) => {
                console.log('🔄 月次業務データ更新検知:', yearMonth);
                const data = snapshot.val() || {};
                this.monthlyTasks[yearMonth] = data;
                
                await this.renderMonthlyTasks();
                this.updateDailySummary().catch(console.error);
            };
            this.monthlyRef.on('value', this.monthlyCallback);
        };
        
        updateEvents();
        
        const originalRenderSchedule = this.renderDailySchedule.bind(this);
        this.renderDailySchedule = function() {
            originalRenderSchedule();
            updateEvents();
        };
    }

    async loadAndRenderEventsForSelectedDate() {
        const grid = document.getElementById('departmentGrid');
        if (!grid) return;

        const dateKey = this.formatDate(this.selectedDate);
        try {
            const snap = await window.database.ref(`${window.DATA_ROOT}/events/byDate/${dateKey}`).once('value');
            const eventsById = snap.val() || {};
            const events = Object.values(eventsById);

            // 既存のイベントカードをクリア
            grid.querySelectorAll('.task-list').forEach(el => {
                el.querySelectorAll('.event-card').forEach(card => card.remove());
            });

            // イベントを部門ごとに表示
            for (const ev of events) {
                const section = grid.querySelector(`.task-list[data-department="${ev.department}"]`);
                if (!section) continue;

                const item = document.createElement('div');
                item.className = 'glass-card p-3 mb-2 rounded-lg shadow-sm event-card';
                item.dataset.eventId = ev.id;
                item.dataset.dateKey = dateKey;
                item.dataset.department = ev.department;

                // ドロップイベントリスナー
                item.addEventListener('dragover', (e) => this.handleEventDragOver(e));
                item.addEventListener('dragleave', (e) => this.handleEventDragLeave(e));
                item.addEventListener('drop', (e) => this.handleEventDrop(e));

                const timeText = (ev.startTime && ev.endTime) ? ` ${ev.startTime}-${ev.endTime}` : '';

                // assignedCEsの互換処理
                const assignedList = Array.isArray(ev.assignedCEs) ? ev.assignedCEs : [];
                const normalizedAssigned = assignedList.map(entry => {
                    if (typeof entry === 'string') {
                        const ce = window.ceManager?.ceList?.find(c => c.id === entry);
                        return ce ? { 
                            id: ce.id, 
                            name: ce.iconName || ce.displayName || ce.name, 
                            workType: ce.workType || 'ME' 
                        } : { id: entry, name: entry, workType: 'ME' };
                    } else if (entry && typeof entry === 'object') {
                        return { 
                            id: entry.id, 
                            name: entry.name, 
                            workType: entry.workType || 'ME' 
                        };
                    }
                    return null;
                }).filter(Boolean);

                const assignedCount = normalizedAssigned.length;
                const need = Number.isFinite(ev.requiredPeople) ? ev.requiredPeople : 0;

                // 配置済みCEチップの生成（勤務区分連動）
                const assignedCEChips = [];
                for (const assigned of normalizedAssigned) {
                    let effectiveWorkType = assigned.workType || 'ME';
                    
                    // 勤務表連動で実際の勤務区分を取得
                    if (window.publishedScheduleResolver) {
                        try {
                            const workStatus = await window.publishedScheduleResolver.getCEWorkStatusForDate(assigned.id, dateKey);
                            if (workStatus && workStatus.workType) {
                                effectiveWorkType = workStatus.workType;
                            }
                        } catch (statusError) {
                            console.warn('⚠️ 勤務状態取得失敗:', assigned.name, statusError);
                        }
                    }
                    
                    assignedCEChips.push(`
                        <span class="ce-chip worktype-${effectiveWorkType.toLowerCase()}" data-ce-id="${assigned.id}" title="${assigned.name}">
                            ${assigned.name}
                            ${window.userRole !== 'viewer' ? `<i class="fas fa-times remove-ce" title="配置解除"></i>` : ''}
                        </span>
                    `);
                }

                const assignedCEChipsHtml = assignedCEChips.join('');

                // 予定件数の表示
                const countDisplay = Number.isFinite(ev.count) && ev.count > 0 ? 
                    `<div class="event-count-display">予定件数: ${ev.count}件</div>` : '';

                item.innerHTML = `
                    <div class="flex justify-between items-center mb-2">
                        <div class="font-semibold text-sm">
                            <i class="fas fa-briefcase mr-1"></i>${ev.name}${timeText}
                        </div>
                        <div class="text-xs text-gray-500">${assignedCount}/${need}名</div>
                    </div>
                    ${countDisplay}
                    ${ev.description ? `<div class="text-xs text-gray-600 mb-2">${ev.description}</div>` : ''}
                    <div class="assigned-ces">
                        ${assignedCEChipsHtml}
                    </div>
                    <div class="text-xs text-gray-400 mt-2 italic">CEをドラッグ&ドロップで配置</div>
                    ${window.userRole !== 'viewer' ? `<button class="edit-event-btn text-blue-600 hover:text-blue-800 text-xs mt-2">
                        <i class="fas fa-edit mr-1"></i>編集
                    </button>` : ''}
                `;

                // 編集ボタンのイベント
                const editBtn = item.querySelector('.edit-event-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.openEditEventModal(dateKey, ev.id, ev);
                    });
                }

                // 配置解除ボタンのイベント
                const removeButtons = item.querySelectorAll('.remove-ce');
                removeButtons.forEach(removeBtn => {
                    removeBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const chip = e.currentTarget.closest('.ce-chip');
                        const ceId = chip?.dataset?.ceId;
                        if (ceId) {
                            await this.unassignCE(dateKey, ev.id, ceId);
                        }
                    });
                });

                section.appendChild(item);
            }

            // CEアイテムにドラッグ機能を有効化
            setTimeout(() => {
                this.enableCEDragging();
            }, 100);

            // 月次業務の表示
            await this.renderMonthlyTasks();

            // 集計の更新
            this.updateDailySummary().catch(console.error);
            console.log(`✅ ${dateKey} のイベント表示完了: ${events.length}件`);

        } catch (error) {
            console.error('❌ 日別イベント読み込みエラー:', error);
            window.showMessage('イベントの読み込みに失敗しました', 'error');
        }
    }

    // 月次業務表示（async化）
    async renderMonthlyTasks() {
        const grid = document.getElementById('departmentGrid');
        if (!grid) return;

        const dateKey = this.formatDate(this.selectedDate);
        const yearMonth = dateKey.substring(0, 7);
        const monthlyData = this.monthlyTasks[yearMonth] || {};

        console.log('🔄 月次業務表示処理:', { dateKey, yearMonth, monthlyData });

        // 既存の月次業務カードをクリア
        grid.querySelectorAll('.monthly-plans').forEach(el => {
            el.innerHTML = '';
        });

        // データが存在するかチェック
        const taskList = Object.values(monthlyData);
        if (taskList.length === 0) {
            console.log('📭 月次業務データなし:', yearMonth);
            return;
        }

        console.log('📋 月次業務一覧:', taskList);

        for (const task of taskList) {
            // 無効なタスクをスキップ
            if (!task || !task.department || !task.name) {
                console.warn('⚠️ 無効な月次業務データ:', task);
                continue;
            }
            
            const section = grid.querySelector(`.monthly-plans[data-department="${task.department}"]`);
            if (!section) continue;

            const currentCount = task.actualCount || 0;
            const goalCount = task.goalCount || 0;
            const progressPercent = goalCount > 0 ? Math.min((currentCount / goalCount) * 100, 100) : 0;
            const remaining = Math.max(0, goalCount - currentCount);

            // assignedCEsの処理
            const assignedList = Array.isArray(task.assignedCEs) ? task.assignedCEs : [];
            const normalizedAssigned = assignedList.map(entry => {
                if (typeof entry === 'string') {
                    const ce = window.ceManager?.ceList?.find(c => c.id === entry);
                    return ce ? { 
                        id: ce.id, 
                        name: ce.iconName || ce.displayName || ce.name, 
                        workType: ce.workType || 'ME' 
                    } : { id: entry, name: entry, workType: 'ME' };
                } else if (entry && typeof entry === 'object') {
                    return { 
                        id: entry.id, 
                        name: entry.name, 
                        workType: entry.workType || 'ME' 
                    };
                }
                return null;
            }).filter(Boolean);

            const assignedCount = normalizedAssigned.length;
            const needCount = task.requiredPeople || 0;

            // 部門色の取得
            const deptColor = window.DEPARTMENT_COLORS?.[task.department] || '#6b7280';

            // 月次業務のCEチップも勤務区分連動
            const assignedCEChips = [];
            for (const assigned of normalizedAssigned) {
                let effectiveWorkType = assigned.workType || 'ME';
                
                // 勤務表連動で実際の勤務区分を取得
                if (window.publishedScheduleResolver) {
                    try {
                        const workStatus = await window.publishedScheduleResolver.getCEWorkStatusForDate(assigned.id, dateKey);
                        if (workStatus && workStatus.workType) {
                            effectiveWorkType = workStatus.workType;
                        }
                    } catch (statusError) {
                        console.warn('⚠️ 月次業務勤務状態取得失敗:', assigned.name, statusError);
                    }
                }
                
                assignedCEChips.push(`
                    <span class="ce-chip worktype-${effectiveWorkType.toLowerCase()}" data-ce-id="${assigned.id}" title="${assigned.name}">
                        ${assigned.name}
                        ${window.userRole !== 'viewer' ? `<i class="fas fa-times remove-ce" title="配置解除"></i>` : ''}
                    </span>
                `);
            }

            const assignedCEChipsHtml = assignedCEChips.join('');

            const monthlyCard = document.createElement('div');
            monthlyCard.className = 'monthly-task-card';
            monthlyCard.style.background = `linear-gradient(135deg, ${deptColor}15, ${deptColor}05)`;
            monthlyCard.style.borderColor = `${deptColor}40`;
            monthlyCard.dataset.taskId = task.id;
            monthlyCard.dataset.yearMonth = yearMonth;
            monthlyCard.dataset.department = task.department;

            // ドロップイベントリスナー
            monthlyCard.addEventListener('dragover', (e) => this.handleMonthlyTaskDragOver(e));
            monthlyCard.addEventListener('dragleave', (e) => this.handleMonthlyTaskDragLeave(e));
            monthlyCard.addEventListener('drop', (e) => this.handleMonthlyTaskDrop(e));

            monthlyCard.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <div class="font-semibold text-sm">
                        <i class="fas fa-calendar-alt mr-1" style="color: ${deptColor}"></i>${task.name}
                    </div>
                    <div class="text-xs text-gray-600">${assignedCount}/${needCount}名</div>
                </div>
                <div class="flex justify-between text-xs text-gray-600 mb-2">
                    <span>目標: ${goalCount}件</span>
                    <span>実施: ${currentCount}件</span>
                    <span>残: ${remaining}件</span>
                </div>
                <div class="monthly-progress-bar">
                    <div class="monthly-progress-fill" style="width: ${progressPercent}%; background: ${deptColor}"></div>
                </div>
                <div class="assigned-ces">
                    ${assignedCEChipsHtml}
                </div>
                <div class="monthly-input-section">
                    <span>実施入力:</span>
                    <input type="number" class="actual-input" value="${currentCount}" min="0" max="999">
                    ${window.userRole !== 'viewer' ? `<button class="btn-unified btn-outline-unified save-actual-btn">保存</button>` : ''}
                    ${window.userRole !== 'viewer' ? `<button class="edit-monthly-btn text-blue-600 hover:text-blue-800 text-xs">
                        <i class="fas fa-edit"></i>
                    </button>` : ''}
                </div>
                <div class="text-xs text-gray-400 mt-1 italic">CEをドラッグ&ドロップで配置</div>
            `;

            // 実施入力保存のイベント
            const saveBtn = monthlyCard.querySelector('.save-actual-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const input = monthlyCard.querySelector('.actual-input');
                    const newCount = parseInt(input.value) || 0;
                    await this.updateMonthlyTaskActual(yearMonth, task.id, newCount);
                });
            }

            // 編集ボタンのイベント
            const editBtn = monthlyCard.querySelector('.edit-monthly-btn');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openEditMonthlyTaskModal(yearMonth, task.id, task);
                });
            }

            // 配置解除ボタンのイベント
            const removeButtons = monthlyCard.querySelectorAll('.remove-ce');
            removeButtons.forEach(removeBtn => {
                removeBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const chip = e.currentTarget.closest('.ce-chip');
                    const ceId = chip?.dataset?.ceId;
                    if (ceId) {
                        await this.unassignCEFromMonthlyTask(yearMonth, task.id, ceId);
                    }
                });
            });

            section.appendChild(monthlyCard);
        }

        console.log(`✅ ${yearMonth} の月次業務表示完了`);
    }

    async updateDailySummary() {
        const dateKey = this.formatDate(this.selectedDate);
        
        // 通常業務の集計
        const eventCards = document.querySelectorAll('.event-card');
        let totalEvents = eventCards.length;
        let totalRequired = 0;
        let totalAssigned = 0;

        eventCards.forEach(card => {
            const assignedText = card.querySelector('.flex .text-xs')?.textContent || '0/0名';
            const match = assignedText.match(/(\d+)\/(\d+)名/);
            if (match) {
                totalAssigned += parseInt(match[1]) || 0;
                totalRequired += parseInt(match[2]) || 0;
            }
        });

        // 月次業務の集計
        const monthlyCards = document.querySelectorAll('.monthly-task-card');
        totalEvents += monthlyCards.length;

        monthlyCards.forEach(card => {
            const assignedText = card.querySelector('.flex .text-xs')?.textContent || '0/0名';
            const match = assignedText.match(/(\d+)\/(\d+)名/);
            if (match) {
                totalAssigned += parseInt(match[1]) || 0;
                totalRequired += parseInt(match[2]) || 0;
            }
        });

        // 配置可能人数の計算（勤務状態がA、A1、Bの人数）
        let totalAvailable = 0;
        if (window.ceManager?.ceList && window.publishedScheduleResolver) {
            for (const ce of window.ceManager.ceList) {
                const workStatus = await window.publishedScheduleResolver.getCEWorkStatusForDate(ce.id, dateKey);
                if (workStatus && ['A', 'A1', 'B'].includes(workStatus.status)) {
                    totalAvailable++;
                }
            }
        } else if (window.ceManager?.ceList) {
            totalAvailable = window.ceManager.ceList.length;
        }

        // UI更新
        const totalEventCountEl = document.getElementById('totalEventCount');
        const totalAssignedCountEl = document.getElementById('totalAssignedCount');
        const totalAssignedCount2El = document.getElementById('totalAssignedCount2');
        const totalAvailableCountEl = document.getElementById('totalAvailableCount');
        const totalRequiredCountEl = document.getElementById('totalRequiredCount');
        const overallProgressFillEl = document.getElementById('overallProgressFill');

        if (totalEventCountEl) totalEventCountEl.textContent = totalEvents;
        if (totalAssignedCountEl) totalAssignedCountEl.textContent = totalAssigned;
        if (totalAssignedCount2El) totalAssignedCount2El.textContent = totalAssigned;
        if (totalAvailableCountEl) totalAvailableCountEl.textContent = totalAvailable;
        if (totalRequiredCountEl) totalRequiredCountEl.textContent = totalRequired;

        // 進捗バーの更新
        const progressPercent = totalRequired > 0 ? Math.min((totalAssigned / totalRequired) * 100, 100) : 0;
        if (overallProgressFillEl) {
            overallProgressFillEl.style.width = `${progressPercent}%`;
        }

        // 部門別集計の更新
        this.updateDepartmentSummary();
    }

    updateDepartmentSummary() {
        const departments = window.DEPARTMENTS || ['放射線科', '検査科', '透析科'];
        
        departments.forEach(dept => {
            const deptSection = document.querySelector(`.department-section[data-department="${dept}"]`);
            if (!deptSection) return;

            let deptRequired = 0;
            let deptAssigned = 0;

            // 通常業務の集計
            const eventCards = deptSection.querySelectorAll('.event-card');
            eventCards.forEach(card => {
                const assignedText = card.querySelector('.flex .text-xs')?.textContent || '0/0名';
                const match = assignedText.match(/(\d+)\/(\d+)名/);
                if (match) {
                    deptAssigned += parseInt(match[1]) || 0;
                    deptRequired += parseInt(match[2]) || 0;
                }
            });

            // 月次業務の集計
            const monthlyCards = deptSection.querySelectorAll('.monthly-task-card');
            monthlyCards.forEach(card => {
                const assignedText = card.querySelector('.flex .text-xs')?.textContent || '0/0名';
                const match = assignedText.match(/(\d+)\/(\d+)名/);
                if (match) {
                    deptAssigned += parseInt(match[1]) || 0;
                    deptRequired += parseInt(match[2]) || 0;
                }
            });

            // 部門別バーの更新
            const ratioBar = deptSection.querySelector('.dept-ratio-fill');
            if (ratioBar) {
                const ratioPercent = deptRequired > 0 ? Math.min((deptAssigned / deptRequired) * 100, 100) : 0;
                ratioBar.style.width = `${ratioPercent}%`;
            }

            // 部門別統計テキストの更新
            const summaryText = deptSection.querySelector('.dept-summary-text');
            if (summaryText) {
                summaryText.textContent = `${deptAssigned}/${deptRequired}名`;
            }
        });
    }

    async updateMonthlyTaskActual(yearMonth, taskId, newCount) {
        try {
            await window.database.ref(`${window.DATA_ROOT}/monthlyTasks/${yearMonth}/${taskId}/actualCount`).set(newCount);
            window.showMessage('実施件数を更新しました', 'success');
            await this.renderMonthlyTasks();
            this.updateDailySummary().catch(console.error);
        } catch (error) {
            console.error('❌ 月次業務実施件数更新エラー:', error);
            window.showMessage('実施件数の更新に失敗しました', 'error');
        }
    }

    handleMonthlyTaskDragOver(e) {
        if (window.userRole === 'viewer') return;
        
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        e.currentTarget.classList.add('drag-over');
    }

    handleMonthlyTaskDragLeave(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over');
        }
    }

    async handleMonthlyTaskDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        if (window.userRole === 'viewer') {
            window.showMessage('編集権限がありません', 'warning');
            return;
        }

        try {
            let ceDataStr = e.dataTransfer.getData('application/json') || 
                            e.dataTransfer.getData('text/plain');
            
            if (!ceDataStr) {
                console.warn('⚠️ 月次業務ドラッグデータが見つかりません');
                return;
            }

            let ceData;
            try {
                ceData = JSON.parse(ceDataStr);
            } catch (parseError) {
                console.error('❌ 月次業務CEデータのパースに失敗:', parseError);
                return;
            }

            const taskId = e.currentTarget.dataset.taskId;
            const yearMonth = e.currentTarget.dataset.yearMonth;

            if (!ceData.ceId || !ceData.ceName || !taskId || !yearMonth) {
                console.error('❌ 月次業務必須データが不足:', { ceData, taskId, yearMonth });
                window.showMessage('データが不完全です', 'error');
                return;
            }

            console.log('📥 V1準拠月次業務ドロップ処理:', { ceData, taskId, yearMonth });
            await this.assignCEToMonthlyTask(yearMonth, taskId, ceData);

        } catch (error) {
            console.error('❌ 月次業務ドロップ処理エラー:', error);
            window.showMessage(`月次業務CE配置に失敗しました: ${error.message}`, 'error');
        }
    }

    async assignCEToMonthlyTask(yearMonth, taskId, ceData) {
        try {
            const taskRef = window.database.ref(`${window.DATA_ROOT}/monthlyTasks/${yearMonth}/${taskId}`);
            const snapshot = await taskRef.once('value');
            const taskData = snapshot.val();

            if (!taskData) {
                window.showMessage('月次業務データが見つかりません', 'error');
                return;
            }

            const currentAssigned = Array.isArray(taskData.assignedCEs) ? taskData.assignedCEs : [];
            
            // 重複チェック
            const exists = currentAssigned.some(x => 
                (typeof x === 'string' ? x === ceData.ceId : x?.id === ceData.ceId)
            );
            
            if (exists) {
                window.showMessage(`${ceData.ceName}は既に配置済みです`, 'warning');
                return;
            }

            // オブジェクト形式でCE情報を保存
            const ceEntry = {
                id: ceData.ceId,
                name: ceData.ceName,
                workType: ceData.workType || 'ME'
            };

            // 既存のID文字列をオブジェクト形式に変換（後方互換性）
            const upgradedAssigned = currentAssigned.map(x => {
                if (typeof x === 'string') {
                    const ce = window.ceManager?.ceList?.find(c => c.id === x);
                    return {
                        id: x,
                        name: ce?.iconName || ce?.displayName || x,
                        workType: ce?.workType || 'ME'
                    };
                }
                return x;
            });

            upgradedAssigned.push(ceEntry);

            await taskRef.update({
                assignedCEs: upgradedAssigned,
                updatedAt: firebase.database.ServerValue.TIMESTAMP,
                updatedBy: window.currentUserData?.displayName || 'user'
            });

            window.showMessage(`${ceData.ceName}を月次業務に配置しました`, 'success');
            console.log('✅ 月次業務CE配置完了:', ceData.ceName);
            await this.renderMonthlyTasks();
            this.updateDailySummary().catch(console.error);

        } catch (error) {
            console.error('❌ 月次業務CE配置エラー:', error);
            window.showMessage('月次業務CE配置処理でエラーが発生しました', 'error');
        }
    }

    async unassignCEFromMonthlyTask(yearMonth, taskId, ceId) {
        if (!confirm('このCEの配置を解除しますか？')) return;

        try {
            const taskRef = window.database.ref(`${window.DATA_ROOT}/monthlyTasks/${yearMonth}/${taskId}`);
            const snapshot = await taskRef.once('value');
            const taskData = snapshot.val();

            if (!taskData) {
                window.showMessage('月次業務データが見つかりません', 'error');
                return;
            }

            const currentAssigned = Array.isArray(taskData.assignedCEs) ? taskData.assignedCEs : [];
            const updatedAssigned = currentAssigned.filter(x => 
                (typeof x === 'string' ? x !== ceId : x?.id !== ceId)
            );

            if (updatedAssigned.length !== currentAssigned.length) {
                await taskRef.update({
                    assignedCEs: updatedAssigned,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP,
                    updatedBy: window.currentUserData?.displayName || 'user'
                });

                window.showMessage('CEの配置を解除しました', 'success');
                await this.renderMonthlyTasks();
                this.updateDailySummary().catch(console.error);
            }

        } catch (error) {
            console.error('❌ 月次業務CE配置解除エラー:', error);
            window.showMessage('CE配置解除に失敗しました', 'error');
        }
    }

    enableCEDragging() {
        const ceItems = document.querySelectorAll('.ce-item');
        const ceList = window.ceManager?.ceList || [];

        ceItems.forEach((item, index) => {
            // 既存のイベントリスナーをクリア
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            newItem.draggable = true;
            newItem.style.cursor = 'grab';

            const ce = ceList[index];
            if (ce) {
                newItem.dataset.ceId = ce.id;
                newItem.dataset.ceName = ce.iconName || ce.displayName || ce.name;
                newItem.dataset.workType = ce.workType || 'ME';
            } else {
                const displayName = newItem.textContent.trim();
                const matchedCE = ceList.find(c => 
                    c.iconName === displayName || 
                    c.displayName === displayName || 
                    c.name === displayName
                );
                if (matchedCE) {
                    newItem.dataset.ceId = matchedCE.id;
                    newItem.dataset.ceName = matchedCE.iconName || matchedCE.displayName || matchedCE.name;
                    newItem.dataset.workType = matchedCE.workType || 'ME';
                }
            }

            // V1版準拠のドラッグイベント
            newItem.addEventListener('dragstart', (e) => {
                if (window.userRole === 'viewer') {
                    e.preventDefault();
                    return;
                }

                const ceData = {
                    ceId: newItem.dataset.ceId,
                    ceName: newItem.dataset.ceName,
                    workType: newItem.dataset.workType || 'ME'
                };

                // 複数の形式でデータを設定（互換性向上）
                e.dataTransfer.setData('text/plain', JSON.stringify(ceData));
                e.dataTransfer.setData('application/json', JSON.stringify(ceData));
                e.dataTransfer.effectAllowed = 'copy';
                
                newItem.classList.add('dragging');
                newItem.style.opacity = '0.5';
                
                console.log('🎯 V1準拠CEドラッグ開始:', ceData);
            });

            newItem.addEventListener('dragend', () => {
                newItem.classList.remove('dragging');
                newItem.style.opacity = '';
                newItem.style.cursor = 'grab';
            });

            // ドラッグ中のスタイル
            newItem.addEventListener('drag', () => {
                newItem.style.cursor = 'grabbing';
            });
        });

        console.log('✅ V1準拠CEドラッグ機能有効化完了:', ceItems.length);
    }

    handleEventDragOver(e) {
        if (window.userRole === 'viewer') return;
        
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        e.currentTarget.classList.add('drag-over');
    }

    handleEventDragLeave(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over');
        }
    }

    async handleEventDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        if (window.userRole === 'viewer') {
            window.showMessage('編集権限がありません', 'warning');
            return;
        }

        try {
            let ceDataStr = e.dataTransfer.getData('application/json') || 
                            e.dataTransfer.getData('text/plain');
            
            if (!ceDataStr) {
                console.warn('⚠️ ドラッグデータが見つかりません');
                return;
            }

            let ceData;
            try {
                ceData = JSON.parse(ceDataStr);
            } catch (parseError) {
                console.error('❌ CEデータのパースに失敗:', parseError);
                return;
            }

            const eventId = e.currentTarget.dataset.eventId;
            const dateKey = e.currentTarget.dataset.dateKey;

            if (!ceData.ceId || !ceData.ceName || !eventId || !dateKey) {
                console.error('❌ 必須データが不足:', { ceData, eventId, dateKey });
                window.showMessage('データが不完全です', 'error');
                return;
            }

            console.log('📥 V1準拠ドロップ処理:', { ceData, eventId, dateKey });
            await this.assignCEToEventV1Style(dateKey, eventId, ceData);

        } catch (error) {
            console.error('❌ ドロップ処理エラー:', error);
            window.showMessage(`CE配置に失敗しました: ${error.message}`, 'error');
        }
    }

    // V1版準拠のCE配置処理（確実性重視）
    async assignCEToEventV1Style(dateKey, eventId, ceData) {
        try {
            console.log('🎯 V1版準拠CE配置開始:', { dateKey, eventId, ceData });

            // 段階1: イベントデータの取得と検証
            const eventRef = window.database.ref(`${window.DATA_ROOT}/events/byDate/${dateKey}/${eventId}`);
            const snapshot = await eventRef.once('value');
            const eventData = snapshot.val();

            if (!eventData) {
                throw new Error('業務データが見つかりません');
            }

            // 段階2: 既存配置の確認（V1版準拠）
            let currentAssigned = eventData.assignedCEs || [];
            
            // V1版互換性：文字列配列として処理
            if (!Array.isArray(currentAssigned)) {
                currentAssigned = [];
            }

            // 重複チェック（ID基準）
            const isDuplicate = currentAssigned.some(assigned => {
                if (typeof assigned === 'string') {
                    return assigned === ceData.ceId;
                } else if (assigned && typeof assigned === 'object') {
                    return assigned.id === ceData.ceId;
                }
                return false;
            });

            if (isDuplicate) {
                window.showMessage(`${ceData.ceName}は既に配置済みです`, 'warning');
                return;
            }

            // 段階3: 勤務状態チェック（V2版機能）
            if (window.publishedScheduleResolver) {
                try {
                    const workStatus = await window.publishedScheduleResolver.getCEWorkStatusForDate(ceData.ceId, dateKey);
                    if (workStatus && workStatus.status && !['A', 'A1', 'B', '非'].includes(workStatus.status)) {
                        const proceed = confirm(`${ceData.ceName}は${workStatus.status}ですが、配置しますか？`);
                        if (!proceed) {
                            return;
                        }
                    }
                } catch (statusError) {
                    console.warn('⚠️ 勤務状態チェックスキップ:', statusError);
                }
            }

            // 段階4: V1版準拠の配置実行
            const ceEntry = {
                id: ceData.ceId,
                name: ceData.ceName,
                workType: ceData.workType || 'ME'
            };

            // 既存の文字列エントリをオブジェクト化（後方互換性）
            const upgradedAssigned = currentAssigned.map(entry => {
                if (typeof entry === 'string') {
                    const ce = window.ceManager?.ceList?.find(c => c.id === entry);
                    return {
                        id: entry,
                        name: ce?.iconName || ce?.displayName || ce?.name || entry,
                        workType: ce?.workType || 'ME'
                    };
                }
                return entry;
            });

            upgradedAssigned.push(ceEntry);

            // 段階5: データベース更新
            await eventRef.update({
                assignedCEs: upgradedAssigned,
                updatedAt: firebase.database.ServerValue.TIMESTAMP,
                updatedBy: window.currentUserData?.displayName || 'user'
            });

            // 段階6: 成功通知と画面更新
            window.showMessage(`${ceData.ceName}を配置しました`, 'success');
            console.log('✅ V1準拠CE配置完了:', ceData.ceName);

            // 監査ログ記録
            try {
                await window.database.ref(`${window.DATA_ROOT}/auditLogs`).push({
                    action: 'ce-assign',
                    details: { 
                        ceName: ceData.ceName, 
                        eventName: eventData.name,
                        description: `${dateKey}の${eventData.name}に${ceData.ceName}を配置`
                    },
                    uid: window.currentUserData?.uid || null,
                    username: window.currentUserData?.username || 'unknown',
                    displayName: window.currentUserData?.displayName || 'unknown',
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
            } catch (logError) {
                console.warn('監査ログ記録失敗:', logError);
            }

            // 即座に画面を更新（V1版準拠）
            setTimeout(() => {
                this.loadAndRenderEventsForSelectedDate();
            }, 200);

        } catch (error) {
            console.error('❌ V1準拠CE配置エラー:', error);
            throw new Error(`CE配置処理でエラーが発生しました: ${error.message}`);
        }
    }

    async unassignCE(dateKey, eventId, ceId) {
        if (!confirm('このCEの配置を解除しますか？')) return;

        try {
            const eventRef = window.database.ref(`${window.DATA_ROOT}/events/byDate/${dateKey}/${eventId}`);
            const snapshot = await eventRef.once('value');
            const eventData = snapshot.val();

            if (!eventData) {
                window.showMessage('業務データが見つかりません', 'error');
                return;
            }

            const currentAssigned = Array.isArray(eventData.assignedCEs) ? eventData.assignedCEs : [];
            const updatedAssigned = currentAssigned.filter(x => 
                (typeof x === 'string' ? x !== ceId : x?.id !== ceId)
            );

            if (updatedAssigned.length !== currentAssigned.length) {
            await eventRef.update({
                assignedCEs: updatedAssigned,
                lastModified: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showNotification('CEの割り当てが解除されました', 'success');
            loadScheduleData();
        } catch (error) {
            console.error('CE割り当て解除エラー:', error);
            showNotification('CE割り当て解除に失敗しました', 'error');
        }
    }

    // タスク完了/未完了切り替え
    async function toggleTaskCompletion(taskId, currentStatus) {
        const user = firebase.auth().currentUser;
        if (!user) {
            showNotification('認証が必要です', 'error');
            return;
        }

        try {
            const taskRef = db.collection('schedules').doc(taskId);
            const newStatus = !currentStatus;
            
            await taskRef.update({
                completed: newStatus,
                completedBy: newStatus ? user.uid : null,
                completedAt: newStatus ? firebase.firestore.FieldValue.serverTimestamp() : null,
                lastModified: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            const statusText = newStatus ? '完了' : '未完了';
            showNotification(`タスクを${statusText}に設定しました`, 'success');
            loadScheduleData();
        } catch (error) {
            console.error('タスク状態更新エラー:', error);
            showNotification('タスク状態の更新に失敗しました', 'error');
        }
    }

    // スケジュール削除
    async function deleteSchedule(scheduleId) {
        if (!confirm('このスケジュールを削除してもよろしいですか？')) {
            return;
        }

        try {
            await db.collection('schedules').doc(scheduleId).delete();
            showNotification('スケジュールが削除されました', 'success');
            loadScheduleData();
        } catch (error) {
            console.error('スケジュール削除エラー:', error);
            showNotification('スケジュール削除に失敗しました', 'error');
        }
    }

    // スケジュール編集
    function editSchedule(scheduleId) {
        window.location.href = `edit.html?id=${scheduleId}`;
    }

    // CEリスト管理
    async function loadCEList() {
        try {
            const snapshot = await db.collection('ceList').orderBy('name').get();
            ceList = [];
            snapshot.forEach(doc => {
                ceList.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            updateCEListDisplay();
        } catch (error) {
            console.error('CEリスト読み込みエラー:', error);
            showNotification('CEリストの読み込みに失敗しました', 'error');
        }
    }

    function updateCEListDisplay() {
        const ceListElement = document.getElementById('ceList');
        if (!ceListElement) return;

        ceListElement.innerHTML = ceList.map(ce => `
            <div class="ce-item" data-ce-id="${ce.id}">
                <span class="ce-name">${ce.name}</span>
                <span class="ce-status ${ce.available ? 'available' : 'unavailable'}">
                    ${ce.available ? '稼働中' : '休暇中'}
                </span>
                <div class="ce-actions">
                    <button onclick="editCE('${ce.id}')" class="btn btn-sm btn-outline-primary">編集</button>
                    <button onclick="deleteCE('${ce.id}')" class="btn btn-sm btn-outline-danger">削除</button>
                </div>
            </div>
        `).join('');
    }

    // CE追加
    async function addCE() {
        const name = prompt('CEの名前を入力してください:');
        if (!name) return;

        try {
            await db.collection('ceList').add({
                name: name.trim(),
                available: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showNotification('CEが追加されました', 'success');
            loadCEList();
        } catch (error) {
            console.error('CE追加エラー:', error);
            showNotification('CEの追加に失敗しました', 'error');
        }
    }

    // CE編集
    async function editCE(ceId) {
        const ce = ceList.find(c => c.id === ceId);
        if (!ce) return;

        const newName = prompt('CEの名前を編集してください:', ce.name);
        if (!newName || newName === ce.name) return;

        try {
            await db.collection('ceList').doc(ceId).update({
                name: newName.trim(),
                lastModified: firebase.firestore.FieldValue.serverTimestamp()
            });
            showNotification('CEが更新されました', 'success');
            loadCEList();
        } catch (error) {
            console.error('CE更新エラー:', error);
            showNotification('CEの更新に失敗しました', 'error');
        }
    }

    // CE削除
    async function deleteCE(ceId) {
        const ce = ceList.find(c => c.id === ceId);
        if (!ce) return;

        if (!confirm(`${ce.name}を削除してもよろしいですか？`)) return;

        try {
            await db.collection('ceList').doc(ceId).delete();
            showNotification('CEが削除されました', 'success');
            loadCEList();
        } catch (error) {
            console.error('CE削除エラー:', error);
            showNotification('CEの削除に失敗しました', 'error');
        }
    }

    // CE稼働状態切り替え
    async function toggleCEAvailability(ceId) {
        const ce = ceList.find(c => c.id === ceId);
        if (!ce) return;

        try {
            await db.collection('ceList').doc(ceId).update({
                available: !ce.available,
                lastModified: firebase.firestore.FieldValue.serverTimestamp()
            });
            const status = !ce.available ? '稼働中' : '休暇中';
            showNotification(`${ce.name}を${status}に設定しました`, 'success');
            loadCEList();
        } catch (error) {
            console.error('CE状態更新エラー:', error);
            showNotification('CE状態の更新に失敗しました', 'error');
        }
    }

    // 統計情報の更新
    function updateStatistics() {
        if (!currentSchedules.length) {
            document.getElementById('totalTasks').textContent = '0';
            document.getElementById('completedTasks').textContent = '0';
            document.getElementById('pendingTasks').textContent = '0';
            document.getElementById('completionRate').textContent = '0%';
            return;
        }

        const total = currentSchedules.length;
        const completed = currentSchedules.filter(s => s.completed).length;
        const pending = total - completed;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        document.getElementById('totalTasks').textContent = total.toString();
        document.getElementById('completedTasks').textContent = completed.toString();
        document.getElementById('pendingTasks').textContent = pending.toString();
        document.getElementById('completionRate').textContent = `${completionRate}%`;
    }

    // 検索・フィルター機能
    function setupSearchAndFilter() {
        const searchInput = document.getElementById('searchSchedule');
        const filterSelect = document.getElementById('filterStatus');
        const dateFilter = document.getElementById('filterDate');

        if (searchInput) {
            searchInput.addEventListener('input', filterSchedules);
        }
        if (filterSelect) {
            filterSelect.addEventListener('change', filterSchedules);
        }
        if (dateFilter) {
            dateFilter.addEventListener('change', filterSchedules);
        }
    }

    function filterSchedules() {
        const searchTerm = document.getElementById('searchSchedule')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('filterStatus')?.value || 'all';
        const dateFilter = document.getElementById('filterDate')?.value || '';

        let filtered = currentSchedules.filter(schedule => {
            // テキスト検索
            const matchesSearch = !searchTerm || 
                schedule.title.toLowerCase().includes(searchTerm) ||
                schedule.description.toLowerCase().includes(searchTerm) ||
                schedule.location.toLowerCase().includes(searchTerm);

            // ステータスフィルター
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'completed' && schedule.completed) ||
                (statusFilter === 'pending' && !schedule.completed);

            // 日付フィルター
            const matchesDate = !dateFilter || 
                schedule.date === dateFilter;

            return matchesSearch && matchesStatus && matchesDate;
        });

        displaySchedules(filtered);
    }

    // エクスポート機能
    function exportToCSV() {
        if (!currentSchedules.length) {
            showNotification('エクスポートするデータがありません', 'warning');
            return;
        }

        const headers = ['日付', 'タイトル', '説明', '場所', '開始時間', '終了時間', '担当CE', 'ステータス'];
        const csvContent = [
            headers.join(','),
            ...currentSchedules.map(schedule => [
                schedule.date,
                `"${schedule.title}"`,
                `"${schedule.description}"`,
                `"${schedule.location}"`,
                schedule.startTime,
                schedule.endTime,
                `"${(schedule.assignedCEs || []).join(', ')}"`,
                schedule.completed ? '完了' : '未完了'
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `schedule_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        showNotification('CSVファイルをエクスポートしました', 'success');
    }

    // 印刷機能
    function printSchedule() {
        const printWindow = window.open('', '_blank');
        const printContent = generatePrintContent();
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    }

    function generatePrintContent() {
        const today = new Date().toLocaleDateString('ja-JP');
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>CEスケジュール - ${today}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
                .schedule-item { 
                    border: 1px solid #ddd; 
                    margin: 10px 0; 
                    padding: 15px; 
                    page-break-inside: avoid; 
                }
                .schedule-header { font-weight: bold; font-size: 16px; margin-bottom: 10px; }
                .schedule-details { margin: 5px 0; }
                .completed { background-color: #f8f9fa; opacity: 0.7; }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>CEスケジュール管理システム - ${today}</h1>
            ${currentSchedules.map(schedule => `
                <div class="schedule-item ${schedule.completed ? 'completed' : ''}">
                    <div class="schedule-header">${schedule.title}</div>
                    <div class="schedule-details">日付: ${schedule.date}</div>
                    <div class="schedule-details">時間: ${schedule.startTime} - ${schedule.endTime}</div>
                    <div class="schedule-details">場所: ${schedule.location}</div>
                    <div class="schedule-details">説明: ${schedule.description}</div>
                    <div class="schedule-details">担当CE: ${(schedule.assignedCEs || []).join(', ')}</div>
                    <div class="schedule-details">ステータス: ${schedule.completed ? '完了' : '未完了'}</div>
                </div>
            `).join('')}
        </body>
        </html>
        `;
    }

    // 設定管理
    function loadSettings() {
        const settings = localStorage.getItem('ceScheduleSettings');
        if (settings) {
            appSettings = JSON.parse(settings);
        }
        applySettings();
    }

    function saveSettings() {
        localStorage.setItem('ceScheduleSettings', JSON.stringify(appSettings));
    }

    function applySettings() {
        // テーマ適用
        document.body.className = appSettings.theme;
        
        // 通知設定適用
        if (!appSettings.notifications) {
            // 通知を無効化する処理
        }
    }

    // 設定モーダル表示
    function showSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.style.display = 'block';
            
            // 現在の設定を表示
            document.getElementById('themeSelect').value = appSettings.theme;
            document.getElementById('notificationsToggle').checked = appSettings.notifications;
            document.getElementById('autoRefreshToggle').checked = appSettings.autoRefresh;
        }
    }

    function closeSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    function saveSettingsFromModal() {
        appSettings.theme = document.getElementById('themeSelect')?.value || 'light';
        appSettings.notifications = document.getElementById('notificationsToggle')?.checked || true;
        appSettings.autoRefresh = document.getElementById('autoRefreshToggle')?.checked || true;
        
        saveSettings();
        applySettings();
        closeSettingsModal();
        showNotification('設定が保存されました', 'success');
    }

    // 自動更新機能
    function startAutoRefresh() {
        if (appSettings.autoRefresh && !autoRefreshInterval) {
            autoRefreshInterval = setInterval(() => {
                loadScheduleData();
            }, 30000); // 30秒ごと
        }
    }

    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }

    // ページ離脱時のクリーンアップ
    window.addEventListener('beforeunload', () => {
        stopAutoRefresh();
    });

    // グローバル関数をウィンドウオブジェクトに追加
    window.assignCE = assignCE;
    window.unassignCE = unassignCE;
    window.toggleTaskCompletion = toggleTaskCompletion;
    window.deleteSchedule = deleteSchedule;
    window.editSchedule = editSchedule;
    window.addCE = addCE;
    window.editCE = editCE;
    window.deleteCE = deleteCE;
    window.toggleCEAvailability = toggleCEAvailability;
    window.exportToCSV = exportToCSV;
    window.printSchedule = printSchedule;
    window.showSettingsModal = showSettingsModal;
    window.closeSettingsModal = closeSettingsModal;
    window.saveSettingsFromModal = saveSettingsFromModal;

    // ページ読み込み完了時の初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDashboard);
    } else {
        initializeDashboard();
    }

})();
