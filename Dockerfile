FROM debian:latest AS maneger
CMD [ "/bin/bash", "-c" ]
ENV DEBIAN_FRONTEND="noninteractive"
RUN apt update && apt install -y git curl wget python3-minimal
RUN VERSION=$(wget -qO- https://api.github.com/repos/Sirherobrine23/DebianNodejsFiles/releases/latest |grep 'name' | grep "nodejs"|grep "$(dpkg --print-architecture)"|cut -d '"' -f 4 | sed 's|nodejs_||g' | sed -e 's|_.*.deb||g'|sort | uniq|tail -n 1); wget -q "https://github.com/Sirherobrine23/DebianNodejsFiles/releases/download/debs/nodejs_${VERSION}_$(dpkg --print-architecture).deb" -O /tmp/nodejs.deb && dpkg -i /tmp/nodejs.deb && rm -rfv /tmp/nodejs.deb && npm install -g npm@latest
WORKDIR /app
COPY ./ ./
RUN npm install --no-save
RUN npm run build
STOPSIGNAL SIGINT
ENTRYPOINT [ "node", "dist/index.js" ]