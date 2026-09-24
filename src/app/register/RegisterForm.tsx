'use client'

import { useActionState, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { submitRegistration, type RegisterState } from './actions'

const input =
  'w-full rounded-control border border-ink/15 bg-white px-3.5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-teal'

function FieldError({ text }: { text?: string }) {
  return text ? <p className="text-danger text-xs mt-1.5">{text}</p> : null
}

/**
 * Kept deliberately short: who you are, why you're coming, and anything the
 * doctor should know. Everything else is asked at the clinic.
 */
export default function RegisterForm() {
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
          We have your details. When you arrive, just give your name at reception.
        </p>
      </div>
    )
  }

  const errors = state.fieldErrors ?? {}

  return (
    <form action={action} className="bg-white rounded-card shadow-soft p-6 space-y-5">
      <div>
        <h1 className="font-display text-2xl text-ink-strong">Before your visit</h1>
        <p className="text-ink/55 mt-1">It takes a minute and saves time at reception.</p>
      </div>

      {state.message && !state.ok && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control">{state.message}</div>
      )}

      {/* Hidden from people; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <input type="hidden" name="started_at" value={startedAt} />

      <label className="block">
        <span className="block text-sm font-medium text-ink-strong mb-1.5">Full name</span>
        <input name="full_name" required autoComplete="name" className={input} />
        <FieldError text={errors.full_name} />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-ink-strong mb-1.5">Mobile number</span>
        <input name="phone" required type="tel" autoComplete="tel" inputMode="tel" className={input} />
        <FieldError text={errors.phone} />
      </label>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <label className="block">
          <span className="block text-sm font-medium text-ink-strong mb-1.5">
            Date of birth <span className="font-normal text-ink/40">(optional)</span>
          </span>
          <input name="date_of_birth" type="date" className={input} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-ink-strong mb-1.5">&nbsp;</span>
          <select name="gender" className={input} defaultValue="" aria-label="Gender (optional)">
            <option value="">Gender</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-ink-strong mb-1.5">
          What brings you in? <span className="font-normal text-ink/40">(optional)</span>
        </span>
        <input name="reason" placeholder="e.g. toothache, check-up, braces" className={input} />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-ink-strong mb-1.5">
          Anything the doctor should know? <span className="font-normal text-ink/40">(optional)</span>
        </span>
        <textarea
          name="health_note"
          rows={2}
          placeholder="Allergies, medical conditions, medicines, pregnancy…"
          className={input}
        />
      </label>

      <label className="flex items-start gap-3 text-sm text-ink/70">
        <input type="checkbox" name="consent" className="h-5 w-5 rounded mt-0.5 shrink-0" />
        <span>My details are correct, and British ProCare may keep them for my dental care.</span>
      </label>
      <FieldError text={errors.consent} />

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-teal hover:bg-teal-deep text-white rounded-control py-3.5 text-base font-medium transition-colors disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send'}
      </button>
    </form>
  )
}
