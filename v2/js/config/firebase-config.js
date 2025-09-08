/**
 * Firebase設定 - V2統合版（エラー修正版）
 */

// 重複初期化防止
if (typeof window.firebaseV2Initialized === 'undefined') {
    
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
     * Firebase初期化（エラー修正版）
     */
    function initializeFirebaseV2() {
        if (window.firebaseV2Initialized) {
            console.log('ℹ️ Firebase既に初期化済み');
            return;
        }
        
        try {
            console.log('🔄 Firebase初期化開始');
            
            // SDK確認
            if (typeof firebase === 'undefined') {
                console.log('⏳ Firebase SDK待機中...');
                setTimeout(initializeFirebaseV2, 500);
                return;
            }

            // App初期化
            if (firebase.apps.length === 0) {
                firebase.initializeApp(window.firebaseConfig);
                console.log('✅ Firebase App初期化完了');
            }
            
            // サービス取得
            window.auth = firebase.auth();
            window.database = firebase.database();
            window.firebaseV2Initialized = true;
            
            // 接続監視
            window.database.ref('.info/connected').on('value', function(snapshot) {
                window.isFirebaseReady = snapshot.val();
                console.log(snapshot.val() ? '✅ Firebase接続成功' : '❌ Firebase接続失敗');
            });
            
            // 匿名認証
            window.auth.onAuthStateChanged(function(user) {
                if (!user) {
                    window.auth.signInAnonymously()
                        .then(() => console.log('✅ 匿名認証成功'))
                        .catch(error => console.warn('⚠️ 匿名認証失敗:', error.message));
                }
            });
            
        } catch (error) {
            console.error('❌ Firebase初期化エラー:', error);
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

    console.log('🔒 Firebase設定読み込み完了（修正版）');
}
