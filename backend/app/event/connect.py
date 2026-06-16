from jdm_electron_flask import JDMEvent, get_socketio

class ConnectEvent(JDMEvent):

    def on_connect(self):
        socketio = get_socketio()
        socketio.server.eio.max_http_buffer_size = 50 * 1024 * 1024
        self.emit("connected", {"message": "Socket connected"})

    def on_disconnect(self):
        pass
