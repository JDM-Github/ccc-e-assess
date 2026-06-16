import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext
import re
import os


# ── Comment removal logic ──────────────────────────────────────────────────────

def remove_comments(source: str) -> str:
    """
    Remove all JS/JSX/TSX comments from source without touching
    string literals, template literals, regex literals, or JSX content.

    Handles:
      - // single-line comments
      - /* ... */ block comments (including /** JSDoc */)
      - {/* ... */} JSX expression comments
    """
    result = []
    i = 0
    length = len(source)

    while i < length:
        # ── Template literal  `...`  ─────────────────────────────────────────
        if source[i] == '`':
            end = i + 1
            while end < length:
                if source[end] == '\\':
                    end += 2
                    continue
                if source[end] == '`':
                    end += 1
                    break
                end += 1
            result.append(source[i:end])
            i = end
            continue

        # ── Double-quoted string  "..." ──────────────────────────────────────
        if source[i] == '"':
            end = i + 1
            while end < length:
                if source[end] == '\\':
                    end += 2
                    continue
                if source[end] == '"':
                    end += 1
                    break
                end += 1
            result.append(source[i:end])
            i = end
            continue

        # ── Single-quoted string  '...' ──────────────────────────────────────
        if source[i] == "'":
            end = i + 1
            while end < length:
                if source[end] == '\\':
                    end += 2
                    continue
                if source[end] == "'":
                    end += 1
                    break
                end += 1
            result.append(source[i:end])
            i = end
            continue

        # ── JSX comment  {/* ... */} ─────────────────────────────────────────
        if source[i:i+3] == '{/*':
            end = source.find('*/}', i + 3)
            if end == -1:
                # Malformed; keep as-is to avoid data loss
                result.append(source[i])
                i += 1
            else:
                i = end + 3   # skip entire {/* ... */}
            continue

        # ── Block comment  /* ... */ ─────────────────────────────────────────
        if source[i:i+2] == '/*':
            end = source.find('*/', i + 2)
            if end == -1:
                result.append(source[i])
                i += 1
            else:
                # Preserve the newline so line numbers don't drift
                skipped = source[i:end + 2]
                result.append('\n' * skipped.count('\n'))
                i = end + 2
            continue

        # ── Single-line comment  // ... ──────────────────────────────────────
        if source[i:i+2] == '//':
            end = source.find('\n', i + 2)
            if end == -1:
                i = length          # comment runs to EOF
            else:
                i = end             # keep the newline itself
            continue

        # ── Regex literal  /pattern/flags ────────────────────────────────────
        # Heuristic: '/' after an operator/keyword context is a regex, not division.
        if source[i] == '/' and i + 1 < length and source[i + 1] not in ('/', '*'):
            # Look backwards at the last non-space character
            j = len(result) - 1
            while j >= 0 and result[j] in ('', ' ', '\t', '\n'):
                j -= 1
            prev = result[j][-1] if j >= 0 and result[j] else ''
            is_regex = prev in ('=', '(', '[', '!', '&', '|', '?', ':', ',',
                                 '{', '}', ';', '+', '-', '*', '%', '<', '>',
                                 '~', '^', '') or prev.isalpha() and prev in 'return typeof void delete new in instanceof'
            if prev.isdigit() or prev in (')', ']', '_', '$') or (prev.isalpha() and prev not in 'return typeof void delete new in instanceof'):
                is_regex = False

            if is_regex:
                end = i + 1
                in_class = False
                while end < length:
                    ch = source[end]
                    if ch == '\\':
                        end += 2
                        continue
                    if ch == '[':
                        in_class = True
                    elif ch == ']':
                        in_class = False
                    elif ch == '/' and not in_class:
                        end += 1
                        # consume flags
                        while end < length and source[end].isalpha():
                            end += 1
                        break
                    elif ch == '\n':
                        break
                    end += 1
                result.append(source[i:end])
                i = end
                continue

        result.append(source[i])
        i += 1

    code = ''.join(result)

    # ── Post-pass: collapse 3+ blank lines → 2 blank lines ──────────────────
    code = re.sub(r'\n{3,}', '\n\n', code)

    return code


# ── Tkinter UI ─────────────────────────────────────────────────────────────────

class App(tk.Tk):
    DARK_BG    = "#1e1e2e"
    PANEL_BG   = "#2a2a3d"
    ACCENT     = "#7c6af7"       # purple
    ACCENT_HOV = "#9d8fff"
    TEXT_PRI   = "#e2e2f0"
    TEXT_SEC   = "#888899"
    SUCCESS    = "#4caf82"
    ERROR      = "#e06c75"
    FONT_BODY  = ("Segoe UI", 10)
    FONT_MONO  = ("Consolas", 9)
    FONT_HEAD  = ("Segoe UI Semibold", 13)

    def __init__(self):
        super().__init__()
        self.title("React Comment Remover")
        self.geometry("780x560")
        self.resizable(True, True)
        self.configure(bg=self.DARK_BG)
        self.selected_file = tk.StringVar(value="")
        self._build_ui()

    # ── Layout ──────────────────────────────────────────────────────────────

    def _build_ui(self):
        # Header
        hdr = tk.Frame(self, bg=self.PANEL_BG, pady=14)
        hdr.pack(fill="x")
        tk.Label(hdr, text="⚛  React Comment Remover",
                 font=self.FONT_HEAD, bg=self.PANEL_BG,
                 fg=self.TEXT_PRI).pack(side="left", padx=20)
        tk.Label(hdr, text="Strips // and /* */ and {/* */} comments safely",
                 font=("Segoe UI", 9), bg=self.PANEL_BG,
                 fg=self.TEXT_SEC).pack(side="left", padx=4)

        # File picker row
        pick_frame = tk.Frame(self, bg=self.DARK_BG, pady=16)
        pick_frame.pack(fill="x", padx=24)

        self.path_label = tk.Label(
            pick_frame, textvariable=self.selected_file,
            bg=self.PANEL_BG, fg=self.TEXT_SEC,
            font=self.FONT_BODY, anchor="w",
            padx=10, pady=8, width=60,
            relief="flat", cursor="hand2"
        )
        self.path_label.pack(side="left", fill="x", expand=True, ipady=2)
        self.path_label.bind("<Button-1>", lambda e: self._pick_file())

        self._btn(pick_frame, "Browse…", self._pick_file,
                  side="left", padx=(10, 0))

        # Options row
        opt_frame = tk.Frame(self, bg=self.DARK_BG)
        opt_frame.pack(fill="x", padx=24, pady=(0, 10))

        self.preview_var = tk.BooleanVar(value=True)
        cb2 = tk.Checkbutton(
            opt_frame, text="Preview result",
            variable=self.preview_var,
            bg=self.DARK_BG, fg=self.TEXT_PRI,
            selectcolor=self.PANEL_BG, activebackground=self.DARK_BG,
            activeforeground=self.TEXT_PRI,
            font=self.FONT_BODY, cursor="hand2"
        )
        cb2.pack(side="left")

        # Action button
        action_frame = tk.Frame(self, bg=self.DARK_BG)
        action_frame.pack(fill="x", padx=24, pady=(0, 14))
        self.process_btn = self._btn(
            action_frame, "Remove Comments", self._process,
            side="left", primary=True
        )

        # Status bar
        self.status_var = tk.StringVar(value="Select a .js / .jsx / .ts / .tsx file to get started.")
        self.status_lbl = tk.Label(
            action_frame, textvariable=self.status_var,
            bg=self.DARK_BG, fg=self.TEXT_SEC,
            font=("Segoe UI", 9), anchor="w", padx=16
        )
        self.status_lbl.pack(side="left", fill="x", expand=True)

        # Preview pane
        prev_frame = tk.Frame(self, bg=self.DARK_BG)
        prev_frame.pack(fill="both", expand=True, padx=24, pady=(0, 20))

        tk.Label(prev_frame, text="PREVIEW", bg=self.DARK_BG,
                 fg=self.TEXT_SEC, font=("Segoe UI", 8)).pack(anchor="w")

        self.preview = scrolledtext.ScrolledText(
            prev_frame, bg=self.PANEL_BG, fg=self.TEXT_PRI,
            font=self.FONT_MONO, relief="flat",
            insertbackground=self.TEXT_PRI,
            selectbackground=self.ACCENT,
            wrap="none", state="disabled",
            padx=10, pady=8
        )
        self.preview.pack(fill="both", expand=True)

    def _btn(self, parent, text, cmd, side="left",
             padx=0, primary=False):
        bg  = self.ACCENT     if primary else self.PANEL_BG
        fg  = "#ffffff"       if primary else self.TEXT_PRI
        hov = self.ACCENT_HOV if primary else "#3a3a52"

        b = tk.Button(
            parent, text=text, command=cmd,
            bg=bg, fg=fg, activebackground=hov,
            activeforeground=fg,
            font=("Segoe UI Semibold", 10) if primary else self.FONT_BODY,
            relief="flat", cursor="hand2",
            padx=18, pady=8, bd=0
        )
        b.pack(side=side, padx=padx)
        return b

    # ── Actions ─────────────────────────────────────────────────────────────

    def _pick_file(self):
        path = filedialog.askopenfilename(
            title="Select a React file",
            filetypes=[
                ("React / JS files", "*.js *.jsx *.ts *.tsx"),
                ("All files", "*.*"),
            ]
        )
        if path:
            self.selected_file.set(path)
            self._set_status(f"Loaded: {os.path.basename(path)}", "normal")
            self._show_preview("")      # clear old preview

    def _process(self):
        path = self.selected_file.get()
        if not path:
            messagebox.showwarning("No file", "Please select a file first.")
            return
        if not os.path.isfile(path):
            messagebox.showerror("Not found", f"File not found:\n{path}")
            return

        try:
            with open(path, "r", encoding="utf-8") as f:
                original = f.read()
        except Exception as exc:
            messagebox.showerror("Read error", str(exc))
            return

        cleaned = remove_comments(original)

        # Sanity check: cleaned file must not be shorter by more than 80 %
        if len(original) > 0 and len(cleaned) < len(original) * 0.20:
            if not messagebox.askyesno(
                "Unusual result",
                "The cleaned file is more than 80 % shorter than the original.\n"
                "This may indicate a problem.\n\nSave anyway?"
            ):
                return

        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(cleaned)
        except Exception as exc:
            messagebox.showerror("Write error", str(exc))
            return

        self._set_status(f"✓ Done — {os.path.basename(path)} cleaned.", "success")

        if self.preview_var.get():
            self._show_preview(cleaned)

    def _show_preview(self, text: str):
        self.preview.config(state="normal")
        self.preview.delete("1.0", "end")
        self.preview.insert("1.0", text)
        self.preview.config(state="disabled")

    def _set_status(self, msg: str, kind: str = "normal"):
        colours = {
            "normal":  self.TEXT_SEC,
            "success": self.SUCCESS,
            "error":   self.ERROR,
        }
        self.status_var.set(msg)
        self.status_lbl.config(fg=colours.get(kind, self.TEXT_SEC))


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = App()
    app.mainloop()