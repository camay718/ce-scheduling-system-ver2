// dashboard-main.js - メイン処理（完全修正版）

(function() {
    'use strict';
    
    console.log('[MAIN] dashboard-main.js 読み込み開始');

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

            // ローディング完了
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

    // 認証チェック（修正版）
    async function checkAuthentication() {
        try {
            if (!window.dashboardAuth) {
                console.error('[MAIN] dashboardAuth が見つかりません');
                redirectToLogin();
                return false;
            }

            // セッション確認
            const sessionValid = window.dashboardAuth.checkSession();
            if (!sessionValid) {
                console.log('[MAIN] セッション無効');
                redirectToLogin();
                return false;
            }

            // Firebase初期化
            const firebaseReady = await window.dashboardAuth.initializeFirebase();
            if (!firebaseReady) {
                console.log('[MAIN] Firebase初期化失敗');
                // Firebase失敗でも認証は継続
            }

            // 認証確認
            const authValid = await window.dashboardAuth.verifyAuthentication();
            if (!authValid) {
                console.log('[MAIN] 認証確認失敗');
                redirectToLogin();
                return false;
            }

            // 現在のユーザー設定
            currentUser = window.dashboardAuth.getCurrentUser();
            database = window.dashboardAuth.getDatabase();
            
            console.log('[MAIN] 認証成功:', currentUser?.username);
            return true;

        } catch (error) {
            console.error('[MAIN] 認証チェックエラー:', error);
            redirectToLogin();
            return false;
        }
    }

    // ログイン画面にリダイレクト
    function redirectToLogin() {
        console.log('[MAIN] ログイン画面にリダイレクト');
        window.location.href = 'login.html';
    }

    // DOM初期化
    function initializeDOM() {
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

        const filterDate = document.getElementById('filterDate'); 
        if (filterDate) {
            filterDate.addEventListener('change', filterSchedules);
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
            // エラーでも継続
        }
    }

    // スケジュールデータ読み込み
    async function loadScheduleData() {
        try {
            console.log('[MAIN] スケジュールデータ読み込み開始');
            
            if (!database) {
                console.warn('[MAIN] データベース未初期化、空データで継続');
                currentSchedules = [];
                return;
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
            currentSchedules = [];
        }
    }

    // CEリスト読み込み
    async function loadCEList() {
        try {
            console.log('[MAIN] CEリスト読み込み開始');
            
            if (!database) {
                console.warn('[MAIN] データベース未初期化、空データで継続');
                ceList = [];
                return;
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
            ceList = [];
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

    // 機能関数群
    function filterSchedules() {
        const searchTerm = getElementValue('searchSchedule').toLowerCase();
        const statusFilter = getElementValue('filterStatus');
        const dateFilter = getElementValue('filterDate');

        let filtered = currentSchedules;

        if (searchTerm) {
            filtered = filtered.filter(schedule => 
                (schedule.title || '').toLowerCase().includes(searchTerm) ||
                (schedule.description || '').toLowerCase().includes(searchTerm) ||
                (schedule.location || '').toLowerCase().includes(searchTerm)
            );
        }

        if (statusFilter && statusFilter !== 'all') {
            filtered = filtered.filter(schedule => {
                if (statusFilter === 'completed') return schedule.completed;
                if (statusFilter === 'pending') return !schedule.completed;
                return true;
            });
        }

        if (dateFilter) {
            filtered = filtered.filter(schedule => schedule.date === dateFilter);
        }

        displaySchedules(filtered);
    }

    // 設定管理
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

    function applySettings() {
        document.body.className = appSettings.theme;
    }

    // 自動更新
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
            }, 30000);
        }
    }

    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }

    // UI操作
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

    // グローバル関数群
    window.toggleTaskCompletion = async function(scheduleId, currentStatus) {
        try {
            if (!database) {
                showNotification('データベース接続エラー', 'error');
                return;
            }

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
    };

    window.deleteSchedule = async function(scheduleId) {
        if (!confirm('このスケジュールを削除してもよろしいですか？')) {
            return;
        }

        try {
            if (!database) {
                showNotification('データベース接続エラー', 'error');
                return;
            }

            await database.ref(`schedules/${scheduleId}`).remove();
            showNotification('スケジュールが削除されました', 'success');
            await loadScheduleData();
            updateUI();
            
        } catch (error) {
            console.error('[MAIN] スケジュール削除エラー:', error);
            showNotification('スケジュール削除に失敗しました', 'error');
        }
    };

    window.editSchedule = function(scheduleId) {
        window.location.href = `edit.html?id=${scheduleId}`;
    };

    window.addCE = async function() {
        const name = prompt('CEの名前を入力してください:');
        if (!name) return;

        try {
            if (!database) {
                showNotification('データベース接続エラー', 'error');
                return;
            }

            await database.ref('ceList').push({
                name: name.trim(),
                available: true,
                createdAt: new Date().toISOString()
            });
            
            showNotification('CEが追加されました', 'success');
            await loadCEList();
            updateUI();
        } catch (error) {
            console.error('[MAIN] CE追加エラー:', error);
            showNotification('CEの追加に失敗しました', 'error');
        }
    };

    window.editCE = async function(ceId) {
        const ce = ceList.find(c => c.id === ceId);
        if (!ce) return;

        const newName = prompt('CEの名前を編集してください:', ce.name);
        if (!newName || newName === ce.name) return;

        try {
            if (!database) {
                showNotification('データベース接続エラー', 'error');
                return;
            }

            await database.ref(`ceList/${ceId}`).update({
                name: newName.trim(),
                lastModified: new Date().toISOString()
            });

            showNotification('CEが更新されました', 'success');
            await loadCEList();
            updateUI();
            
        } catch (error) {
            console.error('[MAIN] CE更新エラー:', error);
            showNotification('CEの更新に失敗しました', 'error');
        }
    };

    window.toggleCEAvailability = async function(ceId) {
        const ce = ceList.find(c => c.id === ceId);
        if (!ce) return;

        try {
            if (!database) {
                showNotification('データベース接続エラー', 'error');
                return;
            }

            await database.ref(`ceList/${ceId}`).update({
                available: !ce.available,
                lastModified: new Date().toISOString()
            });

            const status = !ce.available ? '稼働中' : '休暇中';
            showNotification(`${ce.name}を${status}に設定しました`, 'success');
            await loadCEList();
            updateUI();
            
        } catch (error) {
            console.error('[MAIN] CE状態更新エラー:', error);
            showNotification('CE状態の更新に失敗しました', 'error');
        }
    };

    window.exportToCSV = function() {
        if (!currentSchedules.length) {
            showNotification('エクスポートするデータがありません', 'error');
            return;
        }

        const headers = ['日付', 'タイトル', '説明', '場所', '開始時間', '終了時間', '担当CE', 'ステータス'];
        const csvContent = [
            headers.join(','),
            ...currentSchedules.map(schedule => [
                schedule.date || '',
                `"${(schedule.title || '').replace(/"/g, '""')}"`,
                `"${(schedule.description || '').replace(/"/g, '""')}"`,
                `"${(schedule.location || '').replace(/"/g, '""')}"`,
                schedule.startTime || '',
                schedule.endTime || '',
                `"${(schedule.assignedCEs || []).join(', ')}"`,
                schedule.completed ? '完了' : '未完了'
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `schedule_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        showNotification('CSVファイルをエクスポートしました', 'success');
    };

    window.printSchedule = function() {
        const printWindow = window.open('', '_blank');
        const printContent = generatePrintContent();
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    };

    window.showSettingsModal = function() {
        showNotification('設定機能は開発中です', 'info');
    };

    window.logout = function() {
        if (confirm('ログアウトしますか？')) {
            stopAutoRefresh();
            if (window.dashboardAuth) {
                window.dashboardAuth.logout();
            } else {
                window.location.href = 'login.html';
            }
        }
    };

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
        if (!text) return '';
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

    function showNotification(message, type = 'info') {
        console.log(`[MAIN] 通知 (${type}): ${message}`);
        
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

    function generatePrintContent() {
        const today = new Date().toLocaleDateString('ja-JP');
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>CEスケジュール - ${today}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
                .schedule-item { 
                    border: 1px solid #ddd; 
                    margin: 10px 0; 
                    padding: 15px; 
                    page-break-inside: avoid; 
                }
                .schedule-header { font-weight: bold; font-size: 16px; margin-bottom: 10px; }
                .schedule-details { margin: 5px 0; }
                .completed { background-color: #f8f9fa; opacity: 0.7; }
            </style>
        </head>
        <body>
            <h1>CEスケジュール管理システム - ${today}</h1>
            ${currentSchedules.map(schedule => `
                <div class="schedule-item ${schedule.completed ? 'completed' : ''}">
                    <div class="schedule-header">${escapeHtml(schedule.title || '')}</div>
                    <div class="schedule-details">日付: ${escapeHtml(schedule.date || '')}</div>
                    <div class="schedule-details">時間: ${escapeHtml(schedule.startTime || '')} - ${escapeHtml(schedule.endTime || '')}</div>
                    <div class="schedule-details">場所: ${escapeHtml(schedule.location || '')}</div>
                    <div class="schedule-details">説明: ${escapeHtml(schedule.description || '')}</div>
                    <div class="schedule-details">担当CE: ${(schedule.assignedCEs || []).map(ce => escapeHtml(ce)).join(', ')}</div>
                    <div class="schedule-details">ステータス: ${schedule.completed ? '完了' : '未完了'}</div>
                </div>
            `).join('')}
        </body>
        </html>
        `;
    }

    // ページ離脱時のクリーンアップ
    window.addEventListener('beforeunload', () => {
        stopAutoRefresh();
    });

    // ページ読み込み完了時の初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDashboard);
    } else {
        initializeDashboard();
    }
    
    console.log('[MAIN] dashboard-main.js 読み込み完了');

})();
