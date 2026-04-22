const express = require('express');
const multer = require('multer');


const { processCode, searchCode, uploadCode, uploadRepo } = require('../controllers/codecontroller');

const router = express.Router();
const upload = multer({ dest: 'uploads/' }); // Files will be saved in the 'uploads' folde

router.post('/process-code', processCode);
router.post('/search', searchCode);
router.post('/upload', upload.array('files', 10), uploadCode); // New endpoint for file upload
router.post('/upload-repo', uploadRepo);
module.exports = router;