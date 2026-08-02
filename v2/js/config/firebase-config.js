/**
 * Firebase設定 - V2統合版（パフォーマンス最適化版）
 */
if (typeof window.firebaseV2Initialized === 'undefined') {
    console.log('🔄 Firebase設定ファイル読み込み開始');
    
    window.firebaseConfig = {
        apiKey: "AIzaSyBYrjRe2x0sxfYpJN0XY8HC-UPOjTAEBk4",
        authDomain: "yamadaice-webapp.firebaseapp.com",
        databaseURL: "https://yamadaice-webapp-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "yamadaice-webapp",
        storageBucket: "yamadaice-webapp.firebasestorage.app",
        messagingSenderId: "407493129637",
        appId: "1:407493129637:web:8b26f34ecd245fb37a244c",
        measurementId: "G-B5Q2PMRQWY"
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
