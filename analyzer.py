import json
import subprocess
import os
from models import db, Meeting, Race, Horse, Prediction

def process_csv_and_analyze(csv_file, filename, track_condition, user_id, is_advanced=False):
    """
    Process uploaded CSV file and run analysis algorithm
    
    Args:
        csv_file: File object or path to CSV
        filename: Name of the file
        track_condition: Track condition (firm, good, soft, heavy, synthetic)
        user_id: ID of user who uploaded
        is_advanced: Whether to calculate advanced probabilities
    
    Returns:
        dict: Analysis results with races and predictions
    """
    
    # Read CSV
    if hasattr(csv_file, 'read'):
        csv_data = csv_file.read().decode('utf-8')
    else:
        with open(csv_file, 'r') as f:
            csv_data = f.read()
    
    # Create meeting record
    meeting = Meeting(
        user_id=user_id,
        meeting_name=filename.replace('.csv', ''),
        csv_data=csv_data
    )
    db.session.add(meeting)
    db.session.flush()  # Get meeting ID
    
    # Call Node.js analyzer with CSV data
    analysis_results = run_js_analyzer(csv_data, track_condition, is_advanced)
    
    # Store results in database
    store_analysis_results(meeting.id, analysis_results)
    
    db.session.commit()
    
    return {
        'meeting_id': meeting.id,
        'meeting_name': meeting.meeting_name,
        'results': analysis_results
    }


def run_js_analyzer(csv_data, track_condition, is_advanced):
    """
    Run the JavaScript analyzer algorithm
    This calls the Node.js script that contains your v27 algorithm
    """
    
    # Prepare input for JS analyzer
    input_data = {
        'csv_data': csv_data,
        'track_condition': track_condition,
        'is_advanced': is_advanced
    }
    
    # Path to the analyzer script
    analyzer_path = os.path.join(os.path.dirname(__file__), 'analyzer.js')
    
    try:
        # Call Node.js analyzer
        result = subprocess.run(
            ['node', analyzer_path],
            input=json.dumps(input_data),
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            raise Exception(f"Analyzer error: {result.stderr}")
        
        # Parse results
        return json.loads(result.stdout)
        
    except subprocess.TimeoutExpired:
        raise Exception("Analysis timed out (>30 seconds)")
    except json.JSONDecodeError as e:
        raise Exception(f"Invalid analyzer output: {e}")
    except Exception as e:
        raise Exception(f"Analysis failed: {str(e)}")


def store_analysis_results(meeting_id, analysis_results):
    """Store analysis results in database"""
    
    # Group results by race
    races_data = {}
    for result in analysis_results:
        race_num = result['horse']['race number']
        if race_num not in races_data:
            races_data[race_num] = []
        races_data[race_num].append(result)
    
    # Create race and horse records
    for race_num, horses_results in races_data.items():
        # Create race record
        race = Race(
            meeting_id=meeting_id,
            race_number=race_num,
            distance=horses_results[0]['horse'].get('distance', ''),
            race_class=horses_results[0]['horse'].get('class', ''),
            track_condition=horses_results[0]['horse'].get('track condition', '')
        )
        db.session.add(race)
        db.session.flush()
        
        # Create horse and prediction records
        for result in horses_results:
            horse_data = result['horse']
            
            # Create horse record
            horse = Horse(
                race_id=race.id,
                horse_name=horse_data.get('horse name', ''),
                barrier=int(horse_data.get('barrier', 0)) if horse_data.get('barrier') else None,
                weight=float(horse_data.get('weight', 0)) if horse_data.get('weight') else None,
                jockey=horse_data.get('jockey', ''),
                trainer=horse_data.get('trainer', ''),
                form=horse_data.get('form', ''),
                csv_data=horse_data  # Store all data as JSON
            )
            db.session.add(horse)
            db.session.flush()
            
            # Create prediction record
            prediction = Prediction(
                horse_id=horse.id,
                score=result.get('score', 0),
                predicted_odds=result.get('trueOdds', ''),
                win_probability=result.get('winProbability', ''),
                performance_component=result.get('performanceComponent', ''),
                base_probability=result.get('baseProbability', ''),
                notes=result.get('notes', '')
            )
            db.session.add(prediction)


def get_meeting_results(meeting_id):
    """Retrieve stored meeting results from database"""
    
    meeting = Meeting.query.get_or_404(meeting_id)
    races = Race.query.filter_by(meeting_id=meeting_id).order_by(Race.race_number).all()
    
    results = {
        'meeting_name': meeting.meeting_name,
        'uploaded_at': meeting.uploaded_at.isoformat(),
        'races': []
    }
    
    for race in races:
        horses = Horse.query.filter_by(race_id=race.id).all()
        
        race_data = {
            'race_number': race.race_number,
            'distance': race.distance,
            'horses': []
        }
        
        for horse in horses:
            pred = horse.prediction
            horse_data = {
                'horse_name': horse.horse_name,
                'barrier': horse.barrier,
                'jockey': horse.jockey,
                'trainer': horse.trainer,
                'score': pred.score if pred else 0,
                'odds': pred.predicted_odds if pred else '',
                'notes': pred.notes if pred else ''
            }
            race_data['horses'].append(horse_data)
        
        # Sort horses by score descending
        race_data['horses'].sort(key=lambda x: x['score'], reverse=True)
        results['races'].append(race_data)
    
    return results
