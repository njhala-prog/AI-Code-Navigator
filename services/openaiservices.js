const { OpenAI } = require('openai');

let openai = null;
function getClient() {
    if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openai;
}

const MAX_INPUT_CHARS = 12000;

const generateSummary = async (code) => {
    const safeCode = code.length > MAX_INPUT_CHARS
        ? code.slice(0, MAX_INPUT_CHARS) + '\n\n[truncated...]'
        : code;
    const response = await getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: 'You are a helpful code assistant.' },
            { role: 'user', content: `Summarize the following code:\n${safeCode}` },
        ],
        max_tokens: 500,
    });
    return response.choices[0].message.content;
};

const answerQuery = async (query) => {
    const response = await getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: 'You are a helpful code assistant.' },
            { role: 'user', content: `Answer the following question about the codebase:\n${query}` },
        ],
        max_tokens: 10000,
    });
    return response.choices[0].message.content;
};

const generateEmbedding = async (text) => {
    const response = await getClient().embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
    });
    return response.data[0].embedding;
};

module.exports = { generateSummary, answerQuery, generateEmbedding };