import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import json
import os
import time
import subprocess
import requests
import threading
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime
import re


class CleanDentalAgent:
    """
    British ProCare Dental Agent - Clean & Minimal Design
    """

    def __init__(self, root):
        self.root = root
        self.root.title("British ProCare - Dental Agent")

        # Window size and position
        window_width = 700
        window_height = 550
        screen_width = root.winfo_screenwidth()
        screen_height = root.winfo_screenheight()
        x = (screen_width - window_width) // 2
        y = (screen_height - window_height) // 2
        self.root.geometry(f"{window_width}x{window_height}+{x}+{y}")

        # Clean white background
        self.root.configure(bg='#FFFFFF')

        # Get script directory for config
        self.script_dir = Path(__file__).parent
        self.config_path = self.script_dir / "config.json"

        # Session state
        self.session_active = False
        self.session_start_time: Optional[float] = None
        self.one2_process: Optional[subprocess.Popen] = None
        self.ezdent_process: Optional[subprocess.Popen] = None
        self.one2_running = False
        self.ezdent_running = False

        # Active patient tracking
        self.active_patient_id: Optional[str] = None
        self.active_patient_name: Optional[str] = None
        self.manual_mode = False

        # Polling thread
        self.stop_polling = False
        self.polling_thread: Optional[threading.Thread] = None

        # Session timer
        self.session_elapsed = 0
        self.session_timer_id: Optional[str] = None

        # Configuration storage
        self.config: Dict[str, str] = {
            "one2_exe": "",
            "one2_export": "",
            "ezdent_exe": "",
            "ezdent_export": "",
            "api_base_url": "https://british-pro-care.vercel.app",
            "bridge_api_key": "",
            "session_timeout_minutes": "60",
            "session_warning_minutes": "50"
        }

        # Load config
        self._load_config()

        # Setup UI
        self._setup_ui()

        # Start polling thread
        self._start_polling_thread()

    def _setup_ui(self):
        """Setup clean minimal UI"""
        # Simple header
        header = tk.Frame(self.root, bg='#F8F9FA', height=60)
        header.pack(fill='x', side='top')
        header.pack_propagate(False)

        title = tk.Label(
            header,
            text="British ProCare - Dental Agent",
            font=("Segoe UI", 14, "bold"),
            fg='#212529',
            bg='#F8F9FA'
        )
        title.pack(side='left', padx=20, pady=18)

        # Tabs
        self._create_tabs()

    def _create_tabs(self):
        """Create clean tab system"""
        # Standard ttk notebook
        style = ttk.Style()
        style.configure('TNotebook', background='#FFFFFF')
        style.configure('TNotebook.Tab', padding=[20, 10])

        notebook = ttk.Notebook(self.root)
        notebook.pack(fill='both', expand=True, padx=10, pady=10)

        # Session tab (first)
        session_frame = tk.Frame(notebook, bg='#FFFFFF')
        notebook.add(session_frame, text='Session')
        self._create_session_tab(session_frame)

        # Settings tab (last)
        settings_frame = tk.Frame(notebook, bg='#FFFFFF')
        notebook.add(settings_frame, text='Settings')
        self._create_settings_tab(settings_frame)

    def _create_session_tab(self, parent):
        """Create session management tab"""
        # Patient info section
        patient_section = tk.Frame(parent, bg='#FFFFFF')
        patient_section.pack(fill='x', padx=20, pady=20)

        tk.Label(
            patient_section,
            text="Active Patient",
            font=("Segoe UI", 11, "bold"),
            fg='#212529',
            bg='#FFFFFF'
        ).pack(anchor='w')

        self.patient_label = tk.Label(
            patient_section,
            text="No patient selected",
            font=("Segoe UI", 10),
            fg='#6C757D',
            bg='#FFFFFF'
        )
        self.patient_label.pack(anchor='w', pady=(5, 0))

        # Session controls
        controls_section = tk.Frame(parent, bg='#FFFFFF')
        controls_section.pack(fill='x', padx=20, pady=10)

        tk.Label(
            controls_section,
            text="Session Controls",
            font=("Segoe UI", 11, "bold"),
            fg='#212529',
            bg='#FFFFFF'
        ).pack(anchor='w', pady=(0, 10))

        # Button frame
        button_frame = tk.Frame(controls_section, bg='#FFFFFF')
        button_frame.pack(fill='x')

        # Start session button
        self.start_btn = tk.Button(
            button_frame,
            text="Start Session",
            command=self._start_session,
            font=("Segoe UI", 10),
            bg='#0D6EFD',
            fg='#FFFFFF',
            relief='flat',
            cursor='hand2',
            padx=20,
            pady=10
        )
        self.start_btn.pack(side='left', padx=(0, 10))

        # End session button
        self.end_btn = tk.Button(
            button_frame,
            text="End Session",
            command=self._end_session,
            font=("Segoe UI", 10),
            bg='#6C757D',
            fg='#FFFFFF',
            relief='flat',
            cursor='hand2',
            padx=20,
            pady=10,
            state='disabled'
        )
        self.end_btn.pack(side='left')

        # Software launch section
        software_section = tk.Frame(parent, bg='#FFFFFF')
        software_section.pack(fill='x', padx=20, pady=20)

        tk.Label(
            software_section,
            text="Imaging Software",
            font=("Segoe UI", 11, "bold"),
            fg='#212529',
            bg='#FFFFFF'
        ).pack(anchor='w', pady=(0, 10))

        software_buttons = tk.Frame(software_section, bg='#FFFFFF')
        software_buttons.pack(fill='x')

        self.one2_btn = tk.Button(
            software_buttons,
            text="Launch One2",
            command=self._launch_one2,
            font=("Segoe UI", 10),
            bg='#F8F9FA',
            fg='#212529',
            relief='flat',
            cursor='hand2',
            padx=20,
            pady=10,
            state='disabled'
        )
        self.one2_btn.pack(side='left', padx=(0, 10))

        self.ezdent_btn = tk.Button(
            software_buttons,
            text="Launch EzDent-i",
            command=self._launch_ezdent,
            font=("Segoe UI", 10),
            bg='#F8F9FA',
            fg='#212529',
            relief='flat',
            cursor='hand2',
            padx=20,
            pady=10,
            state='disabled'
        )
        self.ezdent_btn.pack(side='left')

        # Session info
        info_section = tk.Frame(parent, bg='#FFFFFF')
        info_section.pack(fill='both', expand=True, padx=20, pady=20)

        self.session_info = tk.Text(
            info_section,
            font=("Segoe UI", 9),
            bg='#F8F9FA',
            fg='#212529',
            relief='flat',
            padx=15,
            pady=15,
            height=10,
            state='disabled'
        )
        self.session_info.pack(fill='both', expand=True)

    def _create_settings_tab(self, parent):
        """Create settings configuration tab"""
        # Scrollable canvas
        canvas = tk.Canvas(parent, bg='#FFFFFF', highlightthickness=0)
        scrollbar = ttk.Scrollbar(parent, orient='vertical', command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg='#FFFFFF')

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor='nw')
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')

        # Settings fields
        self.settings_vars = {}

        settings_list = [
            ("One2 Intraoral Camera", [
                ("one2_exe", "Executable Path", "Browse for One2 executable (oov.exe)"),
                ("one2_export", "Export Folder", "Browse for One2 export folder"),
            ]),
            ("EzDent-i X-Ray System", [
                ("ezdent_exe", "Executable Path", "Browse for EzDent-i executable"),
                ("ezdent_export", "Export Folder", "Browse for EzDent-i export folder"),
            ]),
            ("API Configuration", [
                ("api_base_url", "API Base URL", "Your clinic's API endpoint"),
                ("bridge_api_key", "Bridge API Key", "Authentication key for uploads"),
            ]),
            ("Session Settings", [
                ("session_timeout_minutes", "Timeout (minutes)", "Auto-end session after this time"),
                ("session_warning_minutes", "Warning (minutes)", "Show warning before timeout"),
            ]),
        ]

        for section_title, fields in settings_list:
            section = tk.Frame(scrollable_frame, bg='#FFFFFF')
            section.pack(fill='x', padx=20, pady=(20, 10))

            tk.Label(
                section,
                text=section_title,
                font=("Segoe UI", 11, "bold"),
                fg='#212529',
                bg='#FFFFFF'
            ).pack(anchor='w', pady=(0, 10))

            for key, label, hint in fields:
                field_frame = tk.Frame(section, bg='#FFFFFF')
                field_frame.pack(fill='x', pady=5)

                tk.Label(
                    field_frame,
                    text=label,
                    font=("Segoe UI", 9),
                    fg='#495057',
                    bg='#FFFFFF'
                ).pack(anchor='w')

                var = tk.StringVar(value=self.config.get(key, ""))
                self.settings_vars[key] = var

                entry = tk.Entry(
                    field_frame,
                    textvariable=var,
                    font=("Segoe UI", 9),
                    bg='#FFFFFF',
                    fg='#212529',
                    relief='solid',
                    bd=1
                )
                entry.pack(fill='x', pady=(2, 0))

        # Save button
        save_frame = tk.Frame(scrollable_frame, bg='#FFFFFF')
        save_frame.pack(fill='x', padx=20, pady=20)

        tk.Button(
            save_frame,
            text="Save Configuration",
            command=self._save_config,
            font=("Segoe UI", 10),
            bg='#0D6EFD',
            fg='#FFFFFF',
            relief='flat',
            cursor='hand2',
            padx=30,
            pady=10
        ).pack(anchor='w')

    # Core functionality methods (unchanged from v2)
    def _load_config(self):
        """Load configuration from JSON file"""
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r') as f:
                    loaded = json.load(f)
                    self.config.update(loaded)
            except Exception as e:
                messagebox.showerror("Configuration Error", f"Failed to load configuration: {str(e)}")

    def _save_config(self):
        """Save configuration to JSON file"""
        try:
            for key, var in self.settings_vars.items():
                self.config[key] = var.get()

            with open(self.config_path, 'w') as f:
                json.dump(self.config, f, indent=2)

            messagebox.showinfo("Success", "Configuration saved successfully")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save configuration: {str(e)}")

    def _start_polling_thread(self):
        """Start background polling for active patient"""
        self.polling_thread = threading.Thread(target=self._poll_active_patient, daemon=True)
        self.polling_thread.start()

    def _poll_active_patient(self):
        """Poll API for active patient (runs in background thread)"""
        while not self.stop_polling:
            if not self.manual_mode and self.config.get("bridge_api_key"):
                try:
                    response = requests.get(
                        f"{self.config.get('api_base_url')}/api/bridge/active-patient",
                        headers={"Authorization": f"Bearer {self.config.get('bridge_api_key')}"},
                        timeout=5
                    )
                    if response.status_code == 200:
                        data = response.json()
                        patient_id = data.get('patient_id')
                        patient_name = data.get('patient_name', 'Unknown')

                        if patient_id:
                            self.root.after(0, self._update_active_patient, patient_id, patient_name)
                        else:
                            self.root.after(0, self._clear_active_patient)
                    elif response.status_code == 404:
                        self.root.after(0, self._clear_active_patient)
                except Exception:
                    pass
            time.sleep(2)

    def _update_active_patient(self, patient_id: str, patient_name: str):
        """Update active patient in UI (main thread)"""
        if self.active_patient_id != patient_id:
            if self.session_active:
                if messagebox.askyesno(
                    "Patient Changed",
                    f"Active patient changed to: {patient_name}\n\nEnd current session?"
                ):
                    self._end_session()
                else:
                    return

            self.active_patient_id = patient_id
            self.active_patient_name = patient_name
            self.patient_label.config(
                text=f"{patient_name} (ID: {patient_id})",
                fg='#198754'
            )

    def _clear_active_patient(self):
        """Clear active patient"""
        if not self.manual_mode:
            self.active_patient_id = None
            self.active_patient_name = None
            self.patient_label.config(
                text="No patient selected",
                fg='#6C757D'
            )

    def _start_session(self):
        """Start imaging session"""
        if not self.active_patient_id:
            messagebox.showwarning("No Patient", "Please wait for active patient or enable manual mode")
            return

        self.session_active = True
        self.session_start_time = time.time()
        self.session_elapsed = 0

        self.start_btn.config(state='disabled')
        self.end_btn.config(state='normal', bg='#DC3545')
        self.one2_btn.config(state='normal')
        self.ezdent_btn.config(state='normal')

        self._log_session_info(f"Session started for {self.active_patient_name}")
        self._start_session_timer()

    def _end_session(self):
        """End session and upload images"""
        if not self.session_active:
            return

        self._stop_session_timer()

        # Close software
        if self.one2_running:
            self._close_one2()
        if self.ezdent_running:
            self._close_ezdent()

        # Upload images
        self._upload_session_images()

        self.session_active = False
        self.start_btn.config(state='normal')
        self.end_btn.config(state='disabled', bg='#6C757D')
        self.one2_btn.config(state='disabled')
        self.ezdent_btn.config(state='disabled')

        self._log_session_info("Session ended")

    def _launch_one2(self):
        """Launch One2 software"""
        one2_exe = self.config.get("one2_exe")
        if not one2_exe or not Path(one2_exe).exists():
            messagebox.showerror("Error", "One2 executable not configured or not found")
            return

        try:
            self.one2_process = subprocess.Popen([one2_exe])
            self.one2_running = True
            self.one2_btn.config(text="One2 Running", bg='#198754', fg='#FFFFFF')
            self._log_session_info("One2 launched")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to launch One2: {str(e)}")

    def _launch_ezdent(self):
        """Launch EzDent-i software"""
        ezdent_exe = self.config.get("ezdent_exe")
        if not ezdent_exe or not Path(ezdent_exe).exists():
            messagebox.showerror("Error", "EzDent-i executable not configured or not found")
            return

        try:
            self.ezdent_process = subprocess.Popen([ezdent_exe])
            self.ezdent_running = True
            self.ezdent_btn.config(text="EzDent-i Running", bg='#198754', fg='#FFFFFF')
            self._log_session_info("EzDent-i launched")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to launch EzDent-i: {str(e)}")

    def _close_one2(self):
        """Close One2 software"""
        if self.one2_process:
            try:
                self.one2_process.terminate()
            except:
                pass
        self.one2_running = False
        self.one2_btn.config(text="Launch One2", bg='#F8F9FA', fg='#212529')

    def _close_ezdent(self):
        """Close EzDent-i software"""
        if self.ezdent_process:
            try:
                self.ezdent_process.terminate()
            except:
                pass
        self.ezdent_running = False
        self.ezdent_btn.config(text="Launch EzDent-i", bg='#F8F9FA', fg='#212529')

    def _start_session_timer(self):
        """Start session timer"""
        def update_timer():
            if self.session_active:
                self.session_elapsed = int(time.time() - self.session_start_time)
                minutes = self.session_elapsed // 60
                seconds = self.session_elapsed % 60

                timeout = int(self.config.get("session_timeout_minutes", 60))
                if minutes >= timeout:
                    messagebox.showwarning("Session Timeout", f"Session has reached {timeout} minutes. Ending session.")
                    self._end_session()
                    return

                self.session_timer_id = self.root.after(1000, update_timer)

        update_timer()

    def _stop_session_timer(self):
        """Stop session timer"""
        if self.session_timer_id:
            self.root.after_cancel(self.session_timer_id)
            self.session_timer_id = None

    def _log_session_info(self, message: str):
        """Log message to session info"""
        self.session_info.config(state='normal')
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.session_info.insert('end', f"[{timestamp}] {message}\n")
        self.session_info.see('end')
        self.session_info.config(state='disabled')

    def _upload_session_images(self):
        """Upload images from session"""
        self._log_session_info("Collecting images for upload...")

        collected_files = []

        # Collect One2 files
        if self.one2_running:
            one2_export = self.config.get("one2_export")
            if one2_export:
                collected_files.extend(self._collect_files_from_folder(one2_export, ['.jpg', '.jpeg', '.png']))

        # Collect EzDent-i files
        if self.ezdent_running:
            ezdent_export = self.config.get("ezdent_export")
            if ezdent_export:
                ezdent_files = self._collect_files_from_folder(ezdent_export, ['.jpg', '.jpeg', '.dcm'])
                collected_files.extend(self._deduplicate_xrays(ezdent_files))

        if not collected_files:
            self._log_session_info("No images found to upload")
            return

        # Upload files
        try:
            self._upload_files_to_api(collected_files)
            self._log_session_info(f"Successfully uploaded {len(collected_files)} images")
        except Exception as e:
            self._log_session_info(f"Upload failed: {str(e)}")
            messagebox.showerror("Upload Error", f"Failed to upload images: {str(e)}")

    def _collect_files_from_folder(self, folder: str, extensions: List[str]) -> List[Path]:
        """Collect files with given extensions from folder"""
        folder_path = Path(folder)
        if not folder_path.exists():
            return []

        collected = []
        for ext in extensions:
            collected.extend(folder_path.glob(f"*{ext}"))
        return collected

    def _deduplicate_xrays(self, files: List[Path]) -> List[Path]:
        """Deduplicate EzDent-i X-rays (keeps best file per timestamp)"""
        # Group by timestamp pattern
        groups = {}
        for file in files:
            match = re.search(r'(\d{8}_\d{6})', file.name)
            if match:
                timestamp = match.group(1)
                if timestamp not in groups:
                    groups[timestamp] = []
                groups[timestamp].append(file)

        # Select best file from each group
        deduplicated = []
        for timestamp, group in groups.items():
            # Filter out Thumbnail and Tag files
            filtered = [f for f in group if 'Thumbnail' not in f.name and 'Tag' not in f.name]
            if not filtered:
                continue

            # Priority: .dcm > .jpg > Original > Rotated
            best = None
            for file in filtered:
                if file.suffix.lower() == '.dcm':
                    best = file
                    break
                elif file.suffix.lower() in ['.jpg', '.jpeg']:
                    if not best or 'Original' in file.name:
                        best = file

            if best:
                deduplicated.append(best)

        return deduplicated

    def _upload_files_to_api(self, files: List[Path]):
        """Upload files to API"""
        api_url = f"{self.config.get('api_base_url')}/api/bridge/upload"
        api_key = self.config.get('bridge_api_key')

        if not api_key:
            raise Exception("Bridge API key not configured")

        form_data = {
            'patient_id': self.active_patient_id,
            'metadata': json.dumps({
                'source': 'dental-agent',
                'session_duration': self.session_elapsed,
            })
        }

        files_data = []
        for i, file_path in enumerate(files):
            files_data.append((f'file_{i}', (file_path.name, open(file_path, 'rb'), 'application/octet-stream')))

        response = requests.post(
            api_url,
            data=form_data,
            files=files_data,
            headers={'Authorization': f'Bearer {api_key}'},
            timeout=30
        )

        # Close file handles
        for _, file_tuple in files_data:
            file_tuple[1].close()

        if response.status_code != 200:
            raise Exception(f"API returned status {response.status_code}: {response.text}")


def main():
    root = tk.Tk()
    app = CleanDentalAgent(root)
    root.protocol("WM_DELETE_WINDOW", lambda: (setattr(app, 'stop_polling', True), root.destroy()))
    root.mainloop()


if __name__ == "__main__":
    main()
