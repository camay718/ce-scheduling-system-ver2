// dashboard-main.js - メイン処理（修正版）

(async function() {
    'use strict';
    
    console.log('[MAIN] dashboard-main.js 読み込み開始');

    try {
        // グローバル変数
        let currentSchedules = [];
        let ceList = [];
        let currentUser = null;
        let database = null;
        let autoRefreshInterval = null;
        
        // アプリケーション設定
        let appSettings = {
            theme: 'light',
            notifications: true,
            autoRefresh: true
        };

        // システム初期化
        async function initializeDashboard() {
            console.log('[MAIN] システム初期化開始');

            try {
                // Firebase設定完了まで待機
                await waitForFirebase();
                console.log('[MAIN] Firebase設定完了');

                // 認証チェック
                if (!await checkAuthentication()) {
                    console.log('[MAIN] 認証チェック失敗');
                    redirectToLogin();
                    return;
                }
                console.log('[MAIN] 認証チェック完了');

                // DOM初期化
                initializeDOM();
                console.log('[MAIN] DOM初期化完了');

                // データ読み込み
                await loadInitialData();
                console.log('[MAIN] 初期データ読み込み完了');

                // UI更新
                updateUI();
                console.log('[MAIN] UI更新完了');

                // 自動更新開始
                startAutoRefresh();
                console.log('[MAIN] 自動更新開始');

                // ローディングを隠す
                hideLoading();
                console.log('[MAIN] システム初期化完了');

            } catch (error) {
                console.error('[MAIN] 初期化エラー:', error);
                showInitializationError(error);
            }
        }

        // Firebase待機
        async function waitForFirebase() {
            return new Promise((resolve, reject) => {
                let attempts = 0;
                const maxAttempts = 50;
                
                const checkFirebase = () => {
                    attempts++;
                    if (window.dashboardAuth && typeof firebase !== 'undefined') {
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        reject(new Error('Firebase初期化タイムアウト'));
                    } else {
                        setTimeout(checkFirebase, 100);
                    }
                };
                
                checkFirebase();
            });
        }

        // 認証チェック
        async function checkAuthentication() {
            try {
                if (!window.dashboardAuth) {
                    console.error('[MAIN] dashboardAuth が見つかりません');
                    return false;
                }

                // セッション確認
                const sessionValid = window.dashboardAuth.checkSession();
                if (!sessionValid) {
                    console.log('[MAIN] セッション無効');
                    return false;
                }

                // Firebase初期化
                const firebaseReady = await window.dashboardAuth.initializeFirebase();
                if (!firebaseReady) {
                    console.log('[MAIN] Firebase初期化失敗');
                    return false;
                }

                // 認証確認
                const authValid = await window.dashboardAuth.verifyAuthentication();
                if (!authValid) {
                    console.log('[MAIN] 認証確認失敗');
                    return false;
                }

                // 現在のユーザー設定
                currentUser = window.dashboardAuth.getCurrentUser();
                database = window.dashboardAuth.getDatabase();
                
                console.log('[MAIN] 認証成功:', currentUser?.username);
                return true;

            } catch (error) {
                console.error('[MAIN] 認証チェックエラー:', error);
                return false;
            }
        }

        // ログイン画面にリダイレクト
        function redirectToLogin() {
            const message = 'dashboardAuthクラスが見つかりません。ログイン画面に戻ります。';
            alert(message);
            console.log('[MAIN] ログイン画面にリダイレクト');
            window.location.href = 'login.html';
        }

        // DOM初期化
        function initializeDOM() {
            // 基本的なDOM要素の確認
            const requiredElements = [
                'loading',
                'main-content',
                'schedule-container'
            ];

            for (const elementId of requiredElements) {
                const element = document.getElementById(elementId);
                if (!element) {
                    console.warn(`[MAIN] 必要な要素が見つかりません: ${elementId}`);
                }
            }

            // イベントリスナーの設定
            setupEventListeners();
        }

        // イベントリスナー設定
        function setupEventListeners() {
            // 検索・フィルター
            const searchInput = document.getElementById('searchSchedule');
            if (searchInput) {
                searchInput.addEventListener('input', debounce(filterSchedules, 300));
            }

            const filterStatus = document.getElementById('filterStatus');
            if (filterStatus) {
                filterStatus.addEventListener('change', filterSchedules);
            }

            // 設定関連
            const settingsBtn = document.getElementById('settingsBtn');
            if (settingsBtn) {
                settingsBtn.addEventListener('click', showSettingsModal);
            }

            // ログアウト
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', logout);
            }
        }

        // 初期データ読み込み
        async function loadInitialData() {
            try {
                await Promise.all([
                    loadScheduleData(),
                    loadCEList(),
                    loadSettings()
                ]);
            } catch (error) {
                console.error('[MAIN] 初期データ読み込みエラー:', error);
                throw error;
            }
        }

        // スケジュールデータ読み込み
        async function loadScheduleData() {
            try {
                if (!database) {
                    throw new Error('データベースが初期化されていません');
                }

                const schedulesRef = database.ref('schedules');
                const snapshot = await schedulesRef.once('value');
                
                currentSchedules = [];
                if (snapshot.exists()) {
                    snapshot.forEach(childSnapshot => {
                        const schedule = {
                            id: childSnapshot.key,
                            ...childSnapshot.val()
                        };
                        currentSchedules.push(schedule);
                    });
                }

                console.log(`[MAIN] スケジュールデータ読み込み完了: ${currentSchedules.length}件`);
                
            } catch (error) {
                console.error('[MAIN] スケジュールデータ読み込みエラー:', error);
                throw error;
            }
        }

        // CEリスト読み込み
        async function loadCEList() {
            try {
                if (!database) {
                    throw new Error('データベースが初期化されていません');
                }

                const ceRef = database.ref('ceList');
                const snapshot = await ceRef.once('value');
                
                ceList = [];
                if (snapshot.exists()) {
                    snapshot.forEach(childSnapshot => {
                        const ce = {
                            id: childSnapshot.key,
                            ...childSnapshot.val()
                        };
                        ceList.push(ce);
                    });
                }

                console.log(`[MAIN] CEリスト読み込み完了: ${ceList.length}件`);
                
            } catch (error) {
                console.error('[MAIN] CEリスト読み込みエラー:', error);
                throw error;
            }
        }

        // UI更新
        function updateUI() {
            try {
                displaySchedules();
                updateStatistics();
                updateCEDisplay();
            } catch (error) {
                console.error('[MAIN] UI更新エラー:', error);
            }
        }

        // スケジュール表示
        function displaySchedules(schedules = currentSchedules) {
            const container = document.getElementById('schedule-container');
            if (!container) {
                console.warn('[MAIN] スケジュールコンテナが見つかりません');
                return;
            }

            if (!schedules.length) {
                container.innerHTML = '<div class="no-data">スケジュールがありません</div>';
                return;
            }

            const html = schedules.map(schedule => `
                <div class="schedule-item ${schedule.completed ? 'completed' : ''}">
                    <div class="schedule-header">
                        <h3>${escapeHtml(schedule.title || '')}</h3>
                        <div class="schedule-status">
                            ${schedule.completed ? '完了' : '未完了'}
                        </div>
                    </div>
                    <div class="schedule-details">
                        <p><strong>日時:</strong> ${escapeHtml(schedule.date || '')} ${escapeHtml(schedule.startTime || '')} - ${escapeHtml(schedule.endTime || '')}</p>
                        <p><strong>場所:</strong> ${escapeHtml(schedule.location || '')}</p>
                        <p><strong>説明:</strong> ${escapeHtml(schedule.description || '')}</p>
                        <p><strong>担当CE:</strong> ${(schedule.assignedCEs || []).map(ce => escapeHtml(ce)).join(', ')}</p>
                    </div>
                    <div class="schedule-actions">
                        <button onclick="editSchedule('${schedule.id}')" class="btn btn-primary">編集</button>
                        <button onclick="toggleTaskCompletion('${schedule.id}', ${schedule.completed})" class="btn btn-secondary">
                            ${schedule.completed ? '未完了にする' : '完了にする'}
                        </button>
                        <button onclick="deleteSchedule('${schedule.id}')" class="btn btn-danger">削除</button>
                    </div>
                </div>
            `).join('');

            container.innerHTML = html;
        }

        // 統計情報更新
        function updateStatistics() {
            const total = currentSchedules.length;
            const completed = currentSchedules.filter(s => s.completed).length;
            const pending = total - completed;
            const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

            updateElementText('totalTasks', total);
            updateElementText('completedTasks', completed);
            updateElementText('pendingTasks', pending);
            updateElementText('completionRate', `${completionRate}%`);
        }

        // CE表示更新
        function updateCEDisplay() {
            const container = document.getElementById('ce-list-container');
            if (!container) return;

            if (!ceList.length) {
                container.innerHTML = '<div class="no-data">CEが登録されていません</div>';
                return;
            }

            const html = ceList.map(ce => `
                <div class="ce-item">
                    <div class="ce-info">
                        <span class="ce-name">${escapeHtml(ce.name || '')}</span>
                        <span class="ce-status ${ce.available ? 'available' : 'unavailable'}">
                            ${ce.available ? '稼働中' : '休暇中'}
                        </span>
                    </div>
                    <div class="ce-actions">
                        <button onclick="editCE('${ce.id}')" class="btn btn-sm">編集</button>
                        <button onclick="toggleCEAvailability('${ce.id}')" class="btn btn-sm">
                            ${ce.available ? '休暇' : '稼働'}
                        </button>
                    </div>
                </div>
            `).join('');

            container.innerHTML = html;
        }

        // フィルター機能
        function filterSchedules() {
            const searchTerm = getElementValue('searchSchedule').toLowerCase();
            const statusFilter = getElementValue('filterStatus');

            let filtered = currentSchedules;

            // テキスト検索
            if (searchTerm) {
                filtered = filtered.filter(schedule => 
                    (schedule.title || '').toLowerCase().includes(searchTerm) ||
                    (schedule.description || '').toLowerCase().includes(searchTerm) ||
                    (schedule.location || '').toLowerCase().includes(searchTerm)
                );
            }

            // ステータスフィルター
            if (statusFilter && statusFilter !== 'all') {
                filtered = filtered.filter(schedule => {
                    if (statusFilter === 'completed') return schedule.completed;
                    if (statusFilter === 'pending') return !schedule.completed;
                    return true;
                });
            }

            displaySchedules(filtered);
        }

        // タスク完了切り替え
        async function toggleTaskCompletion(scheduleId, currentStatus) {
            try {
                const scheduleRef = database.ref(`schedules/${scheduleId}`);
                const newStatus = !currentStatus;
                
                await scheduleRef.update({
                    completed: newStatus,
                    completedBy: newStatus ? currentUser?.uid : null,
                    completedAt: newStatus ? new Date().toISOString() : null,
                    lastModified: new Date().toISOString()
                });

                showNotification(`タスクを${newStatus ? '完了' : '未完了'}に設定しました`, 'success');
                await loadScheduleData();
                updateUI();
                
            } catch (error) {
                console.error('[MAIN] タスク状態更新エラー:', error);
                showNotification('タスク状態の更新に失敗しました', 'error');
            }
        }

        // スケジュール削除
        async function deleteSchedule(scheduleId) {
            if (!confirm('このスケジュールを削除してもよろしいですか？')) {
                return;
            }

            try {
                await database.ref(`schedules/${scheduleId}`).remove();
                showNotification('スケジュールが削除されました', 'success');
                await loadScheduleData();
                updateUI();
                
            } catch (error) {
                console.error('[MAIN] スケジュール削除エラー:', error);
                showNotification('スケジュール削除に失敗しました', 'error');
            }
        }

        // スケジュール編集
        function editSchedule(scheduleId) {
            window.location.href = `edit.html?id=${scheduleId}`;
        }

        // CE編集
        function editCE(ceId) {
            const ce = ceList.find(c => c.id === ceId);
            if (!ce) return;

            const newName = prompt('CEの名前を編集してください:', ce.name);
            if (!newName || newName === ce.name) return;

            updateCE(ceId, { name: newName.trim() });
        }

        // CE稼働状態切り替え
        function toggleCEAvailability(ceId) {
            const ce = ceList.find(c => c.id === ceId);
            if (!ce) return;

            updateCE(ceId, { available: !ce.available });
        }

        // CE更新
        async function updateCE(ceId, updates) {
            try {
                const ceRef = database.ref(`ceList/${ceId}`);
                await ceRef.update({
                    ...updates,
                    lastModified: new Date().toISOString()
                });

                showNotification('CEが更新されました', 'success');
                await loadCEList();
                updateUI();
                
            } catch (error) {
                console.error('[MAIN] CE更新エラー:', error);
                showNotification('CEの更新に失敗しました', 'error');
            }
        }

        // 設定読み込み
        function loadSettings() {
            try {
                const settings = localStorage.getItem('ceScheduleSettings');
                if (settings) {
                    appSettings = { ...appSettings, ...JSON.parse(settings) };
                }
                applySettings();
            } catch (error) {
                console.error('[MAIN] 設定読み込みエラー:', error);
            }
        }

        // 設定適用
        function applySettings() {
            document.body.className = appSettings.theme;
        }

        // 設定モーダル表示
        function showSettingsModal() {
            console.log('[MAIN] 設定モーダルを表示');
            // 実装は必要に応じて追加
        }

        // 自動更新開始
        function startAutoRefresh() {
            if (appSettings.autoRefresh && !autoRefreshInterval) {
                autoRefreshInterval = setInterval(async () => {
                    try {
                        await loadScheduleData();
                        await loadCEList();
                        updateUI();
                    } catch (error) {
                        console.error('[MAIN] 自動更新エラー:', error);
                    }
                }, 30000); // 30秒ごと
            }
        }

        // 自動更新停止
        function stopAutoRefresh() {
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
            }
        }

        // ローディング非表示
        function hideLoading() {
            const loading = document.getElementById('loading');
            if (loading) {
                loading.style.display = 'none';
            }

            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                mainContent.style.display = 'block';
            }
        }

        // 初期化エラー表示
        function showInitializationError(error) {
            const loading = document.getElementById('loading');
            if (loading) {
                loading.innerHTML = `
                    <div class="error-container">
                        <h3>システム初期化エラー</h3>
                        <p>システムの初期化中にエラーが発生しました。</p>
                        <p>エラー詳細: ${escapeHtml(error.message)}</p>
                        <button onclick="location.reload()" class="btn btn-primary">ページを再読み込み</button>
                    </div>
                `;
            }
        }

        // ログアウト
        function logout() {
            if (confirm('ログアウトしますか？')) {
                stopAutoRefresh();
                if (window.dashboardAuth) {
                    window.dashboardAuth.logout();
                } else {
                    window.location.href = 'login.html';
                }
            }
        }

        // 通知表示
        function showNotification(message, type = 'info') {
            console.log(`[MAIN] 通知 (${type}): ${message}`);
            
            // 実際の通知UIがある場合はここに実装
            const notificationArea = document.getElementById('notification-area');
            if (notificationArea) {
                const notification = document.createElement('div');
                notification.className = `notification ${type}`;
                notification.textContent = message;
                notificationArea.appendChild(notification);
                
                setTimeout(() => {
                    notification.remove();
                }, 3000);
            }
        }

        // ユーティリティ関数
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function updateElementText(id, text) {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = text;
            }
        }

        function getElementValue(id) {
            const element = document.getElementById(id);
            return element ? element.value : '';
        }

        // Window離脱時のクリーンアップ
        window.addEventListener('beforeunload', () => {
            stopAutoRefresh();
        });

        // グローバル関数の公開
        window.toggleTaskCompletion = toggleTaskCompletion;
        window.deleteSchedule = deleteSchedule;
        window.editSchedule = editSchedule;
        window.editCE = editCE;
        window.toggleCEAvailability = toggleCEAvailability;
        window.showSettingsModal = showSettingsModal;
        window.logout = logout;

        // システム初期化実行
        console.log('[MAIN] システム初期化を開始します...');
        await initializeDashboard();
        
        console.log('[MAIN] dashboard-main.js 読み込み完了');

    } catch (error) {
        console.error('[MAIN] システム初期化中に重大なエラーが発生しました:', error);
        
        // エラー表示
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div class="error-container">
                    <h3>システム初期化エラー</h3>
                    <p>システムの初期化中にエラーが発生しました。</p>
                    <p>エラー詳細: ${error.message}</p>
                    <button onclick="location.reload()" class="btn btn-primary">ページを再読み込み</button>
                </div>
            `;
            loadingEl.style.display = 'block';
        }
    }

})();
