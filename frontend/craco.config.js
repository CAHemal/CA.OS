const path = require("path");

module.exports = {
  eslint: {
    enable: false,
  },
  webpack: {
    configure: (webpackConfig) => {

      // Remove ESLintWebpackPlugin completely
      webpackConfig.plugins = webpackConfig.plugins.filter(
        (plugin) => plugin.constructor.name !== "ESLintWebpackPlugin"
      );

      // Add alias
      webpackConfig.resolve.alias = {
        ...(webpackConfig.resolve.alias || {}),
        "@": path.resolve(__dirname, "src"),
      };

      return webpackConfig;
    },
  },
};
