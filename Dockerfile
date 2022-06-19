FROM debian:latest
# Install Wget and Node.js
ARG DEBIAN_FRONTEND="noninteractive"
RUN apt update && apt install -y wget && wget -qO- https://raw.githubusercontent.com/Sirherobrine23/DebianNodejsFiles/main/debianInstall.sh | bash && rm -rf /var/lib/apt/*

WORKDIR /app
ENTRYPOINT [ "node", "dist/index.js", "--port", "80" ]
EXPOSE 80:80/tcp
COPY ./package*.json ./
RUN npm install --no-save
STOPSIGNAL SIGINT
COPY ./ ./
RUN npm run build