'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'

type PracticeType = 'general' | 'orthodontics' | 'mixed' | 'cosmetic'
type IntakeMethod = 'google_sheets' | 'manual' | 'direct'
type ImagingHardware = 'osstem' | 'twain' | 'manual' | 'none'
type StaffSize = 'solo' | 'small' | 'medium' | 'large'

interface CalibrationData {
  practice_type: PracticeType
  patient_intake_method: IntakeMethod
  google_sheets_enabled: boolean
  google_sheets_url: string
  imaging_hardware: ImagingHardware
  osstem_enabled: boolean
  features_enabled: {
    appointments: boolean
    recall: boolean
    inventory: boolean
    lab_cases: boolean
    staff: boolean
    reports: boolean
  }
  staff_size: StaffSize
  use_file_numbers: boolean
  default_appointment_duration: number
}

const INITIAL_DATA: CalibrationData = {
  practice_type: 'general',
  patient_intake_method: 'manual',
  google_sheets_enabled: false,
  google_sheets_url: '',
  imaging_hardware: 'manual',
  osstem_enabled: false,
  features_enabled: {
    appointments: true,
    recall: true,
    inventory: true,
    lab_cases: true,
    staff: true,
    reports: true,
  },
  staff_size: 'small',
  use_file_numbers: true,
  default_appointment_duration: 30,
}

interface CalibrationWizardProps {
  onComplete: () => void
  initialData?: Partial<CalibrationData>
}

export default function CalibrationWizard({ onComplete, initialData }: CalibrationWizardProps) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<CalibrationData>({
    ...INITIAL_DATA,
    ...initialData,
  })
  const [saving, setSaving] = useState(false)

  const totalSteps = 7

  const updateData = (updates: Partial<CalibrationData>) => {
    setData((prev) => ({ ...prev, ...updates }))
  }

  const nextStep = () => {
    if (step < totalSteps) setStep(step + 1)
  }

  const prevStep = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to save configuration')

      onComplete()
    } catch (error) {
      console.error('Error saving calibration:', error)
      alert('Failed to save configuration. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Step {step} of {totalSteps}</span>
          <span className="text-sm text-muted-foreground">{Math.round((step / totalSteps) * 100)}% Complete</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gold-light transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-card border rounded-lg p-8 mb-6">
        {step === 1 && <Step1 data={data} updateData={updateData} />}
        {step === 2 && <Step2 data={data} updateData={updateData} />}
        {step === 3 && <Step3 data={data} updateData={updateData} />}
        {step === 4 && <Step4 data={data} updateData={updateData} />}
        {step === 5 && <Step5 data={data} updateData={updateData} />}
        {step === 6 && <Step6 data={data} updateData={updateData} />}
        {step === 7 && <Step7 data={data} updateData={updateData} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={step === 1 || saving}
        >
          <ArrowLeft className="mr-2" size={16} />
          Previous
        </Button>

        {step < totalSteps ? (
          <Button onClick={nextStep} disabled={saving}>
            Next
            <ArrowRight className="ml-2" size={16} />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={16} />
                Saving...
              </>
            ) : (
              <>
                <Check className="mr-2" size={16} />
                Complete Calibration
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

// Step 1: Practice Type
function Step1({ data, updateData }: { data: CalibrationData; updateData: (d: Partial<CalibrationData>) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-display font-semibold mb-2">What type of dental practice are you?</h2>
      <p className="text-muted-foreground mb-6">This helps us customize the system to your specialty</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OptionCard
          selected={data.practice_type === 'general'}
          onClick={() => updateData({ practice_type: 'general' })}
          title="General Dentistry"
          description="Routine cleanings, fillings, extractions, and general oral health"
        />
        <OptionCard
          selected={data.practice_type === 'orthodontics'}
          onClick={() => updateData({ practice_type: 'orthodontics' })}
          title="Orthodontics"
          description="Braces, aligners, and teeth straightening treatments"
        />
        <OptionCard
          selected={data.practice_type === 'mixed'}
          onClick={() => updateData({ practice_type: 'mixed' })}
          title="Mixed Practice"
          description="Combination of general dentistry and specialized services"
        />
        <OptionCard
          selected={data.practice_type === 'cosmetic'}
          onClick={() => updateData({ practice_type: 'cosmetic' })}
          title="Cosmetic Dentistry"
          description="Veneers, whitening, smile makeovers, and aesthetic procedures"
        />
      </div>
    </div>
  )
}

// Step 2: Patient Intake Method
function Step2({ data, updateData }: { data: CalibrationData; updateData: (d: Partial<CalibrationData>) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-display font-semibold mb-2">How do patients provide their information?</h2>
      <p className="text-muted-foreground mb-6">Choose your current patient intake workflow</p>

      <div className="space-y-4">
        <OptionCard
          selected={data.patient_intake_method === 'google_sheets'}
          onClick={() =>
            updateData({
              patient_intake_method: 'google_sheets',
              google_sheets_enabled: true,
            })
          }
          title="Google Forms → Google Sheets"
          description="Patients fill a Google Form that saves to a Google Sheet"
        />
        <OptionCard
          selected={data.patient_intake_method === 'manual'}
          onClick={() =>
            updateData({
              patient_intake_method: 'manual',
              google_sheets_enabled: false,
            })
          }
          title="Paper Forms → Manual Entry"
          description="Patients fill paper forms, staff enters data manually"
        />
        <OptionCard
          selected={data.patient_intake_method === 'direct'}
          onClick={() =>
            updateData({
              patient_intake_method: 'direct',
              google_sheets_enabled: false,
            })
          }
          title="Directly in Software"
          description="Patients or staff enter information directly into the system"
        />
      </div>

      {data.google_sheets_enabled && (
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-2">Google Sheets URL (optional now, can configure later)</p>
          <input
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={data.google_sheets_url}
            onChange={(e) => updateData({ google_sheets_url: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
      )}
    </div>
  )
}

// Step 3: Imaging Hardware
function Step3({ data, updateData }: { data: CalibrationData; updateData: (d: Partial<CalibrationData>) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-display font-semibold mb-2">Do you use digital imaging equipment?</h2>
      <p className="text-muted-foreground mb-6">Select your current imaging setup</p>

      <div className="space-y-4">
        <OptionCard
          selected={data.imaging_hardware === 'osstem'}
          onClick={() =>
            updateData({
              imaging_hardware: 'osstem',
              osstem_enabled: true,
            })
          }
          title="Osstem Hardware"
          description="Osstem intraoral cameras or X-ray sensors with auto-upload"
        />
        <OptionCard
          selected={data.imaging_hardware === 'twain'}
          onClick={() =>
            updateData({
              imaging_hardware: 'twain',
              osstem_enabled: false,
            })
          }
          title="Other TWAIN Scanners"
          description="Compatible TWAIN-based imaging devices"
        />
        <OptionCard
          selected={data.imaging_hardware === 'manual'}
          onClick={() =>
            updateData({
              imaging_hardware: 'manual',
              osstem_enabled: false,
            })
          }
          title="Manual Upload"
          description="Upload images manually from any source"
        />
        <OptionCard
          selected={data.imaging_hardware === 'none'}
          onClick={() =>
            updateData({
              imaging_hardware: 'none',
              osstem_enabled: false,
            })
          }
          title="No Digital Imaging"
          description="Not using digital imaging at this time"
        />
      </div>
    </div>
  )
}

// Step 4: Appointments
function Step4({ data, updateData }: { data: CalibrationData; updateData: (d: Partial<CalibrationData>) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-display font-semibold mb-2">Do you use scheduled appointments?</h2>
      <p className="text-muted-foreground mb-6">Tell us about your appointment workflow</p>

      <div className="space-y-4">
        <OptionCard
          selected={data.features_enabled.appointments === true}
          onClick={() =>
            updateData({
              features_enabled: {
                ...data.features_enabled,
                appointments: true,
                recall: true,
              },
            })
          }
          title="Yes, We Schedule Appointments"
          description="Show appointment calendar and recall features"
        />
        <OptionCard
          selected={data.features_enabled.appointments === false}
          onClick={() =>
            updateData({
              features_enabled: {
                ...data.features_enabled,
                appointments: false,
                recall: false,
              },
            })
          }
          title="No, Walk-Ins Only"
          description="Hide appointments and focus on walk-in workflow"
        />
      </div>

      {data.features_enabled.appointments && (
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-3">Default appointment duration (minutes)</p>
          <div className="flex gap-2">
            {[15, 30, 45, 60].map((duration) => (
              <button
                key={duration}
                onClick={() => updateData({ default_appointment_duration: duration })}
                className={`px-4 py-2 rounded-md border transition-colors ${
                  data.default_appointment_duration === duration
                    ? 'bg-gold-light text-white border-gold-light'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {duration}m
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Step 5: Inventory & Lab Cases
function Step5({ data, updateData }: { data: CalibrationData; updateData: (d: Partial<CalibrationData>) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-display font-semibold mb-2">What features do you need?</h2>
      <p className="text-muted-foreground mb-6">Enable or disable based on your practice needs</p>

      <div className="space-y-3">
        <ToggleCard
          checked={data.features_enabled.inventory}
          onChange={(checked) =>
            updateData({
              features_enabled: { ...data.features_enabled, inventory: checked },
            })
          }
          title="Inventory Tracking"
          description="Track dental supplies, materials, and equipment"
        />
        <ToggleCard
          checked={data.features_enabled.lab_cases}
          onChange={(checked) =>
            updateData({
              features_enabled: { ...data.features_enabled, lab_cases: checked },
            })
          }
          title="Lab Cases"
          description="Manage cases sent to dental laboratories"
        />
        <ToggleCard
          checked={data.features_enabled.reports}
          onChange={(checked) =>
            updateData({
              features_enabled: { ...data.features_enabled, reports: checked },
            })
          }
          title="Reports & Analytics"
          description="Financial reports and practice analytics"
        />
      </div>
    </div>
  )
}

// Step 6: Staff Management
function Step6({ data, updateData }: { data: CalibrationData; updateData: (d: Partial<CalibrationData>) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-display font-semibold mb-2">How many staff members work at your practice?</h2>
      <p className="text-muted-foreground mb-6">This helps us show relevant features</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OptionCard
          selected={data.staff_size === 'solo'}
          onClick={() =>
            updateData({
              staff_size: 'solo',
              features_enabled: { ...data.features_enabled, staff: false },
            })
          }
          title="Solo Practice"
          description="Just you, no staff management needed"
        />
        <OptionCard
          selected={data.staff_size === 'small'}
          onClick={() =>
            updateData({
              staff_size: 'small',
              features_enabled: { ...data.features_enabled, staff: true },
            })
          }
          title="2-5 Staff Members"
          description="Small team, basic staff tracking"
        />
        <OptionCard
          selected={data.staff_size === 'medium'}
          onClick={() =>
            updateData({
              staff_size: 'medium',
              features_enabled: { ...data.features_enabled, staff: true },
            })
          }
          title="6-15 Staff Members"
          description="Medium team with multiple roles"
        />
        <OptionCard
          selected={data.staff_size === 'large'}
          onClick={() =>
            updateData({
              staff_size: 'large',
              features_enabled: { ...data.features_enabled, staff: true },
            })
          }
          title="16+ Staff Members"
          description="Large practice with complex staffing"
        />
      </div>
    </div>
  )
}

// Step 7: Final Settings
function Step7({ data, updateData }: { data: CalibrationData; updateData: (d: Partial<CalibrationData>) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-display font-semibold mb-2">Final preferences</h2>
      <p className="text-muted-foreground mb-6">A few last settings to personalize your experience</p>

      <div className="space-y-4">
        <ToggleCard
          checked={data.use_file_numbers}
          onChange={(checked) => updateData({ use_file_numbers: checked })}
          title="Use Patient File Numbers"
          description="Assign and track unique file numbers for each patient"
        />

        <div className="p-4 bg-muted rounded-lg">
          <h3 className="font-medium mb-4">Summary of Your Configuration</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Practice Type:</span>
              <span className="font-medium capitalize">{data.practice_type.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Patient Intake:</span>
              <span className="font-medium capitalize">{data.patient_intake_method.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Imaging:</span>
              <span className="font-medium capitalize">{data.imaging_hardware}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Staff Size:</span>
              <span className="font-medium capitalize">{data.staff_size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Enabled Features:</span>
              <span className="font-medium">
                {Object.entries(data.features_enabled)
                  .filter(([, enabled]) => enabled)
                  .map(([key]) => key.replace('_', ' '))
                  .join(', ')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Reusable Option Card Component
function OptionCard({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean
  onClick: () => void
  title: string
  description: string
}) {
  return (
    <button
      onClick={onClick}
      className={`p-4 border-2 rounded-lg text-left transition-all ${
        selected
          ? 'border-gold-light bg-gold-light/5'
          : 'border-border hover:border-gold-light/50 bg-card'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            selected ? 'border-gold-light' : 'border-muted-foreground'
          }`}
        >
          {selected && <div className="w-3 h-3 rounded-full bg-gold-light" />}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  )
}

// Reusable Toggle Card Component
function ToggleCard({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  title: string
  description: string
}) {
  return (
    <label className="flex items-start gap-4 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-4 h-4 accent-gold-light"
      />
      <div className="flex-1">
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </label>
  )
}
