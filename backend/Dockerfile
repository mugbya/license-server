# License Server Backend
FROM python:3.9-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Create non-root user for security
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8080

# Run with gunicorn (production)
# Workers: 4 (CPU-bound) or 2-4 x CPU cores for I/O-bound
# Use Gunicorn as process manager, UvicornWorker for ASGI/FastAPI
CMD ["gunicorn", "-c", "gunicorn.conf.py", "main:app"]
