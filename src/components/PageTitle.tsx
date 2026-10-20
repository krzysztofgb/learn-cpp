/** The document title for a route (React hoists it into <head>), so tabs, history and screen readers name the page. */
export function PageTitle({ children }: { children: string }) {
  return <title>{`${children} · learn-cpp`}</title>;
}
