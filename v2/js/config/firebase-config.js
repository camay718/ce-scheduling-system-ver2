/**
 * Firebase設定 - V2統合版（パフォーマンス最適化版）
 */
if (typeof window.firebaseV2Initialized === 'undefined') {
    console.log('🔄 Firebase設定ファイル読み込み開始');
    
    window.firebaseConfig = {
        apiKey: "AIzaSyBEe7xDIoo6OsVCT-2yXakuO_FMhYs1GNg",  // ★ 既存維持
        authDomain: "ce-scheduling-system-v2.firebaseapp.com",
        databaseURL: "https://ce-scheduling-system-v2-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "ce-scheduling-system-v2",
        storageBucket: "ce-scheduling-system-v2.firebasestorage.app",
        messagingSenderId: "288279598010",
        appId: "1:288279598010:web:d545ee1d4d854513084383",
        measurementId: "G-LSEEMJE2R0"
    };

    window.DATA_ROOT = 'ceScheduleV2';

    window.auth = null;
    window.database = null;
    window.isFirebaseReady = false;
    window.firebaseV2Initialized = false;
    window.isPageVisible = (typeof document !== 'undefined') 
        ? document.visibilityState === 'visible' 
        : true;

    let initResolve, initReject, isResolved = false;
    window.firebaseInitPromise = new Promise((resolve, reject) => {
        initResolve = resolve;
        initReject = reject;
    });
    
    window.waitForFirebase = () => window.firebaseInitPromise;

    // ページ可視性監視（CustomEventで他モジュールに通知）
    function setupVisibilityHandler() {
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                const wasVisible = window.isPageVisible;
                window.isPageVisible = document.visibilityState === 'visible';
                
                // 非表示→表示の遷移を通知
                if (!wasVisible && window.isPageVisible) {
                    window.dispatchEvent(new CustomEvent('app:resumed'));
                    console.log('📱 ページ復帰');
                } else if (wasVisible && !window.isPageVisible) {
                    console.log('📱 ページ非表示');
                }
            });
        }
    }

    function initializeFirebaseV2() {
        if (window.firebaseV2Initialized) {
            if (!isResolved && initResolve) {
                isResolved = true;
                initResolve();
            }
            return;
        }
        
        try {
            if (typeof firebase === 'undefined') {
                console.log('⏳ Firebase SDK待機中...');
                setTimeout(initializeFirebaseV2, 200);
                return;
            }

            let app;
            if (firebase.apps && firebase.apps.length > 0) {
                app = firebase.app();
                console.log('✅ 既存Firebase App使用');
            } else {
                app = firebase.initializeApp(window.firebaseConfig);
                console.log('✅ Firebase App初期化完了');
            }
            
            window.auth = firebase.auth();
            window.database = firebase.database();
            window.firebaseV2Initialized = true;
            
            setupVisibilityHandler();
            
            try {
                window.database.ref('.info/connected').on('value', function(snapshot) {
                    window.isFirebaseReady = snapshot.val();
                    if (window.isPageVisible) {
                        console.log(snapshot.val() ? '✅ Firebase接続成功' : '❌ Firebase接続失敗');
                    }
                }, function(error) {
                    console.warn('⚠️ Firebase接続監視エラー:', error.message);
                });
            } catch (connectionError) {
                console.warn('⚠️ 接続監視設定失敗:', connectionError.message);
            }

            if (!isResolved && initResolve) {
                isResolved = true;
                initResolve();
            }
            
        } catch (error) {
            console.error('❌ Firebase初期化エラー:', error);
            if (!isResolved && initReject) {
                isResolved = true;
                initReject(error);
            }
        }
    }

    initializeFirebaseV2();
    console.log('🔒 Firebase設定ファイル読み込み完了（最適化版）');
}
