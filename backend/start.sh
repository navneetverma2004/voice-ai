#!/usr/bin/env bash

echo "Starting FastAPI server on Render..."

uvicorn server:app \
  --host 0.0.0.0 \
  --port $PORT
