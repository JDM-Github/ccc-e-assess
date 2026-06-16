# jdm-electron-flask-backend

Flask backend template for [jdm-electron-flask-template](https://github.com/JDM-Github/jdm-electron-flask-backend) desktop apps.

## Stack

- Python Flask + Flask-SocketIO
- [jdm-electron-flask](https://pypi.org/project/jdm-electron-flask/) PyPI package
- PyInstaller for exe packaging

## Structure

```
backend/
├── app/
│   ├── api/           # Blueprint routes
│   ├── core/          # Services
│   └── event/         # SocketIO events
├── config/
│   └── api.json       # Route registration
├── .env               # Secrets (gitignored)
├── production_run.py  # Entry point for exe
├── requirements.txt
└── run.py             # Dev entry point
```

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env
python run.py
```

## Adding an API

```bash
run make-api --name person
```

This scaffolds `app/api/person.py`, `app/core/person_service.py`, and registers it in `config/api.json`.

## Building the Exe

```bash
run compile --backend
```

Builds the Flask server as a standalone exe using PyInstaller and copies it to `electron/resources` and `electron/test`.

## Environment Variables

| Key | Description |
|---|---|
| `SECRET_KEY` | Flask secret key |
