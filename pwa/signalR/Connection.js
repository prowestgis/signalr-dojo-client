dojo.provide("pwa.signalR.Connection");

dojo.declare("pwa.signalR.Connection", null, {

    logging: false,

    reconnectDelay: 2000,

    constructor: function (url, qs, logging) {
        /// <summary>Creates a new SignalR connection for the given url</summary>
        /// <param name="url" type="String">The URL of the long polling endpoint</param>
        /// <param name="qs" type="Object">
        ///     [Optional] Custom querystring parameters to add to the connection URL.
        ///     If an object, every non-function member will be added to the querystring.
        ///     If a string, it's added to the QS as specified.
        /// </param>
        /// <param name="logging" type="Boolean">
        ///     [Optional] A flag indicating whether connection logging is enabled to the browser
        ///     console/log. Defaults to false.
        /// </param>
        /// <returns type="signalR" />    
        this.url = url;
        this.qs = qs;
        if (typeof (logging) === "boolean") {
            this.logging = logging;
        }
    },

    start: function (options, callback) {
        /// <summary>Starts the connection</summary>
        /// <param name="options" type="Object">Options map</param>
        /// <param name="callback" type="Function">A callback function to execute when the connection has started</param>
        var connection = this,
            config = {
                transport: "auto"
            },
            initialize,
            promise = new dojo.Deferred();

        if (connection.transport) {
            // Already started, just return
            promise.resolve(connection);
            return promise;
        }

        if (dojo.isFunction(options)) {
            // Support calling with single callback parameter
            callback = options;
        } else if (dojo.isObject(options)) {
            config = dojo.mixin(config, options);
            if (dojo.isFunction(config.callback)) {
                callback = config.callback;
            }
        }

        dojo.connect( connection, "onStart", function (e, data) {
            if (dojo.isFunction(callback)) {
                callback.call(connection);
            }
            promise.resolve(connection);
        });

        initialize = function (transports, index) {
            index = index || 0;
            if (index >= transports.length) {
                if (!connection.transport) {
                    // No transport initialized successfully
                    promise.reject("SignalR: No transport could be initialized successfully. Try specifying a different transport or none at all for auto initialization.");
                }
                return;
            }

            var transportName = transports[index],
                transport = dojo.isObject(transportName) ? 
					transportName : 
					new dojo.getObject(transportName)();
			
            transport.start(connection, function () {
				// Set the transport logger
                connection.transport = transport;
				//connection.transport.log = dojo.hitch(connection, connection.log);
                connection.onStart();
            }, function () {
                initialize(transports, index + 1);
            });
        };

        window.setTimeout(function () {
            dojo.xhrPost({
                url: connection.url + "/negotiate",
                headers: { "Content-Type": "application/json"},
                handleAs: "json",
                error: function (error) {
                    connection.onError(error);
                    promise.reject("SignalR: Error during negotiation request: " + error);
                },
                load: function (res) {
                    connection.appRelativeUrl = res.Url;
                    connection.id = res.ConnectionId;
                    connection.webSocketServerUrl = res.WebSocketServerUrl;

                    if (!res.ProtocolVersion || res.ProtocolVersion !== "1.0") {
                        connection.onError("SignalR: Incompatible protocol version.");
                        promise.reject("SignalR: Incompatible protocol version.");
                        return;
                    }

                    connection.onStarting();

                    var transports = [],
                        supportedTransports = [],
						key;

					for ( key in pwa.signalR.manifest) {
                        // Server said don't even try WebSockets
                        if (!(key === "webSockets" && !res.TryWebSockets)) {
                            supportedTransports.push(pwa.signalR.manifest[key]);
                        }
                    }

                    if (dojo.isArray(config.transport)) {
                        // ordered list provided
                        dojo.forEach(config.transport, function () {
                            var transport = this;
                            if (dojo.isObject(transport) || (dojo.isString(transport) && dojo.indexOf(supportedTransports, "" + transport) >= 0)) {
                                transports.push(dojo.isString(transport) ? "" + transport : transport);
                            }
                        }, this);
                    } else if (dojo.isObject(config.transport) ||
                                    dojo.indexOf(supportedTransports, config.transport) >= 0) {
                        // specific transport provided, as object or a named transport, e.g. "longPolling"
                        transports.push(config.transport);
                    } else { // default "auto"
                        transports = supportedTransports;
                    }
                    initialize(transports);
                }
            });
        }, 0);

        return promise;
    },

	/* Deprecated jQuery event callbacks */
    starting: function (callback) {
        return this;
    },

    send: function (data) {
        /// <summary>Sends data over the connection</summary>
        /// <param name="data" type="String">The data to send over the connection</param>
        /// <returns type="signalR" />
        var connection = this;

        if (!connection.transport) {
            // Connection hasn't been started yet
            throw "SignalR: Connection must be started before data can be sent. Call .start() before .send()";
        }

        connection.transport.send(connection, data);

        return connection;
    },

    // These functions are just placeholders for the generated hub jQuery plugin code
    sending: function (callback) {
        return this;
    },

    received: function (callback) {
        return this;
    },

    error: function (callback) {
        return this;
    },

    disconnected: function (callback) {
        return this;
    },

    reconnected: function (callback) {
        return this;
    },

    stop: function () {
        /// <summary>Stops listening</summary>
        /// <returns type="signalR" />
        var connection = this;

        if (connection.transport) {
            connection.transport.stop(connection);
            connection.transport = null;
        }

        delete connection.messageId;
        delete connection.groups;

        // Trigger the disconnect event
        connection.onDisconnect();

        return connection;
    },

    // Dojo Events
    onStart: function() { 
    },
    
    onStarting: function() { 
    },
    
    onSending: function() { 
    },
    
    onReceived: function() { 
    },
    
    onError: function() { 
    },
    
    onReconnect: function() { 
    },
    
    onDisconnect: function() { 
    },

    log: function (msg) {
        if (this.logging === false) {
            return;
        }
        var m, d;
        if (typeof (window.console) === "undefined") {
            return;
        }
		d = new Date();
		if ( d.toLocaleFormat ) {
			d = d.toLocaleFormat();
		} else if ( d.toTimeString ) {
			d = d.toTimeString();
		}
		
        m = "[" + d + "] SignalR: " + msg;
        if (window.console.debug) {
            window.console.debug(m);
        } else if (window.console.log) {
            window.console.log(m);
        }
    }
});