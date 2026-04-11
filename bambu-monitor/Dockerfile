FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    paho-mqtt==1.6.1 \
    httpx==0.27.0 \
    flask==3.0.3 \
    waitress==3.0.1

COPY server.py .

EXPOSE 8015

CMD ["python", "server.py"]
