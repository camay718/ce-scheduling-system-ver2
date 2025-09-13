// 📄 js/utils.js - 共通ユーティリティ関数
export const Utils = {
    // 統一されたメッセージ表示
    showMessage: function(message, type = 'info', duration = 3000) {
        // 既存のメッセージを削除
        const existingMessage = document.querySelector('.utils-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `utils-message fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm`;
        
        const bgColors = {
            success: 'bg-green-100 border-green-500 text-green-700 border-l-4',
            error: 'bg-red-100 border-red-500 text-red-700 border-l-4',
            warning: 'bg-yellow-100 border-yellow-500 text-yellow-700 border-l-4',
            info: 'bg-blue-100 border-blue-500 text-blue-700 border-l-4'
        };
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-triangle',
            warning: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle'
        };
        
        messageDiv.className += ` ${bgColors[type]}`;
        messageDiv.innerHTML = `
            <div class="flex items-center">
                <i class="${icons[type]} mr-2"></i>
                <span class="flex-1">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" 
                        class="ml-3 text-lg hover:opacity-70 focus:outline-none">
                    &times;
                </button>
            </div>
        `;
        
        document.body.appendChild(messageDiv);
        
        // 自動削除
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.opacity = '0';
                messageDiv.style.transform = 'translateX(100%)';
                setTimeout(() => messageDiv.remove(), 300);
            }
        }, duration);
    },

    // 統一されたローディング表示
    showLoading: function(show = true, message = '処理中...') {
        let loadingDiv = document.getElementById('utils-loading');
        
        if (show) {
            if (!loadingDiv) {
                loadingDiv = document.createElement('div');
                loadingDiv.id = 'utils-loading';
                loadingDiv.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                loadingDiv.innerHTML = `
                    <div class="bg-white p-6 rounded-lg shadow-xl text-center min-w-[200px]">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p class="text-gray-700 font-medium">${message}</p>
                    </div>
                `;
                document.body.appendChild(loadingDiv);
            } else {
                // メッセージ更新
                const messageEl = loadingDiv.querySelector('p');
                if (messageEl) messageEl.textContent = message;
            }
            loadingDiv.style.display = 'flex';
        } else {
            if (loadingDiv) {
                loadingDiv.style.display = 'none';
            }
        }
    },

    // 統一された日付フォーマット
    formatDate: function(date, format = 'YYYY-MM-DD') {
        if (!date) return '';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
        
        switch(format) {
            case 'YYYY-MM-DD':
                return `${year}-${month}-${day}`;
            case 'YYYY/MM/DD':
                return `${year}/${month}/${day}`;
            case 'MM/DD':
                return `${month}/${day}`;
            case 'YYYY年MM月DD日':
                return `${year}年${month}月${day}日`;
            case 'MM/DD(曜日)':
                return `${month}/${day}(${dayOfWeek})`;
            case 'YYYY-MM-DD HH:mm':
                return `${year}-${month}-${day} ${hours}:${minutes}`;
            case 'YYYY年MM月DD日 HH:mm':
                return `${year}年${month}月${day}日 ${hours}:${minutes}`;
            case 'HH:mm:ss':
                return `${hours}:${minutes}:${seconds}`;
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

        minLength: function(value, minLength, fieldName) {
            if (value.length < minLength) {
                throw new Error(`${fieldName}は${minLength}文字以上で入力してください`);
            }
            return true;
        },

        maxLength: function(value, maxLength, fieldName) {
            if (value.length > maxLength) {
                throw new Error(`${fieldName}は${maxLength}文字以内で入力してください`);
            }
            return true;
        },

        dateRange: function(startDate, endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw new Error('有効な日付を入力してください');
            }
            if (start > end) {
                throw new Error('開始日は終了日より前の日付を選択してください');
            }
            return true;
        },

        phoneNumber: function(value) {
            const phoneRegex = /^[\d\-\+\(\)\s]+$/;
            if (!phoneRegex.test(value)) {
                throw new Error('有効な電話番号を入力してください');
            }
            return true;
        }
    },

    // 権限チェック
    hasPermission: function(userRole, requiredRole) {
        const roleHierarchy = { 
            admin: 3, 
            editor: 2, 
            viewer: 1 
        };
        const userLevel = roleHierarchy[userRole] || 0;
        const requiredLevel = roleHierarchy[requiredRole] || 0;
        return userLevel >= requiredLevel;
    },

    // 文字列操作
    sanitizeHtml: function(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    truncateText: function(text, maxLength = 100) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    },

    // 数値フォーマット
    formatNumber: function(num, decimals = 0) {
        if (isNaN(num)) return '0';
        return Number(num).toLocaleString('ja-JP', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    // URL操作
    getUrlParameter: function(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    },

    setUrlParameter: function(name, value) {
        const url = new URL(window.location);
        url.searchParams.set(name, value);
        window.history.pushState({}, '', url);
    },

    // ローカルストレージ操作
    storage: {
        set: function(key, value, expireMinutes = null) {
            const data = {
                value: value,
                timestamp: Date.now(),
                expire: expireMinutes ? Date.now() + (expireMinutes * 60 * 1000) : null
            };
            localStorage.setItem(key, JSON.stringify(data));
        },

        get: function(key) {
            try {
                const stored = localStorage.getItem(key);
                if (!stored) return null;
                
                const data = JSON.parse(stored);
                
                // 有効期限チェック
                if (data.expire && Date.now() > data.expire) {
                    localStorage.removeItem(key);
                    return null;
                }
                
                return data.value;
            } catch (error) {
                console.error('Storage get error:', error);
                return null;
            }
        },

        remove: function(key) {
            localStorage.removeItem(key);
        },

        clear: function() {
            localStorage.clear();
        }
    },

    // デバウンス関数
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // スロットル関数
    throttle: function(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // 深いオブジェクトコピー
    deepClone: function(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const copy = {};
            Object.keys(obj).forEach(key => {
                copy[key] = this.deepClone(obj[key]);
            });
            return copy;
        }
    }
};

// デフォルトエクスポート（後方互換性）
export default Utils;
