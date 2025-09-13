/**
 * イベント管理システム - V2統合版（完全修正）
 */
(function() {
    'use strict';

    class EventManager {
        constructor() {
            this.isInitialized = false;
            this.currentEditingEvent = null;
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
                    window.DEPARTMENTS && window.showModal && window.closeModal) {
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            throw new Error('EventManager: 依存関係の初期化タイムアウト');
        }

        setupEventListeners() {
            // 既存のイベントリスナーの重複を防ぐ
            const buttons = [
                { id: 'addEventButtonDaily', method: 'openAddEventModal' },
                { id: 'addBulkEventBtn', method: 'openBulkAddModal' },
                { id: 'addMonthlyTaskBtn', method: 'openMonthlyTaskModal' }
            ];

            buttons.forEach(({ id, method }) => {
                const btn = document.getElementById(id);
                if (btn && !btn.dataset.eventManagerBound) {
                    btn.dataset.eventManagerBound = 'true';
                    btn.onclick = () => this[method]();
                }
            });
        }

        // 業務追加モーダル
        openAddEventModal(department = null) {
            if (window.userRole === 'viewer') {
                window.showMessage('編集権限がありません', 'warning');
                return;
            }

            this.createAddEventModal(department);
        }

        createAddEventModal(selectedDepartment = null) {
            // 既存のモーダルを削除
            const existingModal = document.getElementById('addEventModal');
            if (existingModal) existingModal.remove();

            const modal = document.createElement('div');
            modal.id = 'addEventModal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="glass-card p-6 max-w-md w-full mx-4">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-bold">業務追加</h3>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <form id="addEventForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-bold mb-2">
                                <i class="fas fa-building mr-2"></i>部門 *
                            </label>
                            <select id="eventDepartment" class="input-unified" required>
                                <option value="">部門を選択</option>
                                ${window.DEPARTMENTS.map(dept => 
                                    `<option value="${dept}" ${dept === selectedDepartment ? 'selected' : ''}>${dept}</option>`
                                ).join('')}
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">
                                <i class="fas fa-tasks mr-2"></i>業務名 *
                            </label>
                            <input type="text" id="eventName" class="input-unified" 
                                   placeholder="例: 手術室メンテナンス" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">
                                <i class="fas fa-clock mr-2"></i>時間
                            </label>
                            <input type="time" id="eventTime" class="input-unified">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">
                                <i class="fas fa-calendar mr-2"></i>日付 *
                            </label>
                            <input type="date" id="eventDate" class="input-unified" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">
                                <i class="fas fa-info-circle mr-2"></i>詳細
                            </label>
                            <textarea id="eventDescription" class="input-unified" rows="3"
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

            // 今日の日付をデフォルトに設定
            const dateInput = document.getElementById('eventDate');
            if (dateInput && window.dashboardAuth?.selectedDate) {
                dateInput.value = window.dashboardAuth.selectedDate.toISOString().slice(0, 10);
            }

            // フォーム送信イベント
            const form = document.getElementById('addEventForm');
            if (form) {
                form.onsubmit = (e) => {
                    e.preventDefault();
                    this.saveEvent();
                };
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
                <div class="glass-card p-6 max-w-lg w-full mx-4">
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
                                ${window.DEPARTMENTS.map(dept => `<option value="${dept}">${dept}</option>`).join('')}
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">業務名 *</label>
                            <input type="text" id="bulkEventName" class="input-unified" 
                                   placeholder="例: 定期メンテナンス" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">実施曜日</label>
                            <div class="flex space-x-2">
                                ${['月', '火', '水', '木', '金', '土', '日'].map((day, index) => `
                                    <label class="flex items-center">
                                        <input type="checkbox" value="${index + 1}" class="bulk-weekday mr-1">
                                        <span class="text-sm">${day}</span>
                                    </label>
                                `).join('')}
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

            const form = document.getElementById('bulkEventForm');
            if (form) {
                form.onsubmit = (e) => {
                    e.preventDefault();
                    this.saveBulkEvent();
                };
            }
        }

        // 月次業務追加モーダル
        openMonthlyTaskModal() {
            if (window.userRole === 'viewer') {
                window.showMessage('編集権限がありません', 'warning');
                return;
            }

            const modal = document.createElement('div');
            modal.id = 'monthlyTaskModal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="glass-card p-6 max-w-md w-full mx-4">
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
                                ${window.DEPARTMENTS.map(dept => `<option value="${dept}">${dept}</option>`).join('')}
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">業務名 *</label>
                            <input type="text" id="monthlyTaskName" class="input-unified" 
                                   placeholder="例: 月次点検" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold mb-2">実施日 *</label>
                            <select id="monthlyDay" class="input-unified" required>
                                <option value="">日を選択</option>
                                ${Array.from({length: 31}, (_, i) => 
                                    `<option value="${i + 1}">${i + 1}日</option>`
                                ).join('')}
                                <option value="last">月末</option>
                            </select>
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

            const form = document.getElementById('monthlyTaskForm');
            if (form) {
                form.onsubmit = (e) => {
                    e.preventDefault();
                    this.saveMonthlyTask();
                };
            }
        }

        // 業務保存処理
        async saveEvent() {
            const department = document.getElementById('eventDepartment')?.value;
            const name = document.getElementById('eventName')?.value?.trim();
            const time = document.getElementById('eventTime')?.value;
            const date = document.getElementById('eventDate')?.value;
            const description = document.getElementById('eventDescription')?.value?.trim();

            if (!department || !name || !date) {
                window.showMessage('必須項目を入力してください', 'warning');
                return;
            }

            try {
                const eventData = {
                    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    department: department,
                    name: name,
                    time: time || null,
                    date: date,
                    description: description || null,
                    assignedCEs: [],
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    createdBy: window.currentUserData?.displayName || 'unknown'
                };

                await window.database.ref(`${window.DATA_ROOT}/events/${eventData.id}`).set(eventData);

                document.getElementById('addEventModal').remove();
                window.showMessage('業務を追加しました', 'success');

                // ダッシュボード更新
                if (window.dashboardAuth) {
                    window.dashboardAuth.renderDailySchedule();
                }

            } catch (error) {
                console.error('❌ 業務保存エラー:', error);
                window.showMessage('業務の保存に失敗しました', 'error');
            }
        }

        // 期間一括業務保存処理
        async saveBulkEvent() {
            const startDate = document.getElementById('bulkStartDate')?.value;
            const endDate = document.getElementById('bulkEndDate')?.value;
            const department = document.getElementById('bulkDepartment')?.value;
            const name = document.getElementById('bulkEventName')?.value?.trim();
            
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
                const events = [];
                
                for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
                    const weekday = date.getDay() === 0 ? 7 : date.getDay();
                    
                    if (selectedWeekdays.includes(weekday)) {
                        const eventData = {
                            id: `bulk_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            department: department,
                            name: name,
                            date: date.toISOString().slice(0, 10),
                            isBulkEvent: true,
                            assignedCEs: [],
                            createdAt: firebase.database.ServerValue.TIMESTAMP,
                            createdBy: window.currentUserData?.displayName || 'unknown'
                        };
                        events.push(eventData);
                    }
                }

                // バッチで保存
                const updates = {};
                events.forEach(event => {
                    updates[`${window.DATA_ROOT}/events/${event.id}`] = event;
                });

                await window.database.ref().update(updates);

                document.getElementById('bulkEventModal').remove();
                window.showMessage(`${events.length}件の業務を一括追加しました`, 'success');

                if (window.dashboardAuth) {
                    window.dashboardAuth.renderDailySchedule();
                }

            } catch (error) {
                console.error('❌ 期間一括業務保存エラー:', error);
                window.showMessage('期間一括業務の保存に失敗しました', 'error');
            }
        }

        // 月次業務保存処理
        async saveMonthlyTask() {
            const department = document.getElementById('monthlyDepartment')?.value;
            const name = document.getElementById('monthlyTaskName')?.value?.trim();
            const day = document.getElementById('monthlyDay')?.value;
            const description = document.getElementById('monthlyDescription')?.value?.trim();

            if (!department || !name || !day) {
                window.showMessage('必須項目を入力してください', 'warning');
                return;
            }

            try {
                const taskData = {
                    id: `monthly_task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    department: department,
                    name: name,
                    day: day,
                    description: description || null,
                    isMonthlyTask: true,
                    assignedCEs: [],
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    createdBy: window.currentUserData?.displayName || 'unknown'
                };

                await window.database.ref(`${window.DATA_ROOT}/monthlyTasks/${taskData.id}`).set(taskData);

                document.getElementById('monthlyTaskModal').remove();
                window.showMessage('月次業務を追加しました', 'success');

                if (window.dashboardAuth) {
                    window.dashboardAuth.renderDailySchedule();
                }

            } catch (error) {
                console.error('❌ 月次業務保存エラー:', error);
                window.showMessage('月次業務の保存に失敗しました', 'error');
            }
        }
    }

    window.EventManager = EventManager;
    console.log('📅 イベントマネージャークラス読み込み完了（完全修正版）');
})();
