module.exports = ->
  # Project configuration
  @initConfig
    pkg: @file.readJSON 'package.json'

    # Browser build of the client lib
    noflo_browser:
      build:
        options:
          baseDir: './'
          webpack:
            externals:
              'repl': 'commonjs repl' # somewhere inside coffee-script
              'module': 'commonjs module' # somewhere inside coffee-script
              'child_process': 'commonjs child_process' # somewhere inside coffee-script
              'ws': 'commonjs ws' # microflo-emscripten build, not actually needed
              'jison': 'commonjs jison'
            module:
              rules: [
                test: /noflo([\\]+|\/)lib([\\]+|\/)(.*)\.js$|noflo([\\]+|\/)components([\\]+|\/)(.*)\.js$|fbp-graph([\\]+|\/)lib([\\]+|\/)(.*)\.js$|noflo-runtime-([a-z]+)([\\]+|\/)(.*).js$/
                use: [
                  loader: 'babel-loader'
                  options:
                    presets: ['es2015']
                ]
              ,
                test: /\.coffee$/
                use: [
                  loader: 'coffee-loader'
                  options:
                    transpile:
                      presets: ['es2015']
                ]
              ,
                test: /\.fbp$/
                use: ["fbp-loader"]
              ,
                test: /\.yaml$/
                use: [
                  "json-loader"
                  "yaml-include-loader"
                ]
              ]
            resolve:
              extensions: [".coffee", ".js"]
            node:
              fs: "empty"
          ignores: [
            /tv4/
            /serialport/
            /bin\/coffee/
          ]
        files:
          'browser/fbp-protocol-client.js': ['entry.webpack.js']

    # BDD tests on Node.js
    mochaTest:
      nodejs:
        src: ['spec/*.coffee']
        options:
          reporter: 'spec'

    # BDD tests on browser
    mocha_phantomjs:
      options:
        output: 'spec/result.xml'
        reporter: 'spec'
        failWithOutput: true
      all: ['spec/runner.html']

  # Grunt plugins used for building
  @loadNpmTasks 'grunt-noflo-browser'

  # Grunt plugins used for testing
  @loadNpmTasks 'grunt-mocha-test'
  @loadNpmTasks 'grunt-mocha-phantomjs'

  # Our local tasks
  @registerTask 'build', 'Build for the chosen target platform', (target = 'all') =>
    if target is 'all' or target is 'browser'
      @task.run 'noflo_browser'

  @registerTask 'test', 'Build and run automated tests', (target = 'all') =>
    @task.run 'build'
    if target is 'all' or target is 'nodejs'
      @task.run 'mochaTest'
    if target is 'all' or target is 'browser'
      @task.run 'mocha_phantomjs'

  @registerTask 'default', ['test']
