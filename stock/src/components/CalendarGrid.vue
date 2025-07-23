<!-- stock/src/components/CalendarGrid.vue -->
<template>
    <div class="calendar-wrapper">
        <div class="custom-calendar-header">
            <div class="header-left">
                <Button icon="pi pi-chevron-left" text rounded @click="prevMonth" />
                <Button icon="pi pi-chevron-right" text rounded @click="nextMonth" />
                <Button label="오늘" class="p-button-sm" @click="goToToday" />
            </div>
            <div class="header-center">
                <h2>{{ currentTitle }}</h2>
            </div>
            <div class="header-right">
                <SelectButton 
                    v-model="currentView" 
                    :options="viewOptions" 
                    optionLabel="label" 
                    optionValue="value" 
                    aria-labelledby="basic"
                />
            </div>
        </div>
        <FullCalendar ref="fullCalendar" :options="calendarOptions" />
    </div>
</template>

<script setup>
import { ref, computed, watch, defineEmits } from 'vue'; // defineEmits 추가
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';
import Button from 'primevue/button';
import SelectButton from 'primevue/selectbutton';

const props = defineProps({
    dividendsByDate: Object,
    holidays: Array,
    allTickers: Array
});

// 👇 [핵심 수정 1] 부모에게 보낼 이벤트를 정의합니다.
const emit = defineEmits(['remove-ticker']);

const fullCalendar = ref(null);
const currentTitle = ref('');
const currentView = ref('dayGridMonth');
const viewOptions = ref([
    { label: '월', value: 'dayGridMonth' },
    { label: '주', value: 'dayGridWeek' }
]);

const getFrequencyClass = (tickerSymbol) => {
    if (!props.allTickers || props.allTickers.length === 0) {
        return 'freq-default';
    }
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
                frequencyClass: getFrequencyClass(entry.ticker)
            },
        }));
    });
});

const holidayEvents = computed(() => {
    if (!props.holidays) return [];
    return props.holidays.map(holiday => ({
        id: `holiday-${holiday.date}`,
        title: holiday.name,
        start: holiday.date,
        display: 'background',
        color: 'rgba(255, 0, 0, 0.3)',
        extendedProps: { isHoliday: true }
    }));
});

const calendarOptions = ref({
    plugins: [dayGridPlugin, listPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    locale: koLocale,
    headerToolbar: false,
    datesSet: (info) => {
        currentTitle.value = info.view.title;
    },
    eventSources: [
        { events: (fetchInfo, successCallback) => successCallback(calendarEvents.value) },
        { events: (fetchInfo, successCallback) => successCallback(holidayEvents.value) }
    ],
    weekends: false,
    
    // 👇 [핵심 수정 2] eventClick 콜백을 추가합니다.
    eventClick: function(info) {
        // 클릭된 이벤트가 휴일이거나, amount가 없는 '예정' 이벤트일 경우 아무것도 하지 않음
        if (info.event.extendedProps.isHoliday) {
            return;
        }
        // 부모에게 제거할 티커 심볼을 전달합니다.
        emit('remove-ticker', info.event.extendedProps.ticker);
    },

    eventContent: (arg) => {
        if (arg.event.extendedProps.isHoliday) {
            return { html: `<div class="fc-holiday-name">${arg.event.title}</div>` };
        }
        
        const ticker = arg.event.extendedProps.ticker;
        const amount = arg.event.extendedProps.amount;
        const frequencyClass = arg.event.extendedProps.frequencyClass || 'freq-default';
        
        const amountHtml = (amount !== null && typeof amount === 'number' && !isNaN(amount))
            ? `<span>$${amount.toFixed(4)}</span>`
            : '<span class="no-amount">예정</span>';

        // 👇 [핵심 수정 3] 닫기(X) 아이콘을 추가하고, 조건부로 클릭 가능한 클래스를 부여합니다.
        const isRemovable = amount !== null;
        const removableClass = isRemovable ? 'is-removable' : '';
        const removeIcon = isRemovable ? '<i class="pi pi-times-circle"></i>' : '';

        return {
            html: `
                <div class="p-chip p-component ${frequencyClass} ${removableClass}">
                    <div class="p-chip-text">
                        <strong>${ticker}</strong>
                        ${amountHtml}
                    </div>
                    ${removeIcon}
                </div>
            `
        };
    }
});

watch(currentView, (newView) => {
    fullCalendar.value?.getApi().changeView(newView);
});

watch(() => [props.dividendsByDate, props.holidays], () => {
    fullCalendar.value?.getApi().refetchEvents();
}, { deep: true });

const prevMonth = () => fullCalendar.value?.getApi().prev();
const nextMonth = () => fullCalendar.value?.getApi().next();
const goToToday = () => fullCalendar.value?.getApi().today();
</script>

<style>
.calendar-wrapper {
    height: 90vh;
}
.custom-calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 0 1.5rem 0;
}
.custom-calendar-header .header-left,
.custom-calendar-header .header-right {
    display: flex;
    gap: 0.5rem;
}
.custom-calendar-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
}
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
.fc .fc-daygrid-day-frame {
    position: relative;
    z-index: 2;
}
.fc .fc-daygrid-bg-event {
    z-index: 1;
}

/* PrimeVue Chip 컴포넌트의 모양을 흉내 냅니다. */
.p-chip {
    display: inline-flex;
    align-items: center;
    border-radius: 16px;
    padding: 0.25rem 0.75rem;
    gap: 0.5rem;
    margin-bottom: 2px;
}
.p-chip-text {
    line-height: 1.5;
}
.p-chip.is-removable {
    cursor: pointer;
    transition: opacity 0.2s;
}
.p-chip.is-removable:hover {
    opacity: 0.8;
}
.p-chip .pi-times-circle {
    font-size: 0.8rem;
}
</style>