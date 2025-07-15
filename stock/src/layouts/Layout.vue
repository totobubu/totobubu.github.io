<script setup>
import { RouterView } from 'vue-router'
import AppTopbar from "./AppTopbar.vue";
</script>

<template>
    <div class="layout-container">
        <div class="layout-grid">
            <AppTopbar />
            <RouterView />
        </div>
    </div>
</template>
