/*
🔐 Email認証システム - Phase 2
個人ユーザー登録とEmail/Password認証
*/
class EmailAuthSystem {
    constructor() {
        this.isInitialized = false;
        this.currentUser = null;
        this.registrationMode = false;
        
        console.log('📧 Email認証システム初期化中...');
        this.initialize();
    }

    async initialize() {
        // Firebase準備待ち
        let attempts = 0;
        while (attempts < 100 && (!window.auth || !window.isFirebaseReady)) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (window.auth) {
            this.setupEmailAuth();
            this.isInitialized = true;
            console.log('✅ Email認証システム準備完了');
        } else {
            console.warn('⚠️ Firebase未準備 - Email認証無効');
        }
    }

    setupEmailAuth() {
        // Firebase Auth設定
        window.auth.onAuthStateChanged((user) => {
            if (user && !user.isAnonymous) {
                console.log('✅ Email認証ユーザー:', user.email);
                this.currentUser = user;
                this.handleEmailLogin(user);
            } else if (user && user.isAnonymous) {
                console.log('ℹ️ 匿名ユーザー - V1システム使用');
            } else {
                console.log('ℹ️ 認証なし');
                this.currentUser = null;
            }
        });
    }

    // Email/Passwordでの新規登録
    async registerWithEmail(email, password, profile) {
        try {
            console.log('📧 Email登録開始:', email);
            
            // Firebase Authentication
            const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Email確認送信
            await user.sendEmailVerification();
            
            // ユーザープロファイル作成
            await this.createEmailUserProfile(user.uid, {
                email: email,
                ...profile,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                emailVerified: false,
                accountStatus: 'pending', // 管理者承認待ち
                authMethod: 'email'
            });
            
            console.log('✅ Email登録完了 - 確認メール送信済み');
            return {
                success: true,
                message: '登録完了！確認メールをご確認ください。',
                user: user
            };
            
        } catch (error) {
            console.error('❌ Email登録失敗:', error);
            return {
                success: false,
                message: this.getErrorMessage(error.code),
                error: error
            };
        }
    }

    // Email/Passwordでのログイン
    async loginWithEmail(email, password) {
        try {
            console.log('📧 Emailログイン試行:', email);
            
            const userCredential = await window.auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Email確認チェック
            if (!user.emailVerified) {
                await window.auth.signOut();
                return {
                    success: false,
                    message: 'メールアドレスの確認が必要です。確認メールをご確認ください。'
                };
            }
            
            // ユーザーステータス確認
            const profile = await this.loadEmailUserProfile(user.uid);
            if (profile && profile.accountStatus !== 'active') {
                await window.auth.signOut();
                return {
                    success: false,
                    message: 'アカウントが管理者承認待ちです。しばらくお待ちください。'
                };
            }
            
            console.log('✅ Emailログイン成功');
            return {
                success: true,
                message: 'ログインしました',
                user: user
            };
            
        } catch (error) {
            console.error('❌ Emailログイン失敗:', error);
            return {
                success: false,
                message: this.getErrorMessage(error.code)
            };
        }
    }

    // パスワードリセット
    async resetPassword(email) {
        try {
            await window.auth.sendPasswordResetEmail(email);
            console.log('✅ パスワードリセットメール送信');
            return {
                success: true,
                message: 'パスワードリセットメールを送信しました。'
            };
        } catch (error) {
            console.error('❌ パスワードリセット失敗:', error);
            return {
                success: false,
                message: this.getErrorMessage(error.code)
            };
        }
    }

    // Emailユーザープロファイル作成
    async createEmailUserProfile(uid, profileData) {
        try {
            await window.database.ref(`${window.DATA_ROOT}/users/${uid}`).set({
                ...profileData,
                permissions: {
                    canEdit: false,
                    canView: true,
                    isAdmin: false,
                    canExport: false,
                    level: 'viewer'
                },
                loginCount: 0,
                lastLogin: null
            });
            
            // 登録申請履歴
            await window.database.ref(`${window.DATA_ROOT}/userRegistrations`).push({
                uid: uid,
                email: profileData.email,
                registeredAt: firebase.database.ServerValue.TIMESTAMP,
                status: 'pending'
            });
            
            console.log('✅ Emailユーザープロファイル作成完了');
        } catch (error) {
            console.error('❌ プロファイル作成失敗:', error);
            throw error;
        }
    }

    // Emailユーザープロファイル読み込み
    async loadEmailUserProfile(uid) {
        try {
            const snapshot = await window.database.ref(`${window.DATA_ROOT}/users/${uid}`).once('value');
            return snapshot.exists() ? snapshot.val() : null;
        } catch (error) {
            console.error('❌ プロファイル読み込み失敗:', error);
            return null;
        }
    }

    // Email認証ログイン処理
    async handleEmailLogin(user) {
        try {
            const profile = await this.loadEmailUserProfile(user.uid);
            
            if (profile) {
                // ログイン回数更新
                await window.database.ref(`${window.DATA_ROOT}/users/${user.uid}`).update({
                    lastLogin: firebase.database.ServerValue.TIMESTAMP,
                    loginCount: (profile.loginCount || 0) + 1
                });
                
                // 認証システムに通知
                if (window.authSystem) {
                    window.authSystem.currentUser = user.email;
                    window.authSystem.userProfile = profile;
                    window.authSystem.userRole = profile.permissions?.level || 'viewer';
                    window.authSystem.userDepartment = profile.department || null;
                    window.authSystem.showMainInterface();
                }
                
                console.log('✅ Email認証ログイン完了');
            } else {
                console.warn('⚠️ ユーザープロファイル未発見');
                await window.auth.signOut();
            }
        } catch (error) {
            console.error('❌ Email認証ログイン処理エラー:', error);
        }
    }

    // エラーメッセージ変換
    getErrorMessage(errorCode) {
        const messages = {
            'auth/email-already-in-use': 'このメールアドレスは既に使用されています。',
            'auth/weak-password': 'パスワードは6文字以上で設定してください。',
            'auth/invalid-email': 'メールアドレスの形式が正しくありません。',
            'auth/user-not-found': 'ユーザーが見つかりません。',
            'auth/wrong-password': 'パスワードが正しくありません。',
            'auth/too-many-requests': '試行回数が多すぎます。しばらく待ってから再試行してください。',
            'auth/network-request-failed': 'ネットワークエラーです。接続を確認してください。'
        };
        return messages[errorCode] || `エラー: ${errorCode}`;
    }

    // 管理者用：ユーザー承認
    async approveUser(uid) {
        if (!this.isAdmin()) {
            throw new Error('管理者権限が必要です');
        }
        
        try {
            await window.database.ref(`${window.DATA_ROOT}/users/${uid}`).update({
                accountStatus: 'active',
                approvedAt: firebase.database.ServerValue.TIMESTAMP,
                approvedBy: this.currentUser.uid
            });
            console.log('✅ ユーザー承認完了:', uid);
        } catch (error) {
            console.error('❌ ユーザー承認失敗:', error);
            throw error;
        }
    }

    // 管理者権限チェック
    isAdmin() {
        return this.currentUser && 
               window.authSystem?.userProfile?.permissions?.isAdmin === true;
    }
}

// グローバルインスタンス作成
if (!window.emailAuthSystem) {
    window.emailAuthSystem = new EmailAuthSystem();
    console.log('📧 Email認証システム読み込み完了');
}
