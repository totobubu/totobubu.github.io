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
import Tag from "primevue/tag";

const props = defineProps({
    dividendsByDate: Object,
    holidays: Array // 1. holidays prop을 받습니다.
});

const fullCalendar = ref(null);

const frequencyColors = {
    'Weekly': '#42A5F5',       // Blue
    'Monthly': '#66BB6A',      // Green
    'Quarterly': '#FFA726',    // Orange
    'Every 4 Week': '#AB47BC', // Purple
    'default': '#757575'       // 기본값 (Gray)
};

const getFrequencyColor = (tickerSymbol) => {
    if (!props.allTickers) return frequencyColors['default'];
    // allTickers 배열에서 해당 티커를 찾아 frequency를 가져옵니다.
    const tickerInfo = props.allTickers.find(t => t.symbol === tickerSymbol);
    const frequency = tickerInfo?.frequency;
    return frequencyColors[frequency] || frequencyColors['default'];
};

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
            backgroundColor: getFrequencyColor(entry.ticker),
            borderColor: getFrequencyColor(entry.ticker)
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
        if (arg.event.extendedProps.isHoliday) {
            return { html: `<div class="fc-holiday-name">${arg.event.title}</div>` };
        }
        
        const ticker = arg.event.extendedProps.ticker;
        const amount = arg.event.extendedProps.amount;
        const amountHtml = (amount !== null && typeof amount === 'number' && !isNaN(amount))
            ? `<span>$${amount.toFixed(4)}</span>`
            : '<span class="no-amount">예정</span>';

        return {
            html: `
                <div class="p-tag p-component" style="background-color: ${arg.event.backgroundColor}; color: #ffffff;">
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
