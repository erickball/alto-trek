/* WebSocket-based virtual Ethernet for ContrAltoJS.
 *
 * Replaces the retroweb-networking/PeerJS WebRTC transport with a simple
 * relay: every raw 3-Mbit Alto Ethernet frame is sent to the relay server
 * as a binary WebSocket message, and the relay broadcasts it to every other
 * client in the same room.  This mirrors the shared-cable Ethernet the Alto
 * expected (and the UDP-broadcast encapsulation desktop ContrAlto uses).
 *
 * Frame format: the raw Alto packet bytes; frame[0] = destination host,
 * frame[1] = source host (as ContrAltoJS's ethernet controller produces).
 * No extra framing is added — one WS message per Alto packet.
 */

var AltoWSNetwork = function (url, receivedFrameCallback, stateChangedCallback) {
    this.url = url;
    this.receivedFrameCallback = receivedFrameCallback;
    this.stateChangedCallback = stateChangedCallback || function () {};
    this.ws = null;
    this.reconnectDelayMs = 1000;
    this.closed = false;
};

AltoWSNetwork.prototype = {
    connect: function () {
        var self = this;
        this.stateChangedCallback("connecting");

        var ws = new WebSocket(this.url);
        ws.binaryType = "arraybuffer";
        this.ws = ws;

        ws.onopen = function () {
            self.reconnectDelayMs = 1000;
            self.stateChangedCallback("connected");
        };

        ws.onmessage = function (event) {
            if (event.data instanceof ArrayBuffer) {
                self.receivedFrameCallback(new Uint8Array(event.data));
            }
        };

        ws.onclose = function () {
            self.stateChangedCallback("disconnected");
            if (!self.closed) {
                // Auto-reconnect with mild backoff so a relay blip doesn't
                // permanently knock a player off the net.
                setTimeout(function () { self.connect(); },
                    self.reconnectDelayMs);
                self.reconnectDelayMs = Math.min(self.reconnectDelayMs * 2, 15000);
            }
        };

        ws.onerror = function () {
            // onclose fires afterwards and handles reconnection.
        };
    },

    /* Same signature the ethernet controller uses with the retroweb network. */
    sendFrame: function (dstAddress, srcAddress, frame) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Copy: the caller's buffer is reused for the next packet.
            this.ws.send(new Uint8Array(frame));
        }
    },

    close: function () {
        this.closed = true;
        if (this.ws) {
            this.ws.close();
        }
    }
};
