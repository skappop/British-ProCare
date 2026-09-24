import { guardPage } from '@/lib/auth/role'

// Only the roles allowed in /procedures get past here (see src/lib/auth/access.ts).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await guardPage('/procedures')
  return children
}
