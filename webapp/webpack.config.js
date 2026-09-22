const path = require('path');

const PLUGIN_ID = require('../plugin.json').id;

const config = {
    entry: ['./src/index.tsx'],
    resolve: {
        modules: ['src', 'node_modules'],
        extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',

                    // Babel configuration lives in babel.config.js.
                },
            },
            {
                test: /\.scss$/,
                use: ['style-loader', 'css-loader', 'sass-loader'],
            },
        ],
    },
    externals: {
        react: 'React',
        'react-dom': 'ReactDOM',
        redux: 'Redux',
        'react-redux': 'ReactRedux',
        'prop-types': 'PropTypes',
        'react-bootstrap': 'ReactBootstrap',
        'react-router-dom': 'ReactRouterDom',
    },
    output: {
        devtoolNamespace: PLUGIN_ID,
        path: path.join(__dirname, 'dist'),
        publicPath: '/',
        filename: 'main.js',
    },
};

module.exports = (env, argv) => ({
    ...config,
    mode: argv.mode || 'production',
    devtool: argv.mode === 'development' ? 'eval-source-map' : 'source-map',
});
