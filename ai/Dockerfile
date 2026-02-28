FROM python:3.12-slim

WORKDIR /agent

COPY agent/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY agent/ .

CMD ["python", "main.py"]
