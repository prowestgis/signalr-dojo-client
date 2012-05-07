dojo.provide("pwa.signalR.transports.WebSockets");

dojo.require("pwa.signalR");
dojo.require("pwa.signalR._TransportLogic");

dojo.declare("pwa.signalR.transports.WebSockets", [ pwa.signalR._TransportLogic ], {

    name: "webSockets",

    send: function (connection, data) {
        connection.socket.send(data);
    },

    start: function (connection, onSuccess, onFailed) {
        var url,
            opened = false,
            protocol;

        if (window.MozWebSocket) {
            window.WebSocket = window.MozWebSocket;
        }

        if (!window.WebSocket) {
            onFailed();
            return;
        }

        if (!connection.socket) {
            if (connection.webSocketServerUrl) {
                url = connection.webSocketServerUrl;
            }
            else {
                // Determine the protocol
                protocol = document.location.protocol === "https:" ? "wss://" : "ws://";

                url = protocol + document.location.host + connection.appRelativeUrl;
            }

            // Build the url
            connection.onSending();
            if (connection.data) {
                url += "?connectionData=" + connection.data + "&transport=webSockets&connectionId=" + connection.id;
            } else {
                url += "?transport=webSockets&connectionId=" + connection.id;
            }

            connection.socket = new window.WebSocket(url);
            connection.socket.onopen = function () {
                opened = true;
                if (onSuccess) {
                    onSuccess();
                }
            };

            connection.socket.onclose = function (event) {
                if (!opened) {
                    if (onFailed) {
                        onFailed();
                    }
                } else if (typeof event.wasClean != "undefined" && event.wasClean === false) {
                    // Ideally this would use the websocket.onerror handler (rather than checking wasClean in onclose) but
                    // I found in some circumstances Chrome won't call onerror. This implementation seems to work on all browsers.
                    connection.onError();
                    // TODO: Support reconnect attempt here, need to ensure last message id, groups, and connection data go up on reconnect
                }
                connection.socket = null;
            };

            connection.socket.onmessage = function (event) {
                var data = dojo.fromJson(event.data);
                if (data) {
                    if (data.Messages) {
                        dojo.forEach(data.Messages, function (msg) {
                            try {
                                connection.onReceived(msg);
                            }
                            catch (e) {
                                this.log("Error raising received " + e, connection.logging);
                            }
                        });
                    } else {
                        connection.onReceived(data);
                    }
                }
            };
        }
    },

    stop: function (connection) {
        if (connection.socket !== null) {
            connection.socket.close();
            connection.socket = null;
        }
    }
});

// Register this transport
pwa.signalR.manifest.webSockets = "pwa.signalR.transports.WebSockets";