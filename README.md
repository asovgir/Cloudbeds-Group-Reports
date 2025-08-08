# Cloudbeds Allotment Report

A desktop application for generating group allotment reports from the Cloudbeds API.

## 🚀 Quick Start for Users

### Download and Run
1. **Download** `CloudbedsReport.exe` 
2. **Double-click** to run the application
3. **Enter your API credentials** when prompted:
   - API Key (starts with "cbat_")
   - Cloudbeds Property ID
4. **Generate reports** using the dashboard

That's it! No installation or technical setup required.

## 🔑 Getting Your API Key 
Instructions on [how to find your API credentials](https://developers.cloudbeds.com/docs/quickstart-guide-api-authentication-for-property-level-users)


## 📊 Using the Application

### First Time Setup
- The app will open your web browser automatically
- Enter your API key and Property ID in the settings
- Click "Test API Connection" to verify
- Click "Save Settings"

### Generating Reports
- Select your desired date range
- Click "Generate Report"
- View group allotment data organized by groups
- Click on group headers to expand details
- Export data as needed

## 💡 Features

- **Simple Setup** - Just API key and Property ID required
- **Local Data** - All settings saved locally on your computer
- **Real-time Data** - Connects directly to Cloudbeds API
- **Group Organization** - Reports organized by reservation groups
- **Pickup Tracking** - Visual pickup percentage indicators
- **Revenue Forecasting** - Total forecasted revenue calculations
- **Export Ready** - Data can be exported for further analysis

## 🔧 System Requirements

- **Windows 7 or later**
- **Internet connection** (for API calls to Cloudbeds)
- **Modern web browser** (Chrome, Firefox, Edge, Safari)

## 🛠️ Troubleshooting

### API Connection Issues
- Verify your API key is correct (starts with "cbat_")
- Check your Property ID matches your Cloudbeds account
- Ensure your API key has proper permissions for allotment data
- Confirm internet connection is working

### Application Issues
- **Antivirus blocking**: Some antivirus software may flag the .exe - add it to exceptions
- **Windows SmartScreen**: Click "More info" → "Run anyway" if prompted
- **Port already in use**: Close other applications that might use port 5000

### No Data Showing
- Check your date range includes periods with group bookings
- Verify your property has the Groups module enabled in Cloudbeds
- Ensure allotment blocks exist for the selected date range

## 📞 Support

For technical support or questions about the application, please contact [Your Support Information].

For Cloudbeds API questions, visit the [Cloudbeds Developer Documentation](https://developers.cloudbeds.com/).

---

## 🔨 For Developers

If you want to modify or build the application yourself:

### Development Setup
```bash
git clone [repository]
cd cloudbeds-report
python -m venv venv
source venv/Scripts/activate  # Windows Git Bash
pip install -r requirements.txt
python main.py
```

### Building the Executable
```bash
python build_exe.py
```

The .exe will be created in the `dist/` folder.

### Project Structure
```
├── main.py                 # Main Flask application
├── templates/
│   ├── index.html         # Dashboard interface
│   └── api_settings.html  # API configuration
├── build_exe.py           # Build script for .exe
├── requirements.txt       # Python dependencies
└── .gitignore            # Git ignore file
```