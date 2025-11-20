# Use a Node.js base image (includes NPM) as server.js is the entry point
FROM node:18-slim

# Install Python and crucial build tools
RUN apt-get update && \
    apt-get install -y python3 python3-pip build-essential python3-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Copy package files (Node.js and Python)
COPY package*.json ./
COPY requirements.txt ./

# Install Node.js dependencies
RUN npm install

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy remaining application files
COPY server.js ./
COPY analyzer.py ./
COPY models.py ./
COPY analyzer.js ./
COPY index.html ./
COPY 404.html ./
COPY 500.html ./
COPY 502.html ./
COPY *.md ./

# Expose the port (Railway automatically maps this to $PORT)
EXPOSE 3000

# Set the entrypoint and command to run the Node.js server via npm start
ENTRYPOINT [ "npm" ]
CMD [ "start" ]
