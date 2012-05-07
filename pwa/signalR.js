// Dojo interface to the SignalR server.  Direct port of the jQuery plugin
dojo.provide("pwa.signalR");

dojo.require("pwa.signalR.Connection");
dojo.require("pwa.signalR.Hub");

// Registered transports
pwa.signalR.manifest = {};