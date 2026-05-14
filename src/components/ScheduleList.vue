<script setup>
import { computed } from 'vue';

const props = defineProps({
    selectedDateStr: {
        type: String,
        default: ''
    },
    dividendsByDate: {
        type: Object,
        default: () => ({})
    }
});

const emit = defineEmits(['view-ticker']);

const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dow = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
    return `${dow}, ${monthNamesShort[d.getMonth()]} ${d.getDate()}`;
};

const formatShortDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${monthNamesShort[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
};

const selectedEvents = computed(() => {
    if (!props.selectedDateStr) return [];
    return props.dividendsByDate[props.selectedDateStr] || [];
});

const upcomingDates = computed(() => {
    if (!props.selectedDateStr) return [];
    const dates = Object.keys(props.dividendsByDate).sort();
    return dates.filter(d => d > props.selectedDateStr).slice(0, 3); // Get next 3 dates
});

const calculateDailyPayout = (events) => {
    // Mocked total payout logic since we don't have shares owned in basic event data
    // Usually would be amount * shares_owned. 
    return events.reduce((sum, ev) => sum + (ev.amount || 0) * 100, 0); // Assuming 100 shares for demo
};

const dailyPayoutStr = computed(() => {
    const total = calculateDailyPayout(selectedEvents.value);
    return total > 0 ? `$${total.toFixed(2)}` : null;
});

const viewTicker = (ticker) => {
    emit('view-ticker', ticker);
};

// Colors for logos
const getLogoColor = (ticker) => {
    const colors = ['#5ca126', '#0e7a44', '#156149', '#4caf50', '#2e7d32'];
    let hash = 0;
    for (let i = 0; i < ticker.length; i++) {
        hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};
</script>

<template>
    <div class="schedule-container">
        <div class="schedule-header">
            <div class="header-left">
                <h2 class="schedule-title">{{ formatDateLabel(selectedDateStr) }} Schedule</h2>
                <p class="schedule-subtitle">Detailed view of all estimated payouts and stock events for this day.</p>
            </div>
            <div v-if="dailyPayoutStr" class="header-right">
                <span class="payout-label">Daily Payout:</span>
                <span class="payout-amount">{{ dailyPayoutStr }}</span>
            </div>
        </div>

        <div v-if="selectedEvents.length === 0" class="no-data">
            No events scheduled for this day.
        </div>

        <div class="cards-list">
            <div v-for="event in selectedEvents" :key="event.ticker" class="event-card" @click="viewTicker(event.ticker)">
                <div class="card-header">
                    <div class="logo-circle" :style="{ backgroundColor: getLogoColor(event.ticker) }">
                        {{ event.ticker }}
                    </div>
                    <div class="company-info">
                        <div class="company-name">{{ event.koName || event.ticker }}</div>
                        <div class="company-sector">Stock Event</div>
                    </div>
                    <div class="payout-info" v-if="event.amount">
                        <div class="total-payout">${{ (event.amount * 100).toFixed(2) }}</div>
                        <div class="payout-subtitle">Total Payout</div>
                    </div>
                    <div class="badge-info" v-else>
                        <span class="badge">EVENT</span>
                    </div>
                </div>
                
                <div class="card-details">
                    <div class="detail-row">
                        <div class="detail-item">
                            <div class="detail-label">Amount / Share</div>
                            <div class="detail-value">{{ event.currency === 'KRW' ? '₩' : '$' }}{{ event.amount || '0.00' }}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Shares Owned</div>
                            <div class="detail-value">100.000</div>
                        </div>
                    </div>
                    
                    <div class="detail-divider"></div>
                    
                    <div class="dates-row">
                        <div class="date-item">
                            <div class="date-label">EX-DIV</div>
                            <div class="date-value">{{ formatShortDate(selectedDateStr) }}</div>
                        </div>
                        <div class="date-item">
                            <div class="date-label">RECORD</div>
                            <div class="date-value">-</div>
                        </div>
                        <div class="date-item highlight">
                            <div class="date-label">PAYMENT</div>
                            <div class="date-value">-</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="end-marker" v-if="selectedEvents.length > 0">
            End of selected day data
        </div>

        <!-- Upcoming section -->
        <div v-if="upcomingDates.length > 0" class="upcoming-section">
            <h3 class="upcoming-title">Upcoming Schedule: {{ formatShortDate(upcomingDates[0]) }}</h3>
            <div class="cards-list">
                <div v-for="event in (dividendsByDate[upcomingDates[0]] || []).slice(0, 1)" :key="event.ticker" class="event-card" @click="viewTicker(event.ticker)">
                    <div class="card-header">
                        <div class="logo-circle" :style="{ backgroundColor: getLogoColor(event.ticker) }">
                            {{ event.ticker }}
                        </div>
                        <div class="company-info">
                            <div class="company-name">{{ event.koName || event.ticker }}</div>
                        </div>
                        <div class="payout-info" v-if="event.amount">
                            <div class="total-payout">${{ (event.amount * 100).toFixed(2) }}</div>
                            <div class="payout-subtitle">Est. Payout</div>
                        </div>
                    </div>
                    
                    <div class="card-details">
                        <div class="detail-row">
                            <div class="detail-item">
                                <div class="detail-label">Amount / Share</div>
                                <div class="detail-value">{{ event.currency === 'KRW' ? '₩' : '$' }}{{ event.amount || '0.00' }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.schedule-container {
    color: var(--p-text-color);
}

.schedule-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--p-surface-200);
    padding-bottom: 1rem;
}

.schedule-title {
    font-size: 1.2rem;
    font-weight: 700;
    margin: 0 0 0.25rem 0;
}

.schedule-subtitle {
    font-size: 0.8rem;
    color: var(--p-surface-500);
    margin: 0;
}

.header-right {
    text-align: right;
    font-size: 0.85rem;
}

.payout-label {
    color: var(--p-primary-500);
    margin-right: 0.5rem;
}

.payout-amount {
    font-weight: bold;
    color: var(--p-primary-500);
}

.no-data {
    padding: 2rem;
    text-align: center;
    color: var(--p-surface-500);
    font-style: italic;
}

.cards-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.event-card {
    background-color: var(--p-surface-0);
    border: 1px solid var(--p-surface-200);
    border-radius: 8px;
    padding: 1rem;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.1s;
}

.event-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
}

.card-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
}

.logo-circle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 0.8rem;
}

.company-info {
    flex: 1;
}

.company-name {
    font-weight: 700;
    font-size: 1.05rem;
}

.company-sector {
    font-size: 0.75rem;
    color: var(--p-surface-400);
}

.payout-info {
    text-align: right;
}

.total-payout {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--p-primary-500);
}

.payout-subtitle {
    font-size: 0.7rem;
    color: var(--p-surface-500);
}

.badge {
    background-color: #ffdddd;
    color: #cc0000;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: bold;
}

.card-details {
    background-color: var(--p-surface-50);
    padding: 0.75rem;
    border-radius: 6px;
}

.detail-row {
    display: flex;
    gap: 2rem;
    margin-bottom: 0.5rem;
}

.detail-item {
    display: flex;
    flex-direction: column;
}

.detail-label {
    font-size: 0.7rem;
    color: var(--p-surface-500);
    margin-bottom: 0.2rem;
}

.detail-value {
    font-size: 0.85rem;
    font-weight: 600;
}

.detail-divider {
    height: 1px;
    background-color: var(--p-surface-200);
    margin: 0.5rem 0;
}

.dates-row {
    display: flex;
    justify-content: space-between;
}

.date-item {
    display: flex;
    flex-direction: column;
}

.date-label {
    font-size: 0.7rem;
    color: var(--p-surface-500);
}

.date-value {
    font-size: 0.8rem;
    font-weight: 600;
}

.date-item.highlight .date-value {
    color: var(--p-primary-500);
}

.end-marker {
    text-align: center;
    font-style: italic;
    font-size: 0.8rem;
    color: var(--p-surface-400);
    margin: 2rem 0;
}

.upcoming-section {
    margin-top: 2rem;
}

.upcoming-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
}
</style>
