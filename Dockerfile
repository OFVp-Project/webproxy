FROM ubuntu:latest
ENV DEBIAN_FRONTEND="noninteractive"
RUN apt update && apt -y install python3 curl
WORKDIR /webproxy
COPY ./ ./
ENV PYTHONUNBUFFERED="1"
ENTRYPOINT [ "python3", "-u", "main.py", "-p", "80" ]
EXPOSE 80:80/tcp
HEALTHCHECK --interval=15s --timeout=5s CMD curl -f http://localhost:80 || exit 1