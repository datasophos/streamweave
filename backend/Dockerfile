FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev tree curl unzip \
    && rm -rf /var/lib/apt/lists/*

# Install rclone (needed for S3/CIFS connection tests run by the API)
RUN curl -fsSL https://rclone.org/install.sh | bash

RUN pip install --no-cache-dir uv

COPY pyproject.toml .
COPY app/ app/
RUN uv pip install --system --no-cache .

COPY alembic.ini .
COPY alembic/ alembic/
COPY scripts/ scripts/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
