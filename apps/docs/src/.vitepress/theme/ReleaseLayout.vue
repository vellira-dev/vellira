<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';

import PublicReleaseBadge from './PublicReleaseBadge.vue';

const { Layout } = DefaultTheme;
</script>

<template>
  <Layout>
    <template #nav-bar-content-after>
      <PublicReleaseBadge />
    </template>
    <template #nav-screen-content-after>
      <div class="vellira-docs-release-mobile">
        <PublicReleaseBadge />
      </div>
    </template>
  </Layout>
</template>
