module.exports = (config) => {
  const configuration = {
    basePath: process.cwd(),
    frameworks: [
      'mocha',
      'chai',
    ],
    reporters: [
      'mocha',
    ],
    files: [
      'node_modules/rtc-quickconnect/dist/quickconnect.js',
      'dist/*.js',
      'spec/webrtc.js',
    ],
    browsers: ['ChromeHeadless'],
    logLevel: config.LOG_WARN,
    singleRun: true,
  };

  config.set(configuration);
};
