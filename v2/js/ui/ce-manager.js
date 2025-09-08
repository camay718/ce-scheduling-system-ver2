/**
 * CE管理システム - V2統合版（V1互換）
 */
(function() {
    'use strict';

    class CEManager {
        constructor() {
            this.ceList = [];
            this.isInitialized = false;
            this.editingCEIndex = -1;
            this.init();
        }

        async init() {
            try {
                await this.waitForDependencies();
                await this.loadCEList();
                this.setupEventListeners();
                this.displayCEList();
                this.isInitialized = true;
                console.log('👥 CEマネージャー初期化完了');
            } catch (error) {
                console.error('❌ CEマネージャー初期化エラー:', error);
            }
        }

        async waitForDependencies() {
            let attempts = 0;
            while (attempts < 30) {
                if (window.CE_LIST_INITIAL && window.database && window.showMessage) {
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            throw new Error('CEManager: 依存関係の初期化タイムアウト');
        }

        async loadCEList() {
            try {
                const snapshot = await window.database.ref(`${window.DATA_ROOT}/ceList`).once('value');
                
                if (snapshot.exists()) {
                    this.ceList = snapshot.val();
                    console.log('✅ CEリスト読み込み完了:', this.ceList.length, '名');
                } else {
                    this.ceList = JSON.parse(JSON.stringify(window.CE_LIST_INITIAL)).map(ce => ({
                        ...ce,
                        status: {
                            monday: '', tuesday: '', wednesday: '', thursday: '',
                            friday: '', saturday: '', sunday: ''
                        }
                    }));
                    await this.saveCEList();
                    console.log('✅ 初期CEリスト作成完了:', this.ceList.length, '名');
                }
            } catch (error) {
                console.error('❌ CEリスト読み込みエラー:', error);
                this.ceList = JSON.parse(JSON.stringify(window.CE_LIST_INITIAL));
            }
        }

        async saveCEList() {
            try {
                await window.database.ref(`${window.DATA_ROOT}/ceList`).set(this.ceList);
                console.log('✅ CEリスト保存完了');
            } catch (error) {
                console.error('❌ CEリスト保存エラー:', error);
            }
        }

        displayCEList() {
            const container = document.getElementById('ceListContainer');
            if (!container) return;
            
            container.innerHTML = '';
            this.ceList.forEach((ce, index) => {
                const ceElement = document.createElement('div');
                ceElement.className = `ce-item worktype-${ce.workType.toLowerCase()}`;
                ceElement.innerHTML = `
                    ${this.renderStatusBadge(ce)}
                    <div class="font-medium">${ce.name}</div>
                    <div class="text-xs opacity-75">${ce.workType}</div>
                `;
                ceElement.draggable = window.userRole !== 'viewer';
                ceElement.dataset.ceIndex = index;
                ceElement.dataset.ceName = ce.name;
                
                // ダブルクリックで編集
                ceElement.addEventListener('dblclick', () => {
                    if (window.userRole !== 'viewer') {
                        this.openCEEditModal(index);
                    } else {
                        window.showMessage('編集権限がありません', 'warning');
                    }
                });
                
                // ドラッグイベント
                if (window.userRole !== 'viewer') {
                    ceElement.addEventListener('dragstart', (e) => {
                        e.dataTransfer.setData('text/plain', JSON.stringify({
                            index, name: ce.name, workType: ce.workType
                        }));
                        e.dataTransfer.effectAllowed = 'copy';
                        ceElement.classList.add('opacity-50');
                        console.log('🖱️ CEドラッグ開始:', ce.name);
                    });

                    ceElement.addEventListener('dragend', () => {
                        ceElement.classList.remove('opacity-50');
                    });
                }
                
                container.appendChild(ceElement);
            });
            
            console.log('✅ CEリスト表示完了:', this.ceList.length, '名');
        }

        renderStatusBadge(ce) {
            const today = new Date();
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const currentDay = dayNames[today.getDay()];
            const status = ce.status?.[currentDay] || '';
            
            if (!status) return '';
            
            return `<span class="status-badge status-${status}">${status}</span>`;
        }

        setupEventListeners() {
            // CE保存ボタン
            const saveCEButton = document.getElementById('saveCEButton');
            if (saveCEButton) {
                saveCEButton.onclick = () => this.saveCEFromModal();
            }
        }

        openCEEditModal(index) {
            this.editingCEIndex = index;
            const ce = this.ceList[index];
            if (!ce) return;

            document.getElementById('editCEName').value = ce.name;
            document.getElementById('editCEWorkType').value = ce.workType;

            const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            dayNames.forEach(day => {
                const select = document.getElementById(`ceStatus_${day}`);
                if (select) {
                    select.value = ce.status?.[day] || '';
                }
            });
            
            window.showModal('ceEditModal');
        }

        saveCEFromModal() {
            if (this.editingCEIndex === -1) return;
            
            const ce = this.ceList[this.editingCEIndex];
            ce.name = document.getElementById('editCEName').value.trim();
            ce.workType = document.getElementById('editCEWorkType').value;
            
            if (!ce.status) ce.status = {};
            const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            dayNames.forEach(day => {
                const select = document.getElementById(`ceStatus_${day}`);
                if (select) {
                    ce.status[day] = select.value;
                }
            });
            
            this.saveCEList();
            this.displayCEList();
            window.closeModal('ceEditModal');
            window.showMessage('CEを更新しました', 'success');
        }
    }

    window.CEManager = CEManager;
    console.log('👥 CEマネージャークラス読み込み完了');
})();
