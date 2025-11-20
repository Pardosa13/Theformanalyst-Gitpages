# Use a Node.js base image (includes NPM) as server.js is the entry point
FROM node:18-slim

# 1. Install system dependencies (Python, build tools, and PostgreSQL libraries)
# libpq-dev is ESSENTIAL for compiling psycopg2-binary.
RUN apt-get update && \
    apt-get install -y python3 python3-pip build-essential python3-dev libpq-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Copy package files (Node.js and Python)
COPY package*.json ./
COPY requirements.txt ./

# 2. Install Node.js dependencies (Needed for analyzer.js)
RUN npm install

# 3. Install Python dependencies
# Use --break-system-packages flag to bypass the PEP 668 "externally-managed-environment" error
RUN python3 -m pip install --upgrade pip --break-system-packages && \
    pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Copy remaining application files
COPY *.py ./
COPY *.js ./
COPY *.html ./
COPY *.md ./

# Expose the port (Gunicorn default port)
EXPOSE 8000 

# Set the entrypoint to run the Python Gunicorn server
# Assumes the Flask application instance is named 'app' inside 'app.py'
CMD ["gunicorn", "--bind", "0.0.0.0:$PORT", "app:app"]
