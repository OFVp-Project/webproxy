FROM ubuntu:latest
ENV DEBIAN_FRONTEND="noninteractive"
RUN apt update && apt -y install python3
WORKDIR /webproxy
COPY ./ ./
ENTRYPOINT [ "python3", "main.py", "-p", "80", "-m", "From OFVp Open Source Project" ]