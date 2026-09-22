import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import json
import mimetypes
import os
import socket
import time
import subprocess
import requests
import re
import threading
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime, timedelta


# The web app's "Open in Dental Agent" button links to procare://patient/<uuid>.
# Windows hands that whole URL to this script as a command-line argument.
PROTOCOL_PORT = 47281
PATIENT_URL_RE = re.compile(r"patient/([0-9a-fA-F-]{36})")


def patient_id_from_argv(argv) -> Optional[str]:
    """The patient uuid out of a procare:// argument, if there is one."""
    for arg in argv[1:]:
        if arg.lower().startswith("procare:"):
            match = PATIENT_URL_RE.search(arg)
            if match:
                return match.group(1)
    return None


def claim_single_instance(payload: Optional[str]):
    """
    First instance gets a listening socket back. If one is already running,
    the payload is handed to it and None is returned so this process can exit
    instead of opening a second window.

    If the port is held by something that is not us, we start normally rather
    than refusing to run.
    """
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        server.bind(("127.0.0.1", PROTOCOL_PORT))
        server.listen(5)
        return server, False
    except OSError:
        server.close()

    try:
        with socket.create_connection(("127.0.0.1", PROTOCOL_PORT), timeout=3) as client:
            client.sendall((payload or "focus").encode("utf-8"))
        return None, True
    except OSError:
        return None, False


class DentalAgentApp:
    def __init__(self, root, instance_socket=None, initial_patient_id: Optional[str] = None):
        self.root = root
        self.instance_socket = instance_socket
        self.root.title("Dental Agent - ProCare Clinic")
        self.root.geometry("750x650")

        # Get script directory for config file
        self.script_dir = Path(__file__).parent
        self.config_path = self.script_dir / "config.json"

        # Session tracking
        self.session_active = False
        self.session_start_time: Optional[float] = None
        self.close_after_upload = False
        self.one2_process: Optional[subprocess.Popen] = None
        self.ezdent_process: Optional[subprocess.Popen] = None
        self.one2_running = False
        self.ezdent_running = False

        # Active patient polling
        self.active_patient_id: Optional[str] = None
        self.active_patient_name: Optional[str] = None
        self.manual_mode = False
        self.polling_thread: Optional[threading.Thread] = None
        self.stop_polling = False

        # Session timeout tracking
        self.session_timer_id = None
        self.session_elapsed = 0

        # Configuration storage
        self.config: Dict[str, str] = {
            "one2_exe": "",
            "one2_export": "",
            "ezdent_exe": "",
            "ezdent_export": "",
            "api_base_url": "http://localhost:3000",
            "bridge_api_key": "",
            "session_timeout_minutes": "60",
            "session_warning_minutes": "50"
        }

        self._setup_ui()
        self._load_config()
        self._start_active_patient_polling()

        # Opened from the web app's button: show that patient straight away
        # rather than waiting up to two seconds for the next poll.
        if initial_patient_id:
            self.patient_id_var.set(initial_patient_id)

        if self.instance_socket:
            self._start_protocol_listener()

    def _setup_ui(self):
        # Create notebook for tabs
        notebook = ttk.Notebook(self.root)
        notebook.pack(fill="both", expand=True, padx=10, pady=10)

        # Settings tab
        settings_frame = ttk.Frame(notebook, padding=20)
        notebook.add(settings_frame, text="Settings")
        self._setup_settings_tab(settings_frame)

        # Session tab
        session_frame = ttk.Frame(notebook, padding=20)
        notebook.add(session_frame, text="Session")
        self._setup_session_tab(session_frame)

    def _setup_settings_tab(self, parent):
        # Create scrollable canvas
        canvas = tk.Canvas(parent, highlightthickness=0)
        scrollbar = ttk.Scrollbar(parent, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        row = 0

        # API Configuration
        ttk.Label(scrollable_frame, text="Clinic API Configuration", font=("Segoe UI", 11, "bold")).grid(
            row=row, column=0, sticky="w", pady=(0, 10), columnspan=2
        )
        row += 1

        ttk.Label(scrollable_frame, text="API Base URL:", font=("Segoe UI", 10)).grid(
            row=row, column=0, sticky="w", pady=(0, 5)
        )
        row += 1
        self.api_url_var = tk.StringVar()
        ttk.Entry(scrollable_frame, textvariable=self.api_url_var, width=50).grid(
            row=row, column=0, padx=(0, 10), columnspan=2, sticky="we"
        )
        row += 1

        ttk.Label(scrollable_frame, text="Bridge API Key:", font=("Segoe UI", 10)).grid(
            row=row, column=0, sticky="w", pady=(15, 5)
        )
        row += 1
        self.api_key_var = tk.StringVar()
        ttk.Entry(scrollable_frame, textvariable=self.api_key_var, width=50, show="*").grid(
            row=row, column=0, padx=(0, 10), columnspan=2, sticky="we"
        )
        row += 1

        # Divider
        ttk.Separator(scrollable_frame, orient="horizontal").grid(
            row=row, column=0, columnspan=2, sticky="we", pady=20
        )
        row += 1

        # One2 Configuration
        ttk.Label(scrollable_frame, text="One2 Intraoral Camera", font=("Segoe UI", 11, "bold")).grid(
            row=row, column=0, sticky="w", pady=(0, 10), columnspan=2
        )
        row += 1

        ttk.Label(scrollable_frame, text="One2 Executable:", font=("Segoe UI", 10)).grid(
            row=row, column=0, sticky="w", pady=(0, 5)
        )
        row += 1
        self.one2_exe_var = tk.StringVar()
        ttk.Entry(scrollable_frame, textvariable=self.one2_exe_var, width=50).grid(
            row=row, column=0, padx=(0, 10)
        )
        ttk.Button(scrollable_frame, text="Browse", command=lambda: self._browse_file(self.one2_exe_var)).grid(
            row=row, column=1
        )
        row += 1

        ttk.Label(scrollable_frame, text="One2 Image Export Folder:", font=("Segoe UI", 10)).grid(
            row=row, column=0, sticky="w", pady=(15, 5)
        )
        row += 1
        self.one2_export_var = tk.StringVar()
        ttk.Entry(scrollable_frame, textvariable=self.one2_export_var, width=50).grid(
            row=row, column=0, padx=(0, 10)
        )
        ttk.Button(scrollable_frame, text="Browse", command=lambda: self._browse_dir(self.one2_export_var)).grid(
            row=row, column=1
        )
        row += 1

        # Divider
        ttk.Separator(scrollable_frame, orient="horizontal").grid(
            row=row, column=0, columnspan=2, sticky="we", pady=20
        )
        row += 1

        # EzDent-i Configuration
        ttk.Label(scrollable_frame, text="EzDent-i X-ray (Optional)", font=("Segoe UI", 11, "bold")).grid(
            row=row, column=0, sticky="w", pady=(0, 10), columnspan=2
        )
        row += 1

        ttk.Label(scrollable_frame, text="EzDent-i Executable:", font=("Segoe UI", 10)).grid(
            row=row, column=0, sticky="w", pady=(0, 5)
        )
        row += 1
        self.ezdent_exe_var = tk.StringVar()
        ttk.Entry(scrollable_frame, textvariable=self.ezdent_exe_var, width=50).grid(
            row=row, column=0, padx=(0, 10)
        )
        ttk.Button(scrollable_frame, text="Browse", command=lambda: self._browse_file(self.ezdent_exe_var)).grid(
            row=row, column=1
        )
        row += 1

        ttk.Label(scrollable_frame, text="EzDent-i Image Export Folder:", font=("Segoe UI", 10)).grid(
            row=row, column=0, sticky="w", pady=(15, 5)
        )
        row += 1
        self.ezdent_export_var = tk.StringVar()
        ttk.Entry(scrollable_frame, textvariable=self.ezdent_export_var, width=50).grid(
            row=row, column=0, padx=(0, 10)
        )
        ttk.Button(scrollable_frame, text="Browse", command=lambda: self._browse_dir(self.ezdent_export_var)).grid(
            row=row, column=1
        )
        row += 1

        # Divider
        ttk.Separator(scrollable_frame, orient="horizontal").grid(
            row=row, column=0, columnspan=2, sticky="we", pady=20
        )
        row += 1

        # Session Timeout Configuration
        ttk.Label(scrollable_frame, text="Session Timeout", font=("Segoe UI", 11, "bold")).grid(
            row=row, column=0, sticky="w", pady=(0, 10), columnspan=2
        )
        row += 1

        ttk.Label(scrollable_frame, text="Auto-end session after (minutes, 0 = disabled):", font=("Segoe UI", 10)).grid(
            row=row, column=0, sticky="w", pady=(0, 5)
        )
        row += 1
        self.timeout_var = tk.StringVar()
        ttk.Entry(scrollable_frame, textvariable=self.timeout_var, width=10).grid(
            row=row, column=0, sticky="w", padx=(0, 10)
        )
        row += 1

        ttk.Label(scrollable_frame, text="Warning before timeout (minutes):", font=("Segoe UI", 10)).grid(
            row=row, column=0, sticky="w", pady=(15, 5)
        )
        row += 1
        self.warning_var = tk.StringVar()
        ttk.Entry(scrollable_frame, textvariable=self.warning_var, width=10).grid(
            row=row, column=0, sticky="w", padx=(0, 10)
        )
        row += 1

        # Save button
        ttk.Button(
            scrollable_frame,
            text="Save Configuration",
            command=self._save_config
        ).grid(row=row, column=0, columnspan=2, pady=(30, 0))

    def _setup_session_tab(self, parent):
        # Active patient indicator
        self.active_patient_frame = ttk.Frame(parent)
        self.active_patient_frame.pack(fill="x", pady=(0, 15))

        self.active_patient_indicator = ttk.Label(
            self.active_patient_frame,
            text="⭕ No active patient",
            font=("Segoe UI", 11),
            foreground="#999"
        )
        self.active_patient_indicator.pack(anchor="w")

        # Patient ID input
        patient_id_frame = ttk.Frame(parent)
        patient_id_frame.pack(fill="x", pady=(0, 10))

        ttk.Label(patient_id_frame, text="Patient ID:", font=("Segoe UI", 10, "bold")).pack(
            anchor="w", pady=(0, 5)
        )
        self.patient_id_var = tk.StringVar()
        self.patient_id_entry = ttk.Entry(
            patient_id_frame,
            textvariable=self.patient_id_var,
            font=("Segoe UI", 10),
            width=50,
            state="readonly"  # Locked by default (auto-fill mode)
        )
        self.patient_id_entry.pack(side="left", padx=(0, 10))

        self.manual_override_btn = ttk.Button(
            patient_id_frame,
            text="🔓 Manual Override",
            command=self._toggle_manual_mode,
            width=18
        )
        self.manual_override_btn.pack(side="left")

        # Status display with timer
        self.status_label = ttk.Label(
            parent,
            text="Ready",
            font=("Segoe UI", 10),
            foreground="#666"
        )
        self.status_label.pack(anchor="w", pady=(10, 10))

        # Software launch section
        launch_frame = ttk.LabelFrame(parent, text="Launch Software", padding=15)
        launch_frame.pack(fill="x", pady=(10, 10))

        # One2 button
        one2_frame = ttk.Frame(launch_frame)
        one2_frame.pack(side="left", padx=(0, 10))

        self.launch_one2_btn = ttk.Button(
            one2_frame,
            text="📷 Launch One2\n(Intraoral Camera)",
            command=self._launch_one2,
            width=20
        )
        self.launch_one2_btn.pack()
        self.one2_status_label = ttk.Label(one2_frame, text="", font=("Segoe UI", 8))
        self.one2_status_label.pack(pady=(5, 0))

        # EzDent-i button
        ezdent_frame = ttk.Frame(launch_frame)
        ezdent_frame.pack(side="left", padx=(0, 10))

        self.launch_ezdent_btn = ttk.Button(
            ezdent_frame,
            text="🦷 Launch EzDent-i\n(X-ray / CBCT)",
            command=self._launch_ezdent,
            width=20
        )
        self.launch_ezdent_btn.pack()
        self.ezdent_status_label = ttk.Label(ezdent_frame, text="", font=("Segoe UI", 8))
        self.ezdent_status_label.pack(pady=(5, 0))

        # Launch both button
        self.launch_both_btn = ttk.Button(
            launch_frame,
            text="🚀 Launch Both",
            command=self._launch_both,
            width=15
        )
        self.launch_both_btn.pack(side="left")

        # End session button
        self.end_btn = ttk.Button(
            parent,
            text="End Session & Upload",
            command=self._end_session,
            state="disabled",
            width=30
        )
        self.end_btn.pack(pady=(20, 10))

        # Upload progress (packed only while an upload is running)
        self.upload_progress = ttk.Progressbar(parent, mode="determinate", length=400)
        self.upload_status_label = ttk.Label(
            parent,
            text="",
            font=("Segoe UI", 9),
            foreground="#666"
        )

        # Session info
        self.session_info_label = ttk.Label(
            parent,
            text="",
            font=("Segoe UI", 9),
            foreground="#666"
        )
        self.session_info_label.pack(anchor="w", pady=(5, 0))

    def _browse_file(self, var: tk.StringVar):
        filename = filedialog.askopenfilename(
            title="Select Executable",
            filetypes=[("Executable files", "*.exe"), ("All files", "*.*")]
        )
        if filename:
            var.set(filename)

    def _browse_dir(self, var: tk.StringVar):
        dirname = filedialog.askdirectory(title="Select Export Directory")
        if dirname:
            var.set(dirname)

    def _load_config(self):
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r') as f:
                    self.config = json.load(f)

                self.one2_exe_var.set(self.config.get("one2_exe", ""))
                self.one2_export_var.set(self.config.get("one2_export", ""))
                self.ezdent_exe_var.set(self.config.get("ezdent_exe", ""))
                self.ezdent_export_var.set(self.config.get("ezdent_export", ""))
                self.api_url_var.set(self.config.get("api_base_url", "http://localhost:3000"))
                self.api_key_var.set(self.config.get("bridge_api_key", ""))
                self.timeout_var.set(self.config.get("session_timeout_minutes", "60"))
                self.warning_var.set(self.config.get("session_warning_minutes", "50"))
            except Exception as e:
                messagebox.showerror("Error", f"Failed to load configuration: {e}")

    def _save_config(self):
        self.config = {
            "one2_exe": self.one2_exe_var.get(),
            "one2_export": self.one2_export_var.get(),
            "ezdent_exe": self.ezdent_exe_var.get(),
            "ezdent_export": self.ezdent_export_var.get(),
            "api_base_url": self.api_url_var.get(),
            "bridge_api_key": self.api_key_var.get(),
            "session_timeout_minutes": self.timeout_var.get(),
            "session_warning_minutes": self.warning_var.get()
        }

        try:
            with open(self.config_path, 'w') as f:
                json.dump(self.config, f, indent=2)
            messagebox.showinfo("Success", "Configuration saved successfully")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save configuration: {e}")

    def _start_protocol_listener(self):
        """Watch for another launch of this app handing us a patient."""
        thread = threading.Thread(target=self._listen_for_launches, daemon=True)
        thread.start()

    def _listen_for_launches(self):
        """
        Off the main thread. A second launch (the doctor clicking the button
        again) connects here instead of opening another window.
        """
        while not self.stop_polling:
            try:
                connection, _ = self.instance_socket.accept()
            except OSError:
                return  # Socket closed on shutdown.

            try:
                with connection:
                    payload = connection.recv(512).decode("utf-8", "replace")
            except OSError:
                continue

            match = PATIENT_URL_RE.search(payload or "")
            self.root.after(0, self._handle_launch, match.group(1) if match else None)

    def _handle_launch(self, patient_id: Optional[str]):
        """Bring this window to the doctor rather than opening a second one."""
        if patient_id:
            self.patient_id_var.set(patient_id)

        try:
            self.root.deiconify()
            self.root.lift()
            # Windows will not focus a background app on request alone; a brief
            # topmost flip does it without leaving the window pinned.
            self.root.attributes("-topmost", True)
            self.root.after(400, lambda: self.root.attributes("-topmost", False))
            self.root.focus_force()
        except Exception:
            pass

    def _start_active_patient_polling(self):
        """Start background thread to poll for active patient"""
        self.stop_polling = False
        self.polling_thread = threading.Thread(target=self._poll_active_patient, daemon=True)
        self.polling_thread.start()

    def _poll_active_patient(self):
        """Background thread that polls active patient every 2 seconds"""
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
                        patient_id = data.get("patient_id")
                        patient_name = data.get("patient_name")

                        # Update UI on main thread
                        self.root.after(0, self._update_active_patient, patient_id, patient_name)
                except Exception:
                    pass  # Silent fail, keep polling

            time.sleep(2)

    def _update_active_patient(self, patient_id: Optional[str], patient_name: Optional[str]):
        """Update UI with active patient (called from main thread)"""
        # Check if there's a new patient while session is active
        if self.session_active and patient_id and patient_id != self.active_patient_id:
            self._handle_patient_change(patient_id, patient_name)
            return

        self.active_patient_id = patient_id
        self.active_patient_name = patient_name

        if patient_id and patient_name:
            self.active_patient_indicator.config(
                text=f"🟢 Active Patient: {patient_name}",
                foreground="#0A7C3E"
            )
            self.patient_id_var.set(patient_id)
        elif patient_id:
            self.active_patient_indicator.config(
                text=f"🟢 Active Patient: {patient_id}",
                foreground="#0A7C3E"
            )
            self.patient_id_var.set(patient_id)
        else:
            self.active_patient_indicator.config(
                text="⭕ No active patient selected",
                foreground="#999"
            )
            if not self.manual_mode:
                self.patient_id_var.set("")

    def _handle_patient_change(self, new_patient_id: str, new_patient_name: Optional[str]):
        """Handle scenario where active patient changes during session"""
        response = messagebox.askyesnocancel(
            "⚠️ Previous Session Still Active",
            f"You have an open session for: {self.active_patient_name or self.active_patient_id}\n\n"
            f"New active patient detected: {new_patient_name or new_patient_id}\n\n"
            f"What would you like to do?\n\n"
            f"Yes = End current session & upload\n"
            f"No = Discard current session (no upload)\n"
            f"Cancel = Keep current session active"
        )

        if response is True:  # Yes - End and upload
            self._end_session()
            self.active_patient_id = new_patient_id
            self.active_patient_name = new_patient_name
            self._update_active_patient(new_patient_id, new_patient_name)
        elif response is False:  # No - Discard
            self._cleanup_processes()
            self._reset_ui()
            self.active_patient_id = new_patient_id
            self.active_patient_name = new_patient_name
            self._update_active_patient(new_patient_id, new_patient_name)
        # Cancel - Do nothing, keep current session

    def _toggle_manual_mode(self):
        """Toggle between auto-fill and manual entry mode"""
        self.manual_mode = not self.manual_mode

        if self.manual_mode:
            self.patient_id_entry.config(state="normal")
            self.manual_override_btn.config(text="🔒 Lock (Auto-Fill)")
            self.active_patient_indicator.config(
                text="⚠️ Manual Mode - Enter Patient ID manually",
                foreground="#E67E00"
            )
        else:
            self.patient_id_entry.config(state="readonly")
            self.manual_override_btn.config(text="🔓 Manual Override")
            # Restore active patient display
            self._update_active_patient(self.active_patient_id, self.active_patient_name)

    def _validate_config(self) -> bool:
        """Validate basic configuration before starting session"""
        if not self.config["one2_exe"] or not self.config["one2_export"]:
            messagebox.showerror(
                "Configuration Error",
                "Please configure One2 paths in the Settings tab before starting a session"
            )
            return False

        if not Path(self.config["one2_exe"]).exists():
            messagebox.showerror("Error", "One2 executable not found at specified path")
            return False

        if not Path(self.config["one2_export"]).is_dir():
            messagebox.showerror("Error", "One2 export folder not found at specified path")
            return False

        return True

    def _launch_one2(self):
        """Launch One2 software"""
        patient_id = self.patient_id_var.get().strip()
        if not patient_id:
            messagebox.showerror("Error", "No active patient. Please wait for patient selection or use Manual Override")
            return

        if not self._validate_config():
            return

        if self.one2_running:
            messagebox.showinfo("Info", "One2 is already running")
            return

        try:
            # Start session if not already active
            if not self.session_active:
                self.session_start_time = time.time()
                self.session_active = True
                self.patient_id_entry.config(state="disabled")
                self.manual_override_btn.config(state="disabled")
                self.end_btn.config(state="normal")
                self._start_session_timer()

            # Launch One2
            self.one2_process = subprocess.Popen(
                [self.config["one2_exe"]],
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
            )
            self.one2_running = True
            self.one2_status_label.config(text="✅ Running", foreground="#0A7C3E")
            self.launch_one2_btn.config(state="disabled")

            self._update_session_info()

        except Exception as e:
            messagebox.showerror("Error", f"Failed to launch One2: {e}")

    def _launch_ezdent(self):
        """Launch EzDent-i software"""
        patient_id = self.patient_id_var.get().strip()
        if not patient_id:
            messagebox.showerror("Error", "No active patient. Please wait for patient selection or use Manual Override")
            return

        if not self.config["ezdent_exe"] or not Path(self.config["ezdent_exe"]).exists():
            messagebox.showerror("Error", "EzDent-i executable not configured or not found")
            return

        if self.ezdent_running:
            messagebox.showinfo("Info", "EzDent-i is already running")
            return

        try:
            # Start session if not already active
            if not self.session_active:
                self.session_start_time = time.time()
                self.session_active = True
                self.patient_id_entry.config(state="disabled")
                self.manual_override_btn.config(state="disabled")
                self.end_btn.config(state="normal")
                self._start_session_timer()

            # Launch EzDent-i
            self.ezdent_process = subprocess.Popen(
                [self.config["ezdent_exe"]],
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
            )
            self.ezdent_running = True
            self.ezdent_status_label.config(text="✅ Running", foreground="#0A7C3E")
            self.launch_ezdent_btn.config(state="disabled")

            self._update_session_info()

        except Exception as e:
            messagebox.showerror("Error", f"Failed to launch EzDent-i: {e}")

    def _launch_both(self):
        """Launch both One2 and EzDent-i"""
        self._launch_one2()
        if not self.ezdent_running:  # Only launch if not already running
            self._launch_ezdent()

    def _start_session_timer(self):
        """Start the session elapsed time timer"""
        self.session_elapsed = 0
        self._update_session_timer()

    def _update_session_timer(self):
        """Update session timer display and check for timeout"""
        if not self.session_active:
            return

        self.session_elapsed = int(time.time() - self.session_start_time)
        elapsed_minutes = self.session_elapsed // 60
        elapsed_seconds = self.session_elapsed % 60

        timeout_minutes = int(self.config.get("session_timeout_minutes", "60"))
        warning_minutes = int(self.config.get("session_warning_minutes", "50"))

        # Update status label
        self.status_label.config(
            text=f"Session Active: {elapsed_minutes:02d}:{elapsed_seconds:02d} elapsed",
            foreground="#0A7C3E"
        )

        # Check for warning timeout
        if timeout_minutes > 0 and elapsed_minutes >= warning_minutes and elapsed_minutes < timeout_minutes:
            if elapsed_minutes == warning_minutes and elapsed_seconds == 0:
                self._show_timeout_warning(timeout_minutes - warning_minutes)

        # Check for auto-end timeout
        if timeout_minutes > 0 and elapsed_minutes >= timeout_minutes:
            self._auto_end_session()
            return

        # Schedule next update
        self.session_timer_id = self.root.after(1000, self._update_session_timer)

    def _show_timeout_warning(self, minutes_remaining: int):
        """Show warning before auto-timeout"""
        response = messagebox.askyesno(
            "⚠️ Session Timeout Warning",
            f"Session has been active for {int(self.config.get('session_warning_minutes', '50'))} minutes.\n\n"
            f"Will auto-end in {minutes_remaining} minutes.\n\n"
            f"Continue session?",
            icon='warning'
        )

        if response:
            # Reset timer
            self.session_start_time = time.time()
            self.session_elapsed = 0

    def _auto_end_session(self):
        """Auto-end session after timeout"""
        messagebox.showinfo(
            "Session Auto-Ended",
            f"Session automatically ended after {self.config.get('session_timeout_minutes', '60')} minutes."
        )
        self._end_session()

    def _update_session_info(self):
        """Update session information display"""
        info_parts = []
        if self.one2_running:
            info_parts.append("One2 active")
        if self.ezdent_running:
            info_parts.append("EzDent-i active")

        if info_parts:
            self.session_info_label.config(text=f"Session will capture images from: {', '.join(info_parts)}")
        else:
            self.session_info_label.config(text="No software launched yet")

    def _end_session(self):
        """End session: scan for new images, then upload them in the background"""
        patient_id = self.patient_id_var.get().strip()

        if not patient_id:
            messagebox.showerror("Error", "No patient ID available")
            self._cleanup_processes()
            self._reset_ui()
            return

        try:
            # Scan for new files from One2
            one2_files = []
            if self.config["one2_export"] and Path(self.config["one2_export"]).is_dir():
                one2_files = self._scan_directory(Path(self.config["one2_export"]))

            # Scan for new files from EzDent-i
            ezdent_files = []
            if self.config["ezdent_export"] and Path(self.config["ezdent_export"]).is_dir():
                ezdent_files = self._scan_directory(Path(self.config["ezdent_export"]))

            all_files = one2_files + ezdent_files

            # Deduplicate X-ray files
            deduped_files = self._deduplicate_xray_files(all_files)

            # Recalculate counts after deduplication
            deduped_one2 = [f for f in deduped_files if str(f).startswith(str(self.config["one2_export"]))]
            deduped_ezdent = [f for f in deduped_files if str(f).startswith(str(self.config.get("ezdent_export", "")))]
        except Exception as e:
            # Scanning failed, so nothing has been uploaded. Leave the session and
            # the imaging software alone rather than tearing down over a read error.
            messagebox.showerror("Error", f"Failed to scan for images: {e}")
            return

        if not deduped_files:
            response = messagebox.askyesnocancel(
                "\u26a0\ufe0f No Images Found",
                "No new images were detected during this session.\n\n"
                "This could mean:\n"
                "\u2022 No images were captured\n"
                "\u2022 Export folders are not configured correctly\n"
                "\u2022 Images are still processing\n\n"
                "End session anyway?",
                icon='warning'
            )

            if response is True:  # Yes - end anyway, nothing to lose
                self._cleanup_processes()
                self._reset_ui()
            return

        self._start_upload(patient_id, deduped_files, len(deduped_one2), len(deduped_ezdent))

    def _start_upload(self, patient_id: str, files: List[Path], one2_count: int, ezdent_count: int):
        """Hand the upload to a worker thread so the window stays responsive"""
        self.end_btn.config(state="disabled")

        self.upload_progress["maximum"] = len(files)
        self.upload_progress["value"] = 0
        self.upload_progress.pack(fill="x", pady=(5, 0))
        self.upload_status_label.config(
            text=f"Preparing {len(files)} image(s)\u2026",
            foreground="#666"
        )
        self.upload_status_label.pack(anchor="w")

        worker = threading.Thread(
            target=self._upload_worker,
            args=(patient_id, list(files), one2_count, ezdent_count),
            daemon=True,
        )
        worker.start()

    def _upload_worker(self, patient_id: str, files: List[Path], one2_count: int, ezdent_count: int):
        """
        Runs off the main thread, so it must never touch a widget directly \u2014
        everything goes back through self.root.after().

        Images go straight from this machine to Supabase Storage using signed
        URLs. Posting them through the clinic API instead would cap the whole
        session at Vercel's 4.5MB request body limit.
        """
        api_base = self.config.get("api_base_url")
        api_key = self.config.get("bridge_api_key")

        if not api_key:
            self._finish({
                "ok": False,
                "title": "Configuration Error",
                "message": "Bridge API Key not configured. Please set it in the Settings tab.",
            })
            return

        headers = {"Authorization": f"Bearer {api_key}"}

        try:
            # 1. Ask the server for one signed upload URL per file.
            self._progress(0, len(files), "Requesting upload links\u2026")
            sign_response = requests.post(
                f"{api_base}/api/bridge/upload-url",
                json={"patient_id": patient_id, "filenames": [f.name for f in files]},
                headers=headers,
                timeout=30,
            )

            if sign_response.status_code != 200:
                self._finish(self._server_error(sign_response, patient_id))
                return

            slots = {}
            for item in sign_response.json().get("uploads", []):
                slots.setdefault(item["filename"], []).append(item)

            # 2. Send the bytes to storage, one file at a time.
            uploaded = []
            failures = []

            for index, file_path in enumerate(files, start=1):
                available = slots.get(file_path.name)
                if not available:
                    failures.append((file_path.name, "no upload link returned"))
                    continue

                slot = available.pop(0)
                self._progress(
                    index - 1,
                    len(files),
                    f"Uploading {file_path.name} ({index} of {len(files)})\u2026",
                )

                error = self._put_to_storage(file_path, slot)
                if error:
                    failures.append((file_path.name, error))
                else:
                    uploaded.append({
                        "path": slot["path"],
                        "filename": file_path.name,
                        "category": slot.get("category"),
                        "size": file_path.stat().st_size,
                    })

                self._progress(index, len(files), None)

            if not uploaded:
                self._finish({
                    "ok": False,
                    "title": "Upload Failed",
                    "message": (
                        "No images could be uploaded.\n\n"
                        + self._format_failures(failures)
                        + "\n\nYour images are still on this computer and the session is "
                          "still open \u2014 click End Session & Upload again to retry."
                    ),
                })
                return

            # 3. Register what landed so it appears in the patient's gallery.
            self._progress(len(files), len(files), "Saving to patient record\u2026")
            register_response = requests.post(
                f"{api_base}/api/bridge/register",
                json={
                    "patient_id": patient_id,
                    "images": uploaded,
                    "metadata": {
                        "source": "dental-agent",
                        "captured_at": datetime.now().isoformat(),
                    },
                },
                headers=headers,
                timeout=60,
            )

            if register_response.status_code != 200:
                self._finish(self._server_error(register_response, patient_id))
                return

            patient_name = self.active_patient_name or patient_id
            complete = not failures

            if complete:
                message = (
                    f"Uploaded {one2_count} intraoral photo(s) and {ezdent_count} radiograph(s)\n\n"
                    f"Patient: {patient_name}\n"
                    f"Images are now available in the clinic system."
                )
            else:
                message = (
                    f"Uploaded {len(uploaded)} of {len(files)} image(s) for {patient_name}.\n\n"
                    + self._format_failures(failures)
                    + "\n\nThe session is still open so you can retry the rest."
                )

            self._finish({
                "ok": complete,
                "title": "\u2713 Upload Successful" if complete else "Partial Upload",
                "message": message,
            })

        except requests.exceptions.ConnectionError:
            self._finish({
                "ok": False,
                "title": "Connection Error",
                "message": (
                    f"Could not connect to clinic server at:\n{api_base}\n\n"
                    "Your images are still on this computer and the session is still open.\n\n"
                    "Please check:\n"
                    "\u2022 The API Base URL in Settings\n"
                    "\u2022 Your network connection"
                ),
            })
        except Exception as e:
            self._finish({
                "ok": False,
                "title": "Upload Error",
                "message": (
                    f"Failed to upload images: {e}\n\n"
                    "Your images are still on this computer and the session is still open."
                ),
            })

    def _put_to_storage(self, file_path: Path, slot: Dict) -> Optional[str]:
        """PUT one file to its signed URL. Returns an error string, or None on success."""
        content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        last_error = None

        for attempt in range(3):
            try:
                with open(file_path, "rb") as handle:
                    response = requests.put(
                        slot["signed_url"],
                        data=handle,
                        headers={"Content-Type": content_type},
                        timeout=120,
                    )

                if response.status_code in (200, 201):
                    return None

                last_error = f"storage returned {response.status_code}"
            except Exception as e:
                last_error = str(e)

            if attempt < 2:
                time.sleep(2 ** attempt)

        return last_error

    def _progress(self, done: int, total: int, message: Optional[str]):
        """Push progress to the UI from the worker thread"""
        self.root.after(0, self._apply_progress, done, total, message)

    def _apply_progress(self, done: int, total: int, message: Optional[str]):
        self.upload_progress["maximum"] = max(total, 1)
        self.upload_progress["value"] = done
        if message:
            self.upload_status_label.config(text=message, foreground="#666")

    def _finish(self, result: Dict):
        """Hand the outcome back to the main thread"""
        self.root.after(0, self._upload_finished, result)

    def _format_failures(self, failures: List) -> str:
        if not failures:
            return ""

        lines = [f"\u2022 {name}: {reason}" for name, reason in failures[:5]]
        if len(failures) > 5:
            lines.append(f"\u2022 \u2026and {len(failures) - 5} more")

        return "Problems:\n" + "\n".join(lines)

    def _server_error(self, response, patient_id: str) -> Dict:
        """Turn a non-200 into a message that says what to actually do about it"""
        if response.status_code == 401:
            return {
                "ok": False,
                "title": "Authentication Failed",
                "message": "Invalid Bridge API Key. Check the Settings tab \u2014 it must match "
                           "the key configured on the server.",
            }

        if response.status_code == 404:
            return {
                "ok": False,
                "title": "Patient Not Found",
                "message": f"Patient {patient_id} does not exist in the clinic system.\n\n"
                           "Make sure the patient is created in the web app before capturing.",
            }

        try:
            payload = response.json()
        except Exception:
            payload = {}

        detail = payload.get("error", "")

        # /register reports the real per-file cause under "details" - without it
        # the dialog just says "no images could be registered", which says nothing.
        rows = payload.get("details") or []
        lines = [
            f"\u2022 {row.get('file', '?')}: {row.get('error', '?')}"
            for row in rows[:5]
            if isinstance(row, dict)
        ]
        if len(rows) > 5:
            lines.append(f"\u2022 \u2026and {len(rows) - 5} more")
        if lines:
            detail = (detail + "\n\n" if detail else "") + "\n".join(lines)

        if not detail:
            detail = (response.text or "")[:200] or f"HTTP {response.status_code}"

        return {
            "ok": False,
            "title": "Upload Error",
            "message": f"Server error ({response.status_code}): {detail}\n\n"
                       "Your images are still on this computer and the session is still open.",
        }

    def _upload_finished(self, result: Dict):
        """Back on the main thread: report, and only tidy up if everything landed"""
        self.upload_progress.pack_forget()
        self.upload_status_label.pack_forget()

        if result.get("ok"):
            messagebox.showinfo(result["title"], result["message"])
            # Only now is it safe to close the imaging software.
            self._cleanup_processes()
            self._reset_ui()
        else:
            messagebox.showerror(result["title"], result["message"])
            # Leave One2/EzDent running and the session open so nothing is lost.
            self.end_btn.config(state="normal")
            self.status_label.config(
                text="Upload failed \u2014 session still open, you can retry",
                foreground="#c00"
            )

        if self.close_after_upload:
            if result.get("ok"):
                self.stop_polling = True
                self.root.destroy()
            else:
                # Do not close over a failed upload; the user decides.
                self.close_after_upload = False

    def _scan_directory(self, directory: Path) -> List[Path]:
        """Scan directory for files created after session start"""
        files = []
        if directory.exists():
            for file_path in directory.iterdir():
                if file_path.is_file():
                    try:
                        creation_time = os.path.getctime(file_path)
                        if creation_time > self.session_start_time:
                            files.append(file_path)
                    except Exception:
                        continue
        return files

    def _deduplicate_xray_files(self, files: List[Path]) -> List[Path]:
        """
        EzDent-i creates multiple temp files per X-ray.
        Keep only ONE representative file per X-ray.
        """
        if not files:
            return files

        # Separate One2 files (keep all) from EzDent-i files (deduplicate)
        one2_files = []
        ezdent_candidates = []

        for file_path in files:
            filename = file_path.name.lower()

            # If it's from One2 export folder or doesn't match EzDent-i pattern, keep it
            if 'temp_iosensor' not in filename and 'temp_' not in filename:
                one2_files.append(file_path)
            else:
                ezdent_candidates.append(file_path)

        # Deduplicate EzDent-i files
        deduped_ezdent = self._select_best_xray_versions(ezdent_candidates)

        return one2_files + deduped_ezdent

    def _select_best_xray_versions(self, files: List[Path]) -> List[Path]:
        """
        Group X-ray temp files by timestamp and select best version.
        Priority: .dcm > Original > Rotated
        Exclude: Thumbnail, Tag files
        """
        if not files:
            return []

        groups = {}
        for file_path in files:
            filename = file_path.name

            # Skip thumbnails, tags
            if any(skip in filename.lower() for skip in ['thumbnail', '.tag', '_tag_']):
                continue

            # Extract timestamp
            match = re.search(r'_(\d{8,10})_', filename)
            if match:
                timestamp = match.group(1)

                if timestamp not in groups:
                    groups[timestamp] = []
                groups[timestamp].append(file_path)

        # For each group, select the best version
        best_files = []
        for timestamp, group_files in groups.items():
            best_file = self._pick_best_file(group_files)
            if best_file:
                best_files.append(best_file)

        return best_files

    def _pick_best_file(self, files: List[Path]) -> Optional[Path]:
        """
        Pick the best representative file from a group.
        Priority: .dcm > .jpg/.png > Original > Rotated
        """
        if not files:
            return None

        # Priority scoring
        dcm_files = [f for f in files if f.suffix.lower() == '.dcm']
        if dcm_files:
            return dcm_files[0]

        # Standard image formats
        image_files = [f for f in files if f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp']]
        if image_files:
            return image_files[0]

        # Original version
        original_files = [f for f in files if 'original' in f.name.lower()]
        if original_files:
            return original_files[0]

        # Rotated version
        rotated_files = [f for f in files if 'rotated' in f.name.lower()]
        if rotated_files:
            return rotated_files[0]

        # Fallback
        return files[0]

    def _cleanup_processes(self):
        """Terminate launched software processes"""
        if self.one2_process:
            try:
                self.one2_process.terminate()
                self.one2_process.wait(timeout=5)
            except Exception:
                try:
                    self.one2_process.kill()
                except Exception:
                    pass
            self.one2_process = None

        if self.ezdent_process:
            try:
                self.ezdent_process.terminate()
                self.ezdent_process.wait(timeout=5)
            except Exception:
                try:
                    self.ezdent_process.kill()
                except Exception:
                    pass
            self.ezdent_process = None

    def _reset_ui(self):
        """Reset UI to ready state"""
        # Cancel session timer
        if self.session_timer_id:
            self.root.after_cancel(self.session_timer_id)
            self.session_timer_id = None

        self.session_active = False
        self.session_start_time = None
        self.session_elapsed = 0
        self.one2_running = False
        self.ezdent_running = False

        # Reset patient ID only if not in manual mode
        if not self.manual_mode:
            self.patient_id_var.set(self.active_patient_id or "")
            self.patient_id_entry.config(state="readonly")
        else:
            self.patient_id_entry.config(state="normal")

        self.manual_override_btn.config(state="normal")

        self.launch_one2_btn.config(state="normal")
        self.launch_ezdent_btn.config(state="normal")
        self.launch_both_btn.config(state="normal")
        self.end_btn.config(state="disabled")

        self.one2_status_label.config(text="")
        self.ezdent_status_label.config(text="")

        self.status_label.config(
            text="Ready",
            foreground="#666"
        )
        self.session_info_label.config(text="")

        # Restore active patient display
        self._update_active_patient(self.active_patient_id, self.active_patient_name)

    def on_closing(self):
        """Handle application close"""
        if self.session_active:
            response = messagebox.askyesnocancel(
                "Session Active",
                "A session is currently active.\n\n"
                "Yes = End session & upload\n"
                "No = Close without uploading\n"
                "Cancel = Keep app open",
                icon='warning'
            )

            if response is True:  # Yes - end and upload
                # The upload runs on a worker thread now, so closing has to wait
                # for it. _upload_finished() destroys the window once it lands,
                # and keeps it open if the upload failed.
                self.close_after_upload = True
                self._end_session()
            elif response is False:  # No - close without upload
                self._cleanup_processes()
                self.stop_polling = True
                self.root.destroy()
            # Cancel - do nothing
        else:
            self.stop_polling = True
            self.root.destroy()


if __name__ == "__main__":
    requested_patient = patient_id_from_argv(sys.argv)
    instance_socket, handed_off = claim_single_instance(
        sys.argv[1] if len(sys.argv) > 1 else None
    )

    if handed_off:
        # Already running: it has been told to come forward, so stop here.
        sys.exit(0)

    root = tk.Tk()
    app = DentalAgentApp(root, instance_socket, requested_patient)
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    root.mainloop()
