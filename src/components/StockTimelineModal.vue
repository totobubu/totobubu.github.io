<script setup>
    import { computed, ref } from 'vue';
    import Dialog from 'primevue/dialog';
    import Drawer from 'primevue/drawer';
    import Timeline from 'primevue/timeline';
    import Tag from 'primevue/tag';
    import { useBreakpoint } from '@/composables/useBreakpoint';

    const props = defineProps({
        events: {
            type: Array,
            default: () => [],
        },
        fallbackGroup: {
            type: String,
            default: null,
        },
        header: {
            type: String,
            default: '타임라인',
        },
        modelValue: {
            type: Boolean,
            default: undefined,
        },
    });

    const emit = defineEmits(['update:modelValue']);

    const { isMobile } = useBreakpoint();
    const internalVisible = ref(false);
    const isControlled = computed(() => props.modelValue !== undefined);

    const visible = computed({
        get: () =>
            isControlled.value ? props.modelValue : internalVisible.value,
        set: (value) => {
            if (isControlled.value) {
                emit('update:modelValue', value);
            } else {
                internalVisible.value = value;
            }
        },
    });

    const open = () => {
        visible.value = true;
    };
    const close = () => {
        visible.value = false;
    };

    const frequencyLabelMap = {
        매주: '주배당',
        '4주': '4주 순회 배당',
        매월: '월배당',
        분기: '분기배당',
        반기: '반기배당',
        매년: '연배당',
        연간: '연배당',
    };

    const formatEventDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return dateString;
        return new Intl.DateTimeFormat('ko-KR', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
        })
            .format(date)
            .replace(/\. /g, '.')
            .slice(0, -1);
    };

    const mapFrequency = (value) => frequencyLabelMap[value] || value || '';

    const composeLabel = (frequencyValue, groupValue) => {
        const freqLabel = mapFrequency(frequencyValue);
        if (!freqLabel && !groupValue) return '';
        if (!groupValue) return freqLabel;
        return `${freqLabel} ${groupValue}`.trim();
    };

    const extractGroupValue = (event, key, fallbackGroup) => {
        const groupKey = `${key}Group`;
        const dayKey = `${key}Day`;
        const altKey = `${key}Weekday`;
        const labelKey = `${key}Label`;

        if (event[groupKey]) return event[groupKey];
        if (event[dayKey]) return event[dayKey];
        if (event[altKey]) return event[altKey];
        if (event[labelKey]) return event[labelKey];

        const freqVal = event[key];
        if (typeof freqVal === 'string' && freqVal.includes('주')) {
            return fallbackGroup;
        }
        return null;
    };

    const weekdayMap = {
        월: { key: 'mon', label: '월' },
        화: { key: 'tue', label: '화' },
        수: { key: 'wed', label: '수' },
        목: { key: 'thu', label: '목' },
        금: { key: 'fri', label: '금' },
        MON: { key: 'mon', label: '월' },
        TUE: { key: 'tue', label: '화' },
        WED: { key: 'wed', label: '수' },
        THU: { key: 'thu', label: '목' },
        FRI: { key: 'fri', label: '금' },
    };

    const getWeekdayInfo = (value) => {
        if (!value) return { key: null, label: null };
        const normalized = value.toString().trim();
        return (
            weekdayMap[normalized] ||
            weekdayMap[normalized.toUpperCase()] || {
                key: null,
                label: normalized,
            }
        );
    };

    const buildDisplayInfo = (frequencyValue, groupValue, fallbackGroup) => {
        const frequencyLabel = mapFrequency(frequencyValue);
        const group =
            groupValue ||
            (typeof frequencyValue === 'string' && frequencyValue.includes('주')
                ? fallbackGroup
                : null);
        const { key: weekdayKey, label: weekdayLabel } = getWeekdayInfo(group);

        return {
            frequencyLabel,
            weekdayKey,
            weekdayLabel,
        };
    };

    const eventTypeLabelMap = {
        frequency: '지급기간변경',
        'frequency-group': '배당월변경',
        weekday: '배당요일변경',
        split: '주식분할',
        'reverse-split': '주식병합',
    };

    const getEventTypeLabel = (eventType) =>
        eventTypeLabelMap[eventType] || '지급기간변경';

    const getEventTypeSeverity = (eventType) => {
        switch (eventType) {
            case 'weekday':
                return 'info';
            case 'frequency-group':
                return 'contrast';
            case 'split':
                return 'primary';
            case 'reverse-split':
                return 'danger';
            default:
                return 'secondary';
        }
    };

    const timelineAlign = computed(() =>
        isMobile.value ? 'left' : 'alternate'
    );

    const timelineItems = computed(() => {
        if (!props.events || props.events.length === 0) return [];

        const sorted = [...props.events].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );

        let fallbackGroup = props.fallbackGroup ?? null;

        return sorted.map((event) => {
            const eventType = event.eventType || 'frequency';
            let toInfo = {
                frequencyLabel: '',
                weekdayKey: null,
                weekdayLabel: null,
            };
            let fromInfo = {
                frequencyLabel: '',
                weekdayKey: null,
                weekdayLabel: null,
            };

            if (eventType === 'split' || eventType === 'reverse-split') {
                fromInfo = {
                    frequencyLabel: event.ratio
                        ? `비율 ${event.ratio}`
                        : eventTypeLabelMap[eventType] || '',
                    weekdayKey: null,
                    weekdayLabel: null,
                };
                toInfo = {
                    frequencyLabel:
                        eventType === 'reverse-split'
                            ? '병합 완료'
                            : '분할 완료',
                    weekdayKey: null,
                    weekdayLabel: null,
                };
            } else {
                toInfo = buildDisplayInfo(
                    event.to,
                    event.toGroup,
                    fallbackGroup
                );
                fromInfo = buildDisplayInfo(
                    event.from,
                    event.fromGroup,
                    fallbackGroup
                );
                fallbackGroup = fromInfo.weekdayLabel
                    ? fromInfo.weekdayLabel
                    : fallbackGroup;
            }

            return {
                date: formatEventDate(event.date),
                icon: event.icon || 'pi pi-refresh',
                color: event.color || '#6366F1',
                from: fromInfo,
                to: toInfo,
                eventType,
                eventTypeLabel: getEventTypeLabel(eventType),
                eventTypeSeverity: getEventTypeSeverity(eventType),
                ratio: event.ratio,
            };
        });
    });

    const hasEvents = computed(() => timelineItems.value.length > 0);
</script>

<template>
    <span>
        <slot
            name="trigger"
            :open="open"
            :visible="visible"
            :has-events="hasEvents" />

        <Drawer
            v-if="isMobile"
            v-model:visible="visible"
            position="full"
            :header="header"
            class="timeline-drawer"
            modal>
            <div v-if="hasEvents">
                <Timeline :value="timelineItems" align="left" layout="vertical">
                    <template #opposite="slotProps">
                        {{ slotProps.item.date }}
                    </template>

                    <template #marker="slotProps">
                        {{ slotProps.item.eventTypeLabel }}
                    </template>
                    <template #content="slotProps">
                        <template
                            v-if="
                                slotProps.item.from.frequencyLabel &&
                                slotProps.item.from.frequencyLabel.includes(
                                    '주배당'
                                ) &&
                                slotProps.item.from.weekdayKey
                            ">
                            <span class="text-sm timeline-label">
                                {{ slotProps.item.from.frequencyLabel }}
                            </span>
                            <Tag
                                :data-p="slotProps.item.from.weekdayKey"
                                class="p-tag-rounded timeline-weekday-tag">
                                {{ slotProps.item.from.weekdayLabel }}
                            </Tag>
                        </template>
                        <Tag
                            v-else-if="slotProps.item.from.frequencyLabel"
                            severity="secondary">
                            {{ slotProps.item.from.frequencyLabel }}
                        </Tag>
                        <i class="pi pi-arrow-right"></i>
                        <template
                            v-if="
                                slotProps.item.to.frequencyLabel &&
                                slotProps.item.to.frequencyLabel.includes(
                                    '주배당'
                                ) &&
                                slotProps.item.to.weekdayKey
                            ">
                            <span class="text-sm timeline-label">
                                {{ slotProps.item.to.frequencyLabel }}
                            </span>
                            <Tag
                                :data-p="slotProps.item.to.weekdayKey"
                                class="p-tag-rounded timeline-weekday-tag">
                                {{ slotProps.item.to.weekdayLabel }}
                            </Tag>
                        </template>
                        <Tag
                            v-else-if="slotProps.item.to.frequencyLabel"
                            severity="secondary">
                            {{ slotProps.item.to.frequencyLabel }}
                        </Tag>
                    </template>
                </Timeline>
            </div>
            <div v-else class="text-center py-4 text-500">
                <slot name="empty">표시할 이벤트가 없습니다.</slot>
            </div>
        </Drawer>

        <Dialog
            v-else
            v-model:visible="visible"
            :header="header"
            modal
            class="timeline-dialog">
            <div v-if="hasEvents">
                <Timeline :value="timelineItems" align="alternate">
                    <template #opposite="slotProps">
                        {{ slotProps.item.date }}
                    </template>
                    <template #marker="slotProps">
                        {{ slotProps.item.eventTypeLabel }}
                    </template>
                    <template #content="slotProps">
                        <template
                            v-if="
                                slotProps.item.from.frequencyLabel &&
                                slotProps.item.from.frequencyLabel.includes(
                                    '주배당'
                                ) &&
                                slotProps.item.from.weekdayKey
                            ">
                            <Tag severity="secondary">
                                {{ slotProps.item.from.frequencyLabel }}
                            </Tag>
                            <Tag
                                :data-p="slotProps.item.from.weekdayKey"
                                class="p-tag-rounded timeline-weekday-tag">
                                {{ slotProps.item.from.weekdayLabel }}
                            </Tag>
                        </template>
                        <Tag
                            v-else-if="slotProps.item.from.frequencyLabel"
                            severity="secondary">
                            {{ slotProps.item.from.frequencyLabel }}
                        </Tag>
                        <i class="pi pi-arrow-right"></i>
                        <template
                            v-if="
                                slotProps.item.to.frequencyLabel &&
                                slotProps.item.to.frequencyLabel.includes(
                                    '주배당'
                                ) &&
                                slotProps.item.to.weekdayKey
                            ">
                            <Tag severity="secondary">
                                {{ slotProps.item.to.frequencyLabel }}
                            </Tag>
                            <Tag
                                :data-p="slotProps.item.to.weekdayKey"
                                class="p-tag-rounded timeline-weekday-tag">
                                {{ slotProps.item.to.weekdayLabel }}
                            </Tag>
                        </template>
                        <Tag
                            v-else-if="slotProps.item.to.frequencyLabel"
                            severity="secondary">
                            {{ slotProps.item.to.frequencyLabel }}
                        </Tag>
                    </template>
                </Timeline>
            </div>
            <div v-else class="text-center py-4 text-500">
                <slot name="empty">표시할 이벤트가 없습니다.</slot>
            </div>
        </Dialog>
    </span>
</template>
