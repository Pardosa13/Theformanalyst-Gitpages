const express = require('express');
const multer = require('multer');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();
// Use the port provided by Railway, or 3000 for local development
const PORT = process.env.PORT || 3000;

// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure the upload directory exists
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Limit files to 10MB
}).single('csvFile');

// Middleware to serve static files
app.use(express.static(__dirname));

// --- Endpoint for JavaScript Analysis ---
// This is a simple server-side JS analysis (simulated)
app.post('/analyze/js', upload, (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const filePath = req.file.path;
    const originalFileName = req.file.originalname;

    try {
        // --- YOUR NODE.JS / JAVASCRIPT ANALYSIS LOGIC GOES HERE ---
        // For demonstration, we just return metadata.
        const jsResult = {
            fileName: originalFileName,
            sizeKB: (req.file.size / 1024).toFixed(2),
            message: "Node.js Analysis Complete",
            summary: "Analyzed using pure JavaScript logic. File uploaded successfully."
        };
        
        // Clean up the uploaded file
        fs.unlink(filePath, (err) => {
            if (err) console.error("Error deleting file after JS analysis:", err);
        });

        res.json({ success: true, results: jsResult });
        
    } catch (error) {
        console.error("Error during JS analysis:", error);
        res.status(500).json({ success: false, error: 'JS analysis failed.' });
    }
});

// --- Endpoint for Python Analysis ---
app.post('/analyze/python', upload, (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const filePath = req.file.path;

    // Use spawn to execute the Python script
    const pythonProcess = spawn('python3', [path.join(__dirname, 'analyzer.py'), filePath]);
    let pythonOutput = '';
    let pythonError = '';

    // Collect data from standard output (stdout)
    pythonProcess.stdout.on('data', (data) => {
        pythonOutput += data.toString();
    });

    // Collect data from standard error (stderr)
    pythonProcess.stderr.on('data', (data) => {
        pythonError += data.toString();
    });

    // When the Python script exits
    pythonProcess.on('close', (code) => {
        // Clean up the uploaded file immediately
        fs.unlink(filePath, (err) => {
            if (err) console.error("Error deleting file after Python analysis:", err);
        });
        
        if (code !== 0) {
            console.error(`Python script exited with code ${code}. Error: ${pythonError}`);
            return res.status(500).json({ success: false, error: `Python script failed. Output: ${pythonError}` });
        }

        try {
            // Python script should output a JSON string
            const results = JSON.parse(pythonOutput);
            res.json({ success: true, results: results });
        } catch (e) {
            console.error("Failed to parse JSON from Python output:", e);
            console.log("Raw Python Output:", pythonOutput);
            res.status(500).json({ success: false, error: 'Failed to read analysis results from Python.' });
        }
    });

    pythonProcess.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        res.status(500).json({ success: false, error: 'Server failed to execute Python interpreter.' });
    });
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at http://localhost:${PORT}`);
});
