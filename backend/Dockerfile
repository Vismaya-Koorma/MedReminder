# Use official lightweight Python image
FROM python:3.12-slim

# Prevent Python from writing pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Install system dependencies needed for psycopg2 compilation/runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /app

# Copy requirements and install python dependencies
COPY backend/requirements.txt /app/
RUN python -m pip install --no-cache-dir --default-timeout=180 --retries=10 -r requirements.txt

# Copy backend application source code
COPY backend /app/

# Expose port (defaults to 8000; Render dynamically maps PORT at runtime)
EXPOSE 8000

# Production entrypoint using Gunicorn bound to 0.0.0.0 and dynamic PORT
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 3 --threads 2 --timeout 120 config.wsgi:application"]
