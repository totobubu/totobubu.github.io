<script setup>
defineProps({
  icon: {
    type: String,
    required: false,
  },
  brand: {
    type: String,
    required: false,
  },
  title: {
    type: String,
    required: true,
  },
  msg: {
    type: String,
    required: false,
  },
})
</script>

<template>

<div class="bg-surface-0 dark:bg-surface-950">
        <ul class="list-none p-0 m-0 flex items-center font-medium mb-4">
            <li class="px-2">
                <i v-if="icon" class="pi  text-surface-500 dark:text-surface-300 !text-sm !leading-normal"  :class="icon" />
              </li>
            <li>
                <a class="text-surface-500 dark:text-surface-300 no-underline leading-normal cursor-pointer">Application</a>
            </li>
            <li class="px-2">
                <i class="pi pi-angle-right text-surface-500 dark:text-surface-300 !text-sm !leading-normal" />
            </li>
            <li>
                <span class="text-surface-900 dark:text-surface-0 leading-normal">{{ brand }}</span>
            </li>
        </ul>
        <div class="flex items-start flex-col md:justify-between md:flex-row">
            <div>
                <div class="font-bold text-3xl text-surface-900 dark:text-surface-0 mb-4">{{ title }}</div>
                <div class="flex items-center text-surface-700 dark:text-surface-300 flex-wrap gap-8">
                    <div class="flex items-center gap-2">
                        <i class="pi pi-users !text-base !leading-normal" />
                        <span>{{ msg }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <i class="pi pi-globe !text-base !leading-normal" />
                        <span>{{ msg }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <i class="pi pi-clock !text-base !leading-normal" />
                        <span>{{ msg }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

</template>

