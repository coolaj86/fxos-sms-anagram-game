$(function() {
  'use strict';

  // http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
  function shuffle(array) {
    var currentIndex = array.length
    , temporaryValue
    , randomIndex
    ;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    return array;
  }

  window.onerror = function (e) {
    console.error('[window.onerror] uncaught exception');
    console.error(e);
    log.error('[window.onerror] uncaught exception');
    log.error(e && e.message || e);
  };

  $('.js-test-site-container').hide();

  // TODO Promise
  var log = window.AjLogger.create('#console');
  var gamestate = {
    master: '' // should be a valid phone number
  , players: {}
  , words: ['pirate bay', 'sad panda', 'superhero']
  , round: 0
  , minplayers: 0
  , maxplayers: 6
  };

  $('body').on('click', '.js-game-master-form button', function () {
    gamestate.master = $('.js-game-master-number').val();
    $('.js-game-master-form').hide();
    init();
  });

  $('body').on('click', '#console-clear', function () {
    log.clear();
  });

  function simpleSend(to, text) {
    var requests
      ;

    if (!to) {
      log.error('No one to send to');
      return;
    }

    if (!Array.isArray(to)) {
      to = [to];
    }

    log.log('[Sending]');
    log.log(JSON.stringify(to));
    log.log(text);

    requests = navigator.mozMobileMessage.send(to, text);
    requests.forEach(function (request) {
      request.onsuccess = function () {
        log.log('[sent] ' + Object.keys(this.result));
        log.log(this.result.receiver + ':' + this.result.sender);
      };
      request.onerror = function () {
        // TODO send error
        log.error('[error] ' + this.result);
        log.error(this.error.name + ':' + this.error.message);
        log.error(JSON.stringify(this.error));
        log.error(this.error.toString());
      };
    });
  }

  function playerAdded(player) {
    var msg = player.name + " (" + player.number + ") has joined the match. ("
      ;

    msg += Object.keys(gamestate.players).length;

    if (gamestate.minplayers) {
      msg += "/" + gamestate.minplayers;
    }

    msg += ")";

    if (gamestate.minplayers) {
      if (Object.keys(gamestate.players).length >= gamestate.minplayers) {
        msg += "Ready to start? (text START to begin)";
      }
    }

    simpleSend(gamestate.master, msg);
  }

  function handleMasterMessage(cmd, text) {
    var num
      , valid
      ;

    if ('numplayers' === gamestate.mstate) {
      num = parseInt(cmd, 10);
      valid = num > 0;

      if (!valid) {
        simpleSend(gamestate.master, "'" + text + "' didn't make sense to me. How many players? (pick a number between 2 and 10)");
      } else {
        simpleSend(gamestate.master, "Okay, tell your " + num + " players to text 'Join' to join. :-D");
      }
      gamestate.mstate = 'ready';
    }

    if ('ready' === gamestate.mstate) {
      if (/^start$/i.test(cmd)) {
        startRound();
      }
    }
  }

  function startRound() {
    gamestate.active = true;
    gamestate.word = gamestate.words.pop();
    if (!gamestate.word) {
      simpleBroadcast("Game over");
      return;
    }
    simpleBroadcast("Rearrange these characters into the word I'm thinking of: "
      + shuffle(gamestate.word.split('')).join(''));
  }

  function handleMessage(from, text) {
    var player = gamestate.players[from]
      , cmd = text.trim().toLowerCase()
      , msg
      ;

    if (from === gamestate.master) {
      handleMasterMessage(cmd, text);
      return;
    }

    if (/^STOP$/i.test(cmd)) {
      player = gamestate.players[from] || {};
      delete gamestate.players[from];
      simpleSend(from, 'you have been removed from the game');
      if (player) {
        simpleSend(gamestate.master, (player.name || player.number) + ' left the game');
      }
      return;
    }

    log.log('cmd 0:', cmd);
    if (!gamestate.active) {
      log.log('cmd:', cmd);
      if (/^join$/i.test(cmd)) {
        player = gamestate.players[from] = { number: from, state: 'join', points: 0 };
        simpleSend(from, "Welcome to Mixed Up Words competition, Player "
          + Object.keys(gamestate.players).length
          + ",  What's your name?");
        player.state = 'name';
        return;
      }

      if ('name' === player.state) {
        player.name = text;
        player.state = 'ready'; // pending -> let the game master accept
        msg = "Hey, " + player.name + ", you're application has been submitted and we'll let you know when the games begins.";
        simpleSend(from, msg);
        playerAdded(player);
        return;
      }

      simpleSend(from, "Unrecognized command. Please wait for the next round or text STOP to leave the game.");
    } else if (gamestate.active) {
      if (cmd === gamestate.word) {
        gamestate.active = false;
        player.points += 1;
        msg = player.name + " guessed " + gamestate.word + " and won this round!\n";

        msg += getLeaderboard();

        simpleBroadcast(msg);
        simpleSend(gamestate.master, "send 'start' to begin the next round");
      } else {
        simpleSend(from, "WRONG. Try Again");
      }
      // TODO it's a guess
    } else {
    }
  }

  function getLeaderboard() {
    var msg = ''
      ;

    Object.keys(gamestate.players).sort(function (a, b) {
      return a.points - b.points;
    }).forEach(function (k) {
      var p = gamestate.players[k]
        ;

      if (p.name) {
        msg += p.points + ": " + p.name + ' \n';
      }
    });

    return msg;
  }

  function simpleBroadcast(msg) {
    var to = []
      ;

    Object.keys(gamestate.players).forEach(function (k) {
      var p = gamestate.players[k]
        ;

      to.push(p.number);
    });
    to.push(gamestate.master);

    simpleSend(to, msg);
  }

  function showMessages(id) {
    // BUG in the v3.x nightlies MozSmsFilter disappeared
    //var filter = new window.MozSmsFilter() // https://developer.mozilla.org/en-US/docs/Web/API/MozSmsFilter
    var cursor;

    /*
    filter.read = false;
    if ('undefined' !== typeof id) {
      filter.threadId = id;
    }
    */

    // Get the messages from the latest to the first
    cursor = navigator.mozMobileMessage.getMessage(id);
    //cursor = navigator.mozMobileMessage.getMessages(null, true);
    //cursor = navigator.mozMobileMessage.getMessages(filter, true);

    // we're just getting the first message, so no worries on the filter and such
    cursor.onsuccess = function () {
      var msg = this.result;

      /*
      navigator.mozMobileMessage.
      MozMobileMessageManager.markMessageRead(id, isRead)
      MozSmsManager.markMessageRead(id, isRead)
      */
      log.log(msg.sender + ': ' + msg.body);
      handleMessage(msg.sender, msg.body);
      /*
      var message = this.result
        , time = message.timestamp.toDateString()
        ;

      console.log(time + ': ' + (message.body || message.subject)); // SMS || MMS
      $("#response").append("<div>Got new message [" + time + "]"
        + "<br>" + (message.body || message.subject)
        + "</div>"
      );

      if (!this.done) {
        this.continue();
      }
      */
    };
  }

  function listenForSms() {
    log.log('Initializing SMS Listener (requires sending)');
    if (!gamestate.master) {
      log.error('Game Master number was not set. Please close and reopen the app.');
      return false;
    }

    var requests = navigator.mozMobileMessage.send(
          [gamestate.master]
        , "How many players should we wait for?"
        )
      ;

    gamestate.mstate = 'numplayers';

    requests.forEach(function (request) {
      request.onsuccess = function () {
        // TODO send confirm
        log.log('[sent] ' + Object.keys(this.result));
        log.log(this.result);
      };
      request.onerror = function () {
        // TODO send error
        log.error('[error] ' + this.result);
        log.error(this.error.name + ':' + this.error.message);
        log.error(JSON.stringify(this.error));
        log.error(this.error.toString());
      };
    });

    navigator.mozMobileMessage.addEventListener('received', function (msg) {
      // https://developer.mozilla.org/en-US/docs/Web/API/MozSmsMessage
      log.log("SMS received");
      log.log(JSON.stringify(msg));

      showMessages(msg.id);
    });
  }

  function init() {
    // Receive the push notifications
    if (window.navigator.mozSetMessageHandler) {
      listenForSms();
    } else {
      // No message handler
      log("mozSetMessageHandler missing");
    }
  }
});
