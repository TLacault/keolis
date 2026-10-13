<script setup lang="ts">
const props = withDefaults(defineProps<{ line: LineId, size?: number }>(), { size: 44 })
</script>

<template>
  <span
    class="inline-grid shrink-0 place-items-center rounded-full font-display font-bold text-white"
    :style="{ background: LINES[props.line].color, width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.55}px` }"
    :aria-label="LINES[props.line].name"
  >{{ props.line }}</span>
</template>
