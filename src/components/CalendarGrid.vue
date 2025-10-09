<!-- stock\src\components\CalendarGrid.vue -->
<script setup>
    import { ref, computed, watch, defineEmits } from 'vue';
    import FullCalendar from '@fullcalendar/vue3';
    import dayGridPlugin from '@fullcalendar/daygrid';
    import listPlugin from '@fullcalendar/list';
    import interactionPlugin from '@fullcalendar/interaction';
    import koLocale from '@fullcalendar/core/locales/ko';
    import { useFilterState } from '@/composables/useFilterState';
    import { useBreakpoint } from '@/composables/useBreakpoint';

    // PrimeVue 컴포넌트 import
    import Button from 'primevue/button';
    import SelectButton from 'primevue/selectbutton';
    import Card from 'primevue/card';
    import Panel from 'primevue/panel';

    const props = defineProps({
        dividendsByDate: Object,
        holidays: Array,
        allTickers: Array,
    });

    const emit = defineEmits(['view-ticker']);

    // useFilterState에서 toggleMyStock 함수를 직접 가져옵니다.
    const { toggleMyStock } = useFilterState();

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
            { label: '주', value: 'dayGridWeek' },
        ];
    });

    const getEventClass = (tickerInfo) => {
        if (!tickerInfo) return 'freq-default';
        const { frequency, group } = tickerInfo;

        if (frequency === '매월' || frequency === '분기') {
            switch (frequency) {
                case '매월':
                    return 'freq-monthly';
                case '분기':
                    return 'freq-quarterly';
                default:
                    return 'freq-default';
            }
        } else if (frequency === '매주') {
            switch (group) {
                case '월':
                    return 'freq-mon';
                case '화':
                    return 'freq-tue';
                case '수':
                    return 'freq-wed';
                case '목':
                    return 'freq-thu';
                case '금':
                    return 'freq-fri';
                default:
                    return 'freq-default';
            }
        } 
        // else if (frequency === '4주') {
        //     switch (group) {
        //         case 'A':
        //             return 'freq-a';
        //         case 'B':
        //             return 'freq-b';
        //         case 'C':
        //             return 'freq-c';
        //         case 'D':
        //             return 'freq-d';
        //         default:
        //             return 'freq-default';
        //     }
        // }
        return 'freq-default';
    };

    const calendarEvents = computed(() => {
        if (!props.dividendsByDate) return [];

        // Object.entries()는 [key, value] 형태의 배열을 반환합니다.
        // flatMap의 콜백 함수에서 이 [key, value]를 인자로 받습니다.
        return Object.entries(props.dividendsByDate).flatMap(
            ([date, dividendArray]) => {
                // 이제 dividendArray는 날짜에 해당하는 배당금 객체들의 배열입니다.
                // 이 배열을 map으로 순회합니다.
                return dividendArray.map((entry) => {
                    return {
                        title: entry.amount
                            ? `${entry.ticker} $${entry.amount.toFixed(4)}`
                            : entry.ticker,
                        start: date, // key였던 date 변수를 사용합니다.
                        extendedProps: {
                            ticker: entry.ticker,
                            amount: entry.amount,
                            eventClass: getEventClass({
                                frequency: entry.frequency,
                                group: entry.group,
                            }),
                            frequency: entry.frequency,
                            group: entry.group,
                        },
                    };
                });
            }
        );
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
        validRange: {
            start: '2024-01-01',
            end: '2026-04-01',
        },
        datesSet: (info) => {
            currentTitle.value = info.view.title;
            if (info.view.type !== currentView.value) {
                currentView.value = info.view.type;
            }
        },
        eventSources: [
            {
                events: (fetchInfo, successCallback) =>
                    successCallback(calendarEvents.value),
            },
            {
                events: (fetchInfo, successCallback) =>
                    successCallback(holidayEvents.value),
            },
        ],
        weekends: false,
        eventClassNames: (arg) => {
            return arg.event.extendedProps.eventClass || 'freq-default';
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
                    // emit 대신, 가져온 toggleMyStock 함수를 직접 호출합니다.
                    toggleMyStock(ticker);
                }
            }
        },
        eventContent: (arg) => {
            if (arg.event.extendedProps.isHoliday) {
                return {
                    html: `<div class="fc-holiday-name"><span>${arg.event.title}</span></div>`,
                };
            }

            const { ticker, amount, eventClass, frequency, group } =
                arg.event.extendedProps;
            const amountHtml =
                amount !== null && typeof amount === 'number' && !isNaN(amount)
                    ? `<span>$${amount.toFixed(4)}</span>`
                    : '<span class="no-amount">예정</span>';
            const viewButtonHtml = `<button class="p-button p-component p-button-icon-only p-button-text p-button-sm " data-action="view" title="상세 보기"><span class="pi pi-link"></span></button>`;
            const removeButtonHtml = `<button class="p-button p-component p-button-icon-only p-button-text p-button-sm " data-action="remove" title="북마크 제거"><span class="pi pi-times"></span></button>`;

            if (arg.view.type === 'listWeek') {
                return {
                    html: `<div class="stock-item-list ${eventClass}">
                        <span class="data">
                            <span class="ticker-name">${ticker}</span>
                            <span class="amount-text">${amountHtml}</span>
                            </span>
                            <span class="actions">
                                <button class="p-button p-component p-button-icon-only p-button-text p-button-sm p-button-contrast" data-action="view" title="상세 보기"><span class="pi pi-link"></span></button>
                                ${removeButtonHtml}
                            </span>
                        </div>`,
                };
            } else if (arg.view.type === 'dayGridWeek') {
                return {
                    html: `<div class="stock-item-week ${eventClass}">
                            <span class="ticker-name">${ticker}</span>
                            <span class="amount-text">${amountHtml}</span>
                            <span class="actions">
                                ${viewButtonHtml}
                                ${removeButtonHtml}
                            </span>
                        </div>`,
                };
            } else {
                return {
                    html: `<div class="stock-item-month ${eventClass}"  data-action="view" title="상세 보기">
                            <div class="fc-event-title"><b>${ticker}</b> ${amountHtml}</div>
                        </div>`,
                };
            }
        },
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

    watch(
        () => [props.dividendsByDate, props.holidays],
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
        <template #header>
            {{ currentTitle }}
        </template>
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
                    :options="viewOptions"
                    optionLabel="label"
                    optionValue="value"
                    aria-labelledby="basic" />
            </div>
        </template>
        <FullCalendar ref="fullCalendar" :options="calendarOptions" />
    </Panel>
</template>
