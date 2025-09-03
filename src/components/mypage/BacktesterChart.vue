<script setup>
    import Chart from 'primevue/chart';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    // ...
    defineProps({ result: Object, isLoading: Boolean });
</script>

<template>
    <div v-if="isLoading" class="text-center p-4">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
        <p>과거 데이터를 기반으로 시뮬레이션 중입니다...</p>
    </div>
    <div v-else-if="result" class="grid">
        <div class="col-12">
            <Chart type="line" :data="result.chartData" />
        </div>
        <div v-if="result.cashDividends" class="col-12">
            <h3>누적 현금 배당금 내역</h3>
            <DataTable :value="result.cashDividends">
                <Column field="date" header="지급일"></Column>
                <Column field="amount" header="세후 배당금 (USD)"></Column>
                <Column field="ticker" header="종목"></Column>
            </DataTable>
        </div>
    </div>
    <div v-else class="text-center p-4 text-surface-500">
        <p>북마크 목록에서 4개 종목을 선택하고 백테스팅을 실행해주세요.</p>
    </div>
</template>
