<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { KIND_ORDER, type CoverageModel, type ElementRow, type TestFilter } from '../../../framework/reporter/model';

const props = defineProps<{ model: CoverageModel; filter: TestFilter; page: string | null }>();
const emit = defineEmits<{ clearPage: [] }>();

const PAGE_SIZE = 100;
const query = ref('');
const kind = ref<string>('all');
const state = ref<'all' | 'uncovered' | 'covered'>('uncovered');
const limit = ref(PAGE_SIZE);
const copied = ref<string | null>(null);

type State = 'interacted' | 'verified' | 'none';

const rows = computed(() => {
  const q = query.value.trim().toLowerCase();
  const counted = (ids: number[]) => ids.filter(i => props.filter(props.model.tests[i], i));
  const pageSet = props.page ? new Set(props.model.pages.find(p => p.key === props.page)?.elements) : null;

  return props.model.elements
    .map((el, index) => {
      const interacted = counted(el.interactedBy);
      const verified = counted(el.verifiedBy);
      const status: State = interacted.length ? 'interacted' : verified.length ? 'verified' : 'none';
      return { el, index, status, by: [...new Set([...interacted, ...verified])] };
    })
    .filter(r => !pageSet || pageSet.has(r.index))
    .filter(r => kind.value === 'all' || r.el.kind === kind.value)
    .filter(r => state.value === 'all' || (state.value === 'covered') === (r.status !== 'none'))
    .filter(r => !q || `${r.el.label} ${r.el.sig} ${r.el.selector}`.toLowerCase().includes(q));
});

watch([query, kind, state, () => props.page], () => (limit.value = PAGE_SIZE));

const STATE_LABEL: Record<State, string> = { interacted: 'Interacted', verified: 'HTTP-checked', none: 'Not covered' };

function testNames(ids: number[]): string {
  return ids.map(i => props.model.tests[i].title).join('\n');
}

async function copy(el: ElementRow) {
  try {
    await navigator.clipboard.writeText(el.selector);
    copied.value = el.sig;
    setTimeout(() => (copied.value = null), 1200);
  } catch {
    /* clipboard unavailable (file:// in some browsers) */
  }
}
</script>

<template>
  <div class="card" id="elements">
    <div class="section-head">
      <div>
        <h2>Elements</h2>
        <p>Every interactive element discovery found. Uncovered ones are your test backlog.</p>
      </div>
    </div>

    <div class="toolbar">
      <input v-model="query" class="control search" type="search" placeholder="Search label, signature or selector" aria-label="Search elements" />
      <select v-model="kind" class="control" aria-label="Element kind">
        <option value="all">All kinds</option>
        <option v-for="k in KIND_ORDER" :key="k" :value="k">{{ k }}</option>
      </select>
      <div class="segmented" role="radiogroup" aria-label="Coverage state">
        <button v-for="s in (['uncovered', 'covered', 'all'] as const)" :key="s" role="radio" :aria-checked="state === s" :class="{ on: state === s }" @click="state = s">
          {{ s === 'all' ? 'All' : s === 'covered' ? 'Covered' : 'Uncovered' }}
        </button>
      </div>
      <button v-if="page" class="control chip" @click="emit('clearPage')">Page: {{ page }} <span aria-hidden="true">✕</span></button>
      <span class="muted count">{{ rows.length }} element{{ rows.length === 1 ? '' : 's' }}</span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Element</th>
            <th>Kind</th>
            <th>Status</th>
            <th>Covered by</th>
            <th>Selector</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows.slice(0, limit)" :key="r.el.sig">
            <td class="element">
              <div class="label">{{ r.el.label || '(no label)' }}</div>
              <code class="muted sig">{{ r.el.sig }}</code>
            </td>
            <td><span class="kind">{{ r.el.kind }}</span></td>
            <td>
              <span class="state" :class="r.status"><i aria-hidden="true" />{{ STATE_LABEL[r.status] }}</span>
            </td>
            <td class="by" :title="testNames(r.by)">
              <template v-if="r.by.length">
                {{ model.tests[r.by[0]].title }}
                <span v-if="r.by.length > 1" class="muted"> +{{ r.by.length - 1 }}</span>
              </template>
              <span v-else class="muted">—</span>
            </td>
            <td class="selector">
              <button class="copy" :title="`Copy ${r.el.selector}`" @click="copy(r.el)">
                <code>{{ r.el.selector }}</code>
                <span class="muted">{{ copied === r.el.sig ? 'Copied' : 'Copy' }}</span>
              </button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="5" class="muted none">No elements match these filters.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <button v-if="rows.length > limit" class="control more" @click="limit += PAGE_SIZE">
      Show {{ Math.min(PAGE_SIZE, rows.length - limit) }} more of {{ rows.length - limit }}
    </button>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.search {
  flex: 1 1 240px;
  min-width: 0;
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
  height: 30px;
  cursor: pointer;
  color: var(--text-secondary);
}
.segmented button.on {
  background: var(--text-primary);
  color: var(--surface);
}
.chip {
  cursor: pointer;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.count {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
.element {
  max-width: 420px;
}
.label {
  font-weight: 500;
}
.sig {
  display: block;
  word-break: break-all;
  font-size: 11px;
}
.kind {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text-secondary);
}
.state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.state i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}
.state.interacted i { background: var(--series-1); }
.state.verified i { background: var(--series-2); }
.state.none { color: var(--text-muted); }
.state.none i { box-shadow: inset 0 0 0 1.5px var(--text-muted); }
.by {
  max-width: 280px;
  font-size: 12px;
}
.selector {
  max-width: 300px;
}
.copy {
  display: flex;
  gap: 8px;
  align-items: baseline;
  width: 100%;
  text-align: left;
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
}
.copy code {
  word-break: break-all;
  font-size: 11px;
}
.copy .muted {
  font-size: 11px;
  opacity: 0;
}
.copy:hover .muted,
.copy:focus-visible .muted {
  opacity: 1;
}
.none {
  text-align: center;
  padding: 24px;
}
.more {
  margin-top: 12px;
  cursor: pointer;
}
</style>
