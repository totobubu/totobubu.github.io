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
    holidays: Array,
    allTickers: Array
});

const fullCalendar = ref(null);

// 👇 [핵심 수정 1] frequency에 따른 CSS 클래스 이름을 반환하는 함수
const getFrequencyClass = (tickerSymbol) => {
    if (!props.allTickers) return 'freq-default';
    const tickerInfo = props.allTickers.find(t => t.symbol === tickerSymbol);
    const frequency = tickerInfo?.frequency;
    
    switch (frequency) {
        case 'Weekly': return 'freq-weekly';
        case 'Monthly': return 'freq-monthly';
        case 'Quarterly': return 'freq-quarterly';
        case 'Every 4 Week': return 'freq-every-4-week';
        default: return 'freq-default';
    }
};

const calendarEvents = computed(() => {
    if (!props.dividendsByDate) return [];
    
    return Object.entries(props.dividendsByDate).flatMap(([date, data]) => {
        return data.entries.map(entry => ({
            title: entry.amount ? `${entry.ticker} $${entry.amount.toFixed(4)}` : entry.ticker,
            start: date,
            extendedProps: {
                ticker: entry.ticker,
                amount: entry.amount,
                // 이벤트 객체에 클래스 이름을 미리 담아둡니다.
                frequencyClass: getFrequencyClass(entry.ticker)
            },
            // backgroundColor와 borderColor는 이제 CSS가 담당하므로 제거합니다.
        }));
    });
});

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
    eventSources: [
        { events: (fetchInfo, successCallback) => successCallback(calendarEvents.value) },
        { events: (fetchInfo, successCallback) => successCallback(holidayEvents.value) }
    ],
    weekends: false,
    
    // 👇 [핵심 수정 2] eventContent가 이제 동적 클래스를 포함한 HTML을 반환합니다.
    eventContent: (arg) => {
        if (arg.event.extendedProps.isHoliday) {
            return { html: `<div class="fc-holiday-name">${arg.event.title}</div>` };
        }
        
        const ticker = arg.event.extendedProps.ticker;
        const amount = arg.event.extendedProps.amount;
        const frequencyClass = arg.event.extendedProps.frequencyClass; // 저장해둔 클래스 이름 가져오기
        
        const amountHtml = (amount !== null && typeof amount === 'number' && !isNaN(amount))
            ? `<span>$${amount.toFixed(4)}</span>`
            : '<span class="no-amount">예정</span>';

        return {
            html: `
                <div class="p-tag p-component ${frequencyClass}">
                    <strong>${ticker}</strong>
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
