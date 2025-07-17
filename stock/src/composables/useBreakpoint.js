// stock/src/composables/useBreakpoint.js
import { ref, computed, onMounted, onBeforeUnmount, readonly } from 'vue';

export function useBreakpoint() {
    const deviceType = ref('desktop');

    const updateDeviceType = () => {
        const width = window.innerWidth;
        if (width < 768) {
            deviceType.value = 'mobile';
        } else if (width >= 768 && width < 1200) {
            deviceType.value = 'tablet';
        } else {
            deviceType.value = 'desktop';
        }
    };

    onMounted(() => {
        updateDeviceType();
        window.addEventListener('resize', updateDeviceType);
    });

    onBeforeUnmount(() => {
        window.removeEventListener('resize', updateDeviceType);
    });

    const isMobile = computed(() => deviceType.value === 'mobile');
    const isTablet = computed(() => deviceType.value === 'tablet');
    const isDesktop = computed(() => deviceType.value === 'desktop');

    return {
        deviceType: readonly(deviceType),
        isMobile: readonly(isMobile),
        isTablet: readonly(isTablet),
        isDesktop: readonly(isDesktop)
    };
}