/**
 * 日付処理ユーティリティ V2統合版
 * V1機能 + 月間カレンダー対応
 */
// ========= 基本日付処理（V1継承） =========
function formatDateISO(date) {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatMonthYear(date) {
    if (!date) return '';
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return `${year}年${month}月`;
}

function isSameDay(date1, date2) {
    if (!date1 || !date2) return false;
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

function getToday() {
    return new Date();
}

function isToday(date) {
    return isSameDay(date, getToday());
}

function timeToMinutes(timeString) {
    if (!timeString || !/^\d{1,2}:\d{2}$/.test(timeString)) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

// ========= 月間カレンダー専用処理（V2新機能） =========
function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

function generateCalendarDates(year, month) {
    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay(); // 0=日曜日
    const daysInMonth = getDaysInMonth(year, month);
    const dates = [];
    
    // 前月の日付を追加
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
    
    for (let i = startWeekday - 1; i >= 0; i--) {
        dates.push({
            date: new Date(prevYear, prevMonth - 1, daysInPrevMonth - i),
            isCurrentMonth: false,
            isPrevMonth: true,
            isNextMonth: false
        });
    }
    
    // 当月の日付を追加
    for (let day = 1; day <= daysInMonth; day++) {
        dates.push({
            date: new Date(year, month - 1, day),
            isCurrentMonth: true,
            isPrevMonth: false,
            isNextMonth: false
        });
    }
    
    // 翌月の日付を追加（合計42日になるまで）
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    let nextDay = 1;
    while (dates.length < 42) {
        dates.push({
            date: new Date(nextYear, nextMonth - 1, nextDay),
            isCurrentMonth: false,
            isPrevMonth: false,
            isNextMonth: true
        });
        nextDay++;
    }
    
    return dates;
}

// ========= V1→V2日付変換 =========
function convertV1DayToDate(day, baseDate = new Date()) {
    const dayMap = {
        'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
        'friday': 4, 'saturday': 5, 'sunday': 6
    };
    
    const weekStart = getWeekStartDate(baseDate);
    const dayOffset = dayMap[day];
    
    if (dayOffset !== undefined) {
        const targetDate = new Date(weekStart);
        targetDate.setDate(weekStart.getDate() + dayOffset);
        return targetDate;
    }
    
    return null;
}

function getWeekStartDate(date = new Date()) {
    const dayOfWeek = date.getDay();
    const startDate = new Date(date);
    startDate.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    return startDate;
}

// ========= グローバル公開 =========
window.DateUtils = {
    formatDateISO,
    formatMonthYear,
    isSameDay,
    getToday,
    isToday,
    timeToMinutes,
    getDaysInMonth,
    generateCalendarDates,
    convertV1DayToDate,
    getWeekStartDate
};

// 後方互換性のための個別公開
window.formatDateISO = formatDateISO;
window.formatMonthYear = formatMonthYear;
window.isSameDay = isSameDay;
window.getToday = getToday;
window.isToday = isToday;
window.timeToMinutes = timeToMinutes;

console.log('📅 日付ユーティリティ読み込み完了（V2統合版）');
