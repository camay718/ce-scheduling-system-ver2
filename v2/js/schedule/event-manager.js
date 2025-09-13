/**
 * イベント管理システム - 業務追加機能
 */
(function() {
    'use strict';

    class EventManager {
        constructor() {
    this.events = {};
    this.monthlyTasks = {}; // 追加
    this.isInitialized = false;
    this.init();
}

        async init() {
    try {
        await this.waitForDependencies();
        await this.setupRealtimeListener();
        await this.setupMonthlyTasksListener(); // この行を追加
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
        }

        async setupRealtimeListener() {
            this.dbRef = window.database.ref(`${window.DATA_ROOT}/events`);
            
            this.dbRef.on('value', snapshot => {
                if (snapshot.exists()) {
                    this.events = snapshot.val();
                } else {
                    this.events = {};
                }
                this.renderEvents();
            });
        }

        setupEventListeners() {
            const addEventBtn = document.getElementById('addEventButtonDaily');
            if (addEventBtn && !addEventBtn.dataset.eventManagerBound) {
                addEventBtn.dataset.eventManagerBound = 'true';
                addEventBtn.addEventListener('click', () => this.openAddEventModal());
            }

            const bulkEventBtn = document.getElementById('addBulkEventBtn');
            if (bulkEventBtn && !bulkEventBtn.dataset.eventManagerBound) {
                bulkEventBtn.dataset.eventManagerBound = 'true';
                bulkEventBtn.addEventListener('click', () => this.openBulkAddEventModal());
            }

            const monthlyTaskBtn = document.getElementById('addMonthlyTaskBtn');
            if (monthlyTaskBtn && !monthlyTaskBtn.dataset.eventManagerBound) {
                monthlyTaskBtn.dataset.eventManagerBound = 'true';
                monthlyTaskBtn.addEventListener('click', () => this.openMonthlyTaskModal());
            }
        }

        openAddEventModal(department = null) {
            if (window.userRole === 'viewer') {
                window.showMessage('編集権限がありません', 'warning');
                return;
            }

            const modal = this.createEventModal(department);
            document.body.appendChild(modal);
        }

        createEventModal(defaultDepartment = null) {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
               <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">業務追加</h3>
        <form id="addEventForm">
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">部門</label>
                <select id="eventDepartment" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                    <option value="">部門を選択</option>
                    ${window.DEPARTMENTS.map(dept => 
                        `<option value="${dept}" ${defaultDepartment === dept ? 'selected' : ''}>${dept}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">業務名</label>
                <input type="text" id="eventTitle" required 
                       class="w-full px-3 py-2 border border-gray-300 rounded-md"
                       placeholder="例: 機器点検">
            </div>
            <div class="grid grid-cols-2 gap-3 mb-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">開始時間</label>
                    <input type="time" id="eventStartTime" required 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md"
                           value="08:00">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">終了時間</label>
                    <input type="time" id="eventEndTime" required 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md"
                           value="17:00">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3 mb-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">件数</label>
                    <input type="number" id="eventCount" min="1" value="1" required
                           class="w-full px-3 py-2 border border-gray-300 rounded-md">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">必要人数</label>
                    <input type="number" id="eventRequiredPeople" min="1" value="1" required
                           class="w-full px-3 py-2 border border-gray-300 rounded-md">
                </div>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">説明（任意）</label>
                <textarea id="eventDescription" 
                          class="w-full px-3 py-2 border border-gray-300 rounded-md" 
                          rows="3" placeholder="業務の詳細説明"></textarea>
            </div>
            <div class="flex space-x-4">
                <button type="button" onclick="this.closest('.fixed').remove()" 
                        class="flex-1 bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600">
                    キャンセル
                </button>
                <button type="submit" 
                        class="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
                    追加
                </button>
            </div>
        </form>
    </div>
`;

            const form = modal.querySelector('#addEventForm');
            if (form) {
                form.onsubmit = (e) => {
                    e.preventDefault();
                    this.handleAddEvent(modal);
                };
            }

            return modal;
        }

   async handleAddEvent(modal) {
    try {
        const department = document.getElementById('eventDepartment').value;
        const title = document.getElementById('eventTitle').value.trim();
        const startTime = document.getElementById('eventStartTime').value;
        const endTime = document.getElementById('eventEndTime').value;
        const count = parseInt(document.getElementById('eventCount').value) || 1;
        const requiredPeople = parseInt(document.getElementById('eventRequiredPeople').value) || 1;
        const description = document.getElementById('eventDescription').value.trim();

        if (!department || !title || !startTime || !endTime) {
            window.showMessage('必須項目を入力してください', 'error');
            return;
        }

        const currentDate = window.dashboardAuth?.selectedDate || new Date();
        const dateKey = this.formatDateKey(currentDate);

        const eventData = {
            id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: title,
            department: department,
            date: dateKey,
            startTime: startTime,
            endTime: endTime,
            count: count,
            requiredPeople: requiredPeople,
            description: description,
            assignedCEs: [],
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            createdBy: window.currentUserData?.displayName || 'unknown'
        };

        await window.database.ref(`${window.DATA_ROOT}/events/${eventData.id}`).set(eventData);

        modal.remove();
        window.showMessage('業務を追加しました', 'success');

    } catch (error) {
        console.error('❌ 業務追加エラー:', error);
        window.showMessage('業務の追加に失敗しました', 'error');
    }
}

        renderEvents() {
            if (!window.dashboardAuth?.selectedDate) return;

            const currentDate = window.dashboardAuth.selectedDate;
            const dateKey = this.formatDateKey(currentDate);

            window.DEPARTMENTS.forEach(department => {
                const taskList = document.querySelector(`[data-department="${department}"] .task-list`);
                if (!taskList) return;

                const dayEvents = Object.values(this.events).filter(event => 
                    event.date === dateKey && event.department === department
                );

                taskList.innerHTML = '';

                if (dayEvents.length === 0) {
                    taskList.innerHTML = '<p class="text-gray-500 text-sm">業務なし</p>';
                    return;
                }

                dayEvents.forEach(event => {
                    const eventElement = document.createElement('div');
                    eventElement.className = 'event-item p-2 border rounded mb-2 bg-white shadow-sm';
                    eventElement.innerHTML = `
                       <div class="flex justify-between items-start">
        <div class="flex-1">
            <h4 class="font-medium text-sm">${event.title}</h4>
            <p class="text-xs text-gray-600">${event.startTime} - ${event.endTime}</p>
            <p class="text-xs text-gray-600">件数: ${event.count || 1} / 必要人数: ${event.requiredPeople || 1}</p>
            ${event.description ? `<p class="text-xs text-gray-500 mt-1">${event.description}</p>` : ''}
        </div>
        ${window.userRole !== 'viewer' ? `
            <button onclick="window.eventManager.deleteEvent('${event.id}')" 
                    class="text-red-600 hover:text-red-800 text-xs">
                <i class="fas fa-trash"></i>
            </button>
        ` : ''}
    </div>
`;
                    
                    taskList.appendChild(eventElement);
                });
            });
        }

        async deleteEvent(eventId) {
            if (!confirm('この業務を削除しますか？')) return;

            try {
                await window.database.ref(`${window.DATA_ROOT}/events/${eventId}`).remove();
                window.showMessage('業務を削除しました', 'success');
            } catch (error) {
                console.error('❌ 業務削除エラー:', error);
                window.showMessage('業務の削除に失敗しました', 'error');
            }
        }

        openBulkAddEventModal() {
    if (window.userRole === 'viewer') {
        window.showMessage('編集権限がありません', 'warning');
        return;
    }

    const modal = this.createBulkEventModal();
    document.body.appendChild(modal);
}

createBulkEventModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white p-6 rounded-lg max-w-lg w-full mx-4">
            <h3 class="text-lg font-semibold mb-4 text-purple-600">
                <i class="fas fa-calendar-plus mr-2"></i>期間一括業務追加
            </h3>
            <form id="addBulkEventForm">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">部門</label>
                    <select id="bulkEventDepartment" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                        <option value="">部門を選択</option>
                        ${window.DEPARTMENTS.map(dept => 
                            `<option value="${dept}">${dept}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">業務名</label>
                    <input type="text" id="bulkEventTitle" required 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md"
                           placeholder="例: 定期点検">
                </div>
                <div class="grid grid-cols-2 gap-3 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">開始日</label>
                        <input type="date" id="bulkEventStartDate" required
                               class="w-full px-3 py-2 border border-gray-300 rounded-md">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">終了日</label>
                        <input type="date" id="bulkEventEndDate" required
                               class="w-full px-3 py-2 border border-gray-300 rounded-md">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">開始時間</label>
                        <input type="time" id="bulkEventStartTime" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md"
                               value="08:00">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">終了時間</label>
                        <input type="time" id="bulkEventEndTime" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md"
                               value="17:00">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">件数</label>
                        <input type="number" id="bulkEventCount" min="1" value="1" required
                               class="w-full px-3 py-2 border border-gray-300 rounded-md">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">必要人数</label>
                        <input type="number" id="bulkEventRequiredPeople" min="1" value="1" required
                               class="w-full px-3 py-2 border border-gray-300 rounded-md">
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">適用曜日</label>
                    <div class="flex flex-wrap gap-2">
                        <label class="flex items-center">
                            <input type="checkbox" id="bulkDay0" class="mr-1" value="0">
                            <span class="text-sm">日</span>
                        </label>
                        <label class="flex items-center">
                            <input type="checkbox" id="bulkDay1" class="mr-1" value="1" checked>
                            <span class="text-sm">月</span>
                        </label>
                        <label class="flex items-center">
                            <input type="checkbox" id="bulkDay2" class="mr-1" value="2" checked>
                            <span class="text-sm">火</span>
                        </label>
                        <label class="flex items-center">
                            <input type="checkbox" id="bulkDay3" class="mr-1" value="3" checked>
                            <span class="text-sm">水</span>
                        </label>
                        <label class="flex items-center">
                            <input type="checkbox" id="bulkDay4" class="mr-1" value="4" checked>
                            <span class="text-sm">木</span>
                        </label>
                        <label class="flex items-center">
                            <input type="checkbox" id="bulkDay5" class="mr-1" value="5" checked>
                            <span class="text-sm">金</span>
                        </label>
                        <label class="flex items-center">
                            <input type="checkbox" id="bulkDay6" class="mr-1" value="6">
                            <span class="text-sm">土</span>
                        </label>
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">説明（任意）</label>
                    <textarea id="bulkEventDescription" 
                              class="w-full px-3 py-2 border border-gray-300 rounded-md" 
                              rows="3" placeholder="業務の詳細説明"></textarea>
                </div>
                <div class="flex space-x-4">
                    <button type="button" onclick="this.closest('.fixed').remove()" 
                            class="flex-1 bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600">
                        キャンセル
                    </button>
                    <button type="submit" 
                            class="flex-1 bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700">
                        <i class="fas fa-calendar-plus mr-2"></i>期間一括追加
                    </button>
                </div>
            </form>
        </div>
    `;

    const form = modal.querySelector('#addBulkEventForm');
    if (form) {
        // 現在の日付を初期値に設定
        const today = new Date();
        const startDateInput = modal.querySelector('#bulkEventStartDate');
        const endDateInput = modal.querySelector('#bulkEventEndDate');
        
        if (startDateInput) {
            startDateInput.value = today.toISOString().slice(0, 10);
        }
        if (endDateInput) {
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            endDateInput.value = nextWeek.toISOString().slice(0, 10);
        }

        form.onsubmit = (e) => {
            e.preventDefault();
            this.handleAddBulkEvent(modal);
        };
    }

    return modal;
}

async handleAddBulkEvent(modal) {
    try {
        const department = document.getElementById('bulkEventDepartment').value;
        const title = document.getElementById('bulkEventTitle').value.trim();
        const startDate = new Date(document.getElementById('bulkEventStartDate').value + 'T00:00:00');
        const endDate = new Date(document.getElementById('bulkEventEndDate').value + 'T00:00:00');
        const startTime = document.getElementById('bulkEventStartTime').value;
        const endTime = document.getElementById('bulkEventEndTime').value;
        const count = parseInt(document.getElementById('bulkEventCount').value) || 1;
        const requiredPeople = parseInt(document.getElementById('bulkEventRequiredPeople').value) || 1;
        const description = document.getElementById('bulkEventDescription').value.trim();

        // 選択された曜日を取得
        const selectedDays = [];
        for (let i = 0; i <= 6; i++) {
            const checkbox = document.getElementById(`bulkDay${i}`);
            if (checkbox && checkbox.checked) {
                selectedDays.push(i);
            }
        }

        if (!department || !title || !startDate || !endDate || selectedDays.length === 0) {
            window.showMessage('必須項目を入力してください', 'error');
            return;
        }

        if (startDate > endDate) {
            window.showMessage('終了日は開始日以降を指定してください', 'error');
            return;
        }

        // 期間内の対象日を生成
        const targetDates = [];
        const current = new Date(startDate);
        
        while (current <= endDate) {
            if (selectedDays.includes(current.getDay())) {
                targetDates.push(new Date(current));
            }
            current.setDate(current.getDate() + 1);
        }

        if (targetDates.length === 0) {
            window.showMessage('指定された条件に該当する日がありません', 'warning');
            return;
        }

        // 各日に業務を追加
        const promises = targetDates.map(date => {
            const dateKey = this.formatDateKey(date);
            const eventData = {
                id: `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${dateKey}`,
                title: title,
                department: department,
                date: dateKey,
                startTime: startTime,
                endTime: endTime,
                count: count,
                requiredPeople: requiredPeople,
                description: description,
                isBulkEvent: true,
                assignedCEs: [],
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                createdBy: window.currentUserData?.displayName || 'unknown'
            };

            return window.database.ref(`${window.DATA_ROOT}/events/${eventData.id}`).set(eventData);
        });

        await Promise.all(promises);

        modal.remove();
        window.showMessage(`${targetDates.length}日分の業務を一括追加しました`, 'success');

    } catch (error) {
        console.error('❌ 期間一括業務追加エラー:', error);
        window.showMessage('期間一括業務の追加に失敗しました', 'error');
    }
}

        openMonthlyTaskModal() {
    if (window.userRole === 'viewer') {
        window.showMessage('編集権限がありません', 'warning');
        return;
    }

    const modal = this.createMonthlyTaskModal();
    document.body.appendChild(modal);
}

createMonthlyTaskModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white p-6 rounded-lg max-w-lg w-full mx-4 max-h-90vh overflow-y-auto">
            <h3 class="text-lg font-semibold mb-4 text-orange-600">
                <i class="fas fa-calendar-alt mr-2"></i>月次業務追加
            </h3>
            <form id="addMonthlyTaskForm">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">部門</label>
                    <select id="monthlyTaskDepartment" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                        <option value="">部門を選択</option>
                        ${window.DEPARTMENTS.map(dept => 
                            `<option value="${dept}">${dept}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">業務名</label>
                    <input type="text" id="monthlyTaskTitle" required 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md"
                           placeholder="例: 月次点検">
                </div>
                <div class="grid grid-cols-2 gap-3 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">対象月</label>
                        <input type="month" id="monthlyTaskMonth" required
                               class="w-full px-3 py-2 border border-gray-300 rounded-md">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">予定件数</label>
                        <input type="number" id="monthlyTaskPlannedCount" min="1" value="1" required
                               class="w-full px-3 py-2 border border-gray-300 rounded-md">
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">備考</label>
                    <textarea id="monthlyTaskMemo" 
                              class="w-full px-3 py-2 border border-gray-300 rounded-md" 
                              rows="3" placeholder="月次業務の詳細説明"></textarea>
                </div>
                <div class="flex space-x-4">
                    <button type="button" onclick="this.closest('.fixed').remove()" 
                            class="flex-1 bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600">
                        キャンセル
                    </button>
                    <button type="submit" 
                            class="flex-1 bg-orange-600 text-white py-2 px-4 rounded hover:bg-orange-700">
                        <i class="fas fa-plus mr-2"></i>月次業務追加
                    </button>
                </div>
            </form>
        </div>
    `;

    const form = modal.querySelector('#addMonthlyTaskForm');
    if (form) {
        // 現在の月を初期値に設定
        const monthInput = modal.querySelector('#monthlyTaskMonth');
        if (monthInput) {
            const now = new Date();
            monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        form.onsubmit = (e) => {
            e.preventDefault();
            this.handleAddMonthlyTask(modal);
        };
    }

    return modal;
}

async handleAddMonthlyTask(modal) {
    try {
        const department = document.getElementById('monthlyTaskDepartment').value;
        const title = document.getElementById('monthlyTaskTitle').value.trim();
        const month = document.getElementById('monthlyTaskMonth').value;
        const plannedCount = parseInt(document.getElementById('monthlyTaskPlannedCount').value) || 1;
        const memo = document.getElementById('monthlyTaskMemo').value.trim();

        if (!department || !title || !month) {
            window.showMessage('必須項目を入力してください', 'error');
            return;
        }

        const monthlyTaskData = {
            id: `monthly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'monthly',
            title: title,
            department: department,
            targetMonth: month,
            plannedCount: plannedCount,
            completedCount: 0,
            remainingCount: plannedCount,
            memo: memo,
            dailyTasks: {},
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            createdBy: window.currentUserData?.displayName || 'unknown'
        };

        await window.database.ref(`${window.DATA_ROOT}/monthlyTasks/${monthlyTaskData.id}`).set(monthlyTaskData);

        modal.remove();
        window.showMessage('月次業務を追加しました', 'success');
        this.renderMonthlyTasks();

    } catch (error) {
        console.error('❌ 月次業務追加エラー:', error);
        window.showMessage('月次業務の追加に失敗しました', 'error');
    }
}
        formatDateKey(date) {
            return date.toISOString().slice(0, 10);
        }
    }

    async setupMonthlyTasksListener() {
    try {
        const monthlyTasksRef = window.database.ref(`${window.DATA_ROOT}/monthlyTasks`);
        monthlyTasksRef.on('value', snapshot => {
            const monthlyTasks = snapshot.val() || {};
            this.renderMonthlyTasks(monthlyTasks);
        });
    } catch (error) {
        console.error('❌ 月次業務リスナー設定エラー:', error);
    }
}

renderMonthlyTasks(monthlyTasks = {}) {
    if (!window.dashboardAuth?.selectedDate) return;

    const currentDate = window.dashboardAuth.selectedDate;
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    window.DEPARTMENTS.forEach(department => {
        const monthlyPlansContainer = document.querySelector(`[data-department="${department}"] .monthly-plans`);
        if (!monthlyPlansContainer) return;

        const deptMonthlyTasks = Object.values(monthlyTasks).filter(task => 
            task.department === department && task.targetMonth === currentMonth
        );

        monthlyPlansContainer.innerHTML = '';

        if (deptMonthlyTasks.length === 0) {
            monthlyPlansContainer.innerHTML = '<p class="text-xs text-gray-400">月次業務なし</p>';
            return;
        }

        deptMonthlyTasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = 'monthly-event-item p-2 border-2 border-dashed border-orange-300 rounded mb-2 bg-orange-50 shadow-sm relative';
            taskElement.innerHTML = `
                <span class="monthly-task-badge">${task.remainingCount}/${task.plannedCount}</span>
                <div class="flex justify-between items-start">
                    <div class="flex-1 pr-2">
                        <h4 class="font-medium text-xs text-orange-800">${task.title}</h4>
                        <p class="text-xs text-orange-600">残り${task.remainingCount}件</p>
                        ${task.memo ? `<p class="text-xs text-gray-600 mt-1">${task.memo}</p>` : ''}
                    </div>
                    <div class="assignment-dropzone min-h-[20px] border border-dashed border-orange-400 rounded p-1 bg-white" 
                         data-task-id="${task.id}">
                        <!-- CEアイコンがドロップされる場所 -->
                    </div>
                </div>
                ${window.userRole !== 'viewer' ? `
                    <div class="mt-2 flex gap-1">
                        <button onclick="window.eventManager.addMonthlyTaskExecution('${task.id}')" 
                                class="btn-small bg-orange-500 text-white text-xs px-2 py-1 rounded hover:bg-orange-600">
                            <i class="fas fa-plus mr-1"></i>実施
                        </button>
                        <button onclick="window.eventManager.deleteMonthlyTask('${task.id}')" 
                                class="btn-small bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
            `;
            
            monthlyPlansContainer.appendChild(taskElement);
        });
    });
}

async addMonthlyTaskExecution(taskId) {
    const count = prompt('実施件数を入力してください:', '1');
    if (!count || isNaN(count) || parseInt(count) <= 0) return;

    try {
        const taskRef = window.database.ref(`${window.DATA_ROOT}/monthlyTasks/${taskId}`);
        const snapshot = await taskRef.once('value');
        const task = snapshot.val();

        if (!task) {
            window.showMessage('月次業務が見つかりません', 'error');
            return;
        }

        const executedCount = parseInt(count);
        const newCompletedCount = task.completedCount + executedCount;
        const newRemainingCount = Math.max(0, task.plannedCount - newCompletedCount);

        await taskRef.update({
            completedCount: newCompletedCount,
            remainingCount: newRemainingCount,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
        });

        window.showMessage(`${executedCount}件の実施を記録しました`, 'success');

    } catch (error) {
        console.error('❌ 月次業務実施記録エラー:', error);
        window.showMessage('実施記録に失敗しました', 'error');
    }
}

async deleteMonthlyTask(taskId) {
    if (!confirm('この月次業務を削除しますか？')) return;

    try {
        await window.database.ref(`${window.DATA_ROOT}/monthlyTasks/${taskId}`).remove();
        window.showMessage('月次業務を削除しました', 'success');
    } catch (error) {
        console.error('❌ 月次業務削除エラー:', error);
        window.showMessage('月次業務の削除に失敗しました', 'error');
    }
}
    
    window.EventManager = EventManager;
    console.log('📅 イベントマネージャークラス読み込み完了');
})();
