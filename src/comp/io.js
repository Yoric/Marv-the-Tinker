let libc;
let sys;

// Unix version
const Unix = {
  init: function() {
    let file = ctypes.StructType("FILE").ptr;
    let exports = {};
    /*FIXME: In the future, use CDataFinalizer*/

    let fopen = libc.declare("fopen", ctypes.default_abi,
                             file,
                             ctypes.char.ptr,
                             ctypes.char.ptr);

    let fclose = libc.declare("fclose", ctypes.default_abi,
                              /*return*/ ctypes.int,
                              /*file*/   file);

    let fread = libc.declare("fread", ctypes.default_abi,
                             /*return*/ ctypes.size_t,
                             /*buf*/    ctypes.char.ptr,
                             /*size*/   ctypes.size_t,
                             /*items*/  ctypes.size_t,
                             /*file*/   file);
    let fwrite = libc.declare("fwrite", ctypes.default_abi,
                             /*return*/ ctypes.size_t,
                             /*buf*/    ctypes.char.ptr,
                             /*size*/   ctypes.size_t,
                             /*items*/  ctypes.size_t,
                             /*file*/   file);

    /**
     * @constructor
     */
    let File = function(stream) {
      this.stream = stream;
    };
    exports.open_read = function(fileName) {
      return new File(fopen(fileName, "r"));
    };
    exports.open_append = function(fileName) {
      return new File(fopen(fileName, "a"));
    };
    exports.open_truncate = function(fileName) {
      return new File(fopen(fileName, "w"));
    };


    File.prototype = {
      read: function() {
        let buf = new (ctypes.char.array(4096));
        let result = "";
        let stream = this.stream;
        while (true) {
          let size = fread(buf, 4096, 1, stream);
          if (size == 0) {
            return result;
          }
          result += buf.readString();
        };
      },
      write: function(text) { // Note: not unicode-friendly
        let buf = new (ctypes.char.array(4096));
        let stream = this.stream;
        let index = 0;
        while (true) {
          for (let i = 0; i < 4096 && index < text.length; ++i, ++index) {
            buf[i] = text.charCodeAt(index);
          }
          fwrite(buf, 4096, 1, stream);
          if (index >= text.length) {
            return;
          }
        }
      },
      close: function() {
        return fclose(this.stream);
      }
    };
    return exports;
  }
};
{
  let where_is_libc = [{lib:"libSystem.dylib", sys: "MacOSX"},
                       {lib:"libc.so.6", sys:"Linux"},
                       {lib:"libc.so", sys:"Unix"}];
  for (let i = 0; i < where_is_libc.length; ++i) {
    let current = where_is_libc[i];
    try {
      libc = ctypes.open(current.lib);
      sys = current.sys;
      break;
    } catch (x) {
      printErr("Could not open libc "+current.toSource());
      printErr(x);
    }
  }

  if (libc) {
    exports = Unix.init();
  }
}

