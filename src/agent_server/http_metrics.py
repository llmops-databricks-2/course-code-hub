"""Export request metrics without changing MLflow's trace provider."""

import os
import time

from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.metrics import Histogram, MeterProvider
from opentelemetry.sdk.metrics.export import (
    AggregationTemporality,
    PeriodicExportingMetricReader,
)


def configure_http_metrics(app):
    """Record HTTP request counts and duration when App telemetry is configured."""
    if not os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"):
        return None

    exporter = OTLPMetricExporter(preferred_temporality={Histogram: AggregationTemporality.DELTA})
    reader = PeriodicExportingMetricReader(exporter, export_interval_millis=30000)
    provider = MeterProvider(metric_readers=[reader])
    duration = provider.get_meter("arxiv_curator.http").create_histogram(
        "app.http.request.duration", unit="s", description="HTTP request duration"
    )
    app.add_middleware(HttpMetricsMiddleware, duration=duration)
    return provider


class HttpMetricsMiddleware:
    """Measure completed HTTP responses, including errors, without recording payloads."""

    def __init__(self, app, duration):
        self.app = app
        self.duration = duration

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        start = time.perf_counter()
        status = 500

        async def send_response(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_response)
        finally:
            route = scope.get("route")
            self.duration.record(
                time.perf_counter() - start,
                {
                    "http.route": getattr(route, "path", "<unmatched>"),
                    "http.request.method": scope.get("method", "UNKNOWN"),
                    "http.response.status_code": status,
                },
            )
