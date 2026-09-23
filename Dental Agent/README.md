# ProCare Imaging — the background agent

**This is the current way to run imaging.** The agent runs in the background on
each chairside PC and is driven entirely from the website:

1. Open the patient's page and find the **Imaging** card.
2. Choose which computer the patient is at (once per browser — it's remembered).
3. Press **Intraoral camera**, **X-ray** or **Both**. The software opens on that PC.
4. Capture as normal. Each image appears in the gallery as it's taken.
5. Press **End session**. The last images upload and the software closes.

Nobody needs to open or touch the agent. It shows as a round icon by the clock:
teal when ready, red while imaging, grey when offline or not set up.

## Installing on a PC

In this folder, in an ordinary (not Administrator) Command Prompt:

```
python setup_agent.py
```

That downloads the current version, installs what it needs, sets it to start
with Windows, and starts it. The first time, a settings window opens — fill in:

- **Website** and **Bridge API key** — the same key as in Vercel
- **Name** for this computer (e.g. "Clinic 1 — Chair 1") and its **clinic**
  (press *Load / test* to fetch the list)
- where **One2** and **EzDent-i** are installed, and their **export folders**

Settings are also under right-click on the tray icon.

To update later, run `python setup_agent.py` again — it replaces the running copy.
To check a PC, run `python doctor.py` and send the output.

## What it will and won't do

- **It never closes the imaging software unless every image uploaded.** If
  something fails, the software stays open, the session shows the reason on the
  patient's page, and the images that didn't make it are sent first the next
  time that patient is imaged.
- **Only images taken during the session are sent**, and only to that patient.
  Anything already in the export folders when the session starts is ignored,
  so back-to-back patients can't pick up each other's images.
- **X-rays are sent once each.** EzDent-i writes several temporary files per
  X-ray; the agent waits until the set is complete and sends the best one.
- **A dropped connection doesn't lose anything.** Captures queue up and send
  when the network is back. A restart mid-session picks up where it left off.
- Everything it does is written to `agent.log` in this folder.

## Files

| File | What it is |
| --- | --- |
| `dental_agent_service.py` | The background agent (tray, settings, main loop) |
| `agent_core.py` | Its logic: website API, uploads, watching the export folders |
| `install_service.py` | Starts it with Windows and registers `procare://` (`--uninstall` to remove) |
| `setup_agent.py` | Downloads the latest version and runs the installer |
| `doctor.py` | Read-only health check for a PC |
| `dental_agent_v2.py` | The previous windowed agent, kept as a manual fallback. It can't run while the background agent is running — quit that from the tray first. |

---

# British ProCare - Dental Agent README

## Overview
The **British ProCare Dental Agent** is a desktop application that seamlessly bridges local imaging software (One2 intraoral camera and EzDent-i X-ray system) with the British ProCare web platform. It automatically uploads captured images to the correct patient's gallery with zero manual data entry.

---

## ✨ Features

### **Automatic Patient Detection**
- Polls the British ProCare server every 2 seconds
- Auto-fills patient ID when receptionist opens patient gallery
- Eliminates manual data entry errors

### **Flexible Software Launch**
- Launch One2 only (for intraoral photos)
- Launch EzDent-i only (for X-rays)
- Launch both simultaneously
- Add software mid-session (no restart needed)

### **Smart X-ray Deduplication**
- EzDent-i creates 5-7 files per X-ray (DICOM, JPG, thumbnails, tags)
- Agent automatically selects best version only
- Priority: DICOM > JPG > Original > Rotated
- Uploads one file per X-ray capture

### **Session Management**
- Real-time elapsed timer display
- Auto-timeout after 60 minutes (configurable)
- Warning at 50 minutes (configurable)
- Patient change detection with smart conflict resolution

### **Professional Design**
- Matches British ProCare website aesthetic
- Gold (#B8935E) and teal (#4EC5C1) brand colors
- Marble (#F7F5F1) backgrounds with marquina (#17181A) accents
- Animated splash screen with clinic logo
- Clean, modern interface with Marcellus and Manrope fonts

---

## 📋 Requirements

### **System Requirements**
- **OS:** Windows 10 or later
- **Python:** 3.11 or higher
- **RAM:** 4GB minimum, 8GB recommended
- **Storage:** 500MB free space
- **Internet:** Stable connection required for uploads

### **Software Dependencies**
- One2 intraoral camera software (OSSTEM)
- EzDent-i X-ray software (optional)
- Python packages (see Installation)

### **Web System Requirements**
- British ProCare web app deployed and accessible
- Active patient API endpoint configured
- Upload API endpoint configured
- Bridge API key generated

---

## 🚀 Installation

### **Step 1: Install Python**
1. Download Python 3.11+ from [python.org](https://www.python.org/downloads/)
2. During installation:
   - ✅ Check "Add Python to PATH"
   - ✅ Choose "Install Now"
3. Verify installation:
   ```bash
   python --version
   ```
   Should show: `Python 3.11.x` or higher

### **Step 2: Install Required Packages**
1. Open Command Prompt (search for "cmd" in Start menu)
2. Navigate to the "Dental Agent" folder:
   ```bash
   cd "C:\path\to\Dental Agent"
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### **Step 3: Add Clinic Logo (Optional)**
1. Save your clinic logo as `logo.png` in the "Dental Agent" folder
2. Recommended size: 150x150 pixels (PNG format)
3. If logo is not present, application will show text logo

### **Step 4: Configure Settings**
1. Run the application for the first time:
   ```bash
   python dental_agent_branded.py
   ```
2. Wait for splash screen (2.5 seconds)
3. Click the **Settings** tab
4. Configure all paths and credentials (see Configuration section)

---

## ⚙️ Configuration

### **One2 Intraoral Camera Settings**

**Executable Path:**
- Browse to the One2 launch executable
- Typical path: `C:\OSSTEM\OneVision\One2\oov.exe`
- Or: `C:\Program Files\OSSTEM\OneVision\One2\oov.exe`

**Export Folder:**
- Browse to where One2 saves captured images
- Typical path: `C:\OSSTEM\OneVision\One2\oov.acq\acquired`
- Verify this is where images appear after capture

### **EzDent-i X-ray System Settings**

**Executable Path:**
- Browse to the EzDent-i launch executable
- Typical path: `C:\EzDent-i\EzDent-i.exe`
- Or: `C:\Program Files\EzDent-i\EzDent-i.exe`
- Leave blank if not using X-ray system

**Export Folder:**
- Browse to where EzDent-i saves X-rays
- Typical path: `C:\EzDent-i\temp`
- Or: `C:\Users\[Username]\Documents\EzDent-i\Export`
- Leave blank if not using X-ray system

### **British ProCare Server Settings**

**API Base URL:**
- Your deployed web application URL
- Production: `https://british-pro-care.vercel.app`
- Development: `http://localhost:3000` (if testing locally)
- **Must include** `https://` or `http://`

**Bridge API Key:**
- Secure key that authenticates the Dental Agent
- Obtain from your clinic administrator or IT department
- Minimum 32 characters recommended
- **Keep this secret** (like a password)

**How to generate Bridge API Key (for administrators):**
```bash
# On server or developer machine:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and:
1. Add to Vercel environment variables as `BRIDGE_API_KEY`
2. Add to Dental Agent settings (paste in "Bridge API Key" field)

### **Session Timeout Settings**

**Timeout (minutes):**
- How long before session auto-ends
- Default: `60` minutes
- Range: 30-120 minutes recommended
- Set to `0` to disable auto-timeout (not recommended)

**Warning (minutes):**
- When to show timeout warning before auto-end
- Default: `50` minutes
- Must be less than timeout value
- Recommended: 10 minutes before timeout

### **Saving Configuration**
1. After filling all settings, click **"Save Configuration"**
2. Success message confirms save
3. Settings are stored in `config.json` in the application folder
4. Settings persist between sessions (no need to reconfigure daily)

---

## 📖 Usage

### **Starting the Application**

**Method 1: Double-click (Recommended)**
1. Find `dental_agent_branded.py` in the file explorer
2. Double-click to launch
3. Wait for splash screen animation

**Method 2: Command Line**
1. Open Command Prompt
2. Navigate to folder: `cd "C:\path\to\Dental Agent"`
3. Run: `python dental_agent_branded.py`

**What happens on startup:**
- 🎬 Animated splash screen (2.5 seconds)
- 🔄 Background polling starts automatically
- 📡 Connects to British ProCare server every 2 seconds
- ✅ Ready to detect active patients

### **Daily Workflow**

#### **1. Wait for Active Patient**
- Receptionist opens patient gallery in web app
- Within 2-5 seconds, you'll see:
  ```
  🟢 Active Patient: [Patient Name]
  ```
- Patient ID field auto-fills
- Ready to start session

#### **2. Launch Imaging Software**

**For intraoral photos only:**
- Click **📷 Launch One2**

**For X-rays only:**
- Click **🦷 Launch EzDent-i**

**For both:**
- Click **🚀 Launch Both**

**Add software mid-session:**
- Already launched One2? Click **🦷 Launch EzDent-i** anytime
- Both systems work simultaneously

#### **3. Capture Images**
- Use imaging software normally
- Take as many photos/X-rays as needed
- Images save to configured export folders automatically
- Review quality before ending session

#### **4. End Session**
- Click **"End Session & Upload Images"**
- Wait 10-30 seconds for upload
- Success message shows upload count
- Images appear in patient gallery immediately

#### **5. Next Patient**
- Receptionist selects new patient in web app
- Patient name updates automatically in Dental Agent
- Ready for next session

### **Manual Override Mode**

**When to use:**
- Auto-sync temporarily not working
- Need to enter patient ID manually
- Emergency situations

**How to use:**
1. Click **"Manual"** button (next to Patient ID field)
2. Field becomes editable
3. Type patient ID manually
4. Click **"Lock"** to prevent changes
5. Proceed with session normally
6. Return to auto-sync mode after manual session

**Note:** Manual mode is a backup option—auto-sync should work 99% of the time.

---

## 🎨 Design Features

### **Splash Screen Animation**
- British ProCare logo with scale animation (mimics website login)
- Radial gold glow effect
- Animated loading dots
- 2.5 second duration
- Professional brand introduction

### **Color Palette**
- **Marquina** (#17181A): Dark backgrounds, headers
- **Gold** (#B8935E): Primary buttons, branding, accents
- **Gold Light** (#D9BC85): Text highlights, hover states
- **Teal** (#4EC5C1): Secondary buttons, success states
- **Marble** (#F7F5F1): Main backgrounds, light surfaces
- **Cream** (#EDE8DF): Input backgrounds, panels
- **Ink** (#3E4C59): Body text, labels
- **Sage** (#A9BCB0): Disabled states, muted text
- **Success** (#6E8F7C): Success messages, running indicators
- **Danger** (#C0654F): Error messages, warnings

### **Typography**
- **Display Font**: Marcellus (headings, titles)
- **Body Font**: Manrope (labels, body text)
- Fallback to system fonts if custom fonts unavailable

### **Visual Elements**
- Gold hairline dividers (signature brand element)
- Rounded buttons with hover effects
- Flat design with subtle shadows
- Consistent spacing and rhythm
- Professional medical aesthetic

---

## 🔧 Troubleshooting

### **Dental Agent Won't Start**

**Error: "Python is not recognized"**
- Python not installed or not in PATH
- Reinstall Python with "Add to PATH" checked

**Error: "No module named 'tkinter'"**
- Tkinter not included in Python installation
- Reinstall Python, ensure "tcl/tk" is checked

**Error: "No module named 'requests'"**
- Dependencies not installed
- Run: `pip install -r requirements.txt`

**Application opens then closes immediately:**
- Check for error messages in Command Prompt
- Try running from command line to see errors
- Verify `config.json` is not corrupted

### **Patient Not Appearing**

**Symptom:** `⭕ No active patient selected` won't change

**Possible causes:**
1. No internet connection
2. Wrong API Base URL configured
3. Wrong Bridge API Key
4. Receptionist hasn't opened patient gallery
5. Server is down

**Solutions:**
1. Check internet: Open browser, test connection
2. Verify Settings → API Base URL matches server
3. Verify Settings → Bridge API Key matches server configuration
4. Ask receptionist to open patient gallery (click Gallery tab)
5. Wait 10 seconds for polling to detect patient
6. Restart Dental Agent if issue persists

### **Software Won't Launch**

**Error: "Failed to launch One2"**
- Executable path incorrect
- Software already running (check taskbar)
- Software not installed

**Solutions:**
1. Settings → Verify executable path is correct
2. Close any running One2 instances (Task Manager)
3. Browse to path manually to verify file exists
4. Try launching software manually (outside Dental Agent) to verify it works

**Error: "Failed to launch EzDent-i"**
- Same troubleshooting as One2 above
- Verify EzDent-i is installed on this computer

### **Upload Failed**

**Error: "Unauthorized (401)"**
- Bridge API Key incorrect or missing
- Solution: Verify API Key in Settings matches server

**Error: "Patient not found (404)"**
- Patient ID doesn't exist in database
- Solution: Verify patient was created in web app first

**Error: "No internet connection"**
- Network issue
- Solution: Check internet, retry upload

**Error: "Server error (500)"**
- Temporary server issue
- Solution: Wait 1 minute and retry

**Images saved locally but not uploaded:**
- Files remain in export folders
- Safe to retry "End Session & Upload" multiple times
- Contact IT if upload continues to fail

### **No Images Found**

**Warning: "No new images were detected"**

**Possible causes:**
1. Images still processing in software
2. Export folder path incorrect
3. No images were actually captured

**Solutions:**
1. Open imaging software and verify images exist
2. Browse to export folder manually (check configured path)
3. Wait 30 seconds for processing, retry end session
4. Verify Settings → Export Folder paths are correct
5. Capture test image and verify it appears in export folder

### **Performance Issues**

**Application slow or freezing:**
- Too many files in export folders (thousands of images)
- Solution: Archive old images periodically

**Upload takes very long:**
- Large file sizes (DICOM files can be 5-10 MB each)
- Slow internet connection
- Solution: Wait for completion (can take 2-3 minutes for 20+ X-rays)

**System freezes during session:**
- Imaging software crashed
- Solution: Close imaging software, end session (images still upload)

---

## 🛡️ Security

### **API Key Protection**
- Bridge API Key is stored in `config.json` in plain text
- Keep this file secure (don't share or commit to version control)
- Regenerate key immediately if compromised

### **Patient Data Privacy**
- Patient IDs transmitted over HTTPS only
- Images uploaded via secure bearer token authentication
- No patient data stored locally after upload
- Original images remain in export folders (clinic's responsibility to manage)

### **Best Practices**
- ✅ Use strong API key (32+ characters, random)
- ✅ Lock workstation when away
- ✅ Don't share configuration files
- ✅ Keep Python and dependencies updated
- ✅ Use HTTPS for API Base URL (never HTTP in production)

---

## 📁 File Structure

```
Dental Agent/
├── dental_agent_branded.py       # Main application (redesigned)
├── dental_agent_v2.py            # Previous version (backup)
├── config.json                   # User configuration (auto-generated)
├── logo.png                      # Clinic logo (optional)
├── requirements.txt              # Python dependencies
├── README.md                     # This file
├── DOCTOR_WORKFLOW.md           # Doctor user guide
├── ASSISTANT_WORKFLOW.md        # Assistant user guide
└── RECEPTIONIST_WORKFLOW.md     # Receptionist user guide
```

### **config.json Format**
```json
{
  "one2_exe": "C:\\OSSTEM\\OneVision\\One2\\oov.exe",
  "one2_export": "C:\\OSSTEM\\OneVision\\One2\\oov.acq\\acquired",
  "ezdent_exe": "C:\\EzDent-i\\EzDent-i.exe",
  "ezdent_export": "C:\\EzDent-i\\temp",
  "api_base_url": "https://british-pro-care.vercel.app",
  "bridge_api_key": "your-64-character-hex-key-here",
  "session_timeout_minutes": "60",
  "session_warning_minutes": "50"
}
```

---

## 🔄 Updates and Maintenance

### **Updating the Application**
1. Close the Dental Agent if running
2. Replace `dental_agent_branded.py` with new version
3. Run `pip install -r requirements.txt` (in case dependencies changed)
4. Restart application
5. Configuration persists (no need to reconfigure)

### **Backing Up Configuration**
1. Copy `config.json` to safe location
2. Restore by copying back to application folder
3. Alternatively, take screenshots of Settings tab

### **Cleaning Export Folders**
- Export folders accumulate images over time
- Periodically archive old images to external storage
- Keep last 30 days of images for quick access
- Older images are already uploaded to web system

### **Monitoring**
- Check upload success messages daily
- Report any persistent errors to IT
- Verify images appear in web galleries
- Test system with one patient at start of day

---

## 📞 Support

### **Technical Support**
- **IT Administrator:** For configuration, network, and server issues
- **Clinic Manager:** For workflow and process questions
- **OSSTEM Support:** For One2 camera hardware issues
- **EzDent-i Support:** For X-ray system hardware issues

### **Documentation**
- **README.md**: This file (installation and configuration)
- **DOCTOR_WORKFLOW.md**: How doctors use the system
- **ASSISTANT_WORKFLOW.md**: How assistants operate the Dental Agent
- **RECEPTIONIST_WORKFLOW.md**: How receptionists set active patients

### **Common Questions**

**Q: Can multiple people use Dental Agent simultaneously?**
A: No—only one Dental Agent instance should run per clinic. Multiple treatment rooms share the same agent, coordinated by reception.

**Q: What happens if internet goes down during session?**
A: Images save locally in export folders. End session normally, and retry upload when internet returns.

**Q: Can I use this with other camera brands?**
A: Currently supports One2 (OSSTEM) only. Other cameras would require configuration changes.

**Q: How do I backup images?**
A: Images automatically upload to web system (cloud storage). Export folders serve as local temporary cache. Implement separate backup of export folders if desired.

**Q: Can I change the timeout duration?**
A: Yes—Settings tab → Session Timeout → Adjust "Timeout (minutes)" value → Save Configuration.

---

## 📜 License and Credits

**British ProCare Dental Agent**  
Version 3.0 - Branded Edition  
© 2026 British ProCare Dental Clinics

**Design System:**
- Inspired by British ProCare web platform aesthetic
- Colors: Gold (#B8935E), Teal (#4EC5C1), Marble (#F7F5F1)
- Fonts: Marcellus (display), Manrope (body)

**Technologies:**
- Python 3.11+
- Tkinter (GUI framework)
- Requests (HTTP client)
- Threading (background polling)

---

## 🚀 Quick Start Checklist

For first-time setup:

- [ ] Install Python 3.11+ with PATH enabled
- [ ] Run `pip install -r requirements.txt`
- [ ] Add `logo.png` to application folder (optional)
- [ ] Launch application: `python dental_agent_branded.py`
- [ ] Configure Settings tab:
  - [ ] One2 executable path
  - [ ] One2 export folder
  - [ ] EzDent-i paths (if using X-rays)
  - [ ] API Base URL
  - [ ] Bridge API Key
  - [ ] Session timeout settings
- [ ] Click "Save Configuration"
- [ ] Test with one patient:
  - [ ] Receptionist sets active patient
  - [ ] Verify patient name appears
  - [ ] Launch One2
  - [ ] Take test image
  - [ ] End session
  - [ ] Verify upload success
  - [ ] Check image in web gallery
- [ ] Ready for production use!

---

*British ProCare Dental Clinics - Streamlined Clinical Imaging*


## Opening the agent from the web app

A patient's page in the web app has an **Open in Dental Agent** button. It
launches this agent with that patient selected, or brings it forward if it is
already running — it never opens a second window.

Run this once per Windows user, on each PC that has the agent:

```
python install_protocol.py
```

That registers the `procare://` link handler under HKEY_CURRENT_USER, so it
needs no administrator rights. To remove it: `python install_protocol.py
--uninstall`.

The first time the button is used, the browser asks permission to open the
agent — tick "always allow" so it stops asking.

If the button appears to do nothing, the handler is not registered on that PC;
run the command above. The agent still works normally without it.
