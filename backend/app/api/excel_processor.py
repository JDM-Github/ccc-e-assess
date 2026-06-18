import os
from pathlib import Path
from flask import Response, request
from jdm_electron_flask import JDMBlueprint, success, error
from app.core.excel_processor_service import ExcelProcessorService

_RESOURCES_DIR = Path(__file__).parent.parent.parent / "resources"
_TEMPLATE_FILES = {
    "template":  ("template.xlsx",           "output_template.xlsx"),
    "applicant": ("applicant_template.xlsx",  "applicant_template.xlsx"),
}


class ExcelProcessorBlueprint(JDMBlueprint):
    def __init__(self):
        super().__init__("excel_processor", __name__)

    # ── POST /generate ──────────────────────────────
    @JDMBlueprint.post("/generate", auth=False)
    def generate():
        applicant_file = request.files.get("applicant")
        answerer_file  = request.files.get("answerer")
        template_file  = request.files.get("template")

        if not applicant_file:
            return error("Missing file: 'applicant'", 400)
        if not answerer_file:
            return error("Missing file: 'answerer'", 400)
        if not template_file:
            return error("Missing file: 'template'", 400)

        try:
            output_bytes, count, skipped = ExcelProcessorService.process(
                applicant_bytes=applicant_file.read(),
                answerer_bytes=answerer_file.read(),
                template_bytes=template_file.read(),
            )
        except ValueError as e:
            msg = str(e)
            if msg.startswith("INTEGRITY_ERROR:"):
                return error(msg.replace("INTEGRITY_ERROR: ", ""), 422)
            return error(msg, 400)
        except Exception as e:
            return error(str(e), 500)

        return Response(
            output_bytes,
            status=200,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=output.xlsx",
                "X-Total-Generated":   str(count),
                "X-Skipped-Count":     str(len(skipped)),
                "X-Skipped-Ids":       ",".join(skipped) if skipped else "",
            }
        )

    @JDMBlueprint.get("/download/<kind>", auth=False)
    def download(kind):
        if kind not in _TEMPLATE_FILES:
            return error(f"Unknown template kind '{kind}'. Valid options: {list(_TEMPLATE_FILES.keys())}", 400)

        filename, download_name = _TEMPLATE_FILES[kind]
        filepath = os.path.normpath(os.path.join(_RESOURCES_DIR, filename))
        if not os.path.isfile(filepath):
            return error(f"Template file '{filename}' not found on server.", 404)

        with open(filepath, "rb") as f:
            file_bytes = f.read()

        return Response(
            file_bytes,
            status=200,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={download_name}",
            }
        )

    @JDMBlueprint.post("/merge", auth=False)
    def merge():
        files = []
        i = 0
        while True:
            f = request.files.get(f"files[{i}]")
            if f is None:
                break
            files.append(f.read())
            i += 1

        if len(files) < 2:
            return error("At least 2 files are required to merge.", 400)

        try:
            merged_bytes = ExcelProcessorService.merge(files)
        except ValueError as e:
            return error(str(e), 400)
        except Exception as e:
            return error(str(e), 500)

        return Response(
            merged_bytes,
            status=200,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=merged.xlsx",
            }
        )
