# StudyBuddy Q backend — minimal Python 3.11 image

FROM python:3.11-slim

WORKDIR /app

# Install system deps (none required at MVP — cryptography ships wheels)
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy backend dependencies + install
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend source + vendored pipeline
COPY backend/ /app/backend/
COPY pipeline/ /app/pipeline/

# Run from /app so backend.* and pipeline.* both resolve.
WORKDIR /app

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
