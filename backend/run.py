import os
from jdm_electron_flask import create_app, get_socketio

for key in ("FLASK_ENV", "FLASK_PORT"):
    val = os.environ.get(key)
    if val:
        os.environ[key] = val.strip()

app = create_app()
socketio = get_socketio()
port = int(os.environ.get("FLASK_PORT", 5000))
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=port, debug=True)
