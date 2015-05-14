window.AjLogger = {
  create: function (id) {
    function log(msg, type) {
      if (/^info/.test(type) || !type) {
        type = 'info';
      }
      else if (/^suc/.test(type)) {
        type = 'success';
      }
      else if (/^warn/.test(type)) {
        type = 'warning';
      }
      else if (/^err/.test(type) || /^dang/.test(type)) {
        type = 'danger';
        msg = msg && msg.message || msg;
      }

      $(id).prepend('<div class="alert alert-' + type + '">' + msg + '</div>');
    }
    log.log = log;
    log.info = function (msg) {
      log(msg, 'success');
    };
    log.warn = function (msg) {
      log(msg, 'warn');
    };
    log.error = function (msg) {
      log(msg, 'error');
    };
    log.clear = function () {
      $(id).html('');
    };

    return log;
  }
};
