from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from pathlib import Path
from datetime import datetime
import os

app = Flask(__name__)

# Create mock_db directory relative to script location
SCRIPT_DIR = Path(__file__).parent
UPLOAD_BASE_DIR = SCRIPT_DIR / "mock_db"
UPLOAD_BASE_DIR.mkdir(exist_ok=True)


@app.route('/api/upload', methods=['POST'])
def upload_images():
    try:
        # Extract patient ID
        patient_id = request.form.get('patient_id')

        if not patient_id:
            return jsonify({"error": "patient_id is required"}), 400

        # Get all uploaded files
        files = request.files

        if not files:
            return jsonify({"error": "No files uploaded"}), 400

        # Create patient-specific directory with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        patient_dir = UPLOAD_BASE_DIR / f"{patient_id}_{timestamp}"
        patient_dir.mkdir(parents=True, exist_ok=True)

        # Counters for different image types
        intraoral_count = 0
        radiograph_count = 0
        saved_files = []

        # Save all uploaded files
        for field_name, file_storage in files.items():
            if file_storage.filename:
                # Secure the filename
                filename = secure_filename(file_storage.filename)
                file_path = patient_dir / filename

                # Save the file
                file_storage.save(str(file_path))
                saved_files.append(filename)

                # Count by assumed source (basic heuristic)
                # In real implementation, you might use form field naming to distinguish
                if "One2" in field_name or "intra" in filename.lower():
                    intraoral_count += 1
                elif "EzDent" in field_name or "radio" in filename.lower() or "xray" in filename.lower():
                    radiograph_count += 1
                else:
                    # If we can't determine, count all remaining as general
                    intraoral_count += 1

        # Adjust counts if we couldn't distinguish (split evenly as fallback)
        total_files = len(saved_files)
        if intraoral_count == 0 and radiograph_count == 0:
            # Assume roughly equal split if no naming hints
            intraoral_count = total_files // 2
            radiograph_count = total_files - intraoral_count

        # Console output
        print(f"\n{'='*60}")
        print(f"✓ SUCCESS: Uploaded images for Patient ID: {patient_id}")
        print(f"{'='*60}")
        print(f"  Intraoral photos: {intraoral_count}")
        print(f"  Radiographs: {radiograph_count}")
        print(f"  Total files: {total_files}")
        print(f"  Saved to: {patient_dir.relative_to(SCRIPT_DIR)}")
        print(f"{'='*60}\n")

        return jsonify({
            "success": True,
            "patient_id": patient_id,
            "intraoral_count": intraoral_count,
            "radiograph_count": radiograph_count,
            "total_files": total_files,
            "saved_to": str(patient_dir.relative_to(SCRIPT_DIR)),
            "files": saved_files
        }), 200

    except Exception as e:
        print(f"\n✗ ERROR: {str(e)}\n")
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "running", "service": "Dental Clinic Mock Server"}), 200


if __name__ == '__main__':
    print("\n" + "="*60)
    print("  Dental Clinic Mock Server")
    print("="*60)
    print(f"  Running on: http://localhost:5000")
    print(f"  Upload endpoint: POST /api/upload")
    print(f"  Storage location: {UPLOAD_BASE_DIR.relative_to(SCRIPT_DIR)}")
    print("="*60 + "\n")

    app.run(host='0.0.0.0', port=5000, debug=True)
