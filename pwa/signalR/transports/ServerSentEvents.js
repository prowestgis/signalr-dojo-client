dojo.provide("pwa.signalR.transports.ServerSentEvents");

dojo.require("pwa.signalR");
dojo.require("pwa.signalR._TransportLogic");
		
dojo.declare("pwa.signalR.transports.ServerSentEvents", [ pwa.signalR._TransportLogic ], {

    name: "serverSentEvents",

    timeOut: 3000,

    start: function (connection, onSuccess, onFailed) {
        var that = this,
            opened = false,
            reconnecting = !onSuccess,
            url,
            connectTimeOut;

        if (connection.eventSource) {
            connection.stop();
        }

        if (!window.EventSource) {
            if (onFailed) {
                onFailed();
            }
            return;
        }

        connection.onSending();

        url = this.getUrl(connection, this.name, reconnecting);

        try {
            connection.eventSource = new window.EventSource(url);
        }
        catch (e) {
            this.log("EventSource failed trying to connect with error " + e.Message, connection.logging);
            if (onFailed) {
                // The connection failed, call the failed callback
                onFailed();
            }
            else {
                connection.onError(e);
                if (reconnecting) {
                    // If we were reconnecting, rather than doing initial connect, then try reconnect again
                    this.log("EventSource reconnecting", connection.logging);
                    that.reconnect(connection);
                }
            }
            return;
        }

        // After connecting, if after the specified timeout there's no response stop the connection
        // and raise on failed
        connectTimeOut = window.setTimeout(function () {
            if (opened === false) {
                this.log("EventSource timed out trying to connect", connection.logging);

                if (onFailed) {
                    onFailed();
                }

                if (reconnecting) {
                    // If we were reconnecting, rather than doing initial connect, then try reconnect again
                    this.log("EventSource reconnecting", connection.logging);
                    that.reconnect(connection);
                } else {
                    that.stop(connection);
                }
            }
        },
        that.timeOut);

        connection.eventSource.addEventListener("open", function (e) {
            this.log("EventSource connected", connection.logging);

            if (connectTimeOut) {
                window.clearTimeout(connectTimeOut);
            }

            if (opened === false) {
                opened = true;

                if (onSuccess) {
                    onSuccess();
                }

                if (reconnecting) {
                    connection.onReconnect();
                }
            }
        }, false);

        connection.eventSource.addEventListener("message", function (e) {
            // process messages
            if (e.data === "initialized") {
                return;
            }
            this.processMessages(connection, dojo.fromJson(e.data));
        }, false);

        connection.eventSource.addEventListener("error", function (e) {
            if (!opened) {
                if (onFailed) {
                    onFailed();
                }
                return;
            }

            this.log("EventSource readyState: " + connection.eventSource.readyState, connection.logging);

            if (e.eventPhase === window.EventSource.CLOSED) {
                // connection closed
                if (connection.eventSource.readyState === window.EventSource.CONNECTING) {
                    // We don't use the EventSource's native reconnect function as it
                    // doesn't allow us to change the URL when reconnecting. We need
                    // to change the URL to not include the /connect suffix, and pass
                    // the last message id we received.
                    this.log("EventSource reconnecting due to the server connection ending", connection.logging);
                    that.reconnect(connection);
                }
                else {
                    // The EventSource has closed, either because its close() method was called,
                    // or the server sent down a "don't reconnect" frame.
                    this.log("EventSource closed", connection.logging);
                    that.stop(connection);
                }
            } else {
                // connection error
                this.log("EventSource error", connection.logging);
                connection.onError();
            }
        }, false);
    },

    reconnect: function (connection) {
        var that = this;
        window.setTimeout(function () {
            that.stop(connection);
            that.start(connection);
        }, connection.reconnectDelay);
    },

    send: function (connection, data) {
        this.ajaxSend(connection, data);
    },

    stop: function (connection) {
        if (connection && connection.eventSource) {
            connection.eventSource.close();
            connection.eventSource = null;
            delete connection.eventSource;
        }
    }
});

// Register the transport
pwa.signalR.manifest.serverSentEvents = "pwa.signalR.transports.ServerSentEvents";