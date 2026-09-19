export default function Template({ children }: { children: React.ReactNode }) {
  return <div style={{ animation: 'fade-in 0.18s var(--ease-out) both' }}>{children}</div>
}