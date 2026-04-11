FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir "mcp[cli]>=1.0.0" httpx

COPY server.py .

EXPOSE 8014

CMD ["python", "server.py"]
