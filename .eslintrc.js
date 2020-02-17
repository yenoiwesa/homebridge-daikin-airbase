module.exports = {
    extends: ['eslint:recommended'],
    env: {
        node: true,
        es6: true,
    },
    rules: {
        'no-var': 'error',
    },
    parserOptions: {
        ecmaVersion: 2018,
    },
};
