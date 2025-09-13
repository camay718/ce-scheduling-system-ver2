// 📄 js/data-manager.js - データベース操作の統一管理
import { database } from './firebase-config.js';
import { Utils } from './utils.js';

export class DataManager {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5分間キャッシュ
    }

    // キャッシュ管理
    setCache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    getCache(key) {
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }

    // 最適化されたスケジュール取得
    async getSchedulesByDateRange(startDate, endDate, useCache = true) {
        const cacheKey = `schedules_${startDate}_${endDate}`;
        
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            Utils.showLoading(true, 'スケジュールを読み込み中...');
            
            const snapshot = await database.ref('schedules')
                .orderByChild('date')
                .startAt(startDate)
                .endAt(endDate)
                .limitToFirst(100) // パフォーマンス向上
                .once('value');
            
            const schedules = snapshot.val() || {};
            this.setCache(cacheKey, schedules);
            
            return schedules;
        } catch (error) {
            Utils.showMessage('スケジュールの読み込みに失敗しました', 'error');
            throw error;
        } finally {
            Utils.showLoading(false);
        }
    }

    // 最適化されたユーザー取得
    async getUsersByRole(role = null, useCache = true) {
        const cacheKey = `users_${role || 'all'}`;
        
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            let query = database.ref('users');
            
            if (role) {
                query = query.orderByChild('role').equalTo(role);
            }
            
            const snapshot = await query.once('value');
            const users = snapshot.val() || {};
            
            this.setCache(cacheKey, users);
            return users;
        } catch (error) {
            Utils.showMessage('ユーザー情報の取得に失敗しました', 'error');
            throw error;
        }
    }

    // 効率的なCE取得
    async getCEList(useCache = true) {
        const cacheKey = 'ce_list';
        
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            const snapshot = await database.ref('ces')
                .orderByChild('isActive')
                .equalTo(true)
                .once('value');
            
            const ceList = snapshot.val() || {};
            this.setCache(cacheKey, ceList);
            
            return ceList;
        } catch (error) {
            Utils.showMessage('CE情報の取得に失敗しました', 'error');
            throw error;
        }
    }

    // バッチ更新機能
    async batchUpdate(updates) {
        try {
            Utils.showLoading(true, '一括更新中...');
            
            await database.ref().update(updates);
            
            // 関連キャッシュをクリア
            this.cache.clear();
            
            Utils.showMessage('一括更新が完了しました', 'success');
        } catch (error) {
            Utils.showMessage('一括更新に失敗しました', 'error');
            throw error;
        } finally {
            Utils.showLoading(false);
        }
    }
}
