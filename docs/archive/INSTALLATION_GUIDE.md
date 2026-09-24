# Complete Installation Guide - Google Sheets Integration
## For GitHub + Vercel + Supabase Setup

This is your **step-by-step guide** to install the Google Sheets integration with your exact tech stack.

---

## 🏗️ Your Tech Stack

- **GitHub** - Code repository
- **Vercel** - Hosting platform
- **Supabase** - Database & storage

---

## 📋 Prerequisites

- [ ] GitHub account with procare-clinic repo
- [ ] Vercel account connected to GitHub
- [ ] Supabase project set up
- [ ] Google account

**Time needed:** 20-30 minutes

---

## 🚀 Installation Steps

### **STEP 1: Database Setup (Supabase)**

#### 1.1 Open Supabase SQL Editor

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your ProCare Clinic project
3. Click **SQL Editor** in left sidebar
4. Click **New query**

#### 1.2 Run Migration

Copy and paste this SQL:

```sql
-- Add columns to track Google Sheets sync status
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS synced_from_sheets BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sheet_row_number INTEGER,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for faster queries on synced patients
CREATE INDEX IF NOT EXISTS idx_patients_synced_from_sheets
ON patients(synced_from_sheets);

-- Create table to track sync history
CREATE TABLE IF NOT EXISTS sheet_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id TEXT NOT NULL,
  range TEXT,
  patients_created INTEGER DEFAULT 0,
  patients_updated INTEGER DEFAULT 0,
  patients_skipped INTEGER DEFAULT 0,
  total_patients INTEGER DEFAULT 0,
  errors TEXT[],
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on synced_at for faster history queries
CREATE INDEX IF NOT EXISTS idx_sheet_sync_logs_synced_at
ON sheet_sync_logs(synced_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN patients.synced_from_sheets IS 'Whether this patient was imported from Google Sheets';
COMMENT ON COLUMN patients.sheet_row_number IS 'Row number in the source Google Sheet (for debugging)';
COMMENT ON TABLE sheet_sync_logs IS 'Audit log of Google Sheets sync operations';
```

Click **Run** (or press Ctrl+Enter)

✅ You should see: "Success. No rows returned"

---

### **STEP 2: Create Google Service Account**

#### 2.1 Create Google Cloud Project

1. Go to: https://console.cloud.google.com/
2. Click project dropdown at top → **New Project**
3. Project name: `ProCare Clinic`
4. Click **Create**
5. Wait for project to be created (~30 seconds)

#### 2.2 Enable Google Sheets API

1. Go to: https://console.cloud.google.com/apis/library
2. Make sure "ProCare Clinic" project is selected (top bar)
3. Search: `Google Sheets API`
4. Click on it → Click **Enable**
5. Wait for it to enable

#### 2.3 Create Service Account

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click **Create Service Account**
3. Fill in:
   - **Name:** `procare-sheets-sync`
   - **Description:** `Read patient data from Google Sheets`
4. Click **Create and Continue**
5. Skip roles (click **Continue**)
6. Click **Done**

#### 2.4 Create JSON Key

1. Click on the service account you just created (procare-sheets-sync@...)
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Choose **JSON**
5. Click **Create**
6. **Save the downloaded file** (e.g., `procare-clinic-abc123.json`)

#### 2.5 Copy Service Account Email

From the service account page, copy the email address. It looks like:

```
procare-sheets-sync@procare-clinic-123456.iam.gserviceaccount.com
```

**Save this email - you'll need it next!**

---

### **STEP 3: Create Test Google Sheet**

#### 3.1 Create New Sheet

1. Go to: https://sheets.new
2. This creates a blank Google Sheet

#### 3.2 Add Patient Data

Copy the table from [DUMMY_PATIENT_DATA.md](DUMMY_PATIENT_DATA.md) and paste into cell A1.

Or manually create this structure:

**Row 1 (Headers):**
```
Full Name | Phone | Email | Date of Birth | Gender | File Number | Address | Notes
```

**Row 2 (Example Patient):**
```
أحمد محمد السيد | 01012345678 | ahmed.mohamed@gmail.com | 1985-03-15 | M | FN001 | 15 شارع الجمهورية، المعادي، القاهرة | مريض منتظم
```

Add more patients from DUMMY_PATIENT_DATA.md

#### 3.3 Name Your Sheet

Click "Untitled spreadsheet" at top → Rename to: `ProCare Clinic - Patient Database`

#### 3.4 Share with Service Account

1. Click **Share** button (top right)
2. Paste the service account email (from Step 2.5)
3. Change permission to **Viewer**
4. **Uncheck** "Notify people"
5. Click **Share**

#### 3.5 Copy Spreadsheet ID

From your browser URL:
```
https://docs.google.com/spreadsheets/d/1A2B3C4D5E6F7G8H9I0J/edit
                                          ^^^^^ THIS PART ^^^^^
```

Copy this ID. Example: `1A2B3C4D5E6F7G8H9I0J`

**Save it - you'll need it soon!**

---

### **STEP 4: Configure Environment Variables**

#### 4.1 Prepare Service Account JSON

1. Open the JSON file you downloaded in Step 2.4
2. Copy the **entire contents** (it's one long line)

Example (shortened):
```json
{"type":"service_account","project_id":"procare-clinic-123456","private_key_id":"abc...","private_key":"-----BEGIN PRIVATE KEY-----\nMIIE...","client_email":"procare-sheets-sync@...","client_id":"123...","auth_uri":"https://..."}
```

#### 4.2 Generate API Keys

**On Windows PowerShell:**
```powershell
# Generate ADMIN_API_KEY
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Generate CRON_SECRET
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**On Mac/Linux:**
```bash
# Generate ADMIN_API_KEY
openssl rand -base64 32

# Generate CRON_SECRET
openssl rand -base64 32
```

Copy both keys.

#### 4.3 Add to Vercel

1. Go to: https://vercel.com/dashboard
2. Select your ProCare Clinic project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

| Name | Value | Environment |
|------|-------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | (paste entire JSON from 4.1) | Production, Preview, Development |
| `ADMIN_API_KEY` | (paste key from 4.2) | Production, Preview, Development |
| `NEXT_PUBLIC_ADMIN_API_KEY` | (same as ADMIN_API_KEY) | Production, Preview, Development |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | (paste ID from Step 3.5) | Production, Preview, Development |
| `GOOGLE_SHEETS_RANGE` | `Sheet1!A:Z` | Production, Preview, Development |
| `CRON_SECRET` | (paste key from 4.2) | Production, Preview, Development |

**Important:**
- For `GOOGLE_SERVICE_ACCOUNT_JSON`: Paste the **entire JSON** as one line
- Make sure there are **no extra spaces** or line breaks
- Select **all three environments** (Production, Preview, Development)

---

### **STEP 5: Push Code to GitHub**

#### 5.1 Check Git Status

```bash
cd C:\Users\Skappop\procare-clinic
git status
```

You should see all the new files.

#### 5.2 Stage All Changes

```bash
git add .
```

#### 5.3 Commit Changes

```bash
git commit -m "Add Google Sheets integration for patient sync

- Add Google Sheets API client library
- Create admin interface for sheet management
- Implement smart sync logic (create new, fill empty fields)
- Add scheduled daily sync via Vercel cron
- Add database migrations for sync tracking
- Add comprehensive documentation

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

#### 5.4 Push to GitHub

```bash
git push origin main
```

---

### **STEP 6: Deploy to Vercel**

#### 6.1 Automatic Deployment

Vercel automatically deploys when you push to GitHub.

1. Go to: https://vercel.com/dashboard
2. Select your ProCare Clinic project
3. Check **Deployments** tab
4. Wait for deployment to complete (~2-3 minutes)

✅ Status should show "Ready"

#### 6.2 Verify Environment Variables

After deployment:
1. Go to **Settings** → **Environment Variables**
2. Confirm all 6 variables are there
3. If deployment happened before you added variables:
   - Add the variables
   - Go to **Deployments**
   - Click ⋯ on latest deployment → **Redeploy**

---

### **STEP 7: Test the Integration**

#### 7.1 Open Admin Panel

Go to: `https://your-app.vercel.app/admin/sheets`

(Replace `your-app` with your actual Vercel domain)

#### 7.2 Validate Sheet

1. In the "Google Sheets URL or ID" field, paste your sheet URL or ID
2. Click **Validate Sheet**
3. You should see: ✅ "Sheet validated: ProCare Clinic - Patient Database"
4. Check detected columns match your sheet headers

#### 7.3 First Sync

1. Click **Sync Now**
2. Wait for sync to complete (~5-10 seconds for 20 patients)
3. You should see: ✅ "Sync complete: 20 created, 0 updated, 0 skipped"

#### 7.4 Verify Patients Imported

1. Go to: `https://your-app.vercel.app/patients`
2. You should see all 20 Arabic patients
3. Click on a patient → Check their details
4. Verify phone, email, DOB, address are all there

---

## ✅ **Verification Checklist**

After completing all steps, verify:

- [ ] Supabase migration ran successfully
- [ ] Service account JSON key downloaded
- [ ] Google Sheet created with patient data
- [ ] Sheet shared with service account (Viewer)
- [ ] All 6 environment variables added to Vercel
- [ ] Code pushed to GitHub
- [ ] Vercel deployment successful
- [ ] Admin panel accessible (`/admin/sheets`)
- [ ] Sheet validation works
- [ ] Manual sync works
- [ ] Patients appear in `/patients` page
- [ ] Patient details display correctly (Arabic names, phones, emails)

---

## 🎯 **What Happens Now**

### **Automatic Daily Sync**

Starting tomorrow, the system will:
- Run sync every day at **2:00 AM UTC** (4:00 AM Egypt time)
- Import any new patients from your Google Sheet
- Update existing patients (fill empty fields only)
- Log all syncs to `sheet_sync_logs` table

### **Manual Sync Anytime**

Doctor can trigger sync manually:
1. Go to `/admin/sheets`
2. Click **Sync Now**
3. Results show instantly

### **Patient Workflow**

1. Patient fills your Google Form
2. Response saves to Google Sheets
3. Daily sync (or manual) imports to ProCare Clinic
4. Doctor searches patient → sees all info
5. Osstem hardware auto-uploads images to patient

---

## 🐛 **Troubleshooting**

### "Failed to access sheet"

**Cause:** Service account doesn't have access

**Fix:**
1. Open your Google Sheet
2. Click Share
3. Verify service account email is in the list
4. Permission must be "Viewer" or higher

### "Authentication failed" in admin panel

**Cause:** Environment variables not set correctly

**Fix:**
1. Go to Vercel → Settings → Environment Variables
2. Check `ADMIN_API_KEY` exists
3. Check `NEXT_PUBLIC_ADMIN_API_KEY` matches `ADMIN_API_KEY`
4. Redeploy after adding variables

### "No data found in sheet"

**Cause:** Wrong sheet range

**Fix:**
1. Check if your data is in "Sheet1"
2. If it's in a different tab (e.g., "Form Responses 1"), update range:
   - In admin panel: Change range to `Form Responses 1!A:Z`
   - Or update `GOOGLE_SHEETS_RANGE` in Vercel

### Patients not matching correctly

**Cause:** Duplicate names or missing phone numbers

**Fix:**
1. Use "Force Update" for first sync (checkbox in admin panel)
2. Add unique File Numbers in Google Sheet
3. Ensure phone numbers are consistent format

### Arabic text displays as gibberish

**Cause:** Encoding issue (rare)

**Fix:**
1. Check browser encoding is UTF-8
2. Verify Supabase database encoding is UTF-8
3. Re-run migration if needed

---

## 📞 **Need Help?**

### Check These First:
1. Vercel deployment logs: Dashboard → Deployments → Click latest → Logs
2. Supabase logs: Dashboard → Logs
3. Admin panel sync history: `/admin/sheets` → Show logs
4. Browser console: F12 → Console tab

### Common Log Messages:

✅ **"Sync completed successfully"** - Everything working
✅ **"20 created, 0 updated"** - First sync successful
❌ **"401 Unauthorized"** - Check API keys match
❌ **"404 Not Found"** - Check spreadsheet ID is correct
❌ **"500 Internal Server Error"** - Check Vercel logs for details

---

## 🎉 **Success!**

Your Google Sheets integration is now live! Your doctor can:

✅ Keep using Google Forms (unchanged)
✅ Patients auto-sync to ProCare Clinic
✅ Search patients instantly in web app
✅ View complete patient records with images
✅ Trigger manual sync anytime from admin panel

**Zero workflow disruption. Pure enhancement.**

---

## 📚 **Additional Resources**

- [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md) - Detailed technical guide
- [GOOGLE_SHEETS_QUICKSTART.md](GOOGLE_SHEETS_QUICKSTART.md) - Quick reference
- [DUMMY_PATIENT_DATA.md](DUMMY_PATIENT_DATA.md) - Test data with 20 patients
- [INTEGRATIONS_SUMMARY.md](INTEGRATIONS_SUMMARY.md) - Overview of all integrations

**You're all set!** 🚀
