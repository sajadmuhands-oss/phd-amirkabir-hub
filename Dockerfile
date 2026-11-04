FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY start.bat README.md Procfile ./

RUN mkdir -p data uploads/research uploads/presentations uploads/documents uploads/misc

ENV PORT=8088
EXPOSE 8088

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
