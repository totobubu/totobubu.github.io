<!-- stock/src/components/CalendarGrid.vue -->
<template>
    <div class="calendar-wrapper">
        <!-- FullCalendar 컴포넌트에 ref를 연결합니다. -->
        <FullCalendar ref="fullCalendar" :options="calendarOptions" />
    </div>
</template>

<script setup>

import { ref, computed, watch } from 'vue';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import googleCalendarPlugin from '@fullcalendar/google-calendar';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';

const props = defineProps({
    dividendsByDate: Object
});

const fullCalendar = ref(null);
const GOOGLE_API_KEY = 'AIzaSyCm6nxVU3g-Pjj3mhq7gnwexjiVRuXCs7g'; // 실제 키로 교체 필요

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
const getTickerColor = (ticker) => {
    if (!tickerColors.has(ticker)) {
        const colorIndex = tickerColors.size % colorPalette.length;
        tickerColors.set(ticker, colorPalette[colorIndex]);
    }
    return tickerColors.get(ticker);
};

const calendarOptions = ref({
    plugins: [dayGridPlugin, listPlugin, googleCalendarPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    locale: koLocale,
    headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,dayGridWeek,listYear'
    },
    eventSources: [
        {
            events: (fetchInfo, successCallback, failureCallback) => {
                successCallback(calendarEvents.value);
            }
        },
        {
            googleCalendarId: 'en.usa#holiday@group.v.calendar.google.com',
            className: 'fc-holiday',
            color: '#A30000',
            textColor: 'white'
        }
    ],
    googleCalendarApiKey: GOOGLE_API_KEY,
    weekends: true,
    
    // 👇 [핵심 수정] eventContent 함수에 amount 존재 여부 확인 로직 추가
    eventContent: (arg) => {
        if (arg.event.source?.googleCalendarId) {
            return; 
        }
        
        const ticker = arg.event.extendedProps.ticker;
        const amount = arg.event.extendedProps.amount;

        // amount가 존재하고 유효한 숫자인 경우에만 금액을 표시합니다.
        const amountHtml = (typeof amount === 'number' && !isNaN(amount))
            ? `<span>$${amount.toFixed(4)}</span>`
            : ''; // amount가 없으면 빈 문자열

        return {
            html: `
                <div class="custom-event-tag" style="border-left-color: ${arg.event.borderColor}">
                    <strong>${ticker}</strong>
                    ${amountHtml}
                </div>
            `
        };
    }
});

watch(() => props.dividendsByDate, () => {
    fullCalendar.value?.getApi().refetchEvents();
}, { deep: true });
</script>

<style>
/* 
  scoped를 사용하지 않아야 FullCalendar 내부 요소에 스타일을 적용할 수 있습니다. 
  필요하다면 상위 컴포넌트에서 이 컴포넌트를 감싸는 클래스를 추가하여 범위를 제한할 수 있습니다.
*/
.calendar-wrapper {
    height: 90vh; /* 캘린더의 높이를 지정해주는 것이 좋습니다. */
}

/* 미국 휴일 이벤트의 기본 스타일 */
.fc-holiday .fc-event-main {
    font-style: italic;
}

/* 우리의 커스텀 배당 이벤트 태그 스타일 */
.custom-event-tag {
    padding: 2px 4px;
    border-radius: 4px;
    background-color: transparent; /* 배경색은 borderColor가 대신함 */
    color: var(--p-text-color); /* 테마의 텍스트 색상 사용 */
    font-size: 0.75rem;
    border-left: 3px solid; /* 테두리 색으로 구분 */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>