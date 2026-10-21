import type { Element } from 'hast';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Link } from 'react-router';
import remarkGfm from 'remark-gfm';
import { snippetFromFence } from '../course/fence.ts';
import { CodeBlock } from './CodeBlock.tsx';

/** One line of Markdown (inline code, emphasis, links) without a wrapping paragraph. */
export function InlineMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} allowedElements={['code', 'em', 'strong', 'a', 'del']} unwrapDisallowed>
      {text}
    </ReactMarkdown>
  );
}

function textOf(node: Element): string {
  return node.children.map((child) => (child.type === 'text' ? child.value : child.type === 'element' ? textOf(child) : '')).join('');
}

const components: Components = {
  // Fenced code becomes a CodeBlock; the fence's info string (language + run metadata) decides its buttons.
  pre({ node }) {
    const code = node?.children.find((child): child is Element => child.type === 'element' && child.tagName === 'code');
    if (!code) return null;
    const language = ((code.properties.className as string[] | undefined) ?? []).find((name) => name.startsWith('language-'))?.slice(9) ?? '';
    const meta = (code.data as { meta?: string } | undefined)?.meta ?? '';
    return <CodeBlock snippet={snippetFromFence(`${language} ${meta}`, textOf(code).replace(/\n$/, ''))} />;
  },
  a({ href, children }) {
    // Links between modules (from :mod[…] references) stay inside the app.
    if (href?.startsWith('/')) return <Link to={href}>{children}</Link>;
    const external = href?.startsWith('http');
    return (
      <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="table-wrap">
        <table>{children}</table>
      </div>
    );
  },
};

export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
