dojo.provide("pwa.signalR._TransportLogic");

dojo.declare("pwa.signalR._TransportLogic", null, {

	log: function() { 
	},
	
    addQs: function (url, connection) {
        if (!connection.qs) {
            return url;
        }

        if (typeof (connection.qs) === "object") {
            return url + "&" + dojo.objectToQuery(connection.qs);
        }

        if (typeof (connection.qs) === "string") {
            return url + "&" + connection.qs;
        }

        return url + "&" + escape(connection.qs.toString());
    },

    getUrl: function (connection, transport, reconnecting) {
        /// <summary>Gets the url for making a GET based connect request</summary>
        var url = connection.url,
            qs = "transport=" + transport + "&connectionId=" + window.escape(connection.id);

        if (connection.data) {
            qs += "&connectionData=" + window.escape(connection.data);
        }

        if (!reconnecting) {
            url = url + "/connect";
        } else {
            if (connection.messageId) {
                qs += "&messageId=" + connection.messageId;
            }
            if (connection.groups) {
                qs += "&groups=" + window.escape(dojo.toJson(connection.groups));
            }
        }
        url += "?" + qs;
        url = this.addQs(url, connection);
        return url;
    },

    ajaxSend: function (connection, data) {
        var url = connection.url + "/send" + "?transport=" + connection.transport.name + "&connectionId=" + window.escape(connection.id);
        url = this.addQs(url, connection);
        // Send data as x-www-form-urlencoded, receive as application/json
        dojo.xhrPost({
            url: url,
            handleAs: "json",
            // handleAs: connection.ajaxDataType ???
            content: {data: data},
            load: function (result) {
                if (result) {
                    connection.onReceived(result);
                }
            },
            error: function (errData, textStatus) {
                if (textStatus === "abort" ||
                    (textStatus === "parsererror" && connection.ajaxDataType === "jsonp")) {
                    return;
                }
                connection.onError(errData);
            }
        });
    },

    processMessages: function (connection, data) {
        if (data) {
            if (data.Disconnect) {
                this.log("Disconnect command received from server", connection.logging);

                // Disconnected by the server
                connection.stop();

                // Trigger the disconnect event
                connection.onDisconnect();
                return;
            }

            if (data.Messages) {
                dojo.forEach(data.Messages, function (msg) {
                    try {
                        connection.onReceived(msg);
                    }
                    catch (e) {
                        this.log("Error raising received " + e, connection.logging);
                        connection.onError(e);
                    }
                }, this);
            }
            
            if (data.MessageId) {
                connection.messageId = data.MessageId;
            }

            if (data.TransportData) {
                connection.groups = data.TransportData.Groups;
            }
        }
    },

    foreverFrame: {
        count: 0,
        connections: {}
    }
});