import { guardPage } from '@/lib/auth/role'

// Deciding what each container holds is for the owner and dentists (see src/lib/auth/access.ts).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await guardPage('/stock/setup')
  return children
}
