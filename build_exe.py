#!/usr/bin/env python3
"""
Build script for creating Cloudbeds Report .exe file
Run this to create a distributable .exe application
"""

import PyInstaller.__main__
import os
import sys
import shutil
from pathlib import Path

def clean_build():
    """Clean previous build files"""
    dirs_to_clean = ['build', 'dist', '__pycache__']
    for dir_name in dirs_to_clean:
        if os.path.exists(dir_name):
            shutil.rmtree(dir_name)
            print(f"🧹 Cleaned {dir_name}/")

def build_exe():
    """Build the .exe file using PyInstaller"""
    print("🔨 Building Cloudbeds Report .exe...")
    
    # Clean previous builds
    clean_build()
    
    # PyInstaller arguments
    args = [
        'main.py',                          # Main script
        '--onefile',                        # Single .exe file
        '--noconsole',                      # No console window
        '--name=CloudbedsReport',           # .exe name
        '--add-data=templates;templates',   # Include templates folder
        '--hidden-import=yaml',             # Make sure yaml is included
        '--hidden-import=requests',         # Make sure requests is included
        '--hidden-import=flask',            # Make sure flask is included
        '--hidden-import=werkzeug',         # Include werkzeug
        '--hidden-import=jinja2',           # Include jinja2
        '--distpath=dist',                  # Output directory
        '--workpath=build',                 # Build directory
        '--specpath=.',                     # Spec file location
        '--clean',                          # Clean cache
    ]
    
    # Add icon if it exists
    if os.path.exists('icon.ico'):
        args.append('--icon=icon.ico')
    else:
        print("ℹ️  No icon.ico found, building without custom icon")
    
    # Add static folder if it exists
    if os.path.exists('static'):
        args.append('--add-data=static;static')
    else:
        print("ℹ️  No static folder found, skipping")
    
    try:
        # Run PyInstaller
        print("🔄 Running PyInstaller...")
        PyInstaller.__main__.run(args)
        
        print("\n✅ Build completed successfully!")
        print(f"📁 .exe file location: {os.path.abspath('dist/CloudbedsReport.exe')}")
        print("\n📋 Distribution contents:")
        
        # List dist contents
        dist_path = Path('dist')
        if dist_path.exists():
            for item in dist_path.iterdir():
                size = item.stat().st_size / (1024*1024)  # Size in MB
                print(f"   📄 {item.name} ({size:.1f} MB)")
        
        print("\n🚀 Your app is ready to distribute!")
        print("   Users just need to run CloudbedsReport.exe")
        
    except Exception as e:
        print(f"\n❌ Build failed: {e}")
        return False
    
    return True

def create_installer_info():
    """Create a simple README for distribution"""
    readme_content = """# Cloudbeds Allotment Report

## Installation
1. Download CloudbedsReport.exe
2. Run the .exe file
3. On first run, enter your Cloudbeds API key in the settings

## Getting Your API Key
1. Log in to Cloudbeds
2. Go to Apps & Marketplace -> API Credentials
3. Copy your API Key (starts with "cbat_")
4. Enter it in the app settings

## Usage
- The app will open in your web browser
- Navigate to generate reports and view allotment data
- All data is stored locally on your computer

## System Requirements
- Windows 7 or later
- Internet connection for API calls
- No additional software required

## Support
Contact: [Your Email/Support Info]
"""
    
    try:
        with open('dist/README.txt', 'w', encoding='utf-8') as f:
            f.write(readme_content)
        print("📄 Created README.txt for distribution")
    except Exception as e:
        print(f"⚠️  Could not create README.txt: {e}")
        print("   (This doesn't affect your .exe file)")

if __name__ == '__main__':
    print("🏨 Cloudbeds Report - Build Script")
    print("=" * 40)
    
    # Check if required files exist
    if not os.path.exists('main.py'):
        print("❌ main.py not found!")
        sys.exit(1)
    
    if not os.path.exists('templates'):
        print("❌ templates/ folder not found!")
        sys.exit(1)
    
    # Check if PyInstaller is installed
    try:
        import PyInstaller
    except ImportError:
        print("❌ PyInstaller not installed!")
        print("   Install with: pip install pyinstaller")
        sys.exit(1)
    
    # Build the .exe
    if build_exe():
        create_installer_info()
        print("\n🎉 Build process complete!")
    else:
        print("\n💥 Build failed!")
        sys.exit(1)