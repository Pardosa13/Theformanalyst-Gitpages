# Use a Node.js base image (includes NPM)
FROM node:18-slim

# Install system dependencies (Python, build tools, and PostgreSQL libraries)
RUN apt-get update && \
    apt-get install -y python3 python3-pip build-essential python3-dev libpq-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files (Node.js and Python)
COPY package*.json ./
COPY requirements.txt ./

# Install Node.js dependencies
RUN npm install

# Install Python dependencies
RUN python3 -m pip install --upgrade pip --break-system-packages && \
    pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Copy remaining application files
COPY *.py ./
COPY *.js ./
COPY *.html ./
COPY *.md ./

# Expose the port (Standard for Node.js)
EXPOSE 3000 

# This CMD line forces the server start and eliminates the need for the problematic Procfile.
CMD ["node", "server.js"]
