FROM ubuntu:latest AS ubuntu_base
ENV DEBIAN_FRONTEND="noninteractive"
RUN apt update && apt -y install build-essential wget curl git unzip zip python3 python python3-pip

FROM ubuntu_base AS webproxy
RUN apt install python3 -y
WORKDIR /webproxy
COPY ./src/webproxy/ ./
ENTRYPOINT [ "python3", "main.py" ]

FROM ubuntu_base AS badvpn
RUN \
BADVPNTAG="$(curl -Ssl https://api.github.com/repos/OFVp-Project/BadvpnBin/releases/latest | grep 'tag_name' | cut -d \" -f 4)";\
echo "Downloading from URL: https://github.com/OFVp-Project/BadvpnBin/releases/download/${BADVPNTAG}/badvpn-udpgw-$(uname -m)"; \
wget -Q "https://github.com/OFVp-Project/BadvpnBin/releases/download/${BADVPNTAG}/badvpn-udpgw-$(uname -m)" -O /usr/bin/badvpn-udpgw && \
chmod +x -v /usr/bin/badvpn-udpgw
