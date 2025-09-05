/*
👨‍💼 管理者用ユーザー管理システム
初期ユーザー作成・パスワード生成・権限管理
*/

class AdminUserManagement {
    constructor() {
        this.isInitialized = false;
        this.currentAdmin = null;
        
        console.log('👨‍💼 管理者ユーザー管理システム初期化中...');
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
            console.log('✅ 管理者システム準備完了');
        } else {
            console.error('❌ Firebase未準備 - 管理者機能無効');
        }
    }

    // 管理者権限確認
    async verifyAdminAccess(user) {
        if (!user || !this.isInitialized) {
            return false;
        }
        
        try {
            const snapshot = await window.database.ref(`${window.DATA_ROOT}/users/${user.uid}/permissions/isAdmin`).once('value');
            return snapshot.val() === true;
        } catch (error) {
            console.error('❌ 管理者権限確認エラー:', error);
            return false;
        }
    }

    // 初期ユーザー作成
    async createInitialUser(userData) {
        if (!this.isInitialized) {
            throw new Error('システムが初期化されていません');
        }

        try {
            console.log('👤 初期ユーザー作成開始:', userData.displayName);
            
            // ユニークIDを生成（Firebase Auth不使用）
            const userId = this.generateUserId();
            const initialPassword = userData.initialPassword || this.generatePassword();
            
            // ユーザーデータ構造
            const newUserData = {
                profile: {
                    displayName: userData.displayName,
                    department: userData.department,
                    position: userData.position,
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    createdBy: this.currentAdmin?.uid || 'system'
                },
                auth: {
                    userId: userId,
                    initialPassword: initialPassword,
                    userPassword: null,  // ユーザーが後で設定
                    username: null,      // ユーザーが後で設定
                    accountStatus: 'initial',  // initial -> configured -> active
                    passwordChangeRequired: true,
                    email: null
                },
                permissions: {
                    level: userData.role || 'viewer',
                    canEdit: userData.role !== 'viewer',
                    canView: true,
                    isAdmin: userData.role === 'admin',
                    canExport: userData.role !== 'viewer'
                },
                loginHistory: {},
                setupCompleted: false,
                lastLogin: null,
                loginCount: 0
            };
            
            // データベースに保存
            await window.database.ref(`${window.DATA_ROOT}/users/${userId}`).set(newUserData);
            
            // 初期ユーザーリストに追加
            await window.database.ref(`${window.DATA_ROOT}/initialUsers/${userId}`).set({
                displayName: userData.displayName,
                initialPassword: initialPassword,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                status: 'waiting_setup'
            });
            
            console.log('✅ 初期ユーザー作成完了:', userId);
            
            return {
                success: true,
                userId: userId,
                initialPassword: initialPassword,
                loginUrl: `${window.location.origin}/v2/`,
                message: `初期ユーザー「${userData.displayName}」を作成しました`
            };
            
        } catch (error) {
            console.error('❌ 初期ユーザー作成エラー:', error);
            throw new Error(`ユーザー作成に失敗しました: ${error.message}`);
        }
    }

    // ユニークユーザーID生成
    generateUserId() {
        const timestamp = Date.now().toString(36);
        const randomStr = Math.random().toString(36).substring(2, 8);
        return `user_${timestamp}_${randomStr}`;
    }

    // パスワード自動生成
    generatePassword(length = 10) {
        const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let password = '';
        
        // 必ず大文字・小文字・数字を含む
        password += charset[Math.floor(Math.random() * 23)]; // 大文字
        password += charset[Math.floor(Math.random() * 23) + 26]; // 小文字  
        password += charset[Math.floor(Math.random() * 8) + 49]; // 数字
        
        // 残りの文字をランダム生成
        for (let i = 3; i < length; i++) {
            password += charset[Math.floor(Math.random() * charset.length)];
        }
        
        // シャッフル
        return password.split('').sort(() => 0.5 - Math.random()).join('');
    }

    // 初期ユーザーリスト取得
    async getInitialUsersList() {
        if (!this.isInitialized) {
            return [];
        }
        
        try {
            const snapshot = await window.database.ref(`${window.DATA_ROOT}/initialUsers`).once('value');
            
            if (snapshot.exists()) {
                const users = [];
                snapshot.forEach(childSnapshot => {
                    users.push({
                        userId: childSnapshot.key,
                        ...childSnapshot.val()
                    });
                });
                return users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            }
            return [];
        } catch (error) {
            console.error('❌ 初期ユーザーリスト取得エラー:', error);
            return [];
        }
    }

    // 既存ユーザーリスト取得（設定完了済み）
    async getConfiguredUsersList() {
        if (!this.isInitialized) {
            return [];
        }
        
        try {
            const snapshot = await window.database.ref(`${window.DATA_ROOT}/users`).orderByChild('auth/accountStatus').equalTo('configured').once('value');
            
            if (snapshot.exists()) {
                const users = [];
                snapshot.forEach(childSnapshot => {
                    const userData = childSnapshot.val();
                    users.push({
                        userId: childSnapshot.key,
                        displayName: userData.profile?.displayName,
                        username: userData.auth?.username,
                        department: userData.profile?.department,
                        role: userData.permissions?.level,
                        lastLogin: userData.lastLogin,
                        setupCompleted: userData.setupCompleted
                    });
                });
                return users;
            }
            return [];
        } catch (error) {
            console.error('❌ 設定済みユーザーリスト取得エラー:', error);
            return [];
        }
    }

    // ユーザー削除
    async deleteUser(userId) {
        if (!this.isInitialized) {
            throw new Error('システムが初期化されていません');
        }
        
        try {
            // ユーザーデータ削除
            await window.database.ref(`${window.DATA_ROOT}/users/${userId}`).remove();
            
            // 初期ユーザーリストからも削除
            await window.database.ref(`${window.DATA_ROOT}/initialUsers/${userId}`).remove();
            
            // ユーザー名マッピングも削除（存在する場合）
            const userSnapshot = await window.database.ref(`${window.DATA_ROOT}/users/${userId}/auth/username`).once('value');
            if (userSnapshot.exists()) {
                await window.database.ref(`${window.DATA_ROOT}/usernames/${userSnapshot.val()}`).remove();
            }
            
            console.log('✅ ユーザー削除完了:', userId);
            return true;
        } catch (error) {
            console.error('❌ ユーザー削除エラー:', error);
            throw new Error(`ユーザー削除に失敗しました: ${error.message}`);
        }
    }

    // パスワードリセット（管理者による）
    async resetUserPassword(userId) {
        if (!this.isInitialized) {
            throw new Error('システムが初期化されていません');
        }
        
        try {
            const newPassword = this.generatePassword();
            
            await window.database.ref(`${window.DATA_ROOT}/users/${userId}/auth`).update({
                userPassword: null,
                initialPassword: newPassword,
                passwordChangeRequired: true,
                accountStatus: 'initial',
                passwordResetAt: firebase.database.ServerValue.TIMESTAMP,
                passwordResetBy: this.currentAdmin?.uid
            });
            
            console.log('✅ パスワードリセット完了:', userId);
            return newPassword;
        } catch (error) {
            console.error('❌ パスワードリセットエラー:', error);
            throw new Error(`パスワードリセットに失敗しました: ${error.message}`);
        }
    }

    // ユーザー権限変更
    async updateUserPermissions(userId, newRole) {
        if (!this.isInitialized) {
            throw new Error('システムが初期化されていません');
        }
        
        try {
            const permissions = {
                level: newRole,
                canEdit: newRole !== 'viewer',
                canView: true,
                isAdmin: newRole === 'admin',
                canExport: newRole !== 'viewer',
                updatedAt: firebase.database.ServerValue.TIMESTAMP,
                updatedBy: this.currentAdmin?.uid
            };
            
            await window.database.ref(`${window.DATA_ROOT}/users/${userId}/permissions`).update(permissions);
            
            console.log('✅ 権限更新完了:', userId, newRole);
            return true;
        } catch (error) {
            console.error('❌ 権限更新エラー:', error);
            throw new Error(`権限更新に失敗しました: ${error.message}`);
        }
    }

    // 管理者設定
    setCurrentAdmin(admin) {
        this.currentAdmin = admin;
        console.log('👨‍💼 管理者設定:', admin?.email || admin?.uid);
    }
}

// グローバルインスタンス作成
if (!window.adminUserManager) {
    window.adminUserManager = new AdminUserManagement();
    console.log('👨‍💼 管理者ユーザー管理システム読み込み完了');
}
