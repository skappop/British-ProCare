# Google Sheets Integration - Quick Start

## 🚀 5-Minute Setup

### 1. Create Service Account
1. Go to https://console.cloud.google.com/iam-admin/serviceaccounts
2. Create service account → Download JSON key
3. Copy service account email (looks like `xyz@project.iam.gserviceaccount.com`)

### 2. Share Sheet
1. Open your Google Sheet with patient data
2. Click "Share" → Paste service account email → Set to "Viewer" → Share

### 3. Configure Environment
Add to `.env.local`:
```env
GOOGLE_SERVICE_ACCOUNT_JSON='<paste entire JSON contents here>'
ADMIN_API_KEY=<generate random key>
NEXT_PUBLIC_ADMIN_API_KEY=<same as above>

# Optional: Auto-sync
GOOGLE_SHEETS_SPREADSHEET_ID=<your sheet ID>
GOOGLE_SHEETS_RANGE=Sheet1!A:Z
CRON_SECRET=<generate random key>
```

### 4. Run Migration
```bash
# In Supabase SQL editor, paste contents of:
migrations/add_sheets_sync.sql
```

### 5. Install & Deploy
```bash
npm install googleapis
npm run build
# Deploy to production
```

### 6. Test
1. Go to `/admin/sheets`
2. Paste your Google Sheets URL
3. Click "Validate Sheet"
4. Click "Sync Now"
5. Check `/patients` for imported data

---

## 📋 Required Sheet Structure

**Minimum:**
- One column named "Full Name" or "Name" or "Patient Name"

**Recommended:**
| Full Name | Phone | Email | Date of Birth | Gender | File Number |
|-----------|-------|-------|---------------|--------|-------------|
| John Doe | 555-1234 | j@ex.com | 1985-03-15 | M | FN001 |

---

## 🔄 Sync Behavior

**Smart Sync (Default):**
- Creates new patients
- Fills empty fields in existing patients
- Never overwrites existing data

**Force Update:**
- Overwrites all fields with sheet data
- Use for initial bulk import

**Patient Matching:**
1. Name + Phone (best)
2. Name + Email
3. Name only (fuzzy)

---

## ⏰ Automatic Sync

**Already configured in `vercel.json`:**
- Runs daily at 2:00 AM UTC
- Uses environment variables for sheet ID
- Logs results to `sheet_sync_logs` table

**Disable:**
Remove `crons` section from `vercel.json`

---

## 🐛 Common Issues

❌ **"Failed to access sheet"**
→ Share sheet with service account email (Viewer permission)

❌ **"No data found"**
→ Check range: `Sheet1!A:Z` or `Form Responses 1!A:Z`

❌ **"Must have Name column"**
→ First row must contain column headers with "name"

❌ **Duplicates created**
→ Add phone numbers or file numbers for better matching

---

## 📊 Admin Panel

**Location:** `/admin/sheets`

**Features:**
- Validate sheet connection
- Manual sync trigger
- View sync history
- See imported patient count
- Review sync errors

---

## 🔒 Security

- ✅ Service account = read-only access
- ✅ Admin API key required for all syncs
- ✅ One-way sync (sheet → database only)
- ✅ All changes logged in `sheet_sync_logs`

---

## ✅ Success Indicators

After first sync, you should see:
- ✓ Patients in `/patients` page
- ✓ "Synced from Sheets" badge in admin panel
- ✓ Sync log entry with created/updated counts
- ✓ No errors in sync history

---

## 🎯 Workflow Enhancement

**Before:**
1. Patient fills Google Form
2. Doctor checks Google Sheets
3. Doctor manually enters data
4. Doctor uses Osstem hardware

**After:**
1. Patient fills Google Form
2. Data auto-syncs to ProCare Clinic
3. Doctor searches patient in web app
4. Osstem hardware auto-uploads to patient record

**Zero extra steps. Pure enhancement.**

---

For detailed instructions, see [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md)
