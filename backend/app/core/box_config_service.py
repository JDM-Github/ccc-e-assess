import json
import os
import sys
import shutil
import tempfile
from pathlib import Path
from typing import List, Dict, Optional

MAIN_CONFIG = {
    "OUTPUT_WIDTH": 2450,
    "OUTPUT_HEIGHT": 3800,
    "SCAN_RANGE": 20,
    "SAMPLE_PTS": 20,
    "DARK_THRESH": 50
}

MAIN_CONFIG_SCHEMA = {
    "OUTPUT_WIDTH":  (int,   lambda v: v > 0,   "must be a positive integer"),
    "OUTPUT_HEIGHT": (int,   lambda v: v > 0,   "must be a positive integer"),
    "SCAN_RANGE":    (int,   lambda v: v > 0,   "must be a positive integer"),
    "SAMPLE_PTS":    (int,   lambda v: v > 0,   "must be a positive integer"),
    "DARK_THRESH":   (int,   lambda v: 0 <= v <= 255, "must be an integer between 0 and 255"),
}

DEFAULT_ANSWER_QUIZ = {
    "Verbal Reasoning": ["A" for _ in range(40)],
    "Numerical Reasoning": ["A" for _ in range(40)],
    "Abstract Reasoning": ["A" for _ in range(40)],
    "Space Relations": ["A" for _ in range(50)],
    "Spelling": ["A" for _ in range(40)],
    "Language Usage": ["A" for _ in range(40)],
}

DEFAULT_BOXES: List[Dict] = [
    {
        "title": "Application No.",
        "tl": [2114, 121],
        "tr": [2419, 115],
        "height": 583,
        "grid_cols": 4,
        "grid_rows": 10,
        "check_by_row": False,
        "check_by_col": True,
        "columns": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
        "is_combined": True,
        "has_own_sheet": False,
        "no_double": True,
        "no_blank": True,
        "group": None,
        "is_answerer": False
    },

    {
        "title": "First Choice",
        "tl": [23, 420],
        "tr": [66, 420],
        "height": 264,
        "grid_cols": 1,
        "grid_rows": 5,
        "check_by_row": False,
        "check_by_col": True,
        "columns": ["BSIT", "BSA", "BEED", "BSEDSS", "BACOMM"],
        "is_combined": False,
        "has_own_sheet": False,
        "no_double": True,
        "no_blank": False,
        "group": "first_choice",
        "is_answerer": False
    },
    {
        "title": "First Choice",
        "tl": [254, 420],
        "tr": [296, 420],
        "height": 264,
        "grid_cols": 1,
        "grid_rows": 5,
        "check_by_row": False,
        "check_by_col": True,
        "columns": ["BSCS", "BSAIS", "BSEDF", "BSEDM", "BPA"],
        "is_combined": False,
        "has_own_sheet": False,
        "no_double": True,
        "no_blank": False,
        "group": "first_choice",
        "is_answerer": False
    },
    {
        "title": "First Choice",
        "tl": [485, 420],
        "tr": [528, 420],
        "height": 203,
        "grid_cols": 1,
        "grid_rows": 4,
        "check_by_row": False,
        "check_by_col": True,
        "columns": ["BSPSY", "BSCED", "BSEDS", "BSEDE"],
        "is_combined": False,
        "has_own_sheet": False,
        "no_double": True,
        "no_blank": False,
        "group": "first_choice",
        "is_answerer": False
    },

    {
        "title": "Second Choice",
        "tl": [1082, 420],
        "tr": [1128, 420],
        "height": 264,
        "grid_cols": 1,
        "grid_rows": 5,
        "check_by_row": False,
        "check_by_col": True,
        "columns": ["BSIT", "BSA", "BEED", "BSEDSS", "BACOMM"],
        "is_combined": False,
        "has_own_sheet": False,
        "no_double": True,
        "no_blank": False,
        "group": "second_choice",
        "is_answerer": False
    },
    {
        "title": "Second Choice",
        "tl": [1343, 420],
        "tr": [1387, 420],
        "height": 264,
        "grid_cols": 1,
        "grid_rows": 5,
        "check_by_row": False,
        "check_by_col": True,
        "columns": ["BSCS", "BSAIS", "BSEDF", "BSEDM", "BPA"],
        "is_combined": False,
        "has_own_sheet": False,
        "no_double": True,
        "no_blank": False,
        "group": "second_choice",
        "is_answerer": False
    },
    {
        "title": "Second Choice",
        "tl": [1576, 420],
        "tr": [1619, 420],
        "height": 203,
        "grid_cols": 1,
        "grid_rows": 4,
        "check_by_row": False,
        "check_by_col": True,
        "columns": ["BSPSY", "BSCED", "BSEDS", "BSEDE"],
        "is_combined": False,
        "has_own_sheet": False,
        "no_double": True,
        "no_blank": False,
        "group": "second_choice",
        "is_answerer": False
    },

    {
        "title": "Verbal Reasoning",
        "tl": [82, 869],
        "tr": [378, 869],
        "height": 2348,
        "grid_cols": 5,
        "grid_rows": 40,
        "check_by_row": True,
        "check_by_col": False,
        "columns": ["A", "B", "C", "D", "E"],
        "is_combined": False,
        "has_own_sheet": True,
        "no_double": False,
        "no_blank": False,
        "group": None,
        "is_answerer": True
    },
    {
        "title": "Numerical Reasoning",
        "tl": [492, 869],
        "tr": [788, 869],
        "height": 2348,
        "grid_cols": 5,
        "grid_rows": 40,
        "check_by_row": True,
        "check_by_col": False,
        "columns": ["A", "B", "C", "D", "E"],
        "is_combined": False,
        "has_own_sheet": True,
        "no_double": False,
        "no_blank": False,
        "group": None,
        "is_answerer": True
    },
    {
        "title": "Abstract Reasoning",
        "tl": [902, 869],
        "tr": [1200, 869],
        "height": 2348,
        "grid_cols": 5,
        "grid_rows": 40,
        "check_by_row": True,
        "check_by_col": False,
        "columns": ["A", "B", "C", "D", "E"],
        "is_combined": False,
        "has_own_sheet": True,
        "no_double": False,
        "no_blank": False,
        "group": None,
        "is_answerer": True
    },
    {
        "title": "Space Relations",
        "tl": [1355, 869],
        "tr": [1602, 869],
        "height": 2932,
        "grid_cols": 4,
        "grid_rows": 50,
        "check_by_row": True,
        "check_by_col": False,
        "columns": ["A", "B", "C", "D"],
        "is_combined": False,
        "has_own_sheet": True,
        "no_double": False,
        "no_blank": False,
        "group": None,
        "is_answerer": True
    },
    {
        "title": "Spelling",
        "tl": [1766, 869],
        "tr": [2006, 869],
        "height": 2348,
        "grid_cols": 4,
        "grid_rows": 40,
        "check_by_row": True,
        "check_by_col": False,
        "columns": ["A", "B", "C", "D"],
        "is_combined": False,
        "has_own_sheet": True,
        "no_double": False,
        "no_blank": False,
        "group": None,
        "is_answerer": True
    },
    {
        "title": "Language Usage",
        "tl": [2133, 869],
        "tr": [2433, 869],
        "height": 2348,
        "grid_cols": 5,
        "grid_rows": 40,
        "check_by_row": True,
        "check_by_col": False,
        "columns": ["A", "B", "C", "D", "E"],
        "is_combined": False,
        "has_own_sheet": True,
        "no_double": False,
        "no_blank": False,
        "group": None,
        "is_answerer": True
    },
]

REQUIRED_KEYS = {"title", "tl", "tr", "height", "grid_cols", "grid_rows", "is_combined", "has_own_sheet"}


def get_app_data_dir(app_name: str = "E-Assess") -> Path:
    if sys.platform.startswith("win"):
        base = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
    elif sys.platform == "darwin":
        base = str(Path.home() / "Library" / "Application Support")
    else:
        base = os.environ.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    app_dir = Path(base) / app_name
    app_dir.mkdir(parents=True, exist_ok=True)
    return app_dir


class BoxConfigError(Exception):
    """Raised for invalid box configs or CRUD errors (bad title, etc)."""


class MainConfigError(Exception):
    """Raised for invalid MAIN_CONFIG values or keys."""


class AnswerQuizError(Exception):
    """Raised for invalid answer quiz operations."""


def _validate_box(box: Dict) -> None:
    if not isinstance(box, dict):
        raise BoxConfigError(f"Box must be a dict, got {type(box).__name__}")

    missing = REQUIRED_KEYS - set(box.keys())
    if missing:
        raise BoxConfigError(f"Box is missing required keys: {sorted(missing)}")

    if not isinstance(box["title"], str) or not box["title"].strip():
        raise BoxConfigError("Box 'title' must be a non-empty string")

    for key in ("tl", "tr"):
        val = box[key]
        if (not isinstance(val, (list, tuple))) or len(val) != 2:
            raise BoxConfigError(f"Box '{key}' must be a 2-element [x, y] list")
        if not all(isinstance(v, (int, float)) for v in val):
            raise BoxConfigError(f"Box '{key}' values must be numbers")

    for key in ("height", "grid_cols", "grid_rows"):
        val = box[key]
        if not isinstance(val, int) or val <= 0:
            raise BoxConfigError(f"Box '{key}' must be a positive integer")

    for key in ("check_by_row", "check_by_col", "is_combined", "has_own_sheet", "no_double", "no_blank", "is_answerer"):
        if key in box and not isinstance(box[key], bool):
            raise BoxConfigError(f"Box '{key}' must be a boolean")

    if "columns" in box:
        cols = box["columns"]
        if not isinstance(cols, list):
            raise BoxConfigError("Box 'columns' must be a list of strings")
        for i, col in enumerate(cols):
            if not isinstance(col, str) or not col.strip():
                raise BoxConfigError(
                    f"Box 'columns' item {i} must be a non-empty string, got {col!r}"
                )

    if "group" in box:
        group = box["group"]
        if group is not None and (not isinstance(group, str) or not group.strip()):
            raise BoxConfigError("Box 'group' must be a non-empty string or None")


def _normalize_box(box: Dict) -> Dict:
    normalized = {
        "title":         str(box["title"]).strip(),
        "tl":            [int(box["tl"][0]), int(box["tl"][1])],
        "tr":            [int(box["tr"][0]), int(box["tr"][1])],
        "height":        int(box["height"]),
        "grid_cols":     int(box["grid_cols"]),
        "grid_rows":     int(box["grid_rows"]),
        "check_by_row":  bool(box.get("check_by_row", True)),
        "check_by_col":  bool(box.get("check_by_col", False)),
        "is_combined":   bool(box.get("is_combined", False)),
        "has_own_sheet": bool(box.get("has_own_sheet", False)),
        "no_double":     bool(box.get("no_double", False)),
        "no_blank":      bool(box.get("no_blank", False)),
        "group":         str(box["group"]).strip() if box.get("group") is not None else None,
        "is_answerer":   bool(box.get("is_answerer", False)),
    }

    if "columns" in box:
        normalized["columns"] = [str(c).strip() for c in box["columns"]]

    return normalized


def _atomic_write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(
        dir=str(path.parent),
        prefix=path.stem + ".",
        suffix=".tmp",
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        shutil.move(tmp_path, path)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


# ── AnswerQuizService ─────────────────────────────────────────────────────────

class AnswerQuizService:
    FILENAME = "answer_quiz.json"

    def __init__(self, app_name: str = "E-Assess", filename: Optional[str] = None):
        self.app_name = app_name
        self.filename = filename or self.FILENAME
        self.config_path = get_app_data_dir(app_name) / self.filename

        if not self.config_path.exists():
            self._write(dict(DEFAULT_ANSWER_QUIZ))

    def _read(self) -> Dict:
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError, OSError):
            self._write(dict(DEFAULT_ANSWER_QUIZ))
            return dict(DEFAULT_ANSWER_QUIZ)

        if not isinstance(data, dict):
            raise AnswerQuizError(
                f"Answer quiz file {self.config_path} does not contain a dict"
            )
        return data

    def _write(self, quiz: Dict) -> None:
        _atomic_write(self.config_path, quiz)

    @staticmethod
    def _validate_answers(answers: list, title: str) -> None:
        if not isinstance(answers, list):
            raise AnswerQuizError(
                f"Answers for '{title}' must be a list, got {type(answers).__name__}"
            )
        for i, ans in enumerate(answers):
            if not isinstance(ans, str) or not ans.strip():
                raise AnswerQuizError(
                    f"Answer at index {i} for '{title}' must be a non-empty string, got {ans!r}"
                )

    def get_all(self) -> Dict:
        return self._read()

    def get(self, title: str) -> Optional[List[str]]:
        return self._read().get(title)

    def exists(self, title: str) -> bool:
        return title in self._read()

    def add_answerer(self, title: str, grid_rows: int,
                     answers: Optional[List[str]] = None) -> List[str]:
        quiz = self._read()
        if title in quiz:
            raise AnswerQuizError(
                f"An answer entry for '{title}' already exists"
            )

        if answers is None:
            answers = ["A"] * grid_rows
        else:
            self._validate_answers(answers, title)
            if len(answers) != grid_rows:
                raise AnswerQuizError(
                    f"Expected {grid_rows} answers for '{title}', got {len(answers)}"
                )

        quiz[title] = answers
        self._write(quiz)
        return answers

    def update_answers(self, title: str, answers: List[str]) -> List[str]:
        quiz = self._read()
        if title not in quiz:
            raise AnswerQuizError(f"No answer entry for '{title}' found")

        self._validate_answers(answers, title)

        current_len = len(quiz[title])
        if len(answers) != current_len:
            raise AnswerQuizError(
                f"'{title}' expects {current_len} answers, got {len(answers)}. "
                "Use update_answers_unchecked() to resize."
            )

        quiz[title] = answers
        self._write(quiz)
        return answers

    def update_answers_unchecked(self, title: str, answers: List[str]) -> List[str]:
        quiz = self._read()
        if title not in quiz:
            raise AnswerQuizError(f"No answer entry for '{title}' found")
        self._validate_answers(answers, title)
        quiz[title] = answers
        self._write(quiz)
        return answers

    def rename(self, old_title: str, new_title: str) -> List[str]:
        quiz = self._read()
        if old_title not in quiz:
            raise AnswerQuizError(f"No answer entry for '{old_title}' found")
        if new_title in quiz and new_title != old_title:
            raise AnswerQuizError(f"An answer entry for '{new_title}' already exists")

        new_quiz = {}
        for k, v in quiz.items():
            new_quiz[new_title if k == old_title else k] = v
        self._write(new_quiz)
        return new_quiz[new_title]

    def remove_answerer(self, title: str) -> bool:
        quiz = self._read()
        if title not in quiz:
            return False
        del quiz[title]
        self._write(quiz)
        return True

    def reset_to_default(self) -> Dict:
        defaults = dict(DEFAULT_ANSWER_QUIZ)
        self._write(defaults)
        return defaults


# ── BoxConfigService ──────────────────────────────────────────────────────────

class BoxConfigService:
    FILENAME = "boxes_config.json"

    def __init__(self, app_name: str = "E-Assess", filename: Optional[str] = None,
                 answer_quiz_service: Optional["AnswerQuizService"] = None):
        self.app_name = app_name
        self.filename = filename or self.FILENAME
        self.config_path = get_app_data_dir(app_name) / self.filename
        self.answer_quiz = answer_quiz_service or AnswerQuizService(app_name=app_name)

        if not self.config_path.exists():
            self._write(DEFAULT_BOXES)

    def _read(self) -> List[Dict]:
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError, OSError):
            self._write(DEFAULT_BOXES)
            return [dict(b) for b in DEFAULT_BOXES]

        if not isinstance(data, list):
            raise BoxConfigError(f"Config file {self.config_path} does not contain a list")

        return data

    def _write(self, boxes: List[Dict]) -> None:
        _atomic_write(self.config_path, boxes)

    # ── answer quiz sync helpers ──────────────────────────────────────────

    def _sync_answerer_added(self, box: Dict) -> None:
        title = box["title"]
        grid_rows = box["grid_rows"]
        if not self.answer_quiz.exists(title):
            self.answer_quiz.add_answerer(title, grid_rows)

    def _sync_answerer_removed(self, title: str) -> None:
        self.answer_quiz.remove_answerer(title)

    def _sync_answerer_renamed(self, old_title: str, new_title: str) -> None:
        if self.answer_quiz.exists(old_title):
            self.answer_quiz.rename(old_title, new_title)

    # ── read ─────────────────────────────────────────────────────────────

    def get_all(self) -> List[Dict]:
        return self._read()

    def get(self, title: str) -> Optional[Dict]:
        for box in self._read():
            if box.get("title") == title:
                return box
        return None

    def get_by_group(self, group: str) -> List[Dict]:
        return [b for b in self._read() if b.get("group") == group]

    def get_groups(self) -> List[Optional[str]]:
        seen: list = []
        for box in self._read():
            g = box.get("group")
            if g not in seen:
                seen.append(g)
        return seen

    def exists(self, title: str) -> bool:
        return self.get(title) is not None

    # ── create ───────────────────────────────────────────────────────────

    def add(self, box: Dict, index: Optional[int] = None) -> Dict:
        _validate_box(box)
        box = _normalize_box(box)

        boxes = self._read()
        if any(b.get("title") == box["title"] for b in boxes):
            raise BoxConfigError(f"A box titled '{box['title']}' already exists")

        if index is None or index >= len(boxes):
            boxes.append(box)
        else:
            boxes.insert(max(0, index), box)

        self._write(boxes)

        if box.get("is_answerer"):
            self._sync_answerer_added(box)

        return box

    # ── bulk replace ─────────────────────────────────────────────────────

    def replace_all(self, boxes: List[Dict]) -> List[Dict]:
        """
        Atomically replace the entire boxes list with *boxes*.

        Unlike add(), duplicate titles are allowed here — grouped boxes
        (e.g. three "First Choice" boxes) are a valid configuration.

        Answer quiz sync:
          - Entries for titles no longer present are removed.
          - Entries for new is_answerer titles are added with default answers.
          - Existing entries whose title is still present are left untouched
            so manually edited answer keys are preserved.
        """
        if not isinstance(boxes, list):
            raise BoxConfigError("'boxes' must be a list")

        # Validate and normalise every box before touching the file
        normalised: List[Dict] = []
        for i, box in enumerate(boxes):
            try:
                _validate_box(box)
                normalised.append(_normalize_box(box))
            except BoxConfigError as e:
                raise BoxConfigError(f"Box at index {i}: {e}") from e

        # Snapshot old answerer titles before overwriting
        old_boxes = self._read()
        old_answerer_titles = {
            b["title"] for b in old_boxes if b.get("is_answerer")
        }

        # Atomic write
        self._write(normalised)

        # Sync answer quiz
        new_answerer_titles = {
            b["title"] for b in normalised if b.get("is_answerer")
        }

        # Remove entries that are gone
        for title in old_answerer_titles - new_answerer_titles:
            self._sync_answerer_removed(title)

        # Add entries that are new (skip ones that already exist so existing
        # answer keys set by the user are not wiped)
        for box in normalised:
            if box.get("is_answerer") and box["title"] in (new_answerer_titles - old_answerer_titles):
                self._sync_answerer_added(box)

        return normalised

    # ── update ───────────────────────────────────────────────────────────

    def update(self, title: str, updated_box: Dict) -> Dict:
        _validate_box(updated_box)
        updated_box = _normalize_box(updated_box)

        boxes = self._read()
        idx = next((i for i, b in enumerate(boxes) if b.get("title") == title), None)
        if idx is None:
            raise BoxConfigError(f"No box titled '{title}' found")

        old_box = boxes[idx]
        new_title = updated_box["title"]

        if new_title != title and any(b.get("title") == new_title for b in boxes):
            raise BoxConfigError(f"A box titled '{new_title}' already exists")

        was_answerer = bool(old_box.get("is_answerer"))
        is_answerer = bool(updated_box.get("is_answerer"))
        title_changed = new_title != title

        boxes[idx] = updated_box
        self._write(boxes)

        if was_answerer and title_changed:
            self._sync_answerer_renamed(title, new_title)

        if not was_answerer and is_answerer:
            self._sync_answerer_added(updated_box)
        elif was_answerer and not is_answerer:
            self._sync_answerer_removed(new_title)

        return updated_box

    def update_field(self, title: str, **fields) -> Dict:
        box = self.get(title)
        if box is None:
            raise BoxConfigError(f"No box titled '{title}' found")
        merged = dict(box)
        merged.update(fields)
        return self.update(title, merged)

    def set_check_mode(self, title: str, *, check_by_row: Optional[bool] = None,
                       check_by_col: Optional[bool] = None) -> Dict:
        kwargs = {}
        if check_by_row is not None:
            kwargs["check_by_row"] = check_by_row
        if check_by_col is not None:
            kwargs["check_by_col"] = check_by_col
        if not kwargs:
            raise BoxConfigError("At least one of check_by_row or check_by_col must be supplied")
        return self.update_field(title, **kwargs)

    def set_group(self, title: str, group: Optional[str]) -> Dict:
        return self.update_field(title, group=group)

    def set_answerer(self, title: str, is_answerer: bool) -> Dict:
        if not isinstance(is_answerer, bool):
            raise BoxConfigError("'is_answerer' must be a boolean")
        return self.update_field(title, is_answerer=is_answerer)

    # ── delete ───────────────────────────────────────────────────────────

    def delete(self, title: str) -> bool:
        boxes = self._read()
        target = next((b for b in boxes if b.get("title") == title), None)
        if target is None:
            return False

        new_boxes = [b for b in boxes if b.get("title") != title]
        self._write(new_boxes)

        if target.get("is_answerer"):
            self._sync_answerer_removed(title)

        return True

    def delete_group(self, group: str) -> int:
        boxes = self._read()
        removed_boxes = [b for b in boxes if b.get("group") == group]
        new_boxes = [b for b in boxes if b.get("group") != group]
        removed = len(removed_boxes)
        if removed:
            self._write(new_boxes)
            for box in removed_boxes:
                if box.get("is_answerer"):
                    self._sync_answerer_removed(box["title"])
        return removed

    # ── reorder ──────────────────────────────────────────────────────────

    def reorder(self, ordered_titles: List[str]) -> List[Dict]:
        boxes = self._read()
        by_title = {b["title"]: b for b in boxes}

        unknown = [t for t in ordered_titles if t not in by_title]
        if unknown:
            raise BoxConfigError(f"Unknown box title(s): {unknown}")

        reordered = [by_title[t] for t in ordered_titles]
        remaining = [b for b in boxes if b["title"] not in ordered_titles]
        result = reordered + remaining

        self._write(result)
        return result

    # ── reset ────────────────────────────────────────────────────────────

    def reset_to_default(self) -> List[Dict]:
        defaults = [dict(b) for b in DEFAULT_BOXES]
        self._write(defaults)
        return defaults

    # ── pipeline helpers ─────────────────────────────────────────────────

    def get_all_for_pipeline(self) -> List[Dict]:
        boxes = self._read()
        result = []
        for b in boxes:
            b = dict(b)
            b["tl"] = tuple(b["tl"])
            b["tr"] = tuple(b["tr"])
            result.append(b)
        return result

    def get_grouped_for_pipeline(self) -> Dict[Optional[str], List[Dict]]:
        grouped: Dict[Optional[str], List[Dict]] = {}
        for box in self.get_all_for_pipeline():
            g = box.get("group")
            key = g if g is not None else box["title"]
            grouped.setdefault(key, []).append(box)
        return grouped


# ── MainConfigService ─────────────────────────────────────────────────────────

class MainConfigService:
    FILENAME = "main_config.json"

    def __init__(self, app_name: str = "E-Assess", filename: Optional[str] = None):
        self.app_name = app_name
        self.filename = filename or self.FILENAME
        self.config_path = get_app_data_dir(app_name) / self.filename

        if not self.config_path.exists():
            self._write(dict(MAIN_CONFIG))

    def _read(self) -> Dict:
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError, OSError):
            self._write(dict(MAIN_CONFIG))
            return dict(MAIN_CONFIG)

        if not isinstance(data, dict):
            raise MainConfigError(f"Config file {self.config_path} does not contain a dict")

        return data

    def _write(self, cfg: Dict) -> None:
        _atomic_write(self.config_path, cfg)

    @staticmethod
    def _validate_fields(fields: Dict) -> None:
        unknown = set(fields) - set(MAIN_CONFIG_SCHEMA)
        if unknown:
            raise MainConfigError(
                f"Unknown config key(s): {sorted(unknown)}. "
                f"Allowed keys: {sorted(MAIN_CONFIG_SCHEMA)}"
            )

        for key, value in fields.items():
            expected_type, predicate, msg = MAIN_CONFIG_SCHEMA[key]
            if not isinstance(value, expected_type):
                raise MainConfigError(
                    f"'{key}' must be of type {expected_type.__name__}, "
                    f"got {type(value).__name__}"
                )
            if not predicate(value):
                raise MainConfigError(f"'{key}' {msg}, got {value!r}")

    def get(self) -> Dict:
        return self._read()

    def update(self, fields: Dict) -> Dict:
        if not isinstance(fields, dict) or not fields:
            raise MainConfigError("'fields' must be a non-empty dict")

        self._validate_fields(fields)

        cfg = self._read()
        cfg.update(fields)
        self._write(cfg)
        return cfg

    def reset_to_default(self) -> Dict:
        self._write(dict(MAIN_CONFIG))
        return dict(MAIN_CONFIG)