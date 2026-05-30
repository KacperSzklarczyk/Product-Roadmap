FROM python:3.12-slim

WORKDIR /app

# Build deps for asyncmy (Cython/MySQL). Removed after pip install to keep the image slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc default-libmysqlclient-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Flush logs immediately (so uvicorn output appears in Railway logs).
ENV PYTHONUNBUFFERED=1

# Listen on $PORT (Railway injects it; default 8080 locally).
EXPOSE 8080
# Run migrations (non-blocking), then start the server. `exec` makes uvicorn PID 1.
# NOTE (Railway): if the edge can't reach the container ("connection dial timeout"),
# try `--host ::` (IPv6 dual-stack) — Railway's edge may dial over IPv6.
CMD ["sh", "-c", "aerich upgrade; exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
