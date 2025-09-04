/*
🔒 Firebase設定 - V2専用（重複定義防止版）
*/

// 重複定義防止
if (typeof window.firebaseConfigV2 !== 'undefined') {
    console.warn('⚠️ Firebase設定は既に読み込み済みです');
} else {
    // あなたの実際のFirebase設定値に置き換えてください
    window.firebaseConfigV2 = {
        apiKey: "AIzaSyD-9gMA2Q_xopDS_FTbvOlMANy5MHP830g",
  authDomain: "ce-scheduling-system-v2.firebaseapp.com",
  databaseURL: "https://ce-scheduling-system-v2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ce-scheduling-system-v2",
  storageBucket: "ce-scheduling-system-v2.appspot.com",
  messagingSenderId: "288279598010",
  appId: "1:288279598010:web:d545ee1d4d854513084383",
  measurementId: "G-LSEEMJE2R0"
    };
    // V2用データルート
    window.DATA_ROOT = 'ceScheduleV2';

    // Firebase サービス変数
    window.database = null;
    window.auth = null;
    window.isFirebaseReady = false;

    // Firebase初期化関数
    function initializeFirebaseV2() {
        try {
            console.log('🔄 Firebase V2 初期化開始');
            
            // Firebase SDK確認
            if (typeof firebase === 'undefined') {
                console.error('❌ Firebase SDK未読み込み');
                setTimeout(initializeFirebaseV2, 1000);
                return;
            }

            // Firebase初期化
            if (!firebase.apps || firebase.apps.length === 0) {
                firebase.initializeApp(window.firebaseConfigV2);
                console.log('✅ Firebase アプリ初期化完了');
            }
            
            // サービス取得
            window.auth = firebase.auth();
            window.database = firebase.database();
            
            // 接続状態監視
            window.database.ref('.info/connected').on('value', function(snapshot) {
                if (snapshot.val() === true) {
                    console.log('✅ Firebase接続成功');
                    window.isFirebaseReady = true;
                    updateConnectionStatus('connected');
                } else {
                    console.log('❌ Firebase接続失敗');
                    window.isFirebaseReady = false;
                    updateConnectionStatus('disconnected');
                }
            });
            
        } catch (error) {
            console.error('❌ Firebase初期化エラー:', error);
            updateConnectionStatus('error');
        }
    }

    // 接続状態表示更新
    function updateConnectionStatus(status) {
        const statusElement = document.getElementById('firebaseStatus');
        if (statusElement) {
            const statusText = {
                connected: '✅ Firebase接続中',
                disconnected: '❌ Firebase未接続',
                error: '⚠️ Firebase接続エラー'
            };
            statusElement.textContent = statusText[status] || '❓ 状態不明';
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

    console.log('🔒 Firebase設定ファイル読み込み完了');
}
// 既存のサービス取得後に以下を追加
window.auth = firebase.auth();
window.database = firebase.database();

// 匿名認証の自動実行（開発用）
window.auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('✅ 認証状態:', user.isAnonymous ? '匿名ユーザー' : user.email);
    } else {
        console.log('🔄 匿名認証を実行中...');
        window.auth.signInAnonymously().catch((error) => {
            console.error('❌ 匿名認証失敗:', error);
        });
    }
});
