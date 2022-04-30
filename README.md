Proxy SSH Server to HTTP Socket to baypass firewall rules.

## Run/Install

Deploy with docker image and git node package

### Docker

```sh
docker run --rm -ti -p 80:80 ghcr.io/ofvp-project/webproxy:latest -l log
```

### npm/npx

* npx: `npx https://github.com/OFVp-Project/webproxy -l log`
* npm: `npm install -g https://github.com/OFVp-Project/webproxy && ofvp_webproxy -l log`