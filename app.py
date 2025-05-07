from flask import Flask, request, jsonify, send_file, Response, make_response
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import io
import traceback
import csv
import tempfile
import os
import atexit
import time

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Load the trained model
model = joblib.load('xgb.pkl')

# Store predictions on disk instead of memory
temp_file_path = None
temp_files_to_cleanup = []

# Register cleanup function
@atexit.register
def cleanup_temp_files():
    for file_path in temp_files_to_cleanup:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"Cleaned up temp file: {file_path}")
        except Exception as e:
            print(f"Error removing temp file {file_path}: {e}")

possible_ip_columns = ['ip', 'Random_IP','IP', 'ip_address', 'IP_Address', 'source_ip', 'src_ip', 'IP Address']

@app.route('/predict', methods=['POST'])
def predict():
    try:
        file = request.files.get('file')
        if file is None:
            return jsonify({'error': 'No file provided'}), 400

        # Create a temporary file to store predictions
        global temp_file_path, temp_files_to_cleanup
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except:
                pass  # Ignore if file is already deleted
            
        fd, temp_file_path = tempfile.mkstemp(suffix='.csv')
        os.close(fd)  # Close the file descriptor
        temp_files_to_cleanup.append(temp_file_path)
        
        # Save predictions to disk using a CSV file
        with open(temp_file_path, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['ip_address', 'prediction'])
            
            # Process the input file in chunks
            chunk_size = 5000
            reader = pd.read_csv(file, chunksize=chunk_size)
            
            # Track counts for response
            legitimate_count = 0
            low_rated_count = 0
            high_rated_count = 0
            
            for chunk in reader:
                # Find IP column
                ip_column = None
                for col in chunk.columns:
                    if col.lower().replace(' ', '_') in [p.lower().replace(' ', '_') for p in possible_ip_columns]:
                        ip_column = col
                        break

                if ip_column is None:
                    raise ValueError(f"No IP address column found. Available columns: {chunk.columns.tolist()}")

                # Store IP addresses
                ip_addresses = chunk[ip_column].tolist()
                
                # Prepare features
                features = chunk.drop(columns=[ip_column])
                
                # Make predictions
                chunk_predictions = model.predict(features.to_numpy())
                
                # Update counts
                legitimate_count += np.sum(chunk_predictions == 1)
                low_rated_count += np.sum(chunk_predictions == 2)
                high_rated_count += np.sum(chunk_predictions == 0)
                
                # Write results to file
                for ip, pred in zip(ip_addresses, chunk_predictions):
                    writer.writerow([ip, pred])
        
        print(f"Prediction data saved to temporary file: {temp_file_path}")
        print(f"Total counts - Legitimate: {legitimate_count}, Low-rated: {low_rated_count}, High-rated: {high_rated_count}")
                
        return jsonify({
            'legitimate_count': int(legitimate_count),
            'low_rated_count': int(low_rated_count),
            'high_rated_count': int(high_rated_count)
        })

    except Exception as e:
        print(f'Error in predict: {e}')
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/block', methods=['POST'])
def block():
    try:
        global temp_file_path
        if not temp_file_path or not os.path.exists(temp_file_path):
            return jsonify({'error': 'No predictions available. Please analyze the file first.'}), 400

        # Create Reports directory if it doesn't exist
        reports_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'Reports')
        os.makedirs(reports_dir, exist_ok=True)

        # Generate unique filename with timestamp
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        output_filename = f"blocked_ips_{timestamp}.csv"
        output_path = os.path.join(reports_dir, output_filename)

        # Create the CSV file directly in the Reports folder
        with open(output_path, 'w', newline='') as out_file:
            writer = csv.writer(out_file)
            writer.writerow(['Blocked IP Address', 'Attack Type'])
            
            blocked_count = 0
            with open(temp_file_path, 'r', newline='') as in_file:
                reader = csv.reader(in_file)
                next(reader)  # Skip header
                
                for row in reader:
                    if len(row) >= 2:
                        try:
                            ip, prediction = row[0], int(float(row[1]))
                            if prediction == 0 or prediction == 2:
                                attack_type = 'High-Rated Attack' if prediction == 0 else 'Low-Rated Attack'
                                writer.writerow([ip, attack_type])
                                blocked_count += 1
                        except (ValueError, IndexError) as e:
                            continue
        
        print(f"Blocked IPs list saved to Reports folder: {output_filename}")
        
        return jsonify({
            'success': True,
            'message': 'Blocked IPs list saved successfully to Reports folder',
            'filename': output_filename
        })

    except Exception as e:
        print(f"Error saving blocked IPs list: {str(e)}")
        return jsonify({'error': 'Failed to save blocked IPs list'}), 500

# Add a simple route to confirm the server is running
@app.route('/', methods=['GET'])
def index():
    return "DDOS Analysis API is running"

if __name__ == '__main__':
     app.run(debug=True, port=5174)