/*
==========================================
🔒 Firebase設定 - CRITICAL CONFIGURATION
このファイルはシステム接続の根幹です
変更時は必ずバックアップを取ってください
==========================================
*/

// Firebase設定（既存の設定を使用）
const firebaseConfig = {
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
const DATA_ROOT = 'ceScheduleV2';

// Firebase サービス変数
let app = null;
let database = null;
let auth = null;
let isFirebaseReady = false;

// Firebase初期化関数
function initializeFirebaseV2() {
    try {
        console.log('🔄 Firebase V2 初期化開始');
        
        // Firebase初期化
        if (!firebase.apps.length) {
            app = firebase.initializeApp(firebaseConfig);
        } else {
            app = firebase.apps[0];
        }
        
        // サービス取得
        auth = firebase.auth();
        database = firebase.database();
        
        // 接続状態監視
        database.ref('.info/connected').on('value', function(snapshot) {
            if (snapshot.val() === true) {
                console.log('✅ Firebase接続成功');
                isFirebaseReady = true;
                updateConnectionStatus('connected');
            } else {
                console.log('❌ Firebase接続失敗');
                isFirebaseReady = false;
                updateConnectionStatus('disconnected');
            }
        });
        
        console.log('✅ Firebase V2 初期化完了');
        return true;
    } catch (error) {
        console.error('❌ Firebase初期化エラー:', error);
        updateConnectionStatus('error');
        return false;
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

// グローバル公開（保護）
Object.defineProperty(window, 'firebaseConfig', {
    value: firebaseConfig,
    writable: false,
    configurable: false
});

Object.defineProperty(window, 'DATA_ROOT', {
    value: DATA_ROOT,
    writable: false,
    configurable: false
});

// 初期化実行
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebaseV2();
});

console.log('🔒 Firebase設定ファイル読み込み完了');
