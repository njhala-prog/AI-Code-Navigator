const fs = require('fs');
const Code = require('../models/code');
const { generateSummary, answerQuery } = require('../services/openaiservices');
const { fetchRepo, processRepo } = require('../services/githubService');



const uploadRepo = async (req, res) => {
    const { repoUrl } = req.body;

    try {
        if (!repoUrl) {
            return res.status(400).json({ success: false, error: 'Repository URL is required' });
        }

        console.log('Fetching repository into memory:', repoUrl);
        const buffer = await fetchRepo(repoUrl);
        console.log('Downloaded into memory, size:', buffer.length, 'bytes');

        const processedFiles = await processRepo(buffer);
        console.log('Processed files:', processedFiles.length);

        for (const file of processedFiles) {
            const newCode = new Code({
                fileName: file.fileName,
                filePath: file.fileName,
                code: file.code,
                summary: file.summary,
            });
            await newCode.save();
        }

        res.json({
            success: true,
            message: 'Repository processed successfully',
            totalFiles: processedFiles.length,
            files: processedFiles.map(f => ({ fileName: f.fileName, summary: f.summary })),
        });
    } catch (err) {
        console.error('Error in uploadRepo:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};




const processCode = async (req, res) => {
    const { code, fileName, filePath } = req.body;

    try {
        const summary = await generateSummary(code);
        const newCode = new Code({ fileName, filePath, code, summary });
        await newCode.save();
        res.json({ summary });
    } catch (err) {
        console.error("Error in processCode:", err); // Add this line
        res.status(500).json({ error: err.message || "Something went wrong!" });
    }
};

const searchCode = async (req, res) => {
    const { query } = req.body;

    try {
        // Fetch all code documents from MongoDB
        const codes = await Code.find({});
        console.log('Fetched code documents:', codes); // Debugging: Log the number of files

        // Use summaries instead of full code to stay within token limits
        const codeContext = codes.map((c) => `File: ${c.fileName}\nSummary:\n${c.summary}`).join('\n\n');
        console.log('Code context:', codeContext); // Debugging: Log the first 100 characters of the context

        // Use OpenAI to answer the query based on the entire codebase
        const answer = await answerQuery(`Codebase:\n${codeContext}\n\nQuestion: ${query}`);
        console.log('Answer generated:', answer); // Debugging: Log the answer

        res.json({ answer });
    } catch (err) {
        console.error('Error in searchCode:', err); // Debugging: Log the full error
        res.status(500).json({ error: err.message });
    }
};


const uploadCode = async (req, res) => {
    const files = req.files; // Array of uploaded files

    try {
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const summaries = [];

        // Process each file
        for (const file of files) {
            console.log('Processing file:', file.originalname); // Debugging: Log the file name

            // Read the uploaded file
            const code = fs.readFileSync(file.path, 'utf8');
            console.log('Code read successfully:', code.substring(0, 50) + '...'); // Debugging: Log the first 50 characters of the code

            // Generate a summary for the file
            const summary = await generateSummary(code);
            console.log('Summary generated:', summary); // Debugging: Log the summary

            // Save the file and summary to MongoDB
            const newCode = new Code({
                fileName: file.originalname,
                filePath: file.path,
                code,
                summary,
            });
            await newCode.save();
            console.log('Code saved to MongoDB:', file.originalname); // Debugging: Log successful save

            // Delete the uploaded file after processing
            fs.unlinkSync(file.path);
            console.log('File deleted:', file.path); // Debugging: Log file deletion

            summaries.push({ fileName: file.originalname, summary });
        }

        res.json({ summaries });
    } catch (err) {
        console.error('Error in uploadCode:', err); // Debugging: Log the full error
        res.status(500).json({ error: err.message });
    }
};

module.exports = { processCode, searchCode, uploadCode, uploadRepo };