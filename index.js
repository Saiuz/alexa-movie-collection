'use strict';

// Configurations
var SESSION_TABLE = 'AlexaMovieHistorySessions';
var MOVIE_HISTORY_TABLE = 'WatchedMovies';

var Alexa = require('alexa-sdk');
var AWS = require('aws-sdk');
var logHelper = require('./logHelper');

var EntryService = function() {
    console.log('Initating new EntryService instance.');
    this.dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    this.tableName = MOVIE_HISTORY_TABLE;
    console.log('EntryService initialized.');
};

EntryService.prototype.add = function(userId, title, date, callback) {
    // TODO: Handle other ISO-8601 date format.
    // See: https://goo.gl/gk2RYJ#date
    var tableName = this.tableName;
    var params = {
        TableName: tableName,
        Item: {
            UserId: { S: userId.toString() },
            TitleWithDate: { S: title + date },
            Title: { S: title },
            WatchedDate: { S: date },
            createdOn: { N: (new Date().getTime()).toString() }
        }
    };
    console.log('%j', params);
    this.dynamodb.putItem(params, callback);
};

var states = {
    ADD_MODE: '_ADD_MODE',
    REVIEW_MODE: '_REVIEW_MODE'
};

var handlers = {
    'NewSession': function() {
        logHelper.logSessionStarted(this.event.session);
        this.emit(':ask', 'Do you want to add a new movie, or review your movie history?');
    },

    'MainMenuIntent': function() {
        console.log(this.event.request);
        var filledSlots = delegateSlotCollection.call(this);
        console.log(this.event.request.intent.slots.choice.value);
        var choice = this.event.request.intent.slots.choice.value;

        if (choice === 'review') {
            console.log('Entering review mode ...')
            this.handler.state = states.REVIEW_MODE;
            this.emit('LaunchReview');
        } else {
            console.log('Entering add mode ...')
            this.handler.state = states.ADD_MODE;
            this.emit('LaunchAdd');
        }
    },

    'LaunchAdd': function() {
        console.log('Prompting the user to provide movie information.')
        this.emit(':ask', 'Tell me about the movie you watched.');
    },

    'LaunchReview': function() {
        console.log('Prompting the user to provide review choices.');
        this.emit(':ask', 'OK! You can review an overall summary of your movie history or inquiry your watch history of one movie. Tell me what do you want to know.');
    },

    'EndSession' : function (message) {
        console.log('Session Ended with message:' + message);
        this.emit(':saveState', true);
    },

    'Unhandled': function () {
        console.log('unhandled');
        var speechOutput = 'Please start over again';
        this.emit(':ask', speechOutput, speechOutput);
    }
};

var stateHandlers = {
    addModeIntentHandlers : Alexa.CreateStateHandler(states.ADD_MODE, {

        'AddWatchedMovieIntent': function() {
            console.log('Enter AddWatchedMovieIntent handler');
            var filledSlots = delegateSlotCollection.call(this);
            console.log(filledSlots);
            console.log('Start adding process...');
            var movie = this.event.request.intent.slots.movie.value;
            var date = this.event.request.intent.slots.date.value;
            var logMsg = {
                'eventType': this.event.request.eventType,
                'movie': movie,
                'date': date
            }
            console.log('parsed message %j', logMsg);

            var userId = this.event.session.user.userId;
            console.log('userId: ' + userId);

            var message = 'OK, you have watched ' + movie + ' on ' + date;
            (new EntryService()).add(userId, movie, date, (err, data) => {
                console.log('putItem callback:')
                if (err) {
                    console.log(err, err.stack);
                    this.emit(':tell', 'Sorry, I couldn\'t save it to your movie history. Something went wrong.');
                } else {
                    console.log(data);
                    this.emit(':tell', message);
                }
            });
        },

        'Unhandled': function() {
            console.log('unhandled in add mode');
            var speechOutput = 'I don\'t kown what to add. Please start over again.';
            this.emit(':tell', speechOutput, speechOutput);
        }
    }),

    reviewModeIntentHandlers : Alexa.CreateStateHandler(states.REVIEW_MODE, {
        'InquiryMovieIntent': function() {
            console.log('Handle InquiryMovieIntent');
            var filledSlots = delegateSlotCollection.call(this);
            console.log(filledSlots);
            console.log('Start inquiry process...');
            var movie = this.event.request.intent.slots.movie.value;
            var logMsg = {
                'eventType': this.event.request.eventType,
                'movie': movie,
            }
            console.log('parsed message %j', logMsg);
            this.emit(':tell', 'I\'ll let you know more about ' + movie + ' very soon.');
        },

        'ReviewHistoryIntent': function() {
            console.log('Handle ReviewHistoryIntent');
            this.emit(':tell', 'I can give you the summary only until Bowen has finished his coding.');
        },

        'Unhandled': function () {
            console.log('unhandled in review mode');
            var speechOutput = 'I don\'t kown what to do. Please start over again.';
            this.emit(':tell', speechOutput, speechOutput);
        }
    })
};


exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.appId = 'amzn1.ask.skill.4d4ca562-4f28-41b1-8547-d88dd2b26716';
    alexa.registerHandlers(
        handlers,
        stateHandlers.addModeIntentHandlers,
        stateHandlers.reviewModeIntentHandlers);
    alexa.execute();
};

function delegateSlotCollection(){
    console.log('in delegateSlotCollection');
    console.log('current dialogState: ' + this.event.request.dialogState);
    if (this.event.request.dialogState === 'STARTED') {
      console.log('in Beginning');
      var updatedIntent=this.event.request.intent;
      //optionally pre-fill slots: update the intent object with slot values for which
      //you have defaults, then return Dialog.Delegate with this updated intent
      // in the updatedIntent property
      this.emit(':delegate', updatedIntent);
    } else if (this.event.request.dialogState !== 'COMPLETED') {
      console.log('in not completed');
      // return a Dialog.Delegate directive with no updatedIntent property.
      this.emit(':delegate');
    } else {
      console.log('in completed');
      console.log('returning: '+ JSON.stringify(this.event.request.intent));
      // Dialog is now complete and all required slots should be filled,
      // so call your normal intent handler.
      return this.event.request.intent;
    }
}
