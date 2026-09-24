import { guardPage } from '@/lib/auth/role'

// Only the roles allowed in /admin get past here (see src/lib/auth/access.ts).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await guardPage('/admin')
  return children
}
