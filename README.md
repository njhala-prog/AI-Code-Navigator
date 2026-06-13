# AI Code Navigator

A production-ready backend API that lets developers search large codebases using 
natural language. Instead of grepping for exact variable names, you ask questions 
like "where is authentication handled?" and get precise, AI-generated answers 
backed by the actual code.

Built with Node.js, Express, MongoDB Atlas, and the OpenAI API.

---

## How It Works

1. You upload a GitHub repo, individual files, or a code snippet
2. The system parses each file, generates an AI summary, and converts it into 
   a vector embedding
3. Embeddings are stored in MongoDB Atlas with vector search enabled
4. When you search, your query is also converted to an embedding and compared 
   against all stored embeddings to find the most semantically similar code
5. The top results are passed to GPT-4o-mini which generates a grounded answer 
   with file references

---

## Core AI Features

### Retrieval Augmented Generation (RAG)
The search pipeline uses RAG — a technique where relevant documents are 
retrieved first and then passed to an LLM as context, instead of asking the 
LLM to answer from memory.

This solves a fundamental problem: GPT does not know your codebase. RAG gives 
it only the relevant pieces it needs to answer accurately, which prevents 
hallucination and keeps answers grounded in your actual code.

Flow: Query → Embedding → Vector Search → Top K chunks → GPT-4o-mini → Answer

### Vector Embeddings (text-embedding-ada-002)
Every code file and search query is converted into a 1536-dimensional vector 
using OpenAI's text-embedding-ada-002 model. A vector embedding is a list of 
numbers that represents the meaning of text — two pieces of code that do 
similar things will have vectors that are mathematically close to each other, 
even if they use completely different variable names.

This is why searching "authentication logic" finds a function called 
`validateApiKey` — they are semantically similar even though they share no 
keywords.

### MongoDB Atlas Vector Search ($vectorSearch)
Stored embeddings are indexed in MongoDB Atlas using the $vectorSearch 
aggregation stage with an Approximate Nearest Neighbor (ANN) index. Given a 
query embedding, Atlas finds the top K most similar stored embeddings using 
cosine similarity — without scanning every document in the collection.

Each search result also returns a relevance score so the caller knows how 
confident the retrieval was.

### GPT-4o-mini for Code Summarization and Q&A
Two separate GPT-4o-mini calls power the system:

- **Summarization** — when a file is indexed, GPT reads the code and writes a 
  concise summary including key function names, inputs, outputs, and side 
  effects. The summary (not the raw code) is what gets embedded. This improves 
  retrieval quality because summaries capture intent, not just syntax.

- **Q&A** — at search time, the top retrieved summaries and code snippets are 
  assembled into a context window and GPT answers the user's question. It cites 
  file names and function names in its answer.

### SHA-256 Content Deduplication
Before any OpenAI API call is made, each file is hashed using SHA-256. A single 
database query checks all hashes at once using MongoDB's $in operator. Only 
files that are genuinely new get processed. Re-uploading the same repository 
costs zero OpenAI API calls and returns instantly.

This prevents redundant API spend and keeps the index clean.

### Batched Concurrent Processing
Files are processed in controlled batches of 3 using Promise.all(). This runs 3 
OpenAI API calls in parallel — faster than sequential processing — while staying 
within OpenAI's rate limits. Each file has its own error boundary so one failed 
file does not abort the rest of the batch.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Uptime check |
| POST | /api/process-code | Index a single code snippet |
| POST | /api/upload | Upload and index multiple files |
| POST | /api/upload-repo | Fetch and index a full GitHub repository |
| POST | /api/search | Semantic search with GPT answer |

All endpoints under /api require an `x-api-key` header.

---

## Production Security

- **API Key Authentication** — every route requires a valid x-api-key header
- **Rate Limiting** — 10 upload requests per 15 minutes, 30 search requests 
  per minute, enforced per IP
- **CORS Lockdown** — only origins listed in ALLOWED_ORIGINS are accepted
- **Input Validation** — all request bodies validated with Joi before any 
  business logic runs
- **Body Size Limit** — requests larger than 1MB are rejected
- **File Size Limits** — files over 100KB are skipped, repos over 50MB are 
  rejected mid-download
- **404 Handling** — private or missing GitHub repositories return a clear error 
  instead of crashing
- **Startup Env Check** — server refuses to start if OPENAI_API_KEY, MONGO_URI, 
  or API_KEY are missing from the environment
- **Request Tracing** — every request gets a unique UUID attached to it, 
  returned in the X-Request-Id response header

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + Express.js |
| Database | MongoDB Atlas with $vectorSearch |
| AI — Embeddings | OpenAI text-embedding-ada-002 |
| AI — Language Model | OpenAI GPT-4o-mini |
| Validation | Joi |
| Rate Limiting | express-rate-limit |
| File Upload | Multer |
| Repo Download | Node https (no Octokit dependency) |
| Archive Extraction | adm-zip |
| Deduplication | Node crypto (SHA-256) |

---

## Setup

```bash
git clone https://github.com/your-username/ai-code-navigator
cd ai-code-navigator
npm install
cp .env.example .env
# Fill in your values in .env
node index.js
