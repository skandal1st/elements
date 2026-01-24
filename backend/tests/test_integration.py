"""
Базовые тесты для интеграционного тестирования
"""
import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health_check():
    """Тест health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "modules" in data


def test_portal_dashboard_requires_auth():
    """Тест что dashboard требует аутентификации"""
    response = client.get("/api/v1/portal/dashboard")
    assert response.status_code == 401 or response.status_code == 422


def test_module_info_endpoints():
    """Тест информационных endpoints модулей"""
    hr_response = client.get("/api/v1/hr/")
    assert hr_response.status_code == 200
    
    it_response = client.get("/api/v1/it/")
    assert it_response.status_code == 200
