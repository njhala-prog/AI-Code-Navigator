const errorhandler = (err, req, res, next) => {
    const reqId = req.id || 'unknown';
    console.error(`[${reqId}] Unhandled error:`, err.message);
    res.status(500).json({ success: false, error: 'Internal server error', requestId: reqId });
};

module.exports = errorhandler;
