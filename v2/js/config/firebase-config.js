/**
 * Firebase設定 - V2統合版
 * 重複初期化防止、接続監視、匿名認証を統合管理
 */

// Firebase設定
window.firebaseConfig = {
    apiKey: "AIzaSyCRUvvs0OSz_9L9bXtqteVFIIze1OaZObE",
    authDomain: "ce-scheduling-system-v2.firebaseapp.com",
    databaseURL: "https://ce-scheduling-system-v2-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ce-scheduling-system-v2",
    storageBucket: "ce-scheduling-system-v2.firebasestorage.app",
    messagingSenderId: "288279598010",
    appId: "1:288279598010:web:d545ee1d4d854513084383",
    measurementId: "G-LSEEMJE2R0"
};

// データルート
window.DATA_ROOT = 'ceScheduleV2';

// グローバル変数
window.auth = null;
window.database = null;
window.isFirebaseReady = false;

/**
 * Firebase初期化（重複防止版）
 */
function initializeFirebaseV2() {
    // 重複初期化チェック
    if (window.firebaseV2Initialized) {
        console.log('ℹ️ Firebase V2 既に初期化済み');
        return;
    }
    
    try {
        console.log('🔄 Firebase V2 初期化開始');
        
        // SDK確認
        if (typeof firebase === 'undefined') {
            console.log('⏳ Firebase SDK読み込み待機中...');
            setTimeout(initializeFirebaseV2, 500);
            return;
        }

        // App初期化
        let app;
        if (firebase.apps.length === 0) {
            app = firebase.initializeApp(window.firebaseConfig);
            console.log('✅ Firebase App初期化完了');
        } else {
            app = firebase.app();
            console.log('ℹ️ Firebase App既存利用');
        }
        
        // サービス取得
        window.auth = firebase.auth();
        window.database = firebase.database();
        window.firebaseV2Initialized = true;
        
        // 接続監視
        window.database.ref('.info/connected').on('value', function(snapshot) {
            const isConnected = snapshot.val();
            window.isFirebaseReady = isConnected;
            updateConnectionStatus(isConnected ? 'connected' : 'disconnected');
            console.log(isConnected ? '✅ Firebase接続成功' : '❌ Firebase接続失敗');
        });
        
        // 匿名認証
        window.auth.onAuthStateChanged(function(user) {
            if (!user) {
                window.auth.signInAnonymously()
                    .then(() => console.log('✅ 匿名認証成功'))
                    .catch(error => {
                        console.warn('⚠️ 匿名認証失敗:', error.message);
                        updateConnectionStatus('error');
                    });
            } else {
                console.log('🔐 認証状態:', user.isAnonymous ? '匿名ユーザー' : user.email);
            }
        });
        
    } catch (error) {
        console.error('❌ Firebase初期化エラー:', error);
        updateConnectionStatus('error');
    }
}

/**
 * 接続状態表示更新
 */
function updateConnectionStatus(status) {
    // ダッシュボード用
    const dashboardStatus = document.getElementById('firebaseStatus');
    if (dashboardStatus) {
        const statusText = {
            connected: '✅ Firebase接続中',
            disconnected: '❌ Firebase未接続', 
            error: '⚠️ Firebase接続エラー'
        };
        dashboardStatus.textContent = statusText[status] || '❓ 状態不明';
        dashboardStatus.className = dashboardStatus.className.replace(/bg-\w+-\d+/, '') + 
            (status === 'connected' ? ' bg-green-100' : 
             status === 'error' ? ' bg-red-100' : ' bg-yellow-100');
    }
    
    // ログイン画面用
    const loginStatus = document.getElementById('syncStatus');
    if (loginStatus) {
        const message = {
            connected: 'Firebase接続済み',
            disconnected: 'Firebase未接続',
            error: '接続エラー'
        }[status];
        loginStatus.className = `sync-indicator ${status}`;
        loginStatus.innerHTML = `<div class="sync-dot ${status === 'connected' ? 'pulse' : ''}"></div>${message}`;
    }
}

// 初期化実行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeFirebaseV2, 100);
    });
} else {
    setTimeout(initializeFirebaseV2, 100);
}

console.log('🔒 Firebase設定ファイル読み込み完了（統合版）');
