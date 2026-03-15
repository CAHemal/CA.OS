const path = require("path");

module.exports = {
  eslint: {
    enable: false,
  },
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    configure: (webpackConfig) => {
      webpackConfig.plugins = webpackConfig.plugins.filter(
        (plugin) => plugin.constructor.name !== "ESLintWebpackPlugin"
      );
      return webpackConfig;
    },
  },
};
