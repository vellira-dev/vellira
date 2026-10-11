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
    v-if="release"
    class="vellira-docs-release"
    href="https://www.npmjs.com/package/@vellira-ui/react"
    target="_blank"
    rel="noopener noreferrer"
    :title="`npm release v${release.version}${release.stale ? ' (cached)' : ''}`"
  >
    <span class="vellira-docs-release-source">npm</span>
    <strong aria-live="polite">v{{ release.version }}</strong>
  </a>
</template>
