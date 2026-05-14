<template>
  <div class="analysis-card surface-card border-round-xl p-4 mb-4">
    <h3 class="text-xl font-bold mb-4 text-900">Analysis</h3>
    
    <div class="grid mb-5">
      <div class="col-6 text-center">
        <div class="gauge-circle mb-2 mx-auto flex align-items-center justify-content-center">
          <span class="text-2xl font-bold text-900">98</span>
        </div>
        <div class="text-sm text-600 mb-1">DIVIDEND SAFETY</div>
        <div class="text-green-600 font-bold">Very Safe</div>
      </div>
      <div class="col-6 text-center">
        <div class="gauge-circle mb-2 mx-auto flex align-items-center justify-content-center">
          <span class="text-2xl font-bold text-900">82</span>
        </div>
        <div class="text-sm text-600 mb-1">GROWTH SCORE</div>
        <div class="text-green-600 font-bold">Strong Growth</div>
      </div>
    </div>

    <h4 class="text-sm font-bold text-600 mb-3 uppercase">Performance Relative To Benchmark</h4>
    <div class="mb-3">
      <div class="flex justify-content-between text-sm mb-1">
        <span>LONG-TERM</span>
        <span class="font-bold">STRONG</span>
      </div>
      <div class="bg-gray-200 border-round-xl h-1rem overflow-hidden">
        <div class="bg-green-600 h-full w-9"></div>
      </div>
    </div>
    <div class="mb-3">
      <div class="flex justify-content-between text-sm mb-1">
        <span>PROTECTION IN DOWN MARKETS</span>
        <span class="font-bold">SOLID</span>
      </div>
      <div class="bg-gray-200 border-round-xl h-1rem overflow-hidden">
        <div class="bg-green-600 h-full w-8"></div>
      </div>
    </div>
    <div>
      <div class="flex justify-content-between text-sm mb-1">
        <span>CURRENT YIELD</span>
        <span class="font-bold">GREAT</span>
      </div>
      <div class="bg-gray-200 border-round-xl h-1rem overflow-hidden">
        <div class="bg-green-600 h-full w-10"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Purely visual for now based on the screenshot since the backend doesn't provide these scores yet.
</script>

<style scoped>
.analysis-card {
  background-color: var(--surface-card);
  border: 1px solid var(--surface-border);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}
.gauge-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 4px solid var(--green-600);
  border-top-color: var(--green-200);
  transform: rotate(-45deg);
}
.gauge-circle span {
  transform: rotate(45deg);
}
</style>
