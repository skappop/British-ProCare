'use client'

import { useState } from 'react'
import { Check, TriangleAlert } from 'lucide-react'
import type {
  PaymentSummary,
  Procedure,
  ReceptionPatient,
  SafetyAlerts,
  SavedVisit,
  StepKey,
  TodayAppointment,
} from './types'
import { STEPS } from './types'
import { linkAppointmentToVisit } from './receptionActions'
import StepIdentify from './steps/StepIdentify'
import Link from 'next/link'
import StepSafety from './steps/StepSafety'
import StepSendToClinic from './steps/StepSendToClinic'
import StepVisit from './steps/StepVisit'
import StepPayment from './steps/StepPayment'
import StepDone from './steps/StepDone'

export default function ReceptionFlow({
  procedures,
  todayAppointments,
  initialPatient = null,
  initialAppointmentId = null,
}: {
  procedures: Procedure[]
  todayAppointments: TodayAppointment[]
  initialPatient?: ReceptionPatient | null
  initialAppointmentId?: string | null
}) {
  // When arriving from an appointment (Start visit), jump straight past identify.
  const [step, setStep] = useState<StepKey>(initialPatient ? 'safety' : 'identify')
  const [patient, setPatient] = useState<ReceptionPatient | null>(initialPatient)
  const [appointmentId, setAppointmentId] = useState<string | null>(initialAppointmentId)
  const [alerts, setAlerts] = useState<SafetyAlerts | null>(null)
  const [visit, setVisit] = useState<SavedVisit | null>(null)
  const [nextVisitWeeks, setNextVisitWeeks] = useState<number | null>(null)
  const [payment, setPayment] = useState<PaymentSummary | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const currentIndex = STEPS.findIndex((s) => s.key === step)

  function reset() {
    setPatient(null)
    setAppointmentId(null)
    setAlerts(null)
    setVisit(null)
    setNextVisitWeeks(null)
    setPayment(null)
    setSentTo(null)
    setStep('identify')
  }

  function handleVisitSaved(saved: SavedVisit, weeks: number | null) {
    setVisit(saved)
    setNextVisitWeeks(weeks)
    if (appointmentId && saved.id) {
      // Close the loop on the booked slot — non-blocking.
      linkAppointmentToVisit(appointmentId, saved.id).catch(() => {})
    }
    setStep('payment')
  }

  const showAlertBanner =
    !!alerts && (alerts.allergies || alerts.pregnant) && step !== 'identify' && step !== 'safety'

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs tracking-[0.25em] uppercase text-gold-deep font-mono">Reception</p>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-3xl text-ink-strong mt-1.5">Walk-In</h1>
          {patient && (
            <span className="text-sm text-ink/50 font-mono truncate">
              {patient.full_name}
              {patient.phone ? ` · ${patient.phone}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Progress rail */}
      <ol className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          return (
            <li key={s.key} className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-mono transition-colors ${
                    active
                      ? 'bg-teal text-white'
                      : done
                        ? 'bg-gold-deep text-white'
                        : 'bg-ink/10 text-ink/40'
                  }`}
                >
                  {done ? <Check size={13} /> : i + 1}
                </span>
                <span
                  className={`hidden sm:block text-xs transition-colors ${
                    active ? 'text-ink-strong font-medium' : done ? 'text-ink/60' : 'text-ink/35'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px mt-2 mr-1 ${done ? 'bg-gold-deep/40' : 'bg-ink/10'}`} />
              )}
            </li>
          )
        })}
      </ol>

      {/* Persistent safety banner during treatment/payment/done */}
      {showAlertBanner && (
        <div className="mb-4 space-y-2">
          {alerts?.allergies && (
            <div className="flex items-center gap-2.5 bg-danger/10 text-danger rounded-control px-4 py-2.5">
              <TriangleAlert size={16} className="shrink-0" />
              <p className="text-sm font-medium">Allergies: {alerts.allergies}</p>
            </div>
          )}
          {alerts?.pregnant && (
            <div className="bg-gold/10 text-gold-deep rounded-control px-4 py-2.5 text-sm font-medium">
              ⚠ Currently pregnant / breastfeeding
            </div>
          )}
        </div>
      )}

      {/* Active step */}
      {step === 'identify' && (
        <StepIdentify
          todayAppointments={todayAppointments}
          onPick={(p, apptId) => {
            setPatient(p)
            setAppointmentId(apptId)
            setStep('safety')
          }}
        />
      )}

      {step === 'safety' && patient && (
        <StepSafety
          patient={patient}
          onBack={() => setStep('identify')}
          onDone={(a) => {
            setAlerts(a)
            setStep('send')
          }}
        />
      )}

      {step === 'send' && patient && sentTo && (
        <div className="bg-white rounded-card shadow-soft p-6 sm:p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
            <Check size={24} />
          </div>
          <h2 className="font-display text-xl text-ink-strong mt-4">
            {patient.full_name} sent to {sentTo}
          </h2>
          <p className="text-sm text-ink/55 mt-2">
            They are on that clinic&apos;s board now. The doctor will log the treatment; the
            payment will be waiting for you in the ledger afterwards.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={reset}
              className="bg-teal hover:bg-teal-deep text-white rounded-control px-5 py-2.5 text-sm font-medium transition-colors"
            >
              Send another patient
            </button>
            <Link
              href={`/patients/${patient.id}`}
              className="text-sm text-ink/55 hover:text-teal-deep px-3 py-2.5"
            >
              Open their chart
            </Link>
          </div>
        </div>
      )}

      {step === 'send' && patient && !sentTo && (
        <StepSendToClinic
          patient={patient}
          alerts={alerts}
          onBack={() => setStep('safety')}
          onSent={(clinicName) => setSentTo(clinicName)}
          onHandleHere={() => setStep('visit')}
        />
      )}

      {step === 'visit' && patient && (
        <StepVisit
          patient={patient}
          procedures={procedures}
          onBack={() => setStep('send')}
          onSaved={handleVisitSaved}
        />
      )}

      {step === 'payment' && patient && visit && (
        <StepPayment
          patient={patient}
          visit={visit}
          onBack={() => setStep('visit')}
          onDone={(summary) => {
            setPayment(summary)
            setStep('done')
          }}
          onSkip={() => {
            setPayment(null)
            setStep('done')
          }}
        />
      )}

      {step === 'done' && patient && visit && (
        <StepDone
          patient={patient}
          visit={visit}
          payment={payment}
          nextVisitWeeks={nextVisitWeeks}
          onRestart={reset}
        />
      )}
    </div>
  )
}
