const path = require("path");
module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Disable source maps for smaller builds
      webpackConfig.devtool = false;

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
