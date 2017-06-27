"use strict";

var Alexa = require("alexa-sdk");
var logHelper = require('./logHelper');

var states = {
    ADD_MODE: "_ADD_MODE",
    REVIEW_MODE: "_REVIEW_MODE"
}

var handlers = {
    "NewSession": function() {
        logHelper.logSessionStarted(this.event.session);
        this.emit(":ask", "Do you want to add a new movie, or review your movie history?");
    },

    "MainMenuIntent": function() {
        console.log(this.event.request);
        var filledSlots = delegateSlotCollection.call(this);
        console.log(this.event.request.intent.slots.choice.value);
        var choice = this.event.request.intent.slots.choice.value;

        if (choice === "review") {
            console.log("Entering review mode ...")
            this.handler.state = states.REVIEW_MODE;
            this.emit('LaunchReview');
        } else {
            console.log("Entering add mode ...")
            this.handler.state = states.ADD_MODE;
            this.emit('LaunchAdd');
        }
    },

    'LaunchAdd': function() {
        console.log('entered LaunchAdd intent handler...')
        this.emit(':ask', 'Tell me about the movie you watched.');
    },

    'EndSession' : function (message) {
        console.log("Session Ended with message:" + message);
        this.emit(':saveState', true);
    },

    "Unhandled": function () {
        console.log("unhandled");
        var speechOutput = "Please start over again";
        this.emit(":ask", speechOutput, speechOutput);
    }
};

var stateHandlers = {
    addModeIntentHandlers : Alexa.CreateStateHandler(states.ADD_MODE, {

        'AddWatchedMovieIntent': function() {
            console.log(this.event.request);
            var filledSlots = delegateSlotCollection.call(this);
            var movie = this.event.request.intent.slots.movie.value;
            var date = this.event.request.intent.slots.date.value;
            var message = "OK, you have watched " + movie + " on " + date;
            var logMsg = {
                "eventType": this.event.request.eventType,
                "movie": movie,
                "date": date
            }
            console.log("%j", logMsg);
            this.emit(":tell", message);
        },
    }),

    reviewModeIntentHandlers : Alexa.CreateStateHandler(states.REVIEW_MODE, {

    })
};


exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.appId = "amzn1.ask.skill.4d4ca562-4f28-41b1-8547-d88dd2b26716";
    alexa.registerHandlers(
        handlers,
        stateHandlers.addModeIntentHandlers,
        stateHandlers.reviewModeIntentHandlers);
    alexa.execute();
};

function delegateSlotCollection(){
    console.log("in delegateSlotCollection");
    console.log("current dialogState: "+this.event.request.dialogState);
    if (this.event.request.dialogState === "STARTED") {
      console.log("in Beginning");
      var updatedIntent=this.event.request.intent;
      //optionally pre-fill slots: update the intent object with slot values for which
      //you have defaults, then return Dialog.Delegate with this updated intent
      // in the updatedIntent property
      this.emit(":delegate", updatedIntent);
    } else if (this.event.request.dialogState !== "COMPLETED") {
      console.log("in not completed");
      // return a Dialog.Delegate directive with no updatedIntent property.
      this.emit(":delegate");
    } else {
      console.log("in completed");
      console.log("returning: "+ JSON.stringify(this.event.request.intent));
      // Dialog is now complete and all required slots should be filled,
      // so call your normal intent handler.
      return this.event.request.intent;
    }
}
