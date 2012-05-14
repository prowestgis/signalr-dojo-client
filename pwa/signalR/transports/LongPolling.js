dojo.provide("pwa.signalR.transports.LongPolling");

dojo.require("pwa.signalR");
dojo.require("pwa.signalR._TransportLogic");

dojo.declare("pwa.signalR.transports.LongPolling", [ pwa.signalR._TransportLogic ], {

    name: "longPolling",

    reconnectDelay: 3000,

    constructor: function() {    	
    },
    
    start: function (connection, onSuccess, onFailed) {
        /// <summary>Starts the long polling connection</summary>
        /// <param name="connection" type="signalR">The SignalR connection to start</param>
        var that = this;
        if (connection.pollXhr) {
            connection.stop();
        }

        connection.messageId = null;

        window.setTimeout(function () {
            (function poll(instance, raiseReconnect) {
                instance.onSending();

                var messageId = instance.messageId,
                    connect = (messageId === null),
                    url = that.getUrl(instance, that.name, !connect),
                    reconnectTimeOut = null,
                    reconnectFired = false;

                instance.pollXhr = dojo.xhrGet({
                    url: url,
                    handleAs: "json",
                    // handleAs: connection.ajaxDataType ??
                    load: function (data) {
                        var delay = 0,
                            timedOutReceived = false;

                        if (raiseReconnect === true) {
                            // Fire the reconnect event if it hasn't been fired as yet
                            if (reconnectFired === false) {
                                instance.onReconnect();
                                reconnectFired = true;
                            }
                        }

                        that.processMessages(instance, data);
                        if (data && 
                            data.TransportData &&
                            typeof data.TransportData.LongPollDelay === "number") {
                            delay = data.TransportData.LongPollDelay;
                        }

                        if (data && data.TimedOut) {
                            timedOutReceived = data.TimedOut;
                        }

                        if (delay > 0) {
                            window.setTimeout(function () {
                                poll(instance, timedOutReceived);
                            }, delay);
                        } else {
                            poll(instance, timedOutReceived);
                        }
                    },

                    error: function (data, textStatus) {
                        if (textStatus === "abort") {
                            return;
                        }

                        if (reconnectTimeOut) {
                            // If the request failed then we clear the timeout so that the 
                            // reconnect event doesn't get fired
                            clearTimeout(reconnectTimeOut);
                        }

                        instance.onError(data);

                        window.setTimeout(function () {
                            poll(instance, true);
                        }, connection.reconnectDelay);
                    }
                });

                if (raiseReconnect === true) {
                    reconnectTimeOut = window.setTimeout(function () {
                        if (reconnectFired === false) {
                            instance.onReconnect();
                            reconnectFired = true;
                        }
                    },
                    that.reconnectDelay);
                }

            } (connection));

            // Now connected
            // There's no good way know when the long poll has actually started so 
            // we assume it only takes around 150ms (max) to start the connection
            window.setTimeout(onSuccess, 150);

        }, 250); // Have to delay initial poll so Chrome doesn't show loader spinner in tab
    },

    send: function (connection, data) {
        this.ajaxSend(connection, data);
    },

    stop: function (connection) {
        /// <summary>Stops the long polling connection</summary>
        /// <param name="connection" type="signalR">The SignalR connection to stop</param>
        if (connection.pollXhr) {
            connection.pollXhr.abort();
            connection.pollXhr = null;
            delete connection.pollXhr;
        }
    }
});

//Register the transport
pwa.signalR.manifest.longPolling = "pwa.signalR.transports.LongPolling";