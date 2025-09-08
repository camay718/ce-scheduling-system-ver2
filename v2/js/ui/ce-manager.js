/**
 * CE管理システム - V2統合版（日別ステータス対応）
 */
(function() {
    'use strict';

    class CEManager {
        constructor() {
            this.ceList = [];
            this.isInitialized = false;
            this.editingCEIndex = -1;
            this.dbRef = null;
            this.currentDisplayDate = new Date();
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
                    this.ceList = JSON.parse(JSON.stringify(window.CE_LIST_INITIAL)).map((ce, index) => ({
                        ...ce,
                        id: `initial_ce_${index}_${Date.now()}`,
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
            this.ceList = this.ceList.map((ce, index) => {
                const validWorkTypes = ['OPE', 'ME', 'HD', 'FLEX'];
                const workType = (ce.workType || 'ME').toUpperCase();
                const normalizedWorkType = validWorkTypes.includes(workType) ? workType : 'ME';

                const defaultStatus = {
                    monday: '', tuesday: '', wednesday: '', thursday: '',
                    friday: '', saturday: '', sunday: ''
                };
                const status = Object.assign({}, defaultStatus, ce.status || {});

                return {
                    id: ce.id || `normalized_ce_${index}_${Date.now()}`,
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
                
                // 日別ステータス表示（CEDailyStatusManagerから取得）
                const statusBadge = this.renderStatusBadge(ce);
                
                ceElement.innerHTML = `
                    ${statusBadge}
                    <div class="font-medium">${ce.name}</div>
                    <div class="text-xs opacity-75">${ce.workType}</div>
                `;
                ceElement.draggable = window.userRole !== 'viewer';
                ceElement.dataset.ceId = ce.id;
                ceElement.dataset.ceIndex = index;
                ceElement.dataset.ceName = ce.name;
                ceElement.dataset.workType = ce.workType;
                
                // ダブルクリック機能を削除（要望に応じて）
                
                // ドラッグ機能（閲覧者以外）
                if (window.userRole !== 'viewer') {
                    ceElement.addEventListener('dragstart', (e) => {
                        const dragData = {
                            ceId: ce.id,
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
            
            // 人数表示の更新
            const countEl = document.getElementById('ceListCount');
            if (countEl) {
                countEl.textContent = this.ceList.length;
            }
            
            console.log('✅ CEリスト表示完了:', this.ceList.length, '名');
        }

        renderStatusBadge(ce) {
            // CEDailyStatusManagerから現在の日付のステータスを取得
            if (window.ceDailyStatus && window.ceDailyStatus.isInitialized) {
                const status = window.ceDailyStatus.getStatusForCE(ce.id);
                if (status) {
                    return `<span class="status-badge status-${status}">${status}</span>`;
                }
            }
            
            // フォールバック：曜日テンプレートから取得
            const today = this.currentDisplayDate || new Date();
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const currentDay = dayNames[today.getDay()];
            const status = ce.status?.[currentDay] || '';
            
            if (!status) return '';
            return `<span class="status-badge status-${status}">${status}</span>`;
        }

        setupEventListeners() {
            const saveCEButton = document.getElementById('saveCEButton');
            if (saveCEButton && !saveCEButton.dataset.ceManagerBound) {
                saveCEButton.dataset.ceManagerBound = 'true';
                saveCEButton.addEventListener('click', () => this.saveCEFromModal());
            }

            const deleteCEButton = document.getElementById('deleteCEButton');
            if (deleteCEButton && !deleteCEButton.dataset.ceManagerBound) {
                deleteCEButton.dataset.ceManagerBound = 'true';
                deleteCEButton.addEventListener('click', () => this.deleteCEFromModal());
            }
        }

        openCEEditModal(index) {
            if (window.userRole === 'viewer') {
                window.showMessage('編集権限がありません', 'warning');
                return;
            }

            this.editingCEIndex = index;
            const ce = this.ceList[index];
            if (!ce) return;

            const nameInput = document.getElementById('editCEName');
            const workTypeSelect = document.getElementById('editCEWorkType');
            
            if (nameInput) nameInput.value = ce.name || '';
            if (workTypeSelect) workTypeSelect.value = ce.workType || 'ME';

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

            const nameInput = document.getElementById('editCEName');
            const workTypeSelect = document.getElementById('editCEWorkType');
            
            const newName = nameInput?.value?.trim();
            const newWorkType = workTypeSelect?.value;

            if (!newName) {
                window.showMessage('名前を入力してください', 'warning');
                return;
            }

            const duplicateIndex = this.ceList.findIndex((other, idx) => 
                idx !== this.editingCEIndex && other.name === newName
            );
            if (duplicateIndex !== -1) {
                window.showMessage('同じ名前のCEが既に存在します', 'warning');
                return;
            }

            ce.name = newName;
            ce.workType = newWorkType;
            
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
                
                // CEリスト管理画面も更新
                if (window.ceDailyStatus) {
                    window.ceDailyStatus.renderCEManagementTable();
                }
            } catch (error) {
                console.error('❌ CE保存エラー:', error);
                window.showMessage('CEの保存に失敗しました', 'error');
            } finally {
                this.editingCEIndex = -1;
            }
        }

        async deleteCEFromModal() {
            if (this.editingCEIndex === -1) return;
            
            const ceToDelete = this.ceList[this.editingCEIndex];
            if (!ceToDelete) return;

            if (!confirm(`CE「${ceToDelete.name}」を削除しますか？\n\nこの操作は元に戻せません。`)) {
                return;
            }

            try {
                this.ceList.splice(this.editingCEIndex, 1);
                await this.saveCEList();
                
                window.closeModal('ceEditModal');
                window.showMessage(`${ceToDelete.name}を削除しました`, 'success');
                
                // CEリスト管理画面も更新
                if (window.ceDailyStatus) {
                    window.ceDailyStatus.renderCEManagementTable();
                }
            } catch (error) {
                console.error('❌ CE削除エラー:', error);
                window.showMessage('CEの削除に失敗しました', 'error');
            } finally {
                this.editingCEIndex = -1;
            }
        }

        async addNewCE(name, workType = 'ME') {
            if (window.userRole === 'viewer') {
                window.showMessage('編集権限がありません', 'warning');
                return;
            }

            if (!name || !name.trim()) {
                window.showMessage('CE名を入力してください', 'warning');
                return;
            }

            if (this.ceList.some(ce => ce.name === name.trim())) {
                window.showMessage('同じ名前のCEが既に存在します', 'warning');
                return;
            }

            const newCE = {
                id: `ce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
            } catch (error) {
                console.error('❌ CE追加エラー:', error);
                window.showMessage('CEの追加に失敗しました', 'error');
            }
        }
    }

    window.CEManager = CEManager;
    console.log('👥 CEマネージャークラス読み込み完了（日別ステータス対応版）');
})();
