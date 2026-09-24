import { createClient } from '@/lib/supabase/server'
import { isOwner } from '@/lib/auth/role'
import RoleSelect from './RoleSelect'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLE_LABEL, ROLE_SUMMARY, asRole, type StaffRole } from '@/lib/auth/access'


export default async function StaffPage() {
  const canManage = await isOwner()
  const supabase = await createClient()

  const { data: profiles } = await supabase.from('profiles').select('*').order('created_at')
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  // Emails live with the logins, not the profiles; the owner sees them so each
  // row is recognisable. Needs the service key, which the server already has.
  const emails = new Map<string, string>()
  const admin = canManage ? createAdminClient() : null
  if (admin) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
    for (const u of data?.users ?? []) if (u.email) emails.set(u.id, u.email)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-xs tracking-[0.25em] uppercase text-gold-deep font-mono">Team</p>
        <h1 className="font-display text-2xl text-ink-strong mt-1">Staff</h1>
      </div>

      <div className="bg-gold/10 rounded-card p-4 text-sm text-gold-deep">
        To add a new staff login, invite them from your{' '}
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Supabase dashboard
        </a>{' '}
        → Authentication → Users → Add User. A profile row is created automatically with the
        &ldquo;Reception&rdquo; role — change it below if they are a dentist or an owner.
        Only the Owner can change roles, and only the Owner can view revenue and financial data.
      </div>

      <div className="bg-white rounded-card shadow-soft px-4 py-3 space-y-1.5">
        {(Object.keys(ROLE_SUMMARY) as StaffRole[]).map((r) => (
          <p key={r} className="text-sm text-ink/70">
            <span className="font-medium text-ink-strong">{ROLE_LABEL[r]}:</span> {ROLE_SUMMARY[r]}
          </p>
        ))}
      </div>

      <div className="bg-white rounded-card shadow-soft divide-y divide-ink/5">
        {profiles?.map((p) => (
          <div key={p.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm text-ink-strong font-medium">
                {p.full_name || 'Unnamed'}
                {p.id === currentUser?.id && (
                  <span className="text-xs text-teal-deep ml-2">(you)</span>
                )}
              </p>
              <p className="text-xs text-ink/50 mt-0.5">{emails.get(p.id) ?? <span className="font-mono text-ink/35">{p.id}</span>}</p>
            </div>
            {canManage ? (
              <RoleSelect profileId={p.id} currentRole={p.role} />
            ) : (
              <span className="text-xs px-3 py-1.5 rounded-full bg-marble text-ink/60 border border-ink/10">
                {ROLE_LABEL[asRole(p.role)]}
              </span>
            )}
          </div>
        ))}
        {(!profiles || profiles.length === 0) && (
          <div className="px-4 py-8 text-center text-ink/40 text-sm">No staff profiles yet.</div>
        )}
      </div>
    </div>
  )
}
