import json
import subprocess
import os
import sys
from models import db, Meeting, Race, Horse, Prediction # Importing mock models

def run_js_analyzer(csv_data, track_condition, is_advanced):
    """
    Run the JavaScript analyzer algorithm via Node.js subprocess.
    """
    
    input_data = {
        'csv_data': csv_data,
        'track_condition': track_condition,
        'is_advanced': is_advanced
    }
    
    analyzer_path = os.path.join(os.path.dirname(__file__), 'analyzer.js')
    
    try:
        result = subprocess.run(
            ['node', analyzer_path],
            input=json.dumps(input_data),
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            raise Exception(f"Analyzer error: {result.stderr.strip() or result.stdout.strip()}")
        
        return json.loads(result.stdout)
        
    except subprocess.TimeoutExpired:
        raise Exception("Analysis timed out (>30 seconds)")
    except json.JSONDecodeError as e:
        raise Exception(f"Invalid analyzer output: {e} | Raw Output: {result.stdout.strip()}")
    except Exception as e:
        raise Exception(f"Analysis failed: {str(e)}")


# --- Standalone Execution for Server.js ---
if __name__ == "__main__":
    try:
        # Read parameters passed from server.js via stdin
        input_json = sys.stdin.read()
        
        if not input_json:
            raise ValueError("No input data received from Node.js server.")
            
        data = json.loads(input_json)
        
        file_path = data.get('file_path')
        track_condition = data.get('track_condition', 'good')
        user_id = data.get('user_id', 'mock_user_123')
        is_advanced = data.get('is_advanced', False)
        filename = os.path.basename(file_path)

        if not file_path:
            raise ValueError("Missing file_path in input data.")

        # Mock DB record creation
        meeting = Meeting(
            user_id=user_id,
            meeting_name=filename.replace('.csv', ''),
            csv_data='...' 
        )
        
        # Read CSV content to pass to Node.js
        with open(file_path, 'r') as f:
            csv_data = f.read()

        # Call the Node.js Analyzer
        analysis_results = run_js_analyzer(csv_data, track_condition, is_advanced)
        
        # Return the final structure to stdout
        print(json.dumps({
            'meeting_id': meeting.id,
            'meeting_name': meeting.meeting_name,
            'results': analysis_results
        }))

    except Exception as e:
        # Write error as JSON to stderr for Node.js to catch
        sys.stderr.write(json.dumps({'error': f"Python Orchestrator Error: {str(e)}"}))
        sys.exit(1)
