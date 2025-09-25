/**
 * Firebase設定 - V2統合版（リアルタイム同期完全対応・診断機能付き）
 * 
 * 役割:
 * - Firebase基本設定の提供とApp初期化
 * - グローバルインスタンスの管理
 * - 接続確立完了まで待機するPromise管理
 * - 診断・デバッグ機能の提供
 * 
 * 重要: 認証処理は各ページで明示的に実行（競合防止）
 */

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

    // Promise管理（接続確立完了待機用）
    let initResolve, initReject;
    let isPromiseResolved = false;

    window.firebaseInitPromise = new Promise((resolve, reject) => {
        initResolve = resolve;
        initReject = reject;
    });
    
    window.waitForFirebase = () => window.firebaseInitPromise;

    // 接続監視用参照
    let connectionCheckRef = null;

    /**
     * データベース接続待機（タイムアウト付き）
     * @param {number} timeoutMs - タイムアウト時間（ミリ秒）
     * @returns {Promise<boolean>} 接続成功の可否
     */
    window.waitForDatabaseOnline = function(timeoutMs = 10000) {
        return new Promise((resolve) => {
            if (!window.database) {
                console.warn('⚠️ Database未初期化');
                return resolve(false);
            }
            
            let isResolved = false;
            const connRef = window.database.ref('.info/connected');
            
            const onConnected = (snapshot) => {
                if (snapshot.val() && !isResolved) {
                    isResolved = true;
                    try { connRef.off('value', onConnected); } catch(e) {}
                    console.log('✅ データベース接続確認完了');
                    resolve(true);
                }
            };
            
            connRef.on('value', onConnected);
            
            // タイムアウト処理
            setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    try { connRef.off('value', onConnected); } catch(e) {}
                    console.warn('⏳ データベース接続タイムアウト（処理継続）');
                    resolve(false);
                }
            }, timeoutMs);
        });
    };

    /**
     * 匿名認証ヘルパー（各ページで使用）
     * @returns {Promise<firebase.User|null>} 認証ユーザー
     */
    window.ensureAnonymousAuth = async function() {
        if (!window.auth) {
            console.error('❌ Auth未初期化');
            return null;
        }
        
        if (window.auth.currentUser) {
            return window.auth.currentUser;
        }
        
        try {
            const result = await window.auth.signInAnonymously();
            console.log('✅ 匿名認証完了:', result.user.uid);
            return result.user;
        } catch (error) {
            console.error('❌ 匿名認証失敗:', error);
            throw error;
        }
    };

    /**
     * データルート診断（DATA_ROOT確認用）
     * @param {number} limit - 取得する子要素数の上限
     * @returns {Promise<Object|null>} ルート直下のデータ
     */
    window.debugListRootPaths = async function(limit = 5) {
        try {
            await window.waitForFirebase();
            
            console.log('🔍 データルート診断開始:', window.DATA_ROOT);
            const snapshot = await window.database.ref(window.DATA_ROOT).limitToFirst(limit).once('value');
            const data = snapshot.val();
            
            if (data) {
                const keys = Object.keys(data);
                console.log('✅ ルート診断結果:', window.DATA_ROOT, keys);
                console.log('📋 利用可能なデータ:', keys.join(', '));
                return data;
            } else {
                console.warn('⚠️ ルート診断結果: データが見つかりません');
                console.log('💡 他の可能性のあるルート名: ceSchedule, ceScheduleV1');
                return null;
            }
        } catch (error) {
            console.error('❌ ルート診断エラー:', error);
            return null;
        }
    };

    /**
     * リアルタイム同期ヘルスチェック
     * @returns {Promise<void>}
     */
    window.realtimeHealthCheck = async function() {
        try {
            console.log('🩺 リアルタイム同期ヘルスチェック開始');
            
            await window.waitForFirebase();
            await window.waitForDatabaseOnline(5000);

            const testPath = `${window.DATA_ROOT}/__healthcheck`;
            
            // 読み取りテスト
            try {
                const snapshot = await window.database.ref(testPath).once('value');
                console.log('✅ 単発読み取りテスト成功');
            } catch (readError) {
                console.warn('⚠️ 読み取りテスト失敗:', readError.message);
            }

            // リアルタイム購読テスト
            const testRef = window.database.ref(testPath);
            const testCallback = (snapshot) => {
                console.log('✅ リアルタイム購読テスト: データ受信確認');
            };
            
            testRef.on('value', testCallback);
            
            // 10秒後にテスト終了
            setTimeout(() => {
                try { 
                    testRef.off('value', testCallback); 
                    console.log('🩺 ヘルスチェック完了');
                } catch(e) {}
            }, 10000);

            // 書き込みテスト（権限がある場合）
            try {
                await testRef.update({ 
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    test: 'healthcheck'
                });
                console.log('✅ 書き込みテスト成功');
            } catch (writeError) {
                console.warn('⚠️ 書き込みテスト失敗（権限制限の可能性）:', writeError.message);
            }

        } catch (error) {
            console.error('❌ ヘルスチェック全体エラー:', error);
        }
    };

    /**
     * Firebase基本初期化（接続確立まで待機）
     * 認証処理は意図的に除外し、各ページで明示的に実行
     */
    function initializeFirebaseV2() {
        if (window.firebaseV2Initialized) {
            if (!isPromiseResolved && initResolve) {
                isPromiseResolved = true;
                initResolve();
            }
            return;
        }
        
        try {
            // Firebase SDK完全ロード待機
            if (typeof firebase === 'undefined' || 
                typeof firebase.auth === 'undefined' || 
                typeof firebase.database === 'undefined') {
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
            
            // 接続確立まで待機してからPromise解決
            if (connectionCheckRef) {
                connectionCheckRef.off();
            }
            
            connectionCheckRef = window.database.ref('.info/connected');
            connectionCheckRef.on('value', function(snapshot) {
                const isConnected = snapshot.val();
                window.isFirebaseReady = isConnected;
                
                if (isConnected) {
                    console.log('✅ Firebase Realtime Database接続確立');
                    
                    // 初回接続時のみPromise解決
                    if (!isPromiseResolved && initResolve) {
                        isPromiseResolved = true;
                        initResolve();
                        console.log('🎉 Firebase初期化完了: リアルタイム同期準備完了');
                    }
                } else {
                    console.warn('❌ Firebase接続失敗: オフラインまたは認証エラー');
                }
            }, function(error) {
                console.error('❌ Firebase接続監視エラー:', error.message);
                if (!isPromiseResolved && initReject) {
                    isPromiseResolved = true;
                    initReject(new Error(`Firebase接続失敗: ${error.message}`));
                }
            });
            
        } catch (error) {
            console.error('❌ Firebase初期化エラー:', error);
            if (!isPromiseResolved && initReject) {
                isPromiseResolved = true;
                initReject(error);
            }
        }
    }

    // 即座に初期化実行
    initializeFirebaseV2();
    console.log('🔒 Firebase設定ファイル読み込み完了（リアルタイム同期対応）');

} else {
    console.log('✅ Firebase設定ファイルは既に読み込み済み');
}
