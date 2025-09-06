class ScheduleManager {
    constructor() {
        this.currentWeek = new Date();
        this.scheduleData = {};
        this.ceList = {};
        this.jobsList = {};
        this.init();
    }

    async init() {
        // V2認証確認
        const userInfo = await UserSetupManager.getCurrentUserInfo();
        if (!userInfo || !userInfo.setupCompleted) {
            window.location.href = 'index.html';
            return;
        }

        window.userRole = userInfo.role || 'viewer';
        this.setupUI();
        this.loadData();
        this.setupEventListeners();
    }

    setupUI() {
        this.updateUserInfo();
        this.generateWeekTable();
        this.setupPermissions();
    }

    updateUserInfo() {
        // ユーザー情報表示
        const userInfoElement = document.getElementById('userInfo');
        if (userInfoElement) {
            userInfoElement.innerHTML = `
                <span class="text-gray-600">ようこそ、</span>
                <span class="font-semibold">${window.currentUser?.displayName || 'ユーザー'}</span>
                <span class="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">${this.getRoleDisplayName(window.userRole)}</span>
            `;
        }
    }

    getRoleDisplayName(role) {
        const roles = {
            'admin': '管理者',
            'editor': '編集者', 
            'viewer': '閲覧者'
        };
        return roles[role] || '不明';
    }

    setupPermissions() {
        const isReadOnly = window.userRole === 'viewer';
        
        // 閲覧者の場合は編集機能を無効化
        if (isReadOnly) {
            const editButtons = document.querySelectorAll('[data-permission="edit"]');
            editButtons.forEach(btn => {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            });
        }
    }

    async loadData() {
        try {
            // V2データベース構造から読み込み
            const dataSnapshot = await database.ref('ceScheduleV2/scheduleData').once('value');
            const data = dataSnapshot.val() || {};
            
            this.scheduleData = data.schedules || {};
            this.ceList = data.ceList || {};
            this.jobsList = data.jobs || {};
            
            // V1データ移行チェック
            await this.checkV1Migration();
            
            this.renderSchedule();
            this.renderCEList();
            this.renderJobsList();
            
        } catch (error) {
            console.error('データ読み込みエラー:', error);
            this.showError('データの読み込みに失敗しました');
        }
    }

    async checkV1Migration() {
        try {
            // V1データの存在確認
            const v1DataSnapshot = await database.ref('ceSchedule').once('value');
            
            if (v1DataSnapshot.exists() && Object.keys(this.scheduleData).length === 0) {
                // V1データが存在し、V2にデータがない場合
                const shouldMigrate = confirm('V1のデータが見つかりました。V2に移行しますか？');
                if (shouldMigrate) {
                    await this.migrateV1Data(v1DataSnapshot.val());
                }
            }
        } catch (error) {
            console.error('V1データ確認エラー:', error);
        }
    }

    async migrateV1Data(v1Data) {
        try {
            // V1データをV2構造に変換
            const convertedData = {
                schedules: this.convertV1Schedules(v1Data.schedules),
                ceList: this.convertV1CEList(v1Data.ceList), 
                jobs: this.convertV1Jobs(v1Data.jobs),
                migrationInfo: {
                    migratedAt: firebase.database.ServerValue.TIMESTAMP,
                    migratedBy: window.currentUser.uid,
                    sourceVersion: 'v1'
                }
            };

            // V2データベースに保存
            await database.ref('ceScheduleV2/scheduleData').set(convertedData);
            
            // ローカルデータ更新
            this.scheduleData = convertedData.schedules;
            this.ceList = convertedData.ceList;
            this.jobsList = convertedData.jobs;
            
            this.showSuccess('V1データの移行が完了しました');
            this.renderSchedule();
            this.renderCEList();
            this.renderJobsList();
            
        } catch (error) {
            console.error('データ移行エラー:', error);
            this.showError('データ移行に失敗しました');
        }
    }

    convertV1Schedules(v1Schedules) {
        if (!v1Schedules) return {};
        
        const converted = {};
        Object.keys(v1Schedules).forEach(key => {
            converted[key] = {
                ...v1Schedules[key],
                convertedFromV1: true,
                convertedAt: new Date().toISOString()
            };
        });
        return converted;
    }

    convertV1CEList(v1CEList) {
        if (!v1CEList) return {};
        
        const converted = {};
        Object.keys(v1CEList).forEach(key => {
            converted[key] = {
                ...v1CEList[key],
                convertedFromV1: true,
                convertedAt: new Date().toISOString()
            };
        });
        return converted;
    }

    convertV1Jobs(v1Jobs) {
        if (!v1Jobs) return {};
        
        const converted = {};
        Object.keys(v1Jobs).forEach(key => {
            converted[key] = {
                ...v1Jobs[key],
                convertedFromV1: true,
                convertedAt: new Date().toISOString()
            };
        });
        return converted;
    }

    generateWeekTable() {
        const weekDays = ['月', '火', '水', '木', '金', '土', '日'];
        const tableHeader = document.getElementById('scheduleTableHeader');
        const tableBody = document.getElementById('scheduleTableBody');
        
        if (!tableHeader || !tableBody) return;

        // ヘッダー生成
        tableHeader.innerHTML = `
            <tr class="bg-blue-600 text-white">
                <th class="py-3 px-4 text-left font-semibold">時間 / 曜日</th>
                ${weekDays.map(day => `<th class="py-3 px-4 text-center font-semibold">${day}</th>`).join('')}
            </tr>
        `;

        // 時間帯テーブル生成（8:00-18:00）
        const timeSlots = [];
        for (let hour = 8; hour <= 18; hour++) {
            timeSlots.push(`${hour}:00`);
        }

        tableBody.innerHTML = timeSlots.map(time => `
            <tr class="border-b hover:bg-gray-50">
                <td class="py-4 px-4 font-medium bg-gray-100 border-r">${time}</td>
                ${weekDays.map((day, index) => `
                    <td class="py-4 px-4 border-r min-h-[80px] relative" 
                        data-day="${index}" 
                        data-time="${time}"
                        ondrop="scheduleManager.handleDrop(event)" 
                        ondragover="scheduleManager.allowDrop(event)">
                        <div class="schedule-cell min-h-[60px]" id="cell-${index}-${time}">
                            <!-- スケジュール内容がここに表示される -->
                        </div>
                    </td>
                `).join('')}
            </tr>
        `).join('');
    }

    renderSchedule() {
        // 既存のスケジュールデータをテーブルに表示
        Object.keys(this.scheduleData).forEach(scheduleKey => {
            const schedule = this.scheduleData[scheduleKey];
            if (schedule && schedule.day !== undefined && schedule.time) {
                this.renderScheduleItem(schedule, scheduleKey);
            }
        });
    }

    renderScheduleItem(schedule, scheduleKey) {
        const cellId = `cell-${schedule.day}-${schedule.time}`;
        const cell = document.getElementById(cellId);
        
        if (cell) {
            const scheduleElement = document.createElement('div');
            scheduleElement.className = 'schedule-item bg-blue-100 border-l-4 border-blue-500 p-2 mb-1 rounded text-sm';
            scheduleElement.innerHTML = `
                <div class="font-medium">${schedule.jobName || '業務'}</div>
                <div class="text-xs text-gray-600">${schedule.ceName || 'CE'}</div>
                ${window.userRole !== 'viewer' ? `
                    <button onclick="scheduleManager.editSchedule('${scheduleKey}')" 
                            class="text-xs text-blue-600 hover:underline">編集</button>
                ` : ''}
            `;
            scheduleElement.draggable = window.userRole !== 'viewer';
            scheduleElement.setAttribute('data-schedule-key', scheduleKey);
            
            if (window.userRole !== 'viewer') {
                scheduleElement.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', scheduleKey);
                });
            }
            
            cell.appendChild(scheduleElement);
        }
    }

    renderCEList() {
        const ceListContainer = document.getElementById('ceListContainer');
        if (!ceListContainer) return;

        ceListContainer.innerHTML = Object.keys(this.ceList).map(ceKey => {
            const ce = this.ceList[ceKey];
            return `
                <div class="ce-item bg-green-100 border border-green-300 p-2 rounded mb-2 cursor-move"
                     draggable="${window.userRole !== 'viewer'}"
                     data-ce-key="${ceKey}"
                     ondragstart="scheduleManager.handleCEDragStart(event)">
                    <div class="font-medium">${ce.name}</div>
                    <div class="text-xs text-gray-600">${ce.skills || '一般'}</div>
                    ${window.userRole === 'admin' ? `
                        <button onclick="scheduleManager.editCE('${ceKey}')" 
                                class="text-xs text-blue-600 hover:underline">編集</button>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    renderJobsList() {
        const jobsListContainer = document.getElementById('jobsListContainer');
        if (!jobsListContainer) return;

        jobsListContainer.innerHTML = Object.keys(this.jobsList).map(jobKey => {
            const job = this.jobsList[jobKey];
            return `
                <div class="job-item bg-yellow-100 border border-yellow-300 p-2 rounded mb-2"
                     data-job-key="${jobKey}">
                    <div class="font-medium">${job.name}</div>
                    <div class="text-xs text-gray-600">${job.description || ''}</div>
                    ${window.userRole !== 'viewer' ? `
                        <button onclick="scheduleManager.editJob('${jobKey}')" 
                                class="text-xs text-blue-600 hover:underline">編集</button>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    setupEventListeners() {
        // CE追加ボタン
        const addCEBtn = document.getElementById('addCEBtn');
        if (addCEBtn && window.userRole === 'admin') {
            addCEBtn.onclick = () => this.showCEModal();
        }

        // 業務追加ボタン  
        const addJobBtn = document.getElementById('addJobBtn');
        if (addJobBtn && window.userRole !== 'viewer') {
            addJobBtn.onclick = () => this.showJobModal();
        }

        // ログアウトボタン
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.onclick = () => this.logout();
        }
    }

    // ドラッグ&ドロップ処理
    allowDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.add('drag-over');
    }

    handleDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        
        if (window.userRole === 'viewer') return;

        const scheduleKey = event.dataTransfer.getData('text/plain');
        const ceKey = event.dataTransfer.getData('application/ce-key');
        
        const cell = event.currentTarget;
        const day = parseInt(cell.getAttribute('data-day'));
        const time = cell.getAttribute('data-time');

        if (scheduleKey) {
            // 既存スケジュールの移動
            this.moveSchedule(scheduleKey, day, time);
        } else if (ceKey) {
            // 新規スケジュール作成
            this.createSchedule(ceKey, day, time);
        }
    }

    handleCEDragStart(event) {
        if (window.userRole === 'viewer') return;
        
        const ceKey = event.currentTarget.getAttribute('data-ce-key');
        event.dataTransfer.setData('application/ce-key', ceKey);
    }

    async moveSchedule(scheduleKey, newDay, newTime) {
        try {
            const updates = {
                [`ceScheduleV2/scheduleData/schedules/${scheduleKey}/day`]: newDay,
                [`ceScheduleV2/scheduleData/schedules/${scheduleKey}/time`]: newTime,
                [`ceScheduleV2/scheduleData/schedules/${scheduleKey}/lastUpdated`]: firebase.database.ServerValue.TIMESTAMP
            };

            await database.ref().update(updates);
            this.scheduleData[scheduleKey].day = newDay;
            this.scheduleData[scheduleKey].time = newTime;
            
            this.clearScheduleDisplay();
            this.renderSchedule();

        } catch (error) {
            console.error('スケジュール移動エラー:', error);
            this.showError('スケジュールの移動に失敗しました');
        }
    }

    async createSchedule(ceKey, day, time) {
        const ce = this.ceList[ceKey];
        if (!ce) return;

        // 業務選択モーダルを表示
        this.showJobSelectionModal(ceKey, ce.name, day, time);
    }

    showJobSelectionModal(ceKey, ceName, day, time) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
                <h3 class="text-lg font-semibold mb-4">業務を選択してください</h3>
                <p class="mb-4 text-gray-600">CE: ${ceName} | 時間: ${['月','火','水','木','金','土','日'][day]} ${time}</p>
                <div class="max-h-60 overflow-y-auto mb-4">
                    ${Object.keys(this.jobsList).map(jobKey => `
                        <div class="job-option p-2 border rounded mb-2 cursor-pointer hover:bg-gray-100"
                             onclick="scheduleManager.confirmScheduleCreation('${ceKey}', '${jobKey}', ${day}, '${time}')">
                            <div class="font-medium">${this.jobsList[jobKey].name}</div>
                            <div class="text-sm text-gray-600">${this.jobsList[jobKey].description || ''}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="flex space-x-4">
                    <button onclick="this.closest('.fixed').remove()" 
                            class="flex-1 bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600">
                        キャンセル
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    async confirmScheduleCreation(ceKey, jobKey, day, time) {
        try {
            const ce = this.ceList[ceKey];
            const job = this.jobsList[jobKey];
            
            const scheduleKey = database.ref().child('ceScheduleV2/scheduleData/schedules').push().key;
            const scheduleData = {
                ceKey: ceKey,
                ceName: ce.name,
                jobKey: jobKey, 
                jobName: job.name,
                day: day,
                time: time,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                createdBy: window.currentUser.uid
            };

            await database.ref(`ceScheduleV2/scheduleData/schedules/${scheduleKey}`).set(scheduleData);
            this.scheduleData[scheduleKey] = scheduleData;
            
            this.clearScheduleDisplay();
            this.renderSchedule();
            
            // モーダルを閉じる
            document.querySelector('.fixed.inset-0').remove();
            
        } catch (error) {
            console.error('スケジュール作成エラー:', error);
            this.showError('スケジュールの作成に失敗しました');
        }
    }

    clearScheduleDisplay() {
        const cells = document.querySelectorAll('.schedule-cell');
        cells.forEach(cell => {
            cell.innerHTML = '';
        });
    }

    async addCE(ceData) {
        if (window.userRole !== 'admin') return;

        try {
            const ceKey = database.ref().child('ceScheduleV2/scheduleData/ceList').push().key;
            const ceInfo = {
                ...ceData,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                createdBy: window.currentUser.uid
            };

            await database.ref(`ceScheduleV2/scheduleData/ceList/${ceKey}`).set(ceInfo);
            this.ceList[ceKey] = ceInfo;
            this.renderCEList();
            
        } catch (error) {
            console.error('CE追加エラー:', error);
            this.showError('CEの追加に失敗しました');
        }
    }

    async addJob(jobData) {
        if (window.userRole === 'viewer') return;

        try {
            const jobKey = database.ref().child('ceScheduleV2/scheduleData/jobs').push().key;
            const jobInfo = {
                ...jobData,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                createdBy: window.currentUser.uid
            };

            await database.ref(`ceScheduleV2/scheduleData/jobs/${jobKey}`).set(jobInfo);
            this.jobsList[jobKey] = jobInfo;
            this.renderJobsList();
            
        } catch (error) {
            console.error('業務追加エラー:', error);
            this.showError('業務の追加に失敗しました');
        }
    }

    showCEModal() {
        if (window.userRole !== 'admin') return;

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
                <h3 class="text-lg font-semibold mb-4">CE追加</h3>
                <form id="ceForm">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">名前</label>
                        <input type="text" id="ceName" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md">
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">スキル</label>
                        <input type="text" id="ceSkills" 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md"
                               placeholder="例: ネットワーク, サーバー">
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
        
        document.body.appendChild(modal);
        
        document.getElementById('ceForm').onsubmit = (e) => {
            e.preventDefault();
            const ceData = {
                name: document.getElementById('ceName').value,
                skills: document.getElementById('ceSkills').value
            };
            this.addCE(ceData);
            modal.remove();
        };
    }

    showJobModal() {
        if (window.userRole === 'viewer') return;

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
                <h3 class="text-lg font-semibold mb-4">業務追加</h3>
                <form id="jobForm">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">業務名</label>
                        <input type="text" id="jobName" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md">
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">説明</label>
                        <textarea id="jobDescription" 
                                  class="w-full px-3 py-2 border border-gray-300 rounded-md" 
                                  rows="3"></textarea>
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
        
        document.body.appendChild(modal);
        
        document.getElementById('jobForm').onsubmit = (e) => {
            e.preventDefault();
            const jobData = {
                name: document.getElementById('jobName').value,
                description: document.getElementById('jobDescription').value
            };
            this.addJob(jobData);
            modal.remove();
        };
    }

    logout() {
        if (confirm('ログアウトしますか？')) {
            auth.signOut().then(() => {
                sessionStorage.clear();
                window.location.href = 'index.html';
            });
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg z-50 ${
            type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// 初期化
let scheduleManager;
document.addEventListener('DOMContentLoaded', () => {
    scheduleManager = new ScheduleManager();
});
