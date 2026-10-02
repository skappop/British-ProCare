import { guardPage } from '@/lib/auth/role'

export default async function DoctorsLayout({ children }: { children: React.ReactNode }) {
  await guardPage('/doctors')
  return children
}
