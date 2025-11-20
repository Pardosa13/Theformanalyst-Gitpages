const express = require('express');
const multer = require('multer');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();
// CRITICAL: Railway provides the PORT. Default to 3000 for local.
const PORT = process.env.PORT || 3000;

// --- 1. Setup Uploads Directory ---
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    try {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        console.log(`Created upload directory at ${UPLOAD_DIR}`);
    } catch (err) {
        console.error(`Failed to create upload directory: ${err.message}`);
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, UPLOAD_DIR); },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

// --- 2. Static Files & Middleware ---
app.use(express.json());
// Serve all files in the root directory (css, js, html)
app.use(express.static(__dirname));

// --- 3. Root Route (Safe Version) ---
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        // Fallback if index.html is missing (Prevents 502 Crash)
        console.warn("index.html is missing!");
        res.status(200).send(`
            <h1>Server is Running!</h1>
            <p>However, <code>index.html</code> was not found in the root directory.</p>
            <p>Please ensure you have uploaded an index.html file.</p>
        `);
    }
});

// --- 4. Health Check (Good for Debugging) ---
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// --- 5. Analyze Endpoint ---
app.post('/analyze', upload.single('csvFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'No CSV file uploaded.' });

    const { trackCondition, userId, isAdvanced } = req.body;
    const filePath = req.file.path;
    const analyzerPath = path.join(__dirname, 'analyzer.py');

    console.log(`Analyzing file: ${filePath}`);

    // CRITICAL: Use absolute path to python3
    const pythonProcess = spawn('/usr/bin/python3', [analyzerPath], {
         stdio: ['pipe', 'pipe', 'pipe'] 
    });

    let pythonOutput = '';
    let pythonError = '';

    pythonProcess.stdin.write(JSON.stringify({
        file_path: filePath,
        track_condition: trackCondition,
        user_id: userId,
        is_advanced: isAdvanced
    }));
    pythonProcess.stdin.end();

    pythonProcess.stdout.on('data', (data) => { pythonOutput += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { pythonError += data.toString(); });

    pythonProcess.on('close', (code) => {
        // Cleanup file
        fs.unlink(filePath, (e) => { if(e) console.error("Cleanup error:", e); });
        
        if (code !== 0) {
            console.error(`Python Error (Code ${code}): ${pythonError}`);
            return res.status(500).json({ success: false, error: 'Analysis failed.', details: pythonError });
        }

        try {
            const results = JSON.parse(pythonOutput);
            res.json({ success: true, ...results });
        } catch (e) {
            console.error("JSON Parse Error:", e, "Raw Output:", pythonOutput);
            res.status(500).json({ success: false, error: 'Invalid response from analyzer.' });
        }
    });
});

// --- 6. Start Server (Bind to 0.0.0.0) ---
// CRITICAL FIX: Explicitly bind to 0.0.0.0 for Docker compatibility
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Ready to handle requests.`);
});
