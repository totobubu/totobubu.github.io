<!-- stock/src/components/CalendarGrid.vue -->
<template>
    <div class="calendar-wrapper">
        <FullCalendar ref="fullCalendar" :options="calendarOptions" />
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';

const props = defineProps({
    dividendsByDate: Object,
    holidays: Array // 1. holidays prop을 받습니다.
});

const fullCalendar = ref(null);

const calendarEvents = computed(() => {
    if (!props.dividendsByDate) return [];
    
    return Object.entries(props.dividendsByDate).flatMap(([date, data]) => {
        return data.entries.map(entry => ({
            title: entry.amount ? `${entry.ticker} $${entry.amount.toFixed(4)}` : entry.ticker,
            start: date,
            extendedProps: {
                ticker: entry.ticker,
                amount: entry.amount
            },
            borderColor: getTickerColor(entry.ticker),
        }));
    });
});

const tickerColors = new Map();
const colorPalette = ['#42A5F5', '#66BB6A', '#FFA726', '#AB47BC', '#EF5350', '#26A69A'];
const getTickerColor = (ticker) => { /* ... (이전과 동일) ... */ };

// 2. [핵심 수정] holidays prop을 FullCalendar 이벤트 형식으로 변환합니다.
const holidayEvents = computed(() => {
    if (!props.holidays) return [];
    return props.holidays.map(holiday => ({
        id: `holiday-${holiday.date}`,
        title: holiday.name,
        start: holiday.date,
        display: 'background', // 👈 이것이 배경색을 칠하는 핵심 옵션입니다.
        color: 'rgba(255, 0, 0, 0.3)', // 반투명 빨간색 배경
        extendedProps: { isHoliday: true }
    }));
});

const calendarOptions = ref({
    plugins: [dayGridPlugin, listPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    locale: koLocale,
    headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,dayGridWeek,listYear'
    },
    // 3. [핵심 수정] eventSources를 로컬 데이터 소스로 변경합니다.
    eventSources: [
        {
            events: (fetchInfo, successCallback) => successCallback(calendarEvents.value)
        },
        {
            events: (fetchInfo, successCallback) => successCallback(holidayEvents.value)
        }
    ],
    weekends: false,
    
    // 4. [핵심 수정] eventContent를 사용하여 휴일 텍스트를 렌더링합니다.
    eventContent: (arg) => {
        // 휴일일 경우, 이벤트 제목(휴일 이름)을 표시합니다.
        if (arg.event.extendedProps.isHoliday) {
            return {
                html: `<div class="fc-holiday-name">${arg.event.title}</div>`
            }
        }

        // 배당금 이벤트 렌더링 로직 (이전과 동일)
        const ticker = arg.event.extendedProps.ticker;
        const amount = arg.event.extendedProps.amount;
        const amountHtml = (typeof amount === 'number' && !isNaN(amount))
            ? `<span>$${amount.toFixed(4)}</span>` : '';
        return {
            html: `
                <div class="p-tag p-component" style="background-color: ${arg.event.borderColor}">
                    <strong>${ticker}</strong> <br/>
                    ${amountHtml}
                </div>
            `
        };
    }
});

watch(() => [props.dividendsByDate, props.holidays], () => {
    fullCalendar.value?.getApi().refetchEvents();
}, { deep: true });
</script>

<style>
.calendar-wrapper {
    height: 90vh; /* 캘린더의 높이를 지정해주는 것이 좋습니다. */
}

/* 휴일 이름 텍스트 스타일 */
.fc-holiday-name {
    position: absolute;
    top: 5px;
    right: 5px;
    font-size: 0.7em;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.7);
    padding: 2px 4px;
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
}
/* 날짜 셀이 휴일 배경 위에 오도록 z-index 조정 */
.fc .fc-daygrid-day-frame {
    position: relative;
    z-index: 2;
}
.fc .fc-daygrid-bg-event {
    z-index: 1;
}
</style>