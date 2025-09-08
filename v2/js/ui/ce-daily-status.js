/**
 * CE日別勤務状態管理システム - 完全修正版
 */
(function() {
    'use strict';

    class CEDailyStatusManager {
        constructor() {
            this.selectedDate = new Date();
            this.statusData = {}; // {ceId: status}
            this.isInitialized = false;
            this.init();
        }

        async init() {
            try {
                await this.waitForDependencies();
                this.setupEventListeners();
                await this.loadStatusForDate();
                this.isInitialized = true;
                console.log('📅 CE日別勤務状態管理初期化完了');
            } catch (error) {
                console.error('❌ CE日別勤務状態管理初期化エラー:', error);
            }
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
            throw new Error('CEDailyStatusManager: 依存関係初期化タイムアウト');
        }

        setupEventListeners() {
            // 日付選択
            const dateInput = document.getElementById('ceStatusDate');
            if (dateInput && !dateInput.dataset.bound) {
                dateInput.dataset.bound = 'true';
                dateInput.value = this.formatDate(this.selectedDate);
                dateInput.onchange = async (e) => {
                    this.selectedDate = new Date(e.target.value + 'T00:00:00');
                    await this.loadStatusForDate();
                    this.updateMainScheduleCEList();
                };
            }
        }

        async loadStatusForDate() {
            const dateKey = this.formatDate(this.selectedDate);
            try {
                const snapshot = await window.database.ref(`${window.DATA_ROOT}/ceStatus/byDate/${dateKey}`).once('value');
                this.statusData = snapshot.val() || {};
                this.renderCEManagementTable();
                console.log(`✅ ${dateKey} の日別ステータス読み込み完了`);
            } catch (error) {
                console.error('❌ 日別ステータス読み込みエラー:', error);
            }
        }

        async updateCEStatus(ceId, status) {
            const dateKey = this.formatDate(this.selectedDate);
            try {
                if (status === '') {
                    await window.database.ref(`${window.DATA_ROOT}/ceStatus/byDate/${dateKey}/${ceId}`).remove();
                    delete this.statusData[ceId];
                } else {
                    await window.database.ref(`${window.DATA_ROOT}/ceStatus/byDate/${dateKey}/${ceId}`).set(status);
                    this.statusData[ceId] = status;
                }
                
                window.showMessage('勤務状態を更新しました', 'success');
                this.updateMainScheduleCEList();
            } catch (error) {
                console.error('❌ CE勤務状態更新エラー:', error);
                window.showMessage('勤務状態の更新に失敗しました', 'error');
            }
        }

        async addNewCE() {
            const name = document.getElementById('newCEName').value.trim();
            const workType = document.getElementById('newCEWorkType').value;

            if (!name) {
                window.showMessage('CE名を入力してください', 'warning');
                return;
            }

            if (window.ceManager) {
                try {
                    await window.ceManager.addNewCE(name, workType);
                    document.getElementById('newCEName').value = '';
                    this.renderCEManagementTable();
                    window.showMessage(`${name}を追加しました`, 'success');
                } catch (error) {
                    console.error('❌ CE追加エラー:', error);
                    window.showMessage('CEの追加に失敗しました', 'error');
                }
            }
        }

        async deleteCE(ceIndex) {
            if (!window.ceManager?.ceList[ceIndex]) return;

            const ceName = window.ceManager.ceList[ceIndex].name;
            
            if (!confirm(`${ceName} を削除しますか？\n\nこの操作は元に戻せません。`)) {
                return;
            }

            try {
                window.ceManager.ceList.splice(ceIndex, 1);
                await window.ceManager.saveCEList();
                
                window.showMessage(`${ceName} を削除しました`, 'success');
                this.renderCEManagementTable();
                this.updateMainScheduleCEList();
            } catch (error) {
                console.error('❌ CE削除エラー:', error);
                window.showMessage('CEの削除に失敗しました', 'error');
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
                
                // ダブルクリックで削除
                row.ondblclick = () => this.deleteCE(index);
                
                row.innerHTML = `
                    <td class="p-3">
                        <div class="ce-item-mini worktype-${ce.workType.toLowerCase()} px-2 py-1 rounded text-xs">
                            ${ce.name}
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

            // CE追加フォーム（最下部）
            const addRow = document.createElement('tr');
            addRow.innerHTML = `
                <td colspan="5" class="p-3 bg-gray-50">
                    <div class="flex items-center gap-3">
                        <input type="text" id="newCEName" placeholder="新しいCE名" 
                               class="px-3 py-2 border rounded-lg flex-1">
                        <select id="newCEWorkType" class="px-3 py-2 border rounded-lg">
                            <option value="ME">ME</option>
                            <option value="OPE">OPE</option>
                            <option value="HD">HD</option>
                            <option value="FLEX">FLEX</option>
                        </select>
                        <button onclick="window.ceDailyStatus.addNewCE()" 
                                class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
                            <i class="fas fa-plus mr-1"></i>追加
                        </button>
                        <span class="text-xs text-gray-500">※ダブルクリックで削除</span>
                    </div>
                </td>
            `;
            tbody.appendChild(addRow);
        }

        // メイン画面のCEリスト更新
        updateMainScheduleCEList() {
            if (window.ceManager && window.ceManager.displayCEList) {
                window.ceManager.currentDisplayDate = this.selectedDate;
                window.ceManager.displayCEList();
            }
        }

        // 特定CEの特定日付のステータスを取得
        getStatusForCE(ceId) {
            return this.statusData[ceId] || '';
        }

        formatDate(date) {
            return date.toISOString().slice(0, 10);
        }
    }

    window.CEDailyStatusManager = CEDailyStatusManager;
    console.log('📅 CE日別勤務状態管理システム読み込み完了');
})();
