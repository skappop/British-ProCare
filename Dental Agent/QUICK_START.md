# 🚀 Quick Start - British ProCare Dental Agent

## ✅ Status: Fixed and Ready

The crash issue has been resolved. The application now launches successfully with the beautiful British ProCare branding.

---

## 🎯 Launch the Application

### Option 1: Command Line
```bash
cd "C:\Users\Skappop\procare-clinic\Dental Agent"
python dental_agent_branded.py
```

### Option 2: Double-Click
1. Open File Explorer
2. Navigate to: `C:\Users\Skappop\procare-clinic\Dental Agent`
3. Double-click `dental_agent_branded.py`

---

## 🎨 What You'll See

1. **Animated Splash Screen (2.5 seconds)**
   - British ProCare logo with gold glow effect
   - "BRITISH PROCARE" in elegant Marcellus font
   - Gold hairline divider
   - Loading animation

2. **Main Application Window**
   - Professional marble background
   - Marquina dark header with logo
   - Gold and teal color scheme
   - **Session tab FIRST** (main workspace)
   - **Settings tab LAST** (configuration)

---

## ⚙️ First-Time Setup

### Required Configuration (Settings Tab):

1. **One2 Intraoral Camera** (if you have it):
   - Exe Path: `C:\OSSTEM\OneVision\One2\oov.exe`
   - Export Folder: `C:\OSSTEM\OneVision\One2\oov.acq\acquired`

2. **EzDent-i X-Ray System** (if you have it):
   - Exe Path: `C:\EzDent-i\EzDent-i.exe`
   - Export Folder: `C:\EzDent-i\temp`

3. **API Connection** (REQUIRED):
   - API Base URL: `https://british-pro-care.vercel.app`
   - Bridge API Key: [Get from your Vercel environment variables]

4. **Session Settings**:
   - Timeout: 60 minutes (default)
   - Warning: 50 minutes (default)

5. **Click "Save Configuration"**

---

## 📸 Optional: Add Your Logo

To display your clinic logo in the application:

1. Save your logo as `logo.png` (150x150px recommended)
2. Place it in: `C:\Users\Skappop\procare-clinic\Dental Agent`
3. Restart the application

**Without logo:** Shows a stylized "B" text logo as fallback

---

## 🎯 Daily Workflow

### Morning (Receptionist):
1. Open web app and navigate to first patient
2. Launch Dental Agent on clinic computer
3. Verify patient name appears automatically

### During Appointment (Assistant):
1. Patient name shows in green at the top
2. Click "Launch One2" or "Launch EzDent-i" (or both)
3. Take photos/X-rays during appointment
4. Click "End Session" when finished
5. Images upload automatically

### Between Patients:
- Receptionist opens next patient page in web app
- Dental Agent automatically updates to new patient
- No manual data entry needed!

---

## 🧪 Test the Application

Run the automated test:
```bash
cd "C:\Users\Skappop\procare-clinic\Dental Agent"
python test_agent.py
```

Expected output:
```
✅ ALL TESTS PASSED - Application is ready to use!
```

---

## 🐛 The Fix That Was Applied

**Problem:** Application crashed on startup with:
- `_tkinter.TclError: invalid color name "#F7F5F199"`

**Cause:** Tkinter doesn't support hex colors with alpha transparency (the `99` suffix)

**Solution:** Replaced color+alpha with solid sage color (`#A9BCB0`) for muted text

---

## 📚 Full Documentation

- **Doctor Guide:** [`DOCTOR_WORKFLOW.md`](DOCTOR_WORKFLOW.md)
- **Assistant Guide:** [`ASSISTANT_WORKFLOW.md`](ASSISTANT_WORKFLOW.md)
- **Receptionist Guide:** [`RECEPTIONIST_WORKFLOW.md`](RECEPTIONIST_WORKFLOW.md)
- **Technical Details:** [`README.md`](README.md)
- **Complete Overview:** [`REDESIGN_SUMMARY.md`](REDESIGN_SUMMARY.md)

---

## ✨ Design Features

**Brand Colors:**
- Marquina (#17181A) - Dark headers
- Gold (#B8935E) - Primary buttons
- Teal (#4EC5C1) - Secondary actions
- Marble (#F7F5F1) - Light backgrounds
- Sage (#A9BCB0) - Muted text

**Typography:**
- Marcellus - Display headings
- Manrope - Body text

**Animations:**
- Logo bloom effect
- Gold glow pulse
- Loading dots

---

## 🆘 Troubleshooting

### Application won't start:
```bash
# Check Python version (need 3.11+)
python --version

# Reinstall dependencies
pip install -r requirements.txt
```

### Missing dependencies error:
```bash
pip install requests Pillow
```

### Settings not saving:
- Check that `config.json` file has write permissions
- Run application as Administrator

---

## ✅ You're Ready!

The British ProCare Dental Agent is now **fully functional** with your clinic's professional branding. 

**Next steps:**
1. Configure settings (API key, software paths)
2. Test with one patient
3. Train your team using the workflow guides

---

*British ProCare Dental Clinics - Professional Image Management* 🦷✨
