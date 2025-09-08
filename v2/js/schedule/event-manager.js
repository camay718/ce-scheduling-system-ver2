/**
 * イベント管理システム - V2統合版
 * 業務の追加・編集・削除機能とFirebase連携
 */
(function() {
    'use strict';

    class EventManager {
        constructor() {
            this.scheduleCore = null;
            this.currentEvent = null;
            this.isInitialized = false;
            this.init();
        }

        async init() {
            try {
                await this.waitForDependencies();
                this.scheduleCore = new window.ScheduleCore();
                this.setupEventListeners();
                this.isInitialized = true;
                console.log('📝 イベントマネージャー初期化完了');
            } catch (error) {
                console.error('❌ イベントマネージャー初期化エラー:', error);
            }
        }

        async waitForDependencies() {
            let attempts = 0;
            while (attempts < 30) {
                if (window.ScheduleCore && window.DateUtils && window.database && window.DEPARTMENTS) {
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            throw new Error('EventManager: 依存関係の初期化タイムアウト');
        }

        setupEventListeners() {
            // イベント追加ボタン（複数のaddEventButtonに対応）
            document.querySelectorAll('#addEventButton').forEach(button => {
                button.onclick = () => this.openEventModal('create');
            });

            // モーダルのフォーム送信
            const eventForm = document.getElementById('eventForm');
            if (eventForm) {
                eventForm.onsubmit = (e) => {
                    e.preventDefault();
                    this.saveEvent();
                };
            }

            // モーダルの削除ボタン
            const deleteBtn = document.getElementById('deleteEventBtn');
            if (deleteBtn) {
                deleteBtn.onclick = () => this.deleteEvent();
            }

            // 業務クリアボタン
            document.querySelectorAll('#clearEventsButton').forEach(button => {
                button.onclick = () => this.clearAllEvents();
            });

            // 部門選択肢の動的設定
            this.setupDepartmentOptions();
        }

        setupDepartmentOptions() {
            const departmentSelect = document.getElementById('eventDepartment');
            if (departmentSelect && window.DEPARTMENTS) {
                departmentSelect.innerHTML = window.DEPARTMENTS.map(dept => 
                    `<option value="${dept}">${dept}</option>`
                ).join('');
            }
        }

        /**
         * イベントモーダルを開く
         * @param {string} mode 'create' or 'edit'
         * @param {string} dateKey 日付キー (YYYY-MM-DD)
         * @param {Object} event 編集対象のイベント（edit時のみ）
         */
        openEventModal(mode, dateKey = null, event = null) {
            // 権限チェック
            if (!this.hasEditPermission()) {
                this.showMessage('編集権限がありません', 'warning');
                return;
            }

            this.currentEvent = { mode, dateKey, event };
            
            const modalTitle = document.getElementById('eventModalTitle');
            const deleteBtn = document.getElementById('deleteEventBtn');
            
            modalTitle.textContent = (mode === 'edit') ? '業務編集' : '業務追加';
            deleteBtn.style.display = (mode === 'edit') ? 'inline-block' : 'none';

            if (mode === 'edit' && event) {
                // 編集モード：既存データを設定
                document.getElementById('eventName').value = event.name || '';
                document.getElementById('eventDepartment').value = event.department || '';
                document.getElementById('eventDate').value = event.date || dateKey;
                document.getElementById('eventStartTime').value = event.startTime || '';
                document.getElementById('eventEndTime').value = event.endTime || '';
                document.getElementById('eventCount').value = event.count || 1;
                document.getElementById('eventRequired').value = event.requiredPeople || 1;
                document.getElementById('eventMemo').value = event.memo || '';
                
                // 編集時は日付変更不可
                document.getElementById('eventDate').disabled = true;
            } else {
                // 新規作成モード：初期値設定
                document.getElementById('eventForm').reset();
                document.getElementById('eventDate').value = dateKey || window.DateUtils.formatDateISO(new Date());
                document.getElementById('eventStartTime').value = '09:00';
                document.getElementById('eventEndTime').value = '17:00';
                document.getElementById('eventCount').value = '1';
                document.getElementById('eventRequired').value = '1';
                
                // 新規作成時は日付変更可能
                document.getElementById('eventDate').disabled = false;
            }
            
            window.showModal('eventModal');
        }

        async saveEvent() {
            try {
                const eventData = this.getFormData();
                
                // バリデーション
                const validationError = this.validateEventData(eventData);
                if (validationError) {
                    this.showMessage(validationError, 'warning');
                    return;
                }

                // 部門権限チェック
                if (!this.checkDepartmentPermission(eventData.department)) {
                    return;
                }

                // 保存実行
                if (this.currentEvent.mode === 'edit') {
                    await this.scheduleCore.updateEvent(
                        this.currentEvent.dateKey, 
                        this.currentEvent.event.id, 
                        eventData
                    );
                    this.showMessage('業務を更新しました', 'success');
                } else {
                    await this.scheduleCore.addEvent(eventData);
                    this.showMessage('業務を追加しました', 'success');
                }

                window.closeModal('eventModal');
                
            } catch (error) {
                console.error('❌ イベント保存エラー:', error);
                this.showMessage(`保存に失敗しました: ${error.message}`, 'error');
            }
        }

        async deleteEvent() {
            if (this.currentEvent.mode !== 'edit' || !this.currentEvent.event) {
                this.showMessage('削除対象のイベントが見つかりません', 'warning');
                return;
            }

            const eventName = this.currentEvent.event.name;
            if (!confirm(`「${eventName}」を削除しますか？`)) {
                return;
            }

            try {
                await this.scheduleCore.deleteEvent(
                    this.currentEvent.dateKey, 
                    this.currentEvent.event.id
                );
                
                this.showMessage('業務を削除しました', 'success');
                window.closeModal('eventModal');
                
            } catch (error) {
                console.error('❌ イベント削除エラー:', error);
                this.showMessage(`削除に失敗しました: ${error.message}`, 'error');
            }
        }

        async clearAllEvents() {
            // 管理者権限チェック
            if (window.userRole !== 'admin') {
                this.showMessage('全業務クリアには管理者権限が必要です', 'warning');
                return;
            }

            if (!confirm('本当に全ての業務データをクリアしますか？\nこの操作は元に戻せません。')) {
                return;
            }

            try {
                await window.database.ref(`${window.DATA_ROOT}/events/byDate`).remove();
                this.showMessage('全ての業務データをクリアしました', 'success');
            } catch (error) {
                console.error('❌ 全業務クリアエラー:', error);
                this.showMessage(`全業務のクリアに失敗しました: ${error.message}`, 'error');
            }
        }

        // ユーティリティメソッド
        getFormData() {
            return {
                name: document.getElementById('eventName').value.trim(),
                department: document.getElementById('eventDepartment').value,
                date: document.getElementById('eventDate').value,
                startTime: document.getElementById('eventStartTime').value,
                endTime: document.getElementById('eventEndTime').value,
                count: parseInt(document.getElementById('eventCount').value) || 1,
                requiredPeople: parseInt(document.getElementById('eventRequired').value) || 1,
                memo: document.getElementById('eventMemo').value.trim()
            };
        }

        validateEventData(data) {
            if (!data.name) return '業務名を入力してください';
            if (!data.department) return '部門を選択してください';
            if (!data.date) return '日付を選択してください';
            if (!data.startTime || !data.endTime) return '開始時間と終了時間を入力してください';
            if (data.startTime >= data.endTime) return '終了時間は開始時間より後にしてください';
            if (data.count < 1) return '件数は1以上で入力してください';
            if (data.requiredPeople < 1) return '必要人数は1以上で入力してください';
            return null;
        }

        hasEditPermission() {
            return window.userRole && ['editor', 'admin'].includes(window.userRole);
        }

        checkDepartmentPermission(department) {
            // 管理者は全部門編集可能
            if (window.userRole === 'admin') return true;
            
            // 編集者は自部門または確認後に他部門編集可能
            if (window.userRole === 'editor') {
                const userDept = window.currentUserData?.department;
                if (userDept && department !== userDept) {
                    return confirm(`他部門（${department}）の業務を操作しますか？`);
                }
                return true;
            }
            
            return false;
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
    window.EventManager = EventManager;
    console.log('📝 イベントマネージャークラス読み込み完了');
})();
