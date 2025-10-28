<!-- src/components/asset/FamilyMemberList.vue -->
<script setup>
    import { computed } from 'vue';
    import Avatar from 'primevue/avatar';

    const props = defineProps({
        members: {
            type: Array,
            required: true,
        },
        selectedIndex: {
            type: [String, Number],
            default: '0',
        },
    });

    const emit = defineEmits(['select']);

    const getRelationshipColor = (relationship) => {
        const colors = {
            본인: 'success',
            배우자: 'warning',
            자녀: 'info',
            부모: 'help',
            기타: 'secondary',
        };
        return colors[relationship] || 'secondary';
    };

    const handleClick = (index) => {
        emit('select', index);
    };
</script>

<template>
    <div class="p-4 border-round mb-4" style="background: #f8f9fa">
        <h3 class="mb-3">👥 가족 멤버 선택:</h3>
        <div class="flex gap-2 flex-wrap">
            <button
                v-for="(member, index) in members"
                :key="member.id"
                @click="handleClick(index)"
                :class="
                    selectedIndex === String(index)
                        ? 'bg-primary text-white'
                        : ''
                "
                class="p-3 border-round border-2"
                style="min-width: 150px; border-color: #ddd">
                <div class="flex align-items-center gap-2">
                    <Avatar
                        :label="member.name.charAt(0)"
                        shape="circle"
                        :style="{
                            backgroundColor:
                                getRelationshipColor(member.relationship) ===
                                'success'
                                    ? '#4caf50'
                                    : getRelationshipColor(
                                            member.relationship
                                        ) === 'warning'
                                      ? '#ff9800'
                                      : '#2196f3',
                            color: 'white',
                        }" />
                    <div class="text-left">
                        <div class="font-bold">{{ member.name }}</div>
                        <div class="text-sm">{{ member.relationship }}</div>
                    </div>
                </div>
            </button>
            <button
                @click="handleClick(members.length)"
                :class="
                    selectedIndex === String(members.length) ? 'bg-primary' : ''
                "
                class="p-3 border-round border-2"
                style="min-width: 150px; border-color: #ddd">
                <div class="flex align-items-center gap-2">
                    <i class="pi pi-plus text-xl"></i>
                    <span class="font-bold">가족 추가</span>
                </div>
            </button>
        </div>
    </div>
</template>
