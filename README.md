# Cloudbeds Allotment Report

A Flask web application for generating group allotment reports from the Cloudbeds API.

## 🔄 Recent Changes

**Switched from OAuth to API Key Authentication**
- Simplified authentication using only API keys
- Removed access token requirements
- Better suited for server deployment

## 🚀 Quick Start

### Local Development

1. **Clone and setup**:
   ```bash
   git clone <your-repo>
   cd cloudbeds-report
   pip install -r requirements.txt
   ```

2. **Configure API credentials**:
   ```bash
   cp .env.example .env
   # Edit .env with your Cloudbeds API key
   ```

3. **Run locally**:
   ```bash
   python main.py
   ```
   - Opens automatically at http://localhost:5000
   - Use the settings page to configure API credentials

### Production Deployment

#### Option 1: Environment Variables (Recommended)

Set these environment variables on your hosting platform:

```bash
CLOUDBEDS_API_KEY=cbat_your_actual_api_key
CLOUDBEDS_PROPERTY_ID=6000
SECRET_KEY=your-secure-random-secret-key
PORT=5000
FLASK_ENV=production
```

#### Option 2: Using .env file

1. Create a `.env` file (copy from `.env.example`)
2. Fill in your actual API credentials
3. Deploy the application

## 🔑 Getting Your API Key

1. Log in to your Cloudbeds account
2. Go to **Apps & Marketplace** → **API Credentials**
3. Find your API Key (starts with `cbat_`)
4. Note your Property ID (usually a number like 6000)

## 🌐 Deployment Platforms

### Heroku
```bash
# Set environment variables
heroku config:set CLOUDBEDS_API_KEY=cbat_your_key
heroku config:set CLOUDBEDS_PROPERTY_ID=6000
heroku config:set SECRET_KEY=your-secret-key

# Deploy
git push heroku main
```

### Railway
```bash
# Set environment variables in Railway dashboard
CLOUDBEDS_API_KEY=cbat_your_key
CLOUDBEDS_PROPERTY_ID=6000
SECRET_KEY=your-secret-key
```

### Render/DigitalOcean/AWS
Set the environment variables in your platform's dashboard.

## 📁 Project Structure

```
├── main.py                 # Main Flask application
├── templates/
│   ├── index.html         # Main dashboard
│   └── settings.html      # API configuration (dev only)
├── requirements.txt       # Python dependencies
├── .env.example          # Environment template
├── .gitignore           # Git ignore file
└── README.md           # This file
```

## 🔒 Security Features

- **No hardcoded credentials** - All sensitive data in environment variables
- **Production mode** - Settings page disabled when using environment variables
- **Secure defaults** - Proper Flask security configuration
- **HTTPS ready** - Works with SSL/TLS termination

## 🛠️ Development vs Production

### Development Mode
- Uses local `.cloudbeds_report_config.yml` file
- Settings page available at `/settings`
- Debug mode enabled
- Auto-opens browser

### Production Mode (when `CLOUDBEDS_API_KEY` env var is set)
- Uses environment variables only
- Settings page redirects to main app
- Debug mode disabled
- Binds to `0.0.0.0` for container deployment

## 📊 API Endpoints

- `GET /` - Main dashboard
- `GET /settings` - API configuration (development only)
- `GET /api/test-connection` - Test API connectivity
- `GET /api/group-allotment-report` - Generate reports
- `GET /api/reservations` - Get reservation details

## 🐛 Troubleshooting

### API Key Issues
- Ensure your API key starts with `cbat_`
- Check that the key has proper permissions in Cloudbeds
- Verify your Property ID is correct

### Deployment Issues
- Check that all required environment variables are set
- Ensure your hosting platform supports Python 3.8+
- Check the application logs for specific error messages

### Local Development
- Use `python main.py` for local development
- Check that `requirements.txt` dependencies are installed
- Ensure port 5000 is available

## 📝 License

[Your License Here]