// Firebase CDN版（完全対応）
let app, auth, database;

// Initialize Firebase when config is loaded
function initializeFirebase() {
    if (window.firebaseConfig) {
        try {
            app = firebase.initializeApp(window.firebaseConfig);
            auth = firebase.auth();
            database = firebase.database();
            console.log('Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('Firebase initialization error:', error);
            return false;
        }
    } else {
        console.error('Firebase config not loaded');
        return false;
    }
}

// DOM elements
let createUserBtn, usernameInput, emailInput, roleSelect, statusDiv, userTableBody;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase first
    const firebaseReady = initializeFirebase();
    
    // Get DOM elements
    createUserBtn = document.getElementById('createUserBtn');
    usernameInput = document.getElementById('username');
    emailInput = document.getElementById('email');
    roleSelect = document.getElementById('role');
    statusDiv = document.getElementById('status');
    userTableBody = document.getElementById('userTableBody');

    // Event listeners
    if (createUserBtn) {
        createUserBtn.addEventListener('click', createUser);
    }
    
    // Wait for Firebase initialization before calling other functions
    if (firebaseReady) {
        setTimeout(() => {
            loadUsers();
            checkAdminAuth();
        }, 1000);
    }
});

// Check if current user is admin
function checkAdminAuth() {
    if (!auth) {
        console.error('Firebase auth not initialized');
        return;
    }
    
    // CDN版のonAuthStateChanged使用
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                // CDN版のdatabase.ref()使用
                const userRef = database.ref(`ceScheduleV2/users/${user.uid}`);
                const snapshot = await userRef.once('value');
                
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    if (userData.role !== 'admin') {
                        showStatus('管理者権限が必要です', 'error');
                        setTimeout(() => {
                            window.location.href = '../index.html';
                        }, 2000);
                        return;
                    }
                    console.log('Admin authentication successful');
                } else {
                    showStatus('ユーザーデータが見つかりません', 'error');
                    setTimeout(() => {
                        window.location.href = '../index.html';
                    }, 2000);
                    return;
                }
            } catch (error) {
                console.error('管理者認証エラー:', error);
                showStatus('認証エラーが発生しました', 'error');
            }
        } else {
            showStatus('ログインが必要です', 'error');
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 2000);
        }
    });
}

// Generate secure password
function generateSecurePassword() {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    
    // Ensure at least one character from each required set
    password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)]; // Uppercase
    password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]; // Lowercase
    password += "0123456789"[Math.floor(Math.random() * 10)]; // Number
    password += "!@#$%^&*"[Math.floor(Math.random() * 8)]; // Special
    
    // Fill remaining characters
    for (let i = 4; i < length; i++) {
        password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => 0.5 - Math.random()).join('');
}

// Validate password strength
function validatePassword(password) {
    if (password.length < 8) {
        return { valid: false, message: 'パスワードは8文字以上である必要があります' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'パスワードには大文字を含む必要があります' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'パスワードには小文字を含む必要があります' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'パスワードには数字を含む必要があります' };
    }
    return { valid: true };
}

// Create user function
async function createUser() {
    if (!auth || !database) {
        showStatus('Firebase が初期化されていません', 'error');
        return;
    }

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const role = roleSelect.value;

    // Validation
    if (!username || !email || !role) {
        showStatus('すべての項目を入力してください', 'error');
        return;
    }

    if (!validateEmail(email)) {
        showStatus('有効なメールアドレスを入力してください', 'error');
        return;
    }

    if (!validateUsername(username)) {
        showStatus('ユーザー名は3文字以上20文字以下で、英数字、ひらがな、カタカナ、漢字のみ使用可能です', 'error');
        return;
    }

    createUserBtn.disabled = true;
    showStatus('ユーザーを作成中...', 'info');

    try {
        // CDN版のdatabase.ref()を使用してユーザー名の重複チェック
        const usernameRef = database.ref(`ceScheduleV2/usernames/${username}`);
        const usernameSnapshot = await usernameRef.once('value');
        
        if (usernameSnapshot.exists()) {
            showStatus('このユーザー名は既に使用されています', 'error');
            createUserBtn.disabled = false;
            return;
        }

        // Generate secure password
        const password = generateSecurePassword();
        const passwordValidation = validatePassword(password);
        
        if (!passwordValidation.valid) {
            showStatus(`パスワードエラー: ${passwordValidation.message}`, 'error');
            createUserBtn.disabled = false;
            return;
        }

        // CDN版のcreateUserWithEmailAndPasswordを使用
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;

        // Prepare user data
        const userData = {
            uid: uid,
            username: username,
            email: email,
            role: role,
            isInitialUser: true,
            hasCompletedSetup: false,
            createdAt: new Date().toISOString(),
            createdBy: auth.currentUser?.uid || 'system'
        };

        // CDN版のdatabase.ref().set()を使用してデータを保存
        await Promise.all([
            database.ref(`ceScheduleV2/users/${uid}`).set(userData),
            database.ref(`ceScheduleV2/usernames/${username}`).set(uid),
            database.ref(`ceScheduleV2/initialUsers/${uid}`).set({
                username: username,
                tempPassword: password,
                created: new Date().toISOString()
            })
        ]);

        // Show success message with password
        showStatus(`ユーザーが正常に作成されました！<br><br>
            <strong>ユーザー名:</strong> ${username}<br>
            <strong>メール:</strong> ${email}<br>
            <strong>権限:</strong> ${role}<br>
            <strong>仮パスワード:</strong> <code>${password}</code><br><br>
            <em>※このパスワードを新規ユーザーに安全に伝達してください</em>`, 'success');

        // Clear form
        usernameInput.value = '';
        emailInput.value = '';
        roleSelect.value = '';

        // Reload user list
        loadUsers();

    } catch (error) {
        console.error('ユーザー作成エラー:', error);
        
        let errorMessage = 'ユーザー作成に失敗しました';
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'このメールアドレスは既に使用されています';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = '無効なメールアドレスです';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'パスワードが弱すぎます';
        } else if (error.code === 'permission-denied') {
            errorMessage = 'データベースへの書き込み権限がありません';
        }
        
        showStatus(errorMessage, 'error');
    } finally {
        createUserBtn.disabled = false;
    }
}

// Load and display users
async function loadUsers() {
    if (!database) {
        console.error('Database not initialized');
        return;
    }

    try {
        // CDN版のdatabase.ref()を使用
        const usersRef = database.ref('ceScheduleV2/users');
        const snapshot = await usersRef.once('value');
        
        if (!userTableBody) {
            console.error('User table body not found');
            return;
        }
        
        userTableBody.innerHTML = '';
        
        if (snapshot.exists()) {
            const users = snapshot.val();
            
            Object.entries(users).forEach(([uid, userData]) => {
                const row = document.createElement('tr');
                
                const statusBadge = userData.hasCompletedSetup 
                    ? '<span class="status-badge status-active">設定完了</span>' 
                    : '<span class="status-badge status-pending">初期状態</span>';
                
                const roleBadge = getRoleBadge(userData.role);
                
                row.innerHTML = `
                    <td>${userData.username || 'N/A'}</td>
                    <td>${userData.email || 'N/A'}</td>
                    <td>${roleBadge}</td>
                    <td>${statusBadge}</td>
                    <td>${formatDate(userData.createdAt)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="editUser('${uid}')">編集</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteUser('${uid}', '${userData.username}')">削除</button>
                    </td>
                `;
                
                userTableBody.appendChild(row);
            });
        } else {
            userTableBody.innerHTML = '<tr><td colspan="6" class="text-center">ユーザーが見つかりません</td></tr>';
        }
    } catch (error) {
        console.error('ユーザーロードエラー:', error);
        showStatus('ユーザーの読み込みに失敗しました', 'error');
    }
}

// Get role badge HTML
function getRoleBadge(role) {
    const badges = {
        admin: '<span class="role-badge role-admin">管理者</span>',
        editor: '<span class="role-badge role-editor">編集者</span>',
        viewer: '<span class="role-badge role-viewer">閲覧者</span>'
    };
    return badges[role] || '<span class="role-badge">不明</span>';
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'N/A';
    }
}

// Edit user function (placeholder)
window.editUser = function(uid) {
    showStatus('ユーザー編集機能は開発中です', 'info');
};

// Delete user function
window.deleteUser = async function(uid, username) {
    if (!confirm(`ユーザー「${username}」を削除しますか？\n\nこの操作は取り消せません。`)) {
        return;
    }

    try {
        showStatus('ユーザーを削除中...', 'info');

        // CDN版のdatabase.ref()を使用
        const userRef = database.ref(`ceScheduleV2/users/${uid}`);
        const userSnapshot = await userRef.once('value');
        
        if (!userSnapshot.exists()) {
            showStatus('ユーザーが見つかりません', 'error');
            return;
        }

        const userData = userSnapshot.val();

        // CDN版のdatabase.ref().remove()を使用
        await Promise.all([
            database.ref(`ceScheduleV2/users/${uid}`).remove(),
            database.ref(`ceScheduleV2/usernames/${userData.username}`).remove(),
            database.ref(`ceScheduleV2/initialUsers/${uid}`).remove()
        ]);

        showStatus(`ユーザー「${username}」が削除されました`, 'success');
        loadUsers();

    } catch (error) {
        console.error('ユーザー削除エラー:', error);
        showStatus('ユーザーの削除に失敗しました', 'error');
    }
};

// Validation functions
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validateUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9ひらがなカタカナ漢字\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{3,20}$/;
    return usernameRegex.test(username);
}

// Show status message
function showStatus(message, type) {
    if (!statusDiv) return;
    
    statusDiv.innerHTML = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 8000);
    }
}
