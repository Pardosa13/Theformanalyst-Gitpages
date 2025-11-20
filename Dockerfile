# Use a Node.js base image (includes NPM) as server.js is the entry point
FROM node:18-slim

# 1. Install system dependencies (Python, build tools, and PostgreSQL libraries)
# libpq-dev is ESSENTIAL for compiling psycopg2-binary, which links against C libraries.
# python3-dev is essential for compiling packages like pandas.
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
RUN python3 -m pip install --upgrade pip && \
    pip3 install --no-cache-dir -r requirements.txt

# Copy remaining application files (using wildcards is simpler)
COPY *.py ./
COPY *.js ./
COPY *.html ./
COPY *.md ./

# Expose the port
EXPOSE 8000 

# Set the entrypoint to run the Python Gunicorn server
# We assume your main Flask application instance is named 'app' inside 'app.py'
CMD ["gunicorn", "--bind", "0.0.0.0:$PORT", "app:app"]
