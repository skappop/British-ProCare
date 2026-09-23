'use client'

import { useActionState, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { submitRegistration, type RegisterState } from './actions'

const input =
  'w-full rounded-control border border-ink/15 bg-white px-3.5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-teal'

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="block mb-1.5">
      <span className="text-sm font-medium text-ink-strong">{children}</span>
      {hint && <span className="block text-xs text-ink/45 mt-0.5">{hint}</span>}
    </span>
  )
}

function FieldError({ text }: { text?: string }) {
  return text ? <p className="text-danger text-xs mt-1.5">{text}</p> : null
}

export default function RegisterForm({ clinics }: { clinics: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(submitRegistration, {
    ok: false,
  })
  // Set once on the client: the server rejects submissions that arrive faster
  // than a person could fill the form in.
  const [startedAt] = useState(() => Date.now())

  if (state.ok) {
    return (
      <div className="bg-white rounded-card shadow-soft p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 size={28} />
        </div>
        <h1 className="font-display text-2xl text-ink-strong mt-5">Thank you, {state.firstName}</h1>
        <p className="text-ink/60 mt-3 leading-relaxed">
          Your details are with us. When you arrive, just give your name at reception — there is
          nothing else to fill in.
        </p>
      </div>
    )
  }

  const errors = state.fieldErrors ?? {}

  return (
    <form action={action} className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-ink-strong">Before your visit</h1>
        <p className="text-ink/60 mt-2 leading-relaxed">
          Filling this in now saves time at reception. It takes about two minutes, and only the
          clinic team can see it.
        </p>
      </div>

      {state.message && !state.ok && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control">{state.message}</div>
      )}

      {/* Hidden from people; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <input type="hidden" name="started_at" value={startedAt} />

      <section className="bg-white rounded-card shadow-soft p-6 space-y-5">
        <h2 className="font-display text-lg text-ink-strong">About you</h2>

        <label className="block">
          <Label>Full name *</Label>
          <input name="full_name" required autoComplete="name" className={input} />
          <FieldError text={errors.full_name} />
        </label>

        <label className="block">
          <Label>Mobile number *</Label>
          <input name="phone" required type="tel" autoComplete="tel" inputMode="tel" className={input} />
          <FieldError text={errors.phone} />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <Label>Date of birth</Label>
            <input name="date_of_birth" type="date" className={input} />
          </label>
          <label className="block">
            <Label>Gender</Label>
            <select name="gender" className={input} defaultValue="">
              <option value="">—</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </label>
        </div>

        {clinics.length > 1 && (
          <label className="block">
            <Label>Which clinic are you visiting?</Label>
            <select name="preferred_clinic_id" className={input} defaultValue="">
              <option value="">Not sure</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <Label hint="Optional — e.g. check-up, pain in a tooth, braces">Reason for your visit</Label>
          <textarea name="reason" rows={2} className={input} />
        </label>
      </section>

      <section className="bg-white rounded-card shadow-soft p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg text-ink-strong">Your health</h2>
          <p className="text-sm text-ink/55 mt-1">
            This keeps your treatment safe. Leave anything blank that doesn&apos;t apply.
          </p>
        </div>

        <label className="block">
          <Label hint="Medicines, latex, anaesthetics, foods…">Allergies</Label>
          <textarea name="allergies" rows={2} className={input} />
        </label>

        <label className="block">
          <Label hint="e.g. diabetes, heart conditions, blood pressure, bleeding disorders">
            Medical conditions
          </Label>
          <textarea name="conditions" rows={2} className={input} />
        </label>

        <label className="block">
          <Label>Medicines you take regularly</Label>
          <textarea name="medications" rows={2} className={input} />
        </label>

        <label className="flex items-center gap-3 text-sm text-ink-strong">
          <input type="checkbox" name="pregnant" className="h-5 w-5 rounded" />
          I am pregnant or breastfeeding
        </label>

        <label className="block">
          <Label>Anything else the dentist should know</Label>
          <textarea name="notes" rows={2} className={input} />
        </label>
      </section>

      <section className="bg-white rounded-card shadow-soft p-6">
        <label className="flex items-start gap-3 text-sm text-ink-strong">
          <input type="checkbox" name="consent" className="h-5 w-5 rounded mt-0.5 shrink-0" />
          <span>
            The information above is accurate to the best of my knowledge, and I agree to British
            ProCare storing it for my dental care.
          </span>
        </label>
        <FieldError text={errors.consent} />
      </section>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-teal hover:bg-teal-deep text-white rounded-control py-3.5 text-base font-medium transition-colors disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send my details'}
      </button>
    </form>
  )
}
