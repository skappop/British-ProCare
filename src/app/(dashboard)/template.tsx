export default function Template({ children }: { children: React.ReactNode }) {
  return <div style={{ animation: 'fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>{children}</div>
}