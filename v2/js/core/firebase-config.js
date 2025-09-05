/*
🔒 Firebase設定 - V2専用（完全修正版）
*/
// 重複定義防止
if (typeof window.firebaseConfigV2 !== 'undefined') {
    console.warn('⚠️ Firebase設定は既に読み込み済みです');
} else {
    // Firebase設定
    window.firebaseConfigV2 = {
        const firebaseConfig = {
  apiKey: "AIzaSyCRUvvs0OSz_9L9bXtqteVFIIze1OaZObE",
  authDomain: "ce-scheduling-system-v2.firebaseapp.com",
  databaseURL: "https://ce-scheduling-system-v2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ce-scheduling-system-v2",
  storageBucket: "ce-scheduling-system-v2.firebasestorage.app",
  messagingSenderId: "288279598010",
  appId: "1:288279598010:web:d545ee1d4d854513084383",
  measurementId: "G-LSEEMJE2R0"
};

    // V2用データルート
    window.DATA_ROOT = 'ceScheduleV2';

    // Firebase サービス変数（重複除去）
    window.database = null;
    window.auth = null;
    window.isFirebaseReady = false;

    // Firebase初期化関数（完全修正版）
    function initializeFirebaseV2() {
        // 重複初期化防止
        if (window.firebaseV2Initialized) {
            console.log('ℹ️ Firebase V2 既に初期化済み');
            return;
        }
        
        try {
            console.log('🔄 Firebase V2 初期化開始');
            
            // Step 1: SDK確認
            if (typeof firebase === 'undefined') {
                console.log('⏳ Firebase SDK読み込み待機中...');
                setTimeout(initializeFirebaseV2, 500);
                return;
            }

            // Step 2: App初期化（重要：重複除去）
            let app;
            if (firebase.apps.length === 0) {
                app = firebase.initializeApp(window.firebaseConfigV2);
                console.log('✅ Firebase App初期化完了');
            } else {
                app = firebase.app();
                console.log('ℹ️ Firebase App既に存在');
            }
            
            // Step 3: サービス取得（一回のみ）
            window.auth = firebase.auth();
            window.database = firebase.database();
            window.firebaseV2Initialized = true;
            
            console.log('✅ Firebase サービス取得完了');
            
            // Step 4: 接続監視
            window.database.ref('.info/connected').on('value', function(snapshot) {
                const isConnected = snapshot.val();
                window.isFirebaseReady = isConnected;
                updateConnectionStatus(isConnected ? 'connected' : 'disconnected');
                console.log(isConnected ? '✅ Firebase接続成功' : '❌ Firebase接続失敗');
            });
            
            // Step 5: 認証状態管理（ルール対応）
            window.auth.onAuthStateChanged(function(user) {
                if (!user) {
                    // 匿名認証でデータベースアクセス権取得
                    window.auth.signInAnonymously().then(() => {
                        console.log('✅ 匿名認証成功 - データベースアクセス可能');
                    }).catch(function(error) {
                        console.warn('⚠️ 匿名認証失敗:', error.message);
                        updateConnectionStatus('error');
                    });
                } else {
                    console.log('🔐 Firebase認証状態:', user.isAnonymous ? '匿名ユーザー' : user.email);
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
            
            // ステータス色変更
            statusElement.className = statusElement.className.replace(/bg-\w+-\d+/, '') + 
                (status === 'connected' ? ' bg-green-100' : 
                 status === 'error' ? ' bg-red-100' : ' bg-yellow-100');
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

    console.log('🔒 Firebase設定ファイル読み込み完了（修正版）');
}
