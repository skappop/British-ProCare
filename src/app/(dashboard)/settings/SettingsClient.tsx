'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CalibrationWizard from '@/components/calibration/CalibrationWizard'
import { Button } from '@/components/ui/button'
import { Settings, CheckCircle, XCircle, Calendar, Users, Package, FlaskConical, TrendingUp } from 'lucide-react'

interface ClinicConfig {
  id: string
  practice_type: string
  patient_intake_method: string
  google_sheets_enabled: boolean
  google_sheets_url: string | null
  imaging_hardware: string
  osstem_enabled: boolean
  features_enabled: {
    appointments: boolean
    recall: boolean
    inventory: boolean
    lab_cases: boolean
    staff: boolean
    reports: boolean
  }
  staff_size: string
  use_file_numbers: boolean
  default_appointment_duration: number
  is_calibrated: boolean
  last_calibrated_at: string | null
}

interface SettingsClientProps {
  config: ClinicConfig | null
  userEmail: string
}

export default function SettingsClient({ config, userEmail }: SettingsClientProps) {
  const router = useRouter()
  const [showWizard, setShowWizard] = useState(!config?.is_calibrated)

  const handleCalibrationComplete = () => {
    setShowWizard(false)
    router.refresh()
  }

  const handleRecalibrate = () => {
    setShowWizard(true)
  }

  if (showWizard) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">
            {config?.is_calibrated ? 'Recalibrate System' : 'Welcome! Let\'s Set Up Your Clinic'}
          </h1>
          <p className="text-muted-foreground">
            {config?.is_calibrated
              ? 'Update your system configuration to match any changes in your workflow'
              : 'Answer a few questions to customize the system to your workflow. This takes about 2 minutes.'}
          </p>
        </div>

        <CalibrationWizard
          onComplete={handleCalibrationComplete}
          initialData={config || undefined}
        />
      </div>
    )
  }

  if (!config) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading configuration...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">System Settings</h1>
          <p className="text-muted-foreground">
            Your clinic is configured and ready to use
          </p>
        </div>
        <Button onClick={handleRecalibrate} variant="outline">
          <Settings className="mr-2" size={16} />
          Recalibrate
        </Button>
      </div>

      {/* Current Configuration Display */}
      <div className="space-y-6">
        {/* Practice Profile */}
        <ConfigSection title="Practice Profile">
          <ConfigItem
            label="Practice Type"
            value={config.practice_type.replace('_', ' ')}
            icon={<Settings size={16} />}
          />
          <ConfigItem
            label="Staff Size"
            value={config.staff_size}
            icon={<Users size={16} />}
          />
        </ConfigSection>

        {/* Patient Intake */}
        <ConfigSection title="Patient Intake">
          <ConfigItem
            label="Intake Method"
            value={config.patient_intake_method.replace('_', ' ')}
          />
          {config.google_sheets_enabled && (
            <>
              <ConfigItem
                label="Google Sheets Integration"
                value="Enabled"
                icon={<CheckCircle size={16} className="text-green-500" />}
              />
              {config.google_sheets_url && (
                <ConfigItem
                  label="Sheet URL"
                  value={config.google_sheets_url}
                  truncate
                />
              )}
            </>
          )}
        </ConfigSection>

        {/* Imaging Hardware */}
        <ConfigSection title="Imaging Hardware">
          <ConfigItem
            label="Hardware Type"
            value={config.imaging_hardware}
          />
          {config.osstem_enabled && (
            <ConfigItem
              label="Osstem Auto-Upload"
              value="Enabled"
              icon={<CheckCircle size={16} className="text-green-500" />}
            />
          )}
        </ConfigSection>

        {/* Enabled Features */}
        <ConfigSection title="Enabled Features">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FeatureCard
              enabled={config.features_enabled.appointments}
              label="Appointments"
              icon={<Calendar size={20} />}
            />
            <FeatureCard
              enabled={config.features_enabled.recall}
              label="Recall"
              icon={<Calendar size={20} />}
            />
            <FeatureCard
              enabled={config.features_enabled.inventory}
              label="Inventory"
              icon={<Package size={20} />}
            />
            <FeatureCard
              enabled={config.features_enabled.lab_cases}
              label="Lab Cases"
              icon={<FlaskConical size={20} />}
            />
            <FeatureCard
              enabled={config.features_enabled.staff}
              label="Staff"
              icon={<Users size={20} />}
            />
            <FeatureCard
              enabled={config.features_enabled.reports}
              label="Reports"
              icon={<TrendingUp size={20} />}
            />
          </div>
        </ConfigSection>

        {/* Workflow Preferences */}
        <ConfigSection title="Workflow Preferences">
          <ConfigItem
            label="Use File Numbers"
            value={config.use_file_numbers ? 'Yes' : 'No'}
          />
          <ConfigItem
            label="Default Appointment Duration"
            value={`${config.default_appointment_duration} minutes`}
          />
        </ConfigSection>

        {/* Calibration Info */}
        {config.last_calibrated_at && (
          <div className="pt-6 border-t text-sm text-muted-foreground">
            <p>
              Last calibrated: {new Date(config.last_calibrated_at).toLocaleDateString()} at{' '}
              {new Date(config.last_calibrated_at).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function ConfigItem({
  label,
  value,
  icon,
  truncate = false,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  truncate?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {icon}
        <span className={`font-medium capitalize ${truncate ? 'truncate max-w-xs' : ''}`}>
          {value}
        </span>
      </div>
    </div>
  )
}

function FeatureCard({
  enabled,
  label,
  icon,
}: {
  enabled: boolean
  label: string
  icon: React.ReactNode
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border ${
        enabled
          ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
          : 'bg-muted border-border opacity-50'
      }`}
    >
      {enabled ? (
        <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
      ) : (
        <XCircle size={20} className="text-muted-foreground" />
      )}
      <div>
        <p className="font-medium text-sm">{label}</p>
      </div>
    </div>
  )
}
