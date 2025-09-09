class InitialLoginDetector {
    constructor() {
        this.database = null;
        this.auth = null;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        console.log('🔍 初期ログイン検知システム初期化中...');
        
        // Firebase準備待機
        await this.waitForFirebase();
        
        try {
            this.database = firebase.database();
            this.auth = firebase.auth();
            this.isInitialized = true;
            
            console.log('✅ 初期ログイン検知システム準備完了');
            
        } catch (error) {
            console.error('❌ 初期ログイン検知システム初期化エラー:', error);
        }
    }

    async waitForFirebase() {
        let attempts = 0;
        while (attempts < 100 && (!window.firebase || !window.firebase.apps || window.firebase.apps.length === 0)) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
    }

    // 🔧 修正: 初期ログイン処理
    async handleInitialLogin(username, password) {
        console.log('🔍 初期ログイン試行:', username);
        
        try {
            // ✅ initialUsers テーブルから検索
            const userSnapshot = await this.database
                .ref(`ceScheduleV2/initialUsers/${username}`)
                .once('value');
                
            if (!userSnapshot.exists()) {
                throw new Error('ユーザーが見つかりません');
            }
            
            const userData = userSnapshot.val();
            console.log('✅ 初期ユーザーデータ取得:', userData);
            
            // パスワード確認
            if (userData.tempPassword !== password) {
                throw new Error('パスワードが正しくありません');
            }
            
            console.log('✅ 初期ログイン認証成功:', username);
            
            // 🔄 ユーザー設定画面にリダイレクト
            const redirectUrl = `pages/user-setup.html?initialUser=${encodeURIComponent(username)}`;
            console.log('🔄 初期設定画面へリダイレクト:', redirectUrl);
            
            window.location.href = redirectUrl;
            
        } catch (error) {
            console.error('❌ 初期ログインエラー:', error);
            throw error;
        }
    }

    // 🔧 修正: ユーザー名ログイン処理
    async handleUsernameLogin(username, password) {
    console.log('🔍 ユーザー名ログイン試行:', username);
    
    try {
        // ✅ usernames テーブルから UID を取得
        const usernameSnapshot = await this.database
            .ref(`ceScheduleV2/usernames/${username}`)
            .once('value');
            
        if (!usernameSnapshot.exists()) {
            throw new Error('ユーザー名が見つかりません');
        }
        
        const usernameData = usernameSnapshot.val();
        console.log('✅ ユーザー名データ:', usernameData);
        
        // 初期ユーザーの場合は初期ログインに転送
        if (usernameData.status === 'initial') {
            console.log('🔄 初期ユーザーのため初期ログインに転送');
            return await this.handleInitialLogin(username, password);
        }
        
        // 🆕 通常ログイン処理（新規実装）
        if (usernameData.uid && usernameData.status === 'active') {
            console.log('🔐 通常ユーザーログイン処理開始');
            
            // Firebase Authentication でログイン
            try {
                // Email形式のログイン（一時的なEmail使用）
                const loginEmail = `${username}@temp.local`;
                console.log('🔐 Firebase Auth ログイン試行:', loginEmail);
                
                const userCredential = await this.auth.signInWithEmailAndPassword(loginEmail, password);
                const user = userCredential.user;
                
                console.log('✅ Firebase Authentication 成功:', user.uid);
                
                // ユーザーデータ取得
                const userSnapshot = await this.database
                    .ref(`ceScheduleV2/users/${user.uid}`)
                    .once('value');
                    
                if (!userSnapshot.exists()) {
                    throw new Error('ユーザーデータが見つかりません');
                }
                
                const userData = userSnapshot.val();
                console.log('✅ 通常ユーザーデータ取得:', userData);
                
                // ログイン記録更新
                await this.database.ref(`ceScheduleV2/users/${user.uid}`).update({
                    lastLogin: firebase.database.ServerValue.TIMESTAMP,
                    loginCount: (userData.loginCount || 0) + 1
                });
                
                console.log('🎉 通常ログイン完全成功:', username);
                
                // メイン画面にリダイレクト (認証システムが自動処理)
                return true;
                
            } catch (authError) {
                console.error('❌ Firebase Authentication エラー:', authError);
                throw new Error('認証に失敗しました。パスワードを確認してください。');
            }
            
        } else {
            throw new Error('ユーザー状態が無効です');
        }
        
    } catch (error) {
        console.error('❌ ユーザー名ログインエラー:', error);
        throw error;
    }
}

    // 🔧 修正: ログイン試行統合メソッド
    async attemptLogin(loginId, password) {
        console.log('🔍 ログイン試行開始:', { loginId });
        
        try {
            // 1. 初期ログイン試行
            try {
                await this.handleInitialLogin(loginId, password);
                return; // 成功時は処理終了（リダイレクト済み）
            } catch (initialError) {
                console.log('⚠️ 初期ログイン失敗:', initialError.message);
            }
            
            // 2. ユーザー名ログイン試行
            try {
                await this.handleUsernameLogin(loginId, password);
                return; // 成功時は処理終了
            } catch (usernameError) {
                console.log('⚠️ ユーザー名ログイン失敗:', usernameError.message);
            }
            
            // 3. 全て失敗
            console.error('❌ 両方のログイン方式が失敗');
            throw new Error('ユーザーID/ユーザー名またはパスワードが正しくありません');
            
        } catch (error) {
            console.error('❌ ログイン試行エラー:', error);
            throw error;
        }
    }

    // 🆕 ユーザー存在確認
    async checkUserExists(username) {
        try {
            const initialUserSnapshot = await this.database
                .ref(`ceScheduleV2/initialUsers/${username}`)
                .once('value');
                
            if (initialUserSnapshot.exists()) {
                return { type: 'initial', data: initialUserSnapshot.val() };
            }
            
            const usernameSnapshot = await this.database
                .ref(`ceScheduleV2/usernames/${username}`)
                .once('value');
                
            if (usernameSnapshot.exists()) {
                return { type: 'registered', data: usernameSnapshot.val() };
            }
            
            return null;
        } catch (error) {
            console.error('❌ ユーザー存在確認エラー:', error);
            return null;
        }
    }

    // 🆕 ユーザー名利用可能性チェック（追加）
    async checkUsernameAvailability(username) {
        console.log('🔍 ユーザー名利用可能性チェック:', username);
        
        try {
            // 入力値検証
            if (!username || username.length < 3 || username.length > 20) {
                return { available: false, reason: 'invalid_length' };
            }
            
            // 英数字チェック
            const alphanumericRegex = /^[a-zA-Z0-9]+$/;
            if (!alphanumericRegex.test(username)) {
                return { available: false, reason: 'invalid_format' };
            }
            
            // 1. initialUsers テーブルをチェック
            const initialUserSnapshot = await this.database
                .ref(`ceScheduleV2/initialUsers/${username}`)
                .once('value');
                
            if (initialUserSnapshot.exists()) {
                console.log('❌ ユーザー名は既に初期ユーザーとして使用中');
                return { available: false, reason: 'initial_user_exists' };
            }
            
            // 2. usernames テーブルをチェック
            const usernameSnapshot = await this.database
                .ref(`ceScheduleV2/usernames/${username}`)
                .once('value');
                
            if (usernameSnapshot.exists()) {
                console.log('❌ ユーザー名は既に使用中');
                return { available: false, reason: 'username_exists' };
            }
            
            console.log('✅ ユーザー名は利用可能');
            return { available: true };
            
        } catch (error) {
            console.error('❌ ユーザー名チェックエラー:', error);
            return { available: false, reason: 'check_failed' };
        }
    }

    // 🆕 パスワード確認
    async validatePassword(username, password, userType = 'initial') {
        try {
            if (userType === 'initial') {
                const userSnapshot = await this.database
                    .ref(`ceScheduleV2/initialUsers/${username}`)
                    .once('value');
                    
                if (userSnapshot.exists()) {
                    const userData = userSnapshot.val();
                    return userData.tempPassword === password;
                }
            }
            
            return false;
        } catch (error) {
            console.error('❌ パスワード確認エラー:', error);
            return false;
        }
    }
}

// グローバル変数
let initialLoginDetector = null;

// システム初期化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        initialLoginDetector = new InitialLoginDetector();
        window.initialLoginDetector = initialLoginDetector;
        
        console.log('✅ 初期ログイン検知システム準備完了');
        
    } catch (error) {
        console.error('❌ 初期ログイン検知システム初期化失敗:', error);
    }
});

console.log('🔍 初期ログイン検知システム読み込み完了');
