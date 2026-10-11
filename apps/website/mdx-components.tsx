import type { MDXComponents } from 'mdx/types';

import { BlogCodeBlock } from './src/blog/ui/BlogCodeBlock';
import { BlogDesignSystemLink } from './src/blog/ui/BlogDesignSystemLink';

const blogMDXComponents: MDXComponents = {
  a: BlogDesignSystemLink,
  pre: BlogCodeBlock,
};

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...blogMDXComponents,
    ...components,
  };
}
