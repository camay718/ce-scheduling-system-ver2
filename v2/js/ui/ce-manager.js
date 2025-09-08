/**
 * CE管理システム - V2統合版（V1完全互換）
 * リアルタイム同期、V1スタイル表示、詳細編集機能
 */
(function() {
    'use strict';

    class CEManager {
        constructor() {
            this.ceList = [];
            this.isInitialized = false;
            this.editingCEIndex = -1;
            this.dbRef = null;
            this.init();
        }

        async init() {
            try {
                await this.waitForDependencies();
                await this.setupRealtimeListener();
                this.setupEventListeners();
                this.isInitialized = true;
                console.log('👥 CEマネージャー初期化完了');
            } catch (error) {
                console.error('❌ CEマネージャー初期化エラー:', error);
            }
        }

        async waitForDependencies() {
            let attempts = 0;
            while (attempts < 50) {
                if (window.database && window.DATA_ROOT && window.showMessage && 
                    window.CE_LIST_INITIAL && window.showModal) {
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            throw new Error('CEManager: 依存関係の初期化タイムアウト');
        }

        async setupRealtimeListener() {
            this.dbRef = window.database.ref(`${window.DATA_ROOT}/ceList`);
            
            this.dbRef.on('value', snapshot => {
                if (snapshot.exists()) {
                    this.ceList = snapshot.val();
                    this.normalizeCEData();
                    console.log('✅ CEリストリアルタイム更新:', this.ceList.length, '名');
                } else {
                    // 初回起動時：V1互換の初期CEリストを作成
                    this.ceList = JSON.parse(JSON.stringify(window.CE_LIST_INITIAL)).map(ce => ({
                        ...ce,
                        status: {
                            monday: '', tuesday: '', wednesday: '', thursday: '',
                            friday: '', saturday: '', sunday: ''
                        },
                        createdAt: Date.now()
                    }));
                    this.saveCEList();
                    console.log('✅ 初期CEリスト作成:', this.ceList.length, '名');
                }
                
                this.displayCEList();
            }, error => {
                console.error('❌ CEリストリアルタイム監視エラー:', error);
            });
        }

        normalizeCEData() {
            this.ceList = this.ceList.map(ce => {
                // workTypeの正規化
                const validWorkTypes = ['OPE', 'ME', 'HD', 'FLEX'];
                const workType = (ce.workType || 'ME').toUpperCase();
                const normalizedWorkType = validWorkTypes.includes(workType) ? workType : 'ME';

                // statusの正規化
                const defaultStatus = {
                    monday: '', tuesday: '', wednesday: '', thursday: '',
                    friday: '', saturday: '', sunday: ''
                };
                const status = Object.assign({}, defaultStatus, ce.status || {});

                return {
                    ...ce,
                    workType: normalizedWorkType,
                    status: status,
                    name: ce.name || '名前なし'
                };
            });
        }

        async saveCEList() {
            try {
                await window.database.ref(`${window.DATA_ROOT}/ceList`).set(this.ceList);
                console.log('✅ CEリスト保存完了');
            } catch (error) {
                console.error('❌ CEリスト保存エラー:', error);
                window.showMessage('CEリストの保存に失敗しました', 'error');
            }
        }

        displayCEList() {
            const container = document.getElementById('ceListContainer');
            if (!container) {
                console.warn('CEリストコンテナが見つかりません');
                return;
            }
            
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
                ceElement.dataset.workType = ce.workType;
                
                // ダブルクリックで編集（V1互換）
                ceElement.addEventListener('dblclick', () => {
                    if (window.userRole === 'viewer') {
                        window.showMessage('編集権限がありません', 'warning');
                    } else {
                        this.openCEEditModal(index);
                    }
                });
                
                // ドラッグ機能（閲覧者以外）
                if (window.userRole !== 'viewer') {
                    ceElement.addEventListener('dragstart', (e) => {
                        const dragData = {
                            ceIndex: index,
                            ceName: ce.name,
                            workType: ce.workType
                        };
                        e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
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
            // CE編集保存ボタン
            const saveCEButton = document.getElementById('saveCEButton');
            if (saveCEButton && !saveCEButton.dataset.ceManagerBound) {
                saveCEButton.dataset.ceManagerBound = 'true';
                saveCEButton.addEventListener('click', () => this.saveCEFromModal());
            }
        }

        openCEEditModal(index) {
            this.editingCEIndex = index;
            const ce = this.ceList[index];
            if (!ce) return;

            // 基本情報の設定
            const nameInput = document.getElementById('editCEName');
            const workTypeSelect = document.getElementById('editCEWorkType');
            
            if (nameInput) nameInput.value = ce.name || '';
            if (workTypeSelect) workTypeSelect.value = ce.workType || 'ME';

            // 曜日ごとのステータス設定（V1互換）
            const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            dayNames.forEach(day => {
                const select = document.getElementById(`ceStatus_${day}`);
                if (select) {
                    select.value = ce.status?.[day] || '';
                }
            });
            
            console.log('📝 CE編集モーダル表示:', ce.name);
            window.showModal('ceEditModal');
        }

        async saveCEFromModal() {
            if (this.editingCEIndex === -1) return;
            
            const ce = this.ceList[this.editingCEIndex];
            if (!ce) return;

            // 基本情報の更新
            const nameInput = document.getElementById('editCEName');
            const workTypeSelect = document.getElementById('editCEWorkType');
            
            const newName = nameInput?.value?.trim();
            const newWorkType = workTypeSelect?.value;

            if (!newName) {
                window.showMessage('名前を入力してください', 'warning');
                return;
            }

            // 重複チェック（自分以外で同じ名前があるか）
            const duplicateIndex = this.ceList.findIndex((other, idx) => 
                idx !== this.editingCEIndex && other.name === newName
            );
            if (duplicateIndex !== -1) {
                window.showMessage('同じ名前のCEが既に存在します', 'warning');
                return;
            }

            ce.name = newName;
            ce.workType = newWorkType;
            
            // 曜日ごとのステータスを更新
            if (!ce.status) ce.status = {};
            const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            dayNames.forEach(day => {
                const select = document.getElementById(`ceStatus_${day}`);
                if (select) {
                    ce.status[day] = select.value;
                }
            });
            
            ce.updatedAt = Date.now();
            ce.updatedBy = window.currentUserData?.displayName || 'unknown';

            try {
                await this.saveCEList();
                window.closeModal('ceEditModal');
                window.showMessage('CEを更新しました', 'success');
                console.log('✅ CE更新完了:', ce.name);
            } catch (error) {
                console.error('❌ CE保存エラー:', error);
                window.showMessage('CEの保存に失敗しました', 'error');
            } finally {
                this.editingCEIndex = -1;
            }
        }

        // 新しいCEの追加（サイドバーの機能を活用）
        async addNewCE(name, workType = 'ME') {
            if (window.userRole === 'viewer') {
                window.showMessage('編集権限がありません', 'warning');
                return;
            }

            if (!name || !name.trim()) {
                window.showMessage('CE名を入力してください', 'warning');
                return;
            }

            // 重複チェック
            if (this.ceList.some(ce => ce.name === name.trim())) {
                window.showMessage('同じ名前のCEが既に存在します', 'warning');
                return;
            }

            const newCE = {
                name: name.trim(),
                workType: workType.toUpperCase(),
                department: null,
                status: {
                    monday: '', tuesday: '', wednesday: '', thursday: '',
                    friday: '', saturday: '', sunday: ''
                },
                createdAt: Date.now(),
                createdBy: window.currentUserData?.displayName || 'unknown'
            };

            this.ceList.push(newCE);
            
            try {
                await this.saveCEList();
                window.showMessage(`${name}を追加しました`, 'success');
                console.log('✅ CE追加完了:', name);
            } catch (error) {
                console.error('❌ CE追加エラー:', error);
                window.showMessage('CEの追加に失敗しました', 'error');
            }
        }
    }

    // グローバル公開
    window.CEManager = CEManager;
    console.log('👥 CEマネージャークラス読み込み完了（V1完全互換版）');
})();
