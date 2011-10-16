/**

    The MIT License
    
    Copyright (c) 2011 Arunoda Susiripala
    
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.

 */

var xmpp = require('node-xmpp');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var qbox = require('qbox');

var STATUS = {
    AWAY: "away",
    DND: "dnd",
    XA: "xa",
    ONLINE: "online",
    OFFLINE: "offline"
};

var SimpleXMPP = function SimpleXMPP() {
    //setting status here
    var config;
    var conn;
    var probeBuddies = {};
    var $ = qbox.create();
    var events = new EventEmitter();
}

SimpleXMPP.prototype.STATUS = STATUS;

SimpleXMPP.prototype.on = function () {
    events.on.apply(this.events, arguments);
};

SimpleXMPP.prototype.send = function (to, message) {
    this.$.ready(function () {
        var stanza = new xmpp.Element('message', { to: to, type: 'chat' });
        stanza.c('body').t(message);
        conn.send(stanza);
    });
};

SimpleXMPP.prototype.probe = function (buddy, callback) {
    this.probeBuddies[buddy] = true;
    this.$.ready(function () {
        var stanza = new xmpp.Element('presence', { type: 'probe', to: buddy });
        events.once('probe_' + buddy, callback);
        conn.send(stanza);
    });
};

SimpleXMPP.prototype.connect = function (params) {
    this.config = params;
    this.conn = new xmpp.Client(params);

    this.conn.on('online', function () {
        this.conn.send(new xmpp.Element('presence'));
        this.events.emit('online');
        this.$.start();
        //make the connection live 
        setInterval(function () {
            this.conn.send(new xmpp.Element('presence'));
        }, 1000 * 10)
    });

    this.conn.on('stanza', function (stanza) {
        this.events.emit('stanza', stanza);
        //console.log(stanza);
        //looking for message stanza
        if (stanza.is('message')) {

            //getting the chat message
            if (stanza.attrs.type == 'chat') {

                var body = stanza.getChild('body');
                if (body) {
                    var message = body.getText();
                    var from = stanza.attrs.from;
                    var id = from.split('/')[0];
                    this.events.emit('chat', id, message);
                }
            }
        } else if (stanza.is('presence')) {
            //looking for presence stenza for availability changes
            var from = stanza.attrs.from;
            if (from) {
                var id = from.split('/')[0];
                var state = (stanza.getChild('show')) ? stanza.getChild('show').getText() : STATUS.ONLINE;
                state = (state == 'chat') ? STATUS.ONLINE : state;
                state = (stanza.attrs.type == 'unavailable') ? STATUS.OFFLINE : state;
                //checking if this is based on probe
                if (probeBuddies[id]) {
                    this.events.emit('probe_' + id, state);
                    delete probeBuddies[id];
                } else {
                    //specifying roster changes
                    this.events.emit('buddy', id, state);
                }
            }
        }
    });

    this.conn.on('error', function (err) {
        this.events.emit('error', err);
    });
};

exports.SimpleXMPP = SimpleXMPP;
