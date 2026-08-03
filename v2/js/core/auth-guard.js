/**
 * 認証ガード - 全ページ共通認証システム
 * セッションタイムアウト対応版（ログイン直後の誤判定修正版）
 */
(function(){
    if (window.AuthGuard) return;

    const TIMEOUT_MINUTES = 30; // ← 必要ならここだけ変更
    const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;
    const DASHBOARD_AUTH_KEY = 'dashboardAuth';
    const LAST_ACTIVITY_KEY = 'lastActivityAt';
    const ACTIVITY_EVENTS = ['click', 'keydown', 'mousedown', 'touchstart'];

    let inactivityTimer = null;
    let listenersBound = false;

    function readDashboardAuth() {
        try {
            return JSON.parse(localStorage.getItem(DASHBOARD_AUTH_KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function clearAuthStorage() {
        sessionStorage.removeItem('targetUID');
        sessionStorage.removeItem('currentUsername');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('needsSetup');
        sessionStorage.removeItem(LAST_ACTIVITY_KEY);
        localStorage.removeItem(DASHBOARD_AUTH_KEY);
    }

    function isExpired(timestamp) {
        const ts = Number(timestamp || 0);
        if (!ts) return false;
        return (Date.now() - ts) > TIMEOUT_MS;
    }

    function getSessionCandidate() {
        const params = new URLSearchParams(location.search);

        const urlUid = params.get('uid');
        const urlUsername = params.get('username');
        const urlRole = params.get('role');

        const sessionUid = sessionStorage.getItem('targetUID');
        const sessionUsername = sessionStorage.getItem('currentUsername');
        const sessionRole = sessionStorage.getItem('userRole');

        const dashboardAuth = readDashboardAuth();

        let uid = '';
        let username = '';
        let role = 'viewer';
        let source = 'none';

        if (urlUid && urlUsername) {
            uid = urlUid;
            username = urlUsername;
            role = urlRole || 'viewer';
            source = 'url';
        } else if (sessionUid && sessionUsername) {
            uid = sessionUid;
            username = sessionUsername;
            role = sessionRole || 'viewer';
            source = 'session';
        } else if (dashboardAuth.uid && dashboardAuth.username) {
            uid = dashboardAuth.uid;
            username = dashboardAuth.username;
            role = dashboardAuth.role || 'viewer';
            source = 'dashboard';
        }

        const sessionTimestamp = sessionStorage.getItem(LAST_ACTIVITY_KEY);
        const dashboardTimestamp = dashboardAuth.timestamp;

        const timestamp =
            source === 'session' ? Number(sessionTimestamp || 0) :
            source === 'dashboard' ? Number(dashboardTimestamp || 0) :
            0;

        return {
            uid,
            username,
            role,
            source,
            timestamp,
            hasSession: !!(uid && username)
        };
    }

    function touchSession(uid, username, role) {
        const currentUid = uid || sessionStorage.getItem('targetUID');
        const currentUsername = username || sessionStorage.getItem('currentUsername');
        const currentRole = role || sessionStorage.getItem('userRole') || 'viewer';

        if (!currentUid || !currentUsername) return;

        const now = Date.now();

        sessionStorage.setItem('targetUID', currentUid);
        sessionStorage.setItem('currentUsername', currentUsername);
        sessionStorage.setItem('userRole', currentRole);
        sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));

        const prev = readDashboardAuth();
        localStorage.setItem(DASHBOARD_AUTH_KEY, JSON.stringify({
            ...prev,
            uid: currentUid,
            username: currentUsername,
            role: currentRole,
            timestamp: now
        }));
    }

    function startInactivityTimer() {
        clearTimeout(inactivityTimer);

        if (!sessionStorage.getItem('targetUID') || !sessionStorage.getItem('currentUsername')) {
            return;
        }

        inactivityTimer = setTimeout(() => {
            window.AuthGuard.forceLogout('一定時間操作がなかったため、自動的にログアウトしました。再度ログインしてください。');
        }, TIMEOUT_MS);
    }

    function bindActivityListeners() {
        if (listenersBound) return;

        const onActivity = () => {
            const uid = sessionStorage.getItem('targetUID');
            const username = sessionStorage.getItem('currentUsername');
            const role = sessionStorage.getItem('userRole') || 'viewer';

            if (!uid || !username) return;

            touchSession(uid, username, role);
            startInactivityTimer();
        };

        ACTIVITY_EVENTS.forEach(eventName => {
            window.addEventListener(eventName, onActivity, { passive: true });
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;

            const sessionUid = sessionStorage.getItem('targetUID');
            const sessionUsername = sessionStorage.getItem('currentUsername');
            const lastActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY);

            if (sessionUid && sessionUsername && isExpired(lastActivity)) {
                window.AuthGuard.forceLogout('一定時間操作がなかったため、自動的にログアウトしました。再度ログインしてください。');
                return;
            }

            onActivity();
        });

        listenersBound = true;
    }

    window.AuthGuard = {
        sessionTimeoutMinutes: TIMEOUT_MINUTES,

        touch(uid, username, role) {
            touchSession(uid, username, role);
            startInactivityTimer();
        },

        clearSession() {
            clearTimeout(inactivityTimer);
            clearAuthStorage();
        },

        async forceLogout(message = '一定時間操作がなかったため、自動的にログアウトしました。再度ログインしてください。') {
            try {
                if (window.auth?.currentUser) {
                    await window.auth.signOut();
                }
            } catch (e) {
                console.warn('サインアウト時エラー:', e);
            } finally {
                this.clearSession();
                alert(message);
                location.href = '../index.html';
            }
        },

        async init({ requireAuth = true } = {}) {
            try {
                await window.waitForFirebase?.();

                const analyticsPages = [
                    '/pages/analytics.html',
                    '/analytics/assignment-summary.html',
                    '/analytics/department-timeline.html',
                    '/analytics/personal-timeline.html'
                ];

                const isAnalyticsPage = analyticsPages.some(path =>
                    location.pathname.endsWith(path) || location.pathname.includes(path)
                );

                const candidate = getSessionCandidate();

                // 期限切れ判定は「セッションがある場合だけ」
                if (candidate.hasSession) {
                    if (candidate.source === 'session' && isExpired(candidate.timestamp)) {
                        this.clearSession();
                        alert('セッションの有効期限が切れました。再度ログインしてください。');
                        location.href = '../index.html';
                        return false;
                    }

                    if (candidate.source === 'dashboard' && isExpired(candidate.timestamp)) {
                        this.clearSession();
                    } else {
                        this.touch(candidate.uid, candidate.username, candidate.role);
                        console.log('✅ 認証情報復元完了:', {
                            uid: candidate.uid.substring(0, 8) + '...',
                            username: candidate.username,
                            role: candidate.role
                        });
                    }
                }

                if (isAnalyticsPage) {
                    if (!sessionStorage.getItem('targetUID') || !sessionStorage.getItem('currentUsername')) {
                        console.warn('認証が必要です。ログインに戻ります。');
                        location.href = '../index.html';
                        return false;
                    }
                } else if (requireAuth && (!sessionStorage.getItem('targetUID') || !sessionStorage.getItem('currentUsername'))) {
                    console.warn('認証が必要です。ログインに戻ります。');
                    location.href = '../index.html';
                    return false;
                }

                bindActivityListeners();
                startInactivityTimer();

                if (!window.auth?.currentUser) {
                    try {
                        await window.auth.signInAnonymously();
                        console.log('✅ 匿名認証完了');
                    } catch (e) {
                        console.warn('匿名認証失敗', e);
                    }
                }

                return true;
            } catch (error) {
                console.error('AuthGuard初期化エラー:', error);
                if (requireAuth) {
                    location.href = '../index.html';
                }
                return false;
            }
        },

        getSession() {
            return {
                uid: sessionStorage.getItem('targetUID'),
                username: sessionStorage.getItem('currentUsername'),
                role: sessionStorage.getItem('userRole') || 'viewer'
            };
        },

        async getUserData() {
            const { uid } = this.getSession();
            if (!uid) return null;

            try {
                const snapshot = await window.database.ref(`${window.DATA_ROOT}/users/${uid}`).once('value');
                return snapshot.val();
            } catch (error) {
                console.error('ユーザーデータ取得エラー:', error);
                return null;
            }
        }
    };
})();
