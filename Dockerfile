FROM ubuntu:latest
ENV DEBIAN_FRONTEND="noninteractive"
RUN apt update && apt -y install python3
WORKDIR /webproxy
COPY ./ ./
ENV PYTHONUNBUFFERED="1"
ENTRYPOINT [ "python3", "-u", "main.py" ]