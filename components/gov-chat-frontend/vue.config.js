// vue.config.js
const { DefinePlugin } = require('webpack');

// ==============================================================================
// DEBUGGING CODE STARTS HERE
// ==============================================================================
console.log("\n\n\n============================================================");
console.log("!!! VUE.CONFIG.JS IS LOADING. CHECKING ENV VARS... !!!");
console.log("============================================================");
console.log(`process.env.VUE_APP_API_URL IS: [${process.env.VUE_APP_API_URL}]`);
console.log(`process.env.VUE_APP_CSP_CONNECT_SRC IS: [${process.env.VUE_APP_CSP_CONNECT_SRC}]`);
console.log(`process.env.VUE_PROXY_HOST IS: [${process.env.VUE_PROXY_HOST}]`);
console.log("============================================================\n\n\n");
// ==============================================================================
// DEBUGGING CODE ENDS HERE
// ==============================================================================

const cspConnectSrc = process.env.VUE_APP_CSP_CONNECT_SRC || "'self' http://localhost:3000 ws://localhost:8090";
const vueProxyHost = process.env.VUE_PROXY_HOST || "localhost:3000";

module.exports = {
  devServer: {
    hot: true,
    port: 8090,
    allowedHosts: 'all',
    headers: {
      'Content-Security-Policy': `default-src 'self'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src ${cspConnectSrc}; font-src 'self' https://cdnjs.cloudflare.com data:; img-src 'self' data:;`
    },
    host: '0.0.0.0',
    client: {
      webSocketURL: 'auto://0.0.0.0:0/ws',
      webSocketTransport: 'ws',
    },
    proxy: {
      '/api': {
        target: 'http://'+ vueProxyHost,
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://'+ vueProxyHost,
        ws: true,
        changeOrigin: true,
      }
    }
  },
  // *** ADD THIS TO DISABLE CACHE-LOADER ***
  chainWebpack: config => {
    config.module.rule('vue').uses.delete('cache-loader');
    config.module.rule('js').uses.delete('cache-loader');
    config.module.rule('ts').uses.delete('cache-loader');
    config.module.rule('tsx').uses.delete('cache-loader');
  },
  configureWebpack: {
    resolve: {
      fallback: {
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
        util: require.resolve('util/'),
        process: require.resolve('process/browser'),
        zlib: require.resolve('browserify-zlib'),
        assert: require.resolve('assert/'),
        vm: require.resolve('vm-browserify')
      }
    },
    plugins: [
      new (require('webpack')).ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser'
      }),
      new DefinePlugin({
        'process.env': {
          VUE_APP_API_URL: JSON.stringify(process.env.VUE_APP_API_URL),
          VUE_APP_CSP_CONNECT_SRC: JSON.stringify(process.env.VUE_APP_CSP_CONNECT_SRC),
          VUE_PROXY_HOST: JSON.stringify(process.env.VUE_PROXY_HOST)
        }
      })
    ]
  }
};
console.log('DEBUG: Final constructed CSP string:');
console.log(module.exports.devServer.headers['Content-Security-Policy']);