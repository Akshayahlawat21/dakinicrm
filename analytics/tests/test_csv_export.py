from app.main import report_to_csv


def test_csv_export_flattens_rows_and_preserves_nested_fields():
    result = report_to_csv("lead-sources", {
        "period": "month",
        "data": [{"source": "Web", "lead_count": 2, "percentage": 100.0}]
    })
    assert "source,lead_count,percentage" in result
    assert "Web,2,100.0" in result


def test_csv_export_empty_report_returns_informational_row():
    result = report_to_csv("pipeline-by-stage", {"data": [], "data_status": "empty"})
    assert "data_status" in result
    assert "empty" in result
