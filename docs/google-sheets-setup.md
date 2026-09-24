# Google Sheets Integration - Complete Setup Guide

This guide shows you how to sync patient data from your Google Forms/Sheets into ProCare Clinic **without replacing your existing workflow**. Think of this as an enhancement—patients fill out forms like always, and their data automatically flows into your web app.

---

## 🎯 What This Does

- ✅ **Reads patient data** from your Google Sheets (from Google Forms responses)
- ✅ **Automatically creates new patients** in ProCare Clinic database
- ✅ **Smart updates**: Fills missing fields without overwriting manual edits
- ✅ **Scheduled sync**: Can run automatically every night (optional)
- ✅ **Manual sync button**: Doctor can trigger sync anytime from admin panel
- ✅ **Zero workflow disruption**: Your Google Forms continue working exactly as before

---

## 📋 Prerequisites

- Google account with access to the patient data sheet
- Google Cloud Console access (free)
- 15 minutes for initial setup

---

## 🔧 Step 1: Create Google Service Account

### 1.1 Go to Google Cloud Console

Visit: https://console.cloud.google.com/

### 1.2 Create a New Project (or use existing)

1. Click project dropdown at top
2. Click "New Project"
3. Name it: `ProCare Clinic`
4. Click "Create"

### 1.3 Enable Google Sheets API

1. Go to: https://console.cloud.google.com/apis/library
2. Search for "Google Sheets API"
3. Click "Enable"

### 1.4 Create Service Account

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click "Create Service Account"
3. Name: `procare-sheets-sync`
4. Description: `Read patient data from Google Sheets`
5. Click "Create and Continue"
6. Skip roles (click "Continue")
7. Click "Done"

### 1.5 Create Service Account Key

1. Click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Choose "JSON"
5. Click "Create"
6. **Save the downloaded JSON file securely** (you'll need it next)

### 1.6 Copy Service Account Email

From the service account details page, copy the email address. It looks like:
```
procare-sheets-sync@procare-clinic-123456.iam.gserviceaccount.com
```

---

## 📄 Step 2: Share Your Google Sheet

### 2.1 Open Your Patient Data Sheet

The sheet where Google Forms responses are saved.

### 2.2 Click "Share" Button

Top-right corner of the sheet.

### 2.3 Add Service Account

1. Paste the service account email (from Step 1.6)
2. Set permission to **Viewer** (read-only)
3. Uncheck "Notify people"
4. Click "Share"

**Your sheet is now accessible to the sync service!**

---

## 🔐 Step 3: Configure ProCare Clinic

### 3.1 Add Environment Variables

Edit `.env.local` and add:

```env
# Google Sheets Integration
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"procare-clinic-123456",...}'

# Admin API Key (generate a secure random string)
ADMIN_API_KEY=your-secure-random-admin-key-here

# Optional: Configure automatic daily sync
GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id-here
GOOGLE_SHEETS_RANGE=Sheet1!A:Z
CRON_SECRET=your-cron-secret-here
```

**How to fill these:**

**`GOOGLE_SERVICE_ACCOUNT_JSON`:**
- Open the JSON file you downloaded in Step 1.5
- Copy the **entire contents** (it's one long line)
- Paste it as the value (keep the single quotes)

**`ADMIN_API_KEY`:**
Generate a secure random key:
```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**`GOOGLE_SHEETS_SPREADSHEET_ID`:**
From your sheet URL: `https://docs.google.com/spreadsheets/d/**THIS_PART**/edit`

**`GOOGLE_SHEETS_RANGE`:**
- If your data is in "Sheet1", use: `Sheet1!A:Z`
- If Google Forms saves to "Form Responses 1", use: `Form Responses 1!A:Z`

### 3.2 Update Frontend Environment

Create `.env.local` (if not exists) and add:

```env
NEXT_PUBLIC_ADMIN_API_KEY=your-secure-random-admin-key-here
```

Use the **same** value as `ADMIN_API_KEY` above.

---

## 🗄️ Step 4: Database Migration

Run this SQL in your Supabase SQL editor:

```bash
# Copy contents from:
migrations/add_sheets_sync.sql
```

This adds:
- `synced_from_sheets` column to track imported patients
- `sheet_sync_logs` table for sync history
- `address` column for patient addresses

---

## 📦 Step 5: Install Dependencies

```bash
npm install googleapis
```

---

## ✅ Step 6: Deploy and Test

### 6.1 Deploy to Production

```bash
npm run build
# Deploy via Vercel, Netlify, or your platform
```

### 6.2 Access Admin Panel

Navigate to: `/admin/sheets`

### 6.3 Test Connection

1. Paste your Google Sheets URL
2. Click "Validate Sheet"
3. You should see: ✓ Sheet validated with title and columns

### 6.4 First Sync

1. Click "Sync Now"
2. Check the results summary
3. Navigate to `/patients` to see imported patients

---

## 📊 Expected Sheet Structure

Your Google Sheet should have these columns (names are flexible):

| Full Name | Phone | Email | Date of Birth | Gender | File Number | Notes |
|-----------|-------|-------|---------------|--------|-------------|-------|
| John Doe | 555-1234 | john@example.com | 1985-03-15 | M | FN001 | First visit |

**Required columns:**
- ✅ **Full Name** (or "Name", "Patient Name") - REQUIRED
- All other columns are optional

**Supported column names** (case-insensitive):
- Name: "Full Name", "Name", "Patient Name"
- Phone: "Phone", "Phone Number", "Mobile", "Contact"
- Email: "Email", "Email Address"
- DOB: "Date of Birth", "DOB", "Birth Date"
- Gender: "Gender", "Sex"
- File Number: "File Number", "File #", "Patient ID"
- Address: "Address", "Location"
- Notes: "Notes", "Comments", "Remarks"
- Ortho: "Ortho", "Orthodontic", "Is Ortho"

The system automatically detects these variations.

---

## 🔄 Sync Behavior

### Smart Sync (Default)

When syncing, the system:

1. **Matches existing patients** by:
   - Name + Phone (most reliable)
   - Name + Email (if no phone match)
   - Name only (fuzzy match)

2. **For existing patients:**
   - ✅ Fills **empty fields** only
   - ❌ Does NOT overwrite existing data
   - Example: If DB has phone but sheet has different phone, DB wins

3. **For new patients:**
   - ✅ Creates new patient record
   - ✅ Marks as `synced_from_sheets: true`

### Force Update Mode

Check "Force Update" to:
- ⚠️ **Overwrite existing data** with sheet data
- Use carefully - mainly for initial bulk import

---

## ⏰ Automatic Daily Sync (Optional)

### Option 1: Vercel Cron (Recommended)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-sheets",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This runs sync at 2:00 AM daily (UTC).

### Option 2: External Scheduler

Use any cron service (cron-job.org, EasyCron, etc.) to hit:

```
GET https://your-app.com/api/cron/sync-sheets
Authorization: Bearer your-cron-secret-here
```

Schedule: Daily at preferred time.

---

## 🔍 How Patients Use This

**Nothing changes for patients!** They:

1. Fill out your Google Form (as always)
2. Responses go to Google Sheets (as always)
3. ProCare Clinic syncs data automatically (new!)
4. Doctor can search for patient in web app (new!)

**Doctor workflow enhancement:**

- Before: Check Google Sheets → Copy info → Use Osstem
- After: Search patient in ProCare → View all info + images → Use Osstem (auto-uploads)

---

## 🐛 Troubleshooting

### "Failed to access sheet. Check sharing permissions."

**Solution:**
- Verify service account email is added to sheet (Step 2)
- Permission must be "Viewer" or higher
- Sheet must NOT be restricted to organization only

### "No data found in sheet"

**Solution:**
- Check the "Range" field (e.g., `Sheet1!A:Z` or `Form Responses 1!A:Z`)
- Ensure sheet has data (at least header row + 1 data row)

### "Sheet must have a Name or Full Name column"

**Solution:**
- First row must contain column headers
- One header must include "name", "full name", or "patient name"

### Patients Not Matching Correctly

**Solution:**
- Ensure phone numbers are formatted consistently (e.g., all with/without dashes)
- Use File Number column for unique identifiers
- Consider Force Update for initial bulk import, then Smart Sync going forward

### Sync Errors in History

Check sync history in admin panel:
- Click "Show logs"
- Expand errors to see specific issues
- Common: duplicate names, invalid dates, missing required fields

---

## 🔒 Security Notes

- ✅ Service account has **read-only** access to sheet
- ✅ API keys required for all sync operations
- ✅ Admin panel requires authentication
- ✅ Sync logs track all changes
- ✅ No data is sent back to Google Sheets (one-way sync)

---

## 📈 Best Practices

### 1. Test with Small Dataset First

- Start with 5-10 patients
- Verify sync behavior
- Check matching logic
- Then sync full sheet

### 2. Clean Your Sheet

Before first sync:
- Remove duplicate rows
- Standardize phone formats
- Fix invalid dates
- Add File Numbers for unique IDs

### 3. Use File Numbers

Add a "File Number" column in Google Forms:
- Auto-generate: Use Form add-on or Sheet formula
- Makes patient matching 100% reliable
- Prevents duplicate records

### 4. Monitor Sync Logs

Check sync history weekly:
- Review errors
- Verify created vs updated counts
- Ensure no unexpected duplicates

### 5. Backup Before Force Update

Before using "Force Update":
- Export current patients to CSV
- Or use Supabase table export
- Force Update overwrites data permanently

---

## 🎓 Advanced Usage

### Multiple Google Sheets

You can sync from multiple sheets:
1. Use different `spreadsheetId` for each sync
2. Or combine sheets into one with tabs
3. Sync each tab separately: `Sheet1!A:Z`, `Sheet2!A:Z`

### Custom Column Mapping

Edit [`src/lib/google-sheets.ts`](src/lib/google-sheets.ts) → `columnMap` object:

```typescript
const columnMap: Record<string, string[]> = {
  full_name: ['full name', 'patient name', 'custom name field'],
  // Add your custom column names here
}
```

### Webhook Sync (Real-time)

For instant sync when form is submitted:
1. Use Google Forms add-on: "Form Notifications"
2. Configure webhook to hit: `POST /api/admin/sync-sheets`
3. Include auth header: `Authorization: Bearer your-admin-api-key`

---

## ✅ Success Checklist

You've successfully integrated when:

- [x] Service account created and JSON downloaded
- [x] Google Sheet shared with service account
- [x] Environment variables configured
- [x] Database migration run
- [x] "Validate Sheet" returns success
- [x] First sync completes without errors
- [x] Patients appear in `/patients` page
- [x] Sync history shows in admin panel
- [x] (Optional) Automatic daily sync configured

**Congratulations!** Your Google Forms workflow now feeds directly into ProCare Clinic. Patients fill forms → Data syncs → Doctor searches in web app → Osstem hardware auto-uploads images to correct patient. **Zero disruption, total enhancement.**

---

## 📞 Support

**Common Questions:**

Q: Will this delete my existing patients?
A: No. Sync only creates new or updates existing. Never deletes.

Q: Can I still manually add patients?
A: Yes! Manual and synced patients coexist perfectly.

Q: What if I stop using Google Forms?
A: Just stop syncing. Your data stays in ProCare Clinic. No dependencies.

Q: Can I undo a sync?
A: Sync logs track everything. You can identify and remove synced patients by `synced_from_sheets = true`.

---

**You're all set!** Your doctor can keep using the familiar Google Forms workflow while enjoying the enhanced ProCare Clinic features.
