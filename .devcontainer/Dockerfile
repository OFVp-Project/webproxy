FROM debian:latest
ENV DEBIAN_FRONTEND="noninteractive"
RUN \
  apt update && \
  apt install -y git curl wget sudo procps zsh tar screen ca-certificates procps lsb-release xdg-utils g++ libatomic1 libnss3 libatk-bridge2.0-0 gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxrandr2 libxrender1 libxss1 libxtst6 fonts-liberation libnss3 libgbm-dev

# Install latest node
RUN wget $(wget -qO- https://api.github.com/repos/Sirherobrine23/DebianNodejsFiles/releases | grep 'browser_download_url' | grep "$(dpkg --print-architecture)" | cut -d '"' -f 4 | sort | uniq | tail -n 1) -q -O /tmp/nodejs.deb && dpkg -i /tmp/nodejs.deb && rm -rfv /tmp/nodejs.deb && npm install -g npm@latest

# Install Docker and Docker Compose
VOLUME [ "/var/lib/docker" ]
RUN wget -qO- https://get.docker.com | sh && \
  wget -q $(wget -qO- https://api.github.com/repos/docker/compose/releases | grep 'browser_download_url' | grep -v '.sha' | grep $(uname -s) | grep $(uname -m) | cut -d '"' -f 4 | sort | tail -n1)\
  -O /usr/local/bin/docker-compose && chmod +x -v /usr/local/bin/docker-compose

# Install minikube and kubectl
RUN curl -Lo minikube "https://storage.googleapis.com/minikube/releases/latest/minikube-linux-$(dpkg --print-architecture)" && \
  chmod +x minikube && mv minikube /usr/bin && \
  curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/$(dpkg --print-architecture)/kubectl" && \
  chmod +x kubectl && mv kubectl /usr/bin

# Create Start Script
ARG DOCKERD_ARGS="--experimental"
ARG MINIKUBE_ARGS="--driver=docker"
RUN (\
echo '#''!/bin/bash';\
echo 'if ! [[ -f "/var/run/docker.sock" ]];then';\
echo "  (sudo dockerd ${DOCKERD_ARGS}) &";\
echo "  (minikube start ${MINIKUBE_ARGS}) &";\
echo "fi";\
echo 'if ! [[ -z "$@" ]]; then';\
echo '  sh -c "$@"';\
echo "fi";\
echo "";\
echo "sleep infinity") | tee /usr/local/bin/start.sh && chmod a+x /usr/local/bin/start.sh

# Add non root user
ARG USERNAME="devcontainer"
ARG USER_UID="1000"
ARG USER_GID=$USER_UID
RUN \
  groupadd --gid $USER_GID $USERNAME && \
  adduser --disabled-password --gecos "" --shell /usr/bin/zsh --uid $USER_UID --gid $USER_GID $USERNAME && \
  usermod -aG sudo $USERNAME && echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/$USERNAME && \
  chmod 0440 /etc/sudoers.d/$USERNAME && \
  usermod -aG docker $USERNAME

USER $USERNAME
WORKDIR /home/$USERNAME
CMD [ "/usr/bin/zsh" ]

# Install oh my zsh
RUN yes | sh -c "$(curl -fsSL https://raw.githubusercontent.com/robbyrussell/oh-my-zsh/master/tools/install.sh)" && \
  git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ~/.oh-my-zsh/custom/plugins/zsh-syntax-highlighting && \
  git clone https://github.com/zsh-users/zsh-autosuggestions ~/.oh-my-zsh/custom/plugins/zsh-autosuggestions && \
  sed -e 's|ZSH_THEME=".*"|ZSH_THEME="strug"|g' -i ~/.zshrc && \
  sed -e 's|plugins=(.*)|plugins=(git docker kubectl zsh-syntax-highlighting zsh-autosuggestions)|g' -i ~/.zshrc

# Install typescript and ts-node
RUN sudo npm install -g typescript ts-node

# Start Script
ENTRYPOINT [ "/usr/local/bin/start.sh" ]