Handlebars.registerHelper('toCapitalCase', function(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
});

function initUserLanguage() {
  var language = amplify.store("language");

  if (language){
    Session.set("language", language);
  }

  setUserLanguage(getUserLanguage());
}

function getUserLanguage() {
  var language = Session.get("language");

  if (language){
    return language;
  } else {
    return "en";
  }
};

function setUserLanguage(language) {
  TAPi18n.setLanguage(language).done(function () {
    Session.set("language", language);
    amplify.store("language", language);
  });
}

function getLanguageDirection() {
  var language = getUserLanguage()
  var rtlLanguages = ['he', 'ar'];

  if ($.inArray(language, rtlLanguages) !== -1) {
    return 'rtl';
  } else {
    return 'ltr';
  }
}

function getLanguageList() {
  var languages = TAPi18n.getLanguages();
  var languageList = _.map(languages, function(value, key) {
    var selected = "";
    
    if (key == getUserLanguage()){
      selected = "selected";
    }

    // Gujarati isn't handled automatically by tap-i18n,
    // so we need to set the language name manually
    if (value.name == "gu"){
        value.name = "ગુજરાતી";
    }

    return {
      code: key,
      selected: selected,
      languageDetails: value
    };
  });
  
  if (languageList.length <= 1){
    return null;
  }
  
  return languageList;
}

function getCurrentGame(){
  var gameID = Session.get("gameID");

  if (gameID) {
    return Games.findOne(gameID);
  }
}

function getAccessLink(){
  var game = getCurrentGame();

  if (!game){
    return;
  }

  return Meteor.settings.public.url + game.accessCode + "/";
}


function getCurrentPlayer(){
  var playerID = Session.get("playerID");

  if (playerID) {
    return Players.findOne(playerID);
  }
}

function generateAccessCode(){
  var code = "";
  var possible = "abcdefghijklmnopqrstuvwxyz";

    for(var i=0; i < 6; i++){
      code += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return code;
}

function generateNewGame(){
  var game = {
    accessCode: generateAccessCode(),
    state: "waitingForPlayers",
    yesCount: 0,
    noCount: 0,
    passCount: 0,
    failCount: 0,
    expMission: [2,3,2,3,3],
    mission: 0,
    curNumPlayers: 0,
    readyToConfirm: false,
    missionSuccess: 0
  };

  var gameID = Games.insert(game);
  game = Games.findOne(gameID);

  return game;
}


function rotateChoosing(){
    var game = getCurrentGame();
    var players = Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();
    players.forEach(function(player, index){
    if(player.isChoosing == true) {
      Players.update(player._id, {$set: {isChoosing: false}});
      Players.update((players[((index + 1) % players.length)])._id, {$set:
                     {isChoosing: true}});
      return;
    }
  });
}

// CHANGE THIS
function generateNewPlayer(game, name){
  var player = {
    gameID: game._id,
    name: name,
    good: true,
    role: "Loyal Servant of Arthur",
    onMission: false,
    yesVote: false,
    noVote: false,
    hasVotePass: false,
    isChoosing: false,
  };
  var playerID = Players.insert(player);
  return Players.findOne(playerID);
}

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

// CHANGE THIS 
function assignRoles(players) {
  var badIndex1 = Math.floor(Math.random() * players.count());
  var badIndex2 = (badIndex1 + Math.floor(Math.random() * (players.count() - 1) + 1)) %
               players.count();

  players.forEach(function(player, index){
    if(index === badIndex1 || index === badIndex2) {
      Players.update(player._id, {$set: {good: false, role: "Minion of Mordred"}});
    }
  });
}

function resetUserState(){
  var player = getCurrentPlayer();

  if (player){
    Players.remove(player._id);
  }

  Session.set("gameID", null);
  Session.set("playerID", null);
}

function trackGameState () {
  var gameID = Session.get("gameID");
  var playerID = Session.get("playerID");

  if (!gameID || !playerID){
    return;
  }

  var game = Games.findOne(gameID);
  var player = Players.findOne(playerID);

  if (!game || !player){
    Session.set("gameID", null);
    Session.set("playerID", null);
    Session.set("currentView", "startMenu");
    return;
  }

  if(game.state === "inProgress") {
    Session.set("currentView", "gameView");
  } 
  else if(game.state === "waitingForPlayers") {
    Session.set("currentView", "lobby");
  }
  else if(game.state === "votingRound") {
    Session.set("currentView", "votingRound");
  }
  else if(game.state === "voting") {
    if(player.good && player.onMission) {
      Session.set("currentView", "voteMissionGood");
    }
    else if (player.onMission) {
      Session.set("currentView", "voteMissionBad");
    }
    else {
      Session.set("currentView", "waitMissionComplete");
    }
  }

  if (game.missionSuccess == 3) {
    Session.set("currentView", "gameWin");
  }
  else if (game.mission - game.missionSuccess == 3) {
    Session.set("currentView", "gameLose");
  }
  
}

function leaveGame () {  
  GAnalytics.event("game-actions", "gameleave");
  var player = getCurrentPlayer();

  Session.set("currentView", "startMenu");
  Players.remove(player._id);

  Session.set("playerID", null);
}

function hasHistoryApi () {
  return !!(window.history && window.history.pushState);
}

initUserLanguage();

Meteor.setInterval(function () {
  Session.set('time', new Date());
}, 1000);

if (hasHistoryApi()){
  function trackUrlState () {
    var accessCode = null;
    var game = getCurrentGame();
    if (game){
      accessCode = game.accessCode;
    } else {
      accessCode = Session.get('urlAccessCode');
    }
    
    var currentURL = '/';
    if (accessCode){
      currentURL += accessCode+'/';
    }
    window.history.pushState(null, null, currentURL);
  }
  Tracker.autorun(trackUrlState);
}
Tracker.autorun(trackGameState);

FlashMessages.configure({
  autoHide: true,
  autoScroll: false
});

Template.main.helpers({
  whichView: function() {
    return Session.get('currentView');
  },
  language: function() {
    return getUserLanguage();
  },
  textDirection: function() {
    return getLanguageDirection();
  }
});

Template.footer.helpers({
  languages: getLanguageList
})

Template.footer.events({
  'click .btn-set-language': function (event) {
    var language = $(event.target).data('language');
    setUserLanguage(language);
    GAnalytics.event("language-actions", "set-language-" + language);
  },
  'change .language-select': function (event) {
    var language = event.target.value;
    setUserLanguage(language);
    GAnalytics.event("language-actions", "set-language-" + language);
  }
})

Template.startMenu.events({
  'click #btn-new-game': function () {
    Session.set("currentView", "createGame");
  },
  'click #btn-join-game': function () {
    Session.set("currentView", "joinGame");
  }
});

Template.startMenu.helpers({
  alternativeURL: function() {
    return Meteor.settings.public.alternative;
  }
});

Template.startMenu.rendered = function () {
  GAnalytics.pageview("/");

  resetUserState();
};

Template.createGame.events({
  'submit #create-game': function (event) {
    GAnalytics.event("game-actions", "newgame");

    var playerName = event.target.playerName.value;

    if (!playerName) {
      return false;
    }

    var game = generateNewGame();
    var player = generateNewPlayer(game, playerName);

    Meteor.subscribe('games', game.accessCode);

    Session.set("loading", true);
    
    Meteor.subscribe('players', game._id, function onReady(){
      Session.set("loading", false);

      Session.set("gameID", game._id);
      Session.set("playerID", player._id);
      Session.set("currentView", "lobby");
    });

    return false;
  },
  'click .btn-back': function () {
    Session.set("currentView", "startMenu");
    return false;
  }
});

Template.createGame.helpers({
  isLoading: function() {
    return Session.get('loading');
  }
});

Template.createGame.rendered = function (event) {
  $("#player-name").focus();
};

Template.joinGame.events({
  'submit #join-game': function (event) {
    GAnalytics.event("game-actions", "gamejoin");

    var accessCode = event.target.accessCode.value;
    var playerName = event.target.playerName.value;

    if (!playerName) {
      return false;
    }

    accessCode = accessCode.trim();
    accessCode = accessCode.toLowerCase();

    Session.set("loading", true);

    Meteor.subscribe('games', accessCode, function onReady(){
      Session.set("loading", false);

      var game = Games.findOne({
        accessCode: accessCode
      });

      if (game) {
        Meteor.subscribe('players', game._id);
        player = generateNewPlayer(game, playerName);

        Session.set('urlAccessCode', null);
        Session.set("gameID", game._id);
        Session.set("playerID", player._id);
        Session.set("currentView", "lobby");
      } else {
        FlashMessages.sendError(TAPi18n.__("ui.invalid access code"));
        GAnalytics.event("game-actions", "invalidcode");
      }
    });

    return false;
  },
  'click .btn-back': function () {
    Session.set('urlAccessCode', null);
    Session.set("currentView", "startMenu");
    return false;
  }
});

Template.joinGame.helpers({
  isLoading: function() {
    return Session.get('loading');
  }
});


Template.joinGame.rendered = function (event) {
  resetUserState();

  var urlAccessCode = Session.get('urlAccessCode');

  if (urlAccessCode){
    $("#access-code").val(urlAccessCode);
    $("#access-code").hide();
    $("#player-name").focus();
  } else {
    $("#access-code").focus();
  }
};

Template.lobby.helpers({
  game: function () {
    return getCurrentGame();
  },
  accessLink: function () {
    return getAccessLink();
  },
  player: function () {
    return getCurrentPlayer();
  },
  players: function () {
    var game = getCurrentGame();
    var currentPlayer = getCurrentPlayer();

    if (!game) {
      return null;
    }

    var players = Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();

    players.forEach(function(player){
      if (player._id === currentPlayer._id){
        player.isCurrent = true;
      }
    });

    return players;
  }
});


// CHANGE THIS
Template.lobby.events({
  'click .btn-leave': leaveGame,
  'click .btn-start': function () {
    GAnalytics.event("game-actions", "gamestart");

    var game = getCurrentGame();
    var players = Players.find({gameID: game._id});

    if (players.count() < 5){
      window.alert("Need at least 5 players to start the game");
      return;
    }

    var firstPlayerIndex = Math.floor(Math.random() * players.count());

    players.forEach(function(player,index){
      Players.update(player._id, {$set: {
        isChoosing: index === firstPlayerIndex
      }});
    });

    /*players.forEach(function(player, index){
      Players.update(player._id, {$set: {
        isSpy: index === spyIndex,
        isFirstPlayer: index === firstPlayerIndex
      }});
    });*/

    assignRoles(players);
    
    Games.update(game._id, {$set: {state: 'inProgress'}});
  },
  'click .btn-toggle-qrcode': function () {
    $(".qrcode-container").toggle();
  },
  
  'click .btn-remove-player': function (event) {
    var playerID = $(event.currentTarget).data('player-id');
    Players.remove(playerID);
  },
  'click .btn-edit-player': function (event) {
    var game = getCurrentGame();
    resetUserState();
    Session.set('urlAccessCode', game.accessCode);
    Session.set('currentView', 'joinGame');
  }
});

Template.lobby.rendered = function (event) {
  var url = getAccessLink();
  var qrcodesvg = new Qrcodesvg(url, "qrcode", 250);
  qrcodesvg.draw();
};

Template.gameView.helpers({
  game: getCurrentGame,
  player: getCurrentPlayer,
  players: function () {
    var game = getCurrentGame();
    
    if (!game){
      return null;
    }

    var players = Players.find({
      'gameID': game._id
    });

    return players;
  }
});

Template.gameView.events({
  'click .btn-leave': leaveGame,
  'click .btn-end': function () {
    GAnalytics.event("game-actions", "gameend");

    var game = getCurrentGame();
    Games.update(game._id, {$set: {state: 'waitingForPlayers'}});
  },
  'click .btn-rotate': function () {
    alert("Rotated the leader!");
    rotateChoosing();
  },
  'click .btn-toggle-status': function () {
    $(".status-container-content").toggle();
  },

  'click .btn-confirm-team': function () {
    var game = getCurrentGame();
    Games.update(game._id, {$set: {state: 'votingRound', readyToConfirm: false}});
  },

  'click .btn-choose-player': function (event) {
    var playerID = $(event.currentTarget).data('player-id');
    var toggled = !((Players.findOne(playerID)).onMission);
    var game = getCurrentGame();

    Players.update(playerID, {$set: {onMission: toggled}});
    var curOnMission = 0;
    var players = Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();

    players.forEach(function(player){
      if (player.onMission == true){
        curOnMission++;
      }
    });

    if (curOnMission == game.expMission[game.mission]) {
      Games.update(game._id, {$set: {readyToConfirm: true}});
    }
    else {
      Games.update(game._id, {$set: {readyToConfirm: false}});
    }


  },
});

Template.votingRound.events({
  'click .btn-yes-team': function() {
    //if has not voted, increment
    var game = getCurrentGame();
    var player = getCurrentPlayer();
    var players = Players.find({gameID: game._id});
    // First time
    if(!player.yesVote && !player.noVote) {
      Players.update(player._id, {$set: {yesVote: true}});
      var y = game.yesCount+1;
      Games.update(game._id, {$set: {yesCount: y}});
    }
    // Voted no, switch to yes
    else if(!player.yesVote && player.noVote) {
      Players.update(player._id, {$set: {yesVote: true, noVote: false}});
      var y = game.yesCount+1;
      var n = game.noCount-1;
      Games.update(game._id, {$set: {yesCount: y, noCount: n}});
    }
    // Check the number of votes and see if mission continues
    // if failed, rotate leader
    // else, vote pass/fail
    game = getCurrentGame();
    if((game.yesCount+game.noCount) == players.count()) {
      if(game.yesCount > game.noCount) {
        players.forEach(function(player){
          Players.update(player._id, {$set: {yesVote: false, noVote: false}});
        });
        Games.update(game._id, {$set: {state: 'voting', yesCount: 0, noCount: 0}});
      }
      else {
        rotateChoosing();
        players.forEach(function(player){
          Players.update(player._id, {$set: {yesVote: false, noVote: false}});
        });
        Games.update(game._id, {$set: {yesCount: 0, noCount: 0}});
      }
    }
  },

  'click .btn-no-team': function() {
    //if has not voted, increment
    var game = getCurrentGame();
    var player = getCurrentPlayer();
    var players = Players.find({gameID: game._id});
    // First time voting
    if(!player.noVote && !player.yesVote) {
      Players.update(player._id, {$set: {noVote: true}});
      var n = game.noCount+1;
      Games.update(game._id, {$set: {noCount: n}});
    }
    // Voted yes, switch to no
    else if(!player.noVote && player.yesVote) {
      Players.update(player._id, {$set: {noVote: true, yesVote: false}});
      var y = game.yesCount-1;
      var n = game.noCount+1;
      Games.update(game._id, {$set: {noCount: n, yesCount: y}});
    }

    // Check the number of votes and see if mission continues
    // if failed, rotate leader
    // else, vote pass/fail
    game = getCurrentGame();
    if(game.yesCount+game.noCount == players.count()) {
      if(game.yesCount > game.noCount) {
        players.forEach(function(player){
          Players.update(player._id, {$set: {noVote: false, yesVote: false}});
        });   
        Games.update(game._id, {$set: {state: 'voting', yesCount: 0, noCount: 0}});
      }
      else { 
        rotateChoosing();
        players.forEach(function(player){
          Players.update(player._id, {$set: {noVote: false, yesVote: false}});
        });
        Games.update(game._id, {$set: {yesCount: 0, noCount: 0}});
      }
    }
  }
});

Template.gameWin.events({
  'click .btn-return': function () {
    Session.set("currentView", "lobby");
  }
});

Template.gameLose.events({
  'click .btn-return': function () {
    Session.set("currentView", "lobby");
  }
});

Template.voteMissionGood.events({
  'click .btn-vote-pass': function () {
    // increment pass count
    // MAKE SURE cannot VOTE multiple times
    // create player attribute, "hasPassFail"
    window.alert("You voted to PASS");
    // only do this once everyone has voted
    var game = getCurrentGame();
    var player = getCurrentPlayer();
    var players = Players.find({gameID: game._id});
    if(player.hasVotePass == false) {
      Players.update(player._id, {$set: {hasVotePass: true}});
      var p = game.passCount+1;
      Games.update(game._id, {$set: {passCount: p}});      // only do this once everyone has voted
    }
    game = getCurrentGame();
    if(game.mission == 0 || game.mission == 2) {
      if((game.passCount+game.failCount) == 2) {
        if(game.failCount > 0)
          window.alert("Mission FAILED! There were "+game.failCount+" failures");
        else
        {
          window.alert("Mission SUCCEEDED!");
          var g = game.missionSuccess+1;
          Games.update(game._id, {$set: {missionSuccess: g}});
        }
        m = game.mission+1;
        Games.update(game._id, {$set: {state: 'inProgress', mission: m, failCount: 0, passCount: 0}});
        players.forEach(function(player){
          Players.update(player._id, {$set: {hasVotePass: false}});
        });
      }
      rotateChoosing();
    }
    else if(game.mission == 1 || game.mission >= 3) {
      if((game.passCount+game.failCount) == 3) {
        if(game.failCount > 0)
          window.alert("Mission FAILED! There were "+game.failCount+" failures");
        else
        {
          window.alert("Mission SUCCEEDED!");
          var g = game.missionSuccess+1;
          Games.update(game._id, {$set: {missionSuccess: g}});
        }
        m = game.mission+1;
        Games.update(game._id, {$set: {state: 'inProgress', mission: m, failCount: 0, passCount: 0}});
        players.forEach(function(player){
          Players.update(player._id, {$set: {hasVotePass: false}});
        });
        rotateChoosing();
      }
    }
  }
});

Template.voteMissionBad.events({
  'click .btn-vote-pass': function () {
    window.alert("You voted to PASS");
    var game = getCurrentGame();
    var player = getCurrentPlayer();
    var players = Players.find({gameID: game._id});
    if(player.hasVotePass == false) {
      Players.update(player._id, {$set: {hasVotePass: true}});
      var p = game.passCount+1;
      Games.update(game._id, {$set: {passCount: p}});
    }
    game = getCurrentGame();
    if(game.mission == 0 || game.mission == 2) {
      if((game.passCount+game.failCount) == 2) {
        if(game.failCount > 0)
          window.alert("Mission FAILED! There were "+game.failCount+" failures");
        else
        {
          window.alert("Mission SUCCEEDED!");
          var g = game.missionSuccess+1;
          Games.update(game._id, {$set: {missionSuccess: g}});
        }
        m = game.mission+1;
        Games.update(game._id, {$set: {state: 'inProgress', mission: m, failCount: 0, passCount: 0}});
        players.forEach(function(player){
          Players.update(player._id, {$set: {hasVotePass: false}});
        });
      }
      rotateChoosing();
    }
    else if(game.mission == 1 || game.mission >= 3) {
      if((game.passCount+game.failCount) == 3) {
        if(game.failCount > 0)
          window.alert("Mission FAILED! There were "+game.failCount+" failures");
        else
        {
          window.alert("Mission SUCCEEDED!");
          var g = game.missionSuccess+1;
          Games.update(game._id, {$set: {missionSuccess: g}});
        }
        m = game.mission+1;
        Games.update(game._id, {$set: {state: 'inProgress', mission: m, failCount: 0, passCount: 0}});
        players.forEach(function(player){
          Players.update(player._id, {$set: {hasVotePass: false}});
        });
        rotateChoosing();
      }
    }
  },
  'click .btn-vote-fail': function () {
    window.alert("You voted to FAIL");
    var game = getCurrentGame();
    var player = getCurrentPlayer();
    var players = Players.find({gameID: game._id});
    if(player.hasVotePass == false) {
      Players.update(player._id, {$set: {hasVotePass: true}});
      var p = game.failCount+1;
      Games.update(game._id, {$set: {failCount: p}});
    }
    game = getCurrentGame();
    if(game.mission == 0 || game.mission == 2) {
      if((game.passCount+game.failCount) == 2) {
        if(game.failCount > 0)
          window.alert("Mission FAILED! There were "+game.failCount+" failures");
        else
        {
          window.alert("Mission SUCCEEDED!");
          var g = game.missionSuccess+1;
          Games.update(game._id, {$set: {missionSuccess: g}});
        }
        m = game.mission+1;
        Games.update(game._id, {$set: {state: 'inProgress', mission: m, failCount: 0, passCount: 0}});
        players.forEach(function(player){
          Players.update(player._id, {$set: {hasVotePass: false}});
        });
      }
      rotateChoosing();
    }
    else if(game.mission == 1 || game.mission >= 3) {
      if((game.passCount+game.failCount) == 3) {
        if(game.failCount > 0)
          window.alert("Mission FAILED! There were "+game.failCount+" failures");
        else
        {
          window.alert("Mission SUCCEEDED!");
          var g = game.missionSuccess+1;
          Games.update(game._id, {$set: {missionSuccess: g}});
        }
        m = game.mission+1;
        Games.update(game._id, {$set: {state: 'inProgress', mission: m, failCount: 0, passCount: 0}});
        players.forEach(function(player){
          Players.update(player._id, {$set: {hasVotePass: false}});
        });
        rotateChoosing();
      }
    }
  }
});
