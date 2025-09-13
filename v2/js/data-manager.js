// 📄 js/data-manager.js - データベース操作の統一管理
export class DataManager {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5分間キャッシュ
        this.maxCacheSize = 100; // 最大キャッシュ数
        this.requestQueue = new Map(); // 重複リクエスト防止
    }

    // キャッシュ管理
    setCache(key, data) {
        // キャッシュサイズ制限
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        // タイムアウトチェック
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    clearCache(pattern = null) {
        if (!pattern) {
            this.cache.clear();
            return;
        }

        // パターンマッチングでキャッシュクリア
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
    }

    // 重複リクエスト防止
    async executeOnce(key, asyncFunction) {
        if (this.requestQueue.has(key)) {
            return await this.requestQueue.get(key);
        }

        const promise = asyncFunction();
        this.requestQueue.set(key, promise);

        try {
            const result = await promise;
            return result;
        } finally {
            this.requestQueue.delete(key);
        }
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

        const requestKey = `getSchedules_${startDate}_${endDate}`;
        return await this.executeOnce(requestKey, async () => {
            try {
                if (window.Utils) {
                    window.Utils.showLoading(true, 'スケジュールを読み込み中...');
                }
                
                const snapshot = await window.database.ref(`${window.DATA_ROOT}/schedules`)
                    .orderByChild('date')
                    .startAt(startDate)
                    .endAt(endDate)
                    .limitToFirst(200) // パフォーマンス向上
                    .once('value');
                
                const schedules = snapshot.val() || {};
                
                if (useCache) {
                    this.setCache(cacheKey, schedules);
                }
                
                return schedules;
            } catch (error) {
                console.error('❌ スケジュール取得エラー:', error);
                if (window.Utils) {
                    window.Utils.showMessage('スケジュールの読み込みに失敗しました', 'error');
                }
                throw error;
            } finally {
                if (window.Utils) {
                    window.Utils.showLoading(false);
                }
            }
        });
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

        const requestKey = `getUsers_${role || 'all'}`;
        return await this.executeOnce(requestKey, async () => {
            try {
                let query = window.database.ref(`${window.DATA_ROOT}/users`);
                
                if (role) {
                    query = query.orderByChild('role').equalTo(role);
                }
                
                const snapshot = await query.once('value');
                const users = snapshot.val() || {};
                
                if (useCache) {
                    this.setCache(cacheKey, users);
                }
                
                return users;
            } catch (error) {
                console.error('❌ ユーザー取得エラー:', error);
                if (window.Utils) {
                    window.Utils.showMessage('ユーザー情報の取得に失敗しました', 'error');
                }
                throw error;
            }
        });
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

        const requestKey = 'getCEList';
        return await this.executeOnce(requestKey, async () => {
            try {
                const snapshot = await window.database.ref(`${window.DATA_ROOT}/ces`)
                    .orderByChild('isActive')
                    .equalTo(true)
                    .once('value');
                
                const ceList = snapshot.val() || {};
                
                if (useCache) {
                    this.setCache(cacheKey, ceList);
                }
                
                return ceList;
            } catch (error) {
                console.error('❌ CE情報取得エラー:', error);
                if (window.Utils) {
                    window.Utils.showMessage('CE情報の取得に失敗しました', 'error');
                }
                throw error;
            }
        });
    }

    // イベント・業務データ取得
    async getEventsByDateRange(startDate, endDate, department = null, useCache = true) {
        const cacheKey = `events_${startDate}_${endDate}_${department || 'all'}`;
        
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            let query = window.database.ref(`${window.DATA_ROOT}/events`)
                .orderByChild('date')
                .startAt(startDate)
                .endAt(endDate);
            
            const snapshot = await query.once('value');
            let events = snapshot.val() || {};
            
            // 部門フィルタリング
            if (department) {
                const filteredEvents = {};
                Object.keys(events).forEach(key => {
                    if (events[key].department === department) {
                        filteredEvents[key] = events[key];
                    }
                });
                events = filteredEvents;
            }
            
            if (useCache) {
                this.setCache(cacheKey, events);
            }
            
            return events;
        } catch (error) {
            console.error('❌ イベント取得エラー:', error);
            throw error;
        }
    }

    // バッチ更新機能
    async batchUpdate(updates) {
        if (!updates || Object.keys(updates).length === 0) {
            console.warn('⚠️ 空のバッチ更新が実行されました');
            return;
        }

        try {
            if (window.Utils) {
                window.Utils.showLoading(true, 'データを更新中...');
            }
            
            // Firebase バッチ更新実行
            await window.database.ref().update(updates);
            
            // 関連キャッシュをクリア
            this.clearCacheByUpdates(updates);
            
            if (window.Utils) {
                window.Utils.showMessage('データを更新しました', 'success');
            }
            
            console.log('✅ バッチ更新完了:', Object.keys(updates).length, '件');
        } catch (error) {
            console.error('❌ バッチ更新エラー:', error);
            if (window.Utils) {
                window.Utils.showMessage('データの更新に失敗しました', 'error');
            }
            throw error;
        } finally {
            if (window.Utils) {
                window.Utils.showLoading(false);
            }
        }
    }

    // 更新内容に基づいてキャッシュクリア
    clearCacheByUpdates(updates) {
        const paths = Object.keys(updates);
        
        paths.forEach(path => {
            if (path.includes('/users/')) {
                this.clearCache('users');
            } else if (path.includes('/schedules/')) {
                this.clearCache('schedules');
            } else if (path.includes('/ces/')) {
                this.clearCache('ce_list');
            } else if (path.includes('/events/')) {
                this.clearCache('events');
            } else if (path.includes('/workSchedules/')) {
                this.clearCache('workSchedule');
            }
        });
    }

    // リアルタイムリスナー管理
    setupRealtimeListener(path, callback, errorCallback = null) {
        const ref = window.database.ref(`${window.DATA_ROOT}/${path}`);
        
        ref.on('value', 
            (snapshot) => {
                const data = snapshot.val();
                // キャッシュ更新
                this.clearCache(path.split('/')[0]);
                callback(data);
            },
            (error) => {
                console.error(`❌ リアルタイムリスナーエラー (${path}):`, error);
                if (errorCallback) {
                    errorCallback(error);
                } else if (window.Utils) {
                    window.Utils.showMessage('リアルタイム更新でエラーが発生しました', 'error');
                }
            }
        );
        
        return ref;
    }

    // リスナー削除
    removeRealtimeListener(ref) {
        if (ref && ref.off) {
            ref.off();
        }
    }

    // データ存在確認
    async exists(path) {
        try {
            const snapshot = await window.database.ref(`${window.DATA_ROOT}/${path}`).once('value');
            return snapshot.exists();
        } catch (error) {
            console.error('❌ 存在確認エラー:', error);
            return false;
        }
    }

    // データ削除
    async deleteData(path) {
        try {
            if (window.Utils) {
                window.Utils.showLoading(true, 'データを削除中...');
            }

            await window.database.ref(`${window.DATA_ROOT}/${path}`).remove();
            
            // キャッシュクリア
            this.clearCache(path.split('/')[0]);
            
            if (window.Utils) {
                window.Utils.showMessage('データを削除しました', 'success');
            }
        } catch (error) {
            console.error('❌ データ削除エラー:', error);
            if (window.Utils) {
                window.Utils.showMessage('データの削除に失敗しました', 'error');
            }
            throw error;
        } finally {
            if (window.Utils) {
                window.Utils.showLoading(false);
            }
        }
    }

    // トランザクション実行
    async transaction(path, updateFunction) {
        try {
            const result = await window.database.ref(`${window.DATA_ROOT}/${path}`).transaction(updateFunction);
            
            // キャッシュクリア
            this.clearCache(path.split('/')[0]);
            
            return result;
        } catch (error) {
            console.error('❌ トランザクションエラー:', error);
            throw error;
        }
    }

    // 統計情報取得
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            keys: Array.from(this.cache.keys()),
            hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
        };
    }

    // デバッグ用：キャッシュ内容表示
    debugCache() {
        console.group('🗄️ DataManager キャッシュ状況');
        console.log('サイズ:', this.cache.size);
        console.log('アクティブキュー:', this.requestQueue.size);
        
        this.cache.forEach((value, key) => {
            const age = Date.now() - value.timestamp;
            const ageMinutes = Math.floor(age / 60000);
            console.log(`${key}: ${ageMinutes}分前`);
        });
        
        console.groupEnd();
    }
}

// デフォルトエクスポート
export default DataManager;
