module.exports = ->
  # Project configuration
  @initConfig
    pkg: @file.readJSON 'package.json'

    # CoffeeScript compilation
    coffee:
      lib:
        options:
          bare: true
          transpile:
            presets: ['es2015']
        expand: true
        cwd: 'src/lib'
        src: ['**.coffee']
        dest: 'lib'
        ext: '.js'
      helpers:
        options:
          bare: true
          transpile:
            presets: ['es2015']
        expand: true
        cwd: 'src/helpers'
        src: ['**.coffee']
        dest: 'helpers'
        ext: '.js'
      spec:
        options:
          bare: true
          transpile:
            presets: ['es2015']
        expand: true
        cwd: 'spec'
        src: ['**.coffee']
        dest: 'spec'
        ext: '.js'

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

    # Automated recompilation and testing when developing
    watch:
      files: ['spec/*.coffee', 'components/*.coffee']
      tasks: ['test']

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

    # Coding standards
    coffeelint:
      src:
        files:
          src: ['src/lib/*.coffee', 'src/helpers/*.coffee']
        options:
          max_line_length:
            value: 80
            level: 'warn'

  # Grunt plugins used for building
  @loadNpmTasks 'grunt-noflo-browser'
  @loadNpmTasks 'grunt-contrib-coffee'

  # Grunt plugins used for testing
  @loadNpmTasks 'grunt-contrib-watch'
  @loadNpmTasks 'grunt-mocha-test'
  @loadNpmTasks 'grunt-mocha-phantomjs'
  @loadNpmTasks 'grunt-coffeelint'

  # Our local tasks
  @registerTask 'build', 'Build for the chosen target platform', (target = 'all') =>
    @task.run 'coffee'
    if target is 'all' or target is 'browser'
      @task.run 'noflo_browser'

  @registerTask 'test', 'Build and run automated tests', (target = 'all') =>
    @task.run 'coffeelint'
    @task.run 'build'
    if target is 'all' or target is 'nodejs'
      @task.run 'mochaTest'
    if target is 'all' or target is 'browser'
      @task.run 'mocha_phantomjs'

  @registerTask 'default', ['test']
