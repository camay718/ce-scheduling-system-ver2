// 📄 js/utils.js - 共通ユーティリティ関数
export const Utils = {
    // 統一されたメッセージ表示
    showMessage: function(message, type = 'info', duration = 3000) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type} fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg`;
        
        const bgColors = {
            success: 'bg-green-100 border-green-500 text-green-700',
            error: 'bg-red-100 border-red-500 text-red-700',
            warning: 'bg-yellow-100 border-yellow-500 text-yellow-700',
            info: 'bg-blue-100 border-blue-500 text-blue-700'
        };
        
        messageDiv.className += ` ${bgColors[type]}`;
        messageDiv.innerHTML = `
            <div class="flex items-center">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-lg">&times;</button>
            </div>
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, duration);
    },

    // 統一されたローディング表示
    showLoading: function(show = true, message = '処理中...') {
        let loadingDiv = document.getElementById('global-loading');
        
        if (show) {
            if (!loadingDiv) {
                loadingDiv = document.createElement('div');
                loadingDiv.id = 'global-loading';
                loadingDiv.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                loadingDiv.innerHTML = `
                    <div class="bg-white p-6 rounded-lg shadow-lg text-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p class="text-gray-700">${message}</p>
                    </div>
                `;
                document.body.appendChild(loadingDiv);
            }
        } else {
            if (loadingDiv) {
                loadingDiv.remove();
            }
        }
    },

    // 統一された日付フォーマット
    formatDate: function(date, format = 'YYYY-MM-DD') {
        if (!date) return '';
        
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
        
        switch(format) {
            case 'YYYY-MM-DD':
                return `${year}-${month}-${day}`;
            case 'MM/DD':
                return `${month}/${day}`;
            case 'YYYY年MM月DD日':
                return `${year}年${month}月${day}日`;
            case 'MM/DD(曜日)':
                return `${month}/${day}(${dayOfWeek})`;
            default:
                return `${year}-${month}-${day}`;
        }
    },

    // バリデーション機能
    validation: {
        required: function(value, fieldName) {
            if (!value || value.toString().trim() === '') {
                throw new Error(`${fieldName}は必須項目です`);
            }
            return true;
        },

        email: function(value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                throw new Error('有効なメールアドレスを入力してください');
            }
            return true;
        },

        dateRange: function(startDate, endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (start > end) {
                throw new Error('開始日は終了日より前の日付を選択してください');
            }
            return true;
        }
    },

    // 権限チェック
    hasPermission: function(userRole, requiredRole) {
        const roleHierarchy = { admin: 3, editor: 2, viewer: 1 };
        return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
    }
};
