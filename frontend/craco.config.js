const path = require("path");
module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Disable source maps
      webpackConfig.devtool = false;

      // Remove ESLintWebpackPlugin
      webpackConfig.plugins = webpackConfig.plugins.filter(
        (plugin) => plugin.constructor.name !== "ESLintWebpackPlugin"
      );

      // Alias
      webpackConfig.resolve.alias = {
        ...(webpackConfig.resolve.alias || {}),
        "@": path.resolve(__dirname, "src"),
      };

      // Reduce Terser parallelism to save memory
      const terser = webpackConfig.optimization.minimizer.find(
        (m) => m.constructor.name === "TerserPlugin"
      );
      if (terser) {
        terser.options.parallel = 1;
      }

      // Simpler chunk splitting
      webpackConfig.optimization.splitChunks = {
        chunks: "all",
        maxSize: 200000,
      };

      return webpackConfig;
    },
  },
};
