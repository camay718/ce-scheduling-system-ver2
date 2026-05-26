/**
 * スケジュール管理コア - Firebase統合版（パフォーマンス最適化・安全版）
 */
(function() {
    'use strict';

    class ScheduleCore {
        constructor() {
            this.database = window.database;
            this.dataRoot = window.DATA_ROOT;
            this.events = {};

            // 1インスタンス1監視前提
            this.currentListener = null;
            this.currentMonthKey = null;

            // デバウンス
            this.updateTimer = null;
            this.updateDelay = 150;
            this.lastCallback = null;
            this.hasPendingForegroundRefresh = false;

            // ページ復帰イベント購読
            this.handleResume = this.handleResume.bind(this);
            window.addEventListener('app:resumed', this.handleResume);

            this.init();
        }

        async init() {
            if (!this.database || !this.dataRoot) {
                console.error('❌ Firebase未初期化');
                return;
            }
            console.log('📊 スケジュールコア初期化完了');
        }

        // ページ復帰時に保留中のcallbackを実行
        handleResume() {
            if (this.hasPendingForegroundRefresh && this.lastCallback) {
                this.hasPendingForegroundRefresh = false;
                this.lastCallback(this.events);
                console.log('🔄 復帰時の再描画実行');
            }
        }

        // 月間データの監視開始
        listenToMonth(year, month, callback) {
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            this.lastCallback = callback;

            // 既存リスナーを安全に解除
            this.removeCurrentListener();

            const startDate = `${monthKey}-01`;
            const endDate = `${monthKey}-31`;
            
            const ref = this.database.ref(`${this.dataRoot}/events/byDate`)
                .orderByKey()
                .startAt(startDate)
                .endAt(endDate);

            const handler = (snapshot) => {
                const data = snapshot.val() || {};

                // ★ この月のキャッシュを先にクリア（削除済み日付の残留防止）
                Object.keys(this.events).forEach(dateKey => {
                    if (dateKey.startsWith(monthKey + '-')) {
                        delete this.events[dateKey];
                    }
                });

                // 最新snapshotで再構築
                Object.keys(data).forEach(dateKey => {
                    const dayEvents = data[dateKey];
                    this.events[dateKey] = Object.keys(dayEvents || {}).map(eventId => ({
                        id: eventId,
                        ...dayEvents[eventId]
                    }));
                });

                // 非表示中は描画保留（復帰時に handleResume が処理）
                if (document.visibilityState !== 'visible') {
                    this.hasPendingForegroundRefresh = true;
                    return;
                }

                // デバウンス（150ms以内の連続更新を束ねる）
                if (this.updateTimer) {
                    clearTimeout(this.updateTimer);
                }

                this.updateTimer = setTimeout(() => {
                    this.updateTimer = null;
                    if (this.lastCallback) {
                        this.lastCallback(this.events);
                    }
                }, this.updateDelay);
            };

            ref.on('value', handler);

            // ★ handler を保持して、解除時はそれだけ外す（安全な解除）
            this.currentListener = { ref, handler };
            this.currentMonthKey = monthKey;

            console.log(`📊 ${monthKey} 監視開始`);
        }

        removeCurrentListener() {
            if (this.currentListener) {
                this.currentListener.ref.off('value', this.currentListener.handler);
                this.currentListener = null;
                this.currentMonthKey = null;
            }
            if (this.updateTimer) {
                clearTimeout(this.updateTimer);
                this.updateTimer = null;
            }
        }

        getEventsByDate(dateKey) {
            return this.events[dateKey] || [];
        }

        async addEvent(eventData) {
            try {
                if (!eventData.date || !eventData.name) {
                    throw new Error('日付と業務名は必須です');
                }
                const eventRef = this.database.ref(`${this.dataRoot}/events/byDate/${eventData.date}`).push();
                const newEvent = {
                    ...eventData,
                    createdAt: Date.now(),
                    createdBy: window.currentUserData?.displayName || 'unknown',
                    assignments: eventData.assignments || []
                };
                await eventRef.set(newEvent);
                console.log('✅ イベント追加成功:', eventData.name);
                return eventRef.key;
            } catch (error) {
                console.error('❌ イベント追加エラー:', error);
                throw error;
            }
        }

        async updateEvent(dateKey, eventId, updateData) {
            try {
                const updatePayload = {
                    ...updateData,
                    updatedAt: Date.now(),
                    updatedBy: window.currentUserData?.displayName || 'unknown'
                };
                await this.database.ref(`${this.dataRoot}/events/byDate/${dateKey}/${eventId}`).update(updatePayload);
                console.log('✅ イベント更新成功:', eventId);
            } catch (error) {
                console.error('❌ イベント更新エラー:', error);
                throw error;
            }
        }

        async deleteEvent(dateKey, eventId) {
            try {
                await this.database.ref(`${this.dataRoot}/events/byDate/${dateKey}/${eventId}`).remove();
                console.log('✅ イベント削除成功:', eventId);
            } catch (error) {
                console.error('❌ イベント削除エラー:', error);
                throw error;
            }
        }

        destroy() {
            this.removeCurrentListener();
            window.removeEventListener('app:resumed', this.handleResume);
            console.log('📊 スケジュールコア破棄完了');
        }
    }

    window.ScheduleCore = ScheduleCore;
    console.log('📊 スケジュールコア読み込み完了（最適化・安全版）');
})();
