import DefaultTheme from 'vitepress/theme';
import StorybookFrame from './StorybookFrame.vue';
import '@vellira-ui/assets/styles';
import '@vellira-ui/tokens/css';
import './layout-stability.css';
import './styles.css';

export default {
  extends: DefaultTheme,
  enhanceApp({
    app,
  }: {
    app: { component: (name: string, component: unknown) => void };
  }) {
    app.component('StorybookFrame', StorybookFrame);
  },
};
