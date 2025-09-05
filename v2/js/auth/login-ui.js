/*
==========================================
🖥️ ログインUI制御
認証画面のユーザーインターフェース制御
==========================================
*/

class LoginUI {
    constructor() {
        this.setupEventListeners();
        console.log('🖥️ ログインUI初期化完了');
    }

    setupEventListeners() {
        // ログアウトボタン
        const logoutButtons = document.querySelectorAll('#logoutButton, #logoutButtonMain');
        logoutButtons.forEach(button => {
            if (button && !button.dataset.listenerAdded) {
                button.addEventListener('click', () => {
                    if (window.authSystem) {
                        window.authSystem.handleLogout();
                    }
                });
                button.dataset.listenerAdded = 'true';
            }
        });

        // Enterキーでログイン
        const passwordInput = document.getElementById('securityInput');
        const nameInput = document.getElementById('nameInput');
        
        if (passwordInput && !passwordInput.dataset.listenerAdded) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    window.authSystem?.handleLogin();
                }
            });
            passwordInput.dataset.listenerAdded = 'true';
        }

        if (nameInput && !nameInput.dataset.listenerAdded) {
            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    window.authSystem?.handleLogin();
                }
            });
            nameInput.dataset.listenerAdded = 'true';
        }

        console.log('✅ ログインUIイベントリスナー設定完了');
    }

    // 自動ログアウト設定
    setupAutoLogout() {
        let inactivityTimer;
        const INACTIVITY_TIME = 8 * 60 * 60 * 1000; // 8時間

        function resetInactivityTimer() {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                if (window.authSystem?.currentUser) {
                    window.authSystem.handleLogout();
                    window.authSystem.showMessage('長時間無操作のため自動ログアウトしました', 'info');
                }
            }, INACTIVITY_TIME);
        }

        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
            document.addEventListener(event, resetInactivityTimer, true);
        });

        resetInactivityTimer();
    }
}

// ページ読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', () => {
    const loginUI = new LoginUI();
    loginUI.setupAutoLogout();
    
    // ログイン状態復元
    if (window.authSystem) {
        window.authSystem.restoreLoginState();
    }
});
console.log('🖥️ ログインUI スクリプト読み込み完了');
