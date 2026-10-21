/**
 * A Suspense fallback shaped like the page that is loading, so nothing jumps when it arrives.
 * It appears only after 150 ms (styles.css): a load from the service worker's cache shows nothing.
 * `blocks` are the heights of the content placeholders, top to bottom.
 */
export function PageSkeleton({ label, title = false, tabs = false, blocks }: { label: string; title?: boolean; tabs?: boolean; blocks: number[] }) {
  return (
    <div className="page-skeleton" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {title && (
        <div className="skeleton-title" aria-hidden="true">
          <span className="bone" />
          <span className="bone" />
        </div>
      )}
      {tabs && <div className="skeleton-tabs" aria-hidden="true" />}
      {blocks.map((height, i) => (
        <span key={i} className="bone skeleton-block" style={{ height }} aria-hidden="true" />
      ))}
    </div>
  );
}
