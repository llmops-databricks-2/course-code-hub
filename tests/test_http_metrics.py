"""HTTP metrics cover successes and errors without collecting request payloads."""

import asyncio
from types import SimpleNamespace
from unittest.mock import Mock

from agent_server.http_metrics import HttpMetricsMiddleware


def test_records_status_and_route_for_http_response():
    duration = Mock()

    async def application(scope, receive, send):
        scope["route"] = SimpleNamespace(path="/responses")
        await send({"type": "http.response.start", "status": 503})
        await send({"type": "http.response.body", "body": b""})

    async def send(message):
        pass

    scope = {"type": "http", "method": "POST", "path": "/responses"}
    asyncio.run(HttpMetricsMiddleware(application, duration)(scope, None, send))
    value, attributes = duration.record.call_args.args
    assert value >= 0
    assert attributes == {
        "http.route": "/responses",
        "http.request.method": "POST",
        "http.response.status_code": 503,
    }


def test_records_error_if_app_raises_before_response():
    duration = Mock()

    async def application(scope, receive, send):
        raise RuntimeError("failure")

    async def run():
        try:
            await HttpMetricsMiddleware(application, duration)(
                {"type": "http", "method": "GET"}, None, None
            )
        except RuntimeError:
            pass

    asyncio.run(run())
    assert duration.record.call_args.args[1]["http.response.status_code"] == 500
