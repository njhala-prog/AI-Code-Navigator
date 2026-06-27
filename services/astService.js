const parser = require('@babel/parser');
const _traverse = require('@babel/traverse');
const traverse = _traverse.default || _traverse;

const AST_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

function getExtension(fileName) {
    const dot = fileName.lastIndexOf('.');
    return dot === -1 ? '' : fileName.slice(dot).toLowerCase();
}

function chunkByAST(code, fileName) {
    if (!AST_EXTENSIONS.has(getExtension(fileName))) return null;

    let ast;
    try {
        ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties'],
            errorRecovery: true,
        });
    } catch {
        return null;
    }

    const chunks = [];

    traverse(ast, {
        FunctionDeclaration(path) {
            const name = path.node.id ? path.node.id.name : 'anonymous';
            chunks.push({ chunkName: name, chunkType: 'function', code: code.slice(path.node.start, path.node.end) });
            path.skip();
        },
        VariableDeclaration(path) {
            for (const declarator of path.node.declarations) {
                const { init, id } = declarator;
                if (
                    init &&
                    (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') &&
                    id && id.type === 'Identifier'
                ) {
                    chunks.push({ chunkName: id.name, chunkType: 'function', code: code.slice(path.node.start, path.node.end) });
                }
            }
            path.skip();
        },
        ClassDeclaration(path) {
            const name = path.node.id ? path.node.id.name : 'AnonymousClass';
            chunks.push({ chunkName: name, chunkType: 'class', code: code.slice(path.node.start, path.node.end) });
            path.skip();
        },
        ExportDefaultDeclaration(path) {
            const decl = path.node.declaration;
            if (decl && decl.type === 'FunctionDeclaration') {
                chunks.push({ chunkName: decl.id ? decl.id.name : 'default', chunkType: 'function', code: code.slice(decl.start, decl.end) });
                path.skip();
            } else if (decl && decl.type === 'ClassDeclaration') {
                chunks.push({ chunkName: decl.id ? decl.id.name : 'default', chunkType: 'class', code: code.slice(decl.start, decl.end) });
                path.skip();
            }
        },
    });

    return chunks.length > 0 ? chunks : null;
}

module.exports = { chunkByAST };
