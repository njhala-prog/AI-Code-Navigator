const fs = require('fs');
const crypto = require('crypto');
const Code = require('../models/code');
const { generateSummary, answerQuery, generateEmbedding } = require('../services/openaiservices');
const { fetchRepo, processRepo } = require('../services/githubService');

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');



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

        let saved = 0;
        let skipped = 0;

        for (const file of processedFiles) {
            const hash = hashCode(file.code);
            const exists = await Code.exists({ contentHash: hash });
            if (exists) {
                skipped++;
                continue;
            }
            const embedding = await generateEmbedding(file.summary);
            const newCode = new Code({
                fileName: file.fileName,
                filePath: file.fileName,
                code: file.code,
                summary: file.summary,
                embedding,
                contentHash: hash,
            });
            await newCode.save();
            saved++;
        }

        res.json({
            success: true,
            message: `Repository processed. ${saved} files saved, ${skipped} duplicates skipped.`,
            totalFiles: processedFiles.length,
            saved,
            skipped,
        });
    } catch (err) {
        console.error('Error in uploadRepo:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};




const processCode = async (req, res) => {
    const { code, fileName, filePath } = req.body;

    try {
        const hash = hashCode(code);
        const existing = await Code.findOne({ contentHash: hash });
        if (existing) {
            return res.json({ summary: existing.summary, duplicate: true });
        }

        const summary = await generateSummary(code);
        const embedding = await generateEmbedding(summary);
        const newCode = new Code({ fileName, filePath, code, summary, embedding, contentHash: hash });
        await newCode.save();
        res.json({ summary, duplicate: false });
    } catch (err) {
        console.error("Error in processCode:", err);
        res.status(500).json({ error: err.message || "Something went wrong!" });
    }
};

const searchCode = async (req, res) => {
    const { query } = req.body;

    try {
        const queryEmbedding = await generateEmbedding(query);

        const results = await Code.aggregate([
            {
                $vectorSearch: {
                    index: 'vector_index',
                    path: 'embedding',
                    queryVector: queryEmbedding,
                    numCandidates: 50,
                    limit: 5,
                },
            },
            {
                $project: { fileName: 1, code: 1, summary: 1, _id: 0 },
            },
        ]);

        if (results.length === 0) {
            return res.json({ answer: 'No relevant files found for your query.' });
        }

        const codeContext = results
            .map((c) => `File: ${c.fileName}\nCode:\n${c.code}`)
            .join('\n\n---\n\n');

        const answer = await answerQuery(`Codebase:\n${codeContext}\n\nQuestion: ${query}`);
        console.log('Answer generated:', answer);

        res.json({ answer, relevantFiles: results.map((r) => r.fileName) });
    } catch (err) {
        console.error('Error in searchCode:', err);
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
            console.log('Processing file:', file.originalname);

            const code = fs.readFileSync(file.path, 'utf8');
            fs.unlinkSync(file.path);

            const hash = hashCode(code);
            const existing = await Code.findOne({ contentHash: hash });
            if (existing) {
                console.log('Duplicate skipped:', file.originalname);
                summaries.push({ fileName: file.originalname, summary: existing.summary, duplicate: true });
                continue;
            }

            const summary = await generateSummary(code);
            console.log('Summary generated:', summary);
            const embedding = await generateEmbedding(summary);

            const newCode = new Code({
                fileName: file.originalname,
                filePath: file.path,
                code,
                summary,
                embedding,
                contentHash: hash,
            });
            await newCode.save();
            console.log('Code saved to MongoDB:', file.originalname);

            summaries.push({ fileName: file.originalname, summary, duplicate: false });
        }

        res.json({ summaries });
    } catch (err) {
        console.error('Error in uploadCode:', err); // Debugging: Log the full error
        res.status(500).json({ error: err.message });
    }
};

module.exports = { processCode, searchCode, uploadCode, uploadRepo };