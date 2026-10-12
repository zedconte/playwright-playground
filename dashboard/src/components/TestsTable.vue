<script setup lang="ts">
import { computed, ref } from 'vue';
import type { CoverageModel, TestFilter } from '../../../framework/reporter/model';
import StatusBadge from './StatusBadge.vue';
import { duration } from '../format';

const props = defineProps<{ model: CoverageModel; filter: TestFilter }>();

type SortKey = 'title' | 'status' | 'duration' | 'touched' | 'unique';
const sortKey = ref<SortKey>('unique');
const ascending = ref(false);

/** Elements only this test covers, among the tests the current filter counts. */
const unique = computed(() => {
  const counts = props.model.tests.map(() => 0);
  for (const el of props.model.elements) {
    const by = new Set([...el.interactedBy, ...el.verifiedBy].filter(i => props.filter(props.model.tests[i], i)));
    if (by.size === 1) counts[[...by][0]]++;
  }
  return counts;
});

const rows = computed(() => {
  const list = props.model.tests.map((test, i) => ({
    test,
    i,
    counted: props.filter(test, i),
    unique: unique.value[i],
  }));
  const value = (r: (typeof list)[number]): string | number =>
    sortKey.value === 'title'
      ? r.test.title
      : sortKey.value === 'status'
        ? r.test.status
        : sortKey.value === 'duration'
          ? r.test.durationMs
          : sortKey.value === 'touched'
            ? r.test.touched
            : r.unique;
  return list.sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    const order = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
    return (ascending.value ? order : -order) || a.test.title.localeCompare(b.test.title);
  });
});

function sortBy(key: SortKey) {
  if (sortKey.value === key) ascending.value = !ascending.value;
  else [sortKey.value, ascending.value] = [key, key === 'title' || key === 'status'];
}
const arrow = (key: SortKey) => (sortKey.value === key ? (ascending.value ? ' ↑' : ' ↓') : '');
</script>

<template>
  <div class="card">
    <div class="section-head">
      <div>
        <h2>Tests</h2>
        <p>What each test contributes. Dimmed rows are excluded by the current filter.</p>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="sortable" @click="sortBy('title')">Test{{ arrow('title') }}</th>
            <th>Source</th>
            <th class="sortable" @click="sortBy('status')">Status{{ arrow('status') }}</th>
            <th class="sortable num" @click="sortBy('duration')">Duration{{ arrow('duration') }}</th>
            <th class="sortable num" @click="sortBy('touched')">Elements{{ arrow('touched') }}</th>
            <th class="sortable num" title="Elements no other counted test covers" @click="sortBy('unique')">
              Unique{{ arrow('unique') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.i" :class="{ dim: !r.counted }">
            <td>
              <div class="title">{{ r.test.title }}</div>
              <code class="muted">{{ r.test.file }}:{{ r.test.line }}</code>
            </td>
            <td>
              <span class="source" :class="{ discovered: r.test.discovered }">{{
                r.test.discovered ? 'Discovered' : 'Authored'
              }}</span>
            </td>
            <td><StatusBadge :status="r.test.status" /></td>
            <td class="num">{{ duration(r.test.durationMs) }}</td>
            <td class="num">{{ r.test.touched }}</td>
            <td class="num">{{ r.counted ? r.unique : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.title {
  font-weight: 500;
}
tr.dim td {
  opacity: 0.45;
}
.source {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text-primary);
  white-space: nowrap;
}
.source.discovered {
  color: var(--text-secondary);
  border-style: dashed;
}
</style>
