<script setup lang="ts">
import { computed } from 'vue';
import type { Ratio } from '../../../framework/reporter/model';
import MeterBar from './MeterBar.vue';
import { pct } from '../format';

const props = defineProps<{ label: string; ratio: Ratio; noun: string; target?: number }>();
const met = computed(() => props.target === undefined || props.ratio.pct >= props.target);
</script>

<template>
  <div class="card tile">
    <div class="label">{{ label }}</div>
    <div class="value">{{ ratio.total ? pct(ratio.pct) : '—' }}</div>
    <div class="detail">{{ ratio.covered }} of {{ ratio.total }} {{ noun }}</div>
    <MeterBar :pct="ratio.pct" :target="target" />
    <div v-if="target !== undefined" class="target" :class="{ met }">
      <span aria-hidden="true">{{ met ? '✓' : '!' }}</span> {{ met ? 'Meets' : 'Below' }} {{ target }}% target
    </div>
  </div>
</template>

<style scoped>
.tile {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.label {
  color: var(--text-secondary);
  font-weight: 500;
}
.value {
  font-size: 34px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
}
.detail {
  color: var(--text-muted);
  margin-bottom: 6px;
}
.target {
  font-size: 12px;
  color: var(--critical-text);
  margin-top: 2px;
}
.target.met {
  color: var(--good-text);
}
</style>
