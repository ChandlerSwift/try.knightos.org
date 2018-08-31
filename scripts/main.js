// Generated by CoffeeScript 2.3.1
(function() {
  var altCut, check_resources, commands, copy_between_systems, ctrlCut, current_emulator, data_package_elms, doneTyping, doneTypingInterval, down_key, downloadKernel, editor_elm, el, error, error_log, files, getSelectedText, input, install_package, j, len, load_environment, load_example_elms, log, log_el, new_file_elm, ref, resizeAce, run_project, run_project_elm, showSettingsMenu, typingTimer;

  require.config({
    paths: {
      'z80e': '../tools/z80e'
    },
    shim: {
      '../tools/kpack': {
        exports: 'exports'
      },
      '../tools/genkfs': {
        exports: 'exports'
      },
      '../tools/scas': {
        exports: 'exports'
      },
      'z80e': {
        exports: 'exports'
      }
    }
  });

  window.toolchain = {
    kpack: null,
    genkfs: null,
    scas: null,
    z80e: null,
    ide_emu: null,
    kernel_rom: null
  };

  files = [];

  log_el = document.getElementById('tool-log');

  log = function(text) {
    console.log(text);
    if (log_el.innerHTML === '') {
      log_el.innerHTML += text;
    } else {
      log_el.innerHTML += '\n' + text;
    }
    return log_el.scrollTop = log_el.scrollHeight;
  };

  window.ide_log = log;

  error_log = [];

  error = function(text) {
    log(text);
    return error_log.push(text);
  };

  window.ide_error = error;

  copy_between_systems = function(fs1, fs2, from, to, encoding) {
    var f, fs1p, fs2p, j, len, ref, results, s;
    ref = fs1.readdir(from);
    results = [];
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      if (f === '.' || f === '..') {
        continue;
      }
      fs1p = from + '/' + f;
      fs2p = to + '/' + f;
      s = fs1.stat(fs1p);
      log(`Writing ${fs1p} to ${fs2p}`);
      if (fs1.isDir(s.mode)) {
        try {
          fs2.mkdir(fs2p);
        } catch (error1) {

        }
        // pass
        results.push(copy_between_systems(fs1, fs2, fs1p, fs2p, encoding));
      } else {
        results.push(fs2.writeFile(fs2p, fs1.readFile(fs1p, {
          encoding: encoding
        }), {
          encoding: encoding
        }));
      }
    }
    return results;
  };

  install_package = function(repo, name, callback) {
    var elm, full_name, xhr;
    full_name = repo + '/' + name;
    elm = document.querySelector("[data-package='" + full_name + "']");
    if (elm) {
      elm.setAttribute('disabled', 'disabled');
      elm.textContent = 'Installing';
    }
    log("Downloading " + full_name);
    xhr = new XMLHttpRequest();
    xhr.open('GET', "https://packages.knightos.org/" + full_name + "/download");
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      var data, file_name;
      log("Installing " + full_name);
      file_name = '/packages/' + repo + '-' + name + '.pkg';
      data = new Uint8Array(xhr.response);
      toolchain.kpack.FS.writeFile(file_name, data, {
        encoding: 'binary'
      });
      toolchain.kpack.Module.callMain(['-e', file_name, '/pkgroot']);
      copy_between_systems(toolchain.kpack.FS, toolchain.scas.FS, "/pkgroot/include", "/include", "utf8");
      copy_between_systems(toolchain.kpack.FS, toolchain.genkfs.FS, "/pkgroot", "/root", "binary");
      if (elm) {
        elm.textContent = 'Installed';
      }
      if (callback != null) {
        return callback();
      }
    };
    return xhr.send();
  };

  current_emulator = null;

  load_environment = function() {
    var callback, file, j, len, packages, results, saved;
    toolchain.genkfs.FS.writeFile("/kernel.rom", toolchain.kernel_rom, {
      encoding: 'binary'
    });
    toolchain.genkfs.FS.mkdir("/root");
    toolchain.genkfs.FS.mkdir("/root/etc");
    toolchain.kpack.FS.mkdir("/packages");
    toolchain.kpack.FS.mkdir("/pkgroot");
    toolchain.kpack.FS.mkdir("/pkgroot/include");
    toolchain.scas.FS.mkdir("/include");
    packages = 0;
    callback = function() {
      packages++;
      if (packages === 3) {
        return run_project();
      }
    };
    install_package('core', 'init', callback);
    install_package('core', 'kernel-headers', callback);
    install_package('core', 'corelib', callback);
    results = [];
    for (j = 0, len = files.length; j < len; j++) {
      file = files[j];
      saved = localStorage.getItem(file.name);
      if (saved !== null) {
        results.push(file.editor.setValue(saved, 1));
      } else {
        results.push(void 0);
      }
    }
    return results;
  };

  run_project = function() {
    var elog, error_annotations, error_text, executable, file, j, k, len, len1, rom, run_project_el;
    // Clear all Ace Annotations
    run_project_el = document.getElementById('run_project');
    run_project_el.removeAttribute('disabled');
    _.each(files, function(el) {
      return el.editor.getSession().clearAnnotations();
    });
    for (j = 0, len = files.length; j < len; j++) {
      file = files[j];
      window.toolchain.scas.FS.writeFile('/' + file.name, file.editor.getValue());
      localStorage.setItem(file.name, file.editor.getValue());
    }
    log("Calling assembler...");
    window.toolchain.scas.Module.callMain(['/main.asm', '-I/include/', '-o', 'executable']);
    error_annotations = {};
    for (k = 0, len1 = error_log.length; k < len1; k++) {
      elog = error_log[k];
      error_text = elog.split(':');
      if (error_text.length < 5) {
        continue;
      }
      file = error_text[0];
      if (elog.indexOf('/') === 0) {
        file = file.substring(1);
      }
      file = _.find(files, function(el) {
        return el.name === file;
      });
      if (!file) {
        return;
      }
      if (error_annotations[file.name] == null) {
        error_annotations[file.name] = [];
      }
      error_annotations[file.name].push({
        row: error_text[1] - 1,
        column: error_text[2],
        text: error_text[4].substring(1),
        type: "error"
      });
    }
    _.each(error_annotations, function(value, key) {
      return _.find(files, {
        name: key
      }).editor.getSession().setAnnotations(value);
    });
    error_log = [];
    if (window.toolchain.scas.FS.analyzePath("/executable").exists) {
      log("Assembly done!");
    } else {
      log("Assembly failed");
      return;
    }
    executable = window.toolchain.scas.FS.readFile("/executable", {
      encoding: 'binary'
    });
    window.toolchain.genkfs.FS.writeFile("/root/bin/executable", executable, {
      encoding: 'binary'
    });
    window.toolchain.genkfs.FS.writeFile("/root/etc/inittab", "/bin/executable");
    window.toolchain.genkfs.FS.writeFile("/kernel.rom", new Uint8Array(toolchain.kernel_rom), {
      encoding: 'binary'
    });
    window.toolchain.genkfs.Module.callMain(["/kernel.rom", "/root"]);
    rom = window.toolchain.genkfs.FS.readFile("/kernel.rom", {
      encoding: 'binary'
    });
    log("Loading your program into the emulator!");
    if (current_emulator !== null) {
      current_emulator.cleanup();
    }
    current_emulator = new toolchain.ide_emu(document.getElementById('screen'));
    window.emu = current_emulator;
    return current_emulator.load_rom(rom.buffer);
  };

  check_resources = function() {
    var j, len, prop, ref;
    ref = Object.keys(window.toolchain);
    for (j = 0, len = ref.length; j < len; j++) {
      prop = ref[j];
      if (window.toolchain[prop] === null) {
        return;
      }
    }
    log("Ready.");
    return load_environment();
  };

  downloadKernel = function() {
    var xhr;
    log("Downloading latest kernel...");
    xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://mirror.drewdevault.com/latest-TI84pSE.rom');
    xhr.setRequestHeader("Accept", "application/octet-stream");
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      window.toolchain.kernel_rom = xhr.response;
      log("Loaded kernel ROM.");
      return check_resources();
    };
    return xhr.send();
  };

  downloadKernel();

  log("Downloading scas...");

  require(['../tools/scas'], function(scas) {
    log("Loaded scas.");
    window.toolchain.scas = scas;
    window.toolchain.scas.Module.preRun.pop()();
    return check_resources();
  });

  log("Downloading kpack...");

  require(['../tools/kpack'], function(kpack) {
    log("Loaded kpack.");
    window.toolchain.kpack = kpack;
    return check_resources();
  });

  log("Downloading genkfs...");

  require(['../tools/genkfs'], function(genkfs) {
    log("Loaded genkfs.");
    window.toolchain.genkfs = genkfs;
    return check_resources();
  });

  log("Downloading emulator bindings...");

  require(['ide_emu'], function(ide_emu) {
    log("Loaded emulator bindings.");
    window.toolchain.ide_emu = ide_emu;
    window.toolchain.z80e = require("z80e");
    return check_resources();
  });

  // Bind stuff to the UI, TODO: Rewrite this entire thing because .data() uses Jquerys memory structure that bypasses the DOM.
  data_package_elms = document.querySelectorAll('[data-package]');

  Array.prototype.forEach.call(data_package_elms, function(e, i) {
    return data_package_elms[i].addEventListener('click', function(ev) {
      var pack;
      ev.preventDefault();
      pack = data_package_elms[i].dataset['package'].split('/');
      return install_package(pack[0], pack[1]);
    });
  });

  load_example_elms = document.querySelectorAll('.load-example');

  Array.prototype.forEach.call(load_example_elms, function(e, i) {
    return load_example_elms[i].addEventListener('click', function(ev) {
      var xhr;
      ev.preventDefault();
      xhr = new XMLHttpRequest;
      xhr.open('GET', load_example_elms[i].dataset.source);
      xhr.onload = function() {
        files[0].editor.setValue(this.responseText);
        return files[0].editor.navigateFileStart();
      };
      return xhr.send();
    });
  });

  run_project_elm = document.querySelector('#run_project');

  run_project_elm.addEventListener('click', function(e) {
    return run_project();
  });

  new_file_elm = document.querySelector('#new_file');

  new_file_elm.addEventListener('click', function(e) {
    var editor, editor_elm, id, nav_tabs_elm, new_file_title_elm, tab_content_elm;
    e.preventDefault();
    new_file_title_elm = document.querySelector('#new_file_title');
    id = new_file_title_elm.value;
    new_file_title_elm.value = '';
    if (!id || _.some(files, {
      name: id + ".asm"
    })) {
      return;
    }
    tab_content_elm = document.querySelector('.tab-content');
    tab_content_elm.innerHTML += "<div class='tab-pane' id='" + id + "'><div class='editor' data-file='" + id + ".asm'></div></div>";
    nav_tabs_elm = document.querySelector('.nav.nav-tabs');
    nav_tabs_elm.innerHTML += "<li><a data-toggle='tab' href='#" + id + "'>" + id + ".asm</a></li>";
    editor_elm = document.querySelector(`#${id}>div`);
    console.log(editor_elm);
    editor = ace.edit(editor_elm);
    editor.setTheme("ace/theme/github");
    if (editor_elm.dataset.file.indexOf('.asm') === editor_elm.dataset.file.length - 4) {
      editor.getSession().setMode("ace/mode/assembly_x86");
    }
    files.push({
      name: editor_elm.dataset.file,
      editor: editor
    });
    return resizeAce();
  });

  ref = document.querySelectorAll('.editor');
  for (j = 0, len = ref.length; j < len; j++) {
    editor_elm = ref[j];
    (function(editor_elm) {
      var editor;
      // Set up default editors
      editor = ace.edit(editor_elm);
      editor.setTheme("ace/theme/github");
      if (editor_elm.dataset.file.indexOf('.asm') === editor_elm.dataset.file.length - 4) {
        editor.getSession().setMode("ace/mode/assembly_x86");
      }
      return files.push({
        name: editor_elm.dataset.file,
        editor: editor
      });
    })(editor_elm);
  }

  resizeAce = function() {
    var file, k, len1, results;
    editor_elm = document.querySelector('.editor');
    editor_elm.style.height = (window.innerHeight - 92).toString() + 'px';
    results = [];
    for (k = 0, len1 = files.length; k < len1; k++) {
      file = files[k];
      results.push(file.editor.resize());
    }
    return results;
  };

  window.addEventListener('resize', function() {
    return resizeAce();
  });

  resizeAce();

  showSettingsMenu = function() {
    var file, k, len1, results;
    results = [];
    for (k = 0, len1 = files.length; k < len1; k++) {
      file = files[k];
      results.push(file.editor.execCommand("showSettingsMenu"));
    }
    return results;
  };

  el = document.getElementById('settings');

  el.addEventListener('click', function(e) {
    e.preventDefault();
    showSettingsMenu();
  });

  getSelectedText = function() {
    var text;
    text = '';
    if (window.getSelection) {
      text = window.getSelection().toString();
    } else if (document.selection && document.selection.type !== 'Control') {
      text = document.selection.createRange().text;
    }
    return text;
  };

  // ShortCuts TODO: figure out how to remove jquery but keep bootstrap?
  commands = {
    new_file: function() {
      $('.modal').modal('hide');
      $('#new_file_Modal').modal('show');
      return $('#new_file_title').focus();
    },
    shortcut: function() {
      $('.modal').modal('hide');
      return $('#shortcut_Modal').modal('show');
    },
    settings: function() {
      return showSettingsMenu();
    },
    docs: function() {
      $('.modal').modal('hide');
      return $('#docs_Modal').modal('show');
    },
    search: function() {
      var e, file, k, len1;
      $('.modal').modal('hide');
      $('#docs_Modal').modal('show');
      for (k = 0, len1 = files.length; k < len1; k++) {
        file = files[k];
        if (file.editor.getSelectedText()) {
          $('input.doc_search').val(file.editor.getSelectedText());
          break;
        } else {
          break;
        }
      }
      $('input.doc_search').focus();
      e = jQuery.Event('keydown', {
        which: 13
      });
      return $('input.doc_search').trigger(e);
    }
  };

  down_key = [];

  ctrlCut = [];

  altCut = [];

  ctrlCut[78] = commands.new_file;

  ctrlCut[82] = function() {
    return run_project();
  };

  ctrlCut[186] = commands.search;

  ctrlCut[188] = commands.settings;

  ctrlCut[190] = commands.shortcut;

  ctrlCut[191] = commands.docs;

  window.addEventListener('keydown', function(e) {
    var doc_search_elm, key;
    key = e.which;
    doc_search_elm = document.querySelector('.doc_search');
    if (down_key[key]) {
      return;
    }
    if (e.ctrlKey && (ctrlCut[key] != null)) {
      e.preventDefault();
      ctrlCut[key]();
    } else if (e.altKey && (altCut[key] != null)) {
      e.preventDefault();
      altCut[key]();
    } else if (key === 13 && doc_search_elm === document.activeElement) {
      e.stopPropagation();
      e.preventDefault();
    }
    return down_key[key] = true;
  });

  window.addEventListener('keyup', function(e) {
    var key;
    key = e.which;
    return delete down_key[key];
  });

  typingTimer = void 0;

  doneTypingInterval = 2000;

  input = document.querySelector('.ace_text-input');

  doneTyping = function() {};

  input.addEventListener('keyup', function() {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(doneTyping, doneTypingInterval);
  });

  input.addEventListener('keydown', function() {
    clearTimeout(typingTimer);
  });

  doneTyping = function() {
    var file, k, len1;
    for (k = 0, len1 = files.length; k < len1; k++) {
      file = files[k];
      localStorage.setItem(file.name, file.editor.getValue());
      console.log('Saving');
      return;
    }
  };

}).call(this);
