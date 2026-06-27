const fs = require('fs');
const crypto = require('crypto');
const Code = require('../models/code');
const { generateSummary, answerQuery, generateEmbedding } = require('../services/openaiservices');
const { fetchRepo, processRepo } = require('../services/githubService');
const { chunkByAST } = require('../services/astService');

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

// Process and save one file — chunks it via AST for JS/TS, otherwise saves whole file
async function processAndSave(code, fileName, filePath) {
    const fileHash = hashCode(code);

    const exists = await Code.exists({ fileHash });
    if (exists) return { skipped: true };

    const chunks = chunkByAST(code, fileName);

    if (chunks) {
        for (const chunk of chunks) {
            const summary = await generateSummary(chunk.code);
            const embedding = await generateEmbedding(summary);
            await new Code({
                fileName,
                filePath,
                code: chunk.code,
                summary,
                embedding,
                fileHash,
                chunkName: chunk.chunkName,
                chunkType: chunk.chunkType,
            }).save();
        }
        return { saved: chunks.length, chunked: true };
    }

    const summary = await generateSummary(code);
    const embedding = await generateEmbedding(summary);
    await new Code({
        fileName,
        filePath,
        code,
        summary,
        embedding,
        contentHash: fileHash,
        fileHash,
        chunkType: 'file',
    }).save();
    return { saved: 1, chunked: false };
}

const processCode = async (req, res) => {
    const { code, fileName, filePath } = req.body;

    try {
        const result = await processAndSave(code, fileName, filePath || fileName);
        if (result.skipped) {
            return res.json({ success: true, duplicate: true });
        }
        res.json({ success: true, duplicate: false, saved: result.saved, chunked: result.chunked });
    } catch (err) {
        console.error('Error in processCode:', err);
        res.status(500).json({ error: err.message || 'Something went wrong!' });
    }
};

const uploadCode = async (req, res) => {
    const files = req.files;

    try {
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const results = [];

        for (const file of files) {
            console.log('Processing file:', file.originalname);
            const code = fs.readFileSync(file.path, 'utf8');
            fs.unlinkSync(file.path);

            const result = await processAndSave(code, file.originalname, file.path);
            results.push({ fileName: file.originalname, ...result });
        }

        const saved = results.reduce((sum, r) => sum + (r.saved || 0), 0);
        const skipped = results.filter((r) => r.skipped).length;

        res.json({ success: true, files: results, saved, skipped });
    } catch (err) {
        console.error('Error in uploadCode:', err);
        res.status(500).json({ error: err.message });
    }
};

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
            const result = await processAndSave(file.code, file.fileName, file.fileName);
            if (result.skipped) {
                skipped++;
            } else {
                saved += result.saved;
            }
        }

        res.json({
            success: true,
            message: `Repository processed. ${saved} chunks saved, ${skipped} files skipped (duplicates).`,
            totalFiles: processedFiles.length,
            saved,
            skipped,
        });
    } catch (err) {
        console.error('Error in uploadRepo:', err);
        res.status(500).json({ success: false, error: err.message });
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
                $project: { fileName: 1, code: 1, summary: 1, chunkName: 1, chunkType: 1, _id: 0 },
            },
        ]);

        if (results.length === 0) {
            return res.json({ answer: 'No relevant code found for your query.' });
        }

        const codeContext = results
            .map((c) => {
                const label = c.chunkName
                    ? `File: ${c.fileName} | ${c.chunkType}: ${c.chunkName}`
                    : `File: ${c.fileName}`;
                return `${label}\nCode:\n${c.code}`;
            })
            .join('\n\n---\n\n');

        const answer = await answerQuery(`Codebase:\n${codeContext}\n\nQuestion: ${query}`);
        console.log('Answer generated:', answer);

        res.json({
            answer,
            relevantChunks: results.map((r) => ({
                fileName: r.fileName,
                chunkName: r.chunkName || null,
                chunkType: r.chunkType || 'file',
            })),
        });
    } catch (err) {
        console.error('Error in searchCode:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { processCode, searchCode, uploadCode, uploadRepo };
