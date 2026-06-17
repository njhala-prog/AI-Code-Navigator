const Joi = require('joi');

const validate = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
        return res.status(400).json({
            success: false,
            error: error.details.map((d) => d.message).join('; '),
        });
    }
    req.body = value;
    next();
};
const processCodeSchema = Joi.object({
    code: Joi.string().min(1).max(500_000).required(),
    fileName: Joi.string().max(255).default('snippet'),
    filePath: Joi.string().max(500).optional(),
});

const searchSchema = Joi.object({
    query: Joi.string().min(1).max(1000).required(),
    limit: Joi.number().integer().min(1).max(20).default(5),
});

const uploadRepoSchema = Joi.object({
    repoUrl: Joi.string()
        .pattern(/^https:\/\/github\.com\/[^/]+\/[^/\s]+$/)
        .required()
        .messages({ 'string.pattern.base': 'Must be a valid GitHub URL: https://github.com/owner/repo' }),
});

module.exports = { validate, processCodeSchema, searchSchema, uploadRepoSchema };
