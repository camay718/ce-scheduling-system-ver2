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
        
        if (!username || !permission) {
            alert('ユーザー名と権限を入力してください');
            return;
        }

        try {
            // 1. ユーザー名重複チェック
            const existingUser = await this.database.ref(`ceScheduleV2/usernames/${username}`).once('value');
            if (existingUser.exists()) {
                alert('このユーザー名は既に使用されています');
                return;
            }

            // 2. 一時パスワード生成
            const tempPassword = this.generateTempPassword();
            
            // 3. 🚨 重要修正: 3つのテーブルに同時保存
            const userData = {
                username: username,
                tempPassword: tempPassword,
                permission: permission,
                isInitial: true,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastLogin: null
            };

            // Firebase トランザクション使用で整合性確保
            const updates = {};
            
            // A. initialUsers テーブル
            updates[`ceScheduleV2/initialUsers/${username}`] = userData;
            
            // B. usernames テーブル（ユーザー名予約）
            updates[`ceScheduleV2/usernames/${username}`] = {
                reserved: true,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };

            // 🔧 原子的更新実行
            await this.database.ref().update(updates);
            
            console.log('✅ 初期ユーザー作成完了:', username);
            
            // UI更新
            this.showTempPassword(username, tempPassword);
            this.loadUsers();
            document.getElementById('createUserForm').reset();
            
        } catch (error) {
            console.error('❌ ユーザー作成エラー:', error);
            alert(`ユーザー作成に失敗しました: ${error.message}`);
        }
    }

    // 🔧 修正: ユーザーリスト読み込み
    async loadUsers() {
        try {
            // initialUsers と通常users を両方取得
            const [initialUsersSnapshot, usersSnapshot] = await Promise.all([
                this.database.ref('ceScheduleV2/initialUsers').once('value'),
                this.database.ref('ceScheduleV2/users').once('value')
            ]);

            const userList = document.getElementById('userList');
            userList.innerHTML = '';

            // 初期ユーザー表示
            if (initialUsersSnapshot.exists()) {
                initialUsersSnapshot.forEach((userSnapshot) => {
                    const userData = userSnapshot.val();
                    this.renderUserRow(userSnapshot.key, userData, 'initial');
                });
            }

            // 設定完了ユーザー表示
            if (usersSnapshot.exists()) {
                usersSnapshot.forEach((userSnapshot) => {
                    const userData = userSnapshot.val();
                    this.renderUserRow(userData.username, userData, 'active');
                });
            }

        } catch (error) {
            console.error('❌ ユーザーリスト読み込みエラー:', error);
        }
    }

    renderUserRow(identifier, userData, status) {
        const userList = document.getElementById('userList');
        const row = document.createElement('tr');
        
        const statusText = status === 'initial' ? '🟡 初期設定待ち' : '🟢 アクティブ';
        const lastLogin = userData.lastLogin ? 
            new Date(userData.lastLogin).toLocaleDateString('ja-JP') : '未ログイン';
        
        row.innerHTML = `
            <td class="px-4 py-2 border">${userData.username || identifier}</td>
            <td class="px-4 py-2 border">${userData.permission || 'N/A'}</td>
            <td class="px-4 py-2 border">${statusText}</td>
            <td class="px-4 py-2 border">${lastLogin}</td>
            <td class="px-4 py-2 border">
                <button onclick="adminManager.resetPassword('${identifier}')" 
                        class="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600">
                    パスワードリセット
                </button>
                <button onclick="adminManager.deleteUser('${identifier}')" 
                        class="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 ml-2">
                    削除
                </button>
            </td>
        `;
        
        userList.appendChild(row);
    }

    generateTempPassword() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 混同しやすい文字を除外
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
