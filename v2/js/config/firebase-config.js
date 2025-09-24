/**
 * Firebase設定 - V2統合版（認証競合解決・個人設定画面対応）
 * 
 * 役割:
 * - Firebase基本設定の提供
 * - グローバルインスタンスの初期化
 * - 初期化完了のPromise管理
 * 
 * 注意:
 * - 認証処理（匿名認証を含む）は各ページで明示的に行ってください
 * - これにより認証フローの競合を防止します
 */

// 重複初期化防止
if (typeof window.firebaseV2Initialized === 'undefined') {
    
    console.log('🔄 Firebase設定ファイル読み込み開始');
    
    // Firebase設定（既存設定を維持）
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
    window.firebaseV2Initialized = false;

    // Promise化機能
    let initResolve, initReject, isResolved = false;
    window.firebaseInitPromise = new Promise((resolve, reject) => {
        initResolve = resolve;
        initReject = reject;
    });
    
    window.waitForFirebase = () => window.firebaseInitPromise;

    /**
     * Firebase基本初期化（認証なし）
     * この関数はFirebase Appの初期化とサービスインスタンスの作成のみを行います。
     * 認証処理は意図的に除外し、各ページで明示的に実行してください。
     */
    function initializeFirebaseV2() {
        if (window.firebaseV2Initialized) {
            console.log('ℹ️ Firebase既に初期化済み');
            if (!isResolved && initResolve) {
                isResolved = true;
                initResolve();
            }
            return;
        }
        
        try {
            console.log('🔄 Firebase基本初期化開始');
            
            // Firebase SDK待機
            if (typeof firebase === 'undefined') {
                console.log('⏳ Firebase SDK待機中...');
                setTimeout(initializeFirebaseV2, 200);
                return;
            }

            // Firebase App初期化
            let app;
            if (firebase.apps && firebase.apps.length > 0) {
                app = firebase.app();
                console.log('✅ 既存Firebase App使用');
            } else {
                app = firebase.initializeApp(window.firebaseConfig);
                console.log('✅ Firebase App初期化完了');
            }
            
            // サービスインスタンス作成
            window.auth = firebase.auth();
            window.database = firebase.database();
            window.firebaseV2Initialized = true;
            
            // 接続状態監視（エラーハンドリング付き）
            try {
                window.database.ref('.info/connected').on('value', function(snapshot) {
                    window.isFirebaseReady = snapshot.val();
                    console.log(snapshot.val() ? '✅ Firebase接続成功' : '❌ Firebase接続失敗');
                }, function(error) {
                    console.warn('⚠️ Firebase接続監視エラー:', error.message);
                });
            } catch (connectionError) {
                console.warn('⚠️ 接続監視設定失敗:', connectionError.message);
            }
            
            // 【重要】認証処理は削除しました
            // 匿名認証やその他の認証は、各ページで以下のように明示的に実行してください：
            // 
            // 例（匿名認証が必要な場合）:
            // if (!window.auth.currentUser) {
            //     await window.auth.signInAnonymously();
            // }

            console.log('🔒 Firebase基本設定完了（認証なし）');
            
            // Promise解決（重複防止）
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

    // 即座に初期化実行
    initializeFirebaseV2();

    console.log('🔒 Firebase設定ファイル読み込み完了');
}
