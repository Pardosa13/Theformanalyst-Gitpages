const express = require('express');
const multer = require('multer');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Set up storage for uploaded files
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } 
}).single('csvFile');

// Middleware
app.use(express.static(__dirname));
app.use(express.json());

// --- Unified Analysis Endpoint ---
app.post('/analyze', (req, res) => {
    // 1. Handle file upload and body parameters
    upload(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(500).json({ success: false, error: `Unknown upload error: ${err.message}` });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No CSV file uploaded.' });
        }

        const trackCondition = req.body.trackCondition || 'good';
        const userId = req.body.userId || 'anonymous_user';
        const isAdvanced = req.body.isAdvanced === 'true';

        const filePath = req.file.path;

        // 2. Prepare data for the Python Orchestrator
        const pythonInput = {
            file_path: filePath,
            track_condition: trackCondition,
            user_id: userId,
            is_advanced: isAdvanced
        };

        const analyzerPath = path.join(__dirname, 'analyzer.py');

        // 3. Execute the Python script
        const pythonProcess = spawn('python3', [analyzerPath], {
             // Pass input data to Python's stdin
             stdio: ['pipe', 'pipe', 'pipe'] 
        });

        let pythonOutput = '';
        let pythonError = '';

        // Write input data to Python's stdin
        pythonProcess.stdin.write(JSON.stringify(pythonInput));
        pythonProcess.stdin.end();

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
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) console.error("Error deleting file after analysis:", unlinkErr);
            });
            
            if (code !== 0) {
                console.error(`Python script exited with code ${code}. Error: ${pythonError}`);
                let errorDetails = pythonError.trim() || 'No specific error output.';
                try {
                    errorDetails = JSON.parse(pythonError).error; 
                } catch (e) {
                    // Fallback to raw output
                }
                return res.status(500).json({ 
                    success: false, 
                    error: `Analysis Orchestrator failed.`, 
                    details: errorDetails
                });
            }

            try {
                // Python script should output the final JSON string
                const results = JSON.parse(pythonOutput);
                res.json({ success: true, results: results.results, meeting_id: results.meeting_id });
            } catch (e) {
                console.error("Failed to parse JSON from Python orchestrator output:", e);
                console.log("Raw Python Output:", pythonOutput);
                res.status(500).json({ success: false, error: 'Failed to read final analysis results from Python.' });
            }
        });

        pythonProcess.on('error', (err) => {
            console.error('Failed to start Python process:', err);
            res.status(500).json({ success: false, error: 'Server failed to execute Python interpreter.' });
        });
    });
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
