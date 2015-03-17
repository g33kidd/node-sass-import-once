/**
  * Shameless adapted from [Eyeglass](https://github.com/sass-eyeglass/eyeglass)
  *  because I wanted a general-use import-once importer for Node
**/
'use strict';

var fs = require('fs'),
    path = require('path');

/**
 * All imports use the forward slash as a directory
 * delimeter. This function converts to the filesystem's
 * delimeter if it uses an alternate.
**/
function makeFsPath(importPath) {
  var fsPath = importPath;
  if (path.sep !== '/') {
    fsPath = fsPath.replace(/\//, path.sep);
  }
  return fsPath;
}

/**
  * Determines if a file should be imported or not
**/
function importOnce(data, done) {
  if (this._importOnceCache[data.file]) {
    done({
      contents: '',
      filename: 'already-imported:' + data.file
    });
  } else {
    this._importOnceCache[data.file] = true;
    done(data);
  }
}

/**
 * Sass imports are usually in an abstract form in that
 * they leave off the partial prefix and the suffix.
 * This code creates the possible extensions, whether it is a partial
 * and whether it is a directory index file having those
 * same possible variations. If the import contains an extension,
 * then it is left alone.
 *
**/
function getFileNames(abstractName) {
  // console.log(this.options.importOnce);

  var names = [];
  if (path.extname(abstractName)) {
    names.push(abstractName);
  } else {
    var directory = path.dirname(abstractName);
    var basename = path.basename(abstractName);

    // Standard File Names
    ['', '_'].forEach(function(prefix) {
      ['.scss', '.sass'].forEach(function(ext) {
        names.push(path.join(directory, prefix + basename + ext));
      });
    });

    // Index Files
    if (this.options.importOnce.index) {
      ['', '_'].forEach(function(prefix) {
        ['.scss', '.sass'].forEach(function(ext) {
          names.push(path.join(abstractName, prefix + 'index' + ext));
        });
      });
    }

    // CSS Files
    if (this.options.importOnce.css) {
      names.push(abstractName + '.css');
    }

  }
  return names;
}

/**
  * Build list of potential Bower imports
**/
function getBowerNames(uri) {
  var gfn = getFileNames.bind(this);

  var bowerrc = path.resolve(process.cwd(), '.bowerrc'),
      bowerPath = 'bower_components',
      core = uri.split('/')[0],
      paths = [],
      results = [];

  uri = makeFsPath(uri);

  if (fs.existsSync(bowerrc)) {
    bowerrc = JSON.parse(fs.readFileSync(bowerrc, 'utf-8'));
    if (bowerrc.directory) {
      bowerPath = bowerrc.directory;
    }
  }

  // Resolve the path to the Bower repository;
  bowerPath = path.resolve(process.cwd(), bowerPath);

  // Basic, add import path-esque
  paths.push(path.resolve(bowerPath, uri));
  // For those projects that were Ruby gems and are now distributed through Bower
  if (core !== '..' && core !== '.') {
    paths.push(path.resolve(bowerPath, core, 'stylesheets', uri));
    paths.push(path.resolve(bowerPath, core + '-sass', 'stylesheets', uri));
    paths.push(path.resolve(bowerPath, 'sass-' + core, 'stylesheets', uri));

    paths.push(path.resolve(bowerPath, core, 'sass', uri));
    paths.push(path.resolve(bowerPath, core + '-sass', 'sass', uri));
    paths.push(path.resolve(bowerPath, 'sass-' + core, 'sass', uri));

    if (this.options.importOnce.css) {
      paths.push(path.resolve(bowerPath, core, 'dist', uri));
      paths.push(path.resolve(bowerPath, core, 'dist', 'css', uri));
    }
  }

  // Get the file names for all of the paths!
  paths.forEach(function(path) {
    results = results.concat(gfn(path));
  });

  return results;
}

// This is a bootstrap function for calling readFirstFile.
function readAbstractFile(uri, abstractName, cb) {
  var gfn = getFileNames.bind(this),
      gbn = getBowerNames.bind(this),
      css = this.options.importOnce.css;

  var files = gfn(abstractName);

  // console.log(this.options.importOnce);
  if (this.options.importOnce.bower) {
    files = files.concat(gbn(uri));
  }

  readFirstFile(uri, files, css, cb);
}

/**
 * Asynchronously walks the file list until a match is found. If
 * no matches are found, calls the callback with an error
**/
function readFirstFile(uri, filenames, css, cb, examinedFiles) {
  var filename = filenames.shift();
  examinedFiles = examinedFiles || [];
  examinedFiles.push(filename);
  fs.readFile(filename, function(err, data) {
    if (err) {
      if (filenames.length) {
        readFirstFile(uri, filenames, css, cb, examinedFiles);
      } else {
        cb(new Error('Could not import `' + uri + '` from any of the following locations:\n  ' + examinedFiles.join('\n  ')));
      }
    } else {
      if (css) {
        if (path.extname(filename) === '.css') {
          cb(null, {
            contents: data.toString(),
            file: filename
          });
        }
        else {
          cb(null, {
            contents: data,
            file: filename
          });
        }
      }
      else {
        cb(null, {
          contents: data,
          file: filename
        });
      }
    }
  });
}

/**
  * Import the goodies!
**/
function importer(uri, prev, done) {
  var isRealFile = fs.existsSync(prev),
      io = importOnce.bind(this),
      raf = readAbstractFile.bind(this),
      file;

  // Ensure options are available
  if (!this.options.importOnce) {
    this.options.importOnce = {};
  }

  // Set default index import
  if (!this.options.importOnce.index) {
    this.options.importOnce.index = false;
  }

  // Set default bower import
  if (!this.options.importOnce.bower) {
    this.options.importOnce.bower = false;
  }

  // Set default css import
  if (!this.options.importOnce.css) {
    this.options.importOnce.css = false;
  }

  // Create an import cache if it doesn't exist
  if (!this._importOnceCache) {
    this._importOnceCache = {};
  }

  if (isRealFile) {
    file = path.resolve(path.dirname(prev), makeFsPath(uri));
    raf(uri, file, function (err, data) {
      if (err) {
        console.log(err.toString());
        done({});
      } else {
        io(data, done);
      }
    });
  }
}

/**
  * Exports file
**/
module.exports = importer;