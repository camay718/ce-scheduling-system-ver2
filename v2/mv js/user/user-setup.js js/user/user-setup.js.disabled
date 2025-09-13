class UserSetupSystem {
    constructor() {
        this.database = null;
        this.auth = null;
        this.isInitialized = false;
        this.currentInitialUser = null;
        this.init();
    }

    async init() {
        console.log('👤 ユーザー設定システム初期化中...');
        
        // Firebase準備待機
        await this.waitForFirebase();
        
        try {
            this.database = firebase.database();
            this.auth = firebase.auth();
            this.isInitialized = true;
            
            console.log('✅ ユーザー設定システム準備完了');
            
        } catch (error) {
            console.error('❌ ユーザー設定システム初期化エラー:', error);
        }
    }

    async waitForFirebase() {
        let attempts = 0;
        while (attempts < 100 && (!window.firebase || !window.firebase.apps || window.firebase.apps.length === 0)) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
    }

    // 🔧 修正: URLパラメータから初期ユーザー情報取得
    getInitialUserFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const initialUser = urlParams.get('initialUser');
        
        if (initialUser) {
            this.currentInitialUser = decodeURIComponent(initialUser);
            console.log('✅ 初期ユーザー特定:', this.currentInitialUser);
            return this.currentInitialUser;
        }
        
        console.log('❌ 初期ユーザー情報が見つかりません');
        return null;
    }

    // 🆕 氏名（全角）対応のユーザー名バリデーション
    validateUsername(username) {
        console.log('🔍 ユーザー名バリデーション:', username);
        
        if (!username || username.length < 2 || username.length > 30) {
            return { valid: false, message: 'ユーザー名は2文字以上30文字以下で入力してください' };
        }
        
        // 🆕 日本語（ひらがな、カタカナ、漢字）、英数字、スペース、ハイフン、アンダースコアを許可
        const validCharsRegex = /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBFa-zA-Z0-9\s\-_]+$/;
        
        if (!validCharsRegex.test(username)) {
            return { valid: false, message: 'ユーザー名に使用できない文字が含まれています' };
        }
        
        console.log('✅ ユーザー名バリデーション通過');
        return { valid: true };
    }

    // 🔧 修正: ユーザー名重複チェック（直接データベースアクセス）
    async checkUsernameAvailability(username) {
        console.log('🔍 ユーザー名重複チェック:', username);
        
        try {
            // バリデーション
            const validation = this.validateUsername(username);
            if (!validation.valid) {
                return { available: false, message: validation.message };
            }
            
            // 1. initialUsers テーブルをチェック
            const initialUserSnapshot = await this.database
                .ref(`ceScheduleV2/initialUsers/${username}`)
                .once('value');
                
            if (initialUserSnapshot.exists()) {
                // 現在の初期ユーザーと同じ場合は OK
                if (username === this.currentInitialUser) {
                    console.log('✅ 現在のユーザー自身のため利用可能');
                    return { available: true };
                }
                console.log('❌ ユーザー名は既に初期ユーザーとして使用中');
                return { available: false, message: 'このユーザー名は既に使用されています' };
            }
            
            // 2. usernames テーブルをチェック
            const usernameSnapshot = await this.database
                .ref(`ceScheduleV2/usernames/${username}`)
                .once('value');
                
            if (usernameSnapshot.exists()) {
                console.log('❌ ユーザー名は既に使用中');
                return { available: false, message: 'このユーザー名は既に使用されています' };
            }
            
            console.log('✅ ユーザー名は利用可能');
            return { available: true };
            
        } catch (error) {
            console.error('❌ ユーザー名チェックエラー:', error);
            return { available: false, message: 'ユーザー名の確認に失敗しました' };
        }
    }

    // パスワードバリデーション
    validatePassword(password, confirmPassword) {
        if (!password || password.length < 6) {
            return { valid: false, message: 'パスワードは6文字以上で入力してください' };
        }
        
        if (password !== confirmPassword) {
            return { valid: false, message: 'パスワードが一致しません' };
        }
        
        return { valid: true };
    }

    // Emailバリデーション
    validateEmail(email) {
        if (!email) {
            return { valid: true }; // Email は任意
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, message: 'メールアドレスの形式が正しくありません' };
        }
        
        return { valid: true };
    }

    // 🔧 修正: ユーザー設定完了処理
    async completeUserSetup(setupData) {
        console.log('👤 ユーザー設定完了処理開始:', setupData);
        
        try {
            if (!this.currentInitialUser) {
                throw new Error('初期ユーザー情報が設定されていません');
            }
            
            // 1. 初期ユーザーデータ取得
            const initialUserSnapshot = await this.database
                .ref(`ceScheduleV2/initialUsers/${this.currentInitialUser}`)
                .once('value');
                
            if (!initialUserSnapshot.exists()) {
                throw new Error('初期ユーザーデータが見つかりません');
            }
            
            const initialUserData = initialUserSnapshot.val();
            console.log('✅ 初期ユーザーデータ取得:', initialUserData);
            
            // 2. Firebase Authentication でユーザー作成
            console.log('🔐 Firebase Authentication ユーザー作成中...');
            const userCredential = await this.auth.createUserWithEmailAndPassword(
                setupData.email || `${setupData.username}@temp.local`,
                setupData.password
            );
            
            const user = userCredential.user;
            console.log('✅ Firebase ユーザー作成完了:', user.uid);
            
            // 3. 新しいユーザーデータ作成
            const newUserData = {
                uid: user.uid,
                username: setupData.username,
                displayName: initialUserData.username, // 管理者が設定した氏名
                email: setupData.email || null,
                department: initialUserData.department || null,
                permission: initialUserData.permission,
                role: initialUserData.permission, // 互換性のため
                isInitial: false,
                setupCompleted: true,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastLogin: firebase.database.ServerValue.TIMESTAMP,
                loginCount: 1
            };
            
            console.log('💾 新しいユーザーデータ:', newUserData);
            
            // 4. データベース更新（トランザクション）
            const updates = {};
            
            // A. users テーブルに追加
            updates[`ceScheduleV2/users/${user.uid}`] = newUserData;
            
            // B. usernames テーブルを更新
            updates[`ceScheduleV2/usernames/${setupData.username}`] = {
                uid: user.uid,
                status: 'active',
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };
            
            // C. initialUsers から削除
            updates[`ceScheduleV2/initialUsers/${this.currentInitialUser}`] = null;
            
            // 5. 原子的更新実行
            console.log('📝 データベース更新中...');
            await this.database.ref().update(updates);
            console.log('✅ データベース更新完了');
            
            // 6. プロフィール更新
            if (user.updateProfile) {
                await user.updateProfile({
                    displayName: setupData.username
                });
                console.log('✅ Firebase プロフィール更新完了');
            }
            
            console.log('🎉 ユーザー設定完了成功');
            
            return {
                success: true,
                uid: user.uid,
                username: setupData.username,
                message: 'ユーザー設定が完了しました'
            };
            
        } catch (error) {
            console.error('❌ ユーザー設定完了エラー:', error);
            throw new Error(`設定完了処理に失敗: ${error.message}`);
        }
    }

    // UI更新メソッド
    showMessage(text, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type} px-4 py-2 mb-4 rounded-md`;
        
        const colors = {
            success: 'bg-green-100 text-green-800 border border-green-300',
            error: 'bg-red-100 text-red-800 border border-red-300',
            warning: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
            info: 'bg-blue-100 text-blue-800 border border-blue-300'
        };
        
        messageDiv.className += ` ${colors[type]}`;
        messageDiv.textContent = text;
        
        const container = document.querySelector('.setup-container') || document.body;
        container.insertBefore(messageDiv, container.firstChild);
        
        setTimeout(() => messageDiv.remove(), 5000);
    }

    // 成功画面表示
    showSuccessScreen(userData) {
        const container = document.querySelector('.setup-container');
        if (container) {
            container.innerHTML = `
                <div class="success-screen text-center">
                    <div class="success-icon mb-6">
                        <i class="fas fa-check-circle text-6xl text-green-500"></i>
                    </div>
                    <h2 class="text-2xl font-bold mb-4 text-green-800">設定完了！</h2>
                    <div class="success-details bg-green-50 p-6 rounded-lg mb-6">
                        <p class="mb-2"><strong>ユーザー名:</strong> ${userData.username}</p>
                        <p class="mb-2"><strong>氏名:</strong> ${userData.displayName || this.currentInitialUser}</p>
                        <p class="text-sm text-green-600">アカウントの設定が完了しました。</p>
                    </div>
                    <div class="redirect-info p-4 bg-blue-50 rounded-lg mb-6">
                        <p class="text-blue-800">3秒後に自動的にログイン画面に戻ります...</p>
                    </div>
                </div>
            `;
            
            // 3秒後にリダイレクト
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 3000);
        }
    }
}

// グローバル変数
let userSetupSystem = null;

// ページ初期化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        userSetupSystem = new UserSetupSystem();
        window.userSetupSystem = userSetupSystem;
        
        // 初期ユーザー情報取得
        const initialUser = userSetupSystem.getInitialUserFromURL();
        
        if (!initialUser) {
            alert('初期ユーザー情報が見つかりません。ログイン画面に戻ります。');
            window.location.href = '../index.html';
            return;
        }
        
        // フォーム送信イベント
        const setupForm = document.getElementById('userSetupForm');
        if (setupForm) {
            setupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await handleUserSetup();
            });
        }
        
        // リアルタイムバリデーション
        const usernameInput = document.getElementById('setupUsername');
        if (usernameInput) {
            usernameInput.addEventListener('input', async (e) => {
                const username = e.target.value.trim();
                if (username.length >= 2) {
                    const result = await userSetupSystem.checkUsernameAvailability(username);
                    const feedback = document.getElementById('usernameFeedback');
                    if (feedback) {
                        if (result.available) {
                            feedback.textContent = '✅ 利用可能です';
                            feedback.className = 'text-green-600 text-sm mt-1';
                        } else {
                            feedback.textContent = result.message || '❌ 利用できません';
                            feedback.className = 'text-red-600 text-sm mt-1';
                        }
                    }
                }
            });
        }
        
        console.log('✅ ユーザー設定画面初期化完了');
        
    } catch (error) {
        console.error('❌ ユーザー設定画面初期化失敗:', error);
    }
});

// フォーム送信処理
async function handleUserSetup() {
    const submitButton = document.getElementById('setupButton');
    submitButton.disabled = true;
    submitButton.textContent = '設定中...';
    
    try {
        // フォームデータ取得
        const setupData = {
            username: document.getElementById('setupUsername').value.trim(),
            password: document.getElementById('setupPassword').value,
            passwordConfirm: document.getElementById('setupPasswordConfirm').value,
            email: document.getElementById('setupEmail').value.trim()
        };
        
        console.log('📝 設定データ:', { ...setupData, password: '[HIDDEN]', passwordConfirm: '[HIDDEN]' });
        
        // バリデーション
        const usernameValidation = userSetupSystem.validateUsername(setupData.username);
        if (!usernameValidation.valid) {
            throw new Error(usernameValidation.message);
        }
        
        const passwordValidation = userSetupSystem.validatePassword(setupData.password, setupData.passwordConfirm);
        if (!passwordValidation.valid) {
            throw new Error(passwordValidation.message);
        }
        
        const emailValidation = userSetupSystem.validateEmail(setupData.email);
        if (!emailValidation.valid) {
            throw new Error(emailValidation.message);
        }
        
        // ユーザー名重複チェック
        const availabilityCheck = await userSetupSystem.checkUsernameAvailability(setupData.username);
        if (!availabilityCheck.available) {
            throw new Error(availabilityCheck.message);
        }
        
        // 設定完了処理
        const result = await userSetupSystem.completeUserSetup(setupData);
        
        if (result.success) {
            userSetupSystem.showSuccessScreen(result);
        }
        
    } catch (error) {
        console.error('❌ ユーザー設定エラー:', error);
        userSetupSystem.showMessage(error.message, 'error');
        
        submitButton.disabled = false;
        submitButton.textContent = '設定完了';
    }
}

console.log('👤 ユーザー設定システム読み込み完了');
