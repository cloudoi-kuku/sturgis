#!/bin/bash

# Azure App Service startup script
# This file tells Azure how to start your Python app

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI app with gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 main:app