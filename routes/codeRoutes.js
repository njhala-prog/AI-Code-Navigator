const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const { uploadLimiter, searchLimiter } = require('../middleware/rateLimiter');
const { validate, processCodeSchema, searchSchema, uploadRepoSchema } = require('../validators/codeValidators');
const { processCode, searchCode, uploadCode, uploadRepo } = require('../controllers/codecontroller');

const router = express.Router();

const ALLOWED_EXTENSIONS = /\.(js|ts|jsx|tsx|py|java|go|rb|php|cs|cpp|c|h|rs|swift|kt|scala|sh|yaml|yml|json|html|css|md)$/i;

const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, ALLOWED_EXTENSIONS.test(file.originalname)),
});

router.post('/process-code', auth, validate(processCodeSchema), processCode);
router.post('/upload', auth, uploadLimiter, upload.array('files', 10), uploadCode);
router.post('/upload-repo', auth, uploadLimiter, validate(uploadRepoSchema), uploadRepo);
router.post('/search', auth, searchLimiter, validate(searchSchema), searchCode);

module.exports = router;
