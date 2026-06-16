import sys, os
import app.api
import app.event
from jdm_electron_flask import create_app, get_socketio, Printer

os.environ.setdefault("FLASK_ENV", "production")
for key in ("FLASK_ENV", "FLASK_PORT"):
    val = os.environ.get(key)
    if val:
        os.environ[key] = val.strip()

def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except AttributeError:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

app = create_app(config_name="production", static_folder=resource_path("static"))
socketio = get_socketio()
port = int(os.environ.get("FLASK_PORT", 5000))

Printer.log("=" * 50)
Printer.log(f"Serving on http://127.0.0.1:{port}")
Printer.log("=" * 50)

socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)
