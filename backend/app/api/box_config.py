from flask import request
from jdm_electron_flask import JDMBlueprint, success, error
from app.core.box_config_service import (
    BoxConfigService,
    BoxConfigError,
    AnswerQuizService,
    AnswerQuizError,
    MainConfigService,
    MainConfigError,
)


class BoxConfigBlueprint(JDMBlueprint):
    def __init__(self):
        super().__init__("box_config", __name__)

    answer_quiz = AnswerQuizService(app_name="E-Assess")
    service = BoxConfigService(app_name="E-Assess", answer_quiz_service=answer_quiz)
    main_cfg = MainConfigService(app_name="E-Assess")

    @JDMBlueprint.get("/get_all", auth=False)
    def list_boxes():
        return success(BoxConfigBlueprint.service.get_all(), "Fetched all boxes")

    @JDMBlueprint.get("/get/<string:title>", auth=False)
    def get_box(title):
        box = BoxConfigBlueprint.service.get(title)
        if box is None:
            return error(f"No box titled '{title}' found", status=404)
        return success(box, "Fetched box")

    @JDMBlueprint.post("/add", auth=True)
    def create_box():
        data = request.get_json()
        if not data:
            return error("Invalid or empty JSON body", status=400)
        index = data.pop("index", None)
        try:
            box = BoxConfigBlueprint.service.add(data, index=index)
        except BoxConfigError as e:
            return error(str(e), status=400)
        return success(box, "Box created", 201)

    @JDMBlueprint.post("/update/<string:title>", auth=True)
    def update_box(title):
        data = request.get_json()
        if not data:
            return error("Invalid or empty JSON body", status=400)
        try:
            box = BoxConfigBlueprint.service.update(title, data)
        except BoxConfigError as e:
            return error(str(e), status=404 if "No box titled" in str(e) else 400)
        return success(box, "Box updated")

    @JDMBlueprint.post("/update/<string:title>/fields", auth=True)
    def patch_box_fields(title):
        data = request.get_json()
        if not data or not isinstance(data, dict):
            return error("Invalid or empty JSON body", status=400)
        try:
            box = BoxConfigBlueprint.service.update_field(title, **data)
        except BoxConfigError as e:
            return error(str(e), status=404 if "No box titled" in str(e) else 400)
        return success(box, "Box fields updated")

    @JDMBlueprint.post("/update/<string:title>/check_mode", auth=True)
    def set_check_mode(title):
        data = request.get_json()
        if not data or not isinstance(data, dict):
            return error("Invalid or empty JSON body", status=400)
        check_by_row = data.get("check_by_row")
        check_by_col = data.get("check_by_col")
        if check_by_row is None and check_by_col is None:
            return error(
                "Body must include at least one of 'check_by_row' or 'check_by_col'",
                status=400,
            )
        if check_by_row is not None and not isinstance(check_by_row, bool):
            return error("'check_by_row' must be a boolean", status=400)
        if check_by_col is not None and not isinstance(check_by_col, bool):
            return error("'check_by_col' must be a boolean", status=400)
        try:
            box = BoxConfigBlueprint.service.set_check_mode(
                title, check_by_row=check_by_row, check_by_col=check_by_col,
            )
        except BoxConfigError as e:
            return error(str(e), status=404 if "No box titled" in str(e) else 400)
        return success(box, "Check mode updated")

    @JDMBlueprint.delete("/delete/<string:title>", auth=True)
    def delete_box(title):
        if not BoxConfigBlueprint.service.delete(title):
            return error(f"No box titled '{title}' found", status=404)
        return success(None, "Box deleted")

    @JDMBlueprint.put("/reorder", auth=True)
    def reorder_boxes():
        data = request.get_json()
        if not data:
            return error("Invalid or empty JSON body", status=400)
        order = data.get("order")
        if not isinstance(order, list) or not all(isinstance(t, str) for t in order):
            return error("'order' must be a list of box titles (strings)", status=400)
        try:
            return success(BoxConfigBlueprint.service.reorder(order), "Boxes reordered")
        except BoxConfigError as e:
            return error(str(e), status=400)

    @JDMBlueprint.post("/reset", auth=True)
    def reset_boxes():
        return success(BoxConfigBlueprint.service.reset_to_default(), "Boxes reset to default")

    @JDMBlueprint.post("/replace_all", auth=True)
    def replace_all_boxes():
        data = request.get_json()
        if not data or not isinstance(data, dict):
            return error("Invalid or empty JSON body", status=400)
        boxes = data.get("boxes")
        if not isinstance(boxes, list):
            return error("Body must include 'boxes' as a list", status=400)
        try:
            result = BoxConfigBlueprint.service.replace_all(boxes)
        except BoxConfigError as e:
            return error(str(e), status=400)
        return success(result, f"Replaced all boxes ({len(result)} total)")

    # ── answerer flag ─────────────────────────────────────────────────────

    @JDMBlueprint.post("/update/<string:title>/answerer", auth=True)
    def set_answerer(title):
        data = request.get_json()
        if not data or not isinstance(data, dict):
            return error("Invalid or empty JSON body", status=400)

        is_answerer = data.get("is_answerer")
        if is_answerer is None:
            return error("Body must include 'is_answerer'", status=400)
        if not isinstance(is_answerer, bool):
            return error("'is_answerer' must be a boolean", status=400)

        try:
            box = BoxConfigBlueprint.service.set_answerer(title, is_answerer)
        except BoxConfigError as e:
            return error(str(e), status=404 if "No box titled" in str(e) else 400)

        action = "promoted to answerer" if is_answerer else "demoted from answerer"
        return success(box, f"Box '{title}' {action}")

    # ── answer quiz CRUD ──────────────────────────────────────────────────

    @JDMBlueprint.get("/answerer", auth=False)
    def list_answerers():
        return success(BoxConfigBlueprint.answer_quiz.get_all(), "Fetched answer quiz")

    @JDMBlueprint.get("/answerer/<string:title>", auth=False)
    def get_answerer(title):
        answers = BoxConfigBlueprint.answer_quiz.get(title)
        if answers is None:
            return error(f"No answer entry for '{title}' found", status=404)
        return success({"title": title, "answers": answers}, "Fetched answers")

    @JDMBlueprint.post("/answerer/<string:title>", auth=True)
    def update_answerer_answers(title):
        data = request.get_json()
        if not data or not isinstance(data, dict):
            return error("Invalid or empty JSON body", status=400)

        answers = data.get("answers")
        if answers is None:
            return error("Body must include 'answers'", status=400)
        if not isinstance(answers, list):
            return error("'answers' must be a list of strings", status=400)

        strict = data.get("strict", True)
        if not isinstance(strict, bool):
            return error("'strict' must be a boolean", status=400)

        try:
            if strict:
                updated = BoxConfigBlueprint.answer_quiz.update_answers(title, answers)
            else:
                updated = BoxConfigBlueprint.answer_quiz.update_answers_unchecked(title, answers)
        except AnswerQuizError as e:
            return error(str(e), status=404 if "No answer entry" in str(e) else 400)

        return success({"title": title, "answers": updated}, "Answers updated")

    @JDMBlueprint.post("/answerer/reset", auth=True)
    def reset_answerer():
        return success(
            BoxConfigBlueprint.answer_quiz.reset_to_default(),
            "Answer quiz reset to default",
        )

    # ── main config ───────────────────────────────────────────────────────

    @JDMBlueprint.get("/get_main_config", auth=False)
    def get_main_config():
        return success(BoxConfigBlueprint.main_cfg.get(), "Fetched main config")

    @JDMBlueprint.post("/main_config", auth=True)
    def update_main_config():
        data = request.get_json()
        if not data or not isinstance(data, dict):
            return error("Invalid or empty JSON body", status=400)
        try:
            cfg = BoxConfigBlueprint.main_cfg.update(data)
        except MainConfigError as e:
            return error(str(e), status=400)
        return success(cfg, "Main config updated")

    @JDMBlueprint.post("/main_config/reset", auth=True)
    def reset_main_config():
        return success(
            BoxConfigBlueprint.main_cfg.reset_to_default(),
            "Main config reset to default",
        )