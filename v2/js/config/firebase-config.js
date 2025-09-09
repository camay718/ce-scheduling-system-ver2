/**
 * Firebase設定 - V2統合版（タイミング改善・Promise化対応）
 */

// 重複初期化防止
if (typeof window.firebaseV2Initialized === 'undefined') {
    
    // Firebase設定（お客様の既存設定を維持）
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

    // Promise化機能
    let initResolve, initReject;
    window.firebaseInitPromise = new Promise((resolve, reject) => {
        initResolve = resolve;
        initReject = reject;
    });
    
    window.waitForFirebase = () => window.firebaseInitPromise;

    /**
     * Firebase初期化（即座実行版）
     */
    function initializeFirebaseV2() {
        if (window.firebaseV2Initialized) {
            console.log('ℹ️ Firebase既に初期化済み');
            return;
        }
        
        try {
            console.log('🔄 Firebase初期化開始');
            
            if (typeof firebase === 'undefined') {
                console.log('⏳ Firebase SDK待機中...');
                setTimeout(initializeFirebaseV2, 200);
                return;
            }

            if (firebase.apps.length === 0) {
                firebase.initializeApp(window.firebaseConfig);
                console.log('✅ Firebase App初期化完了');
            }
            
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

            console.log('🔒 Firebase設定読み込み完了（Promise対応版）');
            initResolve();
            
        } catch (error) {
            console.error('❌ Firebase初期化エラー:', error);
            initReject(error);
        }
    }

    // 即座に初期化実行（DOMContentLoadedを待たない）
    initializeFirebaseV2();

    console.log('🔒 Firebase設定読み込み完了（修正版）');
}
