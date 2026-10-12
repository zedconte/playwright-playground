<script setup lang="ts">
import type { TestStatus } from '../../../framework/reporter/model';

defineProps<{ status: TestStatus }>();

const ICON: Record<TestStatus, string> = { passed: '✓', failed: '✕', flaky: '!', skipped: '–' };
const LABEL: Record<TestStatus, string> = { passed: 'Passed', failed: 'Failed', flaky: 'Flaky', skipped: 'Skipped' };
</script>

<template>
  <span class="status" :class="status"><span class="icon" aria-hidden="true">{{ ICON[status] }}</span>{{ LABEL[status] }}</span>
</template>

<style scoped>
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.icon {
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
}
.passed .icon { background: var(--good); }
.failed .icon { background: var(--critical); }
.flaky .icon { background: var(--warning); color: #0b0b0b; }
.skipped .icon { background: var(--axis); color: var(--text-primary); }
</style>
