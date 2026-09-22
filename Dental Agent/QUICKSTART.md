# Quick Start Guide - Dental Clinic Image Agent

## For First-Time Setup on Clinic Computer

### Step 1: Install Python Dependencies

Open Command Prompt or PowerShell and run:

```bash
pip install -r requirements.txt
```

Or install individually:

```bash
pip install requests flask werkzeug
```

---

## Testing the System

### Terminal 1: Start the Mock Server

```bash
python mock_server.py
```

You should see:
```
============================================================
  Dental Clinic Mock Server
============================================================
  Running on: http://localhost:5000
  Upload endpoint: POST /api/upload
  Storage location: mock_db
============================================================
```

Keep this terminal open.

---

### Terminal 2: Run the Agent

```bash
python dental_agent.py
```

---

## Configuration Workflow

1. **Settings Tab**
   - Click "Browse" for each field
   - Select the executable files (`.exe`) for One2 and EzDent-i
   - Select the folders where these programs export images
   - Click "Save Configuration"

2. **Session Tab**
   - Enter a test Patient ID (e.g., `TEST001`)
   - Click "Start Session" - this will launch both imaging applications
   - The applications will open (or show an error if paths are incorrect)
   - Take some test images using the imaging software
   - Click "End Session" - this will:
     - Scan for new files
     - Upload them to the mock server
     - Terminate both applications

3. **Check Results**
   - Look in the `mock_db` folder
   - You should see a new folder named `TEST001_[timestamp]`
   - All images captured during the session will be inside

---

## Testing Without Real Imaging Software

If you don't have One2 or EzDent-i installed yet, you can test the file monitoring system:

1. Create two test folders on your desktop:
   - `C:\Users\YourName\Desktop\test_one2_export`
   - `C:\Users\YourName\Desktop\test_ezdent_export`

2. Point a test executable (any `.exe` will work for testing, even `notepad.exe`)

3. Configure the agent with these test paths

4. Start a session

5. Manually copy some image files (`.jpg`, `.png`) into the export folders

6. End the session - the files you just copied should be uploaded

---

## Common Issues

### "Could not connect to the clinic server"
- Make sure `mock_server.py` is running in a separate terminal
- Check that port 5000 is not blocked by firewall

### "Executable not found"
- Verify the path to the `.exe` file is correct
- Try browsing to the file again in Settings

### "No new images were found during this session"
- Make sure images were actually saved to the export folders
- Check that the export folder paths are correct
- Verify the imaging software exported files after session start

### Applications don't close after "End Session"
- The agent attempts graceful termination first, then forced kill
- If processes persist, check Task Manager and end them manually

---

## Production Deployment

Once tested with the mock server:

1. Update the upload URL in `dental_agent.py` (line ~236):
   ```python
   response = requests.post(
       "https://your-actual-clinic-system.com/api/upload",
       files=form_data,
       timeout=30
   )
   ```

2. Copy the entire folder to your USB drive

3. Run from USB - the `config.json` will be saved on the USB drive

4. No need to run `mock_server.py` in production
