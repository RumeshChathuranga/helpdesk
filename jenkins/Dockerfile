# A Jenkins controller with the Docker CLI baked in, so the Docker
# Pipeline plugin can drive `agent { docker { ... } }` stages against the
# host's Docker daemon (mounted in compose.yml). This is
# Docker-outside-of-Docker — the controller needs the `docker` binary, not
# its own nested daemon.
FROM jenkins/jenkins:lts-jdk21

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
  && install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
  && chmod a+r /etc/apt/keyrings/docker.asc \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
    > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends docker-ce-cli \
  && rm -rf /var/lib/apt/lists/*

USER jenkins

# Baked into the image rather than installed by hand through the setup
# wizard, so a fresh container is pipeline-ready immediately.
RUN jenkins-plugin-cli --plugins \
  workflow-aggregator \
  docker-workflow \
  git
