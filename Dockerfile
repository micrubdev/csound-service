FROM node:20-bookworm-slim

# Csound from Debian's repo (stable, prebuilt — no need to build from source
# for a personal free-tier deployment; swap to a source build if you need a
# newer version or extra opcode plugins later).
RUN apt-get update \
  && apt-get install -y --no-install-recommends csound ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

# Run as a non-root user — user-submitted Csound scores are untrusted input.
RUN useradd --create-home --shell /usr/sbin/nologin appuser
USER appuser

ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/server.js"]
