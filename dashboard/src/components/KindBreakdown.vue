<script setup lang="ts">
import { ref } from 'vue';
import type { KindSummary } from '../../../framework/reporter/model';
import { pct } from '../format';

defineProps<{ kinds: KindSummary[] }>();

const LABELS: Record<string, string> = {
  link: 'Links',
  button: 'Buttons',
  input: 'Inputs',
  select: 'Selects',
  textarea: 'Text areas',
  form: 'Forms',
};

const tip = ref<{ x: number; y: number; row: KindSummary } | null>(null);
const share = (n: number, total: number) => (total ? (n / total) * 100 : 0);

function show(event: MouseEvent, row: KindSummary) {
  tip.value = { x: event.clientX, y: event.clientY, row };
}
</script>

<template>
  <div class="card">
    <div class="section-head">
      <div>
        <h2>Coverage by element type</h2>
        <p>How each kind of discovered element was exercised.</p>
      </div>
      <div class="legend">
        <span><i class="swatch s1" />Interacted in browser</span>
        <span><i class="swatch s2" />HTTP-checked only</span>
      </div>
    </div>

    <div class="rows">
      <div
        v-for="row in kinds"
        :key="row.kind"
        class="row"
        tabindex="0"
        @mousemove="show($event, row)"
        @mouseleave="tip = null"
        @focus="tip = null"
      >
        <div class="name">{{ LABELS[row.kind] }}</div>
        <div
          class="bar"
          role="img"
          :aria-label="`${LABELS[row.kind]}: ${row.interacted} interacted, ${row.verifiedOnly} HTTP-checked only, of ${row.total}`"
        >
          <div v-if="row.interacted" class="seg s1" :style="{ width: `${share(row.interacted, row.total)}%` }" />
          <div v-if="row.verifiedOnly" class="seg s2" :style="{ width: `${share(row.verifiedOnly, row.total)}%` }" />
        </div>
        <div class="value">
          <strong>{{ pct(share(row.interacted + row.verifiedOnly, row.total)) }}</strong>
          <span class="muted">{{ row.interacted + row.verifiedOnly }}/{{ row.total }}</span>
        </div>
      </div>
    </div>

    <div v-if="tip" class="tooltip" :style="{ left: `${tip.x + 14}px`, top: `${tip.y + 14}px` }">
      <div class="tip-title">{{ LABELS[tip.row.kind] }} · {{ tip.row.total }} discovered</div>
      <div>
        <i class="swatch s1" />Interacted <b>{{ tip.row.interacted }}</b>
        <span class="muted">({{ pct(share(tip.row.interacted, tip.row.total)) }})</span>
      </div>
      <div>
        <i class="swatch s2" />HTTP-checked only <b>{{ tip.row.verifiedOnly }}</b>
        <span class="muted">({{ pct(share(tip.row.verifiedOnly, tip.row.total)) }})</span>
      </div>
      <div>
        <i class="swatch none" />Not covered <b>{{ tip.row.total - tip.row.interacted - tip.row.verifiedOnly }}</b>
      </div>
    </div>
  </div>
</template>

<style scoped>
.legend {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  color: var(--text-secondary);
  font-size: 12px;
}
.swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 6px;
  vertical-align: -1px;
}
.s1 {
  background: var(--series-1);
}
.s2 {
  background: var(--series-2);
}
.swatch.none {
  background: var(--track);
  box-shadow: inset 0 0 0 1px var(--axis);
}
.rows {
  display: flex;
  flex-direction: column;
}
.row {
  display: grid;
  grid-template-columns: 92px 1fr 96px;
  align-items: center;
  gap: 14px;
  padding: 8px 6px;
  margin: 0 -6px;
  border-radius: 6px;
}
.row:hover {
  background: var(--hover);
}
.name {
  color: var(--text-secondary);
}
.bar {
  display: flex;
  height: 12px;
  border-radius: 4px;
  background: var(--track);
  overflow: hidden;
}
.seg {
  height: 100%;
  min-width: 3px;
}
/* 2px surface gap between adjacent segments */
.seg + .seg {
  border-left: 2px solid var(--surface);
}
.value {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  font-variant-numeric: tabular-nums;
}
.tooltip {
  position: fixed;
  z-index: 10;
  pointer-events: none;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.7;
}
.tip-title {
  font-weight: 600;
  margin-bottom: 2px;
}
@media (max-width: 560px) {
  .row {
    grid-template-columns: 72px 1fr 78px;
    gap: 10px;
  }
}
</style>
