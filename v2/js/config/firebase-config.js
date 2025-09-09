/**
 * Firebase設定 - V2統合版（Promise化対応・お客様設定ベース）
 */

// 重複初期化防止（お客様の既存ロジックを維持）
if (typeof window.firebaseV2Initialized === 'undefined') {
    
    // Firebase設定（お客様の設定をそのまま使用）
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

    // データルート（お客様の設定を維持）
    window.DATA_ROOT = 'ceScheduleV2';

    // グローバル変数（お客様の既存設定を維持）
    window.auth = null;
    window.database = null;
    window.isFirebaseReady = false;

    // 【追加】Promise化機能
    let initResolve, initReject;
    window.firebaseInitPromise = new Promise((resolve, reject) => {
        initResolve = resolve;
        initReject = reject;
    });
    
    // 【追加】依存関係待機ヘルパー関数
    window.waitForFirebase = () => window.firebaseInitPromise;

    /**
     * Firebase初期化（お客様の既存ロジック＋Promise対応）
     */
    function initializeFirebaseV2() {
        if (window.firebaseV2Initialized) {
            console.log('ℹ️ Firebase既に初期化済み');
            return;
        }
        
        try {
            console.log('🔄 Firebase初期化開始');
            
            // SDK確認（お客様の既存ロジック）
            if (typeof firebase === 'undefined') {
                console.log('⏳ Firebase SDK待機中...');
                setTimeout(initializeFirebaseV2, 500);
                return;
            }

            // App初期化（お客様の既存ロジック）
            if (firebase.apps.length === 0) {
                firebase.initializeApp(window.firebaseConfig);
                console.log('✅ Firebase App初期化完了');
            }
            
            // サービス取得（お客様の既存ロジック）
            window.auth = firebase.auth();
            window.database = firebase.database();
            window.firebaseV2Initialized = true;
            
            // 接続監視（お客様の既存ロジック）
            window.database.ref('.info/connected').on('value', function(snapshot) {
                window.isFirebaseReady = snapshot.val();
                console.log(snapshot.val() ? '✅ Firebase接続成功' : '❌ Firebase接続失敗');
            });
            
            // 匿名認証（お客様の既存ロジック）
            window.auth.onAuthStateChanged(function(user) {
                if (!user) {
                    window.auth.signInAnonymously()
                        .then(() => console.log('✅ 匿名認証成功'))
                        .catch(error => console.warn('⚠️ 匿名認証失敗:', error.message));
                }
            });

            // 【追加】Promise解決
            console.log('🔒 Firebase設定読み込み完了（Promise対応版）');
            initResolve();
            
        } catch (error) {
            console.error('❌ Firebase初期化エラー:', error);
            initReject(error); // 【追加】Promise拒否
        }
    }

    // 初期化実行（お客様の既存ロジック）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initializeFirebaseV2, 100);
        });
    } else {
        setTimeout(initializeFirebaseV2, 100);
    }

    console.log('🔒 Firebase設定読み込み完了（修正版）');
}
