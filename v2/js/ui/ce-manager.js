/**
 * CE管理システム - V2統合版
 * CEリスト表示、編集、ドラッグ&ドロップの基盤
 */
(function() {
    'use strict';

    class CEManager {
        constructor() {
            this.ceList = [];
            this.isInitialized = false;
            this.draggedCE = null;
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
                // Firebaseから既存のCEリストを取得
                const snapshot = await window.database.ref(`${window.DATA_ROOT}/ceList`).once('value');
                
                if (snapshot.exists()) {
                    this.ceList = snapshot.val();
                    console.log('✅ CEリスト読み込み完了:', this.ceList.length, '名');
                } else {
                    // 初回起動時はV1互換リストを使用
                    this.ceList = JSON.parse(JSON.stringify(window.CE_LIST_INITIAL));
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
            const container = document.getElementById('ceList');
            if (!container) return;
            
            container.innerHTML = '';
            this.ceList.forEach((ce, index) => {
                const ceElement = document.createElement('div');
                ceElement.className = `ce-item worktype-${ce.workType.toLowerCase()}`;
                ceElement.innerHTML = `
                    <div class="font-medium">${ce.name}</div>
                    <div class="text-xs opacity-75">${ce.workType}</div>
                    ${this.renderCEStatus(ce)}
                `;
                ceElement.draggable = window.userRole !== 'viewer';
                ceElement.dataset.ceIndex = index;
                ceElement.dataset.ceName = ce.name;
                
                // ダブルクリックで編集
                ceElement.addEventListener('dblclick', () => {
                    if (window.userRole !== 'viewer') {
                        this.editCE(index);
                    }
                });
                
                // ドラッグイベント
                if (window.userRole !== 'viewer') {
                    ceElement.addEventListener('dragstart', (e) => {
                        this.draggedCE = { index, name: ce.name, workType: ce.workType };
                        e.dataTransfer.setData('text/plain', JSON.stringify(this.draggedCE));
                        e.dataTransfer.effectAllowed = 'copy';
                        ceElement.classList.add('opacity-50');
                        console.log('🖱️ CEドラッグ開始:', ce.name);
                    });

                    ceElement.addEventListener('dragend', () => {
                        ceElement.classList.remove('opacity-50');
                        this.draggedCE = null;
                    });
                }
                
                container.appendChild(ceElement);
            });
            
            console.log('✅ CEリスト表示完了:', this.ceList.length, '名');
        }

        renderCEStatus(ce) {
            const today = new Date();
            const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];
            const status = ce.status?.[dayOfWeek] || '';
            
            if (!status) return '';
            
            const statusColors = {
                '早': 'bg-orange-500',
                '当': 'bg-purple-500',
                '非': 'bg-gray-500', 
                '休': 'bg-red-500',
                '出': 'bg-blue-500'
            };
            
            return `<span class="text-xs px-1 py-0.5 rounded text-white ${statusColors[status] || 'bg-gray-400'}">${status}</span>`;
        }

        setupEventListeners() {
            // CE追加ボタン
            const addCEBtn = document.getElementById('addCEBtn');
            if (addCEBtn) {
                addCEBtn.onclick = () => this.addCE();
            }
        }

        addCE() {
            if (window.userRole === 'viewer') {
                this.showMessage('編集権限がありません', 'warning');
                return;
            }

            const ceName = document.getElementById('ceNameInput')?.value?.trim();
            const ceSkill = document.getElementById('ceSkillInput')?.value?.trim();

            if (!ceName) {
                this.showMessage('CE名を入力してください', 'warning');
                return;
            }

            // 重複チェック
            if (this.ceList.some(ce => ce.name === ceName)) {
                this.showMessage('同じ名前のCEが既に存在します', 'warning');
                return;
            }

            const newCE = {
                name: ceName,
                workType: ceSkill?.toUpperCase() || 'ME',
                department: null,
                status: {},
                createdAt: Date.now(),
                createdBy: window.currentUserData?.displayName || 'unknown'
            };

            this.ceList.push(newCE);
            this.saveCEList();
            this.displayCEList();

            // 入力欄クリア
            if (document.getElementById('ceNameInput')) document.getElementById('ceNameInput').value = '';
            if (document.getElementById('ceSkillInput')) document.getElementById('ceSkillInput').value = '';

            this.showMessage(`${ceName}を追加しました`, 'success');
        }

        editCE(index) {
            const ce = this.ceList[index];
            if (!ce) return;

            const newName = prompt('CE名を入力してください:', ce.name);
            if (!newName || newName.trim() === '') return;

            const newWorkType = prompt('勤務区分 (OPE/ME/HD/FLEX):', ce.workType);
            if (!['OPE', 'ME', 'HD', 'FLEX'].includes(newWorkType)) {
                this.showMessage('有効な勤務区分を入力してください', 'warning');
                return;
            }

            ce.name = newName.trim();
            ce.workType = newWorkType;
            ce.updatedAt = Date.now();

            this.saveCEList();
            this.displayCEList();
            this.showMessage('CEを更新しました', 'success');
        }

        showMessage(message, type) {
            if (window.showMessage) {
                window.showMessage(message, type);
            } else {
                alert(message);
            }
        }
    }

    // グローバル公開
    window.CEManager = CEManager;
    console.log('👥 CEマネージャークラス読み込み完了');
})();
