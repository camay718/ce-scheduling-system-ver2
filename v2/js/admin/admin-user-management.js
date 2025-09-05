// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, ref, set, get, remove, push, child, query, orderByChild, equalTo } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCQqsqxxqxELBURGc8pF_OqFLQDm69RJP4",
    authDomain: "ce-schedule-management.firebaseapp.com",
    databaseURL: "https://ce-schedule-management-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ce-schedule-management",
    storageBucket: "ce-schedule-management.firebasestorage.app",
    messagingSenderId: "998140589230",
    appId: "1:998140589230:web:6c8159f7c1242cd5aeb4d0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// DOM elements
let createUserBtn, usernameInput, emailInput, roleSelect, statusDiv, userTableBody;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    createUserBtn = document.getElementById('createUserBtn');
    usernameInput = document.getElementById('username');
    emailInput = document.getElementById('email');
    roleSelect = document.getElementById('role');
    statusDiv = document.getElementById('status');
    userTableBody = document.getElementById('userTableBody');

    // Event listeners
    createUserBtn.addEventListener('click', createUser);
    
    // Load existing users
    loadUsers();
    
    // Check authentication
    checkAdminAuth();
});

// Check if current user is admin
function checkAdminAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userRef = ref(database, `ceScheduleV2/users/${user.uid}`);
                const snapshot = await get(userRef);
                
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    if (userData.role !== 'admin') {
                        showStatus('管理者権限が必要です', 'error');
                        setTimeout(() => {
                            window.location.href = '../index.html';
                        }, 2000);
                        return;
                    }
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
        // Check if username already exists
        const usernameRef = ref(database, `ceScheduleV2/usernames/${username}`);
        const usernameSnapshot = await get(usernameRef);
        
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

        // Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
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

        // Save to Firebase Database
        await Promise.all([
            set(ref(database, `ceScheduleV2/users/${uid}`), userData),
            set(ref(database, `ceScheduleV2/usernames/${username}`), uid),
            set(ref(database, `ceScheduleV2/initialUsers/${uid}`), {
                username: username,
                tempPassword: password,  // Store temporarily for admin reference
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
        roleSelect.value = 'viewer';

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
        
        // Cleanup on failure - remove from Firebase Auth if Database save failed
        if (error.message.includes('Database') && auth.currentUser) {
            try {
                await auth.currentUser.delete();
                console.log('Firebase Authからユーザーを削除しました（ロールバック）');
            } catch (cleanupError) {
                console.error('ロールバック失敗:', cleanupError);
            }
        }
    } finally {
        createUserBtn.disabled = false;
    }
}

// Load and display users
async function loadUsers() {
    try {
        const usersRef = ref(database, 'ceScheduleV2/users');
        const snapshot = await get(usersRef);
        
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
    // TODO: Implement user editing functionality
    showStatus('ユーザー編集機能は開発中です', 'info');
};

// Delete user function
window.deleteUser = async function(uid, username) {
    if (!confirm(`ユーザー「${username}」を削除しますか？\n\nこの操作は取り消せません。`)) {
        return;
    }

    try {
        showStatus('ユーザーを削除中...', 'info');

        // Get user data first
        const userRef = ref(database, `ceScheduleV2/users/${uid}`);
        const userSnapshot = await get(userRef);
        
        if (!userSnapshot.exists()) {
            showStatus('ユーザーが見つかりません', 'error');
            return;
        }

        const userData = userSnapshot.val();

        // Remove from all database locations
        await Promise.all([
            remove(ref(database, `ceScheduleV2/users/${uid}`)),
            remove(ref(database, `ceScheduleV2/usernames/${userData.username}`)),
            remove(ref(database, `ceScheduleV2/initialUsers/${uid}`))
        ]);

        showStatus(`ユーザー「${username}」が削除されました`, 'success');
        
        // Reload user list
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
    // Allow alphanumeric, hiragana, katakana, kanji (3-20 characters)
    const usernameRegex = /^[a-zA-Z0-9ひらがなカタカナ漢字\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{3,20}$/;
    return usernameRegex.test(username);
}

// Show status message
function showStatus(message, type) {
    statusDiv.innerHTML = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 8000);
    }
}

// Export for global access
window.createUser = createUser;
window.loadUsers = loadUsers;
