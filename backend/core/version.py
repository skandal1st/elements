"""Версия платформы Elements.

Источник истины для бэкенда и API-эндпоинтов.
При выпуске релиза обновляйте VERSION; BUILD заполняется CI (короткий git sha).
"""
import os

VERSION = os.getenv("APP_VERSION", "1.0.0")
BUILD = os.getenv("APP_BUILD", "")
