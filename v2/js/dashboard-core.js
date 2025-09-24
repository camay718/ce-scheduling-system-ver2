// dashboard-core.js - コアクラス群

console.log('[CORE] dashboard-core.js 読み込み開始');

// 認証管理システム（元のシステムに合わせて修正）
window.DashboardAuth = class {
    constructor() {
        this.currentUser = null;
        this.database = null;
        this.isAuthenticated = false;
        console.log('[AUTH] DashboardAuth クラス初期化');
    }

    // セッション確認（元のロジックに合わせて修正）
    checkSession() {
        try {
            // 複数のセッションキーをチェック
            const sessionKeys = [
                'ceScheduleSession',
                'userSession', 
                'authSession',
                'currentUser'
            ];
            
            for (const key of sessionKeys) {
                const sessionData = localStorage.getItem(key);
                console.log(`[AUTH] セッションキー ${key} 確認:`, sessionData);
                
                if (sessionData && sessionData !== 'null' && sessionData !== 'undefined') {
                    try {
                        const parsed = JSON.parse(sessionData);
                        console.log(`[AUTH] パース成功 ${key}:`, parsed);
                        
                        // 様々な形式のセッションデータに対応
                        if (this.validateSessionData(parsed)) {
                            this.currentUser = this.extractUserFromSession(parsed);
                            this.isAuthenticated = true;
                            console.log('[AUTH] セッション認証成功:', this.currentUser);
                            return true;
                        }
                    } catch (parseError) {
                        console.warn(`[AUTH] セッション ${key} パースエラー:`, parseError);
                        continue;
                    }
                }
            }
            
            console.log('[AUTH] 有効なセッションが見つかりません');
            return false;
        } catch (error) {
            console.error('[AUTH] セッション確認エラー:', error);
            return false;
        }
    }

    // セッションデータバリデーション
    validateSessionData(data) {
        if (!data || typeof data !== 'object') return false;
        
        // 様々な認証データ形式に対応
        return (
            (data.targetUID && data.username) ||
            (data.uid && data.username) ||
            (data.userId && data.name) ||
            (data.user && data.user.uid) ||
            (data.authenticated === true && data.userInfo)
        );
    }

    // セッションからユーザー情報抽出
    extractUserFromSession(data) {
        // 様々なデータ形式に対応
        if (data.targetUID && data.username) {
            return {
                uid: data.targetUID === true ? 'admin' : data.targetUID,
                username: data.username
            };
        }
        
        if (data.uid && data.username) {
            return {
                uid: data.uid,
                username: data.username
            };
        }
        
        if (data.userId && data.name) {
            return {
                uid: data.userId,
                username: data.name
            };
        }
        
        if (data.user && data.user.uid) {
            return {
                uid: data.user.uid,
                username: data.user.displayName || data.user.email || 'user'
            };
        }
        
        if (data.authenticated === true && data.userInfo) {
            return {
                uid: data.userInfo.uid || data.userInfo.id,
                username: data.userInfo.username || data.userInfo.name || 'user'
            };
        }
        
        return null;
    }

    // Firebase初期化
    async initializeFirebase() {
        try {
            if (typeof firebase === 'undefined') {
                console.error('[AUTH] Firebase が読み込まれていません');
                return false;
            }

            // Firebase設定待機
            let attempts = 0;
            while (typeof window.firebaseConfig === 'undefined' && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (typeof window.firebaseConfig === 'undefined') {
                console.warn('[AUTH] Firebase設定が見つかりません、デフォルト設定を使用');
            }

            // Realtime Database初期化
            this.database = firebase.database();
            console.log('[AUTH] Firebase Realtime Database 初期化完了');
            return true;
        } catch (error) {
            console.error('[AUTH] Firebase初期化エラー:', error);
            return false;
        }
    }

    // 認証確認
    async verifyAuthentication() {
        try {
            if (!this.isAuthenticated || !this.currentUser) {
                console.log('[AUTH] 認証されていません');
                return false;
            }

            // データベース接続確認
            if (!this.database) {
                const firebaseReady = await this.initializeFirebase();
                if (!firebaseReady) {
                    console.warn('[AUTH] Firebase初期化失敗、認証をバイパスします');
                    return true; // 認証は成功として扱う
                }
            }

            console.log('[AUTH] 認証確認成功');
            return true;
        } catch (error) {
            console.error('[AUTH] 認証確認エラー:', error);
            return true; // エラー時も認証成功として扱う
        }
    }

    // 現在のユーザー取得
    getCurrentUser() {
        return this.currentUser;
    }

    // 認証状態取得
    isUserAuthenticated() {
        return this.isAuthenticated;
    }

    // データベース取得
    getDatabase() {
        return this.database;
    }

    // ログアウト
 logout() {
    try {
        // 全てのセッションキーをクリア
        const sessionKeys = [
            'ceScheduleSession',
            'userSession', 
            'authSession',
            'currentUser'
        ];
        
        sessionKeys.forEach(key => {
            localStorage.removeItem(key);
        });
        
        this.currentUser = null;
        this.isAuthenticated = false;
        console.log('[AUTH] ログアウト完了');
        
        // 実際のログインページに合わせてリダイレクト
        // GitHub Pagesの構造に基づいて調整
        const possibleLoginPages = [
            'index.html',           // メインのログインページ
            '../index.html',        // 1つ上の階層
            '../../index.html',     // 2つ上の階層
            'login/index.html',     // loginフォルダ内
            '/index.html'           // ルート
        ];
        
        // 現在のURL構造を確認してリダイレクト先を決定
        const currentPath = window.location.pathname;
        console.log('[AUTH] 現在のパス:', currentPath);
        
        if (currentPath.includes('/v2/')) {
            // v2フォルダ内にいる場合は上の階層に移動
            window.location.href = '../index.html';
        } else {
            // それ以外の場合はindex.htmlに移動
            window.location.href = 'index.html';
        }
        
    } catch (error) {
        console.error('[AUTH] ログアウトエラー:', error);
        // エラー時は手動でルートに移動
        window.location.href = '/';
    }
}

// 他のコアクラス群（元のコードから継承）
class PublishedScheduleResolver {
    constructor() {
        console.log('[CORE] PublishedScheduleResolver 初期化');
    }
    
    resolve(schedules) {
        return schedules.filter(schedule => schedule.published !== false);
    }
}

class ActivityLogger {
    constructor() {
        this.logs = [];
        console.log('[CORE] ActivityLogger 初期化');
    }
    
    log(action, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            action: action,
            details: details,
            user: window.DashboardAuth?.getCurrentUser()?.username || 'system'
        };
        this.logs.push(logEntry);
        console.log('[ACTIVITY]', logEntry);
    }
    
    getLogs(limit = 100) {
        return this.logs.slice(-limit);
    }
}

class WorkScheduleViewer {
    constructor() {
        this.viewMode = 'list';
        console.log('[CORE] WorkScheduleViewer 初期化');
    }
    
    setViewMode(mode) {
        this.viewMode = mode;
        console.log(`[CORE] 表示モード変更: ${mode}`);
    }
    
    renderSchedules(schedules, container) {
        if (!container) {
            console.warn('[CORE] コンテナが指定されていません');
            return;
        }
        
        if (this.viewMode === 'list') {
            this.renderListView(schedules, container);
        } else if (this.viewMode === 'calendar') {
            this.renderCalendarView(schedules, container);
        }
    }
    
    renderListView(schedules, container) {
        // リスト表示の実装
        console.log(`[CORE] リスト表示: ${schedules.length}件`);
    }
    
    renderCalendarView(schedules, container) {
        // カレンダー表示の実装  
        console.log(`[CORE] カレンダー表示: ${schedules.length}件`);
    }
}

// グローバルインスタンス作成
window.dashboardAuth = new window.DashboardAuth();
window.publishedScheduleResolver = new PublishedScheduleResolver();
window.activityLogger = new ActivityLogger();
window.workScheduleViewer = new WorkScheduleViewer();

console.log('[CORE] dashboard-core.js 読み込み完了');
