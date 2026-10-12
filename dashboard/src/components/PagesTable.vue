<script setup lang="ts">
import { computed, ref } from 'vue';
import { pageCoverage, type CoverageModel, type TestFilter } from '../../../framework/reporter/model';
import MeterBar from './MeterBar.vue';
import { pct } from '../format';

const props = defineProps<{ model: CoverageModel; filter: TestFilter; selected: string | null }>();
const emit = defineEmits<{ select: [key: string] }>();

type SortKey = 'key' | 'visits' | 'coverage' | 'elements';
const sortKey = ref<SortKey>('coverage');
const ascending = ref(true);

const rows = computed(() => {
  const list = props.model.pages.map(page => ({
    page,
    visits: page.visitedBy.filter(i => props.filter(props.model.tests[i], i)).length,
    coverage: pageCoverage(props.model, page, props.filter),
  }));
  const value = (r: (typeof list)[number]) =>
    sortKey.value === 'key'
      ? r.page.key
      : sortKey.value === 'visits'
        ? r.visits
        : sortKey.value === 'elements'
          ? r.page.elements.length
          : r.coverage.pct;
  return list.sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    const order = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
    return ascending.value ? order : -order;
  });
});

function sortBy(key: SortKey) {
  if (sortKey.value === key) ascending.value = !ascending.value;
  else [sortKey.value, ascending.value] = [key, key === 'key'];
}
const arrow = (key: SortKey) => (sortKey.value === key ? (ascending.value ? ' ↑' : ' ↓') : '');
</script>

<template>
  <div class="card">
    <div class="section-head">
      <div>
        <h2>Pages</h2>
        <p>Every page discovery reached. Select a page to see its elements.</p>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="sortable" @click="sortBy('key')">Page{{ arrow('key') }}</th>
            <th>Template</th>
            <th class="sortable num" @click="sortBy('visits')">Visited by{{ arrow('visits') }}</th>
            <th class="sortable num" @click="sortBy('elements')">Elements{{ arrow('elements') }}</th>
            <th class="sortable coverage" @click="sortBy('coverage')">Element coverage{{ arrow('coverage') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in rows"
            :key="r.page.key"
            :class="{ selected: selected === r.page.key }"
            tabindex="0"
            @click="emit('select', r.page.key)"
            @keydown.enter="emit('select', r.page.key)"
          >
            <td>
              <div class="key">{{ r.page.key }}</div>
              <div class="muted title">{{ r.page.title }}</div>
            </td>
            <td>
              <code class="muted">{{ r.page.template }}</code>
            </td>
            <td class="num">
              <span v-if="r.visits">{{ r.visits }} {{ r.visits === 1 ? 'test' : 'tests' }}</span>
              <span v-else class="unvisited"><span aria-hidden="true">○</span> Not visited</span>
            </td>
            <td class="num">{{ r.page.elements.length }}</td>
            <td class="coverage">
              <div class="cov">
                <MeterBar :pct="r.coverage.pct" size="sm" />
                <span class="num">{{ pct(r.coverage.pct) }}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
tbody tr {
  cursor: pointer;
}
tr.selected {
  background: var(--hover);
  box-shadow: inset 3px 0 0 var(--series-1);
}
.key {
  font-weight: 500;
  word-break: break-all;
}
.title {
  font-size: 12px;
}
.unvisited {
  color: var(--text-muted);
  white-space: nowrap;
}
.coverage {
  width: 34%;
  min-width: 180px;
}
.cov {
  display: grid;
  grid-template-columns: 1fr 44px;
  align-items: center;
  gap: 10px;
}
.cov .num {
  text-align: right;
}
</style>
