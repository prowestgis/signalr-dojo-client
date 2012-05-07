signalr-dojo-client
===================

A port of the jQuery signalR plugin to the Dojo framework

Features
--------

Differences
-----------

The code is structured differently than the jQuery plugin and takes advantage of the Dojo class infrastructure. The 
class heirarchy is laid out as:

    pwa.signalR.Connection
    pwa.signalR.Hub
    pwa.signalR.transport.ForeverFrame
    pwa.signalR.transport.LongPolling
    pwa.signalR.transport.ServerSentEvents
    pwa.signalR.transport.WebSockes
    
The various transport classes register themselves with a new `pwa.signalR.manifest` object that takes the place
of the `transports` array in the original jQuery code.  The `manifest` maps transport names to dojo classes
which means that one can extend and replace built-in transports or add your own easily.

There are also two layer files, `pwa.signalR` and `pwa.signalR-all`.  The former loads just the `Connection` and
`Hub` classes and requires the caller to explicitly load the transport layers they wish to support.  The latter
layer file loads all of the transports by default.

There is a `pwa.signalR.Hubs` helper function that should be used to connect to the `~/signalr/hubs` endpo

Example
-------

Using the client from Dojo is fairly simple, assuming one is familiar with Dojo events.

    dojo.require("pwa.signalR");
    dojo.require("pwa.signalR.transports.LongPolling");

    dojo.addOnLoad(function() {
        
        // Connect to a Hub
        pwa.signalR.Hubs("/signalr/hubs", function(signalr, connection, hub) {
        
            // The signalr object is analagous to the $.signalR object from the jQuery plugin,
            // connection is the pwa.signalR.Connection class and hub is a pwa.signalR.Hub object
            
            // Look for a 'chat' hub proxy
            if ( signalr && signalr.chat ) {
                
                // Add function to fill in the proxy just like usual
                signalr.chat.received = function(data) {
                }
                
                // Or use dojo events to get at the underly connection data
                dojo.connect( connection, "onReceived", function(data) {
                });
                
                // Start the connection (which returns a dojo.Deferred) and 
                // alert the user when ready
                dojo.when( connection.start({}), function() {
                    signalr.chat.send("A new user joined!");
                });
            }
        });
    });
    

