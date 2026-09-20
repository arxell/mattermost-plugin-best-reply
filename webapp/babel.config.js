module.exports = {
    presets: [
        ['@babel/preset-env', {
            targets: {
                chrome: '114',
                firefox: '115',
                edge: '114',
                safari: '16.4',
            },
            useBuiltIns: 'usage',
            corejs: 3,
        }],
        '@babel/preset-react',
        '@babel/preset-typescript',
    ],
};
