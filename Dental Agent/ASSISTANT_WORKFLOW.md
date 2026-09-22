# British ProCare - Assistant Workflow Guide

## Overview
As a dental assistant, you are the **bridge** between the doctor and the imaging system. You prepare patients, assist with image capture, verify image quality, and ensure smooth workflow during appointments.

---

## 🎯 Your Role
You help the doctor by:
- **Operating imaging equipment** (One2 camera, EzDent-i X-ray)
- **Managing the Dental Agent** during sessions
- **Ensuring image quality** before ending sessions
- **Coordinating with reception** for patient transitions

---

## 📋 Daily Workflow

### 1. **Start of Day Preparation**

#### **Check Equipment**
- ✅ One2 intraoral camera powered on and connected
- ✅ EzDent-i X-ray system ready and calibrated
- ✅ Clinic computer running with Dental Agent open
- ✅ Internet connection stable

#### **Verify Dental Agent Status**
1. Look at the clinic computer screen
2. Check the Dental Agent window:
   - Should show: `⭕ No active patient selected`
   - Session tab should be visible
3. If Dental Agent isn't running, launch it:
   - Double-click `dental_agent_branded.py`
   - Wait for British ProCare logo animation
   - Verify main window opens

#### **Test Session (Optional but Recommended)**
Once per day, verify the system works:
1. Ask reception to select a test patient
2. Launch One2 software
3. Take one test image
4. End session and verify upload
5. Check that image appears in test patient's gallery

---

### 2. **Before Each Appointment**

#### **Coordinate with Reception**
1. Reception will inform you: *"Patient [Name] is active and ready"*
2. Verify in Dental Agent: `🟢 Active Patient: [Patient Name]`
3. If patient name doesn't match, alert reception immediately

#### **Prepare Treatment Room**
- ✅ Clean imaging equipment
- ✅ Position One2 camera within reach
- ✅ Prepare X-ray positioning devices
- ✅ Have patient wear protective equipment (lead apron for X-rays)

#### **Patient Handoff Checklist**
When doctor arrives:
- ✅ Confirm patient name verbally
- ✅ Point out Dental Agent screen showing correct patient
- ✅ Inform doctor which software is needed (camera, X-ray, or both)

---

### 3. **During the Appointment**

#### **Launching Imaging Software**

**Option 1: One2 Only (Intraoral Photos)**
1. Click **📷 Launch One2** in the Dental Agent
2. Wait for One2 software to open
3. Status shows: `✅ Running`
4. Proceed with image capture

**Option 2: EzDent-i Only (X-rays)**
1. Click **🦷 Launch EzDent-i** in the Dental Agent
2. Wait for EzDent-i software to open
3. Status shows: `✅ Running`
4. Proceed with radiograph capture

**Option 3: Both Systems (Full Session)**
1. Click **🚀 Launch Both** in the Dental Agent
2. Both software applications open simultaneously
3. Both show: `✅ Running`
4. Capture photos and X-rays as needed

**Option 4: Add Software Mid-Session**
Already started with One2, but now need X-rays?
1. Click **🦷 Launch EzDent-i** even though session is active
2. EzDent-i opens without ending the current session
3. Both systems remain active
4. All images upload together at session end

#### **Operating the One2 Camera**

**Standard Intraoral Series:**
1. Position patient comfortably
2. Insert cheek retractors if needed
3. Adjust camera angle and lighting
4. Capture each view:
   - Anterior (front teeth)
   - Right lateral (right side)
   - Left lateral (left side)
   - Occlusal upper (top arch)
   - Occlusal lower (bottom arch)
5. Review each image in One2 software immediately
6. Retake any unclear images before moving on

**Tips for Quality Images:**
- ✅ Ensure sharp focus (half-press shutter to focus first)
- ✅ Avoid glare from saliva or moisture (use air syringe)
- ✅ Center the tooth/area of interest
- ✅ Use proper isolation (tongue retractors, mirrors)
- ✅ Check for proper exposure (not too dark or washed out)

#### **Operating EzDent-i X-ray**

**Standard Radiographic Series:**
1. Position patient's head correctly
2. Insert sensor or position film
3. Align X-ray cone precisely
4. Verify positioning before exposure
5. Take exposure
6. Review image quality in EzDent-i software
7. Retake if needed (poor positioning, exposure issues)

**Important: EzDent-i creates multiple files per X-ray**
- `temp_iosensor_YYYYMMDD_HHMMSS_Original.jpg`
- `temp_iosensor_YYYYMMDD_HHMMSS_Rotated.jpg`
- `temp_iosensor_YYYYMMDD_HHMMSS.dcm` (DICOM)
- `temp_iosensor_YYYYMMDD_HHMMSS_Thumbnail.jpg`
- `temp_iosensor_YYYYMMDD_HHMMSS_Tag.txt`

**Don't worry about duplicates!** The Dental Agent automatically:
- Groups files by timestamp
- Filters out thumbnails and tag files
- Keeps only the best version (DICOM preferred)
- Uploads one file per X-ray

#### **Session Monitoring**

**Watch the Dental Agent window:**
- **Session timer**: Shows elapsed time (e.g., "Session Active: 15:32 elapsed")
- **Software status**: Shows which programs are running
- **Timeout warning**: After 50 minutes, you'll see a warning dialog

**What the timer means:**
- Sessions auto-end after 60 minutes (configurable)
- Prevents forgotten sessions from staying open overnight
- You can continue the session if warned (resets the timer)

#### **Patient Change During Session**

**Rare scenario:** Reception needs to switch to a different patient mid-session.

**What happens:**
1. Dialog appears: *"⚠️ Session Already Active"*
2. You see options:
   - **Yes** = End current & upload
   - **No** = Discard current (no upload)
   - **Cancel** = Keep current session

**What you should do:**
1. Ask the doctor if current images are complete
2. If yes, choose **"Yes"** to end and upload
3. If images aren't ready, choose **"Cancel"** and complete the session first
4. Never choose **"No"** unless the session was started by mistake

---

### 4. **End of Appointment**

#### **Quality Check Before Ending Session**

**Review checklist:**
- ✅ All required images captured
- ✅ All images are clear and properly exposed
- ✅ No images need to be retaken
- ✅ Doctor has reviewed and approved images

**Where to check:**
- **One2 images**: Review in One2 software gallery
- **X-rays**: Review in EzDent-i viewer
- **Count**: Note how many images were taken

#### **Ending the Session**

1. Click **"End Session & Upload Images"** in the Dental Agent
2. The system will:
   - Scan export folders for new files
   - Deduplicate X-ray files automatically
   - Show file count summary
3. You'll see a progress indicator (10-30 seconds)
4. Success dialog appears:
   ```
   ✅ Upload Successful
   
   Patient: [Patient Name]
   Uploaded: 12 images
   Failed: 0 images
   
   Images are now available in the patient gallery.
   ```
5. Click **OK** to close the dialog

#### **Post-Upload Verification**

**Immediately after upload:**
1. Ask reception: "Can you verify images appeared for [Patient Name]?"
2. Reception checks the patient's gallery page
3. If images don't appear within 1 minute, investigate

**Common issues:**
- Internet connection dropped → Retry upload
- Wrong export folder configured → Check Settings
- Images still processing → Wait 30 seconds and retry

#### **Cleanup**

- ✅ Close any open imaging software windows
- ✅ Clean equipment for next patient
- ✅ Dental Agent resets automatically (ready for next patient)
- ✅ Dispose of single-use items (sensor covers, etc.)

---

## 🖥️ Understanding the Dental Agent Interface

### **Session Tab (Your Main Workspace)**

**Active Patient Indicator (Top)**
- `🟢 Active Patient: [Name]` - Ready to start session
- `⭕ No active patient selected` - Waiting for reception to select patient
- `⚠️ Manual Mode` - Manual override active (should be rare)

**Patient ID Field**
- Normally **locked** (auto-filled from web system)
- **Manual button**: Only use if auto-sync fails (rare)
  - Click "Manual" → Type patient ID → Click "Lock"
  - Return to auto-sync after manual entry

**Status Display**
- `Ready to start session` - Initial state
- `Session Active: MM:SS elapsed` - Session running
- `Uploading...` - Files being sent to server

**Launch Software Buttons**
- **📷 Launch One2** - Opens intraoral camera software
- **🦷 Launch EzDent-i** - Opens X-ray software  
- **🚀 Launch Both** - Opens both simultaneously
- Buttons disable after launching (can't launch twice)

**End Session Button**
- Disabled initially (gray)
- Enabled (green) once session starts
- Click to upload all captured images

**Session Info**
- Shows which software is currently running
- Example: "Capturing from: One2 active, EzDent-i active"

### **Settings Tab (Occasional Use)**

**When to access Settings:**
- Initial setup (first time using the system)
- After software updates or reinstalls
- If export paths change
- If API configuration changes

**What you'll see:**
- One2 Intraoral Camera section (exe path, export folder)
- EzDent-i X-ray System section (exe path, export folder)
- British ProCare Server section (API URL, API key)
- Session Timeout section (timeout duration, warning threshold)

**Important: Don't change settings without administrator approval**

---

## 💡 Tips for Efficient Workflow

### **Speed Up Your Sessions**

**Preparation:**
- Have equipment ready before patient sits
- Launch software as soon as patient is active
- Know the standard imaging series for each procedure type

**During capture:**
- Review each image immediately (don't wait until the end)
- Retake poor images right away while setup is still in place
- Use keyboard shortcuts in imaging software (if available)

**After capture:**
- End session immediately (don't let it sit idle)
- Move to next patient quickly

### **Handling Multiple Imaging Sessions**

**Parallel treatment rooms:**
If your clinic has multiple treatment rooms:
1. Only one patient can be **active** at a time
2. Complete and end each session before starting the next
3. Coordinate with reception for patient switches
4. Don't rush—better to wait 30 seconds than upload to wrong patient

**Sequential patients:**
- End previous session completely before starting next
- Verify patient name changes in Dental Agent
- Don't overlap sessions (prevents mix-ups)

### **Dealing with Technical Issues**

**Software won't launch:**
1. Check if it's already running (look at taskbar)
2. Close it manually and try again
3. Check Settings tab for correct path
4. Restart Dental Agent if necessary

**Images not uploading:**
1. Check internet connection (open a browser)
2. Wait 30 seconds (large files take time)
3. Try ending session again
4. If persistent, save locally and contact IT

**Wrong patient name showing:**
1. Alert reception immediately
2. Do NOT capture images until resolved
3. Have reception close and reopen correct patient's gallery
4. Verify correct name appears before proceeding

### **Image Quality Standards**

**Reject and retake if:**
- ❌ Blurry or out of focus
- ❌ Poor lighting (too dark or washed out)
- ❌ Target area not centered or fully visible
- ❌ Motion blur (patient moved)
- ❌ Obstructions (tongue, finger, saliva)

**Good enough to keep:**
- ✅ Sharp focus on area of interest
- ✅ Proper exposure and contrast
- ✅ Full coverage of intended anatomy
- ✅ No motion artifacts
- ✅ Adequate lighting

---

## 🚨 Troubleshooting

### **"No Active Patient" Error**

**Problem:** You clicked "Launch One2" but got error: *"No active patient. Please wait for patient selection..."*

**Solutions:**
1. Check Dental Agent: Is there a 🟢 green indicator with patient name?
2. If not, ask reception: "Has [Patient Name] been set as active?"
3. Wait 5 seconds for sync to complete
4. If still no patient, reception may need to reopen patient's gallery
5. Last resort: Use "Manual" mode (click Manual button → enter patient ID)

### **"No Images Found" Warning**

**Problem:** You ended the session but system says: *"No new images were detected"*

**Possible causes:**
1. Images are still processing in the imaging software
2. Export folders configured incorrectly
3. No images were actually saved (software error)

**Solutions:**
1. Open the imaging software and verify images exist there
2. Check the export folder manually (browse to configured path)
3. Wait 30 seconds for processing, then try "End Session" again
4. If images exist but won't upload, contact IT (may need to check Settings)

### **Session Timer Showing Orange/Red**

**Problem:** Timer changed color or showing warning

**What it means:**
- **50 minutes**: Warning threshold—system alerts you
- **60 minutes**: Auto-end threshold—session will close automatically

**What to do:**
1. Check if imaging is complete
2. If yes, end session immediately
3. If still capturing, click "Continue Session" when prompted (resets timer)
4. If doctor is still working, let them know session will auto-end soon

### **Upload Failed Error**

**Problem:** Dialog shows: *"Upload Failed - Server returned error 401"*

**Error codes:**
- **401 Unauthorized**: API key issue (contact IT)
- **404 Not Found**: Patient doesn't exist in database
- **500 Server Error**: Temporary server issue (retry in 1 minute)
- **Network Error**: Internet connection problem

**Solutions:**
1. Check internet connection (open browser, try loading a website)
2. Retry ending session (files are saved locally, safe to retry)
3. If error persists, inform reception and doctor
4. Images are NOT lost—they're saved in export folders
5. Contact IT for manual upload if urgent

### **Software Froze or Crashed**

**Problem:** One2 or EzDent-i stopped responding

**Solutions:**
1. DO NOT end the Dental Agent session yet
2. Try closing the frozen software normally (X button)
3. If unresponsive, open Task Manager (Ctrl+Shift+Esc)
4. Find "oov.exe" or "EzDent-i.exe" and click "End Task"
5. Check the export folder—are the images there?
6. If images are there, end the Dental Agent session (will still upload)
7. If images are missing, you may need to retake them

---

## 🎓 Best Practices

### **Patient Communication**

**Before imaging:**
- "We're going to take some photos of your teeth today"
- "Please hold still while I position the camera"
- "You'll feel slight pressure from the cheek retractor"

**During imaging:**
- "Great, hold that position"
- "Just one more angle"
- "You're doing great, almost done"

**After imaging:**
- "All done! The images look great"
- "These will be in your file for Dr. [Name] to review"

### **Professional Standards**

**Accuracy:**
- ✅ Always verify patient name before starting
- ✅ Double-check image quality before ending session
- ✅ Confirm upload success before patient leaves
- ✅ Report any issues immediately

**Efficiency:**
- ✅ Minimize patient chair time
- ✅ Have all equipment ready beforehand
- ✅ End sessions promptly
- ✅ Keep workflow moving smoothly

**Communication:**
- ✅ Coordinate with reception on patient switches
- ✅ Alert doctor to any technical issues
- ✅ Report image quality concerns
- ✅ Document any problems in patient notes

### **Safety and Compliance**

**Radiation safety (X-rays):**
- ✅ Always use lead apron and thyroid collar
- ✅ Position patient correctly (minimize retakes)
- ✅ Use lowest effective exposure settings
- ✅ Stand behind protective barrier during exposure

**Infection control:**
- ✅ Use barrier protection on camera tips
- ✅ Disinfect equipment between patients
- ✅ Follow clinic's infection control protocol
- ✅ Dispose of single-use items properly

**Privacy:**
- ✅ Verify correct patient before imaging
- ✅ Never leave patient images visible to others
- ✅ Close imaging software when not in use
- ✅ Log out of systems at end of day

---

## 📱 Quick Reference Card

| Task | Action | Timing |
|------|--------|--------|
| **Check patient active** | Look for 🟢 indicator | Before launching software |
| **Launch camera** | Click 📷 Launch One2 | When ready to capture photos |
| **Launch X-ray** | Click 🦷 Launch EzDent-i | When ready for radiographs |
| **Add software mid-session** | Click additional launch button | Anytime during session |
| **Check session time** | Read timer display | Every 10-15 minutes |
| **Review images** | Check in imaging software | Before ending session |
| **End session** | Click End Session & Upload | After all imaging complete |
| **Verify upload** | Ask reception to check gallery | Within 1 minute of upload |

---

## 🔄 Common Daily Scenarios

### **Scenario 1: Standard Checkup (Intraoral Photos Only)**
1. Reception sets patient active (9:00 AM)
2. You verify: `🟢 Active Patient: Sarah Johnson`
3. You click **📷 Launch One2**
4. You capture 8 intraoral photos (5 minutes)
5. You review images in One2 software (all clear)
6. Doctor reviews and approves
7. You click **End Session & Upload** (9:10 AM)
8. Upload completes: "Uploaded: 8 images"
9. Reception confirms images in gallery

**Total time: 10 minutes**

### **Scenario 2: Full Diagnostic Session (Photos + X-rays)**
1. Reception sets patient active (10:00 AM)
2. You click **🚀 Launch Both**
3. One2 and EzDent-i both open
4. You take 8 intraoral photos (5 minutes)
5. You switch to X-rays, take 4 periapicals (8 minutes)
6. You review all images (2 minutes)
7. Doctor reviews and approves
8. You click **End Session & Upload** (10:15 AM)
9. Upload completes: "Uploaded: 12 images" (8 photos + 4 X-rays)

**Total time: 15 minutes**
**Note:** Even though EzDent-i created 5 files per X-ray (20 files total), the system automatically deduplicated to 4 best versions.

### **Scenario 3: Started with Photos, Need X-rays Mid-Session**
1. Session started with One2 only (2:00 PM)
2. Doctor asks for X-rays after seeing photos
3. You click **🦷 Launch EzDent-i** (session stays active)
4. EzDent-i opens alongside One2
5. You take 2 X-rays (5 minutes)
6. You end session (2:10 PM)
7. All images upload together: "Uploaded: 10 images" (8 photos + 2 X-rays)

**Key advantage:** No need to end and restart session

### **Scenario 4: Technical Issue Recovery**
1. Session active, captured 6 photos
2. One2 software freezes
3. You close One2 (Ctrl+Alt+Del → End Task)
4. You browse to export folder: 6 JPG files present
5. You click **End Session & Upload** anyway
6. Upload completes: "Uploaded: 6 images"
7. All images successfully transferred despite software crash

**Key: Files are saved even if software crashes**

---

## 📞 Who to Contact

| Issue | Contact |
|-------|---------|
| Software won't launch | IT administrator |
| Upload failures | IT administrator |
| Wrong patient active | Reception |
| Image quality concerns | Supervising dentist |
| Equipment malfunction | Equipment service provider |
| Configuration changes | Clinic manager |
| Training questions | Senior assistant or clinic manager |

---

## 🎯 Success Metrics

You'll know you're performing well when:
- ✅ Zero images uploaded to wrong patients (perfect accuracy)
- ✅ Average session time under 15 minutes
- ✅ Less than 5% image retake rate (good first-time quality)
- ✅ 100% upload success rate
- ✅ No forgotten sessions left open
- ✅ Smooth coordination with reception and doctor

---

*British ProCare Dental Clinics - Excellence in Clinical Support*
