# Production Multi-Stage Dockerfile for AI Scrum Master API
FROM python:3.11-slim as builder

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Final Runtime Image
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PORT=8000 \
    PYTHONPATH="/app"

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy packages and API application
COPY packages /app/packages
COPY apps/api /app/apps/api
COPY scripts /app/scripts

EXPOSE 8000

CMD ["sh", "-c", "uvicorn apps.api.src.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
