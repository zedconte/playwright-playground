<script setup lang="ts">
/** Single-series part-to-whole bar, with an optional target tick. */
defineProps<{ pct: number; target?: number; size?: 'sm' | 'md' }>();
</script>

<template>
  <div class="meter" :class="size ?? 'md'" role="presentation">
    <div class="fill" :style="{ width: `${Math.min(100, pct)}%` }" />
    <div v-if="target !== undefined" class="target" :style="{ left: `${target}%` }" />
  </div>
</template>

<style scoped>
.meter {
  position: relative;
  height: 8px;
  border-radius: 4px;
  background: var(--track);
}
.meter.sm {
  height: 6px;
  border-radius: 3px;
}
.fill {
  height: 100%;
  border-radius: inherit;
  background: var(--series-1);
}
.target {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  margin-left: -1px;
  background: var(--text-secondary);
  border-radius: 1px;
}
</style>
