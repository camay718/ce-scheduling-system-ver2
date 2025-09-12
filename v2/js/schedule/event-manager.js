/**
 * イベント管理システム - 業務追加機能
 */
(function() {
    'use strict';

    class EventManager {
        constructor() {
            this.events = {};
            this.isInitialized = false;
            this.init();
        }

        async init() {
            try {
                await this.waitForDependencies();
                await this.setupRealtimeListener();
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
            window.showMessage('期間一括業務追加機能（実装予定）', 'info');
        }

        openMonthlyTaskModal() {
            window.showMessage('月次業務追加機能（実装予定）', 'info');
        }

        formatDateKey(date) {
            return date.toISOString().slice(0, 10);
        }
    }

    window.EventManager = EventManager;
    console.log('📅 イベントマネージャークラス読み込み完了');
})();
