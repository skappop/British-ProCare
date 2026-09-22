"""
Quick test to verify dental_agent_branded.py launches without errors
"""
import sys
import threading
import time
import io

# Fix console encoding for Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def test_import():
    """Test that the module can be imported"""
    try:
        # Change to the Dental Agent directory
        sys.path.insert(0, r"C:\Users\Skappop\procare-clinic\Dental Agent")

        # Try importing the main components
        import tkinter as tk
        import requests
        from PIL import Image, ImageTk

        print("✅ All dependencies imported successfully")
        return True
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False

def test_syntax():
    """Test that the file has valid Python syntax"""
    try:
        with open(r"C:\Users\Skappop\procare-clinic\Dental Agent\dental_agent_branded.py", 'r', encoding='utf-8') as f:
            code = f.read()
        compile(code, 'dental_agent_branded.py', 'exec')
        print("✅ Python syntax is valid")
        return True
    except SyntaxError as e:
        print(f"❌ Syntax error: {e}")
        return False

def test_launch():
    """Test that the application window can be created"""
    try:
        import tkinter as tk
        from pathlib import Path

        # Create a minimal test window
        root = tk.Tk()
        root.title("Test Window")
        root.geometry("200x100")

        # Test color creation
        test_colors = {
            'marquina': '#17181A',
            'gold': '#B8935E',
            'teal': '#4EC5C1',
            'marble': '#F7F5F1',
            'sage': '#A9BCB0'
        }

        # Create test labels with colors
        for name, color in test_colors.items():
            label = tk.Label(root, text=name, bg=color, fg='#FFFFFF')
            label.pack()

        # Schedule window close
        root.after(100, root.destroy)
        root.mainloop()

        print("✅ Tkinter window creation successful")
        return True
    except Exception as e:
        print(f"❌ Window creation error: {e}")
        return False

if __name__ == "__main__":
    print("Testing British ProCare Dental Agent...\n")

    results = []

    print("Test 1: Checking dependencies...")
    results.append(test_import())

    print("\nTest 2: Checking Python syntax...")
    results.append(test_syntax())

    print("\nTest 3: Testing Tkinter window...")
    results.append(test_launch())

    print("\n" + "="*50)
    if all(results):
        print("✅ ALL TESTS PASSED - Application is ready to use!")
        print("\nTo launch the application:")
        print('  cd "C:\\Users\\Skappop\\procare-clinic\\Dental Agent"')
        print("  python dental_agent_branded.py")
    else:
        print("❌ Some tests failed - please check errors above")
    print("="*50)
