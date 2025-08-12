#!/usr/bin/env python3

import os
import json
import requests
import webbrowser
import threading
import time
import sys
from datetime import datetime, timedelta
from pathlib import Path
from flask import Flask, render_template, request, jsonify, redirect, url_for

# Handle PyInstaller bundle paths
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    application_path = sys._MEIPASS
else:
    # Running as script
    application_path = os.path.dirname(os.path.abspath(__file__))

# Set up paths for templates and static files
template_dir = os.path.join(application_path, 'templates')
static_dir = os.path.join(application_path, 'static')

# Flask app configuration with correct paths
app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
app.config['SECRET_KEY'] = 'cloudbeds-report-desktop-app-secret'

# Configuration file handling (using JSON instead of YAML)
CONFIG_FILE = Path.home() / '.cloudbeds_report_config.json'

def load_config():
    """Load configuration from JSON file"""
    try:
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f) or {}
    except Exception as e:
        print(f"Warning: Could not load configuration: {e}")
    return {}

def save_config(config):
    """Save configuration to JSON file"""
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        print(f"✅ Configuration saved to: {CONFIG_FILE}")
    except Exception as e:
        print(f"Warning: Could not save configuration: {e}")

def get_credentials():
    """Get API credentials from config"""
    config = load_config()
    return {
        'api_key': config.get('api_key'),
        'property_id': config.get('property_id', '6000')
    }

# API URLs
ALLOTMENT_BLOCKS_URL = "https://api.cloudbeds.com/api/v1.3/getAllotmentBlocks"
RESERVATIONS_URL = "https://api.cloudbeds.com/api/v1.3/getReservations"
RESERVATION_DETAIL_URL = "https://api.cloudbeds.com/api/v1.3/getReservation"

def make_api_call(url, params, credentials):
    """Make API call to Cloudbeds using API Key authentication"""
    headers = {
        "x-api-key": credentials['api_key'],
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        print(f"🔗 API call to {url} - Status: {response.status_code}")
        
        if response.status_code == 200:
            return {'success': True, 'data': response.json()}
        elif response.status_code == 401:
            return {'success': False, 'error': "Authentication failed. Please check your API key."}
        elif response.status_code == 403:
            return {'success': False, 'error': "Access forbidden. Please check your API permissions."}
        elif response.status_code == 429:
            return {'success': False, 'error': "Rate limit exceeded. Please try again in a few minutes."}
        else:
            try:
                error_data = response.json()
                error_msg = error_data.get('message', response.text)
            except:
                error_msg = response.text
            return {'success': False, 'error': f"API Error: {response.status_code} - {error_msg}"}
    except requests.exceptions.Timeout:
        return {'success': False, 'error': "Request timed out. Please check your internet connection."}
    except requests.exceptions.ConnectionError:
        return {'success': False, 'error': "Connection error. Please check your internet connection."}
    except Exception as e:
        return {'success': False, 'error': f"Connection error: {str(e)}"}

def process_allotment_block(block):
    """Process a single allotment block"""
    try:
        print(f"Processing allotment block: {block.get('allotmentBlockId')} - {block.get('allotmentBlockName')}")
        
        block_data = {
            'id': block.get('allotmentBlockId'),
            'code': block.get('allotmentBlockCode'),
            'name': block.get('allotmentBlockName', 'Unknown Allotment'),
            'status': block.get('allotmentBlockStatus'),
            'dates_data': [],
            'forecasted_revenue': 0
        }
        
        # Safely handle allotmentIntervals
        allotment_intervals = block.get('allotmentIntervals')
        if not allotment_intervals or not isinstance(allotment_intervals, list):
            print(f"  No allotment intervals found for block {block_data['id']}")
            return block_data
        
        dates_rooms = {}
        
        for interval in allotment_intervals:
            if not isinstance(interval, dict):
                print(f"  Skipping invalid interval: {type(interval)}")
                continue
                
            for room_type_id, room_data in interval.items():
                if not room_data or not isinstance(room_data, dict):
                    continue
                    
                availability = room_data.get('availability')
                if not availability or not isinstance(availability, dict):
                    continue
                    
                for date, date_data in availability.items():
                    if not date_data or not isinstance(date_data, dict):
                        continue
                        
                    block_allotted = date_data.get('blockAllotted')
                    if not block_allotted:
                        continue
                        
                    try:
                        block_allotted = int(block_allotted)
                        block_remaining = int(date_data.get('blockRemaining', 0))
                        
                        if date_data.get('blockConfirmed') is not None:
                            block_confirmed = int(date_data['blockConfirmed'])
                        else:
                            block_confirmed = block_allotted - block_remaining
                        
                        pickup_percentage = round((block_confirmed / block_allotted * 100), 1) if block_allotted > 0 else 0
                        
                        rate = float(date_data.get('rate', 0))
                        room_revenue = block_allotted * rate
                        block_data['forecasted_revenue'] += room_revenue
                        
                        if date not in dates_rooms:
                            dates_rooms[date] = []
                        
                        dates_rooms[date].append({
                            'room_type_id': room_type_id,
                            'block_allotted': block_allotted,
                            'block_confirmed': block_confirmed,
                            'block_remaining': block_remaining,
                            'pickup_percentage': pickup_percentage,
                            'rate': rate
                        })
                        
                    except (ValueError, TypeError) as e:
                        print(f"  Error processing date {date} for room {room_type_id}: {e}")
                        continue
        
        # Sort dates and create final data structure
        for date in sorted(dates_rooms.keys()):
            block_data['dates_data'].append({
                'date': date,
                'room_types': sorted(dates_rooms[date], key=lambda x: x['room_type_id'])
            })
        
        print(f"  Processed {len(block_data['dates_data'])} dates")
        return block_data
        
    except Exception as e:
        print(f"ERROR processing allotment block {block.get('allotmentBlockId', 'unknown')}: {e}")
        # Return a minimal block structure to prevent complete failure
        return {
            'id': block.get('allotmentBlockId', 'unknown'),
            'code': block.get('allotmentBlockCode', 'unknown'),
            'name': block.get('allotmentBlockName', 'Unknown Allotment'),
            'status': block.get('allotmentBlockStatus', 'unknown'),
            'dates_data': [],
            'forecasted_revenue': 0
        }

def generate_group_allotment_report(allotment_blocks, start_date, end_date):
    """Generate the complete report data structure"""
    print("🔄 Processing group allotment report...")
    
    groups = {}
    
    for block in allotment_blocks:
        group_name = block.get('groupName') or block.get('groupCode') or "Unknown Group"
        group_code = block.get('groupCode') or block.get('groupName') or "Unknown Code"
        
        # Create a unique key for grouping
        group_key = f"{group_name}_{group_code}"
        
        if group_key not in groups:
            groups[group_key] = {
                'code': group_code,
                'name': group_name,
                'display_name': f"{group_name} ({group_code})",  # NEW: Combined display name
                'allotment_blocks': [],
                'total_blocks': 0,
                'total_forecasted_revenue': 0
            }
        
        block_data = process_allotment_block(block)
        
        groups[group_key]['allotment_blocks'].append(block_data)
        groups[group_key]['total_blocks'] += 1
        groups[group_key]['total_forecasted_revenue'] += block_data['forecasted_revenue']
    
    groups_array = sorted(groups.values(), key=lambda x: x['name'])
    
    return {
        'date_range': {
            'start_date': start_date,
            'end_date': end_date
        },
        'summary': {
            'total_groups': len(groups_array),
            'total_allotment_blocks': sum(g['total_blocks'] for g in groups_array),
            'total_forecasted_revenue': sum(g['total_forecasted_revenue'] for g in groups_array)
        },
        'groups': groups_array
    }

# Routes
@app.route('/')
def index():
    """Main page - check for credentials first"""
    credentials = get_credentials()
    
    if not credentials['api_key'] or not credentials['api_key'].strip():
        return redirect(url_for('settings', first_time='true'))
    
    return render_template('index.html')

@app.route('/settings')
def settings():
    """Settings page for API credentials"""
    config = load_config()
    first_time = request.args.get('first_time', False)
    return render_template('api_settings.html', config=config, first_time=first_time)

@app.route('/settings', methods=['POST'])
def save_settings():
    """Save API credentials"""
    config = {
        'api_key': request.form.get('api_key', '').strip(),
        'property_id': request.form.get('property_id', '6000').strip()
    }
    
    save_config(config)
    return redirect(url_for('index'))

@app.route('/api/test-connection')
def test_connection():
    """ENHANCED: Test API connection with better error handling"""
    print("🧪 Testing API connection...")
    
    # Get current form data if available, otherwise use saved config
    form_api_key = request.args.get('api_key')
    form_property_id = request.args.get('property_id')
    
    if form_api_key and form_property_id:
        # Use form data for testing (before saving)
        credentials = {
            'api_key': form_api_key.strip(),
            'property_id': form_property_id.strip()
        }
        print("🔧 Using form data for test")
    else:
        # Use saved credentials
        credentials = get_credentials()
        print("🔧 Using saved credentials for test")
    
    # Validate credentials
    if not credentials['api_key'] or not credentials['api_key'].strip():
        return jsonify({
            'success': False, 
            'error': 'Please configure your API credentials first.'
        })
    
    if not credentials['property_id'] or not credentials['property_id'].strip():
        return jsonify({
            'success': False, 
            'error': 'Please provide a valid Property ID.'
        })
    
    # Test with a broader date range to get more meaningful results
    start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    end_date = (datetime.now() + timedelta(days=60)).strftime('%Y-%m-%d')
    print(f"🔗 Testing API call with date range: {start_date} to {end_date}")
    
    result = make_api_call(ALLOTMENT_BLOCKS_URL, {
        'propertyID': credentials['property_id'],
        'startDate': start_date,
        'endDate': end_date
    }, credentials)
    
    if result['success']:
        # Additional validation - check if response structure is as expected
        try:
            response_data = result['data']
            if isinstance(response_data, dict) and 'data' in response_data:
                blocks_count = len(response_data.get('data', []))
                print(f"✅ API test successful - found {blocks_count} allotment blocks")
                
                # More informative success message
                if blocks_count > 0:
                    message = f'Connection successful! Found {blocks_count} allotment blocks in your property.'
                else:
                    message = 'Connection successful! No allotment blocks found in the test period, but API access is working.'
                
                return jsonify({
                    'success': True, 
                    'message': message,
                    'details': {
                        'property_id': credentials['property_id'],
                        'blocks_found': blocks_count,
                        'date_range': f'{start_date} to {end_date}'
                    }
                })
            else:
                return jsonify({
                    'success': False, 
                    'error': 'API connection successful but received unexpected response format.'
                })
        except Exception as e:
            print(f"⚠️ API response validation error: {e}")
            return jsonify({
                'success': False, 
                'error': f'API connection successful but response validation failed: {str(e)}'
            })
    else:
        print(f"❌ API test failed: {result['error']}")
        return jsonify({
            'success': False, 
            'error': result['error']
        })

@app.route('/api/group-allotment-report')
def group_allotment_report():
    """Main API endpoint for fetching allotment report"""
    credentials = get_credentials()
    
    if not credentials['api_key']:
        return jsonify({'success': False, 'error': 'API credentials not configured. Please check settings.'})
    
    start_date = request.args.get('start_date', '2025-01-01')
    end_date = request.args.get('end_date', '2025-12-31')
    
    print(f"🚀 Fetching group allotment report for {start_date} to {end_date}")
    
    # Fetch allotment blocks
    print("📦 Fetching allotment blocks...")
    allotment_response = make_api_call(ALLOTMENT_BLOCKS_URL, {
        'propertyID': credentials['property_id'],
        'startDate': start_date,
        'endDate': end_date
    }, credentials)
    
    if not allotment_response['success']:
        return jsonify({'success': False, 'error': f"Failed to fetch allotment blocks: {allotment_response['error']}"})
    
    allotment_blocks = allotment_response['data'].get('data', [])
    print(f"Found {len(allotment_blocks)} allotment blocks")
    
    # Process and group the data
    report_data = generate_group_allotment_report(allotment_blocks, start_date, end_date)
    
    print(f"✅ Generated report with {len(report_data['groups'])} groups")
    
    return jsonify({'success': True, 'data': report_data})

@app.route('/api/reservations')
def reservations():
    """API endpoint for fetching reservations for a specific allotment block"""
    credentials = get_credentials()
    allotment_block_code = request.args.get('allotmentBlockCode')
    
    if not allotment_block_code:
        return jsonify({'success': False, 'error': 'allotmentBlockCode parameter is required'})
    
    print(f"🚀 Fetching reservations for allotment block: {allotment_block_code}")
    
    # Get reservations for a date range
    start_date = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
    end_date = (datetime.now() + timedelta(days=90)).strftime('%Y-%m-%d')
    
    reservations_response = make_api_call(RESERVATIONS_URL, {
        'propertyID': credentials['property_id'],
        'checkInFrom': start_date,
        'checkInTo': end_date,
        'includeGuestsDetails': 'true'
    }, credentials)
    
    if not reservations_response['success']:
        return jsonify({'success': False, 'error': f"Failed to fetch reservations: {reservations_response['error']}"})
    
    all_reservations = reservations_response['data'].get('data', [])
    print(f"Found {len(all_reservations)} total reservations in date range")
    
    # Filter reservations that match the allotment block code
    filtered_reservations = [
        res for res in all_reservations 
        if res.get('allotmentBlockCode') == allotment_block_code
    ]
    
    print(f"Found {len(filtered_reservations)} reservations for allotment block {allotment_block_code}")
    
    # Fetch detailed information for each reservation
    detailed_reservations = []
    for reservation in filtered_reservations:
        reservation_id = reservation.get('reservationID')
        if reservation_id:
            print(f"Fetching details for reservation: {reservation_id}")
            
            detail_response = make_api_call(RESERVATION_DETAIL_URL, {
                'propertyID': credentials['property_id'],
                'reservationID': reservation_id
            }, credentials)
            
            if detail_response['success']:
                detailed_data = detail_response['data'].get('data', {})
                # Merge the detailed data with the basic reservation data
                merged_reservation = {**reservation, **detailed_data}
                detailed_reservations.append(merged_reservation)
            else:
                print(f"Failed to fetch details for reservation {reservation_id}: {detail_response['error']}")
                detailed_reservations.append(reservation)
        else:
            detailed_reservations.append(reservation)
    
    return jsonify({'success': True, 'data': detailed_reservations})

@app.route('/shutdown', methods=['POST'])
def shutdown():
    """Shutdown endpoint for desktop app"""
    print("🛑 Shutting down application...")
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        # For newer versions of Werkzeug
        os._exit(0)
    func()
    return 'Server shutting down...'

def open_browser():
    """Open browser after a short delay"""
    time.sleep(2)
    webbrowser.open('http://localhost:5000')

def find_free_port():
    """Find a free port starting from 5000"""
    import socket
    for port in range(5000, 5100):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    return 5000  # fallback

if __name__ == '__main__':
    print("\n🏨 Cloudbeds Allotment Report - Desktop App")
    print("=" * 50)
    
    # Debug: Print paths when running as executable
    if getattr(sys, 'frozen', False):
        print(f"📁 Template directory: {template_dir}")
        print(f"📁 Static directory: {static_dir}")
        print(f"📁 Application path: {application_path}")
    
    # Find an available port
    port = find_free_port()
    
    print(f"📊 Starting server on http://localhost:{port}")
    print("🌐 Opening browser automatically...")
    print("❌ Close this window to stop the application\n")
    
    # Auto-open browser in a separate thread
    threading.Thread(target=open_browser, daemon=True).start()
    
    try:
        # Start the Flask server
        app.run(host='127.0.0.1', port=port, debug=False)
    except KeyboardInterrupt:
        print("\n🛑 Application stopped by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error starting application: {e}")
        input("Press Enter to close...")
        sys.exit(1)