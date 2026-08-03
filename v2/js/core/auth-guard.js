/**
 * 認証ガード - 全ページ共通認証システム
 * セッションタイムアウト対応版
 */
(function(){
    if (window.AuthGuard) return;

    const TIMEOUT_MINUTES = 30; // ← 後で変更するならここだけ変える
    const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;
    const DASHBOARD_AUTH_KEY = 'dashboardAuth';
    const LAST_ACTIVITY_KEY = 'lastActivityAt';
    const ACTIVITY_EVENTS = ['click', 'keydown', 'mousedown', 'touchstart', 'scroll'];

    let inactivityTimer = null;
    let listenersBound = false;

    function readDashboardAuth() {
        try {
            return JSON.parse(localStorage.getItem(DASHBOARD_AUTH_KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function removeAuthStorage() {
        sessionStorage.removeItem('targetUID');
        sessionStorage.removeItem('currentUsername');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem(LAST_ACTIVITY_KEY);
        localStorage.removeItem(DASHBOARD_AUTH_KEY);
    }

    function isExpired(timestamp) {
        const ts = Number(timestamp || 0);
        if (!ts) return true;
        return (Date.now() - ts) > TIMEOUT_MS;
    }

    function startInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            window.AuthGuard.forceLogout('一定時間操作がなかったため、自動的にログアウトしました。再度ログインしてください。');
        }, TIMEOUT_MS);
    }

    function touchSession(uid, username, role) {
        const currentUid = uid || sessionStorage.getItem('targetUID');
        const currentUsername = username || sessionStorage.getItem('currentUsername');
        const currentRole = role || sessionStorage.getItem('userRole') || 'viewer';
        const now = Date.now();

        if (currentUid && currentUsername) {
            sessionStorage.setItem('targetUID', currentUid);
            sessionStorage.setItem('currentUsername', currentUsername);
            sessionStorage.setItem('userRole', currentRole);
            sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));

            const currentDashboard = readDashboardAuth();
            localStorage.setItem(DASHBOARD_AUTH_KEY, JSON.stringify({
                ...currentDashboard,
                uid: currentUid,
                username: currentUsername,
                role: currentRole,
                timestamp: now
            }));
        }
    }

    function bindActivityListeners() {
        if (listenersBound) return;

        const onActivity = () => {
            if (!sessionStorage.getItem('targetUID') || !sessionStorage.getItem('currentUsername')) return;
            touchSession();
            startInactivityTimer();
        };

        ACTIVITY_EVENTS.forEach(eventName => {
            window.addEventListener(eventName, onActivity, { passive: true });
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;

            if (window.AuthGuard.isSessionExpired()) {
                window.AuthGuard.forceLogout('一定時間操作がなかったため、自動的にログアウトしました。再度ログインしてください。');
                return;
            }

            onActivity();
        });

        listenersBound = true;
    }

    window.AuthGuard = {
        sessionTimeoutMinutes: TIMEOUT_MINUTES,

        isSessionExpired() {
            const sessionUid = sessionStorage.getItem('targetUID');
            const sessionUsername = sessionStorage.getItem('currentUsername');
            const sessionLastActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY);

            if (sessionUid && sessionUsername) {
                return isExpired(sessionLastActivity);
            }

            const dashboardAuth = readDashboardAuth();
            if (dashboardAuth.uid && dashboardAuth.username) {
                return isExpired(dashboardAuth.timestamp);
            }

            return true;
        },

        touch(uid, username, role) {
            touchSession(uid, username, role);
            startInactivityTimer();
        },

        clearSession() {
            clearTimeout(inactivityTimer);
            removeAuthStorage();
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

                if (this.isSessionExpired()) {
                    this.clearSession();
                    if (requireAuth || isAnalyticsPage) {
                        alert('セッションの有効期限が切れました。再度ログインしてください。');
                        location.href = '../index.html';
                        return false;
                    }
                }

                const params = new URLSearchParams(location.search);
                const dashboardAuth = readDashboardAuth();
                const canUseDashboardAuth =
                    dashboardAuth.uid &&
                    dashboardAuth.username &&
                    !isExpired(dashboardAuth.timestamp);

                const uid = params.get('uid') ||
                    sessionStorage.getItem('targetUID') ||
                    (canUseDashboardAuth ? dashboardAuth.uid : '');

                const username = params.get('username') ||
                    sessionStorage.getItem('currentUsername') ||
                    (canUseDashboardAuth ? dashboardAuth.username : '');

                const role = params.get('role') ||
                    sessionStorage.getItem('userRole') ||
                    (canUseDashboardAuth ? dashboardAuth.role : 'viewer');

                if (uid && username) {
                    this.touch(uid, username, role);
                    console.log('✅ 認証情報復元完了:', { uid: uid.substring(0, 8) + '...', username, role });
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
