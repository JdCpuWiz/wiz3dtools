FROM python:3.11-slim

WORKDIR /app

# BuildPlan #6 Phase 2: bambu-monitor no longer speaks MQTT — it polls
# BamBuddy's REST API. paho-mqtt removed accordingly.
RUN pip install --no-cache-dir \
    httpx==0.27.0 \
    flask==3.0.3 \
    waitress==3.0.1

ARG GIT_SHA=unknown
RUN echo "Building for $GIT_SHA"

COPY server.py .

EXPOSE 8015

CMD ["python", "server.py"]
