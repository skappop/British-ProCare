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


class BrandedDentalAgentApp:
    """
    British ProCare Dental Agent
    Matches clinic brand identity with elegant design
    """

    # Brand colors from clinic design system
    COLORS = {
        'marquina': '#17181A',
        'marquina_soft': '#1F2124',
        'gold': '#B8935E',
        'gold_light': '#D9BC85',
        'gold_deep': '#A07B4A',
        'teal': '#4EC5C1',
        'teal_deep': '#2FA6A2',
        'marble': '#F7F5F1',
        'cream': '#EDE8DF',
        'ink': '#3E4C59',
        'ink_strong': '#2C3944',
        'sage': '#A9BCB0',
        'success': '#6E8F7C',
        'danger': '#C0654F',
        'white': '#FFFFFF'
    }

    def __init__(self, root):
        self.root = root
        self.root.title("British ProCare - Dental Agent")

        # Window size and position
        window_width = 800
        window_height = 600
        screen_width = root.winfo_screenwidth()
        screen_height = root.winfo_screenheight()
        x = (screen_width - window_width) // 2
        y = (screen_height - window_height) // 2
        self.root.geometry(f"{window_width}x{window_height}+{x}+{y}")

        # Prevent resize for polished look
        self.root.resizable(False, False)

        # Set window background to marble
        self.root.configure(bg=self.COLORS['marble'])

        # Get script directory for config and logo
        self.script_dir = Path(__file__).parent
        self.config_path = self.script_dir / "config.json"
        self.logo_path = self.script_dir / "logo.png"

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

        # Show splash screen with animation
        self._show_splash_screen()

        # Setup main UI after splash
        self.root.after(2500, self._setup_main_ui)

    def _show_splash_screen(self):
        """Elegant splash screen with logo animation"""
        # Create splash frame
        self.splash_frame = tk.Frame(self.root, bg=self.COLORS['marquina'])
        self.splash_frame.place(x=0, y=0, relwidth=1, relheight=1)

        # Glow effect background
        glow_canvas = tk.Canvas(
            self.splash_frame,
            bg=self.COLORS['marquina'],
            highlightthickness=0
        )
        glow_canvas.place(relx=0.5, rely=0.5, anchor='center', width=300, height=300)

        # Create radial glow (simulated with oval)
        glow_canvas.create_oval(
            50, 50, 250, 250,
            fill='', outline='',
            width=0
        )

        # Add pulsing glow effect with multiple ovals
        for i in range(5):
            alpha = 0.15 - (i * 0.02)
            size = 150 + (i * 20)
            x1 = 150 - size // 2
            y1 = 150 - size // 2
            x2 = 150 + size // 2
            y2 = 150 + size // 2
            color = self._hex_to_rgb_alpha(self.COLORS['gold'], alpha)
            glow_canvas.create_oval(x1, y1, x2, y2, fill=color, outline='')

        # Logo (if exists, otherwise show clinic name)
        if self.logo_path.exists():
            try:
                from PIL import Image, ImageTk
                logo_img = Image.open(self.logo_path)
                logo_img = logo_img.resize((120, 120), Image.Resampling.LANCZOS)
                self.logo_photo = ImageTk.PhotoImage(logo_img)
                logo_label = tk.Label(
                    self.splash_frame,
                    image=self.logo_photo,
                    bg=self.COLORS['marquina']
                )
                logo_label.place(relx=0.5, rely=0.35, anchor='center')
            except Exception:
                # Fallback to text logo
                self._show_text_logo()
        else:
            self._show_text_logo()

        # Clinic name
        name_label = tk.Label(
            self.splash_frame,
            text="BRITISH PROCARE",
            font=("Marcellus", 28, "bold"),
            fg=self.COLORS['gold_light'],
            bg=self.COLORS['marquina']
        )
        name_label.place(relx=0.5, rely=0.55, anchor='center')

        # Gold hairline
        hairline = tk.Frame(self.splash_frame, bg=self.COLORS['gold'], height=1)
        hairline.place(relx=0.5, rely=0.62, anchor='center', width=200)

        # Subtitle
        subtitle = tk.Label(
            self.splash_frame,
            text="D E N T A L  C L I N I C S",
            font=("Manrope", 9),
            fg=self.COLORS['sage'],
            bg=self.COLORS['marquina']
        )
        subtitle.place(relx=0.5, rely=0.67, anchor='center')

        # Loading indicator
        loading = tk.Label(
            self.splash_frame,
            text="● ● ●",
            font=("Manrope", 12),
            fg=self.COLORS['gold_light'],
            bg=self.COLORS['marquina']
        )
        loading.place(relx=0.5, rely=0.80, anchor='center')

        # Animate loading dots
        self._animate_loading_dots(loading, 0)

    def _show_text_logo(self):
        """Fallback text logo if image not found"""
        text_logo = tk.Label(
            self.splash_frame,
            text="B",
            font=("Marcellus", 72, "bold"),
            fg=self.COLORS['gold_light'],
            bg=self.COLORS['marquina']
        )
        text_logo.place(relx=0.5, rely=0.35, anchor='center')

    def _hex_to_rgb_alpha(self, hex_color: str, alpha: float) -> str:
        """Convert hex color to RGB with alpha for tkinter"""
        # Tkinter doesn't support rgba, so we'll blend with background
        # This is a simplified approach
        return hex_color

    def _animate_loading_dots(self, label: tk.Label, frame: int):
        """Animate loading dots"""
        dots = ["●", "● ●", "● ● ●", "● ●", "●"]
        if frame < 8 and self.splash_frame.winfo_exists():
            label.config(text=dots[frame % len(dots)])
            self.root.after(300, lambda: self._animate_loading_dots(label, frame + 1))

    def _setup_main_ui(self):
        """Setup main application UI after splash"""
        # Destroy splash
        if hasattr(self, 'splash_frame'):
            self.splash_frame.destroy()

        # Load config first
        self._load_config()

        # Main container with marble background
        main_container = tk.Frame(self.root, bg=self.COLORS['marble'])
        main_container.pack(fill='both', expand=True)

        # Header with logo and branding
        self._create_header(main_container)

        # Tab navigation (Session first, Settings last)
        self._create_tabs(main_container)

        # Start polling thread
        self._start_polling_thread()

    def _create_header(self, parent):
        """Create branded header"""
        header = tk.Frame(parent, bg=self.COLORS['marquina'], height=80)
        header.pack(fill='x', side='top')
        header.pack_propagate(False)

        # Logo (small version)
        if self.logo_path.exists():
            try:
                from PIL import Image, ImageTk
                logo_img = Image.open(self.logo_path)
                logo_img = logo_img.resize((50, 50), Image.Resampling.LANCZOS)
                self.header_logo = ImageTk.PhotoImage(logo_img)
                logo_label = tk.Label(header, image=self.header_logo, bg=self.COLORS['marquina'])
                logo_label.pack(side='left', padx=20, pady=15)
            except Exception:
                pass

        # Title
        title = tk.Label(
            header,
            text="Dental Agent",
            font=("Marcellus", 20),
            fg=self.COLORS['gold_light'],
            bg=self.COLORS['marquina']
        )
        title.pack(side='left', pady=15)

        # Subtitle
        subtitle = tk.Label(
            header,
            text="Image Capture System",
            font=("Manrope", 9),
            fg=self.COLORS['sage'],
            bg=self.COLORS['marquina']
        )
        subtitle.pack(side='left', padx=(10, 0), pady=15)

    def _create_tabs(self, parent):
        """Create tab system with Session first, Settings last"""
        # Custom styled notebook
        style = ttk.Style()
        style.theme_use('default')

        # Style the notebook tabs
        style.configure(
            'TNotebook',
            background=self.COLORS['marble'],
            borderwidth=0
        )
        style.configure(
            'TNotebook.Tab',
            background=self.COLORS['cream'],
            foreground=self.COLORS['ink'],
            padding=[20, 10],
            font=('Manrope', 10)
        )
        style.map(
            'TNotebook.Tab',
            background=[('selected', self.COLORS['marble'])],
            foreground=[('selected', self.COLORS['gold'])]
        )

        # Create notebook
        self.notebook = ttk.Notebook(parent)
        self.notebook.pack(fill='both', expand=True, padx=0, pady=0)

        # Tab 1: Session (FIRST)
        session_tab = tk.Frame(self.notebook, bg=self.COLORS['marble'])
        self.notebook.add(session_tab, text='  Session  ')
        self._create_session_tab(session_tab)

        # Tab 2: Settings (LAST)
        settings_tab = tk.Frame(self.notebook, bg=self.COLORS['marble'])
        self.notebook.add(settings_tab, text='  Settings  ')
        self._create_settings_tab(settings_tab)

    def _create_gold_hairline(self, parent):
        """Create signature gold hairline divider"""
        canvas = tk.Canvas(parent, height=2, bg=self.COLORS['marble'], highlightthickness=0)
        canvas.pack(fill='x', pady=15)

        # Draw gradient effect (simplified for tkinter)
        canvas.create_line(0, 1, 800, 1, fill=self.COLORS['gold_light'], width=1)

    def _create_session_tab(self, parent):
        """Create the session management tab"""
        # Scrollable container
        canvas = tk.Canvas(parent, bg=self.COLORS['marble'], highlightthickness=0)
        scrollbar = ttk.Scrollbar(parent, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg=self.COLORS['marble'])

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Main content with padding
        content = tk.Frame(scrollable_frame, bg=self.COLORS['marble'])
        content.pack(fill='both', expand=True, padx=30, pady=20)

        # Active patient indicator
        self.active_patient_indicator = tk.Label(
            content,
            text="⭕ No active patient selected",
            font=('Manrope', 11, 'bold'),
            fg=self.COLORS['sage'],
            bg=self.COLORS['marble']
        )
        self.active_patient_indicator.pack(anchor='w', pady=(0, 10))

        self._create_gold_hairline(content)

        # Patient ID section
        patient_frame = tk.Frame(content, bg=self.COLORS['cream'], relief='flat')
        patient_frame.pack(fill='x', pady=(0, 20))

        inner_patient = tk.Frame(patient_frame, bg=self.COLORS['cream'])
        inner_patient.pack(fill='x', padx=20, pady=20)

        tk.Label(
            inner_patient,
            text="Patient ID",
            font=('Manrope', 10, 'bold'),
            fg=self.COLORS['ink'],
            bg=self.COLORS['cream']
        ).pack(anchor='w', pady=(0, 8))

        patient_input_frame = tk.Frame(inner_patient, bg=self.COLORS['cream'])
        patient_input_frame.pack(fill='x')

        self.patient_id_var = tk.StringVar()
        self.patient_id_entry = tk.Entry(
            patient_input_frame,
            textvariable=self.patient_id_var,
            font=('Manrope', 11),
            bg=self.COLORS['white'],
            fg=self.COLORS['ink_strong'],
            relief='flat',
            bd=0,
            highlightthickness=1,
            highlightbackground=self.COLORS['sage'],
            highlightcolor=self.COLORS['gold']
        )
        self.patient_id_entry.pack(side='left', fill='x', expand=True, ipady=8, ipadx=12)

        self.manual_mode_btn = tk.Button(
            patient_input_frame,
            text="Manual",
            font=('Manrope', 9),
            bg=self.COLORS['sage'],
            fg=self.COLORS['white'],
            activebackground=self.COLORS['gold'],
            activeforeground=self.COLORS['white'],
            relief='flat',
            bd=0,
            padx=15,
            pady=8,
            cursor='hand2',
            command=self._toggle_manual_mode
        )
        self.manual_mode_btn.pack(side='left', padx=(10, 0))

        # Status display
        self.status_label = tk.Label(
            content,
            text="Ready to start session",
            font=('Manrope', 10),
            fg=self.COLORS['ink'],
            bg=self.COLORS['marble']
        )
        self.status_label.pack(anchor='w', pady=(10, 5))

        self._create_gold_hairline(content)

        # Software launch section
        launch_section = tk.Frame(content, bg=self.COLORS['marble'])
        launch_section.pack(fill='x', pady=(10, 20))

        tk.Label(
            launch_section,
            text="Launch Imaging Software",
            font=('Marcellus', 14),
            fg=self.COLORS['gold'],
            bg=self.COLORS['marble']
        ).pack(anchor='w', pady=(0, 15))

        # Launch buttons grid
        launch_grid = tk.Frame(launch_section, bg=self.COLORS['marble'])
        launch_grid.pack(fill='x')

        # One2 button
        one2_container = tk.Frame(launch_grid, bg=self.COLORS['marble'])
        one2_container.pack(side='left', padx=(0, 15), fill='both', expand=True)

        self.launch_one2_btn = tk.Button(
            one2_container,
            text="📷\nLaunch One2\nIntraoral Camera",
            font=('Manrope', 10, 'bold'),
            bg=self.COLORS['teal'],
            fg=self.COLORS['white'],
            activebackground=self.COLORS['teal_deep'],
            activeforeground=self.COLORS['white'],
            relief='flat',
            bd=0,
            pady=20,
            cursor='hand2',
            command=self._launch_one2
        )
        self.launch_one2_btn.pack(fill='both', expand=True)

        self.one2_status_label = tk.Label(
            one2_container,
            text="",
            font=('Manrope', 8),
            fg=self.COLORS['sage'],
            bg=self.COLORS['marble']
        )
        self.one2_status_label.pack(pady=(8, 0))

        # EzDent-i button
        ezdent_container = tk.Frame(launch_grid, bg=self.COLORS['marble'])
        ezdent_container.pack(side='left', padx=(0, 15), fill='both', expand=True)

        self.launch_ezdent_btn = tk.Button(
            ezdent_container,
            text="🦷\nLaunch EzDent-i\nX-ray / CBCT",
            font=('Manrope', 10, 'bold'),
            bg=self.COLORS['gold'],
            fg=self.COLORS['white'],
            activebackground=self.COLORS['gold_deep'],
            activeforeground=self.COLORS['white'],
            relief='flat',
            bd=0,
            pady=20,
            cursor='hand2',
            command=self._launch_ezdent
        )
        self.launch_ezdent_btn.pack(fill='both', expand=True)

        self.ezdent_status_label = tk.Label(
            ezdent_container,
            text="",
            font=('Manrope', 8),
            fg=self.COLORS['sage'],
            bg=self.COLORS['marble']
        )
        self.ezdent_status_label.pack(pady=(8, 0))

        # Launch both button
        both_container = tk.Frame(launch_grid, bg=self.COLORS['marble'])
        both_container.pack(side='left', fill='both', expand=True)

        self.launch_both_btn = tk.Button(
            both_container,
            text="🚀\nLaunch Both\nFull Suite",
            font=('Manrope', 10, 'bold'),
            bg=self.COLORS['ink'],
            fg=self.COLORS['white'],
            activebackground=self.COLORS['ink_strong'],
            activeforeground=self.COLORS['white'],
            relief='flat',
            bd=0,
            pady=20,
            cursor='hand2',
            command=self._launch_both
        )
        self.launch_both_btn.pack(fill='both', expand=True)

        self._create_gold_hairline(content)

        # End session button
        self.end_btn = tk.Button(
            content,
            text="End Session & Upload Images",
            font=('Manrope', 12, 'bold'),
            bg=self.COLORS['success'],
            fg=self.COLORS['white'],
            activebackground=self.COLORS['sage'],
            activeforeground=self.COLORS['white'],
            relief='flat',
            bd=0,
            state='disabled',
            cursor='hand2',
            pady=15,
            command=self._end_session
        )
        self.end_btn.pack(fill='x', pady=(10, 20))

        # Session info
        self.session_info_label = tk.Label(
            content,
            text="",
            font=('Manrope', 9),
            fg=self.COLORS['sage'],
            bg=self.COLORS['marble']
        )
        self.session_info_label.pack(anchor='w', pady=(5, 0))

    def _create_settings_tab(self, parent):
        """Create the settings configuration tab"""
        # Scrollable container
        canvas = tk.Canvas(parent, bg=self.COLORS['marble'], highlightthickness=0)
        scrollbar = ttk.Scrollbar(parent, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg=self.COLORS['marble'])

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Main content with padding
        content = tk.Frame(scrollable_frame, bg=self.COLORS['marble'])
        content.pack(fill='both', expand=True, padx=30, pady=20)

        # Title
        tk.Label(
            content,
            text="Configuration",
            font=('Marcellus', 18),
            fg=self.COLORS['gold'],
            bg=self.COLORS['marble']
        ).pack(anchor='w', pady=(0, 20))

        # Variables for settings
        self.one2_exe_var = tk.StringVar()
        self.one2_export_var = tk.StringVar()
        self.ezdent_exe_var = tk.StringVar()
        self.ezdent_export_var = tk.StringVar()
        self.api_url_var = tk.StringVar()
        self.api_key_var = tk.StringVar()
        self.timeout_var = tk.StringVar()
        self.warning_var = tk.StringVar()

        # One2 Settings
        self._create_setting_section(
            content,
            "One2 Intraoral Camera",
            [
                ("Executable Path", self.one2_exe_var, "file"),
                ("Export Folder", self.one2_export_var, "folder")
            ]
        )

        self._create_gold_hairline(content)

        # EzDent-i Settings
        self._create_setting_section(
            content,
            "EzDent-i X-ray System",
            [
                ("Executable Path", self.ezdent_exe_var, "file"),
                ("Export Folder", self.ezdent_export_var, "folder")
            ]
        )

        self._create_gold_hairline(content)

        # API Settings
        self._create_setting_section(
            content,
            "British ProCare Server",
            [
                ("API Base URL", self.api_url_var, "text"),
                ("Bridge API Key", self.api_key_var, "password")
            ]
        )

        self._create_gold_hairline(content)

        # Session Settings
        self._create_setting_section(
            content,
            "Session Timeout",
            [
                ("Timeout (minutes)", self.timeout_var, "text"),
                ("Warning (minutes)", self.warning_var, "text")
            ]
        )

        self._create_gold_hairline(content)

        # Save button
        save_btn = tk.Button(
            content,
            text="Save Configuration",
            font=('Manrope', 12, 'bold'),
            bg=self.COLORS['gold'],
            fg=self.COLORS['white'],
            activebackground=self.COLORS['gold_deep'],
            activeforeground=self.COLORS['white'],
            relief='flat',
            bd=0,
            cursor='hand2',
            pady=15,
            command=self._save_config
        )
        save_btn.pack(fill='x', pady=(20, 0))

    def _create_setting_section(self, parent, title, fields):
        """Create a settings section with fields"""
        section = tk.Frame(parent, bg=self.COLORS['cream'], relief='flat')
        section.pack(fill='x', pady=(0, 20))

        inner = tk.Frame(section, bg=self.COLORS['cream'])
        inner.pack(fill='x', padx=20, pady=20)

        tk.Label(
            inner,
            text=title,
            font=('Manrope', 12, 'bold'),
            fg=self.COLORS['ink_strong'],
            bg=self.COLORS['cream']
        ).pack(anchor='w', pady=(0, 15))

        for label_text, var, field_type in fields:
            field_frame = tk.Frame(inner, bg=self.COLORS['cream'])
            field_frame.pack(fill='x', pady=(0, 12))

            tk.Label(
                field_frame,
                text=label_text,
                font=('Manrope', 9),
                fg=self.COLORS['ink'],
                bg=self.COLORS['cream']
            ).pack(anchor='w', pady=(0, 5))

            input_frame = tk.Frame(field_frame, bg=self.COLORS['cream'])
            input_frame.pack(fill='x')

            if field_type == "password":
                entry = tk.Entry(
                    input_frame,
                    textvariable=var,
                    font=('Manrope', 10),
                    bg=self.COLORS['white'],
                    fg=self.COLORS['ink_strong'],
                    show="*",
                    relief='flat',
                    bd=0,
                    highlightthickness=1,
                    highlightbackground=self.COLORS['sage'],
                    highlightcolor=self.COLORS['gold']
                )
            else:
                entry = tk.Entry(
                    input_frame,
                    textvariable=var,
                    font=('Manrope', 10),
                    bg=self.COLORS['white'],
                    fg=self.COLORS['ink_strong'],
                    relief='flat',
                    bd=0,
                    highlightthickness=1,
                    highlightbackground=self.COLORS['sage'],
                    highlightcolor=self.COLORS['gold']
                )
            entry.pack(side='left', fill='x', expand=True, ipady=8, ipadx=12)

            if field_type == "file":
                browse_btn = tk.Button(
                    input_frame,
                    text="Browse",
                    font=('Manrope', 9),
                    bg=self.COLORS['sage'],
                    fg=self.COLORS['white'],
                    activebackground=self.COLORS['gold'],
                    activeforeground=self.COLORS['white'],
                    relief='flat',
                    bd=0,
                    padx=15,
                    pady=8,
                    cursor='hand2',
                    command=lambda v=var: self._browse_file(v)
                )
                browse_btn.pack(side='left', padx=(10, 0))
            elif field_type == "folder":
                browse_btn = tk.Button(
                    input_frame,
                    text="Browse",
                    font=('Manrope', 9),
                    bg=self.COLORS['sage'],
                    fg=self.COLORS['white'],
                    activebackground=self.COLORS['gold'],
                    activeforeground=self.COLORS['white'],
                    relief='flat',
                    bd=0,
                    padx=15,
                    pady=8,
                    cursor='hand2',
                    command=lambda v=var: self._browse_dir(v)
                )
                browse_btn.pack(side='left', padx=(10, 0))

    def _browse_file(self, var: tk.StringVar):
        """Browse for executable file"""
        filename = filedialog.askopenfilename(
            title="Select Executable",
            filetypes=[("Executable files", "*.exe"), ("All files", "*.*")]
        )
        if filename:
            var.set(filename)

    def _browse_dir(self, var: tk.StringVar):
        """Browse for directory"""
        dirname = filedialog.askdirectory(title="Select Export Directory")
        if dirname:
            var.set(dirname)

    def _load_config(self):
        """Load configuration from file"""
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r') as f:
                    self.config = json.load(f)

                self.one2_exe_var.set(self.config.get("one2_exe", ""))
                self.one2_export_var.set(self.config.get("one2_export", ""))
                self.ezdent_exe_var.set(self.config.get("ezdent_exe", ""))
                self.ezdent_export_var.set(self.config.get("ezdent_export", ""))
                self.api_url_var.set(self.config.get("api_base_url", "https://british-pro-care.vercel.app"))
                self.api_key_var.set(self.config.get("bridge_api_key", ""))
                self.timeout_var.set(self.config.get("session_timeout_minutes", "60"))
                self.warning_var.set(self.config.get("session_warning_minutes", "50"))
            except Exception as e:
                messagebox.showerror("Error", f"Failed to load configuration: {e}")

    def _save_config(self):
        """Save configuration to file"""
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

    def _start_polling_thread(self):
        """Start background polling for active patient"""
        self.stop_polling = False
        self.polling_thread = threading.Thread(target=self._poll_active_patient, daemon=True)
        self.polling_thread.start()

    def _poll_active_patient(self):
        """Background thread polling active patient every 2 seconds"""
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
                        self.root.after(0, self._update_active_patient, patient_id, patient_name)
                except Exception:
                    pass  # Silent fail, keep polling

            time.sleep(2)

    def _update_active_patient(self, patient_id: Optional[str], patient_name: Optional[str]):
        """Update UI with active patient info"""
        # Check for patient change during active session
        if self.session_active and patient_id and patient_id != self.active_patient_id:
            self._handle_patient_change(patient_id, patient_name)
            return

        self.active_patient_id = patient_id
        self.active_patient_name = patient_name

        if patient_id and patient_name:
            self.active_patient_indicator.config(
                text=f"🟢 Active Patient: {patient_name}",
                fg=self.COLORS['success']
            )
            self.patient_id_var.set(patient_id)
        elif patient_id:
            self.active_patient_indicator.config(
                text=f"🟢 Active Patient: {patient_id}",
                fg=self.COLORS['success']
            )
            self.patient_id_var.set(patient_id)
        else:
            self.active_patient_indicator.config(
                text="⭕ No active patient selected",
                fg=self.COLORS['sage']
            )
            if not self.manual_mode:
                self.patient_id_var.set("")

    def _handle_patient_change(self, new_patient_id: str, new_patient_name: Optional[str]):
        """Handle patient change during active session"""
        response = messagebox.askyesnocancel(
            "⚠️ Session Already Active",
            f"Current session: {self.active_patient_name or self.active_patient_id}\n\n"
            f"New patient detected: {new_patient_name or new_patient_id}\n\n"
            f"Yes = End current & upload\n"
            f"No = Discard current (no upload)\n"
            f"Cancel = Keep current session"
        )

        if response is True:  # End and upload
            self._end_session()
            self.active_patient_id = new_patient_id
            self.active_patient_name = new_patient_name
            self._update_active_patient(new_patient_id, new_patient_name)
        elif response is False:  # Discard
            self._cleanup_processes()
            self._reset_ui()
            self.active_patient_id = new_patient_id
            self.active_patient_name = new_patient_name
            self._update_active_patient(new_patient_id, new_patient_name)

    def _toggle_manual_mode(self):
        """Toggle manual override mode"""
        self.manual_mode = not self.manual_mode

        if self.manual_mode:
            self.patient_id_entry.config(state="normal")
            self.manual_mode_btn.config(text="Lock", bg=self.COLORS['danger'])
            self.active_patient_indicator.config(
                text="⚠️ Manual Mode - Enter Patient ID manually",
                fg=self.COLORS['gold_deep']
            )
        else:
            self.patient_id_entry.config(state="readonly")
            self.manual_mode_btn.config(text="Manual", bg=self.COLORS['sage'])
            self._update_active_patient(self.active_patient_id, self.active_patient_name)

    def _validate_config(self) -> bool:
        """Validate configuration before launching"""
        if not self.config.get("one2_exe") or not Path(self.config["one2_exe"]).exists():
            messagebox.showerror("Configuration Error", "One2 executable not found. Please configure in Settings tab.")
            return False

        if not self.config.get("one2_export") or not Path(self.config["one2_export"]).is_dir():
            messagebox.showerror("Configuration Error", "One2 export folder not found. Please configure in Settings tab.")
            return False

        return True

    def _launch_one2(self):
        """Launch One2 intraoral camera software"""
        patient_id = self.patient_id_var.get().strip()
        if not patient_id:
            messagebox.showerror("Error", "No active patient. Please wait for patient selection or use Manual mode.")
            return

        if not self._validate_config():
            return

        if self.one2_running:
            messagebox.showinfo("Info", "One2 is already running")
            return

        try:
            if not self.session_active:
                self.session_start_time = time.time()
                self.session_active = True
                self.patient_id_entry.config(state="disabled")
                self.manual_mode_btn.config(state="disabled")
                self.end_btn.config(state="normal")
                self._start_session_timer()

            self.one2_process = subprocess.Popen(
                [self.config["one2_exe"]],
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
            )
            self.one2_running = True
            self.one2_status_label.config(text="✅ Running", fg=self.COLORS['success'])
            self.launch_one2_btn.config(state="disabled")
            self._update_session_info()

        except Exception as e:
            messagebox.showerror("Error", f"Failed to launch One2: {e}")

    def _launch_ezdent(self):
        """Launch EzDent-i X-ray software"""
        patient_id = self.patient_id_var.get().strip()
        if not patient_id:
            messagebox.showerror("Error", "No active patient. Please wait for patient selection or use Manual mode.")
            return

        if not self.config.get("ezdent_exe") or not Path(self.config["ezdent_exe"]).exists():
            messagebox.showerror("Error", "EzDent-i executable not configured or not found")
            return

        if self.ezdent_running:
            messagebox.showinfo("Info", "EzDent-i is already running")
            return

        try:
            if not self.session_active:
                self.session_start_time = time.time()
                self.session_active = True
                self.patient_id_entry.config(state="disabled")
                self.manual_mode_btn.config(state="disabled")
                self.end_btn.config(state="normal")
                self._start_session_timer()

            self.ezdent_process = subprocess.Popen(
                [self.config["ezdent_exe"]],
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
            )
            self.ezdent_running = True
            self.ezdent_status_label.config(text="✅ Running", fg=self.COLORS['success'])
            self.launch_ezdent_btn.config(state="disabled")
            self._update_session_info()

        except Exception as e:
            messagebox.showerror("Error", f"Failed to launch EzDent-i: {e}")

    def _launch_both(self):
        """Launch both One2 and EzDent-i"""
        self._launch_one2()
        if not self.ezdent_running:
            self._launch_ezdent()

    def _start_session_timer(self):
        """Start session elapsed time timer"""
        self.session_elapsed = 0
        self._update_session_timer()

    def _update_session_timer(self):
        """Update session timer and check for timeout"""
        if not self.session_active:
            return

        self.session_elapsed = int(time.time() - self.session_start_time)
        elapsed_minutes = self.session_elapsed // 60
        elapsed_seconds = self.session_elapsed % 60

        timeout_minutes = int(self.config.get("session_timeout_minutes", "60"))
        warning_minutes = int(self.config.get("session_warning_minutes", "50"))

        self.status_label.config(
            text=f"Session Active: {elapsed_minutes:02d}:{elapsed_seconds:02d} elapsed",
            fg=self.COLORS['success']
        )

        # Warning timeout
        if timeout_minutes > 0 and elapsed_minutes >= warning_minutes and elapsed_minutes < timeout_minutes:
            if elapsed_minutes == warning_minutes and elapsed_seconds == 0:
                self._show_timeout_warning(timeout_minutes - warning_minutes)

        # Auto-end timeout
        if timeout_minutes > 0 and elapsed_minutes >= timeout_minutes:
            self._auto_end_session()
            return

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
            self.session_info_label.config(text=f"Capturing from: {', '.join(info_parts)}")
        else:
            self.session_info_label.config(text="No software launched yet")

    def _end_session(self):
        """End session and upload images"""
        patient_id = self.patient_id_var.get().strip()

        if not patient_id:
            messagebox.showerror("Error", "No patient ID available")
            self._cleanup_processes()
            self._reset_ui()
            return

        try:
            # Scan for new files
            one2_files = []
            if self.config.get("one2_export") and Path(self.config["one2_export"]).is_dir():
                one2_files = self._scan_directory(Path(self.config["one2_export"]))

            ezdent_files = []
            if self.config.get("ezdent_export") and Path(self.config["ezdent_export"]).is_dir():
                ezdent_files = self._scan_directory(Path(self.config["ezdent_export"]))

            all_files = one2_files + ezdent_files

            # Deduplicate X-ray files
            deduped_files = self._deduplicate_xray_files(all_files)

            deduped_one2 = [f for f in deduped_files if str(f).startswith(str(self.config.get("one2_export", "")))]
            deduped_ezdent = [f for f in deduped_files if str(f).startswith(str(self.config.get("ezdent_export", "")))]

            if not deduped_files:
                response = messagebox.askyesnocancel(
                    "⚠️ No Images Found",
                    "No new images were detected during this session.\n\n"
                    "This could mean:\n"
                    "• No images were captured\n"
                    "• Export folders are not configured correctly\n"
                    "• Images are still processing\n\n"
                    "End session anyway?",
                    icon='warning'
                )

                if response is True:
                    self._cleanup_processes()
                    self._reset_ui()
                    return
                elif response is False:
                    return
                else:
                    return
            else:
                self._upload_files(patient_id, deduped_files, len(deduped_one2), len(deduped_ezdent))

            self._cleanup_processes()
            self._reset_ui()

        except Exception as e:
            messagebox.showerror("Error", f"Failed to end session: {e}")
            self._cleanup_processes()
            self._reset_ui()

    def _scan_directory(self, directory: Path) -> List[Path]:
        """Scan directory for new files since session start"""
        if not self.session_start_time:
            return []

        new_files = []
        for file in directory.rglob("*"):
            if file.is_file():
                try:
                    if file.stat().st_mtime > self.session_start_time:
                        new_files.append(file)
                except Exception:
                    pass

        return new_files

    def _deduplicate_xray_files(self, files: List[Path]) -> List[Path]:
        """Deduplicate EzDent-i X-ray files (keeps best version only)"""
        # Group by timestamp pattern
        groups = {}
        standalone = []

        for file in files:
            filename = file.name
            match = re.search(r'temp_iosensor_(\d{8}_\d{6})', filename)

            if match:
                timestamp = match.group(1)
                if timestamp not in groups:
                    groups[timestamp] = []
                groups[timestamp].append(file)
            else:
                standalone.append(file)

        # Select best file from each group
        selected_files = standalone.copy()

        for timestamp, group_files in groups.items():
            # Filter out thumbnails and tags
            filtered = [f for f in group_files if 'Thumbnail' not in f.name and 'Tag' not in f.name]

            if not filtered:
                continue

            # Priority: .dcm > .jpg > Original > Rotated
            best_file = None

            dcm_files = [f for f in filtered if f.suffix.lower() == '.dcm']
            if dcm_files:
                best_file = dcm_files[0]
            else:
                jpg_files = [f for f in filtered if f.suffix.lower() in ['.jpg', '.jpeg']]
                if jpg_files:
                    original = [f for f in jpg_files if 'Original' in f.name]
                    if original:
                        best_file = original[0]
                    else:
                        best_file = jpg_files[0]

            if best_file:
                selected_files.append(best_file)

        return selected_files

    def _upload_files(self, patient_id: str, files: List[Path], one2_count: int, ezdent_count: int):
        """Upload files to British ProCare server"""
        if not self.config.get("api_base_url") or not self.config.get("bridge_api_key"):
            messagebox.showerror("Error", "API configuration missing. Please configure in Settings tab.")
            return

        try:
            upload_url = f"{self.config['api_base_url']}/api/bridge/upload"

            form_data = {
                'patient_id': patient_id,
                'metadata': json.dumps({
                    'source': 'dental-agent',
                    'session_duration_seconds': self.session_elapsed,
                    'one2_count': one2_count,
                    'ezdent_count': ezdent_count,
                    'total_files': len(files)
                })
            }

            files_data = []
            for i, file_path in enumerate(files):
                files_data.append((f'file_{i}', (file_path.name, open(file_path, 'rb'), 'application/octet-stream')))

            response = requests.post(
                upload_url,
                data=form_data,
                files=files_data,
                headers={'Authorization': f"Bearer {self.config['bridge_api_key']}"},
                timeout=300
            )

            for _, (_, file_obj, _) in files_data:
                file_obj.close()

            if response.status_code == 200:
                result = response.json()
                uploaded = result.get('uploaded', 0)
                failed = result.get('failed', 0)

                messagebox.showinfo(
                    "✅ Upload Successful",
                    f"Session completed!\n\n"
                    f"Patient: {self.active_patient_name or patient_id}\n"
                    f"Uploaded: {uploaded} images\n"
                    f"Failed: {failed} images\n\n"
                    f"Images are now available in the patient gallery."
                )
            else:
                messagebox.showerror("Upload Failed", f"Server returned error: {response.status_code}\n{response.text}")

        except Exception as e:
            messagebox.showerror("Upload Error", f"Failed to upload images: {e}")

    def _cleanup_processes(self):
        """Cleanup running processes"""
        if self.one2_process:
            try:
                self.one2_process.terminate()
            except Exception:
                pass
            self.one2_process = None

        if self.ezdent_process:
            try:
                self.ezdent_process.terminate()
            except Exception:
                pass
            self.ezdent_process = None

    def _reset_ui(self):
        """Reset UI to initial state"""
        self.session_active = False
        self.session_start_time = None
        self.one2_running = False
        self.ezdent_running = False

        if self.session_timer_id:
            self.root.after_cancel(self.session_timer_id)
            self.session_timer_id = None

        self.patient_id_entry.config(state="readonly")
        self.manual_mode_btn.config(state="normal")
        self.end_btn.config(state="disabled")

        self.launch_one2_btn.config(state="normal")
        self.launch_ezdent_btn.config(state="normal")
        self.launch_both_btn.config(state="normal")

        self.one2_status_label.config(text="", fg=self.COLORS['sage'])
        self.ezdent_status_label.config(text="", fg=self.COLORS['sage'])
        self.status_label.config(text="Ready to start session", fg=self.COLORS['ink'])
        self.session_info_label.config(text="")


def main():
    root = tk.Tk()
    app = BrandedDentalAgentApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()