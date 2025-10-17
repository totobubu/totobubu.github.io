<script setup>
    import { ref, computed, watch } from 'vue';
    import FullCalendar from '@fullcalendar/vue3';
    import dayGridPlugin from '@fullcalendar/daygrid';
    import listPlugin from '@fullcalendar/list';
    import interactionPlugin from '@fullcalendar/interaction';
    import koLocale from '@fullcalendar/core/locales/ko';
    import { useFilterState } from '@/composables/useFilterState';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { subMonths, addMonths, startOfMonth, endOfMonth } from 'date-fns';
    import Button from 'primevue/button';
    import SelectButton from 'primevue/selectbutton';
    import Card from 'primevue/card';
    import Panel from 'primevue/panel';

    const props = defineProps({
        dividendsByDate: Array,
        holidays: Array,
    });

    const emit = defineEmits(['view-ticker']);
    const { toggleMyStock } = useFilterState();
    const { isMobile } = useBreakpoint();
    const fullCalendar = ref(null);
    const currentTitle = ref('');
    const currentView = ref(isMobile.value ? 'listWeek' : 'dayGridMonth');

    const validRange = computed(() => {
        const today = new Date();
        const start = startOfMonth(subMonths(today, 12));
        const end = endOfMonth(addMonths(today, 3));
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
        };
    });

    const getEventClass = (event) => {
        if (!event) return 'freq-default';
        const { frequency, group } = event;
        if (frequency === '매월') return 'freq-monthly';
        if (frequency === '분기') return 'freq-quarterly';
        if (frequency === '매주') {
            const groupMap = {
                월: 'mon',
                화: 'tue',
                수: 'wed',
                목: 'thu',
                금: 'fri',
            };
            return `freq-${groupMap[group] || 'default'}`;
        }
        return 'freq-default';
    };

    const calendarEvents = computed(() => {
        if (!props.dividendsByDate) return [];
        return props.dividendsByDate.map((entry) => ({
            title: entry.koName || entry.symbol,
            start: entry.date,
            extendedProps: { ...entry, eventClass: getEventClass(entry) },
        }));
    });

    const holidayEvents = computed(() => {
        if (!props.holidays) return [];
        return props.holidays.map((holiday) => ({
            id: `holiday-${holiday.date}`,
            title: holiday.name,
            start: holiday.date,
            display: 'background',
            color: 'rgba(255, 0, 0, 0.3)',
            extendedProps: { isHoliday: true },
        }));
    });

    const calendarOptions = computed(() => ({
        plugins: [dayGridPlugin, listPlugin, interactionPlugin],
        initialView: isMobile.value ? 'listWeek' : 'dayGridMonth',
        locale: koLocale,
        headerToolbar: false,
        showNonCurrentDates: false,
        validRange: validRange.value,
        datesSet: (info) => {
            currentTitle.value = info.view.title;
            if (info.view.type !== currentView.value) {
                currentView.value = info.view.type;
            }
        },
        eventSources: [
            { events: calendarEvents.value },
            { events: holidayEvents.value },
        ],
        weekends: false,
        eventClassNames: (arg) =>
            arg.event.extendedProps.eventClass || 'freq-default',
        eventClick: (info) => {
            const actionElement = info.jsEvent.target.closest('[data-action]');
            if (actionElement) {
                const { action } = actionElement.dataset;
                const { symbol } = info.event.extendedProps;
                if (action === 'view') emit('view-ticker', symbol);
                else if (action === 'remove') toggleMyStock(symbol);
            }
        },
        eventContent: (arg) => {
            if (arg.event.extendedProps.isHoliday) {
                return {
                    html: `<div class="fc-holiday-name"><span>${arg.event.title}</span></div>`,
                };
            }
            const {
                symbol,
                amount,
                eventClass,
                koName,
                currency,
                isExpected,
                isForecast,
            } = arg.event.extendedProps;
            const currencySymbol = currency === 'KRW' ? '₩' : '$';
            const displayName = koName || symbol;

            let amountHtml;
            if (amount !== null && amount !== undefined) {
                const amountStr = new Intl.NumberFormat(
                    currency === 'KRW' ? 'ko-KR' : 'en-US',
                    {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 6,
                    }
                ).format(amount);
                amountHtml = `<span>${currencySymbol}${amountStr}</span>`;
            } else {
                if (isForecast)
                    amountHtml = '<span class="no-amount">예상</span>';
                else if (isExpected)
                    amountHtml = '<span class="no-amount">예정</span>';
                else amountHtml = '<span class="no-amount">예상</span>';
            }

            const viewButtonHtml = `<button class="p-button p-component p-button-icon-only p-button-text p-button-sm" data-action="view" title="상세 보기"><span class="pi pi-link"></span></button>`;
            const removeButtonHtml = `<button class="p-button p-component p-button-icon-only p-button-text p-button-sm" data-action="remove" title="북마크 제거"><span class="pi pi-times"></span></button>`;

            if (arg.view.type === 'listWeek') {
                return {
                    html: `<div class="stock-item-list ${eventClass}"><span class="data"><span class="ticker-name">${displayName}</span>...</div>`,
                };
            } else if (arg.view.type === 'dayGridWeek') {
                return {
                    html: `<div class="stock-item-week ${eventClass}"><span class="ticker-name">${displayName}</span>...</div>`,
                };
            } else {
                return {
                    html: `<div class="stock-item-month ..."><div class="fc-event-title"><b>${displayName}</b> ${amountHtml}</div></div>`,
                };
            }
        },
    }));
    watch(currentView, (newView) => {
        if (fullCalendar.value) fullCalendar.value.getApi().changeView(newView);
    });
    watch(isMobile, (isNowMobile) => {
        if (fullCalendar.value)
            fullCalendar.value
                .getApi()
                .changeView(isNowMobile ? 'listWeek' : 'dayGridMonth');
    });
    watch(
        () => props.dividendsByDate,
        () => {
            fullCalendar.value?.getApi().refetchEvents();
        },
        { deep: true }
    );

    const prevMonth = () => fullCalendar.value?.getApi().prev();
    const nextMonth = () => fullCalendar.value?.getApi().next();
    const goToToday = () => fullCalendar.value?.getApi().today();
</script>

<template>
    <Card v-if="isMobile" id="t-calendar-list">
        <template #header>{{ currentTitle }}</template>
        <template #title>
            <Button icon="pi pi-chevron-left" text @click="prevMonth" />
            <Button
                label="오늘"
                class="p-button-sm"
                @click="goToToday"
                variant="text" />
            <Button icon="pi pi-chevron-right" text @click="nextMonth" />
        </template>
        <template #content>
            <FullCalendar ref="fullCalendar" :options="calendarOptions" />
        </template>
    </Card>
    <Panel v-else id="t-calendar-grid">
        <template #header>
            <div class="header-left">
                <Button label="오늘" class="p-button-sm" @click="goToToday" />
            </div>
            <div class="header-center">
                <Button icon="pi pi-chevron-left" text @click="prevMonth" />
                <h2>{{ currentTitle }}</h2>
                <Button icon="pi pi-chevron-right" text @click="nextMonth" />
            </div>
            <div class="header-right">
                <SelectButton
                    v-model="currentView"
                    :options="
                        isMobile
                            ? [{ label: '목록', value: 'listWeek' }]
                            : [
                                  { label: '월', value: 'dayGridMonth' },
                                  { label: '주', value: 'dayGridWeek' },
                              ]
                    "
                    optionLabel="label"
                    optionValue="value"
                    aria-labelledby="basic" />
            </div>
        </template>
        <FullCalendar ref="fullCalendar" :options="calendarOptions" />
    </Panel>
</template>
