<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

import {
  observePublicRelease,
  type PublishedRelease,
} from '../../../../../scripts/public-release/client';

const release = ref<PublishedRelease | null>(null);
let unsubscribe = () => {};

onMounted(() => {
  unsubscribe = observePublicRelease((next) => {
    release.value = next;
  });
});

onUnmounted(() => unsubscribe());
</script>

<template>
  <a
    class="vellira-docs-release"
    href="https://www.npmjs.com/package/@vellira-ui/react"
    target="_blank"
    rel="noopener noreferrer"
    :title="
      release
        ? `Latest confirmed npm version v${release.version}${release.stale ? ' (cached verification)' : ''}`
        : 'Latest npm release unavailable'
    "
  >
    <span>npm</span>
    <strong aria-live="polite">
      {{ release ? `v${release.version}` : '—' }}
    </strong>
  </a>
</template>
