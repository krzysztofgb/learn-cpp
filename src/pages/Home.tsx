import { Suspense, use } from 'react';
import { Link } from 'react-router';
import { InlineMarkdown, Markdown } from '../components/Markdown.tsx';
import { course } from '../course/course.ts';
import { loadOverview } from '../course/content.ts';

function Overview() {
  return <Markdown text={use(loadOverview())} />;
}

export function Home() {
  return (
    <article className="page">
      <h1>{course.title}</h1>
      <p className="lede">
        30 modules in 8 phases, from integer promotion to lock-free queues and tick-to-trade. Every code sample compiles and runs in
        your browser, with undefined behavior caught by a sanitizer.
      </p>
      <h2 className="home-heading">Modules</h2>
      <div className="phase-grid">
        {course.phases.map((phase) => (
          <section key={phase.number} className="phase-card">
            <h2>
              <span className="phase-number">Phase {phase.number}</span>
              {phase.title}
            </h2>
            <ol>
              {phase.modules.map((module) => (
                <li key={module.slug}>
                  <Link to={`/modules/${module.slug}`}>
                    <span className="module-number">{String(module.number).padStart(2, '0')}</span> {module.title}
                  </Link>
                  <p className="topics">
                    <InlineMarkdown text={module.topics} />
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <section className="overview">
        <Suspense fallback={null}>
          <Overview />
        </Suspense>
      </section>
    </article>
  );
}
