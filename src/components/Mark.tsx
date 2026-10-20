/** The product's mark: the "++" of C++, drawn as two plus signs in the accent. */
export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect width="20" height="20" rx="5" fill="var(--accent-subtle)" />
      <path d="M6 7v6M3 10h6M14 7v6M11 10h6" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
