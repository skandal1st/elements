FROM docker:24-cli

RUN apk add --no-cache bash curl git jq redis postgresql-client

WORKDIR /app
COPY watchdog.sh update.sh rollback.sh /app/
RUN chmod +x /app/*.sh

ENV BACKEND_URL=http://backend:8000 \
    REDIS_QUEUE_KEY=elements:updates:queue \
    COMPOSE_FILE=/workspace/docker-compose.prod.yml

CMD ["/app/watchdog.sh"]
