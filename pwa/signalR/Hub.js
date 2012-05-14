dojo.provide("pwa.signalR.Hub");

dojo.require("pwa.signalR.Connection");

dojo.declare("pwa.signalR.Hub", null, {
	// Helper class to connect to hubs.  The hub code is jQuery, so we implement the absolute minimum
	// jQuery shim necessary to run the code.  Afterward, we replace all of the hub's functions
	// with our own Dojo code.

	callbackId: 0,
	callbacks: {},
	hubs: {},
	
	constructor: function(signalR, connection) {		
		dojo.connect( connection, "onStarting", this, function() {
			this.updateClientMembers(signalR);
		});
		
		dojo.connect( connection, "onSending", this, function() {
			this._setConnectionData(connection);
		});
		
		dojo.connect( connection, "onReceived", this, function(result) {
			this._onReceiveData(result);
		});			
		
		// Override all of the hub methods to point to our own serverCall method
		for ( var prop in signalR ) {
			if ( signalR.hasOwnProperty( prop ) && signalR[prop]._ ) {
				this._setHubMethods(signalR[prop]);
			}
		}
	},
	
	executeCallback: function(hubName, fn, args, state) {
        var hub = this.hubs[hubName],
            hubMethod;

        if (hub) {
			dojo.mixin(hub.obj, state);

            if (hub[fn]) {
                hubMethod = hub.obj[fn];
                if (hubMethod) {
                    hubMethod.apply(hub.obj, args);
                }
            }
        }
    },
	
	updateClientMembers: function(instance) {
        var newHubs = {},
            obj,
            hubName = "",
            newHub,
            memberValue,
            key,
            memberKey;

        for (key in instance) {
            if (instance.hasOwnProperty(key)) {

                obj = instance[key];

                if (!dojo.isObject(obj) || dojo.indexOf(["prototype", "constructor", "fn", "hub", "transports"], key) >= 0) {
                    continue;
                }

                newHub = null;
                hubName = obj._.hubName;

                for (memberKey in obj) {
                    if (obj.hasOwnProperty(memberKey)) {
                        memberValue = obj[memberKey];

                        if (memberKey === "_" ||
                                !dojo.isFunction(memberValue) ||
                                dojo.indexOf(obj._.ignoreMembers, memberKey) >= 0) {
                            continue;
                        }

                        if (!newHub) {
                            newHub = { obj: obj };

                            newHubs[hubName] = newHub;
                        }

                        newHub[memberKey] = memberValue;
                    }
                }
            }
        }

        this.hubs = dojo.mixin({}, newHubs);
    },
	
	serverCall: function(hub, methodName, args) {
		var callback = args[args.length - 1], // last argument
            methodArgs = dojo.isFunction(callback)
                ? args.slice(0, -1) // all but last
                : args,
            argValues = dojo.map(methodArgs, this._getArgValue),
            data = { hub: hub._.hubName, action: methodName, data: argValues, state: this._copy(hub, ["_"]), id: this.callbackId },
            d = new dojo.Deferred();
            cb = function (result) {
				dojo.mixin(hub, result.State); // processState

                if (result.Error) {
                    if (result.StackTrace) {
                        hub._.connection().log(result.Error + "\n" + result.StackTrace);
                    }
                    d.reject.apply(hub, [result.Error]);
                } else {
                    if (dojo.isFunction(callback)) {
                        callback.call(hub, result.Result);
                    }
                    d.resolve.apply(hub, [result.Result]);
                }
            };

        this.callbacks[this.callbackId.toString()] = { scope: hub, callback: cb };
        this.callbackId += 1;
        hub._.connection().send(window.JSON.stringify(data));
        return d;
	},
	
	_onReceiveData: function(result) {
		var callbackId, cb;
		if (result) {
			if (!result.Id) {
				this.executeCallback(result.Hub, result.Method, result.Args, result.State);
			} else {
				callbackId = result.Id.toString();
				cb = this.callbacks[callbackId];
				if (cb) {
					this.callbacks[callbackId] = null;
					delete this.callbacks[callbackId];
					cb.callback.call(cb.scope, result);
				}
			}
		}
	},
	
	_setConnectionData: function(connection) {
		var localHubs = [],
		    hub, key;
				
		for ( hub in this.hubs ) {
			var methods = [];
			for ( key in this.hubs[hub] ) {
				if (key === "obj") {
					continue;
				}
				methods.push(key);
			}

			localHubs.push({ name: hub, methods: methods });
		}

		connection.data = window.JSON.stringify(localHubs);
	},
	
	_setHubMethods: function(hub) {
		var self = this;
		for ( var method in hub ) {			
			if ( dojo.isFunction( hub[method] )) {				
				// Wrap in a closure to capture the parameters
				hub[method] = function(serverMethod) {
					return function() {
						return self.serverCall(hub, serverMethod, arguments);
					};
				}(this._capitalize(method));
			}
		}
	},
	
	_capitalize: function(str) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	},
	
	_copy: function(obj, exclude) {
        var newObj = {};
		for ( var key in obj ) {
			if ( dojo.indexOf(exclude, key) === -1 ) {
				newObj[key] = obj[key];
			}			
		}
        return newObj;
    },
	
	_getArgValue: function(a) {
		return (dojo.isFunction(a) || typeof a === "undefined") ? null : a;
	}
});

//Helper method for loading the signalR jQuery hub plugin code
pwa.signalR.Hubs = function(url, cb) {
		
	var addJavascript = function(url, tagname) {
		// summary:
		//     Small script injector for loading the jQuery hub code
		var th = document.getElementsByTagName(tagname)[0];
		var s = document.createElement("script");
		s.setAttribute("type", "text/javascript");
		s.setAttribute("src", url);
		th.appendChild(s);
	};
	
	var jqSignalR = function(url) {
		var connection = new pwa.signalR.Connection(url);
		
		// Wire up our own event handlers via dojo events to the connection and replace
		// the methods on the hubs
		var hub = new pwa.signalR.Hub($.signalR, connection);
		
		// Notify the callback listener
		if (cb) {
			cb($.signalR, connection, hub);
		}
		
		return connection;
	};
	
	// Create our pseudo-jQuery object	
	var $ = {
		// This must be a function that returns a new signalR connection object
		signalR: jqSignalR,
		
		// Only need to implement $.extend and only need feature equivalent to dojo.mixin
		extend: dojo.mixin		
	};
	
	window.jQuery = $;
	
	// Load the script and let it fly
	addJavascript(url, "body");
	
	// Return the pseudo-jQuery function object with the extended properties from the
	// signalR jQuery code.
	return $.signalR;
};