/**
 * CE日別勤務状態管理システム
 */
(function() {
    'use strict';

    class CEDailyStatusManager {
        constructor() {
            this.selectedDate = new Date();
            this.statusData = {}; // {ceId: status}
            this.ceList = [];
            this.init();
        }

        async init() {
            await this.waitForDependencies();
            this.setupEventListeners();
            this.loadTodayStatus();
            console.log('📅 CE日別勤務状態管理初期化完了');
        }

        async waitForDependencies() {
            let attempts = 0;
            while (attempts < 50) {
                if (window.database && window.DATA_ROOT && window.ceManager) {
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
        }

        setupEventListeners() {
            // 日付選択
            const dateInput = document.getElementById('ceStatusDate');
            if (dateInput) {
                dateInput.value = this.formatDate(this.selectedDate);
                dateInput.onchange = (e) => {
                    this.selectedDate = new Date(e.target.value + 'T00:00:00');
                    this.loadStatusForDate();
                };
            }

            // CE追加
            const addBtn = document.getElementById('addNewCEBtn');
            if (addBtn) {
                addBtn.onclick = () => this.addNewCE();
            }
        }

        async loadStatusForDate() {
            const dateKey = this.formatDate(this.selectedDate);
            try {
                const snapshot = await window.database.ref(`${window.DATA_ROOT}/ceStatus/byDate/${dateKey}`).once('value');
                this.statusData = snapshot.val() || {};
                this.renderCEManagementTable();
            } catch (error) {
                console.error('❌ 日別ステータス読み込みエラー:', error);
            }
        }

        loadTodayStatus() {
            this.selectedDate = new Date();
            const dateInput = document.getElementById('ceStatusDate');
            if (dateInput) {
                dateInput.value = this.formatDate(this.selectedDate);
            }
            this.loadStatusForDate();
        }

        async updateCEStatus(ceId, status) {
            const dateKey = this.formatDate(this.selectedDate);
            try {
                await window.database.ref(`${window.DATA_ROOT}/ceStatus/byDate/${dateKey}/${ceId}`).set(status);
                this.statusData[ceId] = status;
                
                // CEManagerのステータス表示も更新
                if (window.ceManager && this.formatDate(new Date()) === dateKey) {
                    window.ceManager.displayCEList();
                }
                
                console.log('✅ CE勤務状態更新:', ceId, dateKey, status);
            } catch (error) {
                console.error('❌ CE勤務状態更新エラー:', error);
                window.showMessage('勤務状態の更新に失敗しました', 'error');
            }
        }

        async addNewCE() {
            const name = document.getElementById('newCEName').value.trim();
            const workType = document.getElementById('newCEWorkType').value;
            const department = document.getElementById('newCEDepartment').value;

            if (!name) {
                window.showMessage('CE名を入力してください', 'warning');
                return;
            }

            if (window.ceManager) {
                try {
                    await window.ceManager.addNewCE(name, workType);
                    document.getElementById('newCEName').value = '';
                    document.getElementById('newCEDepartment').value = '';
                    this.renderCEManagementTable();
                    window.showMessage(`${name}を追加しました`, 'success');
                } catch (error) {
                    console.error('❌ CE追加エラー:', error);
                    window.showMessage('CEの追加に失敗しました', 'error');
                }
            }
        }

        renderCEManagementTable() {
            const tbody = document.getElementById('ceManagementTableBody');
            if (!tbody || !window.ceManager?.ceList) return;

            const ceList = window.ceManager.ceList;
            tbody.innerHTML = '';

            ceList.forEach((ce, index) => {
                const ceId = ce.id || `ce_${index}`;
                const currentStatus = this.statusData[ceId] || '';

                const row = document.createElement('tr');
                row.className = 'border-b hover:bg-gray-50';
                row.innerHTML = `
                    <td class="p-3">
                        <div class="flex items-center">
                            <div class="ce-item-mini worktype-${ce.workType.toLowerCase()} px-2 py-1 rounded text-xs mr-2">
                                ${ce.name}
                            </div>
                        </div>
                    </td>
                    <td class="p-3 text-center">
                        <span class="px-2 py-1 rounded text-xs worktype-${ce.workType.toLowerCase()}">
                            ${ce.workType}
                        </span>
                    </td>
                    <td class="p-3 text-center">${ce.department || '未設定'}</td>
                    <td class="p-3 text-center">
                        <select class="px-2 py-1 border rounded text-xs" onchange="window.ceDailyStatus.updateCEStatus('${ceId}', this.value)">
                            <option value="" ${currentStatus === '' ? 'selected' : ''}>通常</option>
                            <option value="早" ${currentStatus === '早' ? 'selected' : ''}>早出</option>
                            <option value="当" ${currentStatus === '当' ? 'selected' : ''}>当直</option>
                            <option value="非" ${currentStatus === '非' ? 'selected' : ''}>非番</option>
                            <option value="休" ${currentStatus === '休' ? 'selected' : ''}>休み</option>
                            <option value="出" ${currentStatus === '出' ? 'selected' : ''}>出張</option>
                        </select>
                    </td>
                    <td class="p-3 text-center">
                        <button onclick="window.ceManager.openCEEditModal(${index})" 
                                class="text-blue-600 hover:text-blue-800 text-xs">
                            <i class="fas fa-edit"></i> 編集
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        formatDate(date) {
            return date.toISOString().slice(0, 10);
        }
    }

    // グローバル公開
    window.CEDailyStatusManager = CEDailyStatusManager;
    console.log('📅 CE日別勤務状態管理システム読み込み完了');
})();
