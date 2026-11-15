# Databricks notebook source
# MAGIC %md
# MAGIC # Lecture 4.1: MLflow Tracing Implementation
# MAGIC
# MAGIC Run notebook 4.0 first to configure UC trace storage and service principal permissions.

# COMMAND ----------

import os
import random
from datetime import datetime

import mlflow
from loguru import logger
from mlflow.entities import SpanType
from pyspark.sql import SparkSession

from arxiv_curator.config import get_env, load_config

spark = SparkSession.builder.getOrCreate()
env = get_env(spark)
cfg = load_config("../project_config.yml", env)
os.environ["MLFLOW_TRACING_SQL_WAREHOUSE_ID"] = cfg.warehouse_id
mlflow.set_experiment(cfg.experiment_name)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Simple Tracing with @mlflow.trace

# COMMAND ----------


# Simple function with tracing
@mlflow.trace
def add_numbers(x: int, y: int) -> int:
    """Add two numbers."""
    return x + y


# Call the function
result = add_numbers(5, 3)
logger.info(f"Result: {result}")

logger.info("Trace created. View it in the MLflow UI.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Tracing with Span Types

# COMMAND ----------


@mlflow.trace(span_type=SpanType.LLM)
def call_llm(prompt: str) -> str:
    """Simulate an LLM call."""
    return f"Response to: {prompt}"


@mlflow.trace(span_type=SpanType.TOOL)
def search_database(query: str) -> list:
    """Simulate a database search."""
    return [{"id": 1, "title": "Result 1"}, {"id": 2, "title": "Result 2"}]


@mlflow.trace(span_type=SpanType.CHAIN)
def process_query(user_query: str) -> str:
    """Process a user query with LLM and tools."""
    # Search database
    results = search_database(user_query)

    # Call LLM with results
    prompt = f"User asked: {user_query}\nResults: {results}"
    response = call_llm(prompt)

    return response


# Test the chain
output = process_query("What are recent papers about transformers?")
logger.info(f"Output: {output}")

logger.info("Multi-span trace created.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Manual Span Creation

# COMMAND ----------


def complex_function(x: int, y: int) -> int:
    """Function with manual span control."""

    with mlflow.start_span("complex_function") as span:
        # Set inputs
        span.set_inputs({"x": x, "y": y})

        # Do some work
        with mlflow.start_span("step_1_multiply") as step1:
            result1 = x * y
            step1.set_outputs({"result": result1})

        with mlflow.start_span("step_2_add") as step2:
            result2 = result1 + 10
            step2.set_outputs({"result": result2})

        # Set final outputs
        span.set_outputs({"final_result": result2})

        return result2


# Test
result = complex_function(5, 3)
logger.info(f"Result: {result}")

logger.info("Trace with nested spans created.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Adding Metadata and Tags

# COMMAND ----------

# Generate trace identifiers
timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
session_id = f"s-{timestamp}-{random.randint(100000, 999999)}"
request_id = f"req-{timestamp}-{random.randint(100000, 999999)}"
git_sha = "abc123def456"


@mlflow.trace
def function_with_metadata(x: int, y: int) -> int:
    """Function with rich metadata."""

    # Update current trace with metadata
    mlflow.update_current_trace(
        metadata={
            "mlflow.trace.session": session_id,
            "user_id": "user_123",
            "environment": "production",
        },
        tags={
            "model_serving_endpoint_name": "arxiv-agent-endpoint",
            "model_version": "1",
            "git_sha": git_sha,
            "request_type": "calculation",
        },
        client_request_id=request_id,
    )

    return x + y


# Test
result = function_with_metadata(10, 20)
logger.info(f"Result: {result}")
logger.info("Trace metadata:")
logger.info(f"  Session ID: {session_id}")
logger.info(f"  Request ID: {request_id}")
logger.info(f"  Git SHA: {git_sha}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 5. Searching Traces

# COMMAND ----------

# Search traces by git_sha
# Note: search_traces returns a DataFrame
traces_df = mlflow.search_traces(filter_string=f"tags.git_sha = '{git_sha}'", max_results=5)

logger.info(f"Found {len(traces_df)} traces with git_sha={git_sha}")

if len(traces_df) > 0:
    logger.info(f"Available columns: {list(traces_df.columns)}")
    logger.info("Trace Details:")

    # Display the DataFrame - select only columns that exist
    cols_to_show = []
    for col in ["request_id", "timestamp_ms", "status", "tags"]:
        if col in traces_df.columns:
            cols_to_show.append(col)

    if cols_to_show:
        display(traces_df[cols_to_show].head())
    else:
        # Just show all columns if none of the expected ones exist
        display(traces_df.head())
else:
    logger.info("No traces found. Run the preceding traced functions first.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 6. Tracing Real LLM Calls

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from openai import OpenAI

w = WorkspaceClient()

# Authenticate using Databricks SDK
host = w.config.host
token = w.tokens.create(lifetime_seconds=1200).token_value

# For Unity Catalog model services through AI Gateway
client = OpenAI(api_key=token, base_url=f"{host}/ai-gateway/mlflow/v1")


@mlflow.trace(span_type=SpanType.LLM)
def call_real_llm(prompt: str, model: str = None) -> str:
    """Call a real LLM with tracing."""

    model = model or cfg.llm_endpoint

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=100,
        temperature=0.7,
    )

    return response.choices[0].message.content


# Test with real LLM
result = call_real_llm("What is machine learning in one sentence?")
logger.info(f"LLM Response: {result}")

logger.info("Real LLM call traced.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 7. Tracing Agent Interactions

# COMMAND ----------


@mlflow.trace(span_type=SpanType.AGENT)
def agent_interaction(user_message: str) -> dict:
    """Simulate a complete agent interaction."""

    # Generate identifiers
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    session_id = f"s-{timestamp}-{random.randint(100000, 999999)}"
    request_id = f"req-{timestamp}-{random.randint(100000, 999999)}"

    # Add trace metadata
    mlflow.update_current_trace(
        metadata={
            "mlflow.trace.session": session_id,
        },
        tags={"agent_type": "research_assistant", "model_version": "1.0"},
        client_request_id=request_id,
    )

    # Step 1: Analyze query
    with mlflow.start_span("analyze_query", span_type=SpanType.CHAIN) as span:
        span.set_inputs({"query": user_message})
        analysis = {"intent": "search", "topic": "machine learning"}
        span.set_outputs(analysis)

    # Step 2: Search (tool call)
    with mlflow.start_span("search_papers", span_type=SpanType.TOOL) as span:
        span.set_inputs({"query": analysis["topic"]})
        results = [{"title": "Paper 1", "relevance": 0.95}, {"title": "Paper 2", "relevance": 0.87}]
        span.set_outputs({"results": results})

    # Step 3: Generate response (LLM call)
    with mlflow.start_span("generate_response", span_type=SpanType.LLM) as span:
        span.set_inputs({"user_message": user_message, "search_results": results})
        response = f"I found {len(results)} relevant papers about {analysis['topic']}"
        span.set_outputs({"response": response})

    return {"response": response, "session_id": session_id, "request_id": request_id}


# Test agent interaction
result = agent_interaction("What papers discuss machine learning?")
logger.info(f"Agent Response: {result['response']}")
logger.info(f"Session ID: {result['session_id']}")
logger.info(f"Request ID: {result['request_id']}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 8. Analyzing Traces

# COMMAND ----------

# Get recent traces (returns DataFrame)
# Search all traces without experiment filter (simpler for demo)
recent_traces_df = mlflow.search_traces(order_by=["timestamp_ms DESC"], max_results=10)

logger.info(f"Recent Traces ({len(recent_traces_df)}):")

if len(recent_traces_df) > 0:
    # Display available columns first
    logger.info(f"Available columns: {list(recent_traces_df.columns)}")

    # Display the DataFrame with columns that exist
    cols_to_show = []
    for col in ["request_id", "trace_id", "timestamp_ms", "execution_time_ms", "status"]:
        if col in recent_traces_df.columns:
            cols_to_show.append(col)

    if cols_to_show:
        display(recent_traces_df[cols_to_show].head(10))
    else:
        # Just show first few columns if none of our preferred ones exist
        display(recent_traces_df.head(10))
else:
    logger.info("No traces found.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 9. Trace Attributes

# COMMAND ----------

if len(recent_traces_df) > 0:
    # Get first row as a Series
    trace = recent_traces_df.iloc[0]

    logger.info("Trace Attributes:")
    logger.info(f"Request ID: {trace.get('request_id', 'N/A')}")
    logger.info(f"Trace ID: {trace.get('trace_id', 'N/A')}")
    logger.info(f"Timestamp: {trace.get('timestamp_ms', 'N/A')}")
    logger.info(f"Execution Time: {trace.get('execution_time_ms', 'N/A')}ms")
    logger.info(f"Status: {trace.get('status', 'N/A')}")

    if "tags" in trace and trace["tags"]:
        logger.info("Tags:")
        for key, value in trace["tags"].items():
            logger.info(f"  {key}: {value}")

    if "request_metadata" in trace and trace["request_metadata"]:
        logger.info("Metadata:")
        for key, value in trace["request_metadata"].items():
            logger.info(f"  {key}: {value}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 10. Best Practices

# COMMAND ----------

# MAGIC %md
# MAGIC ### Do:
# MAGIC 1. **Use appropriate span types** (LLM, TOOL, CHAIN, AGENT)
# MAGIC 2. **Add session and request IDs** for tracking conversations
# MAGIC 3. **Include git_sha** for version tracking
# MAGIC 4. **Set inputs and outputs** for each span
# MAGIC 5. **Add meaningful tags** for filtering
# MAGIC 6. **Use nested spans** for complex operations
# MAGIC 7. **Trace all LLM calls** for cost tracking
# MAGIC 8. **Include error information** in traces
# MAGIC
# MAGIC ### Don't:
# MAGIC 1. Trace too granularly (performance overhead)
# MAGIC 2. Forget to add metadata
# MAGIC 3. Skip tracing expensive operations
# MAGIC 4. Ignore trace search capabilities
# MAGIC 5. Store sensitive data in traces
# MAGIC 6. Create traces without context

# COMMAND ----------

# MAGIC %md
# MAGIC ## 11. Trace Filtering Examples

# COMMAND ----------

# Filter by status
failed_traces = mlflow.search_traces(filter_string="status = 'ERROR'", max_results=5)
logger.info(f"Failed traces: {len(failed_traces)}")

# Filter by tag
endpoint_traces = mlflow.search_traces(
    filter_string="tags.model_serving_endpoint_name = 'arxiv-agent-endpoint'", max_results=5
)
logger.info(f"Traces for specific endpoint: {len(endpoint_traces)}")

# Filter by time range
recent_traces = mlflow.search_traces(
    filter_string="timestamp_ms > 1700000000000",  # Adjust timestamp
    max_results=5,
)
logger.info(f"Recent traces: {len(recent_traces)}")
