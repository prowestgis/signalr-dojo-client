dojo.provide("pwa.signalR.transports.ForeverFrame");

dojo.require("pwa.signalR");
dojo.require("pwa.signalR._TransportLogic");

dojo.declare("pwa.signalR.transports.ForeverFrame", [ pwa.signalR._TransportLogic ], {

    name: "foreverFrame",

    timeOut: 3000,

    start: function (connection, onSuccess, onFailed) {
        var that = this,
            frameId = (this.foreverFrame.count += 1),
            url,
            connectTimeOut,
            frame = dojo.create("<iframe data-signalr-connection-id='" + connection.id + "' style='position:absolute;width:0;height:0;visibility:hidden;'></iframe>");

        if (window.EventSource) {
            // If the browser supports SSE, don't use Forever Frame
            if (onFailed) {
                onFailed();
            }
            return;
        }

        connection.onSending();

        // Build the url
        url = this.getUrl(connection, this.name);
        url += "&frameId=" + frameId;

        frame.prop("src", url);
        this.foreverFrame.connections[frameId] = connection;

        frame.bind("readystatechange", function () {
            if (dojo.indexOf(["loaded", "complete"], this.readyState) >= 0) {
                that.log("Forever frame iframe readyState changed to " + this.readyState + ", reconnecting", connection.logging);
                that.reconnect(connection);
            }
        });

        connection.frame = frame[0];
        connection.frameId = frameId;

        if (onSuccess) {
            connection.onSuccess = onSuccess;
        }

        dojo.place(frame, dojo.body());

        // After connecting, if after the specified timeout there's no response stop the connection
        // and raise on failed
        connectTimeOut = window.setTimeout(function () {
            if (connection.onSuccess) {
                that.stop(connection);

                if (onFailed) {
                    onFailed();
                }
            }
        }, that.timeOut);
    },

    reconnect: function (connection) {
        var that = this;
        window.setTimeout(function () {
            var frame = connection.frame,
                src = this.getUrl(connection, that.name, true) + "&frameId=" + connection.frameId;
            frame.src = src;
        }, connection.reconnectDelay);
    },

    send: function (connection, data) {
        this.ajaxSend(connection, data);
    },

    receive: this.processMessages,

    stop: function (connection) {
        if (connection.frame) {
            if (connection.frame.stop) {
                connection.frame.stop();
            } else if (connection.frame.document && connection.frame.document.execCommand) {
                connection.frame.document.execCommand("Stop");
            }
            connection.frame.remove();
            delete this.foreverFrame.connections[connection.frameId];
            connection.frame = null;
            connection.frameId = null;
            delete connection.frame;
            delete connection.frameId;
        }
    },

    getConnection: function (id) {
        return this.foreverFrame.connections[id];
    },

    started: function (connection) {
        if (connection.onSuccess) {
            connection.onSuccess();
            connection.onSuccess = null;
            delete connection.onSuccess;
        }
        else {
            // If there's no onSuccess handler we assume this is a reconnect
            connection.onReconnect();
        }
    }
});

//Register the transport
pwa.signalR.manifest.foreverFrame = "pwa.signalR.transports.ForeverFrame";