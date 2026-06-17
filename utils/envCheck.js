const REQUIRED = ['OPENAI_API_KEY', 'MONGO_URI', 'API_KEY'];

module.exports = function checkEnv() {
    const missing = REQUIRED.filter((k) => !process.env[k]);
    if (missing.length) {
        console.error(`[startup] Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }
};
