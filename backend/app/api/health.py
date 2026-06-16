from jdm_electron_flask import JDMBlueprint, success

class HealthBlueprint(JDMBlueprint):
    def __init__(self):
        super().__init__("health", __name__)

    @JDMBlueprint.get("/health", auth=True)
    def health():
        return success({"status": "ok"}, "Service is running")
