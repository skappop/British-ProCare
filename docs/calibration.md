# Calibration System - Complete Guide

## 🎯 **What Is the Calibration System?**

The Calibration System is a **guided setup wizard** that adapts ProCare Clinic to match your exact workflow. Instead of forcing you to learn a complex system with features you don't use, it asks you questions about how your clinic operates and automatically:

- ✅ Shows/hides menu items based on what you use
- ✅ Configures integrations (Google Sheets, Osstem)
- ✅ Customizes navigation to your needs
- ✅ Sets workflow defaults
- ✅ Simplifies the interface

**Philosophy:** The software adapts to your clinic, not the other way around.

---

## 🚀 **How It Works**

### **First Time Setup**

When you first login after deployment, you'll see the **Calibration Wizard** automatically. It's a 7-step guided questionnaire:

1. **Practice Type** - General, Orthodontics, Mixed, or Cosmetic
2. **Patient Intake** - Google Sheets, Manual Entry, or Direct
3. **Imaging Hardware** - Osstem, TWAIN, Manual Upload, or None
4. **Appointments** - Do you schedule appointments or walk-ins only?
5. **Features** - Enable/disable Inventory, Lab Cases, Reports
6. **Staff Size** - Solo, Small (2-5), Medium (6-15), or Large (16+)
7. **Final Preferences** - File numbers, appointment duration, summary

Each step takes 10-20 seconds. Total time: **~2 minutes**.

---

## 📋 **What Gets Configured**

### **Navigation Menu**

The sidebar automatically shows/hides items based on your answers:

**Always Visible:**
- Walk-In
- Dashboard
- Patients
- Procedures
- Settings

**Conditionally Visible:**
- Appointments (if you use appointments)
- Recall (if you use appointments)
- Inventory (if enabled)
- Lab Cases (if enabled)
- Reports (if enabled)
- Staff (if not solo practice)
- Google Sheets (if Google integration enabled)

### **Integrations**

**Google Sheets:**
- If enabled, shows in navigation
- Configuration stored for sync
- Can add sheet URL now or later

**Osstem Hardware:**
- Marks system as ready for bridge setup
- Configuration saved for future use

### **Workflow Defaults**

- Default appointment duration (15/30/45/60 minutes)
- File number usage (yes/no)
- Feature visibility

---

## 🛠️ **Setup Steps**

### **Step 1: Run Database Migration**

Before using the calibration system, run this SQL in Supabase:

```bash
# In Supabase SQL Editor, paste:
migrations/create_clinic_configuration.sql
```

This creates the `clinic_configuration` table.

### **Step 2: Deploy to Vercel**

The calibration system is already built and pushed to GitHub. Vercel will automatically deploy it.

1. Go to Vercel Dashboard
2. Wait for deployment to complete
3. Open your app

### **Step 3: First Login**

1. Login to your app
2. You'll see the **Calibration Wizard** automatically
3. Answer the 7 questions
4. Click "Complete Calibration"

### **Step 4: Enjoy Your Customized System**

The navigation now shows only what you need!

---

## 🔄 **Recalibrating the System**

You can recalibrate anytime if your workflow changes:

1. Click **Settings** in the sidebar
2. Click **Recalibrate** button
3. Go through the wizard again
4. Your new configuration applies immediately

**Use Cases:**
- Hired new staff (update staff size)
- Started using appointments
- Enabled Google Sheets integration
- Added Osstem hardware
- Changed practice focus

---

## 📊 **Configuration Storage**

All settings are stored in the `clinic_configuration` table in Supabase:

```sql
{
  "practice_type": "mixed",
  "patient_intake_method": "google_sheets",
  "google_sheets_enabled": true,
  "imaging_hardware": "osstem",
  "osstem_enabled": true,
  "features_enabled": {
    "appointments": true,
    "recall": true,
    "inventory": true,
    "lab_cases": false,
    "staff": false,
    "reports": true
  },
  "staff_size": "small",
  "use_file_numbers": true,
  "default_appointment_duration": 30,
  "is_calibrated": true,
  "last_calibrated_at": "2026-09-19T21:45:00Z"
}
```

---

## 🎨 **User Experience Flow**

### **Scenario 1: Solo General Dentist (Walk-Ins Only)**

**Calibration Answers:**
- Practice Type: General
- Patient Intake: Manual
- Imaging: Manual Upload
- Appointments: No
- Features: Only Inventory enabled
- Staff: Solo

**Result:**
Navigation shows:
- Walk-In ✅
- Dashboard ✅
- Patients ✅
- Inventory ✅
- Procedures ✅
- Settings ✅

Hidden:
- Appointments ❌
- Recall ❌
- Lab Cases ❌
- Reports ❌
- Staff ❌

**Clean, focused interface with only 6 menu items.**

---

### **Scenario 2: Mixed Practice with Google Sheets & Osstem**

**Calibration Answers:**
- Practice Type: Mixed
- Patient Intake: Google Sheets
- Imaging: Osstem
- Appointments: Yes (30 min default)
- Features: All enabled
- Staff: Small (2-5)

**Result:**
Navigation shows:
- Walk-In ✅
- Dashboard ✅
- Appointments ✅
- Recall ✅
- Patients ✅
- Lab Cases ✅
- Inventory ✅
- Procedures ✅
- Reports ✅
- Staff ✅
- Google Sheets ✅
- Settings ✅

**Full-featured interface with all 12 menu items.**

---

## 🔧 **Technical Architecture**

### **Components**

1. **CalibrationWizard.tsx** - Multi-step form component
2. **SettingsClient.tsx** - Settings page with recalibrate button
3. **SidebarNav.tsx** - Dynamic navigation (reads config)
4. **AppShell.tsx** - Passes config to navigation
5. **layout.tsx** - Fetches config from database

### **API Endpoints**

- `GET /api/calibration` - Fetch current configuration
- `POST /api/calibration` - Save/update configuration

### **Database**

- `clinic_configuration` table (singleton pattern - only 1 row)
- JSONB columns for flexible feature storage
- RLS policies for authenticated access

### **Data Flow**

```
User answers questions
        ↓
CalibrationWizard collects data
        ↓
POST /api/calibration
        ↓
Saved to clinic_configuration table
        ↓
Dashboard layout fetches config
        ↓
Passes to AppShell
        ↓
Passes to SidebarNav
        ↓
Navigation renders based on config
```

---

## ✅ **Verification Checklist**

After deploying the calibration system:

- [ ] Database migration run successfully
- [ ] Vercel deployment completed
- [ ] Login shows calibration wizard on first visit
- [ ] Can complete all 7 steps
- [ ] Configuration saves successfully
- [ ] Navigation updates based on configuration
- [ ] Settings page shows current configuration
- [ ] Recalibrate button works
- [ ] Changes take effect immediately

---

## 🎯 **Benefits**

### **For the Doctor**
- ✅ No learning curve - answer simple questions
- ✅ System matches their workflow immediately
- ✅ No clutter from unused features
- ✅ Can reconfigure anytime

### **For Staff**
- ✅ Clean, focused interface
- ✅ Only see what they need
- ✅ Less confusion, faster training

### **For You (Developer)**
- ✅ One-time setup wizard
- ✅ No manual configuration needed
- ✅ Easy to add new configuration options
- ✅ Centralized settings management

---

## 🚀 **Future Enhancements**

Potential additions to the calibration system:

1. **Practice Hours** - Configure operating hours
2. **Currency & Language** - Localization settings
3. **Procedure Categories** - Custom procedure grouping
4. **Terminology** - Customize labels (e.g., "File Number" vs "Chart Number")
5. **Branding** - Logo, colors, clinic name
6. **Roles & Permissions** - Configure user roles
7. **Export Configuration** - Share config with other clinics
8. **Templates** - Pre-built configs for common practice types

---

## 📞 **Troubleshooting**

### **Calibration wizard doesn't appear on first login**

**Cause:** Database migration not run

**Fix:**
1. Go to Supabase SQL Editor
2. Run `migrations/create_clinic_configuration.sql`
3. Refresh the app

### **Navigation doesn't update after calibration**

**Cause:** Browser cache

**Fix:**
1. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. Or clear browser cache

### **Error saving configuration**

**Cause:** Database permissions

**Fix:**
1. Check Supabase RLS policies are enabled
2. Verify authenticated users have UPDATE permission
3. Check browser console for errors

### **Settings page shows "Loading configuration..."**

**Cause:** Configuration not created

**Fix:**
1. Go to Settings
2. Calibration wizard should appear
3. Complete the wizard

---

## 🎉 **Success!**

Your ProCare Clinic now has an intelligent calibration system that adapts to each clinic's unique workflow. No two clinics are the same, and now your software reflects that.

**The system learns your workflow in 2 minutes and stays out of your way ever after.**

---

## 📚 **Files Created**

- `migrations/create_clinic_configuration.sql` - Database schema
- `src/app/api/calibration/route.ts` - API endpoints
- `src/components/calibration/CalibrationWizard.tsx` - 7-step wizard
- `src/app/(dashboard)/settings/page.tsx` - Settings page
- `src/app/(dashboard)/settings/SettingsClient.tsx` - Configuration display
- `src/components/SidebarNav.tsx` - Dynamic navigation (updated)
- `src/app/(dashboard)/layout.tsx` - Config fetching (updated)
- `src/components/AppShell.tsx` - Config passing (updated)

**Total: 8 files (3 new, 5 updated)**

---

**Your calibration system is complete and ready to use!** 🚀
