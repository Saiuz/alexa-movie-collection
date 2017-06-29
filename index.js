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

EntryService.prototype.find = function(userId, title, callback) {
    var tableName = this.tableName;
    var params = {
        TableName: tableName,
        KeyConditionExpression: 'UserId = :pkey and begins_with(TitleWithDate, :skeyPrefix)',
        ExpressionAttributeValues: {
            ':pkey': { S: userId.toString() },
            ':skeyPrefix': { S: title }
        }
    };
    console.log('%j', params);
    this.dynamodb.query(params, callback);
}

EntryService.prototype.getAll = function(userId, callback) {
    var tableName = this.tableName;
    var params = {
        TableName: tableName,
        KeyConditionExpression: 'UserId = :pkey',
        ExpressionAttributeValues: {
            ':pkey': { S: userId.toString() }
        }
    };
    console.log('%j', params);
    this.dynamodb.query(params, callback);
}

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
        this.emit(':ask', 'OK! Do you want to know the total number of movies you\'ve watched<break time="300ms"/>, or inquiry one particular movie?');
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

            var userId = this.event.session.user.userId;
            (new EntryService()).find(userId, movie, (err, data) => {
                console.log('query data callback:');
                if (err) {
                    console.log(err, err.stack);
                    this.emit(':tell', 'Sorry, I wasn\'t able to find the information.');
                } else {
                    console.log(data);
                    console.log(data.Items);

                    var historyMessage;
                    if (data.Count == 0) {
                        historyMessage = 'You haven\'t watched <emphasis level="moderate">' + movie + '</emphasis> yet.';
                    } else if (data.Count == 1) {
                        var watchDate = itemToDateMessage(data.Items[0]);
                        historyMessage = 'You watched <emphasis level="moderate">' + movie + '</emphasis> on ' + watchDate + '.';
                    } else {
                        var dates = data.Items.map(itemToDateMessage);
                        console.log(dates);
                        var lastDate = dates.pop();
                        console.log(dates);
                        console.log(lastDate);
                        var datesMessage = dates.join('<break time="500ms"/>, ') + '<break time="500ms"/> and ' + lastDate;
                        console.log(datesMessage);
                        historyMessage = 'You have watched ' + movie + ' ' + data.Count + ' times, which were on ' + datesMessage + '.';
                    }
                    console.log(historyMessage);
                    this.emit(':tell', historyMessage);
                }
            });
        },

        'TotalNumberIntent': function() {
            console.log('Handle TotalNumberIntent');
            var userId = this.event.session.user.userId;
            (new EntryService()).getAll(userId, (err, data) => {
                console.log('get all data callback:');
                if (err) {
                    console.log(err, err.stack);
                    this.emit(':tell', 'Sorry, I wasn\'t able to find the information.');
                } else {
                    console.log(data);
                    console.log(data.Items);

                    if (data.Count == 0) {
                        this.emit(':tell', 'You haven\'t told me about any movie you\'ve watched yet.');
                    } else if (data.Count == 1) {
                        this.emit(':tell', 'You have watched only one movie.');
                    } else {
                        this.emit(':tell', 'You have watched ' + data.Count + ' movies.');
                    }
                }
            });
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

function itemToDateMessage(item) {
    return '<say-as interpret-as="date">' + item['WatchedDate']['S'] + '</say-as>';
}
