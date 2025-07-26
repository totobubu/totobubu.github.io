<script setup>
import { ref, computed, watch, defineEmits } from 'vue';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';
import Button from 'primevue/button';
import SelectButton from 'primevue/selectbutton';
import { useBreakpoint } from '@/composables/useBreakpoint';

const props = defineProps({
    dividendsByDate: Object,
    holidays: Array,
    allTickers: Array
});

const emit = defineEmits(['remove-ticker', 'view-ticker']);

const { isMobile } = useBreakpoint();
const fullCalendar = ref(null);
const currentTitle = ref('');
const currentView = ref(isMobile.value ? 'listWeek' : 'dayGridMonth');

const viewOptions = computed(() => {
    if (isMobile.value) {
        return [{ label: '목록', value: 'listWeek' }];
    }
    return [
        { label: '월', value: 'dayGridMonth' },
        { label: '주', value: 'dayGridWeek' }
    ];
});

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
    return Object.entries(props.dividendsByDate).flatMap(([date, data]) => 
        data.entries.map(entry => ({
            title: entry.amount ? `${entry.ticker} $${entry.amount.toFixed(4)}` : entry.ticker,
            start: date,
            extendedProps: {
                ticker: entry.ticker,
                amount: entry.amount,
                frequencyClass: getFrequencyClass(entry.ticker)
            },
        }))
    );
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

const calendarOptions = computed(() => ({
    plugins: [dayGridPlugin, listPlugin, interactionPlugin],
    initialView: isMobile.value ? 'listWeek' : 'dayGridMonth',
    locale: koLocale,
    headerToolbar: false,
    datesSet: (info) => {
        currentTitle.value = info.view.title;
        if (info.view.type !== currentView.value) {
            currentView.value = info.view.type;
        }
    },
    eventSources: [
        { events: (fetchInfo, successCallback) => successCallback(calendarEvents.value) },
        { events: (fetchInfo, successCallback) => successCallback(holidayEvents.value) }
    ],
    weekends: false,
    eventClick: function (info) {
        const target = info.jsEvent.target;
        const actionElement = target.closest('[data-action]');
        if (actionElement) {
            const action = actionElement.dataset.action;
            const ticker = info.event.extendedProps.ticker;
            if (action === 'view') {
                emit('view-ticker', ticker);
            } else if (action === 'remove') {
                emit('remove-ticker', ticker);
            }
        }
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
        const isRemovable = amount !== null;
        const removeButtonHtml = isRemovable
            ? `<span class="p-inputgroup-addon" data-action="remove" title="목록에서 제거"><button class="p-button p-component p-button-icon-only p-button-text p-button-sm"><span class="pi pi-times"></span></button></span>`
            : '';
        return {
            html: `<div class="p-inputgroup event-input-group ${frequencyClass}"><span class="p-inputgroup-addon ticker-name">${ticker}</span><span class="p-inputgroup-addon amount-text">${amountHtml}</span><span class="p-inputgroup-addon" data-action="view" title="상세 보기"><button class="p-button p-component p-button-icon-only p-button-text p-button-sm"><span class="pi pi-link"></span></button></span>${removeButtonHtml}</div>`
        };
    }
}));

watch(currentView, (newView) => {
    if (newView && fullCalendar.value) {
        const calendarApi = fullCalendar.value.getApi();
        if (calendarApi.view.type !== newView) {
            calendarApi.changeView(newView);
        }
    }
});

watch(() => [props.dividendsByDate, props.holidays], () => {
    fullCalendar.value?.getApi().refetchEvents();
}, { deep: true });

const prevMonth = () => fullCalendar.value?.getApi().prev();
const nextMonth = () => fullCalendar.value?.getApi().next();
const goToToday = () => fullCalendar.value?.getApi().today();
</script>

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
            <div class="header-right" v-if="!isMobile">
                <SelectButton v-model="currentView" :options="viewOptions" optionLabel="label" optionValue="value"
                    aria-labelledby="basic" />
            </div>
        </div>
        <FullCalendar ref="fullCalendar" :options="calendarOptions" />
    </div>
</template>