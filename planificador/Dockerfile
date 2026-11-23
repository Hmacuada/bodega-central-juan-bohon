# Planificador CFT Juan Bohon: servidor Node + solver CP-SAT (Python con OR-Tools).
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip \
  && pip3 install --no-cache-dir --break-system-packages ortools==9.15.6755 \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
ENV HOST=0.0.0.0 PYTHON=python3 NODE_ENV=production
EXPOSE 3030
CMD ["node", "server.js"]
