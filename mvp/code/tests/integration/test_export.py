"""Export PDF endpoint — TAD g02 §9.1 + SRS f13 UC-13-01 AC-13-08+09."""

from __future__ import annotations


def test_export_requires_auth(client):
    r = client.get("/api/export/pdf/run_does_not_matter")
    assert r.status_code == 401


def test_export_404_unknown_run(client, auth_headers):
    r = client.get("/api/export/pdf/run_unknown_xyz", headers=auth_headers)
    assert r.status_code == 404


def test_export_no_data_returns_err_13_01(client, auth_headers, screening_data):
    """Run vừa được tạo nhưng chưa có scored_count → ERR-13-01.

    Manually tạo 1 run PENDING (qua POST /run) thì BG sẽ chạy ngay với TestClient sync;
    để test ERR-13-01 ta tạo run row trực tiếp với scored_count=0.
    """
    from datetime import UTC, datetime

    from app.db.session import SessionLocal
    from app.repositories import screening_repo

    with SessionLocal() as db:
        screening_repo.create_run(
            db,
            run_id="run_no_data_test",
            run_at=datetime.now(UTC),
            status="COMPLETED",
            model_version="baseline_v2",
            settings_version=1,
            total_capital=100_000_000,
            thresholds_json=None,
        )
        db.commit()

    try:
        r = client.get("/api/export/pdf/run_no_data_test", headers=auth_headers)
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "ERR-13-01"
    finally:
        with SessionLocal() as db:
            from app.models.run import ScreeningRun

            row = db.get(ScreeningRun, "run_no_data_test")
            if row:
                db.delete(row)
                db.commit()


def test_export_returns_pdf_response_headers(client, auth_headers, completed_run):
    """AC-13-08: Content-Type=application/pdf + Content-Disposition attachment."""
    r = client.get(f"/api/export/pdf/{completed_run}", headers=auth_headers)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("application/pdf")
    cd = r.headers.get("content-disposition", "")
    assert "attachment" in cd
    assert f'filename="run-{completed_run}.pdf"' in cd
    # Body non-empty (binary or HTML mock)
    assert len(r.content) > 0


def test_export_content_html_mock_mode(client, auth_headers, completed_run, monkeypatch):
    """EXPORT_PDF_MODE=html_mock → body is HTML string starting with `<!doctype html>`."""
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "export_pdf_mode", "html_mock", raising=False)

    r = client.get(f"/api/export/pdf/{completed_run}", headers=auth_headers)
    assert r.status_code == 200
    # Headers stable per AC-13-08
    assert r.headers["content-type"].startswith("application/pdf")
    body = r.content
    assert body.startswith(b"<!doctype html>"), f"Expected HTML mock, got: {body[:50]}"
    # Sanity: should mention the run_id and Vietnamese disclaimer
    assert b"VN RE AI Screener" in body
    assert b"khuy\xe1\xba\xbfn ngh\xe1\xbb\x8b" in body  # "khuyến nghị"
