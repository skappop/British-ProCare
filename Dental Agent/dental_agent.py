import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import json
import os
import time
import subprocess
import requests
import re
from pathlib import Path
from typing import Optional, List, Dict


class DentalAgentApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Dental Clinic Image Agent")
        self.root.geometry("700x500")

        # Get script directory for config file
        self.script_dir = Path(__file__).parent
        self.config_path = self.script_dir / "config.json"

        # Session tracking
        self.session_active = False
        self.session_start_time: Optional[float] = None
        self.one2_process: Optional[subprocess.Popen] = None
        self.ezdent_process: Optional[subprocess.Popen] = None

        # Configuration storage
        self.config: Dict[str, str] = {
            "one2_exe": "",
            "one2_export": "",
            "ezdent_exe": "",
            "ezdent_export": ""
        }

        self._setup_ui()
        self._load_config()

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
        # One2 executable
        ttk.Label(parent, text="One2 Executable:", font=("Segoe UI", 10)).grid(
            row=0, column=0, sticky="w", pady=(0, 5)
        )
        self.one2_exe_var = tk.StringVar()
        ttk.Entry(parent, textvariable=self.one2_exe_var, width=50).grid(
            row=1, column=0, padx=(0, 10)
        )
        ttk.Button(parent, text="Browse", command=lambda: self._browse_file(self.one2_exe_var)).grid(
            row=1, column=1
        )

        # One2 export folder
        ttk.Label(parent, text="One2 Image Export Folder:", font=("Segoe UI", 10)).grid(
            row=2, column=0, sticky="w", pady=(15, 5)
        )
        self.one2_export_var = tk.StringVar()
        ttk.Entry(parent, textvariable=self.one2_export_var, width=50).grid(
            row=3, column=0, padx=(0, 10)
        )
        ttk.Button(parent, text="Browse", command=lambda: self._browse_dir(self.one2_export_var)).grid(
            row=3, column=1
        )

        # EzDent-i executable
        ttk.Label(parent, text="EzDent-i Executable:", font=("Segoe UI", 10)).grid(
            row=4, column=0, sticky="w", pady=(15, 5)
        )
        self.ezdent_exe_var = tk.StringVar()
        ttk.Entry(parent, textvariable=self.ezdent_exe_var, width=50).grid(
            row=5, column=0, padx=(0, 10)
        )
        ttk.Button(parent, text="Browse", command=lambda: self._browse_file(self.ezdent_exe_var)).grid(
            row=5, column=1
        )

        # EzDent-i export folder
        ttk.Label(parent, text="EzDent-i Image Export Folder:", font=("Segoe UI", 10)).grid(
            row=6, column=0, sticky="w", pady=(15, 5)
        )
        self.ezdent_export_var = tk.StringVar()
        ttk.Entry(parent, textvariable=self.ezdent_export_var, width=50).grid(
            row=7, column=0, padx=(0, 10)
        )
        ttk.Button(parent, text="Browse", command=lambda: self._browse_dir(self.ezdent_export_var)).grid(
            row=7, column=1
        )

        # Save button
        ttk.Button(
            parent,
            text="Save Configuration",
            command=self._save_config,
            style="Accent.TButton"
        ).grid(row=8, column=0, columnspan=2, pady=(30, 0))

    def _setup_session_tab(self, parent):
        # Patient ID input
        ttk.Label(parent, text="Patient ID:", font=("Segoe UI", 12, "bold")).pack(
            anchor="w", pady=(0, 5)
        )
        self.patient_id_var = tk.StringVar()
        self.patient_id_entry = ttk.Entry(
            parent,
            textvariable=self.patient_id_var,
            font=("Segoe UI", 11),
            width=30
        )
        self.patient_id_entry.pack(anchor="w", pady=(0, 20))

        # Status display
        self.status_label = ttk.Label(
            parent,
            text="Ready to start session",
            font=("Segoe UI", 10),
            foreground="#666"
        )
        self.status_label.pack(anchor="w", pady=(0, 20))

        # Buttons frame
        button_frame = ttk.Frame(parent)
        button_frame.pack(anchor="w", pady=10)

        self.start_btn = ttk.Button(
            button_frame,
            text="Start Session",
            command=self._start_session,
            width=15
        )
        self.start_btn.pack(side="left", padx=(0, 10))

        self.end_btn = ttk.Button(
            button_frame,
            text="End Session",
            command=self._end_session,
            state="disabled",
            width=15
        )
        self.end_btn.pack(side="left")

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
            except Exception as e:
                messagebox.showerror("Error", f"Failed to load configuration: {e}")

    def _save_config(self):
        self.config = {
            "one2_exe": self.one2_exe_var.get(),
            "one2_export": self.one2_export_var.get(),
            "ezdent_exe": self.ezdent_exe_var.get(),
            "ezdent_export": self.ezdent_export_var.get()
        }

        try:
            with open(self.config_path, 'w') as f:
                json.dump(self.config, f, indent=2)
            messagebox.showinfo("Success", "Configuration saved successfully")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save configuration: {e}")

    def _validate_config(self) -> bool:
        # Only validate One2 paths (EzDent-i is optional)
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

    def _start_session(self):
        patient_id = self.patient_id_var.get().strip()
        if not patient_id:
            messagebox.showerror("Error", "Please enter a Patient ID")
            return

        if not self._validate_config():
            return

        try:
            # Record session start time
            self.session_start_time = time.time()

            # Launch One2 application only
            self.one2_process = subprocess.Popen(
                [self.config["one2_exe"]],
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
            )

            # Only launch EzDent-i if it's configured
            if self.config["ezdent_exe"] and Path(self.config["ezdent_exe"]).exists():
                self.ezdent_process = subprocess.Popen(
                    [self.config["ezdent_exe"]],
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
                )

            # Update UI
            self.session_active = True
            self.patient_id_entry.config(state="disabled")
            self.start_btn.config(state="disabled")
            self.end_btn.config(state="normal")
            self.status_label.config(
                text=f"Session active for Patient ID: {patient_id}",
                foreground="#0A7C3E"
            )

        except Exception as e:
            messagebox.showerror("Error", f"Failed to start session: {e}")
            self._cleanup_processes()

    def _end_session(self):
        patient_id = self.patient_id_var.get().strip()

        try:
            # Scan for new files from One2 only
            one2_files = self._scan_directory(Path(self.config["one2_export"]))

            # Only scan EzDent-i if it's configured
            ezdent_files = []
            if self.config["ezdent_export"] and Path(self.config["ezdent_export"]).is_dir():
                ezdent_files = self._scan_directory(Path(self.config["ezdent_export"]))

            all_files = one2_files + ezdent_files

            # Deduplicate X-ray files (EzDent-i creates multiple temp files per image)
            deduped_files = self._deduplicate_xray_files(all_files)

            # Recalculate counts after deduplication
            deduped_one2 = [f for f in deduped_files if str(f).startswith(str(self.config["one2_export"]))]
            deduped_ezdent = [f for f in deduped_files if str(f).startswith(str(self.config.get("ezdent_export", "")))]

            if not deduped_files:
                messagebox.showwarning(
                    "No Files",
                    "No new images were found during this session"
                )
            else:
                # Upload deduplicated files
                self._upload_files(patient_id, deduped_files, len(deduped_one2), len(deduped_ezdent))

            # Cleanup
            self._cleanup_processes()
            self._reset_ui()

        except Exception as e:
            messagebox.showerror("Error", f"Failed to end session: {e}")
            self._cleanup_processes()
            self._reset_ui()

    def _scan_directory(self, directory: Path) -> List[Path]:
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
        EzDent-i creates multiple temp files per X-ray:
        - temp_iosensor_1_Original_*.nZhGXD
        - temp_iosensor_1_Original_*.nZhGXD.dcm
        - temp_iosensor_1_Raw_*.LODps
        - temp_iosensor_1_Rotated_*.gMHxRx
        - temp_iosensor_1_Tag_*.uuXqXC.tag
        - temp_iosensor_1_Thumbnail_*.dNNraj

        We only want ONE representative file per X-ray.
        Strategy: Group by timestamp prefix, keep only .dcm or Original
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
        Group X-ray temp files by their timestamp and select best version.
        Priority: .dcm > Original > Rotated > Raw
        Exclude: Thumbnail, Tag, metadata files
        """
        if not files:
            return []

        # Extract timestamp from filename (the number after date, before extension)
        # Example: temp_iosensor_1_Original_20260921_192640669_nZhGXD
        # Timestamp: 192640669
        import re

        groups = {}
        for file_path in files:
            filename = file_path.name

            # Skip thumbnails, tags, and pure metadata files
            if any(skip in filename.lower() for skip in ['thumbnail', '.tag', '_tag_']):
                continue

            # Extract the timestamp (long number after date)
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
        Priority: .dcm > .jpg/.png > Original > Rotated > Raw
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

        # Fallback: first file
        return files[0]

    def _upload_files(self, patient_id: str, files: List[Path], one2_count: int, ezdent_count: int):
        try:
            # Prepare multipart form data
            file_handles = []
            files_dict = {}

            for file_path in files:
                file_handle = open(file_path, 'rb')
                file_handles.append(file_handle)
                files_dict[f"file_{file_path.name}"] = (file_path.name, file_handle)

            # Send POST request with patient_id as form data and files separately
            response = requests.post(
                "http://localhost:5000/api/upload",
                data={"patient_id": patient_id},
                files=files_dict,
                timeout=30
            )

            # Close all file handles
            for handle in file_handles:
                handle.close()

            if response.status_code == 200:
                messagebox.showinfo(
                    "Success",
                    f"Uploaded {one2_count} intraoral photo(s) and {ezdent_count} radiograph(s) for Patient ID: {patient_id}"
                )
            else:
                messagebox.showerror("Upload Error", f"Server returned status code: {response.status_code}")

        except requests.exceptions.ConnectionError:
            messagebox.showerror(
                "Connection Error",
                "Could not connect to the clinic server. Please ensure the server is running."
            )
        except Exception as e:
            messagebox.showerror("Upload Error", f"Failed to upload files: {e}")

    def _cleanup_processes(self):
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
        self.session_active = False
        self.session_start_time = None
        self.patient_id_var.set("")
        self.patient_id_entry.config(state="normal")
        self.start_btn.config(state="normal")
        self.end_btn.config(state="disabled")
        self.status_label.config(
            text="Ready to start session",
            foreground="#666"
        )

    def on_closing(self):
        if self.session_active:
            if messagebox.askokcancel(
                "Session Active",
                "A session is currently active. Do you want to close anyway?"
            ):
                self._cleanup_processes()
                self.root.destroy()
        else:
            self.root.destroy()


if __name__ == "__main__":
    root = tk.Tk()
    app = DentalAgentApp(root)
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    root.mainloop()
