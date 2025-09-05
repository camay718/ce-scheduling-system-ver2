/*
🔍 初期ログイン検知システム
管理者が作成した初期ユーザーのログインを検知し、個人設定画面へ誘導
*/

class InitialLoginDetector {
    constructor() {
        this.isInitialized = false;
        this.currentUserId = null;
        
        console.log('🔍 初期ログイン検知システム初期化中...');
        this.initialize();
    }

    async initialize() {
        // Firebase準備待ち
        let attempts = 0;
        while (attempts < 100 && (!window.auth || !window.database)) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (window.auth && window.database) {
            this.isInitialized = true;
            console.log('✅ 初期ログイン検知システム準備完了');
        } else {
            console.error('❌ Firebase未準備 - 初期ログイン検知無効');
        }
    }

    // 初期パスワードでのログイン処理
    async handleInitialLogin(userId, password) {
        if (!this.isInitialized) {
            throw new Error('システムが初期化されていません');
        }

        try {
            console.log('🔍 初期ログイン試行:', userId);
            
            // ユーザー情報取得
            const userSnapshot = await window.database.ref(`${window.DATA_ROOT}/users/${userId}`).once('value');
            
            if (!userSnapshot.exists()) {
                throw new Error('ユーザーが見つかりません');
            }
            
            const userData = userSnapshot.val();
            const authData = userData.auth || {};
            
            // アカウント状態確認
            if (authData.accountStatus !== 'initial') {
                throw new Error('このアカウントは既に設定が完了しているか、無効です');
            }
            
            // 初期パスワード確認
            if (authData.initialPassword !== password) {
                throw new Error('初期パスワードが正しくありません');
            }
            
            // ログイン成功
            this.currentUserId = userId;
            
            // 初期ログイン履歴記録
            await this.recordInitialLogin(userId, userData);
            
            console.log('✅ 初期ログイン成功 - 個人設定画面へ誘導');
            
            return {
                success: true,
                userId: userId,
                userData: userData,
                requiresSetup: true,
                message: '初期ログイン成功！個人設定を完了してください。'
            };
            
        } catch (error) {
            console.error('❌ 初期ログインエラー:', error);
            throw error;
        }
    }

    // 通常ユーザー名ログイン処理
    async handleUsernameLogin(username, password) {
        if (!this.isInitialized) {
            throw new Error('システムが初期化されていません');
        }

        try {
            console.log('🔍 ユーザー名ログイン試行:', username);
            
            // ユーザー名からユーザーID取得
            const usernameSnapshot = await window.database.ref(`${window.DATA_ROOT}/usernames/${username}`).once('value');
            
            if (!usernameSnapshot.exists()) {
                throw new Error('ユーザー名が見つかりません');
            }
            
            const userId = usernameSnapshot.val();
            
            // ユーザー情報取得
            const userSnapshot = await window.database.ref(`${window.DATA_ROOT}/users/${userId}`).once('value');
            
            if (!userSnapshot.exists()) {
                throw new Error('ユーザーデータが見つかりません');
            }
            
            const userData = userSnapshot.val();
            const authData = userData.auth || {};
            
            // アカウント状態確認
            if (authData.accountStatus !== 'configured') {
                throw new Error('アカウントが正しく設定されていません');
            }
            
            // パスワード確認
            if (authData.userPassword !== password) {
                throw new Error('パスワードが正しくありません');
            }
            
            // ログイン成功
            this.currentUserId = userId;
            
            // ログイン履歴記録
            await this.recordNormalLogin(userId, userData);
            
            console.log('✅ 通常ログイン成功');
            
            return {
                success: true,
                userId: userId,
                userData: userData,
                requiresSetup: false,
                message: 'ログインしました'
            };
            
        } catch (error) {
            console.error('❌ ユーザー名ログインエラー:', error);
            throw error;
        }
    }

    // ログイン方式自動判定
    async attemptLogin(loginId, password) {
        if (!this.isInitialized) {
            throw new Error('システムが初期化されていません');
        }

        try {
            // 1. 初期ユーザーIDとしてログイン試行
            if (loginId.startsWith('user_')) {
                return await this.handleInitialLogin(loginId, password);
            }
            
            // 2. ユーザー名としてログイン試行
            return await this.handleUsernameLogin(loginId, password);
            
        } catch (error) {
            // 1つ目が失敗した場合、もう1つの方式を試行
            try {
                if (loginId.startsWith('user_')) {
                    return await this.handleUsernameLogin(loginId, password);
                } else {
                    return await this.handleInitialLogin(loginId, password);
                }
            } catch (secondError) {
                console.error('❌ 両方のログイン方式が失敗:', error.message, secondError.message);
                throw new Error('ユーザーID/ユーザー名またはパスワードが正しくありません');
            }
        }
    }

    // 初期ログイン履歴記録
    async recordInitialLogin(userId, userData) {
        try {
            await window.database.ref(`${window.DATA_ROOT}/users/${userId}/loginHistory`).push({
                type: 'initial_login',
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                userAgent: navigator.userAgent,
                setupRequired: true
            });

            // 最終ログイン更新
            await window.database.ref(`${window.DATA_ROOT}/users/${userId}`).update({
                lastLogin: firebase.database.ServerValue.TIMESTAMP,
                loginCount: (userData.loginCount || 0) + 1
            });

            console.log('✅ 初期ログイン履歴記録完了');
        } catch (error) {
            console.warn('⚠️ ログイン履歴記録失敗:', error);
        }
    }

    // 通常ログイン履歴記録
    async recordNormalLogin(userId, userData) {
        try {
            await window.database.ref(`${window.DATA_ROOT}/users/${userId}/loginHistory`).push({
                type: 'normal_login',
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                userAgent: navigator.userAgent
            });

            // 最終ログイン更新
            await window.database.ref(`${window.DATA_ROOT}/users/${userId}`).update({
                lastLogin: firebase.database.ServerValue.TIMESTAMP,
                loginCount: (userData.loginCount || 0) + 1
            });

            console.log('✅ 通常ログイン履歴記録完了');
        } catch (error) {
            console.warn('⚠️ ログイン履歴記録失敗:', error);
        }
    }

    // ログアウト処理
    async handleLogout() {
        if (this.currentUserId) {
            try {
                await window.database.ref(`${window.DATA_ROOT}/users/${this.currentUserId}/loginHistory`).push({
                    type: 'logout',
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
                console.log('✅ ログアウト記録完了');
            } catch (error) {
                console.warn('⚠️ ログアウト記録失敗:', error);
            }
        }
        
        this.currentUserId = null;
        console.log('✅ ログアウト処理完了');
    }

    // 現在のユーザーID取得
    getCurrentUserId() {
        return this.currentUserId;
    }

    // ユーザー名の重複チェック
    async checkUsernameAvailability(username) {
        if (!this.isInitialized) {
            throw new Error('システムが初期化されていません');
        }

        try {
            const snapshot = await window.database.ref(`${window.DATA_ROOT}/usernames/${username}`).once('value');
            return !snapshot.exists();
        } catch (error) {
            console.error('❌ ユーザー名重複チェックエラー:', error);
            return false;
        }
    }
}

// グローバルインスタンス作成
if (!window.initialLoginDetector) {
    window.initialLoginDetector = new InitialLoginDetector();
    console.log('🔍 初期ログイン検知システム読み込み完了');
}
