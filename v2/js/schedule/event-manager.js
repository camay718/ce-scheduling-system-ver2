/**
 * イベント管理システム - 完全修正版
 * 個人カード機能対応版
 */
(function() {
    'use strict';

    class EventManager {
        constructor() {
            this.isInitialized = false;
            this.currentEditingEvent = null;
            this.currentEditingPersonalCard = null;
            this.init();
        }

        async init() {
            try {
                await this.waitForDependencies();
                this.setupEventListeners();
                this.isInitialized = true;
                console.log('📅 イベントマネージャー初期化完了');
            } catch (error) {
                console.error('❌ イベントマネージャー初期化エラー:', error);
            }
        }

        async waitForDependencies() {
            let attempts = 0;
            while (attempts < 50) {
                if (window.database && window.DATA_ROOT && window.showMessage && 
                    window.DEPARTMENTS) {
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            throw new Error('EventManager: 依存関係の初期化タイムアウト');
        }

        setupEventListeners() {
            const buttons = [
                { id: 'addEventButtonDaily', method: 'openAddEventModal' },
                { id: 'addBulkEventBtn', method: 'openBulkAddModal' },
                { id: 'addMonthlyTaskBtn', method: 'openMonthlyTaskModal' },
                { id: 'addPersonalCardBtn', method: 'openPersonalCardModal' }
            ];

            buttons.forEach(({ id, method }) => {
                const btn = document.getElementById(id);
                if (btn && !btn.dataset.eventManagerBound) {
                    btn.dataset.eventManagerBound = 'true';
                    btn.onclick = () => this[method]();
                }
            });
        }

        // 業務追加モーダル（CE配置対応版）
        openAddEventModal(department = null) {
            if (window.userRole === 'viewer') {
                window.showMessage('編集権限がありません', 'warning');
                return;
            }

            this.createAddEventModal(department);
        }

createAddEventModal(selectedDepartment = null) {
    const existingModal = document.getElementById('addEventModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'addEventModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="glass-card p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold">業務追加</h3>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <form id="addEventForm" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-bold mb-2">
                            <i class="fas fa-building mr-2"></i>部門 *
                        </label>
                        <select id="eventDepartment" class="input-unified" required>
                            <option value="">部門を選択</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-bold mb-2">
                            <i class="fas fa-calendar mr-2"></i>日付 *
                        </label>
                        <input type="date" id="eventDate" class="input-unified" required>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-bold mb-2">
                        <i class="fas fa-tasks mr-2"></i>業務名 *
                    </label>
                    <input type="text" id="eventName" class="input-unified" 
                           placeholder="例: 手術室メンテナンス" required>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-bold mb-2">
                            <i class="fas fa-clock mr-2"></i>開始時間
                        </label>
                        <input type="time" id="eventStartTime" class="input-unified">
                    </div>
                    <div>
                        <label class="block text-sm font-bold mb-2">
                            <i class="fas fa-clock mr-2"></i>終了時間
                        </label>
                        <input type="time" id="eventEndTime" class="input-unified">
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-bold mb-2">
                            <i class="fas fa-hashtag mr-2"></i>予定件数
                        </label>
                        <input type="number" id="eventCount" class="input-unified" min="0" max="99" value="0" placeholder="0">
                    </div>
                    <div>
                        <label class="block text-sm font-bold mb-2">
                            <i class="fas fa-users mr-2"></i>必要人数
                        </label>
                        <input type="number" id="eventRequiredPeople" class="input-unified" min="0" max="20" value="0" placeholder="0">
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-bold mb-2">
                        <i class="fas fa-info-circle mr-2"></i>詳細
                    </label>
                    <textarea id="eventDescription" class="input-unified" rows="2"
                              placeholder="業務の詳細を入力（任意）"></textarea>
                </div>
                
                <div class="flex space-x-3">
                    <button type="button" onclick="this.closest('.fixed').remove()" 
                            class="btn-unified btn-outline-unified flex-1">
                        キャンセル
                    </button>
                    <button type="submit" class="btn-unified btn-primary-unified flex-1">
                        <i class="fas fa-save mr-2"></i>保存
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    this.initializeEventModal(selectedDepartment);
}

// 業務保存処理の修正
async saveEvent() {
    const department = document.getElementById('eventDepartment')?.value;
    const name = document.getElementById('eventName')?.value?.trim();
    const startTime = document.getElementById('eventStartTime')?.value;
    const endTime = document.getElementById('eventEndTime')?.value;
    const count = parseInt(document.getElementById('eventCount')?.value) || 0;
    const requiredPeople = parseInt(document.getElementById('eventRequiredPeople')?.value) || 0;
    const date = document.getElementById('eventDate')?.value;
    const description = document.getElementById('eventDescription')?.value?.trim();

    if (!department || !name || !date) {
        window.showMessage('必須項目を入力してください', 'warning');
        return;
    }

    try {
        const eventRef = window.database.ref(`${window.DATA_ROOT}/events/byDate/${date}`).push();
        const eventData = {
            id: eventRef.key,
            department: department,
            name: name,
            startTime: startTime || null,
            endTime: endTime || null,
            count: count,
            requiredPeople: requiredPeople,
            date: date,
            description: description || null,
            assignedCEs: [],
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            createdBy: window.currentUserData?.displayName || 'unknown'
        };

        await eventRef.set(eventData);

        document.getElementById('addEventModal').remove();
        window.showMessage('業務を追加しました', 'success');

        if (window.dashboardAuth) {
            setTimeout(() => {
                window.dashboardAuth.loadAndRenderEventsForSelectedDate();
            }, 500);
        }

        console.log('✅ 業務保存完了:', eventData);

    } catch (error) {
        console.error('❌ 業務保存エラー:', error);
        window.showMessage('業務の保存に失敗しました', 'error');
    }
}

// 月次業務追加の修正
async saveMonthlyTask() {
    const department = document.getElementById('monthlyDepartment')?.value;
    const name = document.getElementById('monthlyTaskName')?.value?.trim();
    const month = document.getElementById('monthlyMonth')?.value;
    const count = parseInt(document.getElementById('monthlyEventCount')?.value) || 0;
    const requiredPeople = parseInt(document.getElementById('monthlyRequiredPeople')?.value) || 0;
    const description = document.getElementById('monthlyDescription')?.value?.trim();

    if (!department || !name || !month) {
        window.showMessage('必須項目を入力してください', 'warning');
        return;
    }

    try {
        const taskRef = window.database.ref(`${window.DATA_ROOT}/monthlyTasks`).push();
        const taskData = {
            id: taskRef.key,
            department: department,
            name: name,
            month: parseInt(month),
            count: count,
            requiredPeople: requiredPeople,
            description: description || null,
            isMonthlyTask: true,
            assignedCEs: [],
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            createdBy: window.currentUserData?.displayName || 'unknown'
        };

        await taskRef.set(taskData);

        document.getElementById('monthlyTaskModal').remove();
        window.showMessage('月次業務を追加しました', 'success');

        console.log('✅ 月次業務保存完了:', taskData);

    } catch (error) {
        console.error('❌ 月次業務保存エラー:', error);
        window.showMessage('月次業務の保存に失敗しました', 'error');
    }
}

        // 期間一括業務追加モーダル
        openBulkAddModal() {
            if (window.userRole === 'viewer') {
                window.showMessage('編集権限がありません', 'warning');
                return;
            }

            const modal = document.createElement('div');
            modal.id = 'bulkEventModal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="glass-card p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-bold">期間一括業務追加</h3>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <form id="bulkEventForm" class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold mb-2">開始日 *</label>
                                <input type="date" id="bulkStartDate" class="input-unified" required>
                            </div>
                            <div>
                                <label class="block text-sm font-bold mb-2">終了日 *</label>
                                <input type="date" id="bulkEndDate" class="input-unified" required>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">部門 *</label>
                            <select id="bulkDepartment" class="input-unified" required>
                                <option value="">部門を選択</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">業務名 *</label>
                            <input type="text" id="bulkEventName" class="input-unified" 
                                   placeholder="例: 定期メンテナンス" required>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold mb-2">開始時間</label>
                                <input type="time" id="bulkStartTime" class="input-unified">
                            </div>
                            <div>
                                <label class="block text-sm font-bold mb-2">終了時間</label>
                                <input type="time" id="bulkEndTime" class="input-unified">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold mb-2">予定件数</label>
                                <select id="bulkEventCount" class="input-unified">
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-bold mb-2">必要人数</label>
                                <select id="bulkRequiredPeople" class="input-unified">
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">実施曜日</label>
                            <div class="flex space-x-2">
                                <label class="flex items-center">
                                    <input type="checkbox" value="1" class="bulk-weekday mr-1">
                                    <span class="text-sm">月</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="checkbox" value="2" class="bulk-weekday mr-1">
                                    <span class="text-sm">火</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="checkbox" value="3" class="bulk-weekday mr-1">
                                    <span class="text-sm">水</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="checkbox" value="4" class="bulk-weekday mr-1">
                                    <span class="text-sm">木</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="checkbox" value="5" class="bulk-weekday mr-1">
                                    <span class="text-sm">金</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="checkbox" value="6" class="bulk-weekday mr-1">
                                    <span class="text-sm">土</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="checkbox" value="0" class="bulk-weekday mr-1">
                                    <span class="text-sm">日</span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="flex space-x-3">
                            <button type="button" onclick="this.closest('.fixed').remove()" 
                                    class="btn-unified btn-outline-unified flex-1">
                                キャンセル
                            </button>
                            <button type="submit" class="btn-unified btn-primary-unified flex-1">
                                <i class="fas fa-calendar-plus mr-2"></i>一括追加
                            </button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);
            this.initializeBulkModal();
        }

        initializeBulkModal() {
            const deptSelect = document.getElementById('bulkDepartment');
            if (window.DEPARTMENTS && deptSelect) {
                window.DEPARTMENTS.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept;
                    option.textContent = dept;
                    deptSelect.appendChild(option);
                });
            }

            const countSelect = document.getElementById('bulkEventCount');
            const peopleSelect = document.getElementById('bulkRequiredPeople');
            
            [countSelect, peopleSelect].forEach((select, index) => {
                if (select) {
                    for (let i = 0; i <= (index === 0 ? 20 : 10); i++) {
                        const option = document.createElement('option');
                        option.value = i;
                        option.textContent = index === 0 ? `${i}件` : `${i}名`;
                        option.selected = i === 1;
                        select.appendChild(option);
                    }
                }
            });

            const form = document.getElementById('bulkEventForm');
            if (form) {
                form.onsubmit = (e) => {
                    e.preventDefault();
                    this.saveBulkEvent();
                };
            }
        }

        async saveBulkEvent() {
            const startDate = document.getElementById('bulkStartDate')?.value;
            const endDate = document.getElementById('bulkEndDate')?.value;
            const department = document.getElementById('bulkDepartment')?.value;
            const name = document.getElementById('bulkEventName')?.value?.trim();
            const startTime = document.getElementById('bulkStartTime')?.value;
            const endTime = document.getElementById('bulkEndTime')?.value;
            const count = parseInt(document.getElementById('bulkEventCount')?.value) || 0;
            const requiredPeople = parseInt(document.getElementById('bulkRequiredPeople')?.value) || 0;
            
            const selectedWeekdays = Array.from(document.querySelectorAll('.bulk-weekday:checked'))
                .map(cb => parseInt(cb.value));

            if (!startDate || !endDate || !department || !name) {
                window.showMessage('必須項目を入力してください', 'warning');
                return;
            }

            if (selectedWeekdays.length === 0) {
                window.showMessage('実施曜日を選択してください', 'warning');
                return;
            }

            try {
                const start = new Date(startDate);
                const end = new Date(endDate);
                const updates = {};
                let eventCount = 0;
                
                for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
                    const weekday = date.getDay();
                    
                    if (selectedWeekdays.includes(weekday)) {
                        const dateKey = date.toISOString().slice(0, 10);
                        const eventRef = window.database.ref(`${window.DATA_ROOT}/events/byDate/${dateKey}`).push();
                        
                        const eventData = {
                            id: eventRef.key,
                            department: department,
                            name: name,
                            startTime: startTime || null,
                            endTime: endTime || null,
                            count: count,
                            requiredPeople: requiredPeople,
                            date: dateKey,
                            isBulkEvent: true,
                            assignedCEs: [],
                            createdAt: firebase.database.ServerValue.TIMESTAMP,
                            createdBy: window.currentUserData?.displayName || 'unknown'
                        };
                        
                        updates[`${window.DATA_ROOT}/events/byDate/${dateKey}/${eventRef.key}`] = eventData;
                        eventCount++;
                    }
                }

                await window.database.ref().update(updates);

                document.getElementById('bulkEventModal').remove();
                window.showMessage(`${eventCount}件の業務を一括追加しました`, 'success');

                if (window.dashboardAuth) {
                    window.dashboardAuth.renderDailySchedule();
                }

            } catch (error) {
                console.error('❌ 期間一括業務保存エラー:', error);
                window.showMessage('期間一括業務の保存に失敗しました', 'error');
            }
        }

        // 月次業務追加モーダル（実施日なし版）
        openMonthlyTaskModal() {
            if (window.userRole === 'viewer') {
                window.showMessage('編集権限がありません', 'warning');
                return;
            }

            const modal = document.createElement('div');
            modal.id = 'monthlyTaskModal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="glass-card p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-bold">月次業務追加</h3>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <form id="monthlyTaskForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-bold mb-2">部門 *</label>
                            <select id="monthlyDepartment" class="input-unified" required>
                                <option value="">部門を選択</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">業務名 *</label>
                            <input type="text" id="monthlyTaskName" class="input-unified" 
                                   placeholder="例: 月次点検" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">実施月 *</label>
                            <select id="monthlyMonth" class="input-unified" required>
                                <option value="">月を選択</option>
                            </select>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold mb-2">予定件数</label>
                                <select id="monthlyEventCount" class="input-unified">
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-bold mb-2">必要人数</label>
                                <select id="monthlyRequiredPeople" class="input-unified">
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">詳細</label>
                            <textarea id="monthlyDescription" class="input-unified" rows="3"
                                      placeholder="月次業務の詳細"></textarea>
                        </div>
                        
                        <div class="flex space-x-3">
                            <button type="button" onclick="this.closest('.fixed').remove()" 
                                    class="btn-unified btn-outline-unified flex-1">
                                キャンセル
                            </button>
                            <button type="submit" class="btn-unified btn-primary-unified flex-1">
                                <i class="fas fa-calendar-alt mr-2"></i>追加
                            </button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);
            this.initializeMonthlyModal();
        }

        initializeMonthlyModal() {
            const deptSelect = document.getElementById('monthlyDepartment');
            if (window.DEPARTMENTS && deptSelect) {
                window.DEPARTMENTS.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept;
                    option.textContent = dept;
                    deptSelect.appendChild(option);
                });
            }

            const monthSelect = document.getElementById('monthlyMonth');
            if (monthSelect) {
                const currentMonth = new Date().getMonth() + 1;
                for (let i = 1; i <= 12; i++) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = `${i}月`;
                    option.selected = i === currentMonth;
                    monthSelect.appendChild(option);
                }
            }

            const countSelect = document.getElementById('monthlyEventCount');
            const peopleSelect = document.getElementById('monthlyRequiredPeople');
            
            [countSelect, peopleSelect].forEach((select, index) => {
                if (select) {
                    for (let i = 0; i <= (index === 0 ? 20 : 10); i++) {
                        const option = document.createElement('option');
                        option.value = i;
                        option.textContent = index === 0 ? `${i}件` : `${i}名`;
                        option.selected = i === 1;
                        select.appendChild(option);
                    }
                }
            });

            const form = document.getElementById('monthlyTaskForm');
            if (form) {
                form.onsubmit = (e) => {
                    e.preventDefault();
                    this.saveMonthlyTask();
                };
            }
        }

        async saveMonthlyTask() {
            const department = document.getElementById('monthlyDepartment')?.value;
            const name = document.getElementById('monthlyTaskName')?.value?.trim();
            const month = document.getElementById('monthlyMonth')?.value;
            const count = parseInt(document.getElementById('monthlyEventCount')?.value) || 0;
            const requiredPeople = parseInt(document.getElementById('monthlyRequiredPeople')?.value) || 0;
            const description = document.getElementById('monthlyDescription')?.value?.trim();

            if (!department || !name || !month) {
                window.showMessage('必須項目を入力してください', 'warning');
                return;
            }

            try {
                const taskData = {
                    id: `monthly_task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    department: department,
                    name: name,
                    month: parseInt(month),
                    count: count,
                    requiredPeople: requiredPeople,
                    description: description || null,
                    isMonthlyTask: true,
                    assignedCEs: [],
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    createdBy: window.currentUserData?.displayName || 'unknown'
                };

                await window.database.ref(`${window.DATA_ROOT}/monthlyTasks/${taskData.id}`).set(taskData);

                document.getElementById('monthlyTaskModal').remove();
                window.showMessage('月次業務を追加しました', 'success');

                console.log('✅ 月次業務保存完了:', taskData);

            } catch (error) {
                console.error('❌ 月次業務保存エラー:', error);
                window.showMessage('月次業務の保存に失敗しました', 'error');
            }
        }

        // ==========================================
        // 個人カード機能（Viewer個人業務入力）
        // ==========================================

        /**
         * 個人カード作成権限チェック
         */
        async checkPersonalCardPermission() {
            try {
                const snap = await window.database.ref(`${window.DATA_ROOT}/permissions`).once('value');
                const perms = snap.val() || {};
                return perms.viewerCanCreatePersonalCard === true;
            } catch(e) {
                console.error('❌ 権限チェックエラー:', e);
                return false;
            }
        }

        /**
         * 個人カード編集権限チェック
         * 作成者本人 または admin/editor のみ編集可能
         */
        canEditPersonalCard(card) {
            if (!card) return false;
            const myUid = sessionStorage.getItem('targetUID') || '';
            const myRole = window.userRole || sessionStorage.getItem('userRole') || 'viewer';
            if (myRole === 'admin' || myRole === 'editor') return true;
            if (card.uid === myUid) return true;
            return false;
        }

        /**
         * 個人カード作成モーダルを開く
         */
        async openPersonalCardModal() {
            // 権限チェック
            const allowed = await this.checkPersonalCardPermission();
            if (!allowed) {
                window.showMessage('個人業務入力が許可されていません', 'warning');
                return;
            }

            const existingModal = document.getElementById('personalCardModal');
            if (existingModal) existingModal.remove();

            const myUid = sessionStorage.getItem('targetUID') || '';
            const myUsername = sessionStorage.getItem('currentUsername') || '';
            const myDisplayName = window.currentUserData?.displayName || myUsername || 'ユーザー';
            const myRole = window.userRole || sessionStorage.getItem('userRole') || 'viewer';

            // 現在選択中の日付を取得（schedule.htmlのdashboardAuthから）
            let defaultDate = new Date().toISOString().slice(0, 10);
            if (window.dashboardAuth?.selectedDate) {
                const d = window.dashboardAuth.selectedDate;
                defaultDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }

            const modal = document.createElement('div');
            modal.id = 'personalCardModal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="glass-card personal-card-modal-content" style="border: 2px solid #6366f1;">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-bold" style="color: #4f46e5;">
                            <i class="fas fa-user-tag mr-2"></i>個人業務入力
                        </h3>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="mb-4 p-3 rounded-lg" style="background: #eef2ff; border: 1px solid #c7d2fe;">
                        <div class="text-sm font-semibold" style="color: #4338ca;">
                            <i class="fas fa-info-circle mr-1"></i>作成者: ${myDisplayName}
                        </div>
                        <div class="text-xs mt-1" style="color: #6366f1;">
                            あなたのアイコンが自動配置されます
                        </div>
                    </div>

                    <form id="personalCardForm" class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold mb-2">
                                    <i class="fas fa-building mr-2"></i>部門 *
                                </label>
                                <select id="pcDepartment" class="input-unified" required>
                                    <option value="">部門を選択</option>
                                </select>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-bold mb-2">
                                    <i class="fas fa-calendar mr-2"></i>日付 *
                                </label>
                                <input type="date" id="pcDate" class="input-unified" value="${defaultDate}" required>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">
                                <i class="fas fa-tasks mr-2"></i>業務名 *
                            </label>
                            <input type="text" id="pcName" class="input-unified" 
                                   placeholder="例: 個人業務記録" required>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold mb-2">
                                    <i class="fas fa-clock mr-2"></i>開始時間
                                </label>
                                <input type="time" id="pcStartTime" class="input-unified">
                            </div>
                            <div>
                                <label class="block text-sm font-bold mb-2">
                                    <i class="fas fa-clock mr-2"></i>終了時間
                                </label>
                                <input type="time" id="pcEndTime" class="input-unified">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold mb-2">
                                    <i class="fas fa-hashtag mr-2"></i>予定件数
                                </label>
                                <input type="number" id="pcCount" class="input-unified" min="0" max="99" value="0">
                            </div>
                            <div>
                                <label class="block text-sm font-bold mb-2">
                                    <i class="fas fa-users mr-2"></i>必要人数
                                </label>
                                <input type="number" id="pcRequiredPeople" class="input-unified" min="0" max="20" value="0">
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">
                                <i class="fas fa-info-circle mr-2"></i>詳細
                            </label>
                            <textarea id="pcDescription" class="input-unified" rows="2"
                                      placeholder="業務の詳細を入力（任意）"></textarea>
                        </div>

                        <!-- 追加CE選択エリア -->
                        <div>
                            <label class="block text-sm font-bold mb-2">
                                <i class="fas fa-user-plus mr-2"></i>追加CE（一緒に業務を行ったCE）
                            </label>
                            <div id="pcAdditionalCEList" class="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2 bg-white">
                                <p class="text-sm text-gray-400 italic">CEリストを読み込み中...</p>
                            </div>
                        </div>
                        
                        <div class="flex space-x-3">
                            <button type="button" onclick="this.closest('.fixed').remove()" 
                                    class="btn-unified btn-outline-unified flex-1">
                                キャンセル
                            </button>
                            <button type="submit" class="btn-unified btn-primary-unified flex-1" style="background: #6366f1;">
                                <i class="fas fa-save mr-2"></i>保存
                            </button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);
            this.initializePersonalCardModal(myUid, myDisplayName, myRole);
        }

        /**
         * 個人カードモーダル初期化
         */
        initializePersonalCardModal(myUid, myDisplayName, myRole) {
            // 部門選択肢
            const deptSelect = document.getElementById('pcDepartment');
            if (window.DEPARTMENTS && deptSelect) {
                window.DEPARTMENTS.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept;
                    option.textContent = dept;
                    deptSelect.appendChild(option);
                });
            }

            // 追加CEリスト生成
            const ceListContainer = document.getElementById('pcAdditionalCEList');
            const ceList = window.ceManager?.ceList || [];

            if (ceList.length === 0) {
                ceListContainer.innerHTML = '<p class="text-sm text-gray-400 italic">CEリストがありません</p>';
            } else {
                let ceHtml = '';
                ceList.forEach(ce => {
                    // 自分自身は除外（自動配置されるため）
                    const isMe = ce.fullName === myDisplayName || ce.name === myDisplayName;
                    if (isMe) {
                        ceHtml += `
                            <label class="flex items-center p-2 rounded bg-indigo-50" style="border: 1px solid #c7d2fe;">
                                <input type="checkbox" class="pc-ce-checkbox mr-2" value="${ce.id}" checked disabled
                                       data-ce-name="${ce.fullName || ce.name}" data-ce-worktype="${ce.workType || 'ME'}">
                                <span class="text-sm font-medium" style="color: #4338ca;">
                                    <i class="fas fa-user-check mr-1"></i>${ce.fullName || ce.name}（自分・自動配置）
                                </span>
                            </label>
                        `;
                    } else {
                        ceHtml += `
                            <label class="flex items-center p-2 rounded hover:bg-gray-50" style="border: 1px solid #e5e7eb;">
                                <input type="checkbox" class="pc-ce-checkbox mr-2" value="${ce.id}"
                                       data-ce-name="${ce.fullName || ce.name}" data-ce-worktype="${ce.workType || 'ME'}">
                                <span class="text-sm">${ce.fullName || ce.name}</span>
                            </label>
                        `;
                    }
                });
                ceListContainer.innerHTML = ceHtml;
            }

            // フォーム送信
            const form = document.getElementById('personalCardForm');
            if (form) {
                form.onsubmit = (e) => {
                    e.preventDefault();
                    this.savePersonalCard(myUid, myDisplayName, myRole);
                };
            }
        }

        /**
         * 個人カード保存
         */
        async savePersonalCard(myUid, myDisplayName, myRole) {
            const department = document.getElementById('pcDepartment')?.value;
            const name = document.getElementById('pcName')?.value?.trim();
            const date = document.getElementById('pcDate')?.value;
            const startTime = document.getElementById('pcStartTime')?.value;
            const endTime = document.getElementById('pcEndTime')?.value;
            const count = parseInt(document.getElementById('pcCount')?.value) || 0;
            const requiredPeople = parseInt(document.getElementById('pcRequiredPeople')?.value) || 0;
            const description = document.getElementById('pcDescription')?.value?.trim();

            if (!department || !name || !date) {
                window.showMessage('必須項目を入力してください', 'warning');
                return;
            }

            // 追加CE収集
            const selectedCEs = [];
            document.querySelectorAll('.pc-ce-checkbox:checked').forEach(cb => {
                selectedCEs.push({
                    id: cb.value,
                    name: cb.dataset.ceName || cb.value,
                    workType: cb.dataset.ceWorkType || 'ME'
                });
            });

            // 自分自身のCEエントリを先頭に追加
            const myCE = window.ceManager?.ceList?.find(ce => 
                ce.fullName === myDisplayName || ce.name === myDisplayName
            );
            const creatorCE = myCE 
                ? { id: myCE.id, name: myCE.iconName || myCE.displayName || myCE.name || myDisplayName, workType: myCE.workType || 'ME', isCreator: true }
                : { id: myUid, name: myDisplayName, workType: 'ME', isCreator: true };

            // 重複排除
            const allCEs = [creatorCE, ...selectedCEs.filter(ce => ce.id !== creatorCE.id)];

            try {
                const cardRef = window.database.ref(`${window.DATA_ROOT}/personalCards/byDate/${date}`).push();
                const cardData = {
                    id: cardRef.key,
                    uid: myUid,
                    username: sessionStorage.getItem('currentUsername') || '',
                    displayName: myDisplayName,
                    role: myRole,
                    department: department,
                    name: name,
                    date: date,
                    startTime: startTime || null,
                    endTime: endTime || null,
                    count: count,
                    requiredPeople: requiredPeople,
                    description: description || null,
                    additionalCEs: allCEs,
                    isPersonalCard: true,
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    createdBy: myDisplayName
                };

                await cardRef.set(cardData);

                // 監査ログ
                if (window.auditLogger) {
                    await window.auditLogger.logAction('personal-card-create', {
                        cardId: cardRef.key,
                        cardName: name,
                        department: department,
                        date: date,
                        additionalCECount: selectedCEs.length
                    });
                }

                document.getElementById('personalCardModal').remove();
                window.showMessage('個人業務カードを追加しました', 'success');

                // スケジュール画面を再レンダリング
                if (window.dashboardAuth && typeof window.dashboardAuth.loadAndRenderEventsForSelectedDate === 'function') {
                    setTimeout(() => {
                        window.dashboardAuth.loadAndRenderEventsForSelectedDate();
                    }, 500);
                }

                console.log('✅ 個人カード保存完了:', cardData);

            } catch (error) {
                console.error('❌ 個人カード保存エラー:', error);
                window.showMessage('個人業務カードの保存に失敗しました', 'error');
            }
        }

        /**
         * 個人カード編集モーダルを開く
         */
        openEditPersonalCardModal(card, dateKey) {
            const existingModal = document.getElementById('personalCardEditModal');
            if (existingModal) existingModal.remove();

            if (!this.canEditPersonalCard(card)) {
                window.showMessage('この個人カードの編集権限がありません', 'warning');
                return;
            }

            const myUid = sessionStorage.getItem('targetUID') || '';
            const myRole = window.userRole || sessionStorage.getItem('userRole') || 'viewer';

            const modal = document.createElement('div');
            modal.id = 'personalCardEditModal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="glass-card personal-card-modal-content" style="border: 2px solid #6366f1;">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-bold" style="color: #4f46e5;">
                            <i class="fas fa-user-edit mr-2"></i>個人業務編集
                        </h3>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="mb-4 p-3 rounded-lg" style="background: #eef2ff; border: 1px solid #c7d2fe;">
                        <div class="text-sm font-semibold" style="color: #4338ca;">
                            <i class="fas fa-user mr-1"></i>作成者: ${card.displayName || card.username || '不明'}
                        </div>
                    </div>

                    <form id="personalCardEditForm" class="space-y-4">
                        <input type="hidden" id="pceCardId" value="${card.id}">
                        <input type="hidden" id="pceDateKey" value="${dateKey}">
                        <input type="hidden" id="pceUid" value="${card.uid}">

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold mb-2">
                                    <i class="fas fa-building mr-2"></i>部門 *
                                </label>
                                <select id="pceDepartment" class="input-unified" required>
                                    <option value="">部門を選択</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-bold mb-2">
                                    <i class="fas fa-calendar mr-2"></i>日付 *
                                </label>
                                <input type="date" id="pceDate" class="input-unified" value="${dateKey}" required>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">
                                <i class="fas fa-tasks mr-2"></i>業務名 *
                            </label>
                            <input type="text" id="pceName" class="input-unified" value="${card.name || ''}" required>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold mb-2">
                                    <i class="fas fa-clock mr-2"></i>開始時間
                                </label>
                                <input type="time" id="pceStartTime" class="input-unified" value="${card.startTime || ''}">
                            </div>
                            <div>
                                <label class="block text-sm font-bold mb-2">
                                    <i class="fas fa-clock mr-2"></i>終了時間
                                </label>
                                <input type="time" id="pceEndTime" class="input-unified" value="${card.endTime || ''}">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold mb-2">
                                    <i class="fas fa-hashtag mr-2"></i>予定件数
                                </label>
                                <input type="number" id="pceCount" class="input-unified" min="0" max="99" value="${card.count || 0}">
                            </div>
                            <div>
                                <label class="block text-sm font-bold mb-2">
                                    <i class="fas fa-users mr-2"></i>必要人数
                                </label>
                                <input type="number" id="pceRequiredPeople" class="input-unified" min="0" max="20" value="${card.requiredPeople || 0}">
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">
                                <i class="fas fa-info-circle mr-2"></i>詳細
                            </label>
                            <textarea id="pceDescription" class="input-unified" rows="2">${card.description || ''}</textarea>
                        </div>

                        <div>
                            <label class="block text-sm font-bold mb-2">
                                <i class="fas fa-user-plus mr-2"></i>追加CE
                            </label>
                            <div id="pceAdditionalCEList" class="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2 bg-white">
                                <p class="text-sm text-gray-400 italic">CEリストを読み込み中...</p>
                            </div>
                        </div>
                        
                        <div class="flex space-x-3">
                            <button type="button" id="pceDeleteBtn" class="btn-unified btn-outline-unified" style="border-color: #ef4444; color: #ef4444;">
                                <i class="fas fa-trash mr-2"></i>削除
                            </button>
                            <button type="button" onclick="this.closest('.fixed').remove()" 
                                    class="btn-unified btn-outline-unified flex-1">
                                キャンセル
                            </button>
                            <button type="submit" class="btn-unified btn-primary-unified flex-1" style="background: #6366f1;">
                                <i class="fas fa-save mr-2"></i>更新
                            </button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);
            this.initializePersonalCardEditModal(card, dateKey);
        }

        /**
         * 個人カード編集モーダル初期化
         */
        initializePersonalCardEditModal(card, dateKey) {
            // 部門選択肢
            const deptSelect = document.getElementById('pceDepartment');
            if (window.DEPARTMENTS && deptSelect) {
                window.DEPARTMENTS.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept;
                    option.textContent = dept;
                    if (card.department === dept) option.selected = true;
                    deptSelect.appendChild(option);
                });
            }

            // 既存の追加CEのIDリスト
            const existingCEIds = (card.additionalCEs || []).map(ce => ce.id);

            // 追加CEリスト生成
            const ceListContainer = document.getElementById('pceAdditionalCEList');
            const ceList = window.ceManager?.ceList || [];
            const myDisplayName = card.displayName || '';

            if (ceList.length === 0) {
                ceListContainer.innerHTML = '<p class="text-sm text-gray-400 italic">CEリストがありません</p>';
            } else {
                let ceHtml = '';
                ceList.forEach(ce => {
                    const isMe = ce.fullName === myDisplayName || ce.name === myDisplayName;
                    const isChecked = existingCEIds.includes(ce.id);
                    
                    if (isMe) {
                        ceHtml += `
                            <label class="flex items-center p-2 rounded bg-indigo-50" style="border: 1px solid #c7d2fe;">
                                <input type="checkbox" class="pce-ce-checkbox mr-2" value="${ce.id}" ${isChecked ? 'checked' : ''} disabled
                                       data-ce-name="${ce.fullName || ce.name}" data-ce-worktype="${ce.workType || 'ME'}">
                                <span class="text-sm font-medium" style="color: #4338ca;">
                                    <i class="fas fa-user-check mr-1"></i>${ce.fullName || ce.name}（作成者・自動配置）
                                </span>
                            </label>
                        `;
                    } else {
                        ceHtml += `
                            <label class="flex items-center p-2 rounded hover:bg-gray-50" style="border: 1px solid #e5e7eb;">
                                <input type="checkbox" class="pce-ce-checkbox mr-2" value="${ce.id}" ${isChecked ? 'checked' : ''}
                                       data-ce-name="${ce.fullName || ce.name}" data-ce-worktype="${ce.workType || 'ME'}">
                                <span class="text-sm">${ce.fullName || ce.name}</span>
                            </label>
                        `;
                    }
                });
                ceListContainer.innerHTML = ceHtml;
            }

            // フォーム送信
            const form = document.getElementById('personalCardEditForm');
            if (form) {
                form.onsubmit = (e) => {
                    e.preventDefault();
                    this.updatePersonalCard(card, dateKey);
                };
            }

            // 削除ボタン
            const deleteBtn = document.getElementById('pceDeleteBtn');
            if (deleteBtn) {
                deleteBtn.onclick = () => this.deletePersonalCard(card, dateKey);
            }
        }

        /**
         * 個人カード更新
         */
        async updatePersonalCard(card, dateKey) {
            if (!this.canEditPersonalCard(card)) {
                window.showMessage('編集権限がありません', 'warning');
                return;
            }

            const department = document.getElementById('pceDepartment')?.value;
            const name = document.getElementById('pceName')?.value?.trim();
            const date = document.getElementById('pceDate')?.value;
            const startTime = document.getElementById('pceStartTime')?.value;
            const endTime = document.getElementById('pceEndTime')?.value;
            const count = parseInt(document.getElementById('pceCount')?.value) || 0;
            const requiredPeople = parseInt(document.getElementById('pceRequiredPeople')?.value) || 0;
            const description = document.getElementById('pceDescription')?.value?.trim();

            if (!department || !name || !date) {
                window.showMessage('必須項目を入力してください', 'warning');
                return;
            }

            // 追加CE収集
            const selectedCEs = [];
            document.querySelectorAll('.pce-ce-checkbox:checked').forEach(cb => {
                selectedCEs.push({
                    id: cb.value,
                    name: cb.dataset.ceName || cb.value,
                    workType: cb.dataset.ceWorkType || 'ME'
                });
            });

            // 作成者CEを先頭に
            const myCE = window.ceManager?.ceList?.find(ce => 
                ce.fullName === card.displayName || ce.name === card.displayName
            );
            const creatorCE = myCE 
                ? { id: myCE.id, name: myCE.iconName || myCE.displayName || myCE.name || card.displayName, workType: myCE.workType || 'ME', isCreator: true }
                : { id: card.uid, name: card.displayName, workType: 'ME', isCreator: true };

            const allCEs = [creatorCE, ...selectedCEs.filter(ce => ce.id !== creatorCE.id)];

            try {
                // 日付が変更された場合は移動
                if (date !== dateKey) {
                    await window.database.ref(`${window.DATA_ROOT}/personalCards/byDate/${dateKey}/${card.id}`).remove();
                    const newRef = window.database.ref(`${window.DATA_ROOT}/personalCards/byDate/${date}/${card.id}`);
                    await newRef.set({
                        ...card,
                        department, name, date, startTime: startTime || null, endTime: endTime || null,
                        count, requiredPeople, description: description || null,
                        additionalCEs: allCEs,
                        updatedAt: firebase.database.ServerValue.TIMESTAMP,
                        updatedBy: window.currentUserData?.displayName || card.displayName
                    });
                } else {
                    await window.database.ref(`${window.DATA_ROOT}/personalCards/byDate/${dateKey}/${card.id}`).update({
                        department, name, date, startTime: startTime || null, endTime: endTime || null,
                        count, requiredPeople, description: description || null,
                        additionalCEs: allCEs,
                        updatedAt: firebase.database.ServerValue.TIMESTAMP,
                        updatedBy: window.currentUserData?.displayName || card.displayName
                    });
                }

                // 監査ログ
                if (window.auditLogger) {
                    await window.auditLogger.logAction('personal-card-edit', {
                        cardId: card.id,
                        cardName: name,
                        department: department,
                        date: date,
                        previousDate: dateKey
                    });
                }

                document.getElementById('personalCardEditModal').remove();
                window.showMessage('個人業務カードを更新しました', 'success');

                if (window.dashboardAuth && typeof window.dashboardAuth.loadAndRenderEventsForSelectedDate === 'function') {
                    setTimeout(() => {
                        window.dashboardAuth.loadAndRenderEventsForSelectedDate();
                    }, 500);
                }

                console.log('✅ 個人カード更新完了:', card.id);

            } catch (error) {
                console.error('❌ 個人カード更新エラー:', error);
                window.showMessage('個人業務カードの更新に失敗しました', 'error');
            }
        }

        /**
         * 個人カード削除
         */
        async deletePersonalCard(card, dateKey) {
            if (!this.canEditPersonalCard(card)) {
                window.showMessage('削除権限がありません', 'warning');
                return;
            }

            if (!confirm(`個人業務カード「${card.name}」を削除しますか？\n\nこの操作は取り消せません。`)) {
                return;
            }

            try {
                await window.database.ref(`${window.DATA_ROOT}/personalCards/byDate/${dateKey}/${card.id}`).remove();

                // 監査ログ
                if (window.auditLogger) {
                    await window.auditLogger.logAction('personal-card-delete', {
                        cardId: card.id,
                        cardName: card.name,
                        department: card.department,
                        date: dateKey,
                        createdBy: card.displayName
                    });
                }

                document.getElementById('personalCardEditModal')?.remove();
                window.showMessage('個人業務カードを削除しました', 'success');

                if (window.dashboardAuth && typeof window.dashboardAuth.loadAndRenderEventsForSelectedDate === 'function') {
                    setTimeout(() => {
                        window.dashboardAuth.loadAndRenderEventsForSelectedDate();
                    }, 500);
                }

                console.log('✅ 個人カード削除完了:', card.id);

            } catch (error) {
                console.error('❌ 個人カード削除エラー:', error);
                window.showMessage('個人業務カードの削除に失敗しました', 'error');
            }
        }

        /**
         * 指定日付の個人カードをFirebaseから読み込む
         * schedule.htmlから呼び出される
         */
        async loadPersonalCardsForDate(dateKey) {
            try {
                const snap = await window.database.ref(`${window.DATA_ROOT}/personalCards/byDate/${dateKey}`).once('value');
                const cardsById = snap.val() || {};
                return Object.values(cardsById);
            } catch (error) {
                console.error('❌ 個人カード読み込みエラー:', error);
                return [];
            }
        }

        /**
         * 個人カードのHTML要素を生成
         * schedule.htmlのレンダリングから呼び出される
         */
        createPersonalCardElement(card, dateKey) {
            const item = document.createElement('div');
            item.className = 'glass-card p-3 mb-2 rounded-lg shadow-sm event-card personal-card';
            item.style.border = '2px solid #6366f1';
            item.dataset.cardId = card.id;
            item.dataset.dateKey = dateKey;
            item.dataset.department = card.department || '';
            item.dataset.isPersonalCard = 'true';

            const timeText = (card.startTime && card.endTime) ? ` ${card.startTime}-${card.endTime}` : '';
            const additionalCEs = card.additionalCEs || [];
            const assignedCount = additionalCEs.length;
            const need = Number.isFinite(card.requiredPeople) ? card.requiredPeople : 0;

            // CEチップ生成
            const ceChipsHtml = additionalCEs.map(ce => {
                const wt = String(ce.workType || 'ME').toLowerCase();
                const creatorBadge = ce.isCreator ? '<span class="ml-1 text-[8px] bg-indigo-200 text-indigo-700 px-1 rounded">作成者</span>' : '';
                return `<span class="ce-chip worktype-${wt}" data-ce-id="${ce.id}" title="${ce.name}">${ce.name}${creatorBadge}</span>`;
            }).join('');

            // 予定件数
            const countDisplay = Number.isFinite(card.count) && card.count > 0
                ? `<div class="event-count-display">予定件数: ${card.count}件</div>`
                : '';

            // 編集権限
            const canEdit = this.canEditPersonalCard(card);
            const editButtons = canEdit 
                ? `<div class="flex gap-2 mt-2">
                    <button class="edit-personal-card-btn text-indigo-600 hover:text-indigo-800 text-xs">
                        <i class="fas fa-edit mr-1"></i>編集
                    </button>
                    <button class="delete-personal-card-btn text-red-600 hover:text-red-800 text-xs">
                        <i class="fas fa-trash mr-1"></i>削除
                    </button>
                  </div>`
                : '';

            item.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <div class="font-semibold text-sm">
                        <i class="fas fa-user-tag mr-1 text-indigo-500"></i>${card.name}${timeText}
                        <span class="ml-1 text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded">個人</span>
                    </div>
                    <div class="text-xs text-gray-500">${assignedCount}/${need}名</div>
                </div>
                ${countDisplay}
                ${card.description ? `<div class="text-xs text-gray-600 mb-2">${card.description}</div>` : ''}
                <div class="assigned-ces">
                    ${ceChipsHtml}
                </div>
                <div class="text-xs text-gray-400 mt-1 italic">作成者: ${card.displayName || card.username || '不明'}</div>
                ${editButtons}
            `;

            // 編集ボタン
            const editBtn = item.querySelector('.edit-personal-card-btn');
            if (editBtn) {
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.openEditPersonalCardModal(card, dateKey);
                };
            }

            // 削除ボタン
            const deleteBtn = item.querySelector('.delete-personal-card-btn');
            if (deleteBtn) {
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.deletePersonalCard(card, dateKey);
                };
            }

            return item;
        }

        /**
         * 個人カードボタンの表示制御
         * schedule.htmlの初期化時に呼び出される
         */
        async updatePersonalCardButtonVisibility() {
            const btn = document.getElementById('addPersonalCardBtn');
            if (!btn) return;

            const allowed = await this.checkPersonalCardPermission();

            if (allowed) {
                btn.classList.remove('is-force-hidden');
                btn.style.removeProperty('display');
            } else {
                btn.classList.add('is-force-hidden');
                btn.style.setProperty('display', 'none', 'important');
            }
        }
    }

    window.EventManager = EventManager;
    console.log('📅 イベントマネージャークラス読み込み完了（個人カード機能対応版）');
})();
