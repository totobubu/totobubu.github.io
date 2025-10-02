// NEW FILE: src/components/ThemeToggler.vue
<script setup>
    import Button from 'primevue/button';
    import { useLayout } from '@/composables/useLayout';

    const { isDarkMode, toggleDarkMode } = useLayout();
</script>

<template>
    <Button
        :icon="isDarkMode ? 'pi pi-sun' : 'pi pi-moon'"
        variant="text"
        @click="toggleDarkMode"
        aria-label="Toggle Dark Mode" />
</template>
