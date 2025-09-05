/*
👤 ユーザー個人設定システム
初期ログイン後の個人設定完了処理
*/

class UserSetupSystem {
    constructor() {
        this.isInitialized = false;
        this.currentUserId = null;
        this.currentUserData = null;
        
        console.log('👤 ユーザー設定システム初期化中...');
        this.initialize();
    }

    async initialize() {
        // Firebase & 初期ログイン検知システム準備待ち
        let attempts = 0;
        while (attempts < 100 && (!window.database || !window.initialLoginDetector)) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (window.database && window.initialLoginDetector) {
            this.isInitialized = true;
            console.log('✅ ユーザー設定システム準備完了');
        } else {
            console.error('❌ 依存システム未準備 - ユーザー設定無効');
        }
    }

    // ユーザー設定データ設定
    setUserData(userId, userData) {
        this.currentUserId = userId;
        this.currentUserData = userData;
        console.log('👤 ユーザーデータ設定:', userData.profile?.displayName);
    }

    // 個人設定完了処理
    async completeUserSetup(setupData) {
        if (!this.isInitialized) {
            throw new Error('システムが初期化されていません');
        }

        if (!this.currentUserId) {
            throw new Error('ユーザーが設定されていません');
        }

        try {
            console.log('👤 個人設定完了処理開始:', setupData.username);

            // 1. ユーザー名重複チェック
            const isUsernameAvailable = await window.initialLoginDetector.checkUsernameAvailability(setupData.username);
            if (!isUsernameAvailable) {
                throw new Error('このユーザー名は既に使用されています');
            }

            // 2. パスワード強度チェック
            this.validatePassword(setupData.password);

            // 3. ユーザー名マッピング追加
            await window.database.ref(`${window.DATA_ROOT}/usernames/${setupData.username}`).set(this.currentUserId);

            // 4. ユーザーデータ更新
            const updateData = {
                'auth/username': setupData.username,
                'auth/userPassword': setupData.password,
                'auth/email': setupData.email || null,
                'auth/accountStatus': 'configured',
                'auth/passwordChangeRequired': false,
                'auth/setupCompletedAt': firebase.database.ServerValue.TIMESTAMP,
                'setupCompleted': true,
                'profile/email': setupData.email || null
            };

            await window.database.ref(`${window.DATA_ROOT}/users/${this.currentUserId}`).update(updateData);

            // 5. 初期ユーザーリストから削除
            await window.database.ref(`${window.DATA_ROOT}/initialUsers/${this.currentUserId}`).remove();

            // 6. 設定完了履歴記録
            await this.recordSetupCompletion(setupData);

            console.log('✅ 個人設定完了');

            return {
                success: true,
                message: '個人設定が完了しました！システムをご利用いただけます。',
                username: setupData.username,
                userId: this.currentUserId
            };

        } catch (error) {
            console.error('❌ 個人設定エラー:', error);
            
            // エラー時はユーザー名マッピングをクリーンアップ
            try {
                await window.database.ref(`${window.DATA_ROOT}/usernames/${setupData.username}`).remove();
            } catch (cleanupError) {
                console.warn('⚠️ ユーザー名マッピングクリーンアップ失敗:', cleanupError);
            }
            
            throw error;
        }
    }

    // パスワード強度検証
    validatePassword(password) {
        if (!password || password.length < 6) {
            throw new Error('パスワードは6文字以上で設定してください');
        }

        // 基本的な強度チェック
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);

        if (!hasLetter || !hasNumber) {
            throw new Error('パスワードは英字と数字を両方含めてください');
        }

        // 簡単なパスワードチェック
        const weakPasswords = ['password', '123456', 'qwerty', 'admin', 'user'];
        if (weakPasswords.includes(password.toLowerCase())) {
            throw new Error('より複雑なパスワードを設定してください');
        }

        return true;
    }

    // ユーザー名の有効性チェック
    validateUsername(username) {
        if (!username || username.length < 3) {
            throw new Error('ユーザー名は3文字以上で設定してください');
        }

        if (username.length > 20) {
            throw new Error('ユーザー名は20文字以下で設定してください');
        }

        // 使用可能文字チェック
        const validPattern = /^[a-zA-Z0-9_-]+$/;
        if (!validPattern.test(username)) {
            throw new Error('ユーザー名は英数字、アンダースコア、ハイフンのみ使用可能です');
        }

        // 予約語チェック
        const reservedWords = ['admin', 'system', 'root', 'user', 'guest', 'test'];
        if (reservedWords.includes(username.toLowerCase())) {
            throw new Error('この ユーザー名は予約されています');
        }

        return true;
    }

    // リアルタイムユーザー名チェック
    async checkUsernameRealtime(username) {
        if (!this.isInitialized) {
            return { valid: false, message: 'システム準備中...' };
        }

        try {
            // 基本バリデーション
            this.validateUsername(username);

            // 重複チェック
            const isAvailable = await window.initialLoginDetector.checkUsernameAvailability(username);
            
            if (!isAvailable) {
                return { valid: false, message: 'このユーザー名は既に使用されています' };
            }

            return { valid: true, message: 'このユーザー名は利用可能です' };

        } catch (error) {
            return { valid: false, message: error.message };
        }
    }

    // 設定完了履歴記録
    async recordSetupCompletion(setupData) {
        try {
            await window.database.ref(`${window.DATA_ROOT}/users/${this.currentUserId}/loginHistory`).push({
                type: 'setup_completed',
                username: setupData.username,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                userAgent: navigator.userAgent
            });

            console.log('✅ 設定完了履歴記録完了');
        } catch (error) {
            console.warn('⚠️ 設定完了履歴記録失敗:', error);
        }
    }

    // 現在のユーザーデータ取得
    getCurrentUserData() {
        return {
            userId: this.currentUserId,
            userData: this.currentUserData
        };
    }

    // 設定データのプリセット取得
    getSetupPresets() {
        if (!this.currentUserData) {
            return {};
        }

        const profile = this.currentUserData.profile || {};
        
        return {
            displayName: profile.displayName || '',
            department: profile.department || '',
            position: profile.position || '',
            suggestedUsername: this.generateSuggestedUsername(profile.displayName)
        };
    }

    // ユーザー名候補生成
    generateSuggestedUsername(displayName) {
        if (!displayName) {
            return '';
        }

        // 日本語名から英数字ユーザー名を生成する簡易ロジック
        let suggestion = '';
        
        // スペースを削除
        const cleanName = displayName.replace(/\s+/g, '');
        
        // 簡単な変換例（実際にはより複雑なロジックが必要）
        if (cleanName.length <= 10) {
            suggestion = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
        }

        // フォールバック
        if (!suggestion || suggestion.length < 3) {
            const timestamp = Date.now().toString().slice(-4);
            suggestion = `user${timestamp}`;
        }

        return suggestion;
    }

    // パスワード強度評価
    evaluatePasswordStrength(password) {
        let score = 0;
        const feedback = [];

        if (password.length >= 8) {
            score += 1;
        } else {
            feedback.push('8文字以上推奨');
        }

        if (/[a-z]/.test(password)) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^a-zA-Z0-9]/.test(password)) {
            score += 1;
            feedback.push('記号を含むとより安全');
        }

        const strength = ['弱い', '普通', '良い', '強い', '最強'][Math.min(score, 4)];
        const color = ['red', 'orange', 'yellow', 'green', 'blue'][Math.min(score, 4)];

        return {
            score: score,
            strength: strength,
            color: color,
            feedback: feedback
        };
    }
}

// グローバルインスタンス作成
if (!window.userSetupSystem) {
    window.userSetupSystem = new UserSetupSystem();
    console.log('👤 ユーザー設定システム読み込み完了');
}
