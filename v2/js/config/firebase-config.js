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

// Firebase初期化
try {
    // 既に初期化されている場合はエラーを無視
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('🔥 Firebase V2 初期化完了');
    } else {
        console.log('🔥 Firebase V2 既に初期化済み');
    }
} catch (error) {
    console.error('❌ Firebase初期化エラー:', error);
}

// グローバル変数設定
window.firebaseConfig = firebaseConfig;
window.auth = firebase.auth();
window.database = firebase.database();

// グローバル変数確認
console.log('🔥 Firebase グローバル変数設定完了:', {
    auth: !!window.auth,
    database: !!window.database,
    config: !!window.firebaseConfig
});
