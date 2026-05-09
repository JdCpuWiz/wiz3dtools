FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir "mcp[cli]>=1.0.0" httpx

ARG GIT_SHA=unknown
RUN echo "Building for $GIT_SHA"

COPY server.py .

EXPOSE 8014

CMD ["python", "server.py"]
