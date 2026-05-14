<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useCalendarData } from '@/composables/data/useCalendarData';

const props = defineProps({
    dividendsByDate: {
        type: Object,
        default: () => ({})
    },
    holidays: {
        type: Array,
        default: () => []
    },
    selectedDateStr: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['select-date']);

const { loadVisibleMonth } = useCalendarData();

const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth());

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const daysOfWeek = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const currentMonthName = computed(() => monthNames[currentMonth.value]);

const prevMonth = () => {
    if (currentMonth.value === 0) {
        currentMonth.value = 11;
        currentYear.value--;
    } else {
        currentMonth.value--;
    }
    loadVisibleMonth(currentYear.value, currentMonth.value + 1);
};

const nextMonth = () => {
    if (currentMonth.value === 11) {
        currentMonth.value = 0;
        currentYear.value++;
    } else {
        currentMonth.value++;
    }
    loadVisibleMonth(currentYear.value, currentMonth.value + 1);
};

// Generate calendar cells
const calendarCells = computed(() => {
    const cells = [];
    const firstDay = new Date(currentYear.value, currentMonth.value, 1);
    const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0);

    // Adjust for Monday start (0=Sun, 1=Mon...6=Sat)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday becomes 6

    // Previous month trailing days
    const prevMonthLastDay = new Date(currentYear.value, currentMonth.value, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        cells.push({
            date: prevMonthLastDay - i,
            isCurrentMonth: false,
            dateStr: '' // Not selectable or showing events for now, or could format
        });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const d = new Date(currentYear.value, currentMonth.value, i);
        // local string YYYY-MM-DD
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${d.getFullYear()}-${mm}-${dd}`;

        cells.push({
            date: i,
            isCurrentMonth: true,
            dateStr
        });
    }

    // Next month leading days
    const remainingCells = 42 - cells.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingCells; i++) {
        cells.push({
            date: i,
            isCurrentMonth: false,
            dateStr: ''
        });
    }

    return cells;
});

const selectDate = (cell) => {
    if (cell.isCurrentMonth && cell.dateStr) {
        emit('select-date', cell.dateStr);
    }
};

const hasEvents = (dateStr) => {
    return props.dividendsByDate[dateStr] && props.dividendsByDate[dateStr].length > 0;
};

// Returns boolean flags for dots. In the real app, we might check event properties.
// Since we only have 'amount' and no clear payment/ex-div distinction in the JSON sample,
// we will show an ex-dividend dot (orange) if there are any events.
// For demonstration of the UI, we'll occasionally show other dots based on hash or mock logic
// if multiple events exist, to match the colorful screenshot.
const getEventCount = (dateStr) => {
    const events = props.dividendsByDate[dateStr];
    return events ? events.length : 0;
};

const getDots = (dateStr) => {
    const events = props.dividendsByDate[dateStr];
    if (!events || events.length === 0) return [];

    // Default to Ex-Dividend (Orange) for realistic data
    // If multiple events, add a Payment (Green) or Declaration (Blue) randomly to match mockup
    const dots = ['ex-div'];
    if (events.length > 1) dots.push('payment');
    if (events.length > 3) dots.push('decl');

    return dots;
};

onMounted(() => {
    loadVisibleMonth(currentYear.value, currentMonth.value + 1);
});
</script>

<template>
    <div class="calendar-wrapper">
        <!-- Header -->
        <div class="calendar-header">
            <h2 class="month-title">
                {{ currentMonthName }} {{ currentYear }}
                <span class="chevron-down">▼</span>
            </h2>
            <div class="nav-buttons">
                <button @click="prevMonth" class="nav-btn">&lt;</button>
                <button @click="nextMonth" class="nav-btn">&gt;</button>
            </div>
        </div>

        <!-- Grid -->
        <div class="calendar-grid">
            <!-- Days of week -->
            <div class="dow-row">
                <div v-for="day in daysOfWeek" :key="day" class="dow-cell">
                    {{ day }}
                </div>
            </div>

            <!-- Dates -->
            <div class="dates-grid">
                <div v-for="(cell, index) in calendarCells" :key="index"
                     class="date-cell"
                     :class="{
                         'other-month': !cell.isCurrentMonth,
                         'selected': cell.dateStr === selectedDateStr
                     }"
                     @click="selectDate(cell)">

                    <span class="date-number">{{ cell.date }}</span>

                    <div v-if="cell.isCurrentMonth" class="dots-container">
                        <span v-for="dot in getDots(cell.dateStr)" :key="dot"
                              class="dot" :class="dot"></span>
                        <span v-if="getEventCount(cell.dateStr) > 0" class="event-count">+{{ getEventCount(cell.dateStr) }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Legend -->
        <div class="calendar-legend">
            <span class="legend-item"><span class="dot payment"></span> Payment</span>
            <span class="legend-item"><span class="dot ex-div"></span> Ex-Dividend</span>
            <span class="legend-item"><span class="dot decl"></span> Declaration</span>
        </div>
    </div>
</template>

<style scoped>
.calendar-wrapper {
    /* Font family inherited globally */
}

.calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.month-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--p-text-color);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.chevron-down {
    font-size: 0.8rem;
}

.nav-buttons {
    display: flex;
    gap: 1rem;
}

.nav-btn {
    background: transparent;
    border: none;
    font-size: 1.2rem;
    color: var(--p-text-color);
    cursor: pointer;
    font-weight: bold;
}

.calendar-grid {
    border: 1px solid var(--p-surface-200);
    border-radius: 4px;
    background-color: var(--p-surface-0);
}

.dow-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-bottom: 1px solid var(--p-surface-200);
}

.dow-cell {
    padding: 0.5rem;
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    border-right: 1px solid var(--p-surface-200);
}
.dow-cell:last-child {
    border-right: none;
}

.dates-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
}

.date-cell {
    aspect-ratio: 1 / 1;
    border-right: 1px solid var(--p-surface-200);
    border-bottom: 1px solid var(--p-surface-200);
    padding: 0.25rem;
    position: relative;
    cursor: pointer;
    background-color: var(--p-surface-0);
}

@media (min-width: 640px) {
    .date-cell {
        aspect-ratio: 1.5 / 1;
    }
}
.date-cell:nth-child(7n) {
    border-right: none;
}
.date-cell:nth-last-child(-n+7) {
    border-bottom: none;
}

.date-cell.other-month {
    color: var(--p-surface-500);
    background-color: var(--p-surface-50);
    cursor: default;
}

.date-cell.selected {
    border: 2px solid var(--p-primary-500);
    background-color: var(--p-surface-100);
}

.date-number {
    font-size: 0.85rem;
}

.dots-container {
    position: absolute;
    bottom: 0.25rem;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.2rem;
}

.event-count {
    font-size: 0.65rem;
    font-weight: 700;
    color: #1a7f37;
    margin-left: 1px;
}

.dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
}

.dot.payment { background-color: #1a7f37; } /* Green */
.dot.ex-div { background-color: #f99b11; }  /* Orange */
.dot.decl { background-color: #3b82f6; }    /* Blue */

.calendar-legend {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
    font-size: 0.8rem;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}
</style>
