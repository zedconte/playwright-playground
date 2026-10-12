<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { summarize, testFilter, type CoverageModel, type TestStatus } from '../../framework/reporter/model';
import StatTile from './components/StatTile.vue';
import StatusBadge from './components/StatusBadge.vue';
import KindBreakdown from './components/KindBreakdown.vue';
import PagesTable from './components/PagesTable.vue';
import ElementsTable from './components/ElementsTable.vue';
import TestsTable from './components/TestsTable.vue';
import { dateTime, duration, timeAgo } from './format';

const props = defineProps<{ model: CoverageModel }>();

const source = ref<'all' | 'authored' | 'discovered'>('all');
const passingOnly = ref(false);
const selectedPage = ref<string | null>(null);

const filter = computed(() => testFilter(source.value, passingOnly.value));
const summary = computed(() => summarize(props.model, filter.value));
const meta = computed(() => props.model.meta);
const counts = computed(() => ({
  all: props.model.tests.length,
  authored: props.model.tests.filter(t => !t.discovered).length,
  discovered: props.model.tests.filter(t => t.discovered).length,
}));
const STATUSES: TestStatus[] = ['passed', 'failed', 'flaky', 'skipped'];

async function selectPage(key: string) {
  selectedPage.value = selectedPage.value === key ? null : key;
  await nextTick();
  if (selectedPage.value) document.getElementById('elements')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div>
        <div class="eyebrow">Test coverage</div>
        <h1>{{ meta.title }}</h1>
        <div class="meta">
          <a :href="meta.baseURL" target="_blank" rel="noopener">{{ meta.baseURL }}</a>
          <span>Run {{ dateTime(meta.generatedAt) }} · {{ duration(meta.durationMs) }}</span>
          <span>Discovery {{ timeAgo(meta.inventoryGeneratedAt) }}</span>
        </div>
      </div>
      <div class="run" :class="meta.status">
        <StatusBadge :status="meta.status === 'passed' ? 'passed' : 'failed'" />
        <span class="muted">{{ model.tests.length }} tests</span>
      </div>
    </header>

    <div v-if="!meta.inventoryGeneratedAt" class="card notice">
      No discovery inventory was found, so there is nothing to measure against. Run <code>npm run discover</code>, then the tests again.
    </div>

    <div class="filters" role="group" aria-label="Which tests count toward coverage">
      <span class="muted">Count coverage from</span>
      <div class="segmented" role="radiogroup">
        <button
          v-for="s in (['all', 'authored', 'discovered'] as const)"
          :key="s"
          role="radio"
          :aria-checked="source === s"
          :class="{ on: source === s }"
          @click="source = s"
        >
          {{ s === 'all' ? 'All tests' : s === 'authored' ? 'Authored' : 'Discovered' }}
          <span class="n">{{ counts[s] }}</span>
        </button>
      </div>
      <label class="check"><input v-model="passingOnly" type="checkbox" /> Passing tests only</label>
    </div>

    <section class="tiles">
      <StatTile label="Pages visited" :ratio="summary.pages" noun="pages" :target="meta.thresholds.pages" />
      <StatTile label="Elements covered" :ratio="summary.elements" noun="elements" :target="meta.thresholds.elements" />
      <StatTile label="Forms submitted" :ratio="summary.forms" noun="forms" :target="meta.thresholds.forms" />
      <div class="card tests-tile">
        <div class="label">Tests</div>
        <div class="value">{{ model.tests.length }}</div>
        <ul>
          <li v-for="s in STATUSES" :key="s" :class="{ zero: !summary.tests[s] }">
            <StatusBadge :status="s" /><span class="num">{{ summary.tests[s] }}</span>
          </li>
        </ul>
      </div>
    </section>

    <KindBreakdown :kinds="summary.byKind" />

    <div class="split">
      <PagesTable :model="model" :filter="filter" :selected="selectedPage" @select="selectPage" />
      <ElementsTable :model="model" :filter="filter" :page="selectedPage" @clear-page="selectedPage = null" />
    </div>

    <TestsTable :model="model" :filter="filter" />

    <div v-if="model.outside.pages.length || model.outside.elements.length" class="card">
      <div class="section-head">
        <div>
          <h2>Outside the inventory</h2>
          <p>Tests reached these, but discovery did not. Widen <code>crawl</code> or <code>includeHidden</code> in the site profile to measure them.</p>
        </div>
      </div>
      <div class="outside">
        <div v-if="model.outside.pages.length">
          <h3>Pages</h3>
          <ul><li v-for="p in model.outside.pages" :key="p.key"><code>{{ p.key }}</code></li></ul>
        </div>
        <div v-if="model.outside.elements.length">
          <h3>Elements</h3>
          <ul><li v-for="e in model.outside.elements" :key="e.sig"><code>{{ e.sig }}</code></li></ul>
        </div>
      </div>
    </div>

    <footer class="muted">
      Generated by the coverage reporter · site profile <code>{{ meta.site }}</code>
    </footer>
  </div>
</template>

<style scoped>
.page {
  max-width: 1240px;
  margin: 0 auto;
  padding: 32px 24px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}
.eyebrow {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
h1 {
  font-size: 26px;
  margin: 2px 0 6px;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  color: var(--text-secondary);
}
.run {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
}
.notice {
  border-left: 3px solid var(--warning);
}
.filters {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 10px 0;
  background: var(--page);
}
.segmented {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface-raised);
}
.segmented button {
  border: 0;
  background: none;
  padding: 0 12px;
  height: 32px;
  cursor: pointer;
  color: var(--text-secondary);
}
.segmented button.on {
  background: var(--text-primary);
  color: var(--surface);
}
.segmented .n {
  margin-left: 4px;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
.check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.tests-tile .label {
  color: var(--text-secondary);
  font-weight: 500;
}
.tests-tile .value {
  font-size: 34px;
  font-weight: 600;
  line-height: 1.1;
  margin: 6px 0 10px;
}
.tests-tile ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
}
.tests-tile li {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.tests-tile li.zero {
  opacity: 0.5;
}
.split {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
}
.outside {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}
.outside h3 {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.outside ul {
  margin: 0;
  padding-left: 18px;
  line-height: 1.8;
}
footer {
  font-size: 12px;
  text-align: center;
}
@media (max-width: 980px) {
  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .page {
    padding: 20px 16px 40px;
  }
  .tiles {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
