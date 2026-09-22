# Osstem Hardware Bridge

Automatically uploads images from Osstem intraoral cameras and X-ray sensors to your ProCare Clinic patient hub.

## How It Works

1. **File Monitoring**: Watches Osstem output folders for new images/DICOM files
2. **Active Patient Sync**: Queries your Next.js app to get the currently active patient
3. **Auto Upload**: Uploads captured images with proper categorization (radiograph/intraoral/document)
4. **Zero Disruption**: Staff continues using Osstem hardware normally—no workflow changes

## Installation

### 1. Install Dependencies

```bash
cd bridge
npm install
```

### 2. Configure Environment

```bash
cp .env.bridge.example .env.bridge
```

Edit `.env.bridge` and set:
- `API_BASE_URL`: Your Next.js application URL
- `BRIDGE_API_KEY`: A secure random key (use the same key in Next.js `.env.local`)
- `OSSTEM_*_FOLDER`: Paths where Osstem saves files (check your Osstem settings)

### 3. Configure Next.js

Add to your Next.js `.env.local`:

```env
BRIDGE_API_KEY=your-secure-random-key-here
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 4. Update Database Schema

Add `category` column to `image_records` table:

```sql
ALTER TABLE image_records 
ADD COLUMN category TEXT CHECK (category IN ('radiograph', 'intraoral', 'document')) DEFAULT 'intraoral';
```

Then run `migrations/10_active_patient.sql` in the Supabase SQL Editor. The
active patient is stored in that table, not in the API's memory — on Vercel
each serverless instance has its own memory, so the web app's POST and the
bridge's polling GET land on different instances and the bridge reads back
nothing. Without this table the bridge will never see an active patient.

## Usage

### Development Mode

Run the bridge service in terminal:

```bash
cd bridge
npm start
```

Leave this running while using the clinic software.

### Production Mode (Windows Service)

Install as a Windows service so it runs automatically on startup:

```bash
# Run as Administrator
cd bridge
npm run install-service
```

The service will:
- Start automatically when Windows boots
- Restart automatically if it crashes
- Run in the background (no terminal window)
- Log to `bridge/bridge.log`

To uninstall:

```bash
npm run uninstall-service
```

## Finding Osstem Output Folders

Osstem software usually saves files to locations like:
- `C:\Osstem\Images` (intraoral camera)
- `C:\Osstem\Xrays` (X-ray sensor)
- `C:\Program Files\Osstem\Data\Images`
- `C:\Users\[Username]\Documents\Osstem`

**How to find the exact paths:**
1. Open Osstem docking software
2. Go to Settings → Export/Save preferences
3. Note the "Save Location" paths
4. Update `.env.bridge` with these paths

## Workflow

### In the Web App
1. Receptionist opens Patient #42's page (`/patients/42/gallery`)
2. This automatically sets Patient #42 as the "active patient"

### At the Dental Chair
3. Doctor captures intraoral photo using Osstem camera
4. Image saves to `C:\Osstem\Images\IMG_20260914_143022.jpg`
5. Bridge detects file → queries API → gets active patient ID (42)
6. Bridge uploads image → categorizes as "intraoral" → links to Patient #42
7. Image appears instantly in Patient #42's gallery (categorized properly)

**Staff sees ZERO extra steps.** They just use the hardware as always.

## Troubleshooting

### No images uploading

1. **Check bridge is running**:
   - Development: Look for terminal output
   - Service: Check Windows Services for "Osstem Hardware Bridge"

2. **Check logs**: Open `bridge/bridge.log`

3. **Test API connection**:
   - Bridge logs should show "API connection successful" on startup
   - If you see 401 errors, your `BRIDGE_API_KEY` doesn't match

4. **Verify folders**:
   - Bridge logs show which folders are being watched
   - Capture a test image with Osstem and check if file appears in watched folder

5. **Active patient not set**:
   - Bridge will skip uploads if no active patient
   - Check logs: "No active patient - skipping [filename]"
   - Solution: Open a patient's **gallery** page in the web app
     (`/patients/<uuid>/gallery`). The patient profile page does not activate
     anything — only the gallery page does.
   - Check `migrations/10_active_patient.sql` has been run, and that
     `SUPABASE_SERVICE_ROLE_KEY` is set in the Vercel project's environment
     variables (the API needs it to read the slot for the bridge, which has no
     Supabase session). Redeploy after adding it.
   - Test directly:
     `curl -H "Authorization: Bearer $BRIDGE_API_KEY" https://<your-app>/api/bridge/active-patient`

### Images uploading to wrong patient

- Active patient stays set for 10 minutes of inactivity
- Always open the correct patient's page BEFORE capturing
- Implement "Clear Active Patient" button if needed (see Advanced section)

## Advanced Features

### Custom Image Type Detection

Edit `detectImageType()` in `osstem-bridge.js` to customize how filenames map to image types.

### Archive Processed Files

Uncomment `archiveFile(filePath)` in `handleNewFile()` to move uploaded files to `_processed` subfolder.

### Multiple Workstations

Install the bridge service on each Windows PC that has Osstem hardware. All upload to the same Next.js backend.

### Manual Upload Override

If bridge is offline, staff can still use the web app's manual upload form in the gallery.

## Security Notes

- `BRIDGE_API_KEY` authenticates the local bridge to your API
- Use a strong random key (32+ characters)
- Bridge only uploads images; it cannot read patient data
- Files are uploaded via HTTPS
- API validates patient exists before accepting upload

## Support

**Common Issues:**
- ✗ "Authentication failed" → Check `BRIDGE_API_KEY` matches on both sides
- ✗ "No valid folders to watch" → Check Osstem folder paths in `.env.bridge`
- ✗ "Patient not found" → Active patient ID doesn't exist in database
- ✗ Upload fails → Check Supabase storage bucket exists and is writable

Check `bridge.log` for detailed error messages.
