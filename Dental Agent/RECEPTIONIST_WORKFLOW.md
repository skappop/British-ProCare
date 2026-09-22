# British ProCare - Receptionist Workflow Guide

## Overview
As the receptionist, you are the **orchestrator** of the clinic's imaging workflow. You set the active patient, coordinate between the waiting room and treatment rooms, and ensure smooth session transitions.

---

## 🎯 Your Role
You control **who is active** in the system at any given time. This ensures that when the doctor captures images, they automatically go to the correct patient's gallery—no manual filing needed.

---

## 📋 Daily Workflow

### 1. **Start of Day Setup**

#### **Launch the Dental Agent (Clinic Computer)**
1. Open `dental_agent_branded.py` on the clinic computer
2. Wait for the splash screen (British ProCare logo animation)
3. Verify the **Session** tab opens by default
4. Check for: `⭕ No active patient selected`

**Status indicators:**
- 🟢 Green = Active patient selected
- ⭕ Gray = No active patient
- ⚠️ Orange = Manual mode (should rarely be used)

#### **Verify Configuration (Settings Tab)**
1. Click the **Settings** tab
2. Verify all paths are configured:
   - ✅ One2 executable path
   - ✅ One2 export folder
   - ✅ EzDent-i executable path
   - ✅ EzDent-i export folder
   - ✅ API Base URL: `https://british-pro-care.vercel.app`
   - ✅ Bridge API Key (should be filled in)

**Only do this once during initial setup—no need to check daily after that.**

---

### 2. **When a Patient Arrives**

#### **Check Patient In (Web System)**
1. Log into British ProCare web app: `https://british-pro-care.vercel.app`
2. Go to **Patients** page
3. Find the patient (search by name or ID)
4. Click the patient's row to open their page

#### **Set Active Patient**
1. Click the **Gallery** tab in the patient's page
2. The system automatically sets this patient as **active**
3. Wait 2-5 seconds for sync

#### **Verify in Dental Agent**
1. Look at the clinic computer (Dental Agent)
2. You should now see: `🟢 Active Patient: [Patient Name]`
3. If you see the patient name, you're ready ✅

**Important:** The Dental Agent polls the server every 2 seconds. If the patient name doesn't appear immediately, wait 5 seconds and check again.

---

### 3. **Patient Goes to Treatment Room**

#### **Inform the Doctor/Assistant**
Simply say: *"[Patient Name] is active in the system. You're ready to start imaging."*

#### **What Happens Next (No Action Needed)**
- Doctor or assistant launches One2 and/or EzDent-i using the Dental Agent
- Images are captured during the appointment
- At the end, they click **"End Session & Upload Images"**
- Images appear in the patient's gallery within 30 seconds

#### **Your Role: Monitor**
- Keep the patient's gallery page open (refreshes automatically)
- Watch for new images to appear after session ends
- If no images appear within 2 minutes, check with the doctor

---

### 4. **Switching Between Patients**

#### **Scenario: Multiple Treatment Rooms**
When you have overlapping appointments:

1. **Patient A** is currently active (in treatment room 1)
2. **Patient B** arrives and needs to go to treatment room 2

**Steps:**
1. Check if **Patient A's session** is complete
   - Look at Dental Agent: Does it show "Session Active"?
   - If yes, ask doctor to end the session first
2. Once Patient A's session ends, open **Patient B's gallery**
3. Dental Agent will automatically switch to Patient B
4. Inform doctor in treatment room 2: "Patient B is now active"

#### **Important Safety Feature**
If someone tries to capture images while a different patient is active, the system will:
- Detect the conflict
- Show a warning dialog
- Ask whether to:
  - **End previous session & upload** (safe choice)
  - **Discard previous session** (use only if previous session had issues)
  - **Keep previous session active** (cancel the patient change)

---

### 5. **End of Appointment**

#### **After Images Upload**
1. Refresh the patient's gallery page
2. Verify images appear in the correct categories:
   - 📷 **Intraoral** (One2 camera photos)
   - 🦷 **Radiographs** (X-rays)
   - 📄 **Documents** (if any)

#### **If Images Don't Appear**
1. Check the Dental Agent status
2. Look for error messages
3. Ask doctor if they clicked "End Session & Upload"
4. Check internet connection
5. If persistent issue, contact administrator

#### **Clear Active Patient (Optional)**
The system automatically clears active patients after 10 minutes of inactivity, but you can manually clear by:
1. Closing the patient's gallery page
2. Going back to the Patients list

**Note:** It's fine to leave the patient's gallery open—the next patient selection will override it automatically.

---

## 🖥️ Web System Features You'll Use

### **Patients Page**
Access: **Dashboard → Patients**

**What you see:**
- List of all patients
- Search bar (search by name, ID, phone)
- Quick filters (all, active, archived)
- Patient status indicators

**Actions you can take:**
- **Search patients** - Type name or ID in search bar
- **View patient** - Click row to open patient page
- **Add new patient** - Click "Add Patient" button
- **Edit patient info** - Click edit icon in patient row

### **Patient Gallery Page**
Access: **Patients → [Patient Name] → Gallery**

**What you see:**
- Grid of all patient images
- Filter tabs (All / Intraoral / Radiographs / Documents)
- Upload progress indicator (when Dental Agent is uploading)
- Image metadata (date, time, device)

**Actions you can take:**
- **Set active patient** - Opens automatically when you view gallery
- **Monitor uploads** - Watch for new images to appear
- **Manual upload** - Use "Upload Images" button if needed
- **View images** - Click to open full-size lightbox

### **Patient Overview Page**
Access: **Patients → [Patient Name] → Overview**

**What you see:**
- Patient demographics (name, DOB, contact info)
- Recent appointments
- Treatment history
- Recent images (thumbnail preview)

**Actions you can take:**
- **Edit patient info** - Update contact details, insurance, etc.
- **Schedule appointments** - Add upcoming visits
- **View full gallery** - Click "View All Images" link

---

## 💡 Tips for Efficient Workflow

### **Managing Multiple Patients**
Use a checklist system:
- ✅ Patient A: Active in system, currently in treatment room 1
- ⏸️ Patient B: Waiting in reception
- ✅ Patient C: Session complete, images uploaded

### **Handling Busy Days**
1. **Prioritize active sessions** - Always complete ongoing sessions before switching
2. **Use tabs effectively** - Open each patient's gallery in separate browser tabs
3. **Communicate clearly** - Tell doctors which patient is currently active
4. **Monitor session times** - Sessions auto-end after 60 minutes (configurable)

### **Dealing with Emergencies**
If a patient needs immediate imaging:
1. Check if there's an active session
2. If yes, ask doctor to quickly end it
3. Set emergency patient as active
4. Inform doctor: "Emergency patient [Name] is now active"

### **End of Day Checklist**
- ✅ All sessions ended (check Dental Agent)
- ✅ All images uploaded and visible in galleries
- ✅ No patient is currently "active" in the system
- ✅ Dental Agent can be closed

---

## 🚨 Troubleshooting

### **Patient Name Doesn't Appear in Dental Agent**

**Possible causes:**
1. Gallery page not fully loaded
2. Internet connection issue
3. API key configuration problem

**Solutions:**
1. Wait 10 seconds and check again
2. Refresh the patient's gallery page
3. Check if other web pages load (test internet)
4. Restart the Dental Agent if necessary
5. Contact administrator if persistent

### **Wrong Patient Name Shows in Dental Agent**

**Cause:** Previous patient's gallery is still open in another tab

**Solution:**
1. Close all patient gallery tabs
2. Open the correct patient's gallery
3. Wait 5 seconds for Dental Agent to sync
4. Verify correct name appears

### **"Upload Failed" Error**

**Possible causes:**
1. No internet connection
2. Server temporarily down
3. Large file size (takes longer)

**Solutions:**
1. Check internet connection
2. Wait 30 seconds and try again
3. Images are saved locally—can retry upload later
4. Contact administrator if persistent

### **Dental Agent Not Launching Software**

**Possible causes:**
1. Software paths not configured
2. Software already running in background

**Solutions:**
1. Check Settings tab for correct paths
2. Open Task Manager → Look for "oov.exe" or "EzDent-i.exe"
3. Close any running instances manually
4. Try launching again
5. Contact administrator if persistent

---

## 🎓 Best Practices

### **Patient Privacy**
- ✅ Always verify you've selected the correct patient before informing the doctor
- ✅ Close patient galleries when not actively monitoring
- ✅ Never leave the workstation unlocked with patient info visible
- ✅ Log out at end of day

### **Communication**
- ✅ Tell doctors: "Patient [Name] is active and ready"
- ✅ Warn doctors if you need to switch patients mid-session
- ✅ Confirm with doctor before ending any active session
- ✅ Report any upload issues immediately

### **System Maintenance**
- ✅ Keep the Dental Agent running during clinic hours
- ✅ Close it at end of day (don't leave running overnight)
- ✅ Report any error messages to administrator
- ✅ Verify configuration after any software updates

### **Workflow Optimization**
- ✅ Set active patient as soon as they arrive
- ✅ Monitor upload completion before patient leaves
- ✅ Keep patient gallery tabs organized (close completed ones)
- ✅ Use browser bookmarks for frequently accessed pages

---

## 📱 Quick Reference Card

| Task | Action | System |
|------|--------|--------|
| **Set active patient** | Open patient's Gallery tab | Web app |
| **Verify patient active** | Check for 🟢 green indicator | Dental Agent |
| **Switch patients** | Open new patient's Gallery | Web app |
| **Monitor uploads** | Watch patient gallery page | Web app |
| **Check session status** | Look at Session tab | Dental Agent |
| **End forgotten session** | Ask doctor or click End Session | Dental Agent |
| **Verify configuration** | Check Settings tab | Dental Agent |
| **Manual upload** | Use Upload button in gallery | Web app |

---

## 🔄 Common Daily Scenarios

### **Scenario 1: Normal Morning Appointment**
1. Patient arrives at 9:00 AM
2. You open their gallery page → Patient becomes active
3. You tell doctor: "Mr. Smith is ready in Room 1"
4. Doctor captures images
5. Doctor ends session
6. You verify images appear in gallery (9:30 AM)
7. Patient checks out

**Time: 5 minutes of your involvement**

### **Scenario 2: Back-to-Back Appointments**
1. Patient A in Room 1 (active, session ongoing)
2. Patient B arrives for Room 2
3. You wait for Patient A's session to end
4. Once ended, you open Patient B's gallery
5. You tell doctor in Room 2: "Patient B is now active"
6. Both sessions complete independently

**Key: Wait for previous session to end before switching**

### **Scenario 3: Emergency Patient**
1. Emergency patient arrives
2. Patient C has active session in Room 1
3. You inform doctor in Room 1: "Need to switch to emergency patient"
4. Doctor clicks "End Session & Upload"
5. You open emergency patient's gallery
6. Emergency imaging proceeds

**Time: 2 minutes to switch safely**

### **Scenario 4: Upload Issue**
1. Doctor ends session
2. No images appear after 2 minutes
3. You check Dental Agent for errors
4. You see "Upload Failed - No internet"
5. You verify internet connection
6. You ask doctor to retry: "End Session" again
7. Images upload successfully

**Solution: Retry once internet is restored**

---

## 📞 Who to Contact

### **Technical Issues**
- **Dental Agent won't start** → IT administrator
- **Upload failures** → IT administrator
- **Configuration problems** → Clinic manager
- **Internet connectivity** → IT administrator

### **Workflow Questions**
- **How to handle multiple patients** → Clinic manager
- **Patient scheduling conflicts** → Office manager
- **Training refresher** → Review this guide or ask senior staff

### **Clinical Questions**
- **Which images to take** → Doctor
- **Image quality concerns** → Doctor
- **Treatment decisions** → Not your responsibility (doctor handles)

---

## 🎯 Success Metrics

You'll know you're doing well when:
- ✅ Zero images uploaded to wrong patients
- ✅ All session transitions happen smoothly
- ✅ Doctors never have to manually enter patient IDs
- ✅ No forgotten sessions left open overnight
- ✅ All images appear in galleries within 1 minute of session end

---

*British ProCare Dental Clinics - Efficient Reception Workflow*
