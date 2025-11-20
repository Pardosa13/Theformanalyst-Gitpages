# Use a Node.js base image (includes NPM)
FROM node:18-slim

# 1. Install system dependencies (Python, build tools, and PostgreSQL libraries)
# libpq-dev is needed for psycopg2-binary to compile.
RUN apt-get update && \
    apt-get install -y python3 python3-pip build-essential python3-dev libpq-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Copy package files (Node.js and Python)
COPY package*.json ./
COPY requirements.txt ./

# 2. Install Node.js dependencies
RUN npm install

# 3. Install Python dependencies
# Use --break-system-packages to fix the 'externally-managed-environment' error
RUN python3 -m pip install --upgrade pip --break-system-packages && \
    pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Copy remaining application files
COPY *.py ./
COPY *.js ./
COPY *.html ./
COPY *.md ./

# Expose the port (Standard for Node.js)
EXPOSE 3000 

# Use the most direct command to start the server: node server.js
CMD ["node", "server.js"]
