<script setup>
import { ref, computed, watch, defineEmits } from 'vue';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';
import Button from 'primevue/button';
import SelectButton from 'primevue/selectbutton';
import Card from "primevue/card";
import Panel from "primevue/panel";
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
    if (!props.allTickers || props.allTickers.length === 0) return 'freq-default';
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
    eventClassNames: (arg) => {
        return arg.event.extendedProps.frequencyClass || 'freq-default';
    },
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

        if (arg.view.type === 'listWeek') {
            const isRemovable = amount !== null;
            const removeButtonHtml = isRemovable
                ? `<button class="p-button p-component p-button-icon-only p-button-text p-button-sm p-button-contrast"  data-action="remove" title="목록에서 제거"><span class="pi pi-times"></span></button>`
                : '';
            return {
                html: `<div class="${frequencyClass}">
                            <span class="ticker-name">${ticker}</span>
                            <span class="amount-text">${amountHtml}</span>
                            <span class="actions">
                                <button class="p-button p-component p-button-icon-only p-button-text p-button-sm p-button-contrast" data-action="view" title="상세 보기"><span class="pi pi-link"></span></button>
                            ${removeButtonHtml}
                            </span>
                        </div>`
            };
        } else {
            const isRemovable = amount !== null;
            const removeButtonHtml = isRemovable
                ? `<span class="p-inputgroup-addon" data-action="remove" title="목록에서 제거"><button class="p-button p-component p-button-icon-only p-button-text p-button-sm"><span class="pi pi-times"></span></button></span>`
                : '';
            return {
                html: `<div class="fc-event-main-content ${frequencyClass}"><b>${ticker}</b> ${amountHtml}</div>`
            };
        }
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

watch(isMobile, (isNowMobile) => {
    const calendarApi = fullCalendar.value?.getApi();
    if (!calendarApi) return;
    const newView = isNowMobile ? 'listWeek' : 'dayGridMonth';
    if (calendarApi.view.type !== newView) {
        calendarApi.changeView(newView);
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
    <Card v-if="isMobile">
        <template #header>
            {{ currentTitle }}
        </template>
        <template #title>
            <Button icon="pi pi-chevron-left" text rounded @click="prevMonth" />
            <Button label="오늘" class="p-button-sm" @click="goToToday" variant="text" />
            <Button icon="pi pi-chevron-right" text rounded @click="nextMonth" />
        </template>
        <template #content>
            <FullCalendar ref="fullCalendar" :options="calendarOptions" />
        </template>
    </Card>

    <Panel v-else class="panel-container">
        <template #header>
            <div class="header-left">
                <Button icon="pi pi-chevron-left" text rounded @click="prevMonth" />
                <Button icon="pi pi-chevron-right" text rounded @click="nextMonth" />
                <Button label="오늘" class="p-button-sm" @click="goToToday" />
            </div>
            <div class="header-center">
                <h2>{{ currentTitle }}</h2>
            </div>
            <div class="header-right">
                <SelectButton v-model="currentView" :options="viewOptions" optionLabel="label" optionValue="value"
                    aria-labelledby="basic" />
            </div>
        </template>
        <FullCalendar ref="fullCalendar" :options="calendarOptions" />
    </Panel>

</template>

<style>
.fc-direction-ltr .freq-weekly .fc-list-event-dot,
.freq-weekly .fc-event-main-content {
    background-color: #3b82f630;
}

.fc-direction-ltr .freq-monthly .fc-list-event-dot,
.freq-monthly .fc-event-main-content {
    background-color: #22c55e30;
}

.fc-direction-ltr .freq-quarterly .fc-list-event-dot,
.freq-quarterly .fc-event-main-content {
    background-color: #f9731630;
}

.fc-direction-ltr .freq-every-4-week .fc-list-event-dot,
.freq-every-4-week .fc-event-main-content {
    background-color: #14b8a630;
}

.fc-direction-ltr .freq-default .fc-list-event-dot,
.freq-default .fc-event-main-content {
    background-color: #64748b30;
}

.fc-event-main-content {
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 0.8rem;
    color: inherit;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.fc-event-main-content b {
    margin-right: 4px;
}
</style>