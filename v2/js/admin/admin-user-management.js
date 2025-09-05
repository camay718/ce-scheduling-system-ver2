class AdminUserManager {
    constructor() {
        this.database = null;
        this.auth = null;
        this.isInitialized = false;
        this.initializationPromise = this.init();
    }

    async init() {
        console.log('AdminUserManager初期化開始...');
        
        try {
            if (!window.firebase) {
                throw new Error('Firebase グローバルオブジェクトが見つかりません');
            }

            if (!window.firebase.apps || window.firebase.apps.length === 0) {
                throw new Error('Firebase App が初期化されていません');
            }

            console.log('Firebase App確認OK');

            this.database = firebase.database();
            this.auth = firebase.auth();
            
            console.log('Firebase サービス接続OK');
            
            await this.database.ref('.info/connected').once('value');
            console.log('Firebase Database接続テストOK');
            
            this.isInitialized = true;
            console.log('AdminUserManager初期化完了');
            
            window.adminUserManager = this;
            
            return this;
        } catch (error) {
            console.error('AdminUserManager初期化エラー:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    async waitForInitialization() {
        if (!this.isInitialized) {
            console.log('AdminUserManager初期化待機中...');
            await this.initializationPromise;
        }
        return this;
    }

    async createInitialUser(userData) {
        console.log('createInitialUser 呼び出し開始');
        
        await this.waitForInitialization();
        
        const username = userData.displayName;
        const permission = userData.role;
        const department = userData.department;
        
        console.log('ユーザー作成開始:', {username, permission, department});
        
        if (!username || !permission) {
            throw new Error('ユーザー名（氏名）と権限を入力してください');
        }

        try {
            console.log('Firebase Database接続テスト...');
            const testRef = this.database.ref('ceScheduleV2');
            await testRef.once('value');
            console.log('Database接続OK');

            console.log('重複チェック中...');
            const existingInitial = await this.database.ref(`ceScheduleV2/initialUsers/${username}`).once('value');
            const existingUsername = await this.database.ref(`ceScheduleV2/usernames/${username}`).once('value');
            
            if (existingInitial.exists() || existingUsername.exists()) {
                throw new Error('このユーザー名（氏名）は既に使用されています');
            }
            console.log('ユーザー名利用可能');

            const tempPassword = userData.initialPassword;
            console.log('一時パスワード使用:', tempPassword);
            
            if (!tempPassword) {
                throw new Error('一時パスワードが生成されていません');
            }
            
            const saveUserData = {
                username: username,        
                tempPassword: tempPassword,
                permission: permission,
                department: department,    
                isInitial: true,          
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastLogin: null,
                loginCount: 0
            };

            console.log('保存データ:', saveUserData);

            console.log('Step 1: initialUsers テーブルに保存中...');
            await this.database.ref(`ceScheduleV2/initialUsers/${username}`).set(saveUserData);
            console.log('initialUsers 保存完了');

            console.log('Step 2: usernames テーブルに保存中...');
            await this.database.ref(`ceScheduleV2/usernames/${username}`).set({
                status: 'initial',       
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                permission: permission
            });
            console.log('usernames 保存完了');
            
            console.log('ユーザー作成完全成功:', username);
            
            return {
                success: true,
                message: 'ユーザー作成が完了しました',
                userId: username,
                initialPassword: tempPassword,
                loginUrl: `${window.location.origin}/v2/index.html`
            };
            
        } catch (error) {
            console.error('詳細エラー情報:');
            console.error('- エラー:', error);
            console.error('- エラーコード:', error.code);
            console.error('- エラーメッセージ:', error.message);
            
            throw new Error(`ユーザー作成エラー: ${error.message}`);
        }
    }

    generatePassword() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let password = '';
        for (let i = 0; i < 8; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        console.log('新しいパスワード生成:', password);
        return password;
    }

    async getInitialUsersList() {
        await this.waitForInitialization();
        
        try {
            const snapshot = await this.database.ref('ceScheduleV2/initialUsers').once('value');
            const users = [];
            
            if (snapshot.exists()) {
                snapshot.forEach((userSnapshot) => {
                    const userData = userSnapshot.val();
                    users.push({
                        userId: userSnapshot.key,
                        displayName: userData.username,
                        initialPassword: userData.tempPassword,
                        createdAt: userData.createdAt,
                        permission: userData.permission,
                        department: userData.department
                    });
                });
            }
            
            return users;
        } catch (error) {
            console.error('初期ユーザーリスト取得エラー:', error);
            return [];
        }
    }

    async getConfiguredUsersList() {
        await this.waitForInitialization();
        return [];
    }

    async deleteUser(userId) {
        await this.waitForInitialization();
        
        try {
            const updates = {};
            updates[`ceScheduleV2/initialUsers/${userId}`] = null;
            updates[`ceScheduleV2/usernames/${userId}`] = null;
            
            await this.database.ref().update(updates);
            console.log('ユーザー削除完了:', userId);
            
        } catch (error) {
            console.error('ユーザー削除エラー:', error);
            throw new Error('ユーザー削除に失敗しました');
        }
    }

    async resetUserPassword(userId) {
        await this.waitForInitialization();
        
        try {
            const newPassword = this.generatePassword();
            
            await this.database.ref(`ceScheduleV2/initialUsers/${userId}`).update({
                tempPassword: newPassword,
                isInitial: true
            });
            
            console.log('パスワードリセット完了:', userId);
            return newPassword;
            
        } catch (error) {
            console.error('パスワードリセットエラー:', error);
            throw new Error('パスワードリセットに失敗しました');
        }
    }

    setCurrentAdmin(admin) {
        this.currentAdmin = admin;
        console.log('管理者設定:', admin);
    }
}

console.log('AdminUserManager スクリプト読み込み完了');

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdminManager);
} else {
    setTimeout(initializeAdminManager, 100);
}

async function initializeAdminManager() {
    try {
        console.log('AdminUserManager初期化開始...');
        const manager = new AdminUserManager();
        await manager.waitForInitialization();
        console.log('AdminUserManager準備完了');
        
        if (window.adminUserManager) {
            console.log('グローバルadminUserManager設定完了');
        } else {
            console.error('グローバルadminUserManager設定失敗');
        }
        
    } catch (error) {
        console.error('AdminUserManager初期化失敗:', error);
    }
}
