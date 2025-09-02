<template>
    <div class="company-logo-wrapper">
        <!-- 
      조건:
      1. logoSrc prop이 존재하고,
      2. 아직 이미지 로딩 에러가 발생하지 않았을 때만 img 태그를 렌더링
    -->
        <img
            v-if="logoSrc && !hasError"
            :src="fullLogoSrc"
            :alt="`${companyName} logo`"
            class="company-logo"
            @error="onImageError" />
        <!--
      조건:
      1. companyName prop이 존재하고,
      2. 위 img 태그 조건이 거짓일 때 (logoSrc가 없거나, 에러가 발생했을 때)
         대체 텍스트를 보여줌
    -->
        <span v-else-if="companyName" class="company-name-fallback">
            {{ companyName }}
        </span>
        <!-- 회사 정보가 아예 없는 경우 -->
        <span v-else></span>
    </div>
</template>

<script setup>
    import { ref, computed, watch } from 'vue';
    import { joinURL } from 'ufo';

    const props = defineProps({
        logoSrc: {
            type: String,
            default: null,
        },
        companyName: {
            type: String,
            default: '',
        },
    });

    const hasError = ref(false);

    const fullLogoSrc = computed(() => {
        if (!props.logoSrc) return '';
        // 이 코드는 이제 정상적으로 작동합니다.
        // 예: joinURL('/', 'logos/yieldmax.png') -> '/logos/yieldmax.png' (올바른 경로)
        return joinURL(import.meta.env.BASE_URL, props.logoSrc);
    });

    // 이미지 로딩 실패 시 호출될 함수
    const onImageError = () => {
        console.warn(
            `로고 파일을 찾거나 로드할 수 없습니다: ${fullLogoSrc.value}`
        );
        hasError.value = true;
    };

    // [핵심 추가] prop이 변경될 때 hasError 상태를 리셋
    // 다른 종목으로 넘어갔을 때, 이전 종목의 에러 상태가 남아있는 것을 방지
    watch(
        () => props.logoSrc,
        (newSrc) => {
            // 새로운 로고 경로가 생기면 에러 상태를 초기화
            if (newSrc) {
                hasError.value = false;
            }
        }
    );
</script>

<style scoped>
    /* 이전과 동일한 스타일 */
    /* ... */
</style>

<style scoped>
    .company-logo-wrapper {
        /* 정사각형 비율 유지를 위한 스타일 */
        width: 100%;
        height: 0;
        padding-bottom: 100%; /* 너비와 동일한 높이를 만듦 (1:1 비율) */
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        font-weight: 500;
        text-align: center;
        overflow: hidden; /* 로고가 튀어나가는 것을 방지 */
    }

    .company-logo,
    .company-name-fallback {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }

    .company-logo {
        /* 로고가 찌그러지지 않고 컨테이너 안에 맞게 표시되도록 함 */
        object-fit: contain;
        padding: 4px; /* 로고 주변에 약간의 여백 */
    }

    .company-name-fallback {
        /* 텍스트가 중앙에 오도록 함 */
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1.2;
    }
</style>
