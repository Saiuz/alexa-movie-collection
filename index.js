"use strict";

var Alexa = require("alexa-sdk");
var logHelper = require('./logHelper');

var states = {
    WATCHED_MODE: '_WATCHED_MODE',

}

var handlers = {
    "NewSession": function() {
        logHelper.logSessionStarted(this.event.session);
        this.emit(":ask", "What movie have you watched?")
    },

    "AddWatchedMovieIntent": function() {
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
    'EndSession' : function (message) {
        console.log("Session Ended with message:" + message);
        this.emit(':saveState', true);
    },
    "Unhandled": function () {
        console.log("unhandled");
        var speechOutput = "Please start over again";
        this.emit(":ask", speechOutput, speechOutput);
    }
}

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.appId = "amzn1.ask.skill.4d4ca562-4f28-41b1-8547-d88dd2b26716";
    alexa.registerHandlers(handlers);
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
