// v2/js/admin/admin-user-management.js (修正版)
class AdminUserManager {
    constructor() {
        this.database = firebase.database();
        this.auth = firebase.auth();
        this.init();
    }

    init() {
        // Firebase認証状態の確認
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('✅ 管理者認証済み:', user.uid);
                this.loadUsers();
            } else {
                console.log('❌ 未認証 - 管理者ログインが必要');
                window.location.href = '../index.html';
            }
        });

        // フォーム送信イベント
        const form = document.getElementById('createUserForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createInitialUser();
            });
        }
    }

    // 🔧 修正: 初期ユーザー作成ロジック
async createInitialUser() {
    const username = document.getElementById('username').value.trim();
    const permission = document.getElementById('permission').value;
    
    // 🆕 部門取得（Editorの場合のみ）
    let department = null;
    if (permission === 'editor') {
        department = document.getElementById('department').value.trim();
        if (!department) {
            alert('Editorの場合は所属部門を入力してください');
            return;
        }
    }
    
    console.log('🔍 ユーザー作成開始:', {username, permission, department});
    
    if (!username || !permission) {
        alert('ユーザー名（氏名）と権限を入力してください');
        return;
    }

    try {
        // 🔍 Firebase Database 接続テスト
        console.log('📡 Firebase Database接続テスト...');
        const testRef = this.database.ref('ceScheduleV2');
        await testRef.once('value');
        console.log('✅ Database接続OK');

        // 1. ユーザー名重複チェック（initialUsers で確認）
        console.log('🔍 重複チェック中...');
        const existingInitial = await this.database.ref(`ceScheduleV2/initialUsers/${username}`).once('value');
        const existingUsername = await this.database.ref(`ceScheduleV2/usernames/${username}`).once('value');
        
        if (existingInitial.exists() || existingUsername.exists()) {
            alert('このユーザー名（氏名）は既に使用されています');
            return;
        }
        console.log('✅ ユーザー名利用可能');

        // 2. 一時パスワード生成（8文字、覚えやすい形式）
        const tempPassword = this.generateTempPassword();
        console.log('🔑 一時パスワード生成:', tempPassword);
        
        // 3. 🆕 ユーザーデータ構造（V2形式）
        const userData = {
            username: username,        // 氏名
            tempPassword: tempPassword,
            permission: permission,
            department: department,    // EditorのみでなくViewerはnull
            isInitial: true,          // 初期設定待ち
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastLogin: null,
            loginCount: 0
        };

        console.log('💾 保存データ:', userData);

        // 4. 🚨 段階的保存（エラー箇所特定のため）
        console.log('📝 Step 1: initialUsers テーブルに保存中...');
        await this.database.ref(`ceScheduleV2/initialUsers/${username}`).set(userData);
        console.log('✅ initialUsers 保存完了');

        console.log('📝 Step 2: usernames テーブルに保存中...');
        await this.database.ref(`ceScheduleV2/usernames/${username}`).set({
            status: 'initial',        // initial / active
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            permission: permission
        });
        console.log('✅ usernames 保存完了');
        
        console.log('🎉 ユーザー作成完全成功:', username);
        
        // UI更新
        this.showTempPassword(username, tempPassword);
        this.loadUsers();
        document.getElementById('createUserForm').reset();
        
    } catch (error) {
        console.error('❌ 詳細エラー情報:');
        console.error('- エラー:', error);
        console.error('- エラーコード:', error.code);
        console.error('- エラーメッセージ:', error.message);
        console.error('- エラースタック:', error.stack);
        
        alert(`❌ ユーザー作成エラー:\n${error.message}\n\n📋 コンソールログで詳細を確認してください`);
    }
}

// 🔧 一時パスワード生成の改良版（覚えやすい形式）
generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 混同文字除外
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

    showTempPassword(username, tempPassword) {
        const resultDiv = document.getElementById('tempPasswordResult');
        resultDiv.innerHTML = `
            <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <h4 class="font-bold">✅ ユーザー作成完了</h4>
                <p><strong>ユーザー名:</strong> ${username}</p>
                <p><strong>一時パスワード:</strong> <code class="bg-gray-200 px-2 py-1 rounded">${tempPassword}</code></p>
                <p class="text-sm mt-2">※ このパスワードをユーザーに伝えてください</p>
            </div>
        `;
        resultDiv.style.display = 'block';
    }

    // パスワードリセット機能
    async resetPassword(identifier) {
        if (!confirm(`${identifier} のパスワードをリセットしますか？`)) return;
        
        try {
            const newTempPassword = this.generateTempPassword();
            
            // initialUsers テーブルを更新
            await this.database.ref(`ceScheduleV2/initialUsers/${identifier}`).update({
                tempPassword: newTempPassword,
                isInitial: true // リセット時は初期状態に戻す
            });
            
            alert(`パスワードリセット完了\n新しい一時パスワード: ${newTempPassword}`);
            this.loadUsers();
            
        } catch (error) {
            console.error('❌ パスワードリセットエラー:', error);
            alert('パスワードリセットに失敗しました');
        }
    }

    // ユーザー削除機能
    async deleteUser(identifier) {
        if (!confirm(`${identifier} を削除しますか？この操作は取り消せません。`)) return;
        
        try {
            const updates = {};
            updates[`ceScheduleV2/initialUsers/${identifier}`] = null;
            updates[`ceScheduleV2/usernames/${identifier}`] = null;
            
            await this.database.ref().update(updates);
            
            alert('ユーザーを削除しました');
            this.loadUsers();
            
        } catch (error) {
            console.error('❌ ユーザー削除エラー:', error);
            alert('ユーザー削除に失敗しました');
        }
    }
}

// グローバルインスタンス作成
let adminManager;
document.addEventListener('DOMContentLoaded', () => {
    adminManager = new AdminUserManager();
});
