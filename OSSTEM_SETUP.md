# Osstem Hardware Bridge - Complete Setup Guide

This guide walks you through integrating Osstem intraoral cameras and X-ray sensors with your ProCare Clinic web application.

---

## 📋 Prerequisites

- Windows PC with Osstem hardware and docking software installed
- Node.js 16+ installed on the Windows PC
- Your Next.js application deployed and accessible
- Supabase project with `patient-images` storage bucket

---

## 🗃️ Database Setup

### 1. Run the Migration

Execute the SQL migration in your Supabase SQL editor:

```bash
# Copy the migration content from:
migrations/add_image_category.sql
```

This adds:
- `category` column (radiograph/intraoral/document)
- `notes` column for metadata
- Indexes for performance
- Backfills existing records

### 2. Verify Storage Bucket

Ensure the `patient-images` bucket exists in Supabase Storage with proper policies:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload patient images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'patient-images');

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can view patient images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'patient-images');
```

---

## 🔧 Next.js Configuration

### 1. Add Environment Variables

Edit `.env.local` and add:

```env
# Bridge API Authentication
BRIDGE_API_KEY=generate-a-secure-random-key-here

# Supabase Service Role (for server-side uploads)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

**Generate a secure API key:**

```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 2. Deploy Updated Code

The following files have been added to your project:

**API Routes:**
- [`src/app/api/bridge/active-patient/route.ts`](src/app/api/bridge/active-patient/route.ts) - Active patient management
- [`src/app/api/bridge/upload/route.ts`](src/app/api/bridge/upload/route.ts) - Image upload endpoint
- [`src/app/api/patients/[id]/gallery-pdf/route.ts`](src/app/api/patients/[id]/gallery-pdf/route.ts) - PDF export

**Frontend Components:**
- [`src/app/(dashboard)/patients/[id]/gallery/ActivePatientSync.tsx`](src/app/(dashboard)/patients/[id]/gallery/ActivePatientSync.tsx) - Auto-sets active patient
- [`src/app/(dashboard)/patients/[id]/gallery/CategorizedGallery.tsx`](src/app/(dashboard)/patients/[id]/gallery/CategorizedGallery.tsx) - Tabbed gallery view
- Updated [`page.tsx`](src/app/(dashboard)/patients/[id]/gallery/page.tsx) - Integrated components

Deploy to production:

```bash
npm run build
# Then deploy via Vercel, Netlify, or your platform
```

---

## 💻 Bridge Service Installation (Windows PC)

### 1. Install Dependencies

```bash
cd bridge
npm install
```

### 2. Configure Environment

```bash
cp .env.bridge.example .env.bridge
```

Edit `.env.bridge`:

```env
# Your deployed Next.js URL
API_BASE_URL=https://your-procare-clinic.vercel.app

# Same key as in Next.js .env.local
BRIDGE_API_KEY=your-secure-random-key-here

# Find these paths in Osstem settings
OSSTEM_INTRAORAL_FOLDER=C:\Osstem\Images
OSSTEM_XRAY_FOLDER=C:\Osstem\Xrays
OSSTEM_DICOM_FOLDER=C:\Osstem\DICOM
```

**Finding Osstem Folders:**
1. Open Osstem docking software
2. Go to Settings → Export/Save Preferences
3. Note the "Save Location" paths
4. Update `.env.bridge` with exact paths

### 3. Test the Bridge

Run in development mode first:

```bash
npm start
```

You should see:
```
✓ API connection successful
✓ File watcher ready
Bridge service is now running. Press Ctrl+C to stop.
Waiting for Osstem captures...
```

### 4. Test Capture Flow

1. **Open Patient Gallery** in web browser: `/patients/[patient-id]/gallery`
2. **Capture Image** with Osstem hardware
3. **Check Bridge Log** - should show:
   ```
   New file detected: IMG_20260914_143022.jpg
   ✓ Upload successful: abc123 (intraoral)
   ```
4. **Refresh Gallery** - image appears under "Intraoral" tab

If it works → proceed to Windows Service installation.

### 5. Install as Windows Service (Production)

**Run Command Prompt as Administrator**, then:

```bash
cd C:\path\to\procare-clinic\bridge
npm run install-service
```

Output:
```
✓ Service installed successfully
✓ Service started
```

The service will:
- ✅ Start automatically on Windows boot
- ✅ Restart automatically if it crashes
- ✅ Run in background (no terminal window)
- ✅ Log to `bridge/bridge.log`

**Verify Service is Running:**
1. Open Windows Services (`services.msc`)
2. Find "Osstem Hardware Bridge"
3. Status should be "Running"

---

## 🎯 Usage Workflow

### For Reception Staff

1. **Open Patient's Gallery Page**
   - Click patient name → Gallery tab
   - Status indicator shows: "📸 Osstem hardware auto-uploads are active"

2. **Doctor Captures Images**
   - Use Osstem intraoral camera or X-ray as normal
   - Images automatically upload to web app
   - No manual steps required

3. **View Categorized Images**
   - Toggle tabs: All / Radiographs / Intraoral / Documents
   - Images are auto-categorized by file type
   - Baseline images are marked

4. **Export PDF Summary**
   - Click "Export PDF Summary" button
   - Generates timestamped PDF with all image records

### Active Patient Logic

- **Active Duration:** 10 minutes after last page view
- **Auto-Refresh:** Every 5 minutes while page is open
- **Multi-Workstation:** Each PC tracks its own active patient

**Best Practice:** Always open the correct patient's gallery page BEFORE capturing images at the dental chair.

---

## 🐛 Troubleshooting

### Bridge Not Uploading Images

**Check 1: Service Status**
```bash
# Check if service is running
services.msc → "Osstem Hardware Bridge" → should be "Running"
```

**Check 2: Logs**
```bash
# View recent logs
tail -f bridge/bridge.log
# Or open bridge/bridge.log in Notepad
```

**Check 3: Test API Connection**
```bash
# Stop service first
net stop "Osstem Hardware Bridge"

# Run in terminal to see live output
cd bridge
npm start
```

Common log messages:
- ✅ `API connection successful` → Bridge is working
- ❌ `Authentication failed` → Check `BRIDGE_API_KEY` matches on both sides
- ❌ `No valid folders to watch` → Verify Osstem folder paths
- ⚠️ `No active patient - skipping` → Open a patient's gallery page first

### Images Uploading to Wrong Patient

**Cause:** Active patient was set to different patient

**Solution:**
1. Always open correct patient's gallery page BEFORE capturing
2. Active patient clears after 10 minutes inactivity
3. Optionally add "Clear Active Patient" button to UI

### Osstem Files Not Detected

**Check 1: Folder Paths**
```bash
# Verify folders exist and match config
dir C:\Osstem\Images
dir C:\Osstem\Xrays
```

**Check 2: File Permissions**
- Bridge service runs as Local System account
- Ensure folders are readable by Local System
- Test: Capture an image manually and verify file appears

**Check 3: File Extensions**
- Supported: `.jpg`, `.jpeg`, `.png`, `.bmp`, `.dcm`, `.dicom`
- Unsupported files are ignored

### API Errors (401/500)

**401 Unauthorized:**
- `BRIDGE_API_KEY` mismatch between bridge and Next.js
- Regenerate key and update both `.env.bridge` and `.env.local`

**500 Internal Server Error:**
- Check Next.js logs (Vercel/server logs)
- Verify Supabase credentials are correct
- Ensure `patient-images` bucket exists

---

## 🔐 Security Notes

- **API Key:** Keep `BRIDGE_API_KEY` secret; it grants upload access
- **Service Role Key:** Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code
- **HTTPS Only:** Bridge communicates over HTTPS in production
- **Patient Validation:** API verifies patient exists before accepting upload
- **Storage Policies:** Supabase RLS controls who can view images

---

## 🚀 Advanced Configuration

### Multiple Workstations

Install bridge on each PC with Osstem hardware. All upload to same backend.

```env
# PC 1 (Operatory A)
OSSTEM_INTRAORAL_FOLDER=C:\Osstem\Images

# PC 2 (Operatory B)  
OSSTEM_INTRAORAL_FOLDER=D:\OsstemData\Images
```

### Custom Image Type Detection

Edit [`bridge/osstem-bridge.js`](bridge/osstem-bridge.js) → `detectImageType()` function:

```javascript
function detectImageType(filePath) {
  const fileName = path.basename(filePath).toLowerCase()
  
  // Custom clinic naming patterns
  if (fileName.startsWith('xray_')) return 'panoramic'
  if (fileName.includes('_io_')) return 'intraoral_front'
  
  // ... rest of logic
}
```

### Archive Processed Files

Uncomment in [`bridge/osstem-bridge.js`](bridge/osstem-bridge.js):

```javascript
if (success) {
  archiveFile(filePath) // Moves to _processed/ subfolder
}
```

### Redis for Active Patient (Multi-Server)

For production with multiple Next.js instances, replace in-memory storage with Redis:

```typescript
// src/app/api/bridge/active-patient/route.ts
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
})

// GET handler
const activePatientId = await redis.get('active_patient_id')

// POST handler  
await redis.set('active_patient_id', patient_id, { ex: 600 }) // 10 min TTL
```

---

## 📊 Monitoring

### Log Locations

**Bridge Service:** `bridge/bridge.log`
**Next.js:** Platform logs (Vercel, Railway, etc.)
**Supabase:** Database → Logs panel

### Health Check

```bash
# Test bridge connectivity
curl -H "Authorization: Bearer YOUR_BRIDGE_API_KEY" \
  https://your-app.com/api/bridge/active-patient
```

Expected response:
```json
{"patient_id": "uuid-here", "last_activity": 1726332000000}
```

---

## 🆘 Support Checklist

If you encounter issues, gather this info:

- [ ] Bridge service status (running/stopped)
- [ ] Last 50 lines of `bridge/bridge.log`
- [ ] Osstem folder paths from `.env.bridge`
- [ ] Next.js environment variables are set
- [ ] Database migration was run successfully
- [ ] Test image file appeared in Osstem folder
- [ ] Active patient ID from API response

---

## ✅ Success Criteria

You've successfully integrated when:

1. ✅ Bridge service runs as Windows Service
2. ✅ Opening patient gallery sets active patient
3. ✅ Capturing with Osstem uploads image automatically
4. ✅ Image appears in correct category (radiograph/intraoral)
5. ✅ PDF export generates summary with all images
6. ✅ Multiple workstations can upload simultaneously

**Congratulations!** Your clinic now has automated hardware-to-web integration with zero workflow disruption.
